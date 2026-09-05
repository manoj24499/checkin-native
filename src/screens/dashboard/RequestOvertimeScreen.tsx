import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useNavigation } from "@react-navigation/native";
import { Screen, Button, TextField } from "@/components/ui";
import { TimeSlotPicker, formatSlotLabel } from "@/components/checkin";
import { useRequestOvertime } from "@/hooks";
import { getErrorMessage } from "@/utils/errors";
import { colors, spacing, typography } from "@/theme";

/** Combines an "HH:mm" slot with today's calendar date, in local time — same
 * convention as RequestTimedPermissionScreen. */
function combineTodayAndSlot(hhmm: string): Date {
  const [h, m] = hhmm.split(":").map(Number);
  const d = new Date();
  d.setHours(h, m, 0, 0);
  return d;
}

export function RequestOvertimeScreen() {
  const navigation = useNavigation();
  const { mutateAsync, isPending } = useRequestOvertime();
  const [endSlot, setEndSlot] = useState<string | null>(null);
  const [reason, setReason] = useState("");
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const canSubmit = !!endSlot && reason.trim().length > 0;

  const onSubmit = async () => {
    if (!endSlot || !reason.trim()) return;
    setSubmitError(null);
    try {
      await mutateAsync({
        estimatedEndAt: combineTodayAndSlot(endSlot).toISOString(),
        reason: reason.trim(),
      });
      setSuccess(true);
    } catch (error) {
      setSubmitError(getErrorMessage(error, "Couldn't submit your request. Please try again."));
    }
  };

  if (success && endSlot) {
    return (
      <Screen contentStyle={styles.content}>
        <Text style={styles.title}>Overtime requested</Text>
        <Text style={styles.subtitle}>
          You're set until around {formatSlotLabel(endSlot)}. We'll remind you ~10 minutes before then — and
          you can log what you worked on when you check out.
        </Text>
        <Button label="Done" onPress={() => navigation.goBack()} style={styles.submit} />
      </Screen>
    );
  }

  return (
    <Screen scroll contentStyle={styles.content}>
      <Pressable onPress={() => navigation.goBack()} style={styles.closeButton} hitSlop={12}>
        <Text style={styles.closeGlyph}>✕</Text>
      </Pressable>

      <View style={styles.header}>
        <Text style={styles.title}>Request overtime</Text>
        <Text style={styles.subtitle}>
          Staying past your normal shift end? It takes effect immediately, no approval needed — your admin
          will still review it for their records.
        </Text>
      </View>

      <View style={styles.pickerBlock}>
        <TimeSlotPicker label="UNTIL ABOUT" value={endSlot} onChange={setEndSlot} />
      </View>

      <View style={styles.reasonBlock}>
        <TextField
          label="What's the overtime for?"
          placeholder="e.g. Urgent release fix"
          value={reason}
          onChangeText={setReason}
          multiline
        />
      </View>

      {submitError ? <Text style={styles.error}>{submitError}</Text> : null}

      <Button
        label="Submit request"
        onPress={onSubmit}
        loading={isPending}
        disabled={!canSubmit}
        style={styles.submit}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { flexGrow: 1 },
  closeButton: {
    alignSelf: "flex-end",
    width: 34,
    height: 34,
    borderRadius: 99,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: spacing.md,
  },
  closeGlyph: { color: colors.textSecondary, fontSize: 15 },
  header: { marginBottom: spacing.xl },
  title: { ...typography.h1, color: colors.textPrimary, marginBottom: spacing.xs },
  subtitle: { ...typography.body, color: colors.textSecondary },
  pickerBlock: { marginBottom: spacing.lg },
  reasonBlock: { marginBottom: spacing.lg },
  error: { ...typography.caption, color: colors.danger, marginBottom: spacing.md },
  submit: { marginTop: spacing.sm },
});
