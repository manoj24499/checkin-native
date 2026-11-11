import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, Animated, Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { CameraView, useCameraPermissions } from "expo-camera";
import * as ImageManipulator from "expo-image-manipulator";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { LinearGradient } from "expo-linear-gradient";
import Svg, { Path } from "react-native-svg";
import { AmbientGlow, Button, Icon, IconTile, loopEasing, useLoop, useReducedMotion } from "@/components/ui";
import { colors, fontFamilies, gradientDirection, motion } from "@/theme";

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

// Camera.dc.html palette.
const CAM_BG = "#0B0907";
const CHROME = "rgba(255,255,255,0.14)";
const FOCUS_YELLOW = "#FFD35C";
const BAR_HEIGHT = 170; // + bottom inset (mockup: 204 at 844 incl. the home indicator)

/** Orange scan line sweeping the preview (`scan`, 3s alternate). */
function ScanLine({ top, height }: { top: number; height: number }) {
  const t = useLoop({ duration: 6000, pingPong: true });
  return (
    <Animated.View
      pointerEvents="none"
      style={[
        styles.scanWrap,
        { top, transform: [{ translateY: t.interpolate({ inputRange: [0, 1], outputRange: [height * 0.1, height * 0.9] }) }] },
      ]}
    >
      <LinearGradient
        colors={["rgba(255,154,61,0)", "rgba(255,154,61,0.2)", "rgba(255,154,61,0)"]}
        {...gradientDirection.vertical}
        style={StyleSheet.absoluteFill}
      />
      <LinearGradient colors={["rgba(255,154,61,0)", "#FFB067", "rgba(255,154,61,0)"]} {...gradientDirection.horizontal} style={styles.scanLine} />
    </Animated.View>
  );
}

/** Yellow focus square that settles in once (`focus`: scale 1.5 -> 1, fade in). */
function FocusSquare() {
  const reduced = useReducedMotion();
  const v = useRef(new Animated.Value(reduced ? 1 : 0)).current;
  useEffect(() => {
    if (reduced) return;
    const a = Animated.timing(v, { toValue: 1, duration: 1400 * 0.6, easing: motion.riseEasing, useNativeDriver: true });
    a.start();
    return () => a.stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return (
    <Animated.View
      pointerEvents="none"
      style={[
        styles.focusSquare,
        {
          opacity: v.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0, 1, 1] }),
          transform: [{ scale: v.interpolate({ inputRange: [0, 1], outputRange: [1.5, 1] }) }],
        },
      ]}
    />
  );
}

/** White shutter disc with an expanding halo (`shut`, 2.2s). */
function ShutterCore({ scale, busy, enabled }: { scale: Animated.Value; busy: boolean; enabled: boolean }) {
  const t = useLoop({ duration: 2200, easing: loopEasing.easeOut, enabled, restValue: 1 });
  return (
    <View style={styles.coreBox}>
      <Animated.View
        pointerEvents="none"
        style={[
          styles.coreHalo,
          {
            opacity: t.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0.5, 0, 0] }),
            transform: [{ scale: t.interpolate({ inputRange: [0, 0.5, 1], outputRange: [1, 88 / 60, 88 / 60] }) }],
          },
        ]}
      />
      <Animated.View style={[styles.shutterCore, { transform: [{ scale }] }]}>
        {busy ? <ActivityIndicator color={CAM_BG} /> : null}
      </Animated.View>
    </View>
  );
}

