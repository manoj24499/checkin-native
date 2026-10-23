import { StyleSheet, Text, View, ViewStyle } from "react-native";
import { renderIcon, type IconSource } from "./Icon";
import { colors } from "@/theme";

export type IconTileTone = "ink" | "lime" | "muted" | "white" | "success" | "warning" | "danger";

export interface IconTileProps {
  /** Icon name / element. Omit and pass `glyph` for a text glyph ("!", "1", "✓"). */
  icon?: IconSource;
  /** Short text shown instead of an icon (numbered place badges, "!"). */
  glyph?: string;
  /**
   * - ink (default): ink square, lime glyph — the mockup's list-row tile.
   * - lime: lime tint (primaryMuted), limeDeep glyph.
   * - muted: surfaceMuted, secondary-text glyph.
   * - white: white square, ink glyph (on lime/tinted surfaces).
   * - success/warning/danger: matching *Muted fill and colour glyph.
   */
  tone?: IconTileTone;
  /** Square size in px. Default 38. Corner radius scales (~0.32 x size). */
  size?: number;
  /** Override the corner radius; pass size/2 for a circle. */
  radius?: number;
  style?: ViewStyle;
}

const TONES: Record<IconTileTone, { bg: string; fg: string }> = {
  ink: { bg: colors.ink, fg: colors.lime },
  lime: { bg: colors.primaryMuted, fg: colors.limeDeep },
  muted: { bg: colors.surfaceMuted, fg: colors.textSecondary },
  white: { bg: colors.surface, fg: colors.ink },
  success: { bg: colors.successMuted, fg: colors.success },
  warning: { bg: colors.warningMuted, fg: colors.warning },
  danger: { bg: colors.dangerMuted, fg: colors.danger },
};

/** Rounded-square icon holder (the dark tile with a lime glyph in list rows). */
export function IconTile({ icon, glyph, tone = "ink", size = 38, radius, style }: IconTileProps) {
  const { bg, fg } = TONES[tone];
  return (
    <View
      style={[
        styles.tile,
        { width: size, height: size, borderRadius: radius ?? Math.round(size * 0.32), backgroundColor: bg },
        style,
      ]}
    >
      {icon ? (
        renderIcon(icon, Math.round(size * 0.47), fg)
      ) : glyph ? (
        <Text style={[styles.glyph, { color: fg, fontSize: Math.round(size * 0.38) }]}>{glyph}</Text>
      ) : null}
    </View>
  );
}

/** Foreground (glyph) colour for a tone — handy for matching text next to a tile. */
export function iconTileForeground(tone: IconTileTone) {
  return TONES[tone].fg;
}

const styles = StyleSheet.create({
  tile: { alignItems: "center", justifyContent: "center", flexShrink: 0 },
  glyph: { fontWeight: "700", fontFamily: "Inter_700Bold" },
});
