import { useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useNavigation } from "@react-navigation/native";
import { Screen, Button, TextField } from "@/components/ui";
import { DayChipPicker, formatDayLabel } from "@/components/leave";
import { useHolidays, useLeaveRequests, useRequestLeave } from "@/hooks";
import { getErrorMessage } from "@/utils/errors";
import { colors, spacing, typography } from "@/theme";
import type { TimeOffType } from "@/types";

const TYPE_OPTIONS: { value: TimeOffType; label: string }[] = [
  { value: "CASUAL", label: "Casual" },
  { value: "SICK", label: "Sick" },
  { value: "EARNED", label: "Earned" },
];

function toDateKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** "YYYY-MM-DD" -> local midnight on that date, as a real Date — so
 * .toISOString() converts correctly instead of assuming the device's local
 * midnight coincides with UTC midnight. */
function dateKeyToLocalMidnight(dateKey: string): Date {
  const [year, month, day] = dateKey.split("-").map(Number);
  return new Date(year, month - 1, day, 0, 0, 0, 0);
}

/** Calendar days in [start, end] minus holiday dates — a client-side preview
 * only; the server recomputes and snapshots the real count on submit. */
function previewDays(start: string, end: string, holidayDates: Set<string>): number {
  const startDate = new Date(`${start}T00:00:00`);
  const endDate = new Date(`${end}T00:00:00`);
  let count = 0;
  for (const d = new Date(startDate); d.getTime() <= endDate.getTime(); d.setDate(d.getDate() + 1)) {
    if (!holidayDates.has(toDateKey(d))) count++;
  }
  return count;
}

export function RequestLeaveScreen() {
  const navigation = useNavigation();
  const { mutateAsync, isPending } = useRequestLeave();
  const holidaysQuery = useHolidays();
  const balancesQuery = useLeaveRequests();

  const [type, setType] = useState<TimeOffType>("CASUAL");
  const [startDay, setStartDay] = useState<string | null>(null);
  const [endDay, setEndDay] = useState<string | null>(null);
  const [reason, setReason] = useState("");
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const holidayDates = useMemo(
    () => new Set((holidaysQuery.data ?? []).map((h) => toDateKey(new Date(h.date)))),
    [holidaysQuery.data],
  );

  const balance = balancesQuery.data?.balances.find((b) => b.type === type);

  const days = startDay && endDay ? previewDays(startDay, endDay, holidayDates) : 0;
  const canSubmit = !!startDay && !!endDay && days > 0;

  const handleChangeStart = (day: string) => {
    setStartDay(day);
    if (endDay && endDay < day) setEndDay(null);
  };

  const onSubmit = async () => {
    if (!startDay || !endDay) return;
    setSubmitError(null);
    try {
      await mutateAsync({
        type,
        startDate: dateKeyToLocalMidnight(startDay).toISOString(),
        endDate: dateKeyToLocalMidnight(endDay).toISOString(),
        reason: reason.trim() || undefined,
      });
      setSuccess(true);
    } catch (error) {
      setSubmitError(getErrorMessage(error, "Couldn't submit your leave request. Please try again."));
    }
  };

  if (success && startDay && endDay) {
    return (
      <Screen contentStyle={styles.content}>
        <Text style={styles.title}>Leave requested</Text>
        <Text style={styles.subtitle}>
          {formatDayLabel(startDay)} – {formatDayLabel(endDay)} ({days} day{days === 1 ? "" : "s"}), pending
          admin approval.
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
        <Text style={styles.title}>Request leave</Text>
        <Text style={styles.subtitle}>Pick a leave type and date range. An admin needs to approve it.</Text>
      </View>

      <View style={styles.typeRow}>
        {TYPE_OPTIONS.map((opt) => (
          <Pressable
            key={opt.value}
            onPress={() => setType(opt.value)}
            style={[styles.typeChip, type === opt.value && styles.typeChipActive]}
          >
            <Text style={[styles.typeChipLabel, type === opt.value && styles.typeChipLabelActive]}>
              {opt.label}
            </Text>
          </Pressable>
        ))}
      </View>
      {balance ? (
        <Text style={styles.balanceHint}>
          {balance.remaining} of {balance.quota} {opt(type)} day(s) remaining this year
        </Text>
      ) : null}

      <View style={styles.pickerBlock}>
        <DayChipPicker label="FROM" value={startDay} onChange={handleChangeStart} holidayDates={holidayDates} />
      </View>
      <View style={styles.pickerBlock}>
        <DayChipPicker
          label="TO"
          value={endDay}
          onChange={setEndDay}
          disabledBefore={startDay}
          holidayDates={holidayDates}
        />
      </View>

      {startDay && endDay ? (
        <Text style={styles.daysPreview}>
          {days === 0
            ? "Every day in this range is a public holiday — nothing to request."
            : `${days} day${days === 1 ? "" : "s"} (holidays excluded)`}
        </Text>
      ) : null}

      <View style={styles.reasonBlock}>
        <TextField
          label="Reason (optional)"
          placeholder="e.g. Family function"
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

function opt(type: TimeOffType) {
  return type.toLowerCase();
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
  header: { marginBottom: spacing.lg },
  title: { ...typography.h1, color: colors.textPrimary, marginBottom: spacing.xs },
  subtitle: { ...typography.body, color: colors.textSecondary },
  typeRow: { flexDirection: "row", gap: spacing.sm },
  typeChip: {
    flex: 1,
    paddingVertical: spacing.sm + 2,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    alignItems: "center",
  },
  typeChipActive: { borderColor: colors.primary, backgroundColor: colors.primaryMuted },
  typeChipLabel: { ...typography.bodyStrong, fontSize: 13, color: colors.textSecondary },
  typeChipLabelActive: { color: colors.primary },
  balanceHint: { ...typography.caption, color: colors.textSecondary, marginTop: spacing.sm },
  pickerBlock: { marginTop: spacing.lg },
  daysPreview: { ...typography.caption, color: colors.textSecondary, marginTop: spacing.sm },
  reasonBlock: { marginTop: spacing.lg },
  error: { ...typography.caption, color: colors.danger, marginTop: spacing.md },
  submit: { marginTop: spacing.lg },
});
