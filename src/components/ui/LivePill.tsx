import { StyleSheet, Text, View, type ViewStyle } from "react-native";
import { PulseRing } from "./PulseRing";
import { colors, fontFamilies } from "@/theme";

export interface LivePillProps {
  /** Default "Live". */
  label?: string;
  /**
   * "dark" (default): green chip for the dark hero (#6EE7A0 on rgba(74,222,128,.14)).
   * "light": green chip on light surfaces (#1E7A4D on rgba(74,222,128,.15)).
   * "glass": white bordered chip with ink label (login "Sign in" chip); pair with dotColor colors.pulse.
   */
  tone?: "dark" | "light" | "glass";
  /** Dot colour. Default green #4ADE80 (glass: #FF9A3D). */
  dotColor?: string;
  /** Pulse the dot. Default true. */
  pulse?: boolean;
  style?: ViewStyle;
}

const TONES = {
  dark: { bg: colors.liveBgOnDark, fg: colors.liveTextOnDark, dot: colors.liveDot, border: undefined },
  light: { bg: colors.successMuted, fg: colors.success, dot: colors.liveDot, border: undefined },
  glass: { bg: colors.surface, fg: colors.ink, dot: "#FF9A3D", border: colors.cardBorder },
} as const;

/** "● Live" status chip with a pulsing dot (Home hero, login header). */
export function LivePill({ label = "Live", tone = "dark", dotColor, pulse = true, style }: LivePillProps) {
  const t = TONES[tone];
  const dot = dotColor ?? t.dot;
  return (
    <View style={[styles.pill, { backgroundColor: t.bg }, t.border ? { borderWidth: 1, borderColor: t.border } : null, style]}>
      <View style={styles.dotBox}>
        <PulseRing size={7} color={dot} enabled={pulse} duration={2000} />
        <View style={[styles.dot, { backgroundColor: dot }]} />
      </View>
      <Text style={[styles.label, { color: t.fg }]} numberOfLines={1}>
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  pill: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 99,
  },
  dotBox: { width: 7, height: 7 },
  dot: { width: 7, height: 7, borderRadius: 4 },
  label: { fontSize: 12, fontFamily: fontFamilies.semiBold, fontWeight: "600" },
});
