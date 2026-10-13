import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, Alert, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { useNavigation } from "@react-navigation/native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { WebView, type WebViewMessageEvent } from "react-native-webview";
import * as Location from "expo-location";
import * as Speech from "expo-speech";
import { useKeepAwake } from "expo-keep-awake";
import { BottomSheet, Button } from "@/components/ui";
import { PhotoCaptureView } from "@/components/camera";
import {
  EMPTY_VISIT_FORM,
  VisitFormFields,
  validateVisitForm,
  visitFormToPayload,
  type VisitFormValues,
} from "@/components/dashboard/VisitFormFields";
import { useAssignedPlaces, useQueuedFieldVisit, useRoutePlanner } from "@/hooks";
import { assignedPlacesService } from "@/api/services";
import { useAttendanceSessionStore } from "@/store/attendanceSessionStore";
import { getQuickPosition } from "@/utils/geo";
import { getErrorMessage } from "@/utils/errors";
import {
  ARRIVAL_METERS,
  OFF_ROUTE_FIXES,
  OFF_ROUTE_METERS,
  formatDuration,
  formatMeters,
  guidanceFor,
  hasArrived,
  maneuverGlyph,
  spokenInstruction,
  straightLine,
  type Guidance,
} from "@/utils/navigation";
import { colors, radius, spacing, typography } from "@/theme";
import type { AssignedPlace, PlannedPlace, RouteLeg, RoutePlan } from "@/types";
import { NAV_MAP_HTML } from "./navMapHtml";

type Phase = "loading" | "navigating" | "arrived" | "done" | "error";
type Fix = { latitude: number; longitude: number; accuracy: number; heading: number | null };

const MAX_FIX_ACCURACY_METERS = 60;
const REROUTE_COOLDOWN_MS = 12_000;
const SKIP_REASONS = ["Closed", "Couldn't find it", "Not needed", "No time left"];

/**
 * Turn-by-turn guidance to the worker's assigned places, inside the app: the map, the route line,
 * the next turn and its distance, spoken prompts, automatic re-routing when they leave the route, and
 * arrival detection that opens the visit form (prefilled). After each place the remaining ones are
 * re-planned from where the worker is, so the next stop is always the nearest.
 */
