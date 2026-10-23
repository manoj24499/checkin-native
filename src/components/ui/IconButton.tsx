import { Pressable, StyleSheet, View, ViewStyle } from "react-native";
import { renderIcon, type IconSource } from "./Icon";
import { colors, shadows } from "@/theme";

type IconButtonVariant = "white" | "ink" | "dark" | "muted";

const VARIANTS: Record<IconButtonVariant, { bg: string; fg: string }> = {
  white: { bg: colors.surface, fg: colors.ink },
  ink: { bg: colors.ink, fg: colors.lime },
  // Translucent ink — for buttons floating over a map.
  dark: { bg: "rgba(14,36,16,0.92)", fg: colors.lime },
  muted: { bg: colors.surfaceMuted, fg: colors.ink },
};

export interface IconButtonProps {
  icon: IconSource;
  onPress: () => void;
  /** white (default; back/close on pale screens), ink (bell), dark (over maps), muted (sheet close). */
  variant?: IconButtonVariant;
  /** Diameter in px. Default 38. */
  size?: number;
  /** "circle" (default) or "rounded" (radius ~0.34 x size, like the bell button). */
  shape?: "circle" | "rounded";
  /** Small lime dot on the corner. */
  badge?: boolean;
  accessibilityLabel?: string;
  disabled?: boolean;
  style?: ViewStyle;
}

/** Round (or rounded-square) icon-only button: back, close, notifications. */
export function IconButton({
  icon,
  onPress,
  variant = "white",
  size = 38,
  shape = "circle",
  badge,
  accessibilityLabel,
  disabled,
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
        variant === "white" && shadows.soft,
        pressed && styles.pressed,
        disabled && styles.disabled,
        style,
      ]}
    >
      {renderIcon(icon, Math.round(size * 0.47), v.fg, 2)}
      {badge ? <View style={styles.badge} /> : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: { alignItems: "center", justifyContent: "center" },
  pressed: { opacity: 0.7 },
  disabled: { opacity: 0.4 },
  badge: {
    position: "absolute",
    top: 7,
    right: 7,
    width: 8,
    height: 8,
    borderRadius: 99,
    backgroundColor: colors.lime,
  },
});
