import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { ActivityIndicator, Animated, Image, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useNavigation } from "@react-navigation/native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { WebView } from "react-native-webview";
import * as Location from "expo-location";
import {
  Card,
  Button,
  Icon,
  IconTile,
  Kicker,
  PulseRing,
  Rise,
  StatBox,
  StatRow,
  useReducedMotion,
} from "@/components/ui";
import {
  EMPTY_VISIT_FORM,
  VisitFormFields,
  validateVisitForm,
  visitFormToPayload,
  type VisitFormValues,
} from "@/components/dashboard/VisitFormFields";
import { PhotoCaptureView } from "@/components/camera";
import {
  useActivityPattern,
  useAuth,
  useAttendanceStatus,
  useResolvedGeofenceTarget,
  useHybridTargets,
  useFieldSummary,
  useQueuedFieldVisit,
} from "@/hooks";
import type { GeofenceTarget } from "@/hooks/useGeofence";
import type { FieldVisit } from "@/types";
import { useAttendanceSessionStore } from "@/store/attendanceSessionStore";
import { useAuthStore } from "@/store/authStore";
import { getCurrentPositionWithTimeout, formatDistance, haversineDistanceMeters } from "@/utils/geo";
import { getErrorMessage } from "@/utils/errors";
import { endpoints } from "@/api/endpoints";
import { env } from "@/config/env";
import { colors, fontFamilies, gradientDirection, gradients, spacing, typography } from "@/theme";
import { useTabBarClearance } from "@/navigation/tabBarClearance";

type Coords = { latitude: number; longitude: number };

// Keeps the on-screen "You" marker live while this screen stays open —
// distinct from PING_INTERVAL_MS (locationTracking.ts, 2 minutes), which is
// the background pipeline that actually drives attendance/geofence/auto-
// pause decisions server-side. This one is purely cosmetic (what the
// employee sees on this map), so it can refresh much faster without any of
// that other system's battery/server-load tradeoffs.
const FOREGROUND_REFRESH_MS = 5_000;

// Raw GPS fixes commonly wobble 10-50m even standing still (worse near
// tall buildings/flyovers — this screen's own geofence sits right next to
// one), so refreshing every few seconds with no filtering just draws every
// bit of that noise straight onto the map — which reads as the dot
// "fluctuating." Two mitigations, applied only to the live watch below
// (the one-time initial fixes on mount are shown as-is, just to paint
// something immediately — they're not a source of ongoing jitter):
//  1. A fix reporting worse accuracy than this is dropped outright — a
//     genuinely bad fix is worse than no update at all.
//  2. An accepted fix is blended toward the previously-shown point rather
//     than replacing it outright, so real movement still comes through
//     (over a couple of updates) without every small wobble visibly
//     teleporting the dot.
const MIN_ACCURACY_METERS = 30;
const SMOOTHING_FACTOR = 0.35;

// A raw "±18m" figure means little to most employees — bucketed into the
// same three tiers everywhere accuracy shows up in this app, so it reads
// the same way a status badge does. Anything worse than MIN_ACCURACY_METERS
// above never reaches here at all (the live watch drops it outright) — this
// only ever sees "Low" from the two one-time initial fixes on mount, which
// aren't filtered.
const ACCURACY_TIERS = {
  // Dot colours on the white map chips.
  high: { maxMeters: 15, label: "High accuracy", color: "#4ADE80" },
  medium: { maxMeters: MIN_ACCURACY_METERS, label: "Medium accuracy", color: "#F5A524" },
  low: { maxMeters: Infinity, label: "Low accuracy", color: "#F05252" },
} as const;

function accuracyTier(meters: number) {
  if (meters <= ACCURACY_TIERS.high.maxMeters) return ACCURACY_TIERS.high;
  if (meters <= ACCURACY_TIERS.medium.maxMeters) return ACCURACY_TIERS.medium;
  return ACCURACY_TIERS.low;
}

function blendTowards(prev: Coords, next: Coords, factor: number): Coords {
  return {
    latitude: prev.latitude + (next.latitude - prev.latitude) * factor,
    longitude: prev.longitude + (next.longitude - prev.longitude) * factor,
  };
}

/** Builds a self-contained Leaflet + OpenStreetMap page. No API key needed —
 * unlike react-native-maps, which requires a Google Maps key on Android even
 * for non-Google tile sources, this renders entirely inside a WebView. */
