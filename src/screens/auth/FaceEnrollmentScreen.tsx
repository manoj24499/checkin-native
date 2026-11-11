import { useState } from "react";
import { Animated, Pressable, StyleSheet, Text, View } from "react-native";
import { StatusBar } from "expo-status-bar";
import { LinearGradient } from "expo-linear-gradient";
import Svg, { ClipPath, Defs, Ellipse, Image as SvgImage, Path, Circle } from "react-native-svg";
import { Screen, Icon, Button, Rise, useLoop } from "@/components/ui";
import { Caps } from "./AuthField";
import { Banner } from "./PinParts";
import { PhotoCaptureView } from "@/components/camera";
import { useAuth, useFaceEnroll } from "@/hooks";
import { getErrorMessage } from "@/utils/errors";
import { colors, fontFamilies, gradientDirection, typography } from "@/theme";

const OVAL_W = 200;
const OVAL_H = 250;
const SCAN_GLOW = "rgba(255,154,61,0.6)";

/** The orange scan line sweeping up and down the oval (Face.dc.html `scan`, 2.2s alternate). */
function ScanLine({ height }: { height: number }) {
  const t = useLoop({ duration: 4400, pingPong: true });
  return (
    <Animated.View
      pointerEvents="none"
      style={[
        styles.scanWrap,
        { transform: [{ translateY: t.interpolate({ inputRange: [0, 1], outputRange: [height * 0.06 - 6, height * 0.9 - 6] }) }] },
      ]}
    >
      {/* soft glow band, then the bright 3px line */}
      <LinearGradient
        colors={["rgba(255,154,61,0)", "rgba(255,154,61,0.22)", "rgba(255,154,61,0)"]}
        {...gradientDirection.vertical}
        style={StyleSheet.absoluteFill}
      />
      <LinearGradient colors={["rgba(255,154,61,0)", "#FFB067", "rgba(255,154,61,0)"]} {...gradientDirection.horizontal} style={styles.scanLine} />
    </Animated.View>
  );
}

/** Breathing orange corner bracket (`brk`: opacity .5 <-> 1, 1.6s). */
function Corner({ pos }: { pos: "tl" | "tr" | "bl" | "br" }) {
  const t = useLoop({ duration: 1600, pingPong: true, restValue: 1 });
  return (
    <Animated.View
      pointerEvents="none"
      style={[styles.corner, styles[pos], { opacity: t.interpolate({ inputRange: [0, 1], outputRange: [0.5, 1] }) }]}
    />
  );
}

function FaceOval({ photoUri, rejected, scanning }: { photoUri: string | null; rejected: boolean; scanning: boolean }) {
  return (
    <View style={{ width: OVAL_W, height: OVAL_H }}>
      <Svg width={OVAL_W} height={OVAL_H} style={StyleSheet.absoluteFill}>
        <Defs>
          <ClipPath id="faceOvalClip">
            <Ellipse cx={OVAL_W / 2} cy={OVAL_H / 2} rx={OVAL_W / 2 - 1} ry={OVAL_H / 2 - 1} />
          </ClipPath>
        </Defs>
        <Ellipse cx={OVAL_W / 2} cy={OVAL_H / 2} rx={OVAL_W / 2 - 1} ry={OVAL_H / 2 - 1} fill="#EAE5DF" />
        {photoUri ? (
          <SvgImage
            href={photoUri}
            x={0}
            y={0}
            width={OVAL_W}
            height={OVAL_H}
            preserveAspectRatio="xMidYMid slice"
            clipPath="url(#faceOvalClip)"
          />
        ) : null}
        <Ellipse
          cx={OVAL_W / 2}
          cy={OVAL_H / 2}
          rx={OVAL_W / 2 - 1}
          ry={OVAL_H / 2 - 1}
          fill="none"
          stroke={rejected ? colors.danger : "rgba(255,154,61,0.5)"}
          strokeWidth={2}
        />
      </Svg>
      {!photoUri ? (
        <View pointerEvents="none" style={styles.placeholder}>
          <Svg width={96} height={96} viewBox="0 0 24 24" fill="none" stroke="#A39A91" strokeWidth={1.1} strokeLinecap="round">
            <Circle cx={12} cy={9} r={4} />
            <Path d="M4 21c0-4 4-6 8-6s8 2 8 6" />
          </Svg>
        </View>
      ) : null}
      {scanning ? (
        <View pointerEvents="none" style={styles.scanClip}>
          <ScanLine height={OVAL_H} />
        </View>
      ) : null}
      <Corner pos="tl" />
      <Corner pos="tr" />
      <Corner pos="bl" />
      <Corner pos="br" />
    </View>
  );
}

/**
 * Mandatory, blocking screen shown by RootNavigator whenever an
 * authenticated employee's `faceVerificationEnabled` is still false and
 * they aren't `faceVerificationExempt` either — i.e. an admin didn't
 * already enroll them with a photo, and hasn't granted the exemption escape
 * hatch (see RootNavigator's gate and its schema comment) for someone who's
 * stuck here. Besides enrolling, "Check again" re-fetches the profile in
 * case an admin already fixed it server-side, and logging out remains an
 * option in case the wrong account got logged into on this device.
 *
 * On successful enrollment, it calls refreshProfile() rather than
 * navigating anywhere itself — RootNavigator re-renders on the updated
 * user.faceVerificationEnabled and swaps this screen out for AppTabs on
 * its own, the same way the rest of the auth gating works.
 */
