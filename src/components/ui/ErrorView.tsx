import { StyleSheet, Text, View } from "react-native";
import { Button } from "./Button";
import { colors, spacing, typography } from "@/theme";

export function ErrorView({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Something went wrong</Text>
      <Text style={styles.message}>{message}</Text>
      {onRetry ? (
        <Button label="Try again" onPress={onRetry} variant="secondary" style={styles.retry} />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: "center", justifyContent: "center", padding: spacing.lg },
  title: { ...typography.h3, color: colors.textPrimary, marginBottom: spacing.xs },
  message: { ...typography.body, color: colors.textSecondary, textAlign: "center" },
  retry: { marginTop: spacing.md, minWidth: 160 },
});
