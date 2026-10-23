import { ActivityIndicator, Pressable, StyleSheet, Text, View, ViewStyle } from "react-native";
import { renderIcon, type IconSource } from "./Icon";
import { colors, radius, shadows, spacing, typography } from "@/theme";

type Variant = "primary" | "secondary" | "danger" | "ghost" | "lime";

interface ButtonProps {
  label: string;
  onPress: () => void;
  /**
   * - primary (default): ink pill, lime label, soft ink shadow.
   * - secondary: transparent, 1.5px ink outline, ink label.
   * - danger: white pill, hairline border, red label (destructive actions).
   * - ghost: no background/border, ink label (tertiary links/actions).
   * - lime: lime pill, ink label — for use ON dark (ink) panels.
   */
  variant?: Variant;
  loading?: boolean;
  disabled?: boolean;
  style?: ViewStyle;
  /** "md" (default) is 50 high; "sm" is 42 high with a smaller label. */
  size?: "md" | "sm";
  /** Optional leading icon (icon name or element), tinted like the label. */
  icon?: IconSource;
}

const LABEL_COLOR: Record<Variant, string> = {
  primary: colors.primaryText,
  secondary: colors.ink,
  danger: colors.danger,
  ghost: colors.ink,
  lime: colors.ink,
};

export function Button({ label, onPress, variant = "primary", loading, disabled, style, size = "md", icon }: ButtonProps) {
  const isDisabled = disabled || loading;
  const labelColor = LABEL_COLOR[variant];
  return (
    <Pressable
      onPress={onPress}
      disabled={isDisabled}
      style={({ pressed }) => [
        styles.base,
        size === "sm" && styles.small,
        variantStyles[variant],
        isDisabled && styles.disabled,
        pressed && !isDisabled && styles.pressed,
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={labelColor} />
      ) : (
        <View style={styles.inner}>
          {icon ? renderIcon(icon, size === "sm" ? 16 : 18, labelColor) : null}
          <Text style={[styles.label, size === "sm" && styles.labelSmall, { color: labelColor }]}>{label}</Text>
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    minHeight: 50,
    borderRadius: radius.button,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: spacing.lg,
  },
  small: { minHeight: 42, borderRadius: 21, paddingHorizontal: spacing.md },
  inner: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: spacing.sm },
  pressed: { opacity: 0.85, transform: [{ scale: 0.98 }] },
  disabled: { opacity: 0.45 },
  label: { ...typography.bodyStrong },
  labelSmall: { fontSize: 13.5 },
});

const variantStyles = StyleSheet.create({
  primary: { backgroundColor: colors.ink, ...shadows.ink },
  secondary: { backgroundColor: "transparent", borderWidth: 1.5, borderColor: colors.ink },
  danger: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  ghost: { backgroundColor: "transparent" },
  lime: { backgroundColor: colors.lime },
});
