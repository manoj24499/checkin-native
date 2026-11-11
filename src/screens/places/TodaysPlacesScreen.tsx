import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Animated, Pressable, StyleSheet, Text, View } from "react-native";
import Svg, { Circle } from "react-native-svg";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import {
  Button,
  Card,
  ErrorView,
  Icon,
  IconButton,
  Kicker,
  LoadingView,
  Rise,
  Screen,
  useReducedMotion,
} from "@/components/ui";
import { useAssignedPlaces, useRoutePlanner } from "@/hooks";
import { useAttendanceSessionStore } from "@/store/attendanceSessionStore";
import { getQuickPosition } from "@/utils/geo";
import { formatDuration, formatMeters } from "@/utils/navigation";
import { getErrorMessage } from "@/utils/errors";
import { colors, fontFamilies, gradientDirection, gradients, radius, spacing, typography } from "@/theme";
import { useTabBarClearance } from "@/navigation/tabBarClearance";
import type { DashboardStackParamList } from "@/navigation/types";
import type { AssignedPlace } from "@/types";

const RING_R = 36;
const RING_C = 2 * Math.PI * RING_R;
const AnimatedCircle = Animated.createAnimatedComponent(Circle);

type Nav = NativeStackNavigationProp<DashboardStackParamList, "TodaysPlaces">;

/**
 * The places an admin assigned for today, in the order to visit them: nearest to where the worker
 * is now first, then the nearest to that one, and so on. "Start navigation" opens the turn-by-turn
 * screen.
 */
