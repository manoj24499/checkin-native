import { useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Button, TextField, IssueDialog } from "@/components/ui";
import { DayChipPicker } from "@/components/leave";
import { useHolidays, useLeaveRequests, useRequestLeave } from "@/hooks";
import { getErrorMessage, isNetworkError } from "@/utils/errors";
import { colors, radius, spacing, typography } from "@/theme";
import type { TimeOffType } from "@/types";

const TYPE_OPTIONS: { value: TimeOffType; label: string }[] = [
  { value: "CASUAL", label: "Casual" },
  { value: "SICK", label: "Sick" },
  { value: "EARNED", label: "Earned" },
];

function toDateKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
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

/** Form body for the "Request leave" sheet — moved here from the old
 * full-screen RequestLeaveScreen (still adapted, not deleted, per the
 * migration plan) as part of consolidating Leave/Permission/Overtime into
 * one Requests tab. Adds the balance-exceeded block RequestLeaveScreen never
 * had (a plain inline error for now — Phase 3's issue dialog upgrades this
 * without redoing the check itself). */
export function LeaveRequestSheet({ onDone }: { onDone: () => void }) {
  const { mutateAsync, isPending } = useRequestLeave();
  const holidaysQuery = useHolidays();
  const balancesQuery = useLeaveRequests();

  const [type, setType] = useState<TimeOffType>("CASUAL");
  const [startDay, setStartDay] = useState<string | null>(null);
  const [endDay, setEndDay] = useState<string | null>(null);
  const [reason, setReason] = useState("");
  const [submitError, setSubmitError] = useState<unknown>(null);

  const holidayDates = useMemo(
    () => new Set((holidaysQuery.data ?? []).map((h) => toDateKey(new Date(h.date)))),
    [holidaysQuery.data],
  );

  const balance = balancesQuery.data?.balances.find((b) => b.type === type);
  const days = startDay && endDay ? previewDays(startDay, endDay, holidayDates) : 0;
  const exceedsBalance = !!balance && days > balance.remaining;
  const canSubmit = !!startDay && !!endDay && days > 0 && !exceedsBalance;

  const handleChangeStart = (day: string) => {
    setStartDay(day);
    if (endDay && endDay < day) setEndDay(null);
  };

  const onSubmit = async () => {
    if (!startDay || !endDay || !canSubmit) return;
    setSubmitError(null);
    try {
      await mutateAsync({
        type,
        // Plain "YYYY-MM-DD" — see the original screen's comment on why this
        // must not round-trip through .toISOString().
        startDate: startDay,
        endDate: endDay,
        reason: reason.trim() || undefined,
      });
      onDone();
    } catch (error) {
      setSubmitError(error);
    }
  };

  return (
    <View>
      <Text style={styles.blurb}>Pick a type and the days. Public holidays in the range aren't deducted.</Text>

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
          {balance.remaining} of {balance.quota} {type.toLowerCase()} day(s) remaining this year
        </Text>
      ) : null}

      <View style={styles.pickerBlock}>
        <DayChipPicker label="FIRST DAY" value={startDay} onChange={handleChangeStart} holidayDates={holidayDates} />
      </View>
      <View style={styles.pickerBlock}>
        <DayChipPicker
          label="LAST DAY"
          value={endDay}
          onChange={setEndDay}
          disabledBefore={startDay}
          holidayDates={holidayDates}
        />
      </View>

      {startDay && endDay ? (
        <Text style={exceedsBalance ? styles.daysPreviewWarn : styles.daysPreview}>
          {days === 0
            ? "Every day in this range is a public holiday — nothing to request."
            : exceedsBalance
              ? `${days} days requested, but only ${balance?.remaining ?? 0} ${type.toLowerCase()} day(s) remain — shorten the range or switch type.`
              : `${days} day${days === 1 ? "" : "s"} deducted from your ${type.toLowerCase()} balance. Holidays excluded.`}
        </Text>
      ) : null}

      <View style={styles.reasonBlock}>
        <TextField
          label="REASON · OPTIONAL"
          placeholder="e.g. Family function"
          value={reason}
          onChangeText={setReason}
          multiline
        />
      </View>

      <Button
        label="Submit for approval"
        onPress={onSubmit}
        loading={isPending}
        disabled={!canSubmit}
        style={styles.submit}
      />

      <IssueDialog
        visible={!!submitError}
        kicker={isNetworkError(submitError) ? "NO CONNECTION" : "REQUEST NOT SENT"}
        title={isNetworkError(submitError) ? "You're offline" : "Couldn't submit your request"}
        body={getErrorMessage(submitError, "Couldn't submit your leave request. Please try again.")}
        primaryLabel="Dismiss"
        onPrimary={() => setSubmitError(null)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  blurb: { ...typography.body, color: colors.textSecondary },
  typeRow: { flexDirection: "row", gap: spacing.sm, marginTop: spacing.md },
  typeChip: {
    flex: 1,
    paddingVertical: spacing.sm + 2,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    alignItems: "center",
  },
  typeChipActive: { borderColor: colors.primary, backgroundColor: colors.primaryMuted },
  typeChipLabel: { ...typography.bodyStrong, fontSize: 13, color: colors.textSecondary },
  typeChipLabelActive: { color: colors.primaryDark },
  balanceHint: { ...typography.caption, color: colors.textSecondary, marginTop: spacing.sm },
  pickerBlock: { marginTop: spacing.lg },
  daysPreview: { ...typography.caption, color: colors.primaryDark, marginTop: spacing.sm },
  daysPreviewWarn: { ...typography.caption, color: colors.danger, marginTop: spacing.sm },
  reasonBlock: { marginTop: spacing.lg },
  submit: { marginTop: spacing.lg },
});
