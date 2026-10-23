import { StyleSheet, Text, TextProps } from "react-native";
import { colors, typography } from "@/theme";

interface KickerProps extends TextProps {
  /** Text colour. Default textSecondary; pass textOnDarkMuted on dark panels. */
  color?: string;
}

/**
 * Small-caps section kicker ("TIME OFF & APPROVALS"). Upper-cases string
 * children itself, so `<Kicker>Live location</Kicker>` is fine.
 */
export function Kicker({ color = colors.textSecondary, style, children, ...props }: KickerProps) {
  return (
    <Text style={[styles.kicker, { color }, style]} {...props}>
      {typeof children === "string" ? children.toUpperCase() : children}
    </Text>
  );
}

/** Large screen title (h1, ink). Use under a Kicker at the top of a screen. */
export function ScreenTitle({ style, ...props }: TextProps) {
  return <Text style={[styles.title, style]} {...props} />;
}

const styles = StyleSheet.create({
  kicker: { ...typography.kicker, marginBottom: 4 },
  title: { ...typography.h1, fontSize: 26, color: colors.ink },
});
