import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { Icon } from "./Icon";
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
 * overlay. White, 30px top corners, small grab handle, round close button.
 */
export function BottomSheet({ visible, onClose, kicker, title, children }: BottomSheetProps) {
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose} statusBarTranslucent>
      <View style={styles.backdrop}>
        <Pressable style={styles.backdropTouchable} onPress={onClose} />
        <View style={styles.sheet}>
          <View style={styles.handle} />
          <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.content}>
            <View style={styles.headerRow}>
              <View style={styles.headerText}>
                {kicker ? <Text style={styles.kicker}>{kicker.toUpperCase()}</Text> : null}
                <Text style={styles.title}>{title}</Text>
              </View>
              <Pressable onPress={onClose} style={styles.closeButton} hitSlop={8} accessibilityLabel="Close">
                <Icon name="close" size={16} color={colors.ink} strokeWidth={2} />
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
    borderTopLeftRadius: radius.sheet,
    borderTopRightRadius: radius.sheet,
    maxHeight: "88%",
  },
  handle: {
    alignSelf: "center",
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.inkBorder,
    marginTop: spacing.sm + 2,
  },
  content: { paddingHorizontal: spacing.md + 2, paddingTop: spacing.sm + 2, paddingBottom: spacing.xl },
  headerRow: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: spacing.md },
  headerText: { flex: 1 },
  kicker: { ...typography.kicker, color: colors.textSecondary, fontSize: 10 },
  title: { ...typography.h3, fontSize: 19, fontFamily: "Inter_700Bold", fontWeight: "700", color: colors.ink, marginTop: 4 },
  closeButton: {
    width: 34,
    height: 34,
    borderRadius: 99,
    backgroundColor: colors.surfaceMuted,
    alignItems: "center",
    justifyContent: "center",
  },
});
