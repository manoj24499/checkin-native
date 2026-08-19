import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useNavigation } from "@react-navigation/native";
import { Screen, Button } from "@/components/ui";
import { TimeSlotPicker, formatSlotLabel } from "@/components/checkin";
import { useRequestTimedPermission } from "@/hooks";
import { getErrorMessage } from "@/utils/errors";
import { colors, spacing, typography } from "@/theme";

/** Combines an "HH:mm" slot with today's calendar date, in local time. */
function combineTodayAndSlot(hhmm: string): Date {
  const [h, m] = hhmm.split(":").map(Number);
  const d = new Date();
  d.setHours(h, m, 0, 0);
  return d;
}

export function RequestTimedPermissionScreen() {
  const navigation = useNavigation();
  const { mutateAsync, isPending } = useRequestTimedPermission();
  const [startSlot, setStartSlot] = useState<string | null>(null);
  const [endSlot, setEndSlot] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const canSubmit = !!startSlot && !!endSlot && endSlot > startSlot;

  const handleChangeStart = (slot: string) => {
    setStartSlot(slot);
    // An already-picked end time earlier than the new start no longer makes
    // sense — clear it rather than leaving an invalid combination selected.
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
      setSuccess(true);
    } catch (error) {
      setSubmitError(getErrorMessage(error, "Couldn't submit your request. Please try again."));
    }
  };

  if (success && startSlot && endSlot) {
    return (
      <Screen contentStyle={styles.content}>
        <Text style={styles.title}>Permission requested</Text>
        <Text style={styles.subtitle}>
          Your work time will pause from {formatSlotLabel(startSlot)} to {formatSlotLabel(endSlot)}. If you're
          not back in range by then, the pause will simply continue until you are.
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
        <Text style={styles.title}>Request permission</Text>
        <Text style={styles.subtitle}>
          Pause your work time for a window today — e.g. 2:00 PM to 4:00 PM. It takes effect immediately, no
          approval needed.
        </Text>
      </View>

      <View style={styles.pickerBlock}>
        <TimeSlotPicker label="FROM" value={startSlot} onChange={handleChangeStart} />
      </View>
      <View style={styles.pickerBlock}>
        <TimeSlotPicker label="TO" value={endSlot} onChange={setEndSlot} disabledAtOrBefore={startSlot} />
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
  error: { ...typography.caption, color: colors.danger, marginBottom: spacing.md },
  submit: { marginTop: spacing.sm },
});
