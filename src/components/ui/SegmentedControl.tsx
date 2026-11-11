import { Pressable, StyleSheet, Text, View, ViewStyle } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { colors, fontFamilies, gradientDirection, gradients, shadows } from "@/theme";

export interface SegmentOption<K extends string> {
  key: K;
  label: string;
  /** Optional count bubble after the label (dark #1A0E05 with #FFB067 text). */
  badge?: number | string;
  disabled?: boolean;
}

export interface SegmentedControlProps<K extends string> {
  options: SegmentOption<K>[];
  value: K;
  onChange: (key: K) => void;
  /**
   * "white" (default) / "ink" / "gradient": white track (radius 16, 4px inset), active segment filled with
   * the orange gradient + dark label (Requests tabs). "subtle": muted track with a raised white active
   * segment (secondary pickers inside cards).
   */
  variant?: "white" | "ink" | "gradient" | "subtle";
  style?: ViewStyle;
}

/** Segmented switch (Requests.dc.html): 46 high, white track, gradient active segment. */
export function SegmentedControl<K extends string>({
  options,
  value,
  onChange,
  variant = "white",
  style,
}: SegmentedControlProps<K>) {
  const subtle = variant === "subtle";
  return (
    <View style={[styles.track, subtle && styles.trackSubtle, style]}>
      {options.map((o) => {
        const active = o.key === value;
        return (
          <Pressable
            key={o.key}
            onPress={() => onChange(o.key)}
            disabled={o.disabled}
            accessibilityRole="tab"
            accessibilityState={{ selected: active, disabled: !!o.disabled }}
            style={[styles.segment, active && subtle && styles.activeSubtle, o.disabled && styles.disabled]}
          >
            {active && !subtle ? (
              <LinearGradient
                pointerEvents="none"
                colors={gradients.orange}
                start={gradientDirection.diagonal.start}
                end={gradientDirection.diagonal.end}
                style={StyleSheet.absoluteFill}
              />
            ) : null}
            <Text
              style={[styles.label, active && styles.labelActive, active && !subtle && { color: colors.onOrange }]}
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
  track: { flexDirection: "row", backgroundColor: colors.surface, borderRadius: 16, padding: 4, gap: 4 },
  trackSubtle: { backgroundColor: colors.surfaceMuted, gap: 0, padding: 3 },
  segment: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    minHeight: 38,
    paddingHorizontal: 4,
    borderRadius: 12,
    overflow: "hidden",
  },
  activeSubtle: { backgroundColor: colors.surfaceRaised, ...shadows.soft },
  disabled: { opacity: 0.4 },
  label: { fontSize: 13, fontFamily: fontFamilies.medium, fontWeight: "500", color: colors.textSecondary },
  labelActive: { fontFamily: fontFamilies.semiBold, fontWeight: "600", color: colors.ink },
  badge: {
    minWidth: 18,
    paddingHorizontal: 7,
    height: 17,
    borderRadius: 9,
    backgroundColor: colors.onOrange,
    alignItems: "center",
    justifyContent: "center",
  },
  badgeLabel: { fontSize: 11, fontWeight: "700", fontFamily: fontFamilies.bold, color: colors.primarySoftText },
});
