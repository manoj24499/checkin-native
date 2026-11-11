import { ReactNode } from "react";
import { Pressable, StyleSheet, Text, View, ViewStyle } from "react-native";
import { IconTile, type IconTileTone } from "./IconTile";
import type { IconSource } from "./Icon";
import { colors, fontFamilies, spacing, typography } from "@/theme";

type ValueTone = "default" | "accent" | "success" | "warning" | "danger" | "muted";

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
  /** Right-aligned value 13/600 ("On time", "9h 29m", "₹197"). */
  value?: string;
  valueTone?: ValueTone;
  /** Small 11px secondary caption under the value ("Face + PIN"). */
  valueSub?: string;
  /** Custom right-hand node (StatusBadge, Toggle, chevron). Rendered after `value`. */
  trailing?: ReactNode;
  /** Children render under the title/subtitle (extra lines, progress bar). */
  children?: ReactNode;
  onPress?: () => void;
  /** Hairline divider above the row (set on every row except the first in a Card). */
  divider?: boolean;
  /** Dim the title to secondary (an upcoming/not-yet-done item, e.g. "Check out" before it happens). */
  muted?: boolean;
  style?: ViewStyle;
}

const VALUE_COLOR: Record<ValueTone, string> = {
  default: colors.ink,
  accent: colors.accentText,
  success: colors.success,
  warning: colors.warning,
  danger: colors.danger,
  muted: colors.textSecondary,
};

/**
 * Row from Main.dc.html's TODAY list: optional leading IconTile, title 14/600 over a 12px secondary subtitle,
 * right-aligned value 13/600 with an 11px caption under it (`valueSub`), or a `trailing` node (Pill, chevron,
 * Toggle). Stack inside a `Card` (padding 6/16) with `divider` on every row but the first; padding 12/0.
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
  muted,
  style,
}: ListRowProps) {
  const body = (
    <>
      {leading ?? (icon ? <IconTile icon={icon} tone={iconTone} /> : null)}
      <View style={styles.text}>
        <Text style={[styles.title, muted && styles.titleMuted]} numberOfLines={2}>
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
  row: { flexDirection: "row", alignItems: "center", gap: spacing.sm + 4, paddingVertical: 12 },
  divider: { borderTopWidth: 1, borderTopColor: colors.hairlineSoft },
  pressed: { opacity: 0.6 },
  text: { flex: 1, minWidth: 0 },
  title: { ...typography.bodyStrong, fontSize: 14, color: colors.ink, marginBottom: 2 },
  titleMuted: { color: colors.textSecondary },
  subtitle: { ...typography.caption, fontSize: 12, lineHeight: 16, color: colors.textSecondary },
  valueCol: { alignItems: "flex-end" },
  value: { fontSize: 13, fontWeight: "600", fontFamily: fontFamilies.semiBold, fontVariant: ["tabular-nums"] },
  valueSub: { fontSize: 11, fontFamily: fontFamilies.regular, color: colors.textSecondary, marginTop: 2 },
});
