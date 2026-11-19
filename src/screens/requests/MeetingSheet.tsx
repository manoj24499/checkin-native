import { useMemo, useState } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { Button, Chip, TextField, IssueDialog } from "@/components/ui";
import { TimeSlotPicker, formatSlotLabel } from "@/components/checkin";
import { useAuth, useAttendanceStatus, useAddMeeting } from "@/hooks";
import { getErrorMessage, isNetworkError } from "@/utils/errors";
import { colors, fontFamilies, spacing, typography } from "@/theme";

const toMin = (hhmm: string) => {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
};

/** Midnight (local time) of today plus `offset` days. */
function dayStart(offset: number): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + offset);
  return d;
}

/** "HH:mm" (hours may run past 24 for after-midnight times) on the given day, in local time. */
function slotToDate(hhmm: string, day: Date): Date {
  return new Date(day.getTime() + toMin(hhmm) * 60_000);
}

const DAY_COUNT = 7;

/** Form body for the "Add a meeting" sheet. A meeting before or after the shift is added here and takes effect at
 * once; the admin is only notified. One that sits inside the shift needs nothing, and is refused. */
export function MeetingSheet({ onDone }: { onDone: () => void }) {
  const { user } = useAuth();
  const statusQuery = useAttendanceStatus(user?.employeeCode);
  const shiftStart = statusQuery.data?.exists ? statusQuery.data.shiftStartTime : null;
  const shiftEnd = statusQuery.data?.exists ? statusQuery.data.shiftEndTime : null;

  const { mutateAsync, isPending } = useAddMeeting();
  const [dayOffset, setDayOffset] = useState(0);
  const [startSlot, setStartSlot] = useState<string | null>(null);
  const [endSlot, setEndSlot] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [submitError, setSubmitError] = useState<unknown>(null);

  const days = useMemo(
    () =>
      Array.from({ length: DAY_COUNT }, (_, i) => {
        const d = dayStart(i);
        const label = i === 0 ? "Today" : i === 1 ? "Tomorrow" : d.toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short" });
        return { offset: i, label };
      }),
    [],
  );

  // The shift times the app knows are today's, so the "this is during your shift" hint only applies to today;
  // for other days the server makes the call.
  const insideShift = useMemo(() => {
    if (dayOffset !== 0 || !startSlot || !endSlot || !shiftStart || !shiftEnd) return false;
    const overnight = toMin(shiftEnd) <= toMin(shiftStart);
    const sStart = toMin(shiftStart);
    const sEnd = toMin(shiftEnd) + (overnight ? 1440 : 0);
    return toMin(startSlot) >= sStart && toMin(endSlot) <= sEnd;
  }, [dayOffset, startSlot, endSlot, shiftStart, shiftEnd]);

  const canSubmit = !!startSlot && !!endSlot && title.trim().length > 0 && !insideShift;

  const onSubmit = async () => {
    if (!startSlot || !endSlot || !title.trim()) return;
    setSubmitError(null);
    const day = dayStart(dayOffset);
    try {
      await mutateAsync({
        title: title.trim(),
        startAt: slotToDate(startSlot, day).toISOString(),
        endAt: slotToDate(endSlot, day).toISOString(),
      });
      onDone();
    } catch (error) {
      setSubmitError(error);
    }
  };

  return (
    <View>
      <Text style={styles.blurb}>
        Add a meeting that is before or after your shift. No approval needed: your admin is just told. You won't be
        reminded to check out, or checked out automatically, while it runs.
      </Text>

      <View style={styles.block}>
        <Text style={styles.label}>DAY</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
          {days.map((d) => (
            <Chip key={d.offset} label={d.label} selected={d.offset === dayOffset} onPress={() => setDayOffset(d.offset)} />
          ))}
        </ScrollView>
      </View>

      <View style={styles.block}>
        <TimeSlotPicker label="STARTS" value={startSlot} onChange={setStartSlot} allowOvernight />
      </View>
      <View style={styles.block}>
        <TimeSlotPicker label="ENDS" value={endSlot} onChange={setEndSlot} disabledAtOrBefore={startSlot} allowOvernight />
        {shiftStart && shiftEnd && dayOffset === 0 ? (
          <Text style={styles.hint}>
            Your shift today is {formatSlotLabel(shiftStart)} to {formatSlotLabel(shiftEnd)}. Meetings inside it don't need adding.
          </Text>
        ) : null}
        {insideShift ? <Text style={styles.warn}>This is during your shift, so there's nothing to add.</Text> : null}
      </View>

      <View style={styles.block}>
        <TextField label="MEETING" placeholder="e.g. Client call, team sync" value={title} onChangeText={setTitle} />
      </View>

      <Button
        label="Add meeting"
        onPress={onSubmit}
        loading={isPending}
        disabled={!canSubmit}
        pulse={canSubmit}
        style={styles.submit}
      />

      <IssueDialog
        visible={!!submitError}
        kicker={isNetworkError(submitError) ? "NO CONNECTION" : "MEETING NOT ADDED"}
        title={isNetworkError(submitError) ? "You're offline" : "Couldn't add the meeting"}
        body={getErrorMessage(submitError, "Couldn't add the meeting. Please try again.")}
        primaryLabel="Dismiss"
        onPrimary={() => setSubmitError(null)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  blurb: { ...typography.caption, lineHeight: 19, color: colors.textSecondary, marginTop: spacing.sm },
  block: { marginTop: spacing.md + 4 },
  label: { ...typography.statLabel, color: colors.textSecondary, marginBottom: spacing.sm },
  row: { gap: spacing.sm },
  hint: { fontSize: 12.5, lineHeight: 17, fontFamily: fontFamilies.regular, color: colors.textSecondary, marginTop: spacing.sm },
  warn: { fontSize: 12.5, lineHeight: 17, fontFamily: fontFamilies.medium, color: colors.danger, marginTop: spacing.sm },
  submit: { marginTop: spacing.lg },
});
