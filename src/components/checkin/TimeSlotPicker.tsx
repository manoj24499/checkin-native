import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { colors, radius, spacing, typography } from "@/theme";

// "HH:mm", 24-hour, matching Shift.startTime/endTime's format on the backend.
const SLOT_START_MINUTES = 6 * 60; // 06:00
const SLOT_END_MINUTES = 22 * 60; // 22:00
const SLOT_STEP_MINUTES = 30;

const SLOTS = Array.from(
  { length: (SLOT_END_MINUTES - SLOT_START_MINUTES) / SLOT_STEP_MINUTES + 1 },
  (_, i) => {
    const total = SLOT_START_MINUTES + i * SLOT_STEP_MINUTES;
    return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
  },
);

/** "14:30" -> "2:30 PM" */
export function formatSlotLabel(hhmm: string): string {
  const [h, m] = hhmm.split(":").map(Number);
  const period = h < 12 ? "AM" : "PM";
  const hour12 = h % 12 === 0 ? 12 : h % 12;
  return `${hour12}:${String(m).padStart(2, "0")} ${period}`;
}

interface TimeSlotPickerProps {
  label: string;
  value: string | null;
  onChange: (value: string) => void;
  /** Slots at or before this "HH:mm" are disabled — used on the "TO" picker
   * so an end time earlier than the chosen start can't be selected at all. */
  disabledAtOrBefore?: string | null;
}

export function TimeSlotPicker({ label, value, onChange, disabledAtOrBefore }: TimeSlotPickerProps) {
  return (
    <View>
      <Text style={styles.label}>{label}</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
        {SLOTS.map((slot) => {
          const disabled = !!disabledAtOrBefore && slot <= disabledAtOrBefore;
          const selected = slot === value;
          return (
            <Pressable
              key={slot}
              disabled={disabled}
              onPress={() => onChange(slot)}
              style={[styles.chip, selected && styles.chipSelected, disabled && styles.chipDisabled]}
            >
              <Text
                style={[
                  styles.chipLabel,
                  selected && styles.chipLabelSelected,
                  disabled && styles.chipLabelDisabled,
                ]}
              >
                {formatSlotLabel(slot)}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  label: { fontSize: 9, letterSpacing: 1.5, color: colors.textMuted, fontWeight: "600", marginBottom: spacing.sm },
  row: { flexDirection: "row", gap: spacing.xs + 2, paddingVertical: 2 },
  chip: {
    paddingHorizontal: spacing.sm + 4,
    paddingVertical: spacing.sm,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  chipSelected: { borderColor: colors.primary, backgroundColor: colors.primaryMuted },
  chipDisabled: { opacity: 0.35 },
  chipLabel: { ...typography.bodyStrong, fontSize: 13, color: colors.textSecondary },
  chipLabelSelected: { color: colors.primary },
  chipLabelDisabled: { color: colors.textMuted },
});
