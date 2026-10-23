import { StyleSheet, Text, View } from "react-native";
import { IconTile } from "./IconTile";
import type { IconName } from "./Icon";
import { colors, spacing, typography } from "@/theme";

interface EmptyStateProps {
  title: string;
  message?: string;
  /** Optional icon shown in a muted tile above the title. */
  icon?: IconName;
}

export function EmptyState({ title, message, icon }: EmptyStateProps) {
  return (
    <View style={styles.container}>
      {icon ? <IconTile icon={icon} tone="muted" size={48} style={styles.icon} /> : null}
      <Text style={styles.title}>{title}</Text>
      {message ? <Text style={styles.message}>{message}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { alignItems: "center", justifyContent: "center", padding: spacing.xl },
  icon: { marginBottom: spacing.md },
  title: { ...typography.bodyStrong, color: colors.textPrimary, marginBottom: spacing.xs, textAlign: "center" },
  message: { ...typography.body, fontSize: 14, color: colors.textSecondary, textAlign: "center" },
});
