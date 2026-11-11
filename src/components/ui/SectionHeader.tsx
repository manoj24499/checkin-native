import { ReactNode } from "react";
import { Pressable, StyleSheet, Text, View, ViewStyle } from "react-native";
import { Kicker } from "./Typography";
import { colors, spacing, typography } from "@/theme";

export interface SectionHeaderProps {
  /**
   * Section title. With `kicker` it renders as a Space Grotesk 17 title under the kicker; WITHOUT a kicker
   * the title itself is drawn in the kicker style (11/600 caps, #B34D05) — the mockups' "TODAY" headers.
   */
  title: string;
  /** Optional small-caps line above a bold title. */
  kicker?: string;
  /** Shows the right-hand accent text link when set. */
  onAction?: () => void;
  /** Link text. Default "View all". */
  actionLabel?: string;
  /** Custom right-hand node instead of the link (a Pill/StatusBadge/muted text). */
  right?: ReactNode;
  /** Force the bold-title style even without a kicker. */
  titleStyle?: "kicker" | "title";
  style?: ViewStyle;
}

/**
 * Header row: "TODAY" kicker on the left, accent link ("History") on the right. Use inside a Card (pass
 * `style={{ marginTop: 0 }}`) or between blocks of content.
 */
export function SectionHeader({ title, kicker, onAction, actionLabel = "View all", right, titleStyle, style }: SectionHeaderProps) {
  const asKicker = titleStyle ? titleStyle === "kicker" : !kicker;
  return (
    <View style={[styles.row, style]}>
      <View style={styles.text}>
        {kicker ? <Kicker>{kicker}</Kicker> : null}
        {asKicker ? <Kicker style={styles.kickerTitle}>{title}</Kicker> : <Text style={styles.title}>{title}</Text>}
      </View>
      {right ??
        (onAction ? (
          <Pressable onPress={onAction} hitSlop={10} style={({ pressed }) => pressed && styles.pressed}>
            <Text style={styles.link}>{actionLabel}</Text>
          </Pressable>
        ) : null)}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: spacing.md,
    marginBottom: spacing.sm,
    marginHorizontal: 2,
    gap: spacing.sm,
  },
  text: { flex: 1, minWidth: 0 },
  kickerTitle: { marginBottom: 0 },
  title: { ...typography.section, color: colors.ink },
  pressed: { opacity: 0.6 },
  link: { ...typography.link, color: colors.accentText },
});