function buildMapHtml(
  userCoords: Coords | null,
  target: GeofenceTarget | null,
  route: Coords[],
  visits: FieldVisit[],
  targetLabel = "Office / Home",
  animate = true,
): string {
  const center = userCoords ?? target ?? route[0] ?? { latitude: 20.5937, longitude: 78.9629 };
  const zoom = userCoords || target || route.length ? 16 : 4;

  const userMarker = userCoords
    ? `L.marker([${userCoords.latitude}, ${userCoords.longitude}], {
        icon: L.divIcon({ className: "", iconSize: [72, 72], iconAnchor: [36, 36],
          html: '<div class="you"><span class="ping"></span><span class="dot"></span></div>' }),
        zIndexOffset: 1000
      }).addTo(map).bindPopup("You");`
    : "";

  const targetMarkers = target
    ? `L.circle([${target.latitude}, ${target.longitude}], {
        radius: ${target.radiusMeters}, color: "#FF9A3D", fillColor: "#EF6C00", fillOpacity: 0.1, weight: 1.5, dashArray: "5 6", className: "geo"
      }).addTo(map);
      L.marker([${target.latitude}, ${target.longitude}], {
        icon: L.divIcon({ className: "", iconSize: [14, 14], iconAnchor: [7, 7], html: '<span class="place"></span>' })
      }).addTo(map).bindPopup(${JSON.stringify(targetLabel)});`
    : "";

  const routeLine =
    route.length > 1
      ? `L.polyline(${JSON.stringify(route.map((p) => [p.latitude, p.longitude]))}, {
          color: "${colors.ink}", weight: 8, opacity: 0.8
        }).addTo(map);
        L.polyline(${JSON.stringify(route.map((p) => [p.latitude, p.longitude]))}, {
          color: "${colors.lime}", weight: 4.5, opacity: 1
        }).addTo(map);`
      : "";

  const visitMarkers = visits
    .map(
      (v) =>
        `L.marker([${v.latitude}, ${v.longitude}], {
          icon: L.icon({ iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
            iconSize: [20, 33], iconAnchor: [10, 33] })
        }).addTo(map).bindPopup(${JSON.stringify(v.name)});`,
    )
    .join("\n");

  const allPoints: [number, number][] = [
    ...route.map((p): [number, number] => [p.latitude, p.longitude]),
    ...visits.map((v): [number, number] => [v.latitude, v.longitude]),
    ...(userCoords ? [[userCoords.latitude, userCoords.longitude] as [number, number]] : []),
  ];

  const fitBounds =
    allPoints.length > 1
      ? `map.fitBounds(${JSON.stringify(allPoints)}, { padding: [50, 50] });`
      : userCoords && target
        ? `map.fitBounds([[${userCoords.latitude}, ${userCoords.longitude}], [${target.latitude}, ${target.longitude}]], { padding: [60, 60] });`
        : "";

  return `<!DOCTYPE html>
<html>
<head>
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
  <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
  <style>
    html, body, #map { height: 100%; margin: 0; padding: 0; background: #E9E4DC; }
    .leaflet-control-attribution { font-size: 9px; }
    .you { position: relative; width: 72px; height: 72px; }
    .you .ping { position: absolute; left: 0; top: 0; width: 72px; height: 72px; border-radius: 36px; background: rgba(255,154,61,.5); opacity: 0; ${animate ? "animation: ping 2.4s ease-out infinite;" : ""} }
    .you .dot { position: absolute; left: 27px; top: 27px; width: 18px; height: 18px; border-radius: 9px; background: #FF9A3D; border: 3px solid #fff; box-sizing: border-box; }
    .place { display: block; width: 14px; height: 14px; border-radius: 7px; background: #17130F; border: 2px solid #fff; box-sizing: border-box; }
    .geo { ${animate ? "animation: geo 3s ease-in-out infinite;" : ""} }
    @keyframes ping { 0% { transform: scale(.4); opacity: .8; } 100% { transform: scale(1.8); opacity: 0; } }
    @keyframes geo { 0%, 100% { opacity: .5; } 50% { opacity: 1; } }
  </style>
</head>
<body>
  <div id="map"></div>
  <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
  <script>
    var map = L.map('map', { zoomControl: false }).setView([${center.latitude}, ${center.longitude}], ${zoom});
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; OpenStreetMap contributors'
    }).addTo(map);
    ${userMarker}
    ${targetMarkers}
    ${routeLine}
    ${visitMarkers}
    ${fitBounds}
  </script>
</body>
</html>`;
}

