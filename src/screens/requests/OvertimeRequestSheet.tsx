import { useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { Button, TextField, IssueDialog } from "@/components/ui";
import { TimeSlotPicker, formatSlotLabel } from "@/components/checkin";
import { useAuth, useAttendanceStatus, useRequestOvertime } from "@/hooks";
import { getErrorMessage, isNetworkError } from "@/utils/errors";
import { colors, fontFamilies, spacing, typography } from "@/theme";

const toMin = (hhmm: string) => {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
};
const toSlot = (min: number) => `${String(Math.floor(min / 60)).padStart(2, "0")}:${String(min % 60).padStart(2, "0")}`;

/** The working day an overtime request belongs to. Before 6 AM the employee is still on the previous
 * evening's day (an after-midnight session), so slots like "26:00" (= 2 AM) land on the right night. */
function workdayStart(now = new Date()): Date {
  const d = new Date(now);
  d.setHours(0, 0, 0, 0);
  if (now.getHours() < 6) d.setDate(d.getDate() - 1);
  return d;
}

/** "HH:mm" slot (hours may run past 24 for after-midnight times) on that working day, in local time. */
function slotToDate(hhmm: string, dayStart: Date): Date {
  return new Date(dayStart.getTime() + toMin(hhmm) * 60_000);
}

/** Form body for the "Request overtime" sheet — adapted from the old
 * full-screen RequestOvertimeScreen. Reachable from the Requests tab
 * regardless of check-in state now (not just from Dashboard while checked
 * in), but `useAttendanceStatus` is always enabled once an employee code
 * exists, so `shiftEndTime` is available either way. */
export function OvertimeRequestSheet({ onDone }: { onDone: () => void }) {
  const { user } = useAuth();
  const statusQuery = useAttendanceStatus(user?.employeeCode);
  const shiftEndTime = statusQuery.data?.exists ? statusQuery.data.shiftEndTime : null;
  const shiftStartTime = statusQuery.data?.exists ? statusQuery.data.shiftStartTime : null;
  // A night shift ends the next calendar day (end <= start, e.g. 18:00 -> 02:00), so its end counts as 24h+.
  const overnightShift = !!shiftStartTime && !!shiftEndTime && toMin(shiftEndTime) <= toMin(shiftStartTime);
  const dayStart = workdayStart();
  // Slots at or before this are disabled: the shift end, or right now if that is later.
  const earliestMin = Math.max(
    shiftEndTime ? toMin(shiftEndTime) + (overnightShift ? 1440 : 0) : 0,
    Math.floor((Date.now() - dayStart.getTime()) / 60_000),
  );
  const { mutateAsync, isPending } = useRequestOvertime();
  const [endSlot, setEndSlot] = useState<string | null>(null);
  const [reason, setReason] = useState("");
  const [submitError, setSubmitError] = useState<unknown>(null);

  const canSubmit = !!endSlot && reason.trim().length > 0;

  const onSubmit = async () => {
    if (!endSlot || !reason.trim()) return;
    setSubmitError(null);
    try {
      await mutateAsync({
        estimatedEndAt: slotToDate(endSlot, workdayStart()).toISOString(),
        reason: reason.trim(),
      });
      onDone();
    } catch (error) {
      setSubmitError(error);
    }
  };

  return (
    <View>
      <Text style={styles.blurb}>
        Tell us roughly when you'll finish. Your check-out reminder moves to that time instead of your shift end.
      </Text>

      <View style={styles.pickerBlock}>
        <TimeSlotPicker
          label="UNTIL ABOUT"
          value={endSlot}
          onChange={setEndSlot}
          disabledAtOrBefore={toSlot(earliestMin)}
          allowOvernight
        />
        {shiftEndTime ? (
          <Text style={styles.pickerHint}>
            Only times after your shift ends ({formatSlotLabel(shiftEndTime)}) are selectable.
          </Text>
        ) : null}
      </View>

      <View style={styles.reasonBlock}>
        <TextField
          label="WHAT'S IT FOR?"
          placeholder="e.g. Urgent release fix"
          value={reason}
          onChangeText={setReason}
          multiline
        />
      </View>

      <Button
        label="Log overtime"
        onPress={onSubmit}
        loading={isPending}
        disabled={!canSubmit}
        pulse={canSubmit}
        style={styles.submit}
      />

      <IssueDialog
        visible={!!submitError}
        kicker={isNetworkError(submitError) ? "NO CONNECTION" : "REQUEST NOT SENT"}
        title={isNetworkError(submitError) ? "You're offline" : "Couldn't submit your request"}
        body={getErrorMessage(submitError, "Couldn't submit your request. Please try again.")}
        primaryLabel="Dismiss"
        onPrimary={() => setSubmitError(null)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  blurb: { ...typography.caption, lineHeight: 19, color: colors.textSecondary, marginTop: spacing.sm },
  pickerBlock: { marginTop: spacing.md + 4 },
  pickerHint: { fontSize: 12.5, lineHeight: 17, fontFamily: fontFamilies.regular, color: colors.textSecondary, marginTop: spacing.sm },
  reasonBlock: { marginTop: spacing.md + 4 },
  submit: { marginTop: spacing.lg },
});
