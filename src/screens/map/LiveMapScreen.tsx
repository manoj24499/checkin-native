import { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Image, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useNavigation } from "@react-navigation/native";
import { WebView } from "react-native-webview";
import * as Location from "expo-location";
import { BarSpark } from "@/components/dashboard/BarSpark";
import { Card, Button, Icon, IconButton, IconTile, Kicker } from "@/components/ui";
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
  useFieldSummary,
  useQueuedFieldVisit,
} from "@/hooks";
import type { GeofenceTarget } from "@/hooks/useGeofence";
import type { FieldVisit } from "@/types";
import { useAttendanceSessionStore } from "@/store/attendanceSessionStore";
import { useAuthStore } from "@/store/authStore";
import { getCurrentPositionWithTimeout, formatDistance } from "@/utils/geo";
import { getErrorMessage } from "@/utils/errors";
import { endpoints } from "@/api/endpoints";
import { env } from "@/config/env";
import { colors, radius, spacing, typography } from "@/theme";

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
  // Bright variants: these sit on the dark (ink) header panel, where the
  // theme's success/warning/danger text colours are too dark to read.
  high: { maxMeters: 15, label: "High accuracy", color: "#4ADE80" },
  medium: { maxMeters: MIN_ACCURACY_METERS, label: "Medium accuracy", color: "#FBBF24" },
  low: { maxMeters: Infinity, label: "Low accuracy", color: "#F87171" },
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
): string {
  const center = userCoords ?? target ?? route[0] ?? { latitude: 20.5937, longitude: 78.9629 };
  const zoom = userCoords || target || route.length ? 16 : 4;

  const userMarker = userCoords
    ? `L.circleMarker([${userCoords.latitude}, ${userCoords.longitude}], {
        radius: 8, color: "#FFFFFF", fillColor: "${colors.lime}", fillOpacity: 1, weight: 3
      }).addTo(map).bindPopup("You");`
    : "";

  const targetMarkers = target
    ? `L.marker([${target.latitude}, ${target.longitude}]).addTo(map).bindPopup("Office / Home");
      L.circle([${target.latitude}, ${target.longitude}], {
        radius: ${target.radiusMeters}, color: "#4ADE80", fillColor: "#4ADE80", fillOpacity: 0.1, weight: 1.5, dashArray: "4 4"
      }).addTo(map);`
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
    html, body, #map { height: 100%; margin: 0; padding: 0; background: ${colors.panelDarker}; }
    .leaflet-control-attribution { font-size: 9px; }
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
  const target = useResolvedGeofenceTarget(isWfhOfficeDay ? "OFFICE" : undefined);
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

  const mapHtml = useMemo(
    () => buildMapHtml(userCoords, isFieldDay ? null : target, isFieldDay ? route : [], isFieldDay ? visits : []),
    [userCoords, target, isFieldDay, route, visits],
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
            <ActivityIndicator color={colors.lime} size="small" />
            <Text style={styles.loadingPillLabel}>Getting your location…</Text>
          </View>
        )}

        <View style={styles.header}>
          <View style={styles.headerText}>
            <Kicker color={colors.textOnDarkMuted}>{isFieldDay ? "FIELD DAY" : "LIVE LOCATION"}</Kicker>
            <Text style={styles.title}>{locationLabel}</Text>
            <Text style={styles.subtitle}>{subtitle}</Text>
            {accuracyMeters != null &&
              (() => {
                const tier = accuracyTier(accuracyMeters);
                return (
                  <View style={styles.accuracyRow}>
                    <View style={[styles.accuracyDot, { backgroundColor: tier.color }]} />
                    <Text style={[styles.accuracyText, { color: tier.color }]}>{tier.label}</Text>
                  </View>
                );
              })()}
          </View>
          <IconButton icon="close" variant="dark" onPress={() => navigation.goBack()} accessibilityLabel="Close map" />
        </View>

        {!isFieldDay && (
          <View style={styles.pingPanel}>
            <View style={styles.pingPanelHeader}>
              <Text style={[styles.pingPanelLabel, isTracking && styles.pingPanelLabelLive]}>
                {isTracking ? "Sharing live" : "Not sharing"}
              </Text>
              <Text style={styles.pingPanelInterval}>every 2 min</Text>
            </View>
            <BarSpark values={pings} color={colors.lime} height={44} />
          </View>
        )}
      </View>

      {isFieldDay && (
        <ScrollView style={styles.fieldPanel} contentContainerStyle={styles.fieldPanelContent}>
          <Kicker>Logged locations</Kicker>

          {queue.pending.map((p, i) => (
            <View key={p.key} style={[styles.visitRow, i > 0 && styles.visitRowDivider]}>
              {p.status === "saving" ? (
                <View style={[styles.visitThumb, styles.pendingThumb]}>
                  <ActivityIndicator color={colors.lime} />
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
                  <Icon name="camera" size={22} color={colors.ink} />
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
            <Button label="Add a location" icon="plus" variant="secondary" onPress={() => setAddingVisit(true)} />
          )}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.panelDarker },
  mapArea: { flex: 1, position: "relative" },
  mapAreaSplit: { flex: 0.44 },
  loadingPill: {
    position: "absolute",
    top: "45%",
    alignSelf: "center",
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs + 2,
    backgroundColor: "rgba(14,36,16,0.9)",
    borderRadius: 99,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs + 3,
  },
  loadingPillLabel: { ...typography.caption, color: colors.textOnDark },
  header: {
    position: "absolute",
    top: 64,
    left: 14,
    right: 14,
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: spacing.sm,
  },
  // Sits directly on top of the raw map tiles with nothing else behind it —
  // without its own background, light-colored text here is only readable
  // by coincidence, wherever the map tile underneath happens to be dark.
  // Same near-opaque ink scrim `pingPanel` below uses, so text stays
  // legible over any tile color (roads, buildings, green space, ...).
  headerText: {
    flexShrink: 1,
    maxWidth: "80%",
    backgroundColor: "rgba(14,36,16,0.9)",
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: spacing.sm + 4,
  },
  title: { ...typography.section, color: colors.textOnDark },
  subtitle: { ...typography.caption, fontSize: 12, color: colors.textOnDarkMuted, marginTop: 2 },
  accuracyRow: { flexDirection: "row", alignItems: "center", gap: 5, marginTop: 6 },
  accuracyDot: { width: 6, height: 6, borderRadius: 99 },
  accuracyText: { fontSize: 11, fontWeight: "600", fontFamily: "Inter_600SemiBold" },
  pingPanel: {
    position: "absolute",
    left: 14,
    right: 14,
    bottom: 20,
    backgroundColor: "rgba(14,36,16,0.94)",
    borderRadius: 22,
    padding: 14,
  },
  pingPanelHeader: {
    flexDirection: "row",
    alignItems: "baseline",
    justifyContent: "space-between",
    marginBottom: spacing.sm + 2,
  },
  pingPanelLabel: { ...typography.bodyStrong, fontSize: 14, color: colors.textOnDarkMuted },
  pingPanelLabelLive: { color: colors.lime },
  pingPanelInterval: { ...typography.caption, fontSize: 12, color: colors.textOnDarkMuted },

  // White sheet rising over the bottom of the map (rounded top corners).
  fieldPanel: {
    flex: 0.56,
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius.sheet,
    borderTopRightRadius: radius.sheet,
    marginTop: -24,
  },
  fieldPanelContent: { padding: spacing.md, paddingTop: spacing.md + 4, paddingBottom: spacing.xxl, gap: spacing.xs },
  emptyVisits: { ...typography.body, fontSize: 14, color: colors.textSecondary, marginVertical: spacing.xs },
  visitRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm + 4,
    paddingVertical: spacing.sm + 2,
  },
  visitRowDivider: { borderTopWidth: 1, borderTopColor: colors.border },
  visitThumb: { width: 44, height: 44, borderRadius: 14, backgroundColor: colors.surfaceMuted },
  visitInfo: { flex: 1 },
  pendingThumb: { alignItems: "center", justifyContent: "center", backgroundColor: colors.ink },
  pendingRow: { flexDirection: "row", gap: spacing.md, marginTop: 2 },
  pendingRetry: { ...typography.bodyStrong, fontSize: 12.5, color: colors.primaryDark },
  visitName: { ...typography.bodyStrong, fontSize: 14, color: colors.ink },
  visitTime: { ...typography.caption, fontSize: 12, color: colors.textSecondary, marginTop: 2 },

  addVisitCard: { gap: spacing.sm, marginTop: spacing.sm },
  addVisitButtonRow: { flexDirection: "row", gap: spacing.sm, marginTop: spacing.xs },
  addVisitButtonHalf: { flex: 1 },
  meta: { ...typography.body, fontSize: 14, color: colors.textSecondary, marginTop: spacing.xs },
  errorText: { ...typography.caption, color: colors.danger },
  photoTile: {
    alignSelf: "flex-start",
    width: 96,
    borderWidth: 1.5,
    borderStyle: "dashed",
    borderColor: "rgba(14,36,16,0.3)",
    borderRadius: 16,
    backgroundColor: colors.surfaceMuted,
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.xs,
    paddingVertical: spacing.sm + 2,
    overflow: "hidden",
  },
  photoTileReady: { borderStyle: "solid", borderColor: colors.success },
  photoTileImage: { width: 56, height: 56, borderRadius: 99 },
  photoTileLabel: { fontSize: 9.5, letterSpacing: 0.5, color: colors.textSecondary, textAlign: "center" },
});
