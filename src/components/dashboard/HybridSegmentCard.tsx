import { useEffect, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { BottomSheet, Button, Card, Icon, Kicker } from "@/components/ui";
import { colors, fontFamilies, radius, spacing, typography } from "@/theme";
import type { HybridPlace, SegmentMinutes, WorkSegmentStatus } from "@/types";

const PLACE_LABEL: Record<HybridPlace, string> = { OFFICE: "Office", HOME: "Home" };
const otherPlace = (p: HybridPlace): HybridPlace => (p === "OFFICE" ? "HOME" : "OFFICE");
const placeName = (p: HybridPlace) => (p === "HOME" ? "home" : "the office");

function formatClock(iso: string | null | undefined) {
  if (!iso) return null;
  return new Date(iso).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
}

export function formatMinutes(total: number) {
  const mins = Math.max(0, Math.round(total));
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return h > 0 ? `${h}h ${String(m).padStart(2, "0")}m` : `${m}m`;
}

/** Ticks every 30 s — the card only shows minutes. */
function useMinuteNow() {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(id);
  }, []);
  return now;
}

/** Office / Home / Transit minutes as small chips (today's hybrid split). */
export function HybridMinutesChips({
  office,
  home,
  transit,
  style,
}: {
  office: number;
  home: number;
  transit: number;
  style?: object;
}) {
  const chips: { key: string; label: string; value: number; dot: string }[] = [
    { key: "office", label: "Office", value: office, dot: colors.primary },
    { key: "home", label: "Home", value: home, dot: colors.success },
    { key: "transit", label: "Transit", value: transit, dot: colors.textMuted },
  ];
  return (
    <View style={[styles.chipRow, style]}>
      {chips.map((c) => (
        <View key={c.key} style={styles.chip}>
          <View style={[styles.chipDot, { backgroundColor: c.dot }]} />
          <Text style={styles.chipLabel}>{c.label}</Text>
          <Text style={styles.chipValue}>{formatMinutes(c.value)}</Text>
        </View>
      ))}
    </View>
  );
}

type Confirm = { kind: "switch"; heading: HybridPlace } | { kind: "correct"; place: HybridPlace };

interface HybridSegmentCardProps {
  /** Current segment — mode OFFICE, HOME or TRANSIT. */
  segment: WorkSegmentStatus;
  /** Today's split so far (status.hybrid.segmentMinutes). */
  segmentMinutes: SegmentMinutes | null;
  /** Background location sharing is on (arrival is detected from it). */
  isTracking: boolean;
  /** From a "Heading home?" push — highlights "Switch to {heading}". */
  suggestedHeading: HybridPlace | null;
  onDismissSuggestion: () => void;
  /** Start travelling (POST { mode: "TRANSIT", heading }). */
  onSwitch: (heading: HybridPlace) => void;
  /** Arrived / direct correction (POST { mode: place }). */
  onArrive: (place: HybridPlace) => void;
  busy: boolean;
  error: string | null;
}

/**
 * HYBRID employees' current place on Home: "Working from Office/Home" (with
 * since-time and time there) or "In transit to Home/Office" (minutes on the
 * way, "I've arrived"), today's Office/Home/Transit minutes, and the switch
 * buttons — each switch confirmed in a small sheet first. Arrival is also
 * detected automatically from location pings (see /api/kiosk/location).
 */
