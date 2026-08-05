import { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import { useNavigation } from "@react-navigation/native";
import { WebView } from "react-native-webview";
import * as Location from "expo-location";
import { BarSpark } from "@/components/dashboard/BarSpark";
import { useActivityPattern, useAuth, useResolvedGeofenceTarget } from "@/hooks";
import type { GeofenceTarget } from "@/hooks/useGeofence";
import { useAttendanceSessionStore } from "@/store/attendanceSessionStore";
import { getCurrentPositionWithTimeout } from "@/utils/geo";
import { colors, spacing, typography } from "@/theme";

type Coords = { latitude: number; longitude: number };

/** Builds a self-contained Leaflet + OpenStreetMap page. No API key needed —
 * unlike react-native-maps, which requires a Google Maps key on Android even
 * for non-Google tile sources, this renders entirely inside a WebView. */
function buildMapHtml(userCoords: Coords | null, target: GeofenceTarget | null): string {
  const center = userCoords ?? target ?? { latitude: 20.5937, longitude: 78.9629 };
  const zoom = userCoords || target ? 16 : 4;

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

  const fitBounds =
    userCoords && target
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
    ${fitBounds}
  </script>
</body>
</html>`;
}

export function LiveMapScreen() {
  const navigation = useNavigation();
  const { user } = useAuth();
  const isTracking = useAttendanceSessionStore((s) => s.isTracking);
  const target = useResolvedGeofenceTarget();
  const pings = useActivityPattern(isTracking);

  const [userCoords, setUserCoords] = useState<Coords | null>(null);
  const [locationError, setLocationError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const permission = await Location.requestForegroundPermissionsAsync();
      if (permission.status !== "granted") {
        if (!cancelled) setLocationError("Location permission is required to show the map.");
        return;
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

  const mapHtml = useMemo(() => buildMapHtml(userCoords, target), [userCoords, target]);

  const locationLabel =
    user?.workMode === "WFH" ? "Home location" : user?.workMode === "FIELD" ? "No fixed location" : "Office";

  return (
    <View style={styles.container}>
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
          <Text style={styles.kicker}>LIVE LOCATION</Text>
          <Text style={styles.title}>{locationLabel}</Text>
          <Text style={styles.subtitle}>
            {locationError ?? (target ? `Geofence ${Math.round(target.radiusMeters)} m` : "No geofence configured")}
          </Text>
        </View>
        <Pressable onPress={() => navigation.goBack()} style={styles.closeButton}>
          <Text style={styles.closeGlyph}>✕</Text>
        </Pressable>
      </View>

      <View style={styles.pingPanel}>
        <View style={styles.pingPanelHeader}>
          <Text style={styles.pingPanelLabel}>{isTracking ? "SHARING LIVE" : "NOT SHARING"}</Text>
          <Text style={styles.pingPanelInterval}>every 2 min</Text>
        </View>
        <BarSpark values={pings} color={colors.primary} height={44} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.panelDarker },
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
});
