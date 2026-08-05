import { ActivityIndicator, Pressable, StyleSheet, Text, ViewStyle } from "react-native";
import { colors, radius, spacing, typography } from "@/theme";

type Variant = "primary" | "secondary" | "danger" | "ghost";

interface ButtonProps {
  label: string;
  onPress: () => void;
  variant?: Variant;
  loading?: boolean;
  disabled?: boolean;
  style?: ViewStyle;
}

const INDICATOR_COLOR: Record<Variant, string> = {
  primary: colors.primary,
  secondary: colors.textPrimary,
  danger: colors.danger,
  ghost: colors.primary,
};

export function Button({ label, onPress, variant = "primary", loading, disabled, style }: ButtonProps) {
  const isDisabled = disabled || loading;
  return (
    <Pressable
      onPress={onPress}
      disabled={isDisabled}
      style={({ pressed }) => [
        styles.base,
        variantStyles[variant],
        isDisabled && styles.disabled,
        pressed && !isDisabled && styles.pressed,
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={INDICATOR_COLOR[variant]} />
      ) : (
        <Text style={[styles.label, textVariantStyles[variant]]}>{label}</Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    minHeight: 50,
    borderRadius: radius.md,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: spacing.lg,
  },
  pressed: { opacity: 0.7 },
  disabled: { opacity: 0.5 },
  label: { ...typography.bodyStrong },
});

// System rule: primary actions are outlined, not filled — the only solid
// fill in the palette is reserved for dark "presence" panels, not buttons.
const variantStyles = StyleSheet.create({
  primary: { backgroundColor: "transparent", borderWidth: 1, borderColor: colors.primary },
  secondary: { backgroundColor: colors.surfaceMuted },
  danger: { backgroundColor: "transparent", borderWidth: 1, borderColor: colors.danger },
  ghost: { backgroundColor: "transparent" },
});

const textVariantStyles = StyleSheet.create({
  primary: { color: colors.primary },
  secondary: { color: colors.textPrimary },
  danger: { color: colors.danger },
  ghost: { color: colors.primary },
});
