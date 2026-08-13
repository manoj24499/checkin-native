import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import { LogoMark } from "@/components/branding/LogoMark";
import { colors, spacing, typography } from "@/theme";

interface LoadingViewProps {
  label?: string;
  /** Plays the logo's one-shot build-in — reserve this for genuine
   * once-per-session moments (cold launch/sign-in). This component is also
   * used for routine, frequent loading states (switching to the Dashboard
   * or History tab, a status refetch), where replaying the ~1.1s animation
   * every time would just be repetitive; those get the static logo. */
  animated?: boolean;
}

export function LoadingView({ label = "Loading…", animated = false }: LoadingViewProps) {
  return (
    <View style={styles.container}>
      <LogoMark animated={animated} size={40} barColor={colors.textPrimary} />
      <ActivityIndicator color={colors.primary} size="large" style={styles.spinner} />
      <Text style={styles.label}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: "center", justifyContent: "center" },
  spinner: { marginTop: spacing.lg },
  label: { ...typography.body, color: colors.textSecondary, marginTop: spacing.sm },
});
