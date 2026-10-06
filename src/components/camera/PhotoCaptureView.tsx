import { useRef, useState } from "react";
import { ActivityIndicator, Animated, Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { CameraView, useCameraPermissions } from "expo-camera";
import * as ImageManipulator from "expo-image-manipulator";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Button } from "@/components/ui";
import { colors, spacing, typography } from "@/theme";

interface PhotoCaptureViewProps {
  onCapture: (base64Jpeg: string) => void;
  onCancel: () => void;
  /** "front" (default) for presence photos; "back" for photographing a
   * place rather than yourself — see the Field Day visit-log card. */
  facing?: "front" | "back";
}

// Photos are only ever shown as small thumbnails and re-encoded server-side
// (see lib/photoUpload.ts on the backend), so uploading a full 12MP frame just
// makes saving slow. Shrinking on the device first cuts the upload from
// several MB to ~100-200 KB.
const MAX_WIDTH_PX = 1280;
const JPEG_QUALITY = 0.6;

const RING_SIZE = 80;

export function PhotoCaptureView({ onCapture, onCancel, facing = "front" }: PhotoCaptureViewProps) {
  const [permission, requestPermission] = useCameraPermissions();
  const insets = useSafeAreaInsets();
  const cameraRef = useRef<CameraView>(null);
  const [isCapturing, setIsCapturing] = useState(false);
  // On several Android devices, capturing before the preview stream has
  // actually started produces a solid-black frame — gate the shutter on the
  // camera's own "ready" event rather than assuming it's ready on mount.
  const [isReady, setIsReady] = useState(false);
  const pressScale = useRef(new Animated.Value(1)).current;

  if (!permission) return null;

  if (!permission.granted) {
    return (
      <Modal visible animationType="slide" onRequestClose={onCancel} statusBarTranslucent>
        <View style={styles.centered}>
          <Text style={styles.message}>Camera access is needed to take a photo.</Text>
          <Button label="Grant camera access" onPress={requestPermission} style={styles.button} />
          <Button label="Cancel" variant="ghost" onPress={onCancel} />
        </View>
      </Modal>
    );
  }

  const handleCapture = async () => {
    if (!cameraRef.current || !isReady || isCapturing) return;
    setIsCapturing(true);
    try {
      // skipProcessing avoids the slow full-quality re-encode; we resize and
      // compress once ourselves below.
      const photo = await cameraRef.current.takePictureAsync({ quality: 0.8, skipProcessing: true });
      if (!photo?.uri) return;
      const small = await ImageManipulator.manipulateAsync(
        photo.uri,
        [{ resize: { width: MAX_WIDTH_PX } }],
        { compress: JPEG_QUALITY, format: ImageManipulator.SaveFormat.JPEG, base64: true },
      );
      if (small.base64) onCapture(small.base64);
    } finally {
      setIsCapturing(false);
    }
  };

  const animateTo = (value: number) =>
    Animated.timing(pressScale, { toValue: value, duration: 90, useNativeDriver: true }).start();

  return (
    // Rendered inside a Modal rather than swapped directly into the caller's
    // view tree — on Android, a plain unmount of CameraView's native
    // SurfaceView can leave a black frame composited on top of the screen
    // behind it until something else forces a full re-layout (e.g.
    // switching tabs). A Modal owns its own native window, so dismissing it
    // tears the camera surface down cleanly instead. Only reproduces in
    // release builds — dev-client's extra re-layouts happened to mask it.
    <Modal visible animationType="slide" onRequestClose={onCancel} statusBarTranslucent>
      <View style={styles.container}>
        <CameraView ref={cameraRef} style={styles.camera} facing={facing} onCameraReady={() => setIsReady(true)} />

        {/* Close — small and out of the way, like a phone's own camera app. */}
        <Pressable
          onPress={onCancel}
          accessibilityLabel="Close camera"
          hitSlop={12}
          style={[styles.close, { top: insets.top + spacing.sm }]}
        >
          <Text style={styles.closeGlyph}>✕</Text>
        </Pressable>

        {/* Round shutter ring, centred at the bottom. */}
        <View style={[styles.shutterBar, { paddingBottom: insets.bottom + spacing.lg }]}>
          <Pressable
            onPress={handleCapture}
            onPressIn={() => animateTo(0.86)}
            onPressOut={() => animateTo(1)}
            disabled={!isReady || isCapturing}
            accessibilityRole="button"
            accessibilityLabel="Take photo"
            style={[styles.ring, (!isReady || isCapturing) && styles.ringDisabled]}
          >
            <Animated.View style={[styles.shutterCore, { transform: [{ scale: pressScale }] }]}>
              {isCapturing ? <ActivityIndicator color={colors.textSecondary} /> : null}
            </Animated.View>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "black" },
  camera: { flex: 1 },
  close: {
    position: "absolute",
    left: spacing.md,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(0,0,0,0.45)",
    alignItems: "center",
    justifyContent: "center",
  },
  closeGlyph: { color: "#fff", fontSize: 18, fontWeight: "600" },
  shutterBar: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    paddingTop: spacing.lg,
    alignItems: "center",
    backgroundColor: "rgba(0,0,0,0.28)",
  },
  ring: {
    width: RING_SIZE,
    height: RING_SIZE,
    borderRadius: RING_SIZE / 2,
    borderWidth: 4,
    borderColor: "#ffffff",
    alignItems: "center",
    justifyContent: "center",
  },
  ringDisabled: { opacity: 0.55 },
  shutterCore: {
    width: RING_SIZE - 16,
    height: RING_SIZE - 16,
    borderRadius: (RING_SIZE - 16) / 2,
    backgroundColor: "#ffffff",
    alignItems: "center",
    justifyContent: "center",
  },
  centered: { flex: 1, alignItems: "center", justifyContent: "center", padding: spacing.lg },
  message: {
    ...typography.body,
    color: colors.textSecondary,
    textAlign: "center",
    marginBottom: spacing.md,
  },
  button: { marginBottom: spacing.sm, minWidth: 220 },
});
