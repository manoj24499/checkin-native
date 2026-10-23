import { Modal, StyleSheet, Text, View } from "react-native";
import { Button } from "./Button";
import { IconTile } from "./IconTile";
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
            <IconTile icon="alert" tone="warning" size={40} radius={20} />
            <View style={styles.headerText}>
              <Text style={styles.kicker}>{kicker.toUpperCase()}</Text>
              <Text style={styles.title}>{title}</Text>
            </View>
          </View>

          <Text style={styles.body}>{body}</Text>

          <View style={styles.actionRow}>
            {secondaryLabel && onSecondary ? (
              <Button label={secondaryLabel} onPress={onSecondary} variant="secondary" size="sm" style={styles.action} />
            ) : null}
            <Button label={primaryLabel} onPress={onPrimary} size="sm" style={styles.action} />
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
    borderRadius: radius.card,
    padding: spacing.md + 4,
  },
  headerRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm + 4 },
  headerText: { flex: 1, minWidth: 0 },
  kicker: { ...typography.kicker, color: colors.textSecondary, fontSize: 9.5 },
  title: { ...typography.h3, fontFamily: "Inter_700Bold", fontWeight: "700", color: colors.ink, marginTop: 2 },
  body: { ...typography.body, fontSize: 14, color: colors.textPrimary, marginTop: spacing.md, lineHeight: 20 },
  actionRow: { flexDirection: "row", gap: spacing.sm, marginTop: spacing.lg - 4 },
  action: { flex: 1 },
});
