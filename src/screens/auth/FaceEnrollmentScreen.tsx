import { useState } from "react";
import { Image, Pressable, StyleSheet, Text, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Screen, Card, Button, Icon, Kicker } from "@/components/ui";
import { PhotoCaptureView } from "@/components/camera";
import { useAuth, useFaceEnroll } from "@/hooks";
import { getErrorMessage } from "@/utils/errors";
import { colors, gradients, radius, spacing, typography } from "@/theme";

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

  return (
    <Screen scroll contentStyle={styles.content}>
      <Kicker>ONE-TIME SETUP</Kicker>
      <Text style={styles.title}>Set up face verification</Text>
      <Text style={styles.subtitle}>
        Before you can check in, we need a clear photo of your face on file. This is used to confirm it's really
        you at check-in — take it somewhere well-lit, facing the camera directly.
      </Text>

      <Card style={styles.card}>
        {photoDataUrl ? (
          <Image source={{ uri: photoDataUrl }} style={styles.preview} />
        ) : (
          <LinearGradient
            colors={gradients.placeholder}
            start={{ x: 0.2, y: 0 }}
            end={{ x: 0.8, y: 1 }}
            style={styles.placeholder}
          >
            <Icon name="user" size={56} color={colors.textSecondary} strokeWidth={1.5} />
            {/* Face-frame corner brackets. */}
            <View pointerEvents="none" style={styles.frame}>
              <View style={[styles.corner, styles.cornerTL]} />
              <View style={[styles.corner, styles.cornerTR]} />
              <View style={[styles.corner, styles.cornerBL]} />
              <View style={[styles.corner, styles.cornerBR]} />
            </View>
          </LinearGradient>
        )}

        {rejection ? (
          <View style={rejection.kind === "failed" ? styles.errorNote : styles.warningNote}>
            <Text style={rejection.kind === "failed" ? styles.errorText : styles.warningText}>
              {rejection.message}
            </Text>
          </View>
        ) : null}

        <Button
          label={photoDataUrl ? "Retake photo" : "Take selfie"}
          onPress={() => setCameraOpen(true)}
          style={styles.actionButton}
        />
        {rejection?.kind === "unavailable" && photoDataUrl ? (
          <Button
            label="Try again"
            variant="secondary"
            loading={faceEnroll.isPending}
            onPress={() => void submit(photoDataUrl)}
            style={styles.actionButton}
          />
        ) : null}
        {faceEnroll.isPending && !rejection ? <Text style={styles.pendingText}>Checking your photo…</Text> : null}
      </Card>

      <View style={styles.links}>
        <Pressable onPress={() => void checkAgain()} disabled={checkingAgain} hitSlop={12}>
          <Text style={styles.linkText}>{checkingAgain ? "Checking…" : "An admin fixed this? Check again"}</Text>
        </Pressable>

        <Pressable onPress={() => void logout()} hitSlop={12}>
          <Text style={styles.linkText}>Not you? Log out</Text>
        </Pressable>
      </View>
    </Screen>
  );
}

const CORNER = 24;

const styles = StyleSheet.create({
  content: { justifyContent: "center", flexGrow: 1 },
  title: { ...typography.h1, fontSize: 26, color: colors.ink, marginTop: 2, marginBottom: spacing.sm },
  subtitle: { ...typography.body, fontSize: 14, lineHeight: 20, color: colors.textSecondary, marginBottom: spacing.lg },
  card: { alignItems: "stretch", gap: spacing.sm },
  preview: { width: "100%", height: 220, borderRadius: radius.lg, marginBottom: spacing.xs },
  placeholder: {
    width: "100%",
    height: 220,
    borderRadius: radius.lg,
    borderWidth: 2,
    borderStyle: "dashed",
    borderColor: "rgba(14,36,16,0.3)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: spacing.xs,
    overflow: "hidden",
  },
  frame: { position: "absolute", width: 120, height: 150 },
  corner: { position: "absolute", width: CORNER, height: CORNER, borderColor: colors.ink },
  cornerTL: { left: 0, top: 0, borderLeftWidth: 3, borderTopWidth: 3, borderTopLeftRadius: 10 },
  cornerTR: { right: 0, top: 0, borderRightWidth: 3, borderTopWidth: 3, borderTopRightRadius: 10 },
  cornerBL: { left: 0, bottom: 0, borderLeftWidth: 3, borderBottomWidth: 3, borderBottomLeftRadius: 10 },
  cornerBR: { right: 0, bottom: 0, borderRightWidth: 3, borderBottomWidth: 3, borderBottomRightRadius: 10 },
  actionButton: { marginTop: spacing.xs },
  pendingText: { ...typography.caption, color: colors.textSecondary, textAlign: "center" },
  errorNote: { backgroundColor: colors.dangerMuted, borderRadius: radius.input, padding: spacing.sm + 4 },
  warningNote: { backgroundColor: colors.warningMuted, borderRadius: radius.input, padding: spacing.sm + 4 },
  errorText: { ...typography.caption, lineHeight: 18, color: colors.danger },
  warningText: { ...typography.caption, lineHeight: 18, color: colors.warningText },
  links: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "center",
    columnGap: spacing.lg - 6,
    rowGap: spacing.sm,
    marginTop: spacing.lg,
  },
  linkText: { ...typography.bodyStrong, color: colors.primaryDark, fontSize: 13 },
});