export function NavigationScreen() {
  useKeepAwake();
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const placesQuery = useAssignedPlaces(true);
  const queue = useQueuedFieldVisit();
  const { plan, replan, offline } = useRoutePlanner();
  const activeAttendanceId = useAttendanceSessionStore((s) => s.activeAttendanceId);

  const webRef = useRef<WebView>(null);
  const [mapReady, setMapReady] = useState(false);
  const [following, setFollowing] = useState(true);
  const [phase, setPhase] = useState<Phase>("loading");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [fix, setFix] = useState<Fix | null>(null);
  const [leg, setLeg] = useState<RouteLeg | null>(null);
  const [guidance, setGuidance] = useState<Guidance | null>(null);
  const [muted, setMuted] = useState(false);
  const [rerouting, setRerouting] = useState(false);

  const [capturing, setCapturing] = useState(false);
  const [sheet, setSheet] = useState<"visit" | "skip" | null>(null);
  const [form, setForm] = useState<VisitFormValues>(EMPTY_VISIT_FORM);
  const [photo, setPhoto] = useState<string | null>(null);
  const [sheetError, setSheetError] = useState<string | null>(null);
  const [skipReason, setSkipReason] = useState("");
  const [busy, setBusy] = useState(false);

  // Places logged or skipped in this session, so the next plan leaves them out even before the
  // server (or the background upload) has caught up.
  const doneIds = useRef(new Set<string>());
  const progressIndex = useRef(0);
  const announced = useRef({ step: -1, far: false, near: false });
  const offCount = useRef(0);
  const nearCount = useRef(0);
  const lastReroute = useRef(0);
  const lastHeading = useRef<number | null>(null);
  const mutedRef = useRef(false);
  mutedRef.current = muted;
  const latestFix = useRef<Fix | null>(null);

  const target: PlannedPlace | null = plan?.ordered[0] ?? null;
  const others = useMemo(() => plan?.ordered.slice(1) ?? [], [plan]);

  const say = useCallback((text: string) => {
    if (mutedRef.current) return;
    Speech.stop();
    Speech.speak(text, { language: "en-IN", rate: 0.95 });
  }, []);
  const run = useCallback((js: string) => webRef.current?.injectJavaScript(`${js};true;`), []);

  // ----- plan / advance ---------------------------------------------------------------------------
  const applyPlan = useCallback(
    (result: RoutePlan, from: { latitude: number; longitude: number }) => {
      const first = result.ordered[0];
      if (!first) {
        setLeg(null);
        setGuidance(null);
        setPhase("done");
        say("All of today's places are done.");
        return;
      }
      const nextLeg = result.next?.leg ?? straightLine(from, first, first.name);
      progressIndex.current = 0;
      announced.current = { step: -1, far: false, near: false };
      offCount.current = 0;
      nearCount.current = 0;
      setLeg(nextLeg);
      setGuidance(null);
      setPhase("navigating");
      say(`Heading to ${first.name}. ${nextLeg.steps[0]?.instruction ?? ""}`);
    },
    [say],
  );

  const plan_ = useCallback(
    async (from: { latitude: number; longitude: number }) => {
      const places: AssignedPlace[] = (await placesQuery.refetch()).data ?? placesQuery.data ?? [];
      const candidates = places.filter((p) => !doneIds.current.has(p.id));
      const result = await replan(from, candidates);
      applyPlan(result, from);
    },
    [placesQuery, replan, applyPlan],
  );

  // ----- start: permission, first fix, plan, then watch ---------------------------------------------
  useEffect(() => {
    let cancelled = false;
    let subscription: Location.LocationSubscription | null = null;
    (async () => {
      const permission = await Location.requestForegroundPermissionsAsync();
      if (permission.status !== "granted") {
        if (!cancelled) {
          setErrorMessage("Location permission is needed to guide you.");
          setPhase("error");
        }
        return;
      }
      try {
        const first = await getQuickPosition();
        if (cancelled) return;
        const start = { latitude: first.coords.latitude, longitude: first.coords.longitude };
        const initial: Fix = { ...start, accuracy: first.coords.accuracy ?? 0, heading: null };
        latestFix.current = initial;
        setFix(initial);
        await plan_(start);
      } catch (err) {
        if (!cancelled) {
          setErrorMessage(getErrorMessage(err, "Couldn't get your location. Move somewhere with a clearer view of the sky."));
          setPhase("error");
        }
        return;
      }
      try {
        const sub = await Location.watchPositionAsync(
          { accuracy: Location.Accuracy.BestForNavigation, timeInterval: 1000, distanceInterval: 2 },
          (p) => {
            if (cancelled) return;
            const accuracy = p.coords.accuracy ?? 0;
            if (accuracy > MAX_FIX_ACCURACY_METERS) return;
            // Heading is only meaningful while moving; otherwise keep the last known one.
            if (p.coords.heading != null && p.coords.heading >= 0 && (p.coords.speed ?? 0) > 1) {
              lastHeading.current = p.coords.heading;
            }
            const next: Fix = {
              latitude: p.coords.latitude,
              longitude: p.coords.longitude,
              accuracy,
              heading: lastHeading.current,
            };
            latestFix.current = next;
            setFix(next);
          },
        );
        if (cancelled) sub.remove();
        else subscription = sub;
      } catch {
        // The first fix still lets the screen plan; guidance just will not follow movement.
      }
    })();
    return () => {
      cancelled = true;
      subscription?.remove();
      Speech.stop();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ----- the map follows the worker, route and stops ------------------------------------------------
  useEffect(() => {
    if (!mapReady || !fix) return;
    run(`window.setPosition(${fix.latitude},${fix.longitude},${fix.heading ?? "null"})`);
  }, [mapReady, fix, run]);

  useEffect(() => {
    if (!mapReady) return;
    run(`window.setRoute(${JSON.stringify(leg?.geometry ?? [])},true)`);
  }, [mapReady, leg, run]);

  useEffect(() => {
    if (!mapReady) return;
    if (target) run(`window.setDestination(${target.latitude},${target.longitude},1)`);
    else run("window.setDestination(null,null,0)");
    run(`window.setOthers(${JSON.stringify(others.map((p, i) => ({ lat: p.latitude, lng: p.longitude, n: i + 2 })))})`);
  }, [mapReady, target, others, run]);

  // ----- each new position: progress, voice prompts, off route, arrival ----------------------------
  useEffect(() => {
    if (!fix || !leg || !target || phase !== "navigating") return;
    const g = guidanceFor(fix, leg, progressIndex.current);
    progressIndex.current = g.progressIndex;
    setGuidance(g);

    // Voice: once when a turn is about 300 m away, again when it is nearly here.
    if (announced.current.step !== g.stepIndex) announced.current = { step: g.stepIndex, far: false, near: false };
    if (g.upcoming && g.upcoming.type !== 11 && g.upcoming.type !== 10) {
      if (g.metersToManeuver <= 60 && !announced.current.near) {
        announced.current.near = true;
        announced.current.far = true;
        say(spokenInstruction(g.upcoming, g.metersToManeuver));
      } else if (g.metersToManeuver <= 300 && !announced.current.far) {
        announced.current.far = true;
        say(spokenInstruction(g.upcoming, g.metersToManeuver));
      }
    }

    // Arrival: close enough for two fixes in a row.
    if (hasArrived(fix, target, fix.accuracy)) {
      nearCount.current += 1;
      if (nearCount.current >= 2) {
        setPhase("arrived");
        say(`You have arrived at ${target.name}.`);
        return;
      }
    } else {
      nearCount.current = 0;
    }

    // Off route: far from the line for several fixes in a row means ask for a new route.
    if (g.offRouteMeters > OFF_ROUTE_METERS) offCount.current += 1;
    else offCount.current = 0;
    if (offCount.current >= OFF_ROUTE_FIXES && Date.now() - lastReroute.current > REROUTE_COOLDOWN_MS) {
      lastReroute.current = Date.now();
      offCount.current = 0;
      setRerouting(true);
      say("Re-routing.");
      assignedPlacesService
        .leg(fix, target.id)
        .then((newLeg) => {
          progressIndex.current = 0;
          announced.current = { step: -1, far: false, near: false };
          setLeg(newLeg);
        })
        .catch(() => {
          // No connection: keep the old route; the next off-route check tries again.
        })
        .finally(() => setRerouting(false));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fix]);

  // ----- actions ----------------------------------------------------------------------------------
  const currentPosition = useCallback(async (): Promise<{ latitude: number; longitude: number }> => {
    const f = latestFix.current;
    if (f) return { latitude: f.latitude, longitude: f.longitude };
    const p = await getQuickPosition();
    return { latitude: p.coords.latitude, longitude: p.coords.longitude };
  }, []);

  const advance = useCallback(async () => {
    setSheet(null);
    setPhase("loading");
    try {
      await plan_(await currentPosition());
    } catch (err) {
      setErrorMessage(getErrorMessage(err, "Couldn't plan the next place."));
      setPhase("error");
    }
  }, [plan_, currentPosition]);

  const openVisitSheet = () => {
    if (!target) return;
    setForm({
      ...EMPTY_VISIT_FORM,
      name: target.name,
      description: target.description ?? "",
      contactName: target.contactName ?? "",
      contactPhone: target.contactPhone ?? "",
    });
    setPhoto(null);
    setSheetError(null);
    setSheet("visit");
  };

  const submitVisit = async () => {
    if (!target || !photo) return;
    const invalid = validateVisitForm(form);
    if (invalid) {
      setSheetError(invalid);
      return;
    }
    if (!form.name.trim()) {
      setSheetError("Give the place a name.");
      return;
    }
    setBusy(true);
    try {
      const here = await currentPosition();
      queue.submit({
        ...visitFormToPayload(form),
        photo,
        latitude: here.latitude,
        longitude: here.longitude,
        assignedPlaceId: target.id,
      });
      doneIds.current.add(target.id);
      await advance();
    } catch {
      setSheetError("Couldn't get your location. Move to a clearer spot and try again.");
    } finally {
      setBusy(false);
    }
  };

  const submitSkip = async () => {
    if (!target) return;
    const reason = skipReason.trim();
    if (!reason) {
      setSheetError("Tell your admin why this place was skipped.");
      return;
    }
    setBusy(true);
    try {
      await assignedPlacesService.skip(target.id, reason);
      doneIds.current.add(target.id);
      setSkipReason("");
      setSheetError(null);
      await advance();
    } catch (err) {
      setSheetError(getErrorMessage(err, "Couldn't skip this place."));
    } finally {
      setBusy(false);
    }
  };

  const close = useCallback(() => {
    const uploading = queue.pending.length;
    if (uploading === 0) {
      navigation.goBack();
      return;
    }
    Alert.alert(
      "Visits still saving",
      `${uploading} ${uploading === 1 ? "visit is" : "visits are"} still being saved. If you leave now they may be lost if the connection fails.`,
      [
        { text: "Stay", style: "cancel" },
        { text: "Leave anyway", style: "destructive", onPress: () => navigation.goBack() },
      ],
    );
  }, [navigation, queue.pending.length]);

  const onMessage = (e: WebViewMessageEvent) => {
    try {
      const msg = JSON.parse(e.nativeEvent.data) as { type: string };
      if (msg.type === "ready") setMapReady(true);
      if (msg.type === "unfollow") setFollowing(false);
      if (msg.type === "follow") setFollowing(true);
    } catch {
      // ignore
    }
  };

  // ----- camera takes over the whole screen while a photo is being taken ----------------------------
  if (capturing) {
    return (
      <PhotoCaptureView
        facing="back"
        onCapture={(base64) => {
          setPhoto(`data:image/jpeg;base64,${base64}`);
          setCapturing(false);
        }}
        onCancel={() => setCapturing(false)}
      />
    );
  }

  const upcoming = guidance?.upcoming ?? null;
  const total = plan?.ordered.length ?? 0;
  // The final step is the destination itself. With a straight-line route there are no turns, so show
  // the heading instead of "You have arrived" while the worker is still far away.
  const bannerText =
    upcoming && upcoming.type === 10
      ? leg?.provider === "straight-line"
        ? (leg.steps[guidance?.stepIndex ?? 0]?.instruction ?? "Head to the destination")
        : `Arrive at ${target?.name ?? "your destination"}`
      : (upcoming?.instruction ?? "Continue");

  return (
    <View style={styles.root}>
      <WebView
        ref={webRef}
        originWhitelist={["*"]}
        source={{ html: NAV_MAP_HTML }}
        style={styles.map}
        javaScriptEnabled
        domStorageEnabled
        onMessage={onMessage}
        onLoadStart={() => setMapReady(false)}
      />

      {/* Instruction banner */}
      <View style={[styles.banner, { top: insets.top + spacing.sm }]}>
        <Pressable onPress={close} hitSlop={10} style={styles.bannerClose}>
          <Text style={styles.bannerCloseLabel}>✕</Text>
        </Pressable>
        {phase === "navigating" && upcoming && guidance ? (
          <View style={styles.bannerBody}>
            <Text style={styles.glyph}>{maneuverGlyph(upcoming.type)}</Text>
            <View style={styles.bannerText}>
              <Text style={styles.bannerDistance}>{formatMeters(guidance.metersToManeuver)}</Text>
              <Text style={styles.bannerInstruction} numberOfLines={2}>
                {bannerText}
              </Text>
            </View>
          </View>
        ) : (
          <Text style={styles.bannerPlain}>
            {phase === "arrived" ? "You have arrived" : phase === "done" ? "All places done" : phase === "error" ? "Can't navigate" : "Planning your route…"}
          </Text>
        )}
        <Pressable onPress={() => setMuted((m) => !m)} hitSlop={10} style={styles.bannerMute}>
          <Text style={styles.bannerCloseLabel}>{muted ? "🔇" : "🔊"}</Text>
        </Pressable>
      </View>
      {rerouting ? <Text style={[styles.pill, { top: insets.top + 92 }]}>Re-routing…</Text> : null}
      {offline ? <Text style={[styles.pill, { top: insets.top + 92 }]}>No connection: straight-line guidance</Text> : null}
      {queue.pending.some((p) => p.status === "failed") ? (
        <Pressable
          onPress={() => queue.pending.filter((p) => p.status === "failed").forEach((p) => queue.retry(p.key))}
          style={[styles.pillBox, { top: insets.top + 156 }]}
        >
          <Text style={styles.pillWarnLabel}>A visit didn&apos;t save. Tap to retry</Text>
        </Pressable>
      ) : null}
      {!activeAttendanceId ? (
        <Text style={[styles.pill, styles.pillWarn, { top: insets.top + 124 }]}>Not checked in: visits can&apos;t be saved yet</Text>
      ) : null}

      {!following && phase === "navigating" ? (
        <Pressable
          onPress={() => {
            setFollowing(true);
            run("window.recenter()");
          }}
          style={[styles.recenter, { bottom: 210 + insets.bottom }]}
        >
          <Text style={styles.recenterLabel}>Re-centre</Text>
        </Pressable>
      ) : null}

      {/* Bottom panel */}
      <View style={[styles.panel, { paddingBottom: spacing.md + insets.bottom }]}>
        {phase === "loading" ? (
          <View style={styles.center}>
            <ActivityIndicator color={colors.primary} />
            <Text style={styles.panelHint}>Working out the best order…</Text>
          </View>
        ) : null}

        {phase === "error" ? (
          <>
            <Text style={styles.panelTitle}>Couldn&apos;t start navigation</Text>
            <Text style={styles.panelHint}>{errorMessage}</Text>
            <Button label="Close" variant="secondary" onPress={close} style={styles.panelButton} />
          </>
        ) : null}

        {phase === "done" ? (
          <>
            <Text style={styles.panelTitle}>All places done</Text>
            <Text style={styles.panelHint}>Nothing left to visit from today&apos;s list.</Text>
            {queue.pending.length > 0 ? (
              <Text style={styles.panelHint}>
                {queue.pending.length} {queue.pending.length === 1 ? "visit is" : "visits are"} still saving. Keep this screen open until it finishes.
              </Text>
            ) : null}
            <Button label="Back to dashboard" onPress={close} style={styles.panelButton} />
          </>
        ) : null}

        {(phase === "navigating" || phase === "arrived") && target ? (
          <>
            <Text style={styles.panelKicker}>
              {phase === "arrived" ? "ARRIVED" : `NEXT STOP · ${total} ${total === 1 ? "PLACE" : "PLACES"} LEFT`}
            </Text>
            <Text style={styles.panelTitle}>{target.name}</Text>
            {target.address ? <Text style={styles.panelHint} numberOfLines={1}>{target.address}</Text> : null}
            {phase === "navigating" && guidance ? (
              <Text style={styles.panelMeta}>
                {formatMeters(guidance.metersRemaining)} · {formatDuration(guidance.secondsRemaining)} to go
              </Text>
            ) : null}
            {target.notes ? <Text style={styles.panelNote}>Note: {target.notes}</Text> : null}
            <View style={styles.actions}>
              <Button
                label="Skip"
                variant="secondary"
                style={styles.actionHalf}
                onPress={() => {
                  setSheetError(null);
                  setSheet("skip");
                }}
              />
              <Button
                label={phase === "arrived" ? "Log this visit" : "I'm here"}
                style={styles.actionHalf}
                onPress={() => (phase === "arrived" ? openVisitSheet() : setPhase("arrived"))}
              />
            </View>
            {phase === "arrived" ? (
              <Text style={styles.panelHint}>Arrival is detected within about {ARRIVAL_METERS} m of the place.</Text>
            ) : null}
          </>
        ) : null}
      </View>

      {/* Log the visit (prefilled) */}
      <BottomSheet visible={sheet === "visit"} onClose={() => setSheet(null)} kicker="ARRIVED" title={target?.name ?? "Log visit"}>
        <VisitFormFields values={form} onChange={setForm} />
        <Pressable onPress={() => setCapturing(true)} style={[styles.photoTile, photo && styles.photoTileFilled]}>
          <Text style={styles.photoLabel}>{photo ? "Photo attached" : "Add a photo"}</Text>
          <Text style={styles.photoHint}>{photo ? "Tap to retake" : "One shot of the place, required"}</Text>
        </Pressable>
        {sheetError ? <Text style={styles.sheetError}>{sheetError}</Text> : null}
        <Button label="Save and go to the next place" onPress={() => void submitVisit()} loading={busy} disabled={!photo || !form.name.trim()} style={styles.sheetButton} />
      </BottomSheet>

      {/* Skip with a reason */}
      <BottomSheet visible={sheet === "skip"} onClose={() => setSheet(null)} kicker="SKIP" title={target?.name ?? "Skip place"}>
        <Text style={styles.panelHint}>Why couldn&apos;t you visit this place? Your admin will see it.</Text>
        <View style={styles.chips}>
          {SKIP_REASONS.map((r) => (
            <Pressable key={r} onPress={() => setSkipReason(r)} style={[styles.chip, skipReason === r && styles.chipOn]}>
              <Text style={[styles.chipLabel, skipReason === r && styles.chipLabelOn]}>{r}</Text>
            </Pressable>
          ))}
        </View>
        <TextInput
          value={skipReason}
          onChangeText={setSkipReason}
          placeholder="Or write a reason"
          placeholderTextColor={colors.textMuted}
          maxLength={300}
          style={styles.reasonInput}
        />
        {sheetError ? <Text style={styles.sheetError}>{sheetError}</Text> : null}
        <Button label="Skip this place" onPress={() => void submitSkip()} loading={busy} style={styles.sheetButton} />
      </BottomSheet>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.panelDarker },
  map: { flex: 1 },
  banner: {
    position: "absolute",
    left: spacing.sm,
    right: spacing.sm,
    minHeight: 76,
    borderRadius: radius.md,
    backgroundColor: colors.panelDark,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: spacing.sm + 2,
    paddingVertical: spacing.sm,
    gap: spacing.sm,
  },
  bannerClose: { width: 32, height: 32, alignItems: "center", justifyContent: "center" },
  bannerMute: { width: 32, height: 32, alignItems: "center", justifyContent: "center" },
  bannerCloseLabel: { color: colors.textOnDark, fontSize: 18 },
  bannerBody: { flex: 1, flexDirection: "row", alignItems: "center", gap: spacing.sm + 2 },
  glyph: { color: colors.primarySoftText, fontSize: 40, width: 46, textAlign: "center" },
  bannerText: { flex: 1 },
  bannerDistance: { ...typography.h2, color: colors.textOnDark },
  bannerInstruction: { ...typography.body, color: colors.textOnDarkMuted },
  bannerPlain: { ...typography.bodyStrong, color: colors.textOnDark, flex: 1, textAlign: "center" },
  pill: {
    position: "absolute",
    alignSelf: "center",
    overflow: "hidden",
    borderRadius: radius.full,
    backgroundColor: colors.surface,
    color: colors.textPrimary,
    paddingHorizontal: spacing.sm + 4,
    paddingVertical: 4,
    ...typography.caption,
  },
  pillWarn: { color: colors.danger },
  pillBox: {
    position: "absolute",
    alignSelf: "center",
    borderRadius: radius.full,
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.sm + 4,
    paddingVertical: 4,
  },
  pillWarnLabel: { ...typography.caption, color: colors.danger },
  recenter: {
    position: "absolute",
    right: spacing.md,
    borderRadius: radius.full,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  recenterLabel: { ...typography.bodyStrong, color: colors.primaryDark, fontSize: 13 },
  panel: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md,
    minHeight: 120,
  },
  center: { alignItems: "center", paddingVertical: spacing.md, gap: spacing.sm },
  panelKicker: { fontSize: 9, letterSpacing: 1.5, color: colors.textMuted, fontWeight: "600" },
  panelTitle: { ...typography.h3, color: colors.textPrimary, marginTop: 2 },
  panelHint: { ...typography.caption, color: colors.textSecondary, marginTop: 3 },
  panelMeta: { ...typography.bodyStrong, color: colors.primaryDark, marginTop: spacing.xs },
  panelNote: { ...typography.caption, color: colors.warning, marginTop: spacing.xs },
  panelButton: { marginTop: spacing.md },
  actions: { flexDirection: "row", gap: spacing.sm, marginTop: spacing.sm + 2 },
  actionHalf: { flex: 1 },
  photoTile: {
    borderRadius: radius.sm,
    backgroundColor: colors.surfaceMuted,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.sm + 2,
    marginTop: spacing.sm,
  },
  photoTileFilled: { borderColor: colors.primary, backgroundColor: colors.primaryMuted },
  photoLabel: { ...typography.bodyStrong, fontSize: 13, color: colors.textPrimary },
  photoHint: { ...typography.caption, color: colors.textSecondary, marginTop: 2 },
  sheetError: { ...typography.caption, color: colors.danger, marginTop: spacing.sm },
  sheetButton: { marginTop: spacing.md },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm, marginTop: spacing.sm },
  chip: {
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs + 2,
  },
  chipOn: { borderColor: colors.primary, backgroundColor: colors.primaryMuted },
  chipLabel: { ...typography.caption, color: colors.textSecondary },
  chipLabelOn: { color: colors.primaryDark, fontWeight: "600" },
  reasonInput: {
    marginTop: spacing.sm,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.sm + 2,
    paddingVertical: spacing.sm,
    color: colors.textPrimary,
    ...typography.body,
  },
});