export function FaceEnrollmentScreen() {
  const { logout, refreshProfile } = useAuth();
  const faceEnroll = useFaceEnroll();

  const [cameraOpen, setCameraOpen] = useState(false);
  const [photoDataUrl, setPhotoDataUrl] = useState<string | null>(null);
  const [rejection, setRejection] = useState<{ kind: "failed" | "unavailable"; message: string } | null>(null);
  const [checkingAgain, setCheckingAgain] = useState(false);
  const [tips, setTips] = useState({ light: false, face: false, glasses: false });

  // An admin can unblock someone stuck here from the backend (re-enrolling
  // them with a better photo, or granting the faceVerificationExempt escape
  // hatch — see RootNavigator's gate) without this screen ever knowing, since
  // it only has whatever profile was fetched at login/last refresh. Rather
  // than force a full logout/login to pick that up, let them ask directly —
  // RootNavigator swaps this screen out on its own once the refreshed
  // profile clears the gate.
  const checkAgain = async () => {
    setCheckingAgain(true);
    try {
      await refreshProfile();
    } catch {
      // Still stuck (or offline) — stay on this screen, nothing else to do.
    } finally {
      setCheckingAgain(false);
    }
  };

  const submit = async (photo: string) => {
    setRejection(null);
    try {
      const result = await faceEnroll.mutateAsync(photo);
      if (result.status === "enrolled") {
        await refreshProfile();
        return;
      }
      setRejection({
        kind: result.status,
        message:
          result.message ??
          (result.status === "failed"
            ? "That photo was rejected. Please try again with a clear, front-facing photo."
            : "Couldn't reach the face-verification service. Please try again shortly."),
      });
    } catch (error) {
      setRejection({ kind: "unavailable", message: getErrorMessage(error) });
    }
  };

  if (cameraOpen) {
    return (
      <PhotoCaptureView
        onCapture={(base64) => {
          const dataUrl = `data:image/jpeg;base64,${base64}`;
          setPhotoDataUrl(dataUrl);
          setCameraOpen(false);
          void submit(dataUrl);
        }}
        onCancel={() => setCameraOpen(false)}
      />
    );
  }

  const pending = faceEnroll.isPending && !rejection;
  const chip = pending
    ? { label: "Checking", fg: colors.accentText, bg: colors.primaryMuted }
    : rejection?.kind === "failed"
      ? { label: "Rejected", fg: colors.danger, bg: colors.dangerMuted }
      : rejection?.kind === "unavailable"
        ? { label: "Service offline", fg: colors.warning, bg: colors.warningMuted }
        : photoDataUrl
          ? { label: "Photo taken", fg: colors.success, bg: colors.successMuted }
          : { label: "Ready", fg: colors.success, bg: colors.successMuted };
  const hint = pending
    ? "Checking your photo…"
    : rejection?.kind === "failed"
      ? "Try again with your whole face in frame"
      : rejection?.kind === "unavailable"
        ? "We kept your photo — nothing to retake"
        : "Fit your face inside the oval";
  const tipDefs: { id: keyof typeof tips; label: string }[] = [
    { id: "light", label: "Good light" },
    { id: "face", label: "Face the camera" },
    { id: "glasses", label: "No sunglasses" },
  ];

  return (
    <Screen
      scroll
      contentStyle={styles.content}
      glows={[{ corner: "topLeft", size: 340, x: -80, y: 260, opacity: 0.4, duration: 10000 }]}
      tabBarClearance={false}
    >
      <StatusBar style="dark" />
      <Rise>
        <Caps>One-time setup</Caps>
        <Text style={styles.title}>Set up face verification</Text>
        <Text style={styles.subtitle}>We check this photo against you at every check-in. Find good light and face the camera.</Text>
      </Rise>

      <Rise delay={120} style={styles.panel}>
        <View style={styles.panelTop}>
          <View style={[styles.chip, { backgroundColor: chip.bg }]}>
            <Text style={[styles.chipText, { color: chip.fg }]}>{chip.label}</Text>
          </View>
          <Text style={styles.panelMeta}>Front camera</Text>
        </View>

        <FaceOval photoUri={photoDataUrl} rejected={rejection?.kind === "failed"} scanning={!photoDataUrl || pending} />

        <Text style={styles.panelHint}>{hint}</Text>
      </Rise>

      {rejection ? (
        <Rise distance={14} duration={500}>
          <Banner tone={rejection.kind === "failed" ? "error" : "muted"}>{rejection.message}</Banner>
        </Rise>
      ) : null}

      {!photoDataUrl && !rejection ? (
        <Rise delay={240} style={styles.tips}>
          {tipDefs.map((t) => {
            const on = tips[t.id];
            return (
              <Pressable
                key={t.id}
                onPress={() => setTips((v) => ({ ...v, [t.id]: !v[t.id] }))}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: on }}
                style={({ pressed }) => [styles.tip, on && styles.tipOn, pressed && { opacity: 0.85 }]}
              >
                <View style={[styles.tick, { backgroundColor: on ? "rgba(74,222,128,0.16)" : "rgba(23,19,15,0.06)" }]}>
                  <Icon name="checkmark" size={14} color={on ? colors.success : colors.textMuted} strokeWidth={2.4} />
                </View>
                <Text style={styles.tipText}>{t.label}</Text>
              </Pressable>
            );
          })}
        </Rise>
      ) : null}

      <Rise delay={340} style={styles.actions}>
        <Button
          size="lg"
          pulse
          label={pending ? "Checking your photo…" : photoDataUrl ? "Retake photo" : "Take selfie"}
          onPress={() => setCameraOpen(true)}
          loading={pending}
        />
        {rejection?.kind === "unavailable" && photoDataUrl ? (
          <Button variant="secondary" size="lg" label="Try again with this photo" onPress={() => void submit(photoDataUrl)} />
        ) : null}
      </Rise>

      <Rise delay={400} style={styles.links}>
        <Pressable
          onPress={() => void checkAgain()}
          disabled={checkingAgain}
          hitSlop={6}
          accessibilityRole="button"
          style={styles.linkHit}
        >
          <Text style={styles.linkText}>
            {checkingAgain ? (
              "Checking…"
            ) : (
              <>
                An admin fixed this? <Text style={styles.linkAccent}>Check again</Text>
              </>
            )}
          </Text>
        </Pressable>
        <Pressable onPress={() => void logout()} hitSlop={6} accessibilityRole="button" style={styles.linkHit}>
          <Text style={styles.linkText}>
            Not you? <Text style={styles.linkAccent}>Log out</Text>
          </Text>
        </Pressable>
      </Rise>
    </Screen>
  );
}

