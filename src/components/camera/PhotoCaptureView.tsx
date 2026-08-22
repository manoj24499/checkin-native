import { useRef, useState } from "react";
import { Modal, StyleSheet, Text, View } from "react-native";
import { CameraView, useCameraPermissions } from "expo-camera";
import { Button } from "@/components/ui";
import { colors, spacing, typography } from "@/theme";

interface PhotoCaptureViewProps {
  onCapture: (base64Jpeg: string) => void;
  onCancel: () => void;
  /** "front" (default) for presence photos; "back" for photographing a
   * place rather than yourself — see the Field Day visit-log card. */
  facing?: "front" | "back";
}

export function PhotoCaptureView({ onCapture, onCancel, facing = "front" }: PhotoCaptureViewProps) {
  const [permission, requestPermission] = useCameraPermissions();
  const cameraRef = useRef<CameraView>(null);
  const [isCapturing, setIsCapturing] = useState(false);
  // On several Android devices, capturing before the preview stream has
  // actually started produces a solid-black frame — gate the button on the
  // camera's own "ready" event rather than assuming it's ready on mount.
  const [isReady, setIsReady] = useState(false);

  if (!permission) return null;

  if (!permission.granted) {
    return (
      <Modal visible animationType="slide" onRequestClose={onCancel} statusBarTranslucent>
        <View style={styles.centered}>
          <Text style={styles.message}>Camera access is needed to take a check-in photo.</Text>
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
      const photo = await cameraRef.current.takePictureAsync({
        quality: 0.6,
        base64: true,
      });
      if (photo?.base64) onCapture(photo.base64);
    } finally {
      setIsCapturing(false);
    }
  };

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
        <View style={styles.controls}>
          <Button label="Cancel" variant="secondary" onPress={onCancel} style={styles.controlButton} />
          <Button
            label={!isReady ? "Preparing…" : isCapturing ? "Capturing…" : "Capture"}
            onPress={handleCapture}
            disabled={!isReady}
            loading={isCapturing}
            style={styles.controlButton}
          />
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "black" },
  camera: { flex: 1 },
  controls: {
    flexDirection: "row",
    padding: spacing.md,
    gap: spacing.sm,
    backgroundColor: colors.surface,
  },
  controlButton: { flex: 1 },
  centered: { flex: 1, alignItems: "center", justifyContent: "center", padding: spacing.lg },
  message: {
    ...typography.body,
    color: colors.textSecondary,
    textAlign: "center",
    marginBottom: spacing.md,
  },
  button: { marginBottom: spacing.sm, minWidth: 220 },
});
