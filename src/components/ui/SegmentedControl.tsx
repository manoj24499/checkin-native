import { Pressable, StyleSheet, Text, View, ViewStyle } from "react-native";
import { colors, shadows, spacing } from "@/theme";

export interface SegmentOption<K extends string> {
  key: K;
  label: string;
  /** Optional count bubble after the label (ink with lime text). */
  badge?: number | string;
  disabled?: boolean;
}

export interface SegmentedControlProps<K extends string> {
  options: SegmentOption<K>[];
  value: K;
  onChange: (key: K) => void;
  /**
   * "white" (default): active segment is a white raised pill with ink text
   * (Requests tabs). "ink": active segment is ink with lime text (Office /
   * Field work picker on Check-in).
   */
  variant?: "white" | "ink";
  style?: ViewStyle;
}

/** Pill-track segmented switch (surfaceMuted track, 3px inset). */
export function SegmentedControl<K extends string>({
  options,
  value,
  onChange,
  variant = "white",
  style,
}: SegmentedControlProps<K>) {
  return (
    <View style={[styles.track, style]}>
      {options.map((o) => {
        const active = o.key === value;
        return (
          <Pressable
            key={o.key}
            onPress={() => onChange(o.key)}
            disabled={o.disabled}
            accessibilityRole="tab"
            accessibilityState={{ selected: active, disabled: !!o.disabled }}
            style={[
              styles.segment,
              active && (variant === "ink" ? styles.activeInk : styles.activeWhite),
              o.disabled && styles.disabled,
            ]}
          >
            <Text
              style={[
                styles.label,
                active && styles.labelActive,
                active && variant === "ink" && { color: colors.lime },
              ]}
              numberOfLines={1}
            >
              {o.label}
            </Text>
            {o.badge != null && o.badge !== 0 ? (
              <View style={styles.badge}>
                <Text style={styles.badgeLabel}>{o.badge}</Text>
              </View>
            ) : null}
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  track: { flexDirection: "row", backgroundColor: colors.surfaceMuted, borderRadius: 16, padding: 3 },
  segment: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 5,
    paddingVertical: spacing.sm + 1,
    paddingHorizontal: 4,
    borderRadius: 13,
  },
  activeWhite: { backgroundColor: colors.surface, ...shadows.soft },
  activeInk: { backgroundColor: colors.ink },
  disabled: { opacity: 0.4 },
  label: { fontSize: 13, fontFamily: "Inter_500Medium", fontWeight: "500", color: colors.textSecondary },
  labelActive: { fontFamily: "Inter_600SemiBold", fontWeight: "600", color: colors.ink },
  badge: {
    minWidth: 18,
    paddingHorizontal: 5,
    height: 16,
    borderRadius: 99,
    backgroundColor: colors.ink,
    alignItems: "center",
    justifyContent: "center",
  },
  badgeLabel: { fontSize: 10, fontWeight: "700", color: colors.lime },
});
