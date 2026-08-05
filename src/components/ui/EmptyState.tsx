import { StyleSheet, Text, View } from "react-native";
import { colors, spacing, typography } from "@/theme";

export function EmptyState({ title, message }: { title: string; message?: string }) {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>{title}</Text>
      {message ? <Text style={styles.message}>{message}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { alignItems: "center", justifyContent: "center", padding: spacing.xl },
  title: { ...typography.bodyStrong, color: colors.textPrimary, marginBottom: spacing.xs },
  message: { ...typography.body, color: colors.textSecondary, textAlign: "center" },
});
