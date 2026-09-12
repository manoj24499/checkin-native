import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { colors, radius, spacing, typography } from "@/theme";

interface BottomSheetProps {
  visible: boolean;
  onClose: () => void;
  kicker?: string;
  title: string;
  children: React.ReactNode;
}

/**
 * Slide-up sheet used by the Requests screen's three submission forms — no
 * bottom-sheet library is installed (and a fixed-height, non-draggable sheet
 * doesn't need one), so this is built on React Native's own `Modal`, the
 * same primitive `PhotoCaptureView` already uses for its full-screen camera
 * overlay.
 */
export function BottomSheet({ visible, onClose, kicker, title, children }: BottomSheetProps) {
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose} statusBarTranslucent>
      <View style={styles.backdrop}>
        <Pressable style={styles.backdropTouchable} onPress={onClose} />
        <View style={styles.sheet}>
          <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.content}>
            <View style={styles.headerRow}>
              <View style={styles.headerText}>
                {kicker ? <Text style={styles.kicker}>{kicker}</Text> : null}
                <Text style={styles.title}>{title}</Text>
              </View>
              <Pressable onPress={onClose} style={styles.closeButton} hitSlop={8}>
                <Text style={styles.closeGlyph}>✕</Text>
              </Pressable>
            </View>
            {children}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: colors.overlay, justifyContent: "flex-end" },
  backdropTouchable: { flex: 1 },
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    maxHeight: "88%",
  },
  content: { padding: spacing.md + 2, paddingBottom: spacing.xl },
  headerRow: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: spacing.md },
  headerText: { flex: 1 },
  kicker: { ...typography.label, letterSpacing: 2, color: colors.textSecondary, fontSize: 10 },
  title: { ...typography.h3, color: colors.textPrimary, marginTop: 4 },
  closeButton: {
    width: 32,
    height: 32,
    borderRadius: 99,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
  },
  closeGlyph: { color: colors.textSecondary, fontSize: 14 },
});