function formatVisitTime(iso: string) {
  return new Date(iso).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
}

export function LiveMapScreen() {
  const tabClearance = useTabBarClearance();
  const insets = useSafeAreaInsets();
  const reducedMotion = useReducedMotion();
  const navigation = useNavigation();
  const { user } = useAuth();
  const accessToken = useAuthStore((s) => s.accessToken);
  const isTracking = useAttendanceSessionStore((s) => s.isTracking);
  const statusQuery = useAttendanceStatus(user?.employeeCode);
  // A WFH employee who chose Office today (see CheckInOutScreen's Home/
  // Office picker) needs this map geofenced against the office too, not
  // home — otherwise this screen would keep showing/enforcing their home
  // location all day despite them actually being in the office.
  const isWfhOfficeDay =
    user?.workMode === "WFH" && statusQuery.data?.exists === true && statusQuery.data.checkInMode === "OFFICE";
  const resolvedTarget = useResolvedGeofenceTarget(isWfhOfficeDay ? "OFFICE" : undefined);
  // HYBRID: the place they're at now — home in a HOME segment, the
  // destination while travelling, else the office.
  const isHybrid = user?.workMode === "HYBRID";
  const statusData = statusQuery.data?.exists ? statusQuery.data : null;
  const hybridTargets = useHybridTargets(statusData?.hybrid ?? null);
  const hybridSegment = isHybrid && statusData?.checkedIn && !statusData.checkedOut ? (statusData.segment ?? null) : null;
  const hybridPlace =
    hybridSegment?.mode === "TRANSIT"
      ? (hybridSegment.heading ?? null)
      : hybridSegment?.mode === "HOME" || hybridSegment?.mode === "OFFICE"
        ? hybridSegment.mode
        : null;
  const target = isHybrid
    ? hybridPlace === "HOME"
      ? hybridTargets.home
      : (hybridTargets.office ?? hybridTargets.home)
    : resolvedTarget;
  const pings = useActivityPattern(isTracking);

  const isFieldDay =
    user?.workMode === "FIELD" && statusQuery.data?.exists === true && statusQuery.data.checkInMode === "FIELD";
  const fieldSummaryQuery = useFieldSummary(isFieldDay);
  const queue = useQueuedFieldVisit();

  const [userCoords, setUserCoords] = useState<Coords | null>(null);
  // Accuracy (meters) of whichever fix `userCoords` currently reflects — a
  // fix that failed the MIN_ACCURACY_METERS filter below never reaches
  // here at all, so this is always "how good is the dot you're looking at
  // right now," not raw incoming noise.
  const [accuracyMeters, setAccuracyMeters] = useState<number | null>(null);
  const [locationError, setLocationError] = useState<string | null>(null);

  const [addingVisit, setAddingVisit] = useState(false);
  const [visitForm, setVisitForm] = useState<VisitFormValues>(EMPTY_VISIT_FORM);
  const [visitFormError, setVisitFormError] = useState<string | null>(null);
  const [visitPhotoDataUrl, setVisitPhotoDataUrl] = useState<string | null>(null);
  const [visitCameraOpen, setVisitCameraOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;
    let subscription: Location.LocationSubscription | null = null;

    (async () => {
      const permission = await Location.requestForegroundPermissionsAsync();
      if (permission.status !== "granted") {
        if (!cancelled) setLocationError("Location permission is required to show the map.");
        return;
      }

      // Show the device's last cached fix immediately (near-instant, often
      // already warm from background tracking) so the map isn't blank while
      // a live fix comes in — this is just a display pin, not used for any
      // geofence/check-in decision, so a few-second-old cache is fine here.
      try {
        const lastKnown = await Location.getLastKnownPositionAsync({
          maxAge: 5 * 60 * 1000,
        });
        if (lastKnown && !cancelled) {
          setUserCoords({ latitude: lastKnown.coords.latitude, longitude: lastKnown.coords.longitude });
          setAccuracyMeters(lastKnown.coords.accuracy ?? null);
        }
      } catch {
        // No cached fix available — fine, the live fix below still runs.
      }

      try {
        const position = await getCurrentPositionWithTimeout({ accuracy: Location.Accuracy.Balanced });
        if (!cancelled) {
          setUserCoords({ latitude: position.coords.latitude, longitude: position.coords.longitude });
          setAccuracyMeters(position.coords.accuracy ?? null);
        }
      } catch (error) {
        if (!cancelled) {
          setLocationError(
            error instanceof Error && error.message === "timeout"
              ? "Getting your location is taking too long. Move somewhere with a clearer view of the sky and try again."
              : "Couldn't determine your location.",
          );
        }
      }

      // The two fixes above only ever run once, on mount — previously that
      // was the whole story, so the "You" marker silently froze at wherever
      // the employee was the moment they opened this screen. Anyone who
      // kept it open while actually moving (the common case — this screen
      // exists specifically to show *live* location) would see a
      // increasingly wrong dot, while a real map app right next to it kept
      // tracking correctly. This watch keeps the marker live for as long as
      // the screen stays open.
      try {
        const sub = await Location.watchPositionAsync(
          { accuracy: Location.Accuracy.High, timeInterval: FOREGROUND_REFRESH_MS, distanceInterval: 5 },
          (position) => {
            if (cancelled) return;
            if (position.coords.accuracy != null && position.coords.accuracy > MIN_ACCURACY_METERS) {
              // Not accurate enough to trust — leave the dot where it is
              // rather than let a noisy fix yank it somewhere wrong.
              return;
            }
            const next = { latitude: position.coords.latitude, longitude: position.coords.longitude };
            setUserCoords((prev) => (prev ? blendTowards(prev, next, SMOOTHING_FACTOR) : next));
            // The reported accuracy of the raw fix, not of the blended
            // point above (blending only smooths the displayed position,
            // it doesn't change how much to trust it) — still the more
            // honest number to show the employee.
            setAccuracyMeters(position.coords.accuracy ?? null);
            setLocationError(null);
          },
        );
        // The screen could have unmounted while the await above was still
        // resolving — the cleanup below would already have run (with
        // `subscription` still null at that point) and won't fire again, so
        // without this check `sub` would start firing forever with nothing
        // left to ever call .remove() on it.
        if (cancelled) {
          sub.remove();
        } else {
          subscription = sub;
        }
      } catch {
        // Non-fatal — the one-time fixes above still show something, just
        // without the live refresh.
      }
    })();
    return () => {
      cancelled = true;
      subscription?.remove();
    };
  }, []);

  const route = fieldSummaryQuery.data?.active ? fieldSummaryQuery.data.route : [];
  const visits = fieldSummaryQuery.data?.active ? fieldSummaryQuery.data.visits : [];

  // The place the geofence circle belongs to (marker popup + "24 m from office").
  const targetIsHome = isHybrid
    ? hybridPlace === "HOME" || (!hybridPlace && !hybridTargets.office)
    : !isWfhOfficeDay && user?.workMode === "WFH";
  const targetWord = targetIsHome ? "Home" : "Office";

  const mapHtml = useMemo(
    () =>
      buildMapHtml(
        userCoords,
        isFieldDay ? null : target,
        isFieldDay ? route : [],
        isFieldDay ? visits : [],
        targetWord,
        !reducedMotion,
      ),
    [userCoords, target, isFieldDay, route, visits, targetWord, reducedMotion],
  );

  // Non-blocking save: the position is already live on this screen, so the
  // visit is queued and the form closes immediately; the photo upload happens
  // in the background and shows "Saving…" in the list below.
  const handleSaveVisit = () => {
    if (!visitPhotoDataUrl || !userCoords) return;
    const invalid = validateVisitForm(visitForm);
    if (invalid) {
      setVisitFormError(invalid);
      return;
    }
    queue.submit({
      ...visitFormToPayload(visitForm),
      photo: visitPhotoDataUrl,
      latitude: userCoords.latitude,
      longitude: userCoords.longitude,
    });
    setVisitForm(EMPTY_VISIT_FORM);
    setVisitFormError(null);
    setVisitPhotoDataUrl(null);
    setAddingVisit(false);
  };

  if (visitCameraOpen) {
    return (
      <PhotoCaptureView
        facing="back"
        onCapture={(base64) => {
          setVisitPhotoDataUrl(`data:image/jpeg;base64,${base64}`);
          setVisitCameraOpen(false);
        }}
        onCancel={() => setVisitCameraOpen(false)}
      />
    );
  }

  const locationLabel = isFieldDay
    ? "Field day"
    : isHybrid
      ? hybridSegment?.mode === "TRANSIT"
        ? hybridPlace === "HOME"
          ? "Heading home"
          : "Heading to the office"
        : hybridPlace === "HOME" || (!hybridPlace && !hybridTargets.office)
          ? "Home location"
          : "Office"
    : isWfhOfficeDay
      ? "Office (WFH)"
      : user?.workMode === "WFH"
        ? "Home location"
        : user?.workMode === "FIELD"
          ? "No fixed location"
          : "Office";

  const subtitle = isFieldDay
    ? fieldSummaryQuery.data?.active
      ? `${formatDistance(fieldSummaryQuery.data.distanceMeters)} covered today`
      : "Loading today's route…"
    : (locationError ?? (target ? `Geofence ${Math.round(target.radiusMeters)} m` : "No geofence configured"));

  const tier = accuracyMeters != null ? accuracyTier(accuracyMeters) : null;
  const distanceToTarget =
    !isFieldDay && userCoords && target
      ? haversineDistanceMeters(userCoords.latitude, userCoords.longitude, target.latitude, target.longitude)
      : null;
  // Room under the white sheet: the floating tab bar inside the tabs, the home indicator in the modal.
  const sheetBottom = tabClearance ? tabClearance + 6 : insets.bottom + spacing.md;

  return (
    <View style={styles.container}>
      <View style={[styles.mapArea, isFieldDay && styles.mapAreaSplit]}>
        <WebView
          style={StyleSheet.absoluteFillObject}
          originWhitelist={["*"]}
          source={{ html: mapHtml }}
          javaScriptEnabled
          domStorageEnabled
        />

        {!userCoords && !locationError && (
          <View style={styles.loadingPill} pointerEvents="none">
            <ActivityIndicator color={colors.primary} size="small" />
            <Text style={styles.loadingPillLabel}>Getting your location…</Text>
          </View>
        )}

        <Rise style={[styles.header, { top: insets.top + spacing.sm }]}>
          <View style={styles.headerRow}>
            <View style={styles.chipRow}>
              <MapChip>
                <View style={[styles.chipDot, { backgroundColor: isTracking ? colors.liveDot : colors.textMuted }]} />
                <Text style={[styles.chipText, { color: isTracking ? colors.success : colors.textSecondary }]}>
                  {isTracking ? "Sharing live" : "Not sharing"}
                </Text>
              </MapChip>
              {tier && accuracyMeters != null ? (
                <MapChip accessibilityLabel={`${tier.label}, plus or minus ${Math.round(accuracyMeters)} metres`}>
                  <View style={[styles.chipDot, { backgroundColor: tier.color }]} />
                  <Text style={styles.chipText}>{`GPS · ±${Math.round(accuracyMeters)} m`}</Text>
                </MapChip>
              ) : null}
            </View>
            <Pressable
              onPress={() => navigation.goBack()}
              accessibilityRole="button"
              accessibilityLabel="Close map"
              style={({ pressed }) => [styles.closeButton, pressed && { opacity: 0.7 }]}
            >
              <Icon name="close" size={18} color={colors.ink} strokeWidth={2} />
            </Pressable>
          </View>
          <MapChip>
            <Text style={[styles.chipText, styles.chipStrong]}>{locationLabel}</Text>
            <Text style={[styles.chipText, styles.chipMuted, locationError ? { color: colors.danger } : null]} numberOfLines={1}>
              {subtitle}
            </Text>
          </MapChip>
          {tier && tier === ACCURACY_TIERS.low ? (
            <MapChip>
              <Text style={[styles.chipText, { color: colors.warning }]}>{tier.label} — the dot may be off</Text>
            </MapChip>
          ) : null}
        </Rise>
      </View>

      {!isFieldDay && (
        <Rise delay={200} style={[styles.sheet, { paddingBottom: sheetBottom }]}>
          <View style={styles.handle} />
          <View style={styles.sheetHeader}>
            <View style={styles.flex1}>
              <View style={styles.sheetTitleRow}>
                <LiveDot live={isTracking} />
                <Text style={styles.sheetTitle}>{isTracking ? "Sharing live" : "Not sharing"}</Text>
              </View>
              <Text style={styles.sheetSub}>
                {isTracking ? "every 2 min · only while checked in" : "Turns on when you check in"}
              </Text>
            </View>
            {distanceToTarget != null ? (
              <Text style={styles.distancePill}>
                {`${formatDistance(distanceToTarget)} from ${targetWord.toLowerCase()}`}
              </Text>
            ) : null}
          </View>
          <GrowBars values={pings} />
        </Rise>
      )}

      {isFieldDay && (
        <View style={styles.fieldSheet}>
          <View style={styles.handle} />
          <ScrollView
            style={styles.flex1}
            contentContainerStyle={[styles.fieldPanelContent, { paddingBottom: spacing.xxl + tabClearance }]}
            showsVerticalScrollIndicator={false}
          >
            <Rise delay={150} style={styles.liveRow}>
              <Kicker>Live location</Kicker>
              <View style={styles.sheetTitleRow}>
                <LiveDot live={isTracking} />
                <Text style={styles.sheetTitle}>{isTracking ? "Sharing with your admin" : "Sharing is off"}</Text>
              </View>
              <Text style={styles.sheetSub}>Only ever on while checked in</Text>
            </Rise>
            <Rise delay={230}>
              <StatRow>
                <StatBox
                  tone="muted"
                  label="Distance"
                  value={fieldSummaryQuery.data?.active ? formatDistance(fieldSummaryQuery.data.distanceMeters) : "—"}
                />
                <StatBox tone="muted" label="Stops" value={String(visits.length)} />
                <StatBox
                  tone="muted"
                  label="Since"
                  value={
                    route.length
                      ? new Date(route[0].timestamp).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })
                      : "—"
                  }
                />
              </StatRow>
            </Rise>

            <Rise delay={310}>
              <Text style={styles.logTitle}>Logged locations</Text>
              <Card style={styles.visitCard}>
                {queue.pending.map((p, i) => (
                  <View key={p.key} style={[styles.visitRow, i > 0 && styles.visitRowDivider]}>
                    {p.status === "saving" ? (
                      <View style={[styles.visitThumb, styles.pendingThumb]}>
                        <ActivityIndicator color={colors.primary} />
                      </View>
                    ) : (
                      <IconTile glyph="!" tone="danger" size={44} radius={14} />
                    )}
                    <View style={styles.visitInfo}>
                      <Text style={styles.visitName}>{p.name}</Text>
                      <Text style={[styles.visitTime, p.status === "failed" && { color: colors.danger }]}>
                        {p.status === "saving" ? "Saving…" : p.error ?? "Couldn't save"}
                      </Text>
                      {p.status === "failed" ? (
                        <View style={styles.pendingRow}>
                          <Pressable onPress={() => queue.retry(p.key)} hitSlop={8}>
                            <Text style={styles.pendingRetry}>Retry</Text>
                          </Pressable>
                          <Pressable onPress={() => queue.remove(p.key)} hitSlop={8}>
                            <Text style={styles.visitTime}>Remove</Text>
                          </Pressable>
                        </View>
                      ) : null}
                    </View>
                  </View>
                ))}

                {visits.length === 0 && queue.pending.length === 0 ? (
                  <Text style={styles.emptyVisits}>Nothing logged yet — add the places you visit as you go.</Text>
                ) : (
                  visits.map((visit, i) => (
                    <View key={visit.id} style={[styles.visitRow, (i > 0 || queue.pending.length > 0) && styles.visitRowDivider]}>
                      <Image
                        source={{
                          uri: `${env.apiUrl}${endpoints.fieldVisitPhoto(visit.id)}`,
                          headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : undefined,
                        }}
                        style={styles.visitThumb}
                      />
                      <View style={styles.visitInfo}>
                        <Text style={styles.visitName}>{visit.name}</Text>
                        {visit.description ? <Text style={styles.visitTime}>{visit.description}</Text> : null}
                        {visit.contactName || visit.contactPhone ? (
                          <Text style={styles.visitTime}>{[visit.contactName, visit.contactPhone].filter(Boolean).join(" · ")}</Text>
                        ) : null}
                        <Text style={styles.visitTime}>Reached {formatVisitTime(visit.reachedAt)}</Text>
                      </View>
                    </View>
                  ))
                )}
              </Card>
            </Rise>

            {addingVisit ? (
              <Card style={styles.addVisitCard}>
                <VisitFormFields values={visitForm} onChange={setVisitForm} />
                <Pressable
                  onPress={() => setVisitCameraOpen(true)}
                  style={[styles.photoTile, visitPhotoDataUrl && styles.photoTileReady]}
                >
                  {visitPhotoDataUrl ? (
                    <Image source={{ uri: visitPhotoDataUrl }} style={styles.photoTileImage} />
                  ) : (
                    <Icon name="camera" size={22} color={colors.accentText} />
                  )}
                  <Text style={styles.photoTileLabel}>{visitPhotoDataUrl ? "PHOTO READY" : "SITE PHOTO"}</Text>
                </Pressable>

                {!userCoords ? (
                  <Text style={styles.meta}>Waiting for your location before this can be saved…</Text>
                ) : null}
                {visitFormError ? <Text style={styles.errorText}>{visitFormError}</Text> : null}

                <View style={styles.addVisitButtonRow}>
                  <Button
                    label="Cancel"
                    variant="secondary"
                    onPress={() => {
                      setAddingVisit(false);
                      setVisitForm(EMPTY_VISIT_FORM);
                      setVisitFormError(null);
                      setVisitPhotoDataUrl(null);
                    }}
                    style={styles.addVisitButtonHalf}
                  />
                  <Button
                    label="Save location"
                    onPress={handleSaveVisit}
                    disabled={!visitForm.name.trim() || !visitPhotoDataUrl || !userCoords}
                    style={styles.addVisitButtonHalf}
                  />
                </View>
              </Card>
            ) : (
              <Rise delay={390}>
                <Button label="Add a location" icon="plus" onPress={() => setAddingVisit(true)} />
              </Rise>
            )}
          </ScrollView>
        </View>
      )}
    </View>
  );
}

