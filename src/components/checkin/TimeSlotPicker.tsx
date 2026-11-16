import { ScrollView, StyleSheet, Text, View } from "react-native";
import { Chip } from "@/components/ui";
import { colors, spacing, typography } from "@/theme";

// "HH:mm", 24-hour, matching Shift.startTime/endTime's format on the backend.
const SLOT_START_MINUTES = 6 * 60; // 06:00
const SLOT_END_MINUTES = 22 * 60; // 22:00
const SLOT_STEP_MINUTES = 30;

/** Slots from 06:00 up to `endMinutes`. Past 24:00 the hour keeps counting ("25:00" = 1:00 AM the next day),
 * so overtime that runs past midnight can be picked and still sorts after the evening slots. */
function buildSlots(endMinutes: number): string[] {
  return Array.from({ length: (endMinutes - SLOT_START_MINUTES) / SLOT_STEP_MINUTES + 1 }, (_, i) => {
    const total = SLOT_START_MINUTES + i * SLOT_STEP_MINUTES;
    return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
  });
}
const DEFAULT_SLOTS = buildSlots(SLOT_END_MINUTES);
/** Overtime can run until 6 AM the next day. */
const OVERNIGHT_END_MINUTES = 30 * 60;
const OVERNIGHT_SLOTS = buildSlots(OVERNIGHT_END_MINUTES);

/** "14:30" -> "2:30 PM" */
export function formatSlotLabel(hhmm: string): string {
  const [rawH, m] = hhmm.split(":").map(Number);
  const h = rawH % 24;
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
  /** Also offer slots after midnight (up to 6:00 AM the next day), labelled "next day". */
  allowOvernight?: boolean;
}

/** Horizontal row of time-slot chips (kit `Chip`: selected = orange gradient, dark label). */
export function TimeSlotPicker({ label, value, onChange, disabledAtOrBefore, allowOvernight }: TimeSlotPickerProps) {
  return (
    <View>
      <Text style={styles.label}>{label}</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
        {(allowOvernight ? OVERNIGHT_SLOTS : DEFAULT_SLOTS).map((slot) => {
          const disabled = !!disabledAtOrBefore && slot <= disabledAtOrBefore;
          return (
            <Chip
              key={slot}
              label={Number(slot.slice(0, 2)) >= 24 ? `${formatSlotLabel(slot)} (next day)` : formatSlotLabel(slot)}
              selected={slot === value}
              disabled={disabled}
              onPress={() => onChange(slot)}
            />
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  label: { ...typography.kicker, color: colors.kicker, marginBottom: spacing.sm },
  row: { flexDirection: "row", gap: spacing.sm - 2, paddingVertical: 2 },
});
