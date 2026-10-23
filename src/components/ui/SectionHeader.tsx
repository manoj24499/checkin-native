import { ReactNode } from "react";
import { Pressable, StyleSheet, Text, View, ViewStyle } from "react-native";
import { Kicker } from "./Typography";
import { colors, spacing, typography } from "@/theme";

export interface SectionHeaderProps {
  /** Bold section title ("Today"). */
  title: string;
  /** Optional small-caps line above the title. */
  kicker?: string;
  /** Shows the outlined "View all" pill when set. */
  onAction?: () => void;
  /** Pill text. Default "View all". */
  actionLabel?: string;
  /** Custom right-hand node instead of the pill (a Pill/StatusBadge/text). */
  right?: ReactNode;
  style?: ViewStyle;
}

/** Title row between blocks of content, with an optional outlined "View all" pill. */
export function SectionHeader({ title, kicker, onAction, actionLabel = "View all", right, style }: SectionHeaderProps) {
  return (
    <View style={[styles.row, style]}>
      <View style={styles.text}>
        {kicker ? <Kicker>{kicker}</Kicker> : null}
        <Text style={styles.title}>{title}</Text>
      </View>
      {right ??
        (onAction ? (
          <Pressable onPress={onAction} hitSlop={8} style={({ pressed }) => [styles.pill, pressed && styles.pressed]}>
            <Text style={styles.pillLabel}>{actionLabel}</Text>
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
    marginTop: spacing.lg - 4,
    marginBottom: spacing.sm,
    marginHorizontal: 2,
    gap: spacing.sm,
  },
  text: { flex: 1, minWidth: 0 },
  title: { ...typography.section, color: colors.ink },
  pill: {
    borderWidth: 1.5,
    borderColor: colors.ink,
    borderRadius: 99,
    paddingHorizontal: 12,
    paddingVertical: 4,
  },
  pressed: { opacity: 0.6 },
  pillLabel: { fontSize: 12, fontWeight: "600", fontFamily: "Inter_600SemiBold", color: colors.ink },
});
