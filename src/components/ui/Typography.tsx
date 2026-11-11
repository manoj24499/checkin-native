import { StyleSheet, Text, TextProps, View, type StyleProp, type ViewStyle } from "react-native";
import { colors, typography } from "@/theme";

interface KickerProps extends TextProps {
  /** Text colour. Default colors.kicker (#B34D05); pass colors.panelHeroMuted on the dark hero. */
  color?: string;
}

/**
 * Small-caps kicker ("GOOD MORNING", "TODAY"): 11/600, +1.4 tracking, accent orange. Upper-cases string
 * children itself, so `<Kicker>Live location</Kicker>` is fine.
 */
export function Kicker({ color = colors.kicker, style, children, ...props }: KickerProps) {
  return (
    <Text style={[styles.kicker, { color }, style]} {...props}>
      {typeof children === "string" ? children.toUpperCase() : children}
    </Text>
  );
}

/** Large screen title (Space Grotesk 28/700, ink). Use under a Kicker at the top of a screen. */
export function ScreenTitle({ style, ...props }: TextProps) {
  return <Text style={[styles.title, style]} {...props} />;
}

/** Kicker + ScreenTitle pair (the mockups' page header: "ACCOUNT" / "Profile"). */
export function PageHeader({ kicker, title, style }: { kicker?: string; title: string; style?: StyleProp<ViewStyle> }) {
  return (
    <View style={style} accessibilityRole="header">
      {kicker ? <Kicker>{kicker}</Kicker> : null}
      <ScreenTitle>{title}</ScreenTitle>
    </View>
  );
}

const styles = StyleSheet.create({
  kicker: { ...typography.kicker, marginBottom: 2 },
  title: { ...typography.h1, color: colors.ink },
});
