import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { colors, fontFamilies, gradientDirection, gradients, radius, spacing, typography } from "@/theme";

const DAYS_AHEAD = 30;

/** "YYYY-MM-DD" in local time — lexicographically comparable, which is all
 * the disabled-range logic below needs. */
function toDateKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function generateDayKeys(count: number): string[] {
  const days: string[] = [];
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  for (let i = 0; i < count; i++) {
    days.push(toDateKey(d));
    d.setDate(d.getDate() + 1);
  }
  return days;
}

export function formatDayLabel(dateKey: string): string {
  const d = new Date(`${dateKey}T00:00:00`);
  return d.toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short" });
}

interface DayChipPickerProps {
  label: string;
  value: string | null;
  onChange: (value: string) => void;
  /** Days before this "YYYY-MM-DD" are disabled — used on the "TO" picker so
   * an end date earlier than the chosen start can't be selected at all. */
  disabledBefore?: string | null;
  holidayDates?: Set<string>;
}

export function DayChipPicker({ label, value, onChange, disabledBefore, holidayDates }: DayChipPickerProps) {
  const days = generateDayKeys(DAYS_AHEAD);
  return (
    <View>
      <Text style={styles.label}>{label}</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
        {days.map((day) => {
          const disabled = !!disabledBefore && day < disabledBefore;
          const selected = day === value;
          const isHoliday = !!holidayDates?.has(day);
          return (
            <Pressable
              key={day}
              disabled={disabled}
              onPress={() => onChange(day)}
              accessibilityRole="button"
              accessibilityState={{ selected, disabled }}
              style={[styles.chip, selected && styles.chipSelected, disabled && styles.chipDisabled]}
            >
              {selected ? (
                <LinearGradient
                  pointerEvents="none"
                  colors={gradients.orange}
                  start={gradientDirection.diagonal.start}
                  end={gradientDirection.diagonal.end}
                  style={StyleSheet.absoluteFill}
                />
              ) : null}
              <Text
                style={[
                  styles.chipLabel,
                  selected && styles.chipLabelSelected,
                  disabled && styles.chipLabelDisabled,
                ]}
              >
                {formatDayLabel(day)}
              </Text>
              {isHoliday ? (
                <Text style={[styles.holidayTag, selected && { color: colors.onOrange }]}>Holiday</Text>
              ) : null}
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  label: { ...typography.kicker, color: colors.kicker, marginBottom: spacing.sm },
  row: { flexDirection: "row", gap: 8, paddingVertical: 2 },
  // Same look as the shared `Chip`: white + hairline border; selected = orange gradient with a dark label.
  chip: {
    minHeight: 36,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: radius.chip,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    backgroundColor: colors.surface,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  chipSelected: { borderColor: "transparent" },
  chipDisabled: { opacity: 0.35 },
  chipLabel: { fontSize: 13, fontWeight: "500", fontFamily: fontFamilies.medium, color: colors.textSecondary },
  chipLabelSelected: { color: colors.onOrange, fontWeight: "600", fontFamily: fontFamilies.semiBold },
  chipLabelDisabled: { color: colors.textMuted },
  holidayTag: { fontSize: 9, color: colors.warning, marginTop: 2, fontWeight: "700", fontFamily: fontFamilies.bold },
});