const CORNER = 26;

const styles = StyleSheet.create({
  content: { flexGrow: 1, paddingHorizontal: 20, paddingTop: 12, paddingBottom: 24, gap: 16 },
  title: { ...typography.h1, fontSize: 30, lineHeight: 33, color: colors.ink, marginTop: 4 },
  subtitle: { fontSize: 14, lineHeight: 21, fontFamily: fontFamilies.regular, color: colors.textSecondary, marginTop: 8 },
  panel: {
    borderRadius: 26,
    backgroundColor: colors.surfaceMuted,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    padding: 16,
    alignItems: "center",
    gap: 14,
  },
  panelTop: { alignSelf: "stretch", flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  chip: { borderRadius: 99, paddingHorizontal: 12, paddingVertical: 5 },
  chipText: { fontSize: 12, fontFamily: fontFamilies.semiBold, fontWeight: "600" },
  panelMeta: { fontSize: 12, fontFamily: fontFamilies.regular, color: colors.textSecondary },
  panelHint: { fontSize: 13, fontFamily: fontFamilies.regular, color: colors.textSecondary, textAlign: "center" },
  placeholder: { ...StyleSheet.absoluteFillObject, alignItems: "center", justifyContent: "center" },
  scanClip: { ...StyleSheet.absoluteFillObject, borderRadius: OVAL_W / 2, overflow: "hidden" },
  scanWrap: { position: "absolute", left: 0, right: 0, top: 0, height: 15, justifyContent: "center" },
  scanLine: {
    height: 3,
    shadowColor: SCAN_GLOW,
    shadowOpacity: 1,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 0 },
  },
  corner: { position: "absolute", width: CORNER, height: CORNER, borderColor: "#FF9A3D" },
  tl: { left: -8, top: -4, borderLeftWidth: 3, borderTopWidth: 3, borderTopLeftRadius: 10 },
  tr: { right: -8, top: -4, borderRightWidth: 3, borderTopWidth: 3, borderTopRightRadius: 10 },
  bl: { left: -8, bottom: -4, borderLeftWidth: 3, borderBottomWidth: 3, borderBottomLeftRadius: 10 },
  br: { right: -8, bottom: -4, borderRightWidth: 3, borderBottomWidth: 3, borderBottomRightRadius: 10 },
  tips: { flexDirection: "row", gap: 10 },
  tip: {
    flex: 1,
    borderRadius: 16,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    paddingVertical: 12,
    paddingHorizontal: 8,
    alignItems: "center",
    gap: 8,
  },
  tipOn: { borderColor: "rgba(30,122,77,0.35)" },
  tick: { width: 26, height: 26, borderRadius: 13, alignItems: "center", justifyContent: "center" },
  tipText: { fontSize: 12, fontFamily: fontFamilies.medium, fontWeight: "500", color: colors.ink, textAlign: "center" },
  actions: { gap: 10, marginTop: "auto" },
  links: { alignItems: "center", gap: 2 },
  linkHit: { padding: 8, minHeight: 44, justifyContent: "center" },
  linkText: { fontSize: 14, fontFamily: fontFamilies.regular, color: colors.textSecondary },
  linkAccent: { color: colors.accentText },
});
