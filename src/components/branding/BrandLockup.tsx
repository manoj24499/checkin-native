import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from "react-native";
import Svg, { Path } from "react-native-svg";
import { GradientFill } from "@/components/ui";
import { colors, typography } from "@/theme";

interface BrandTileProps {
  /** Tile size. Default 36 (Login.dc.html header). */
  size?: number;
  style?: StyleProp<ViewStyle>;
}

/** The redesign's logo tile: orange gradient rounded square with a dark tick (Login.dc.html header). */
export function BrandTile({ size = 36, style }: BrandTileProps) {
  const glyph = Math.round(size * 0.56);
  return (
    <GradientFill
      style={[{ width: size, height: size, borderRadius: Math.round(size / 3), alignItems: "center", justifyContent: "center" }, style]}
    >
      <Svg width={glyph} height={glyph} viewBox="0 0 24 24" fill="none">
        <Path d="M5 12l4 4 10-10" stroke={colors.onOrange} strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" />
      </Svg>
    </GradientFill>
  );
}

/** Tile + "INZIVO" wordmark (Space Grotesk 15/700, +2 tracking). */
export function BrandLockup({ size = 36, color = colors.ink, style }: BrandTileProps & { color?: string }) {
  return (
    <View style={[styles.row, style]} accessibilityRole="header" accessibilityLabel="Inzivo">
      <BrandTile size={size} />
      <Text style={[styles.word, { color }]}>INZIVO</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: 10 },
  word: { ...typography.wordmark },
});
