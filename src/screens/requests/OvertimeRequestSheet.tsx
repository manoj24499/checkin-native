import { useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { Button, TextField, IssueDialog } from "@/components/ui";
import { TimeSlotPicker, formatSlotLabel } from "@/components/checkin";
import { useAuth, useAttendanceStatus, useRequestOvertime } from "@/hooks";
import { getErrorMessage, isNetworkError } from "@/utils/errors";
import { colors, spacing, typography } from "@/theme";

/** Combines an "HH:mm" slot with today's calendar date, in local time — same
 * convention as PermissionRequestSheet. */
function combineTodayAndSlot(hhmm: string): Date {
  const [h, m] = hhmm.split(":").map(Number);
  const d = new Date();
  d.setHours(h, m, 0, 0);
  return d;
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
        estimatedEndAt: combineTodayAndSlot(endSlot).toISOString(),
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
          disabledAtOrBefore={shiftEndTime}
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
  blurb: { ...typography.body, color: colors.textSecondary },
  pickerBlock: { marginTop: spacing.lg },
  pickerHint: { ...typography.caption, color: colors.textSecondary, marginTop: spacing.sm },
  reasonBlock: { marginTop: spacing.lg },
  submit: { marginTop: spacing.lg },
});
