import { ReactNode } from "react";
import { Pressable, StyleSheet, Text, View, ViewStyle } from "react-native";
import { IconTile, type IconTileTone } from "./IconTile";
import type { IconSource } from "./Icon";
import { colors, spacing, typography } from "@/theme";

type ValueTone = "default" | "success" | "warning" | "danger" | "muted";

export interface ListRowProps {
  /** Leading icon in an IconTile (38px). Ignored when `leading` is given. */
  icon?: IconSource;
  /** IconTile tone for `icon`. Default "ink". */
  iconTone?: IconTileTone;
  /** Custom leading node (thumbnail, date block, numbered badge). */
  leading?: ReactNode;
  title: string;
  /** Second line under the title (secondary text, wraps). */
  subtitle?: string;
  /** Right-aligned bold value ("9h 29m", "₹197", "On time"). */
  value?: string;
  valueTone?: ValueTone;
  /** Small muted line under the value ("PIN · photo ok"). */
  valueSub?: string;
  /** Custom right-hand node (StatusBadge, Toggle, chevron). Rendered after `value`. */
  trailing?: ReactNode;
  /** Children render under the title/subtitle (extra lines, progress bar). */
  children?: ReactNode;
  onPress?: () => void;
  /** Hairline divider above the row (set on every row except the first in a Card). */
  divider?: boolean;
  style?: ViewStyle;
}

const VALUE_COLOR: Record<ValueTone, string> = {
  default: colors.ink,
  success: colors.success,
  warning: colors.warning,
  danger: colors.danger,
  muted: colors.textMuted,
};

/**
 * Transaction-style row: leading IconTile, title + subtitle, right-aligned
 * value/badge. Usually stacked inside a `Card` with `padding: 6/14` and
 * `divider` on all rows but the first.
 */
export function ListRow({
  icon,
  iconTone = "ink",
  leading,
  title,
  subtitle,
  value,
  valueTone = "default",
  valueSub,
  trailing,
  children,
  onPress,
  divider,
  style,
}: ListRowProps) {
  const body = (
    <>
      {leading ?? (icon ? <IconTile icon={icon} tone={iconTone} /> : null)}
      <View style={styles.text}>
        <Text style={styles.title} numberOfLines={2}>
          {title}
        </Text>
        {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
        {children}
      </View>
      {value || valueSub ? (
        <View style={styles.valueCol}>
          {value ? <Text style={[styles.value, { color: VALUE_COLOR[valueTone] }]}>{value}</Text> : null}
          {valueSub ? <Text style={styles.valueSub}>{valueSub}</Text> : null}
        </View>
      ) : null}
      {trailing}
    </>
  );

  if (onPress) {
    return (
      <Pressable
        onPress={onPress}
        style={({ pressed }) => [styles.row, divider && styles.divider, pressed && styles.pressed, style]}
      >
        {body}
      </Pressable>
    );
  }
  return <View style={[styles.row, divider && styles.divider, style]}>{body}</View>;
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: spacing.sm + 4, paddingVertical: spacing.sm + 2 },
  divider: { borderTopWidth: 1, borderTopColor: colors.border },
  pressed: { opacity: 0.6 },
  text: { flex: 1, minWidth: 0 },
  title: { ...typography.bodyStrong, fontSize: 14, color: colors.ink },
  subtitle: { ...typography.caption, fontSize: 12, lineHeight: 17, color: colors.textSecondary, marginTop: 1 },
  valueCol: { alignItems: "flex-end" },
  value: { ...typography.number, fontSize: 14 },
  valueSub: { fontSize: 11, color: colors.textMuted, marginTop: 2 },
});
