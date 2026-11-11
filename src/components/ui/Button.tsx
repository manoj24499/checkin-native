import { ActivityIndicator, Animated, Pressable, StyleSheet, Text, View, type StyleProp, type TextStyle, type ViewStyle } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { renderIcon, type IconSource } from "./Icon";
import { useLoop } from "./animation";
import { colors, fontFamilies, gradientDirection, gradients, motion, radius, spacing, typography } from "@/theme";

export type ButtonVariant = "primary" | "solid" | "secondary" | "danger" | "ghost" | "lime";
export type ButtonSize = "sm" | "md" | "lg";

export interface ButtonProps {
  label: string;
  onPress: () => void;
  /**
   * - primary (default): FILLED orange gradient pill (#FFA64D -> #EF6C00), dark #1A0E05 label.
   * - solid: flat #EF6C00 pill, dark label (the hero's "Check out" button / CTAs on the dark panel).
   * - secondary: white pill, 1px card border, ink label.
   * - danger: red-tinted pill with red border + label ("Log out").
   * - ghost: no fill/border, accent-orange label (tertiary text actions).
   * - lime: legacy alias of `solid` (for use on dark panels).
   */
  variant?: ButtonVariant;
  loading?: boolean;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
  /** "md" (default) 54 high / 16px label; "lg" 56 high (auth CTAs); "sm" 42 high / 13.5px label. */
  size?: ButtonSize;
  /** Optional leading icon (icon name or element), tinted like the label. */
  icon?: IconSource;
  /** Optional trailing icon (e.g. "arrow"). */
  trailingIcon?: IconSource;
  /** Soft white shimmer pulsing over the fill (mockup `btnpulse`; primary/solid only). Off under reduced motion. */
  pulse?: boolean;
  labelStyle?: StyleProp<TextStyle>;
  accessibilityLabel?: string;
}

const LABEL_COLOR: Record<ButtonVariant, string> = {
  primary: colors.onOrange,
  solid: colors.onOrange,
  lime: colors.onOrange,
  secondary: colors.ink,
  danger: colors.danger,
  ghost: colors.accentText,
};

const HEIGHT: Record<ButtonSize, number> = { sm: 42, md: 54, lg: 56 };

/** Pill button. Primary actions are filled (gradient) with a dark label. */
export function Button({
  label,
  onPress,
  variant = "primary",
  loading,
  disabled,
  style,
  size = "md",
  icon,
  trailingIcon,
  pulse,
  labelStyle,
  accessibilityLabel,
}: ButtonProps) {
  const isDisabled = disabled || loading;
  const labelColor = LABEL_COLOR[variant];
  const filled = variant === "primary" || variant === "solid" || variant === "lime";
  const shimmer = useLoop({ duration: motion.shimmerDuration, pingPong: true, enabled: !!pulse && filled && !isDisabled });
  const height = HEIGHT[size];
  const iconSize = size === "sm" ? 16 : 18;

  return (
    <Pressable
      onPress={onPress}
      disabled={isDisabled}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ disabled: !!isDisabled, busy: !!loading }}
      style={({ pressed }) => [
        styles.base,
        { minHeight: height, borderRadius: height / 2 },
        size === "sm" && styles.small,
        variantStyles[variant],
        isDisabled && styles.disabled,
        pressed && !isDisabled && styles.pressed,
        style,
      ]}
    >
      {variant === "primary" ? (
        <LinearGradient
          pointerEvents="none"
          colors={gradients.orange}
          start={gradientDirection.diagonal.start}
          end={gradientDirection.diagonal.end}
          style={StyleSheet.absoluteFill}
        />
      ) : null}
      {pulse && filled ? (
        <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.shimmer, { opacity: shimmer }]} />
      ) : null}
      {loading ? (
        <ActivityIndicator color={labelColor} />
      ) : (
        <View style={styles.inner}>
          {icon ? renderIcon(icon, iconSize, labelColor, 2) : null}
          <Text style={[styles.label, size === "sm" && styles.labelSmall, { color: labelColor }, labelStyle]} numberOfLines={1}>
            {label}
          </Text>
          {trailingIcon ? renderIcon(trailingIcon, iconSize, labelColor, 2) : null}
        </View>
      )}
    </Pressable>
  );
}

/** Convenience alias: `<GradientButton label="Sign in" size="lg" pulse onPress={…} />` (= Button variant primary). */
export function GradientButton(props: Omit<ButtonProps, "variant">) {
  return <Button {...props} variant="primary" />;
}

const styles = StyleSheet.create({
  base: {
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: spacing.lg,
    overflow: "hidden",
    borderRadius: radius.button,
  },
  small: { paddingHorizontal: spacing.md },
  inner: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: spacing.sm },
  pressed: { opacity: 0.88, transform: [{ scale: 0.98 }] },
  disabled: { opacity: 0.45 },
  label: { ...typography.button },
  labelSmall: { fontSize: 13.5, fontFamily: fontFamilies.semiBold },
  shimmer: { backgroundColor: "rgba(255,255,255,0.28)" },
});

const variantStyles = StyleSheet.create({
  primary: { backgroundColor: colors.primary },
  solid: { backgroundColor: colors.primary },
  lime: { backgroundColor: colors.primary },
  secondary: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.cardBorder },
  danger: { backgroundColor: colors.dangerMuted, borderWidth: 1, borderColor: colors.dangerBorder },
  ghost: { backgroundColor: "transparent" },
});