function BoltIcon({ color }: { color: string }) {
  return (
    <Svg width={22} height={22} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M13 3L5 14h6l-1 7 8-11h-6z" fill={color === "#FFFFFF" ? "none" : color} />
    </Svg>
  );
}

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
  const [torch, setTorch] = useState(false);
  const [previewHeight, setPreviewHeight] = useState(0);

  if (!permission) return null;

  if (!permission.granted) {
    return (
      <Modal visible animationType="slide" onRequestClose={onCancel} statusBarTranslucent>
        <StatusBar style="dark" />
        <View style={styles.centered}>
          <AmbientGlow preset="subtle" />
          <IconTile icon="camera" tone="lime" size={72} />
          <Text style={styles.offTitle}>Camera is off</Text>
          <Text style={styles.message}>Camera access is needed to take a photo. It&apos;s only used while this screen is open.</Text>
          <View style={styles.offActions}>
            <Button size="lg" pulse label="Grant camera access" onPress={() => void requestPermission()} />
            <Button size="lg" variant="secondary" label="Cancel" onPress={onCancel} />
          </View>
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

  const barHeight = BAR_HEIGHT + insets.bottom;
  const shutterOff = !isReady || isCapturing;

  return (
    // Rendered inside a Modal rather than swapped directly into the caller's
    // view tree — on Android, a plain unmount of CameraView's native
    // SurfaceView can leave a black frame composited on top of the screen
    // behind it until something else forces a full re-layout (e.g.
    // switching tabs). A Modal owns its own native window, so dismissing it
    // tears the camera surface down cleanly instead. Only reproduces in
    // release builds — dev-client's extra re-layouts happened to mask it.
    <Modal visible animationType="slide" onRequestClose={onCancel} statusBarTranslucent>
      <StatusBar style="light" />
      <View style={styles.container}>
        <View style={[styles.preview, { bottom: barHeight }]} onLayout={(e) => setPreviewHeight(e.nativeEvent.layout.height)}>
          <CameraView
            ref={cameraRef}
            style={StyleSheet.absoluteFill}
            facing={facing}
            enableTorch={torch}
            onCameraReady={() => setIsReady(true)}
          />

          {/* Rule-of-thirds grid + guide (purely visual). */}
          <View pointerEvents="none" style={StyleSheet.absoluteFill}>
            <View style={[styles.gridV, { left: "33.333%" }]} />
            <View style={[styles.gridV, { left: "66.666%" }]} />
            <View style={[styles.gridH, { top: "33.333%" }]} />
            <View style={[styles.gridH, { top: "66.666%" }]} />
          </View>
          <View pointerEvents="none" style={styles.guideWrap}>
            {facing === "front" ? <View style={styles.oval} /> : <FocusSquare />}
          </View>
          {previewHeight > 0 ? <ScanLine top={0} height={previewHeight} /> : null}

          <Text pointerEvents="none" style={styles.hint}>
            {facing === "front" ? "Fit your face inside the oval, then tap the shutter" : "Frame the place clearly, then tap the shutter"}
          </Text>
        </View>

        <View style={[styles.topBar, { top: insets.top + 12 }]}>
          <Pressable onPress={onCancel} accessibilityRole="button" accessibilityLabel="Close camera" hitSlop={8} style={styles.roundBtn}>
            <Icon name="close" size={22} color="#FFFFFF" strokeWidth={1.9} />
          </Pressable>
          <View style={styles.titleChip}>
            <Text style={styles.titleChipText}>{facing === "front" ? "Presence photo" : "Take a photo"}</Text>
          </View>
          <Pressable
            onPress={() => setTorch((v) => !v)}
            accessibilityRole="button"
            accessibilityLabel="Flash"
            accessibilityState={{ selected: torch }}
            hitSlop={8}
            style={[styles.roundBtn, torch && styles.roundBtnOn]}
          >
            <BoltIcon color={torch ? FOCUS_YELLOW : "#FFFFFF"} />
          </Pressable>
        </View>

        <View style={[styles.shutterBar, { height: barHeight, paddingBottom: insets.bottom }]}>
          <View style={styles.sideSlot}>
            <Text style={styles.camLabel}>{facing === "front" ? "Front" : "Back"}</Text>
          </View>
          <Pressable
            onPress={handleCapture}
            onPressIn={() => animateTo(0.88)}
            onPressOut={() => animateTo(1)}
            disabled={shutterOff}
            accessibilityRole="button"
            accessibilityLabel="Take photo"
            accessibilityState={{ disabled: shutterOff, busy: isCapturing }}
            style={[styles.ring, shutterOff && styles.ringDisabled]}
          >
            <ShutterCore scale={pressScale} busy={isCapturing} enabled={!shutterOff} />
          </Pressable>
          <View style={styles.sideSlot} />
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: CAM_BG },
  preview: { position: "absolute", left: 0, right: 0, top: 0, overflow: "hidden", backgroundColor: "#16120F" },
  gridV: { position: "absolute", top: 0, bottom: 0, width: StyleSheet.hairlineWidth * 2, backgroundColor: "rgba(255,255,255,0.12)" },
  gridH: { position: "absolute", left: 0, right: 0, height: StyleSheet.hairlineWidth * 2, backgroundColor: "rgba(255,255,255,0.12)" },
  guideWrap: { ...StyleSheet.absoluteFillObject, alignItems: "center", justifyContent: "center" },
  oval: {
    width: 240,
    height: 310,
    borderRadius: 999,
    borderWidth: 2,
    borderStyle: "dashed",
    borderColor: "rgba(255,176,103,0.8)",
  },
  focusSquare: { width: 120, height: 120, borderWidth: 2, borderColor: FOCUS_YELLOW, borderRadius: 6 },
  scanWrap: { position: "absolute", left: 0, right: 0, height: 17, marginTop: -8, justifyContent: "center" },
  scanLine: { height: 3 },
  hint: {
    position: "absolute",
    left: 16,
    right: 16,
    bottom: 28,
    textAlign: "center",
    fontSize: 13,
    fontFamily: fontFamilies.regular,
    color: "rgba(255,255,255,0.75)",
  },
  topBar: {
    position: "absolute",
    left: 20,
    right: 20,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  roundBtn: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: CHROME,
    alignItems: "center",
    justifyContent: "center",
  },
  roundBtnOn: { backgroundColor: "rgba(255,211,92,0.22)" },
  titleChip: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 99, backgroundColor: CHROME },
  titleChipText: { fontSize: 15, fontFamily: fontFamilies.semiBold, fontWeight: "600", color: "#FFFFFF" },
  shutterBar: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-around",
    paddingHorizontal: 32,
    backgroundColor: CAM_BG,
  },
  sideSlot: { width: 48, height: 48, alignItems: "center", justifyContent: "center" },
  camLabel: { fontSize: 13, fontFamily: fontFamilies.medium, color: "rgba(255,255,255,0.75)" },
  ring: {
    width: 78,
    height: 78,
    borderRadius: 39,
    borderWidth: 4,
    borderColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
  },
  ringDisabled: { opacity: 0.55 },
  coreBox: { width: 60, height: 60, alignItems: "center", justifyContent: "center" },
  coreHalo: { position: "absolute", width: 60, height: 60, borderRadius: 30, backgroundColor: "#FFFFFF" },
  shutterCore: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
  },
  centered: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
    gap: 16,
    backgroundColor: colors.background,
  },
  offTitle: { fontSize: 24, lineHeight: 30, fontFamily: fontFamilies.display700, fontWeight: "700", color: colors.ink },
  message: { fontSize: 15, lineHeight: 22, fontFamily: fontFamilies.regular, color: colors.textSecondary, textAlign: "center", maxWidth: 300 },
  offActions: { alignSelf: "stretch", gap: 10, marginTop: 8 },
});
