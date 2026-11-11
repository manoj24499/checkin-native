import { Pressable, StyleSheet, Text, View, ViewStyle } from "react-native";
import { renderIcon, type IconSource } from "./Icon";
import { colors, fontFamilies, radius } from "@/theme";

export type ActionTileTone = "hero" | "light";

export interface ActionTileProps {
  /** Icon name or element (stroked #FFB067, 20px). */
  icon: IconSource;
  /** Label inside the tile, under the icon (one short word). */
  label: string;
  onPress?: () => void;
  disabled?: boolean;
  /** Small orange dot on the tile's top-right corner (e.g. "pending"). */
  badge?: boolean;
  /**
   * "hero" (default): translucent white rgba(255,255,255,.08) tile with light label — inside the dark hero.
   * "light": white tile with ink label — on the page.
   */
  tone?: ActionTileTone;
  /** Tile height. Default 64 (hero) / 68 (light). Width is flexible (fills its cell). */
  size?: number;
  style?: ViewStyle;
}

const TONES = {
  hero: { bg: colors.panelHeroChip, fg: colors.panelHeroText, border: undefined, badgeRing: colors.panelHero },
  light: { bg: colors.surface, fg: colors.ink, border: colors.cardBorder, badgeRing: colors.surface },
} as const;

/**
 * Quick-action tile (Main.dc.html `.hq` / `.qt`): rounded (18) rectangle with a 20px #FFB067 line icon above a
 * 12/500 label. Fills its parent's width — lay several out with `QuickActions` (equal columns, 8px gap).
 */
export function ActionTile({ icon, label, onPress, disabled, badge, tone = "hero", size, style }: ActionTileProps) {
  const t = TONES[tone];
  const height = size ?? (tone === "hero" ? 64 : 68);
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || !onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => [
        styles.tile,
        { height, backgroundColor: t.bg },
        t.border ? { borderWidth: 1, borderColor: t.border } : null,
        disabled && styles.disabled,
        pressed && styles.pressed,
        style,
      ]}
    >
      {renderIcon(icon, 20, colors.panelHeroIcon, 1.8)}
      <Text style={[styles.label, { color: t.fg }]} numberOfLines={1}>
        {label}
      </Text>
      {badge ? <View style={[styles.badge, { borderColor: t.badgeRing }]} /> : null}
    </Pressable>
  );
}

export interface QuickActionsProps {
  /** 1-4 tiles in equal columns. `key` defaults to the label. */
  actions: (ActionTileProps & { key?: string })[];
  /** Applied to every tile that doesn't set its own tone. Default "hero". */
  tone?: ActionTileTone;
  style?: ViewStyle;
}

/** A row of ActionTiles in equal columns with an 8px gap — the four buttons inside the hero card. */
export function QuickActions({ actions, tone = "hero", style }: QuickActionsProps) {
  return (
    <View style={[styles.row, style]}>
      {actions.map(({ key, ...a }) => (
        <View key={key ?? a.label} style={styles.cell}>
          <ActionTile tone={tone} {...a} />
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  tile: {
    alignSelf: "stretch",
    borderRadius: radius.tile,
    alignItems: "center",
    justifyContent: "center",
    gap: 5,
    paddingHorizontal: 4,
  },
  badge: {
    position: "absolute",
    top: 8,
    right: 10,
    width: 9,
    height: 9,
    borderRadius: 5,
    backgroundColor: colors.pulse,
    borderWidth: 2,
  },
  label: { fontSize: 12, fontWeight: "500", fontFamily: fontFamilies.medium },
  pressed: { opacity: 0.8, transform: [{ scale: 0.97 }] },
  disabled: { opacity: 0.4 },
  row: { flexDirection: "row", gap: 8 },
  cell: { flex: 1 },
});
