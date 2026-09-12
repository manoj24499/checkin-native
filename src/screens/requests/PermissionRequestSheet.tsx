import { useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { Button, IssueDialog } from "@/components/ui";
import { TimeSlotPicker } from "@/components/checkin";
import { useRequestTimedPermission } from "@/hooks";
import { getErrorMessage, isNetworkError } from "@/utils/errors";
import { colors, spacing, typography } from "@/theme";

/** Combines an "HH:mm" slot with today's calendar date, in local time. */
function combineTodayAndSlot(hhmm: string): Date {
  const [h, m] = hhmm.split(":").map(Number);
  const d = new Date();
  d.setHours(h, m, 0, 0);
  return d;
}

/** Form body for the "New permission window" sheet — adapted from the old
 * full-screen RequestTimedPermissionScreen as part of the Requests-tab
 * consolidation. */
export function PermissionRequestSheet({ onDone }: { onDone: () => void }) {
  const { mutateAsync, isPending } = useRequestTimedPermission();
  const [startSlot, setStartSlot] = useState<string | null>(null);
  const [endSlot, setEndSlot] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<unknown>(null);

  const canSubmit = !!startSlot && !!endSlot && endSlot > startSlot;

  const handleChangeStart = (slot: string) => {
    setStartSlot(slot);
    if (endSlot && endSlot <= slot) setEndSlot(null);
  };

  const onSubmit = async () => {
    if (!startSlot || !endSlot) return;
    setSubmitError(null);
    try {
      await mutateAsync({
        startTime: combineTodayAndSlot(startSlot).toISOString(),
        endTime: combineTodayAndSlot(endSlot).toISOString(),
      });
      onDone();
    } catch (error) {
      setSubmitError(error);
    }
  };

  return (
    <View>
      <Text style={styles.blurb}>
        Your clock stops between these two times, so the gap reads as agreed time out — not as you gone missing.
        Takes effect immediately, no approval needed.
      </Text>

      <View style={styles.pickerBlock}>
        <TimeSlotPicker label="FROM" value={startSlot} onChange={handleChangeStart} />
      </View>
      <View style={styles.pickerBlock}>
        <TimeSlotPicker label="BACK BY" value={endSlot} onChange={setEndSlot} disabledAtOrBefore={startSlot} />
      </View>

      <Button
        label="Start permission window"
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
  submit: { marginTop: spacing.lg },
});