export function HybridSegmentCard({
  segment,
  segmentMinutes,
  isTracking,
  suggestedHeading,
  onDismissSuggestion,
  onSwitch,
  onArrive,
  busy,
  error,
}: HybridSegmentCardProps) {
  const now = useMinuteNow();
  const [confirm, setConfirm] = useState<Confirm | null>(null);

  const mode = segment.mode;
  const startedMs = segment.startedAt ? new Date(segment.startedAt).getTime() : null;
  const minutesHere = startedMs ? (now - startedMs) / 60_000 : null;
  const since = formatClock(segment.startedAt);

  const inTransit = mode === "TRANSIT";
  const heading: HybridPlace | null = inTransit ? (segment.heading ?? null) : null;
  const place: HybridPlace | null = mode === "OFFICE" || mode === "HOME" ? mode : null;
  const showSuggestion = !!place && !!suggestedHeading && suggestedHeading !== place;

  const runConfirm = () => {
    if (!confirm) return;
    if (confirm.kind === "switch") onSwitch(confirm.heading);
    else onArrive(confirm.place);
    setConfirm(null);
  };

  return (
    <Card style={styles.card}>
      <View style={styles.statusRow}>
        <View style={[styles.dot, { backgroundColor: inTransit ? colors.warning : colors.success }]} />
        <Kicker style={styles.label}>
          {inTransit
            ? heading
              ? `In transit to ${PLACE_LABEL[heading]}`
              : "In transit"
            : place
              ? `Working from ${PLACE_LABEL[place]}`
              : "Checked in"}
        </Kicker>
      </View>

      {inTransit ? (
        <>
          <Text style={styles.value}>
            {formatMinutes(minutesHere ?? segment.transitMinutes ?? 0)}
            <Text style={styles.valueSub}>{since ? `  on the way · since ${since}` : "  on the way"}</Text>
          </Text>
          <Text style={styles.whyLine}>
            {isTracking
              ? `Your location is being tracked — you'll switch to ${
                  heading ? PLACE_LABEL[heading] : "your destination"
                } automatically when you get there. Travel time isn't counted as work.`
              : "Location sharing is off, so your arrival can't be detected — tap I've arrived when you get there. Travel time isn't counted as work."}
          </Text>
          {segment.transitWindowEndsAt && !segment.transitExpired ? (
            <Text style={styles.metaLine}>
              {`We'll check in with you at ${formatClock(segment.transitWindowEndsAt)} if you haven't arrived.`}
            </Text>
          ) : null}
        </>
      ) : place ? (
        <Text style={styles.value}>
          {since ?? "—"}
          <Text style={styles.valueSub}>
            {minutesHere != null ? `  since · ${formatMinutes(minutesHere)} here` : "  since"}
          </Text>
        </Text>
      ) : null}

      {segmentMinutes ? (
        <HybridMinutesChips
          office={segmentMinutes.officeMinutes}
          home={segmentMinutes.homeMinutes}
          transit={segmentMinutes.transitMinutes}
          style={styles.chips}
        />
      ) : null}

      {showSuggestion && suggestedHeading ? (
        <View style={styles.suggestion}>
          <Icon name="navigate" size={16} color={colors.warning} />
          <View style={styles.suggestionBody}>
            <Text style={styles.suggestionTitle}>
              {suggestedHeading === "HOME" ? "Heading home?" : "Heading to the office?"}
            </Text>
            <Text style={styles.suggestionText}>
              {`Looks like you've left ${placeName(place as HybridPlace)}. Tap Switch to ${PLACE_LABEL[suggestedHeading]} if you're on your way — otherwise your time pauses after 10 minutes away.`}
            </Text>
          </View>
          <Pressable onPress={onDismissSuggestion} hitSlop={8} accessibilityLabel="Dismiss">
            <Icon name="close" size={14} color={colors.textSecondary} />
          </Pressable>
        </View>
      ) : null}

      <View style={styles.buttons}>
        {place ? (
          <Button
            label={busy ? "Switching…" : `Switch to ${PLACE_LABEL[otherPlace(place)]}`}
            icon={otherPlace(place) === "HOME" ? "home" : "navigate"}
            size="sm"
            onPress={() => setConfirm({ kind: "switch", heading: otherPlace(place) })}
            disabled={busy}
            style={styles.button}
          />
        ) : null}
        {inTransit && heading ? (
          <>
            <Button
              label={busy ? "Saving…" : "I've arrived"}
              icon="checkmark"
              size="sm"
              onPress={() => onArrive(heading)}
              disabled={busy}
              style={styles.button}
            />
            <Button
              label={`Still at ${PLACE_LABEL[otherPlace(heading)]}`}
              variant="ghost"
              size="sm"
              onPress={() => setConfirm({ kind: "correct", place: otherPlace(heading) })}
              disabled={busy}
              style={styles.button}
            />
          </>
        ) : null}
      </View>

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <BottomSheet
        visible={!!confirm}
        onClose={() => setConfirm(null)}
        kicker={confirm?.kind === "switch" ? "Switch place" : "Correct place"}
        title={
          confirm?.kind === "switch"
            ? `Switch to ${PLACE_LABEL[confirm.heading]}?`
            : confirm
              ? `Back at ${placeName(confirm.place)}?`
              : ""
        }
      >
        <Text style={styles.sheetText}>
          {confirm?.kind === "switch"
            ? `You'll be marked as travelling to ${placeName(confirm.heading)}. Travel time isn't counted as work — when you arrive you're switched to ${PLACE_LABEL[confirm.heading]} automatically (keep location on), or tap I've arrived.`
            : confirm
              ? `Ends the travel and marks you as working from ${placeName(confirm.place)} again from now.`
              : ""}
        </Text>
        <Button
          label={
            confirm?.kind === "switch"
              ? `Switch to ${PLACE_LABEL[confirm.heading]}`
              : confirm
                ? `I'm at ${PLACE_LABEL[confirm.place]}`
                : "Confirm"
          }
          onPress={runConfirm}
          style={styles.sheetButton}
        />
        <Button label="Cancel" variant="ghost" onPress={() => setConfirm(null)} />
      </BottomSheet>
    </Card>
  );
}