/** White map chip (Map.dc.html `.chip`): 94% white, 1px border, pill. */
function MapChip({ children, accessibilityLabel }: { children: ReactNode; accessibilityLabel?: string }) {
  return (
    <View style={styles.chip} accessibilityLabel={accessibilityLabel} accessible={!!accessibilityLabel}>
      {children}
    </View>
  );
}

/** Green status dot that pulses while sharing; grey and still when not. */
function LiveDot({ live }: { live: boolean }) {
  return (
    <View style={styles.liveDotBox}>
      <PulseRing size={9} color={colors.liveDot} enabled={live} duration={2000} />
      <View style={[styles.liveDot, { backgroundColor: live ? colors.liveDot : colors.textMuted }]} />
    </View>
  );
}

const BAR_AREA = 44;

/** The ping bars: orange gradient columns that grow up from the baseline on mount (mockup `grow`, staggered). */
function GrowBars({ values }: { values: number[] }) {
  return (
    <View style={styles.bars}>
      {values.map((v, i) => (
        <GrowBar key={i} index={i} percent={Math.max(8, Math.min(100, v))} />
      ))}
    </View>
  );
}

function GrowBar({ index, percent }: { index: number; percent: number }) {
  const reduced = useReducedMotion();
  const t = useRef(new Animated.Value(reduced ? 1 : 0)).current;
  useEffect(() => {
    if (reduced) {
      t.setValue(1);
      return;
    }
    const anim = Animated.timing(t, {
      toValue: 1,
      duration: 700,
      delay: 400 + index * 50,
      useNativeDriver: true,
    });
    anim.start();
    return () => anim.stop();
    // Entrance only.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reduced]);
  return (
    <Animated.View
      style={[
        styles.bar,
        { height: (BAR_AREA * percent) / 100, transformOrigin: "bottom", transform: [{ scaleY: t }] },
      ]}
    >
      <LinearGradient colors={gradients.orangeVertical} {...gradientDirection.vertical} style={StyleSheet.absoluteFill} />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#E9E4DC" },
  mapArea: { flex: 1, position: "relative" },
  mapAreaSplit: { flex: 0.44 },
  flex1: { flex: 1 },
  loadingPill: {
    position: "absolute",
    top: "45%",
    alignSelf: "center",
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs + 2,
    backgroundColor: "rgba(255,255,255,0.94)",
    borderWidth: 1,
    borderColor: colors.inputBorder,
    borderRadius: 99,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  loadingPillLabel: { fontFamily: fontFamilies.medium, fontWeight: "500", fontSize: 12, color: colors.ink },

  // Top chrome over the map.
  header: { position: "absolute", left: 16, right: 16, gap: 8 },
  headerRow: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: 8 },
  chipRow: { flex: 1, flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: {
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    maxWidth: "100%",
    backgroundColor: "rgba(255,255,255,0.94)",
    borderWidth: 1,
    borderColor: colors.inputBorder,
    borderRadius: 99,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  chipDot: { width: 7, height: 7, borderRadius: 4 },
  chipText: { fontFamily: fontFamilies.medium, fontWeight: "500", fontSize: 12, color: colors.ink },
  chipStrong: { fontFamily: fontFamilies.semiBold, fontWeight: "600" },
  chipMuted: { color: colors.textSecondary, flexShrink: 1 },
  closeButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(255,255,255,0.94)",
    borderWidth: 1,
    borderColor: colors.inputBorder,
    alignItems: "center",
    justifyContent: "center",
  },

  // White bottom sheet (non-field days) over the map.
  sheet: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: colors.surface,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    borderTopWidth: 1,
    borderColor: colors.cardBorder,
    paddingHorizontal: spacing.gutter,
    paddingTop: 14,
    gap: 12,
  },
  handle: { width: 40, height: 4, borderRadius: 2, backgroundColor: "rgba(23,19,15,0.2)", alignSelf: "center" },
  sheetHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 },
  sheetTitleRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  sheetTitle: { fontFamily: fontFamilies.display700, fontWeight: "700", fontSize: 20, color: colors.ink, flexShrink: 1 },
  sheetSub: { fontSize: 13, color: colors.textSecondary, marginTop: 2 },
  liveDotBox: { width: 9, height: 9 },
  liveDot: { width: 9, height: 9, borderRadius: 5 },
  distancePill: {
    fontFamily: fontFamilies.semiBold,
    fontWeight: "600",
    fontSize: 12,
    color: colors.accentText,
    backgroundColor: "rgba(239,108,0,0.15)",
    borderRadius: 99,
    overflow: "hidden",
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  bars: { flexDirection: "row", alignItems: "flex-end", gap: 6, height: BAR_AREA },
  bar: { flex: 1, borderRadius: 4, overflow: "hidden" },

  // Field day: white sheet under the (shorter) map.
  fieldSheet: {
    flex: 0.56,
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderColor: colors.cardBorder,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    marginTop: -28,
    paddingTop: 14,
  },
  fieldPanelContent: { paddingHorizontal: spacing.gutter, paddingTop: 12, gap: 12 },
  liveRow: { gap: 4 },
  logTitle: { ...typography.section, color: colors.ink, marginBottom: 8 },
  visitCard: { paddingVertical: 4 },
  emptyVisits: { ...typography.body, fontSize: 14, color: colors.textSecondary, marginVertical: spacing.sm },
  visitRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm + 4,
    paddingVertical: spacing.sm + 2,
  },
  visitRowDivider: { borderTopWidth: 1, borderTopColor: colors.hairlineSoft },
  visitThumb: { width: 44, height: 44, borderRadius: 14, backgroundColor: colors.surfaceMuted },
  visitInfo: { flex: 1 },
  pendingThumb: { alignItems: "center", justifyContent: "center", backgroundColor: colors.primaryMuted },
  pendingRow: { flexDirection: "row", gap: spacing.md, marginTop: 2 },
  pendingRetry: { ...typography.link, fontFamily: fontFamilies.semiBold, fontWeight: "600", color: colors.accentText },
  visitName: { fontFamily: fontFamilies.semiBold, fontWeight: "600", fontSize: 14, color: colors.ink },
  visitTime: { fontSize: 12, color: colors.textSecondary, marginTop: 2 },

  addVisitCard: { gap: spacing.sm },
  addVisitButtonRow: { flexDirection: "row", gap: spacing.sm, marginTop: spacing.xs },
  addVisitButtonHalf: { flex: 1 },
  meta: { ...typography.body, fontSize: 14, color: colors.textSecondary, marginTop: spacing.xs },
  errorText: { ...typography.caption, color: colors.danger },
  photoTile: {
    alignSelf: "flex-start",
    width: 96,
    borderWidth: 1.5,
    borderStyle: "dashed",
    borderColor: "rgba(239,108,0,0.35)",
    borderRadius: 18,
    backgroundColor: colors.surfaceMuted,
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.xs,
    paddingVertical: spacing.sm + 2,
    overflow: "hidden",
  },
  photoTileReady: { borderStyle: "solid", borderColor: colors.success },
  photoTileImage: { width: 56, height: 56, borderRadius: 99 },
  photoTileLabel: { fontSize: 10, letterSpacing: 0.8, fontFamily: fontFamilies.semiBold, fontWeight: "600", color: colors.textSecondary, textAlign: "center" },
});
