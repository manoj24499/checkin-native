import Svg, { Circle, Path } from "react-native-svg";
import { Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { colors, radius, spacing, typography } from "@/theme";

interface IssueDialogProps {
  visible: boolean;
  kicker: string;
  title: string;
  body: string;
  primaryLabel: string;
  onPrimary: () => void;
  secondaryLabel?: string;
  onSecondary?: () => void;
}

/**
 * Blocking-failure modal — replaces the single inline red-text line that
 * used to be the only error UI for check-in and the three request forms.
 * Ships as one generic dialog for now: the body is always the server's own
 * error message (via getErrorMessage), with only the kicker/title varying
 * by call site. The mockup's version differentiates 8 specific failures
 * with numbered fix-steps and a reference id, which needs backend error
 * codes the Next.js API doesn't have yet — this component's props
 * (`kicker`/`title`/`body`) can grow a `steps`/`reference` list later
 * without changing how any call site uses it.
 */
export function IssueDialog({
  visible,
  kicker,
  title,
  body,
  primaryLabel,
  onPrimary,
  secondaryLabel,
  onSecondary,
}: IssueDialogProps) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onSecondary ?? onPrimary} statusBarTranslucent>
      <View style={styles.backdrop}>
        <View style={styles.dialog}>
          <View style={styles.headerRow}>
            <View style={styles.iconWrap}>
              <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
                <Path d="M12 8v5" stroke={colors.primary} strokeWidth={1.9} strokeLinecap="round" />
                <Path d="M12 16.5v.5" stroke={colors.primary} strokeWidth={1.9} strokeLinecap="round" />
                <Circle cx={12} cy={12} r={9.5} stroke={colors.primary} strokeWidth={1.9} />
              </Svg>
            </View>
            <View style={styles.headerText}>
              <Text style={styles.kicker}>{kicker}</Text>
              <Text style={styles.title}>{title}</Text>
            </View>
          </View>

          <Text style={styles.body}>{body}</Text>

          <View style={styles.actionRow}>
            {secondaryLabel && onSecondary ? (
              <Pressable onPress={onSecondary} style={styles.secondaryButton}>
                <Text style={styles.secondaryLabel}>{secondaryLabel}</Text>
              </Pressable>
            ) : null}
            <Pressable onPress={onPrimary} style={styles.primaryButton}>
              <Text style={styles.primaryLabel}>{primaryLabel}</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: colors.overlay, alignItems: "center", justifyContent: "center", padding: spacing.md + 2 },
  dialog: {
    width: "100%",
    maxWidth: 420,
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    padding: spacing.md + 2,
  },
  headerRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm + 3 },
  iconWrap: {
    width: 34,
    height: 34,
    borderRadius: 99,
    backgroundColor: colors.primaryMuted,
    borderWidth: 1,
    borderColor: colors.primaryMuted,
    alignItems: "center",
    justifyContent: "center",
  },
  headerText: { flex: 1, minWidth: 0 },
  kicker: { ...typography.label, letterSpacing: 2, color: colors.textSecondary, fontSize: 9.5 },
  title: { ...typography.h3, color: colors.textPrimary, marginTop: 3 },
  body: { ...typography.body, color: colors.textPrimary, marginTop: spacing.sm + 3, lineHeight: 20 },
  actionRow: { flexDirection: "row", gap: spacing.sm, marginTop: spacing.md + 2 },
  secondaryButton: {
    flex: 1,
    minHeight: 46,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.textMuted,
    alignItems: "center",
    justifyContent: "center",
  },
  secondaryLabel: { ...typography.bodyStrong, fontSize: 13.5, color: colors.textPrimary },
  primaryButton: {
    flex: 1,
    minHeight: 46,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  primaryLabel: { ...typography.bodyStrong, fontSize: 13.5, color: colors.primaryDark },
});
