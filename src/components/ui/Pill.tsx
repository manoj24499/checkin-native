import { Pressable, StyleSheet, Text, View, ViewStyle } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { renderIcon, type IconSource } from "./Icon";
import { colors, fontFamilies, gradientDirection, gradients, radius } from "@/theme";

export type PillVariant =
  | "lime"
  | "white"
  | "glass"
  | "ink"
  | "outline"
  | "muted"
  | "success"
  | "warning"
  | "danger"
  | "gradient"
  | "hero";

const PILL: Record<PillVariant, { bg: string; fg: string; border?: string }> = {
  lime: { bg: colors.primaryMuted, fg: colors.accentText },
  white: { bg: colors.surface, fg: colors.ink, border: colors.cardBorder },
  /** Translucent white on the dark hero ("24 m", "In 09:02"). */
  glass: { bg: "rgba(255,255,255,0.12)", fg: colors.panelHeroText },
  hero: { bg: "rgba(255,255,255,0.12)", fg: colors.panelHeroText },
  ink: { bg: colors.ink, fg: colors.primarySoftText },
  outline: { bg: "transparent", fg: colors.ink, border: colors.hairlineStrong },
  muted: { bg: "rgba(23,19,15,0.10)", fg: colors.textSecondary },
  success: { bg: colors.successMuted, fg: colors.success },
  warning: { bg: colors.warningMuted, fg: colors.warning },
  danger: { bg: colors.dangerMuted, fg: colors.danger },
  gradient: { bg: colors.primary, fg: colors.onOrange },
};

export interface PillProps {
  label: string;
  /**
   * Status chips (11/600, padding 4/10): success "Approved", warning "Pending"/"Scheduled", danger "Declined",
   * muted (grey), lime (orange tint, accent text). Others: white (bordered), glass/hero (translucent on the
   * dark hero), ink (dark fill, orange text), outline, gradient (orange gradient, dark text).
   * For "● Live" use LivePill.
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
    t.border ? { borderWidth: 1, borderColor: t.border } : null,
    style,
  ];
  const fill =
    variant === "gradient" ? (
      <LinearGradient
        pointerEvents="none"
        colors={gradients.orange}
        start={gradientDirection.diagonal.start}
        end={gradientDirection.diagonal.end}
        style={StyleSheet.absoluteFill}
      />
    ) : null;
  return onPress ? (
    <Pressable onPress={onPress} hitSlop={6} style={({ pressed }) => [...base, pressed && styles.pressed]}>
      {fill}
      {content}
    </Pressable>
  ) : (
    <View style={base}>
      {fill}
      {content}
    </View>
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
 * Selectable filter/option chip (Notifications filters, leave type, day, time slot): 36 high, radius 18.
 * Selected = orange gradient with dark 600 label; unselected = white with secondary 500 label.
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
      {selected ? (
        <LinearGradient
          pointerEvents="none"
          colors={gradients.orange}
          start={gradientDirection.diagonal.start}
          end={gradientDirection.diagonal.end}
          style={StyleSheet.absoluteFill}
        />
      ) : null}
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
    overflow: "hidden",
  },
  pillLabel: { fontSize: 11, fontWeight: "600", fontFamily: fontFamilies.semiBold },
  dot: { width: 7, height: 7, borderRadius: 99 },
  pressed: { opacity: 0.7 },
  chip: {
    minHeight: 36,
    paddingHorizontal: 14,
    justifyContent: "center",
    alignItems: "center",
    borderRadius: 18,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    overflow: "hidden",
  },
  chipSelected: { borderColor: "transparent" },
  chipDisabled: { opacity: 0.35 },
  chipLabel: { fontSize: 13, fontWeight: "500", fontFamily: fontFamilies.medium, color: colors.textSecondary },
  chipLabelSelected: { color: colors.onOrange, fontWeight: "600", fontFamily: fontFamilies.semiBold },
});
