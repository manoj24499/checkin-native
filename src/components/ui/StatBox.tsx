import { ReactNode } from "react";
import { StyleSheet, Text, View, type TextStyle, type ViewStyle } from "react-native";
import { colors, radius, typography } from "@/theme";

export interface StatBoxProps {
  /** Small caps label ("IN AT", "CASUAL"). Upper-cased automatically. */
  label: string;
  /** Value ("09:02", "6 / 8"). Space Grotesk 17/700. */
  value: string;
  /**
   * "hero" (default): translucent white on the dark hero panel.
   * "light": white box on the page / on a tinted card (Home leave card).
   * "muted": #F1EDE8 box inside a white card (Profile work-mode boxes).
   */
  tone?: "hero" | "light" | "muted";
  /** Extra content under the value (e.g. a progress track). */
  children?: ReactNode;
  /** flex weight in a row. Default 1. */
  flex?: number;
  valueStyle?: TextStyle;
  style?: ViewStyle;
}

const TONES = {
  hero: { bg: colors.panelHeroChip, label: colors.panelHeroMuted, value: colors.panelHeroText },
  light: { bg: colors.surface, label: colors.textSecondary, value: colors.ink },
  muted: { bg: colors.surfaceMuted, label: colors.textSecondary, value: colors.ink },
} as const;

/** Small labelled stat: 10px caps label over a 17px Space Grotesk value, radius 16, padding 10/12. */
export function StatBox({ label, value, tone = "hero", children, flex = 1, valueStyle, style }: StatBoxProps) {
  const t = TONES[tone];
  return (
    <View style={[styles.box, { backgroundColor: t.bg, flex }, style]}>
      <Text style={[styles.label, { color: t.label }]} numberOfLines={1}>
        {label.toUpperCase()}
      </Text>
      <Text style={[styles.value, { color: t.value }, valueStyle]} numberOfLines={1} adjustsFontSizeToFit>
        {value}
      </Text>
      {children}
    </View>
  );
}

/** Horizontal row of StatBoxes with the mockup's 8px gap. */
export function StatRow({ children, style }: { children: ReactNode; style?: ViewStyle }) {
  return <View style={[styles.row, style]}>{children}</View>;
}

const styles = StyleSheet.create({
  box: { borderRadius: radius.chip, paddingVertical: 10, paddingHorizontal: 12, minWidth: 0 },
  label: { ...typography.statLabel },
  value: { ...typography.number, marginTop: 4 },
  row: { flexDirection: "row", gap: 8 },
});
