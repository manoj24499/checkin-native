import { Pressable, StyleSheet, Text, View, ViewStyle } from "react-native";
import { renderIcon, type IconSource } from "./Icon";
import { colors, shadows, spacing } from "@/theme";

export interface ActionTileProps {
  /** Icon name or element (drawn lime on the ink tile). */
  icon: IconSource;
  /** Label under the tile (keep it to one short word or two). */
  label: string;
  onPress?: () => void;
  disabled?: boolean;
  /** Small lime-ringed dot on the tile's top-right corner (e.g. "pending"). */
  badge?: boolean;
  /** Tile square size. Default 58. */
  size?: number;
  style?: ViewStyle;
}

/**
 * Quick-action tile from the hero card: ink rounded square (radius ~19) with
 * a lime icon and an ink label underneath. Works on lime and pale surfaces.
 */
export function ActionTile({ icon, label, onPress, disabled, badge, size = 58, style }: ActionTileProps) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || !onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => [styles.wrap, disabled && styles.disabled, pressed && styles.pressed, style]}
    >
      <View style={[styles.tile, { width: size, height: size, borderRadius: Math.round(size * 0.33) }]}>
        {renderIcon(icon, Math.round(size * 0.38), colors.lime)}
        {badge ? <View style={styles.badge} /> : null}
      </View>
      <Text style={styles.label} numberOfLines={1}>
        {label}
      </Text>
    </Pressable>
  );
}

export interface QuickActionsProps {
  /** 1-4 tiles (the row is laid out as 4 equal columns). `key` defaults to the label. */
  actions: (ActionTileProps & { key?: string })[];
  style?: ViewStyle;
}

/** A row of ActionTiles in equal columns — the four buttons inside the hero card. */
export function QuickActions({ actions, style }: QuickActionsProps) {
  return (
    <View style={[styles.row, style]}>
      {actions.map(({ key, ...a }) => (
        <View key={key ?? a.label} style={styles.cell}>
          <ActionTile {...a} />
        </View>
      ))}
      {/* Pad short rows so tiles keep the 4-column rhythm. */}
      {Array.from({ length: Math.max(0, 4 - actions.length) }, (_, i) => (
        <View key={`pad-${i}`} style={styles.cell} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: "center", gap: 7 },
  tile: {
    backgroundColor: colors.ink,
    alignItems: "center",
    justifyContent: "center",
    ...shadows.ink,
  },
  badge: {
    position: "absolute",
    top: 8,
    right: 8,
    width: 9,
    height: 9,
    borderRadius: 99,
    backgroundColor: colors.lime,
    borderWidth: 1.5,
    borderColor: colors.ink,
  },
  label: { fontSize: 11.5, fontWeight: "600", fontFamily: "Inter_600SemiBold", color: colors.ink },
  pressed: { opacity: 0.85, transform: [{ scale: 0.96 }] },
  disabled: { opacity: 0.4 },
  row: { flexDirection: "row", gap: spacing.sm },
  cell: { flex: 1, alignItems: "center" },
});
