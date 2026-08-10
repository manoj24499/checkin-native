import { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Image, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useNavigation } from "@react-navigation/native";
import { WebView } from "react-native-webview";
import * as Location from "expo-location";
import { BarSpark } from "@/components/dashboard/BarSpark";
import { Card, Button, TextField } from "@/components/ui";
import { PhotoCaptureView } from "@/components/camera";
import {
  useActivityPattern,
  useAuth,
  useAttendanceStatus,
  useResolvedGeofenceTarget,
  useFieldSummary,
  useLogFieldVisit,
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
        radius: 8, color: "#F06400", fillColor: "#F06400", fillOpacity: 1, weight: 2
      }).addTo(map).bindPopup("You");`
    : "";

  const targetMarkers = target
    ? `L.marker([${target.latitude}, ${target.longitude}]).addTo(map).bindPopup("Office / Home");
      L.circle([${target.latitude}, ${target.longitude}], {
        radius: ${target.radiusMeters}, color: "#2E6F52", fillColor: "#2E6F52", fillOpacity: 0.08, weight: 1
      }).addTo(map);`
    : "";

  const routeLine =
    route.length > 1
      ? `L.polyline(${JSON.stringify(route.map((p) => [p.latitude, p.longitude]))}, {
          color: "#F06400", weight: 3, opacity: 0.65
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
  const target = useResolvedGeofenceTarget();
  const pings = useActivityPattern(isTracking);

  const isFieldDay =
    user?.workMode === "FIELD" && statusQuery.data?.exists === true && statusQuery.data.checkInMode === "FIELD";
  const fieldSummaryQuery = useFieldSummary(isFieldDay);
  const logVisit = useLogFieldVisit();

  const [userCoords, setUserCoords] = useState<Coords | null>(null);
  const [locationError, setLocationError] = useState<string | null>(null);

  const [addingVisit, setAddingVisit] = useState(false);
  const [visitName, setVisitName] = useState("");
  const [visitPhotoDataUrl, setVisitPhotoDataUrl] = useState<string | null>(null);
  const [visitCameraOpen, setVisitCameraOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;
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
        }
      } catch {
        // No cached fix available — fine, the live fix below still runs.
      }

      try {
        const position = await getCurrentPositionWithTimeout({ accuracy: Location.Accuracy.Balanced });
        if (!cancelled) {
          setUserCoords({ latitude: position.coords.latitude, longitude: position.coords.longitude });
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
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const route = fieldSummaryQuery.data?.active ? fieldSummaryQuery.data.route : [];
  const visits = fieldSummaryQuery.data?.active ? fieldSummaryQuery.data.visits : [];

  const mapHtml = useMemo(
    () => buildMapHtml(userCoords, isFieldDay ? null : target, isFieldDay ? route : [], isFieldDay ? visits : []),
    [userCoords, target, isFieldDay, route, visits],
  );

  const handleSaveVisit = async () => {
    if (!visitPhotoDataUrl || !userCoords) return;
    try {
      await logVisit.mutateAsync({
        name: visitName.trim(),
        photo: visitPhotoDataUrl,
        latitude: userCoords.latitude,
        longitude: userCoords.longitude,
      });
      setVisitName("");
      setVisitPhotoDataUrl(null);
      setAddingVisit(false);
    } catch {
      // Surfaced below via logVisit.error.
    }
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
            <ActivityIndicator color={colors.primary} size="small" />
            <Text style={styles.loadingPillLabel}>Getting your location…</Text>
          </View>
        )}

        <View style={styles.header}>
          <View style={styles.headerText}>
            <Text style={styles.kicker}>{isFieldDay ? "FIELD DAY" : "LIVE LOCATION"}</Text>
            <Text style={styles.title}>{locationLabel}</Text>
            <Text style={styles.subtitle}>{subtitle}</Text>
          </View>
          <Pressable onPress={() => navigation.goBack()} style={styles.closeButton}>
            <Text style={styles.closeGlyph}>✕</Text>
          </Pressable>
        </View>

        {!isFieldDay && (
          <View style={styles.pingPanel}>
            <View style={styles.pingPanelHeader}>
              <Text style={styles.pingPanelLabel}>{isTracking ? "SHARING LIVE" : "NOT SHARING"}</Text>
              <Text style={styles.pingPanelInterval}>every 2 min</Text>
            </View>
            <BarSpark values={pings} color={colors.primary} height={44} />
          </View>
        )}
      </View>

      {isFieldDay && (
        <ScrollView style={styles.fieldPanel} contentContainerStyle={styles.fieldPanelContent}>
          <Text style={styles.sectionLabel}>LOGGED LOCATIONS</Text>

          {visits.length === 0 ? (
            <Text style={styles.emptyVisits}>Nothing logged yet — add the places you visit as you go.</Text>
          ) : (
            visits.map((visit) => (
              <View key={visit.id} style={styles.visitRow}>
                <Image
                  source={{
                    uri: `${env.apiUrl}${endpoints.fieldVisitPhoto(visit.id)}`,
                    headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : undefined,
                  }}
                  style={styles.visitThumb}
                />
                <View style={styles.visitInfo}>
                  <Text style={styles.visitName}>{visit.name}</Text>
                  <Text style={styles.visitTime}>Reached {formatVisitTime(visit.reachedAt)}</Text>
                </View>
              </View>
            ))
          )}

          {addingVisit ? (
            <Card style={styles.addVisitCard}>
              <Text style={styles.cardLabel}>LOCATION NAME</Text>
              <TextField
                placeholder="e.g. Springfield High School"
                value={visitName}
                onChangeText={setVisitName}
              />
              <Pressable
                onPress={() => setVisitCameraOpen(true)}
                style={[styles.photoTile, visitPhotoDataUrl && styles.photoTileReady]}
              >
                {visitPhotoDataUrl ? (
                  <Image source={{ uri: visitPhotoDataUrl }} style={styles.photoTileImage} />
                ) : (
                  <Text style={styles.photoGlyph}>⌾</Text>
                )}
                <Text style={styles.photoTileLabel}>{visitPhotoDataUrl ? "PHOTO READY" : "SITE PHOTO"}</Text>
              </Pressable>

              {!userCoords ? (
                <Text style={styles.meta}>Waiting for your location before this can be saved…</Text>
              ) : null}
              {logVisit.isError ? (
                <Text style={styles.errorText}>{getErrorMessage(logVisit.error)}</Text>
              ) : null}

              <View style={styles.addVisitButtonRow}>
                <Button
                  label="Cancel"
                  variant="secondary"
                  onPress={() => {
                    setAddingVisit(false);
                    setVisitName("");
                    setVisitPhotoDataUrl(null);
                  }}
                  style={styles.addVisitButtonHalf}
                />
                <Button
                  label={logVisit.isPending ? "Saving…" : "Save location"}
                  onPress={handleSaveVisit}
                  loading={logVisit.isPending}
                  disabled={!visitName.trim() || !visitPhotoDataUrl || !userCoords}
                  style={styles.addVisitButtonHalf}
                />
              </View>
            </Card>
          ) : (
            <Pressable onPress={() => setAddingVisit(true)} style={styles.addVisitTrigger}>
              <Text style={styles.addVisitTriggerLabel}>+ Add a location</Text>
            </Pressable>
          )}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.panelDarker },
  mapArea: { flex: 1, position: "relative" },
  mapAreaSplit: { flex: 0.42 },
  loadingPill: {
    position: "absolute",
    top: "45%",
    alignSelf: "center",
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    backgroundColor: "rgba(26,21,18,0.72)",
    borderWidth: 1,
    borderColor: "rgba(247,243,239,0.16)",
    borderRadius: 99,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs + 2,
  },
  loadingPillLabel: { ...typography.caption, color: colors.textOnDarkMuted },
  header: {
    position: "absolute",
    top: 64,
    left: 16,
    right: 16,
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
  },
  headerText: { flex: 1 },
  kicker: { ...typography.label, letterSpacing: 2, color: colors.primarySoftText },
  title: { ...typography.h2, color: colors.textOnDark, marginTop: spacing.xs },
  subtitle: { ...typography.body, color: colors.textOnDarkMuted, marginTop: 4 },
  closeButton: {
    width: 34,
    height: 34,
    borderRadius: 99,
    borderWidth: 1,
    borderColor: "rgba(247,243,239,0.28)",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.panelDarker,
  },
  closeGlyph: { color: colors.textOnDarkMuted, fontSize: 15 },
  pingPanel: {
    position: "absolute",
    left: 16,
    right: 16,
    bottom: 40,
    backgroundColor: "rgba(26,21,18,0.62)",
    borderWidth: 1,
    borderColor: "rgba(247,243,239,0.12)",
    borderRadius: 18,
    padding: spacing.md,
  },
  pingPanelHeader: {
    flexDirection: "row",
    alignItems: "baseline",
    justifyContent: "space-between",
    marginBottom: spacing.sm,
  },
  pingPanelLabel: { ...typography.label, letterSpacing: 2, color: colors.textOnDarkMuted },
  pingPanelInterval: { ...typography.caption, color: colors.primarySoftText },

  fieldPanel: { flex: 0.58, backgroundColor: colors.background },
  fieldPanelContent: { padding: spacing.md, paddingBottom: spacing.xxl, gap: spacing.sm },
  sectionLabel: { fontSize: 9, letterSpacing: 1.5, color: colors.textMuted, fontWeight: "600" },
  emptyVisits: { ...typography.body, color: colors.textSecondary, marginTop: spacing.xs },
  visitRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.sm,
  },
  visitThumb: { width: 44, height: 44, borderRadius: radius.sm, backgroundColor: colors.surfaceMuted },
  visitInfo: { flex: 1 },
  visitName: { ...typography.bodyStrong, color: colors.textPrimary },
  visitTime: { ...typography.caption, color: colors.textSecondary, marginTop: 2 },

  addVisitTrigger: {
    borderWidth: 1,
    borderStyle: "dashed",
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    alignItems: "center",
  },
  addVisitTriggerLabel: { ...typography.bodyStrong, color: colors.primary },
  addVisitCard: { gap: spacing.sm },
  addVisitButtonRow: { flexDirection: "row", gap: spacing.sm, marginTop: spacing.xs },
  addVisitButtonHalf: { flex: 1 },
  cardLabel: { fontSize: 9, letterSpacing: 1.5, color: colors.textMuted, fontWeight: "600" },
  meta: { ...typography.body, color: colors.textSecondary, marginTop: spacing.xs },
  errorText: { ...typography.caption, color: colors.danger },
  photoTile: {
    alignSelf: "flex-start",
    width: 96,
    borderWidth: 1,
    borderStyle: "dashed",
    borderColor: "rgba(134,119,111,0.55)",
    borderRadius: 14,
    backgroundColor: colors.surfaceMuted,
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.xs,
    paddingVertical: spacing.sm,
    overflow: "hidden",
  },
  photoTileReady: { borderStyle: "solid", borderColor: colors.success },
  photoTileImage: { width: 56, height: 56, borderRadius: 99 },
  photoGlyph: { color: colors.textSecondary, fontSize: 13 },
  photoTileLabel: { fontSize: 9.5, letterSpacing: 0.5, color: colors.textSecondary, textAlign: "center" },
});
