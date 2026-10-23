import { Pressable, StyleSheet, Text, View, ViewStyle } from "react-native";
import { renderIcon, type IconSource } from "./Icon";
import { colors, radius, spacing, typography } from "@/theme";

export type PillVariant = "lime" | "white" | "glass" | "ink" | "outline" | "muted" | "success" | "warning" | "danger";

const PILL: Record<PillVariant, { bg: string; fg: string; border?: string }> = {
  lime: { bg: colors.primaryMuted, fg: colors.limeDeep },
  white: { bg: colors.surface, fg: colors.ink },
  glass: { bg: colors.glass, fg: colors.ink },
  ink: { bg: colors.ink, fg: colors.lime },
  outline: { bg: "transparent", fg: colors.ink, border: colors.ink },
  muted: { bg: colors.surfaceMuted, fg: colors.textSecondary },
  success: { bg: colors.surface, fg: colors.success },
  warning: { bg: colors.warningMuted, fg: colors.warning },
  danger: { bg: colors.dangerMuted, fg: colors.danger },
};

export interface PillProps {
  label: string;
  /**
   * - lime: lime tint, olive text.  - white: solid white, ink text.
   * - glass: translucent white on the lime hero ("In 9:02 AM").
   * - ink: ink fill, lime text ("₹8 / km").  - outline: ink border.
   * - muted: surfaceMuted.  - success: white with green text (hero "● Live").
   * - warning/danger: matching *Muted fills.
   */
  variant?: PillVariant;
  /** Leading coloured dot (e.g. the "● Live" indicator). `true` = label colour. */
  dot?: boolean | string;
  /** Leading icon (12-14px). */
  icon?: IconSource;
  /** Trailing icon (e.g. "chevronDown"). */
  trailingIcon?: IconSource;
  onPress?: () => void;
  style?: ViewStyle;
}

/** Small rounded label (non-selectable). For selectable options use `Chip`. */
export function Pill({ label, variant = "lime", dot, icon, trailingIcon, onPress, style }: PillProps) {
  const t = PILL[variant];
  const content = (
    <>
      {dot ? <View style={[styles.dot, { backgroundColor: dot === true ? t.fg : dot }]} /> : null}
      {icon ? renderIcon(icon, 13, t.fg, 2) : null}
      <Text style={[styles.pillLabel, { color: t.fg }]} numberOfLines={1}>
        {label}
      </Text>
      {trailingIcon ? renderIcon(trailingIcon, 12, t.fg, 2) : null}
    </>
  );
  const base = [
    styles.pill,
    { backgroundColor: t.bg },
    t.border ? { borderWidth: 1.5, borderColor: t.border } : null,
    style,
  ];
  return onPress ? (
    <Pressable onPress={onPress} hitSlop={6} style={({ pressed }) => [...base, pressed && styles.pressed]}>
      {content}
    </Pressable>
  ) : (
    <View style={base}>{content}</View>
  );
}

export interface ChipProps {
  label: string;
  selected?: boolean;
  disabled?: boolean;
  onPress?: () => void;
  style?: ViewStyle;
}

/**
 * Selectable option chip (leave type, day, time slot). Selected = lime tint
 * with a 2px ink outline and olive label; unselected = surfaceMuted.
 */
export function Chip({ label, selected, disabled, onPress, style }: ChipProps) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || !onPress}
      accessibilityRole="button"
      accessibilityState={{ selected: !!selected, disabled: !!disabled }}
      style={[styles.chip, selected && styles.chipSelected, disabled && styles.chipDisabled, style]}
    >
      <Text style={[styles.chipLabel, selected && styles.chipLabelSelected]} numberOfLines={1}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  pill: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: radius.full,
  },
  pillLabel: { fontSize: 11.5, fontWeight: "600", fontFamily: "Inter_600SemiBold" },
  dot: { width: 7, height: 7, borderRadius: 99 },
  pressed: { opacity: 0.7 },
  chip: {
    paddingHorizontal: spacing.sm + 5,
    paddingVertical: spacing.sm,
    borderRadius: 12,
    backgroundColor: colors.surfaceMuted,
    borderWidth: 2,
    borderColor: "transparent",
  },
  chipSelected: { backgroundColor: colors.primaryMuted, borderColor: colors.ink },
  chipDisabled: { opacity: 0.35 },
  chipLabel: { ...typography.caption, fontSize: 12.5, color: colors.textSecondary },
  chipLabelSelected: { color: colors.limeDeep, fontWeight: "600", fontFamily: "Inter_600SemiBold" },
});