interface HybridArrivalPromptProps {
  heading: HybridPlace;
  onArrived: () => void;
  onStillTravelling: () => void;
  busy: boolean;
}

/** Shown when the transit window ran out (work-segment's transitExpired) —
 * the in-app side of the "Are you home yet?" push. */
export function HybridArrivalPrompt({ heading, onArrived, onStillTravelling, busy }: HybridArrivalPromptProps) {
  return (
    <Card tone="warning" style={styles.card}>
      <View style={styles.statusRow}>
        <Icon name="alert" size={16} color={colors.warning} />
        <Kicker color={colors.warning} style={styles.label}>
          Still travelling?
        </Kicker>
      </View>
      <Text style={styles.promptTitle}>{heading === "HOME" ? "Are you home yet?" : "Have you reached the office?"}</Text>
      <Text style={styles.whyLine}>
        {`Confirm you've arrived to start counting your time at ${placeName(heading)}, or tell us you're still on the way.`}
      </Text>
      <View style={styles.buttons}>
        <Button label={busy ? "Saving…" : "Arrived"} icon="checkmark" size="sm" onPress={onArrived} disabled={busy} style={styles.button} />
        <Button
          label="Still travelling"
          variant="secondary"
          size="sm"
          onPress={onStillTravelling}
          disabled={busy}
          style={styles.button}
        />
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: {},
  statusRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  dot: { width: 8, height: 8, borderRadius: 99 },
  label: { marginBottom: 0 },
  value: {
    fontSize: 22,
    lineHeight: 28,
    fontFamily: fontFamilies.display700,
    fontWeight: "700",
    color: colors.ink,
    fontVariant: ["tabular-nums"],
    marginTop: spacing.sm,
  },
  valueSub: { ...typography.caption, fontSize: 13, color: colors.textSecondary },
  whyLine: { ...typography.caption, fontSize: 12.5, lineHeight: 18, color: colors.textSecondary, marginTop: spacing.xs + 2 },
  metaLine: { ...typography.caption, fontSize: 12, color: colors.textMuted, marginTop: spacing.xs },
  chips: { marginTop: spacing.sm + 2 },
  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: spacing.xs + 2 },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingVertical: 4,
    paddingHorizontal: 9,
    borderRadius: 999,
    backgroundColor: colors.surfaceMuted,
  },
  chipDot: { width: 6, height: 6, borderRadius: 3 },
  chipLabel: { fontSize: 11.5, fontFamily: "Inter_500Medium", color: colors.textSecondary },
  chipValue: { fontSize: 11.5, fontFamily: "Inter_600SemiBold", fontWeight: "600", color: colors.ink, fontVariant: ["tabular-nums"] },
  suggestion: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: spacing.sm,
    backgroundColor: colors.warningMuted,
    borderRadius: radius.input,
    padding: spacing.sm + 2,
    marginTop: spacing.sm + 2,
  },
  suggestionBody: { flex: 1 },
  suggestionTitle: { ...typography.bodyStrong, fontSize: 14, color: colors.warning },
  suggestionText: { ...typography.caption, fontSize: 12.5, lineHeight: 18, color: colors.textSecondary, marginTop: 2 },
  buttons: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm, marginTop: spacing.sm + 4 },
  button: { alignSelf: "flex-start" },
  error: { ...typography.caption, color: colors.danger, marginTop: spacing.sm },
  promptTitle: { ...typography.section, color: colors.ink, marginTop: spacing.sm },
  sheetText: { ...typography.body, lineHeight: 22, color: colors.textSecondary, marginTop: spacing.sm, marginBottom: spacing.md },
  sheetButton: { marginBottom: spacing.xs },
});