export function TodaysPlacesScreen() {
  const navigation = useNavigation<Nav>();
  const placesQuery = useAssignedPlaces(true);
  const { plan, planning, offline, replan } = useRoutePlanner();
  const activeAttendanceId = useAttendanceSessionStore((s) => s.activeAttendanceId);
  const [positionNote, setPositionNote] = useState<string | null>(null);
  const insets = useSafeAreaInsets();
  const tabClearance = useTabBarClearance();
  const [openId, setOpenId] = useState<string | null | undefined>(undefined);
  const refetchRef = useRef(placesQuery.refetch);
  refetchRef.current = placesQuery.refetch;

  const load = useCallback(async () => {
    const places = (await refetchRef.current()).data ?? [];
    try {
      const position = await getQuickPosition();
      setPositionNote(null);
      await replan({ latitude: position.coords.latitude, longitude: position.coords.longitude }, places);
    } catch {
      // No position yet: the list stays in the order the admin's plan saved.
      setPositionNote("Couldn't get your location, so distances are not shown.");
    }
  }, [replan]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const places = useMemo(() => placesQuery.data ?? [], [placesQuery.data]);
  const pending = useMemo(() => {
    const order = plan?.ordered.map((p) => p.id) ?? [];
    const planned = new Map((plan?.ordered ?? []).map((p) => [p.id, p]));
    const stillPending = places.filter((p) => p.status === "PENDING");
    return [...stillPending]
      .sort((a, b) => {
        const ia = order.indexOf(a.id);
        const ib = order.indexOf(b.id);
        if (ia === -1 && ib === -1) return a.sortOrder - b.sortOrder;
        if (ia === -1) return 1;
        if (ib === -1) return -1;
        return ia - ib;
      })
      .map((p) => ({ place: p, planned: planned.get(p.id) }));
  }, [places, plan]);
  const visited = places.filter((p) => p.status === "VISITED");
  const skipped = places.filter((p) => p.status === "SKIPPED");

  if (placesQuery.isLoading) return <LoadingView label="Loading your places…" />;
  if (placesQuery.isError && places.length === 0) {
    return <ErrorView message={getErrorMessage(placesQuery.error)} onRetry={() => void load()} />;
  }

  // First pending stop starts expanded until the user picks another.
  const effectiveOpenId = openId === undefined ? pending[0]?.place.id ?? null : openId;
  const startBar = pending.length > 0;
  const doneCount = visited.length + skipped.length;
  const progress = places.length ? doneCount / places.length : 0;
  const toggle = (id: string) => setOpenId(effectiveOpenId === id ? null : id);
  // Start bar sits above the floating tab bar when inside the tabs (mockup: 28 from the bottom otherwise).
  const barBottom = tabClearance ? tabClearance + 4 : Math.max(28, insets.bottom + 12);

  return (
    <View style={styles.root}>
      <Screen
        scroll
        glow="topRight"
        contentStyle={{
          paddingHorizontal: spacing.gutter,
          gap: 12,
          ...(startBar ? { paddingBottom: barBottom + 56 + 24 } : null),
        }}
        refreshing={placesQuery.isRefetching || planning}
        onRefresh={() => void load()}
      >
        <Rise style={styles.header}>
          <IconButton icon="chevronLeft" onPress={() => navigation.goBack()} accessibilityLabel="Back" />
          <View style={styles.headerText}>
            <Kicker>Field day</Kicker>
            <Text style={styles.title}>Today&apos;s places</Text>
          </View>
        </Rise>

        <Rise delay={100}>
          <Card size="sm" style={styles.progressCard}>
            <ProgressRing progress={progress} label={`${doneCount}/${places.length}`} />
            <View style={styles.progressText}>
              <Text style={styles.progressBig}>
                {doneCount} of {places.length} visited
              </Text>
              <Text style={styles.progressSub}>
                {pending.length} left{skipped.length > 0 ? ` · ${skipped.length} skipped` : ""}
              </Text>
            </View>
          </Card>
        </Rise>

        {!activeAttendanceId ? (
          <Rise delay={160} style={[styles.note, styles.warning]}>
            <Icon name="alert" size={16} color={colors.warningText} />
            <Text style={[styles.noteText, styles.flex1]}>
              You&apos;re not checked in. Check in with Field work before you log a visit.
            </Text>
          </Rise>
        ) : null}
        {offline ? (
          <Rise delay={180} style={styles.note}>
            <Text style={styles.noteText}>
              No connection, so the order is by straight-line distance and may differ from the road route.
            </Text>
          </Rise>
        ) : plan && !plan.roads && pending.length > 1 ? (
          <Rise delay={180} style={styles.note}>
            <Text style={styles.noteText}>Ordered by straight-line distance.</Text>
          </Rise>
        ) : null}
        {positionNote ? (
          <Rise delay={180} style={styles.note}>
            <Text style={styles.noteText}>{positionNote}</Text>
          </Rise>
        ) : null}

        {pending.length > 0 ? (
          pending.map(({ place, planned }, i) => (
            <Rise key={place.id} delay={240 + Math.min(i, 5) * 60}>
              <PlaceCard
                place={place}
                order={i + 1}
                isNext={i === 0}
                open={effectiveOpenId === place.id}
                onToggle={() => toggle(place.id)}
                onNavigate={() => navigation.navigate("Navigate")}
                fromLabel={i === 0 ? "from you" : "from the previous stop"}
                distanceMeters={planned?.distanceMeters}
                durationSeconds={planned?.durationSeconds}
              />
            </Rise>
          ))
        ) : (
          <Rise delay={240}>
            <Text style={styles.allDone}>
              {places.length > 0 ? "Everything assigned for today is done." : "No places are assigned for today."}
            </Text>
          </Rise>
        )}

        {visited.length > 0 ? (
          <Rise delay={340} style={styles.group}>
            <Kicker style={styles.section}>Done</Kicker>
            <Card size="sm" style={styles.groupCard}>
              {visited.map((p) => (
                <PlaceRow key={p.id} place={p} done open={effectiveOpenId === p.id} onToggle={() => toggle(p.id)} />
              ))}
            </Card>
          </Rise>
        ) : null}
        {skipped.length > 0 ? (
          <Rise delay={420} style={styles.group}>
            <Kicker style={styles.section}>Skipped</Kicker>
            <Card size="sm" style={styles.groupCard}>
              {skipped.map((p) => (
                <PlaceRow
                  key={p.id}
                  place={p}
                  skippedReason={p.skipReason ?? ""}
                  open={effectiveOpenId === p.id}
                  onToggle={() => toggle(p.id)}
                />
              ))}
            </Card>
          </Rise>
        ) : null}
      </Screen>
      {startBar ? (
        <View pointerEvents="box-none" style={[styles.startBar, { bottom: barBottom }]}>
          <Button
            label="Start navigation"
            size="lg"
            pulse
            trailingIcon="arrow"
            onPress={() => navigation.navigate("Navigate")}
            accessibilityLabel="Start navigation"
          />
        </View>
      ) : null}
    </View>
  );
}

/** 84px progress ring (mockup): grey track, #FF9A3D arc drawn in from empty on mount, "2/5" in the middle. */
function ProgressRing({ progress, label }: { progress: number; label: string }) {
  const reduced = useReducedMotion();
  const target = RING_C * (1 - Math.max(0, Math.min(1, progress)));
  const offset = useRef(new Animated.Value(reduced ? target : RING_C)).current;
  useEffect(() => {
    if (reduced) {
      offset.setValue(target);
      return;
    }
    // strokeDashoffset is an SVG prop, so this one can't run on the native driver.
    const anim = Animated.timing(offset, { toValue: target, duration: 1600, delay: 300, useNativeDriver: false });
    anim.start();
    return () => anim.stop();
  }, [target, reduced, offset]);
  return (
    <View style={styles.ring}>
      <Svg width={84} height={84} viewBox="0 0 84 84" style={{ transform: [{ rotate: "-90deg" }] }}>
        <Circle cx={42} cy={42} r={RING_R} fill="none" stroke="rgba(23,19,15,0.1)" strokeWidth={8} />
        <AnimatedCircle
          cx={42}
          cy={42}
          r={RING_R}
          fill="none"
          stroke="#FF9A3D"
          strokeWidth={8}
          strokeLinecap="round"
          strokeDasharray={`${RING_C} ${RING_C}`}
          strokeDashoffset={offset}
          opacity={progress > 0 ? 1 : 0}
        />
      </Svg>
      <View style={styles.ringCenter} pointerEvents="none">
        <Text style={styles.ringLabel}>{label}</Text>
      </View>
    </View>
  );
}

interface PlaceProps {
  place: AssignedPlace;
  order?: number;
  fromLabel?: string;
  distanceMeters?: number;
  durationSeconds?: number;
  done?: boolean;
  skippedReason?: string;
  isNext?: boolean;
  open: boolean;
  onToggle: () => void;
  onNavigate?: () => void;
}

/** A pending stop: its own white card; the next stop gets an orange edge, a gradient number and a "Next" pill. */
function PlaceCard(props: PlaceProps) {
  return (
    <View style={[styles.card, props.isNext && styles.cardNext]}>
      <PlaceRow {...props} />
    </View>
  );
}

/** One expandable place row (inside a PlaceCard, or grouped in the Done / Skipped cards). */
function PlaceRow({
  place,
  order,
  fromLabel,
  distanceMeters,
  durationSeconds,
  done,
  skippedReason,
  isNext,
  open,
  onToggle,
  onNavigate,
}: PlaceProps) {
  const contact = [place.contactName, place.contactPhone].filter(Boolean).join(" · ");
  const skipped = skippedReason !== undefined;
  const muted = done || skipped;
  const hasDistance = distanceMeters !== undefined && durationSeconds !== undefined;
  const meta = done
    ? place.visitedAt
      ? `Done · ${new Date(place.visitedAt).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })}`
      : "Done"
    : skipped
      ? skippedReason
        ? `Skipped: ${skippedReason}`
        : "Skipped"
      : hasDistance
        ? `${formatMeters(distanceMeters)} · ${formatDuration(durationSeconds)} ${fromLabel}`
        : place.address ?? "";
  return (
    <View>
      <Pressable
        onPress={onToggle}
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        style={({ pressed }) => [styles.row, muted && styles.rowCompact, pressed && { opacity: 0.8 }]}
      >
        <View style={[styles.badge, done && styles.badgeDone]}>
          {isNext ? (
            <LinearGradient colors={gradients.orange} {...gradientDirection.diagonal} style={StyleSheet.absoluteFill} />
          ) : null}
          {done ? (
            <Icon name="checkmark" size={16} color={colors.success} strokeWidth={2.6} />
          ) : (
            <Text style={[styles.badgeLabel, isNext && { color: colors.onOrange }]}>{skipped ? "–" : order}</Text>
          )}
        </View>
        <View style={styles.rowBody}>
          <Text
            style={[styles.name, skipped && styles.nameSkipped]}
            numberOfLines={1}
          >
            {place.name}
          </Text>
          {meta ? (
            <Text style={styles.meta} numberOfLines={1}>
              {meta}
            </Text>
          ) : null}
        </View>
        {isNext ? <Text style={styles.nextPill}>Next</Text> : null}
        <View style={{ transform: [{ rotate: open ? "180deg" : "0deg" }] }}>
          <Icon name="chevronDown" size={18} color={colors.textMuted} />
        </View>
      </Pressable>
      {open ? (
        <View style={styles.details}>
          {place.address && meta !== place.address ? <Text style={styles.detail}>{place.address}</Text> : null}
          {place.description ? <Text style={styles.detail}>{place.description}</Text> : null}
          {contact ? (
            <Text style={styles.detail}>
              Contact · <Text style={styles.detailStrong}>{contact}</Text>
            </Text>
          ) : null}
          {place.notes ? <Text style={styles.detail}>Note: {place.notes}</Text> : null}
          {isNext && onNavigate ? (
            <Pressable
              onPress={onNavigate}
              accessibilityRole="button"
              style={({ pressed }) => [styles.navHere, pressed && { opacity: 0.75 }]}
            >
              <Icon name="navigate" size={15} color={colors.accentText} />
              <Text style={styles.navHereText}>Navigate here</Text>
            </Pressable>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  flex1: { flex: 1 },
  header: { flexDirection: "row", alignItems: "center", gap: 12, marginTop: spacing.sm },
  headerText: { flex: 1 },
  title: {
    fontFamily: fontFamilies.display700,
    fontWeight: "700",
    fontSize: 26,
    lineHeight: 32,
    letterSpacing: -0.3,
    color: colors.ink,
  },

  progressCard: { flexDirection: "row", alignItems: "center", gap: 16, padding: 16 },
  ring: { width: 84, height: 84 },
  ringCenter: { ...StyleSheet.absoluteFillObject, alignItems: "center", justifyContent: "center" },
  ringLabel: { ...typography.number, fontSize: 18, color: colors.ink },
  progressText: { flex: 1, minWidth: 0 },
  progressBig: { fontFamily: fontFamilies.display700, fontWeight: "700", fontSize: 24, color: colors.ink, fontVariant: ["tabular-nums"] },
  progressSub: { fontSize: 13, color: colors.textSecondary, marginTop: 3 },

  note: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    backgroundColor: "rgba(255,176,60,0.12)",
    borderRadius: radius.md,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  warning: { backgroundColor: colors.warningMuted, paddingVertical: 10 },
  noteText: { fontSize: 12, lineHeight: 17, color: colors.warningText },

  startBar: { position: "absolute", left: spacing.gutter, right: spacing.gutter },
  allDone: { ...typography.body, color: colors.textSecondary, marginTop: spacing.md, textAlign: "center" },
  group: { gap: 8 },
  section: { marginTop: 4, marginBottom: 0 },
  groupCard: { padding: 0, paddingVertical: 2 },

  card: {
    borderRadius: radius.cardSm,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.cardBorder,
  },
  cardNext: { borderColor: "rgba(255,154,61,0.5)" },
  row: { flexDirection: "row", alignItems: "flex-start", gap: 12, paddingVertical: 12, paddingHorizontal: 14 },
  rowCompact: { paddingVertical: 10 },
  rowBody: { flex: 1, minWidth: 0 },
  badge: {
    width: 32,
    height: 32,
    borderRadius: 16,
    overflow: "hidden",
    backgroundColor: "rgba(23,19,15,0.1)",
    alignItems: "center",
    justifyContent: "center",
  },
  badgeDone: { backgroundColor: "rgba(74,222,128,0.18)" },
  badgeLabel: { fontFamily: fontFamilies.display700, fontWeight: "700", fontSize: 14, color: colors.ink },
  name: { ...typography.cardTitle, color: colors.ink },
  nameSkipped: { textDecorationLine: "line-through", color: colors.textSecondary },
  meta: { fontSize: 12, lineHeight: 17, color: colors.textSecondary, marginTop: 3, fontVariant: ["tabular-nums"] },
  nextPill: {
    alignSelf: "center",
    fontFamily: fontFamilies.semiBold,
    fontWeight: "600",
    fontSize: 11,
    color: colors.onOrange,
    backgroundColor: colors.primarySoftText,
    borderRadius: 99,
    overflow: "hidden",
    paddingVertical: 4,
    paddingHorizontal: 10,
  },
  details: { gap: 4, paddingRight: 14, paddingBottom: 14, paddingLeft: 58 },
  detail: { fontSize: 12, lineHeight: 18, color: colors.textSecondary },
  detailStrong: { color: colors.ink, fontWeight: "600", fontFamily: fontFamilies.semiBold },
  navHere: {
    height: 42,
    marginTop: 6,
    borderRadius: 21,
    backgroundColor: "rgba(239,108,0,0.18)",
    borderWidth: 1,
    borderColor: "rgba(255,154,61,0.45)",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  navHereText: { fontFamily: fontFamilies.semiBold, fontWeight: "600", fontSize: 14, color: colors.accentText },
});
