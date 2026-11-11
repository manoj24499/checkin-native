import { Pressable, StyleSheet, View, ViewStyle } from "react-native";
import { renderIcon, type IconSource } from "./Icon";
import { colors, shadows } from "@/theme";

type IconButtonVariant = "soft" | "white" | "ink" | "dark" | "muted" | "hero";

const VARIANTS: Record<IconButtonVariant, { bg: string; fg: string; border?: string }> = {
  /** Redesign default: faint ink fill rgba(23,19,15,.08), ink glyph (bell, back, close on the page). */
  soft: { bg: colors.iconButtonBg, fg: colors.ink },
  /** White circle with a hairline border (over glows/maps where the soft fill is too faint). */
  white: { bg: colors.surface, fg: colors.ink, border: colors.cardBorder },
  /** Legacy name: orange-tint fill with accent glyph. */
  ink: { bg: colors.primaryMuted, fg: colors.accentText },
  // Translucent dark — for buttons floating over a map.
  dark: { bg: "rgba(23,19,15,0.88)", fg: colors.primarySoftText },
  muted: { bg: colors.surfaceMuted, fg: colors.ink },
  /** On the dark hero panel. */
  hero: { bg: colors.panelHeroChip, fg: colors.panelHeroText },
};

export interface IconButtonProps {
  icon: IconSource;
  onPress: () => void;
  /** soft (default; 8% ink fill), white (bordered), ink (orange tint), dark (over maps), muted, hero. */
  variant?: IconButtonVariant;
  /** Diameter in px. Default 44. */
  size?: number;
  /** "circle" (default) or "rounded" (radius ~0.34 x size). */
  shape?: "circle" | "rounded";
  /** Small orange dot with a page-coloured ring on the top-right (unread). */
  badge?: boolean;
  accessibilityLabel?: string;
  disabled?: boolean;
  /** Glyph colour override. */
  color?: string;
  style?: ViewStyle;
}

/** Round icon-only button (44px, rgba(23,19,15,.08) fill): back, close, notifications. */
export function IconButton({
  icon,
  onPress,
  variant = "soft",
  size = 44,
  shape = "circle",
  badge,
  accessibilityLabel,
  disabled,
  color,
  style,
}: IconButtonProps) {
  const v = VARIANTS[variant];
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      hitSlop={8}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      style={({ pressed }) => [
        styles.base,
        {
          width: size,
          height: size,
          borderRadius: shape === "circle" ? size / 2 : Math.round(size * 0.34),
          backgroundColor: v.bg,
        },
        v.border ? { borderWidth: 1, borderColor: v.border } : null,
        variant === "white" && shadows.soft,
        pressed && styles.pressed,
        disabled && styles.disabled,
        style,
      ]}
    >
      {renderIcon(icon, Math.round(size * 0.48), color ?? v.fg, 1.8)}
      {badge ? (
        <View
          style={[
            styles.badge,
            { top: Math.round(size * 0.22), right: Math.round(size * 0.25) },
          ]}
        />
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: { alignItems: "center", justifyContent: "center" },
  pressed: { opacity: 0.7 },
  disabled: { opacity: 0.4 },
  badge: {
    position: "absolute",
    width: 9,
    height: 9,
    borderRadius: 5,
    backgroundColor: colors.pulse,
    borderWidth: 2,
    borderColor: colors.background,
  },
});
