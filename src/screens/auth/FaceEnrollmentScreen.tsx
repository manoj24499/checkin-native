import { useState } from "react";
import { Image, Pressable, StyleSheet, Text, View } from "react-native";
import { Screen, Card, Button } from "@/components/ui";
import { PhotoCaptureView } from "@/components/camera";
import { useAuth, useFaceEnroll } from "@/hooks";
import { getErrorMessage } from "@/utils/errors";
import { colors, radius, spacing, typography } from "@/theme";

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
      <Text style={styles.kicker}>ONE-TIME SETUP</Text>
      <Text style={styles.title}>Set up face verification</Text>
      <Text style={styles.subtitle}>
        Before you can check in, we need a clear photo of your face on file. This is used to confirm it's really
        you at check-in — take it somewhere well-lit, facing the camera directly.
      </Text>

      <Card style={styles.card}>
        {photoDataUrl ? (
          <Image source={{ uri: photoDataUrl }} style={styles.preview} />
        ) : (
          <View style={styles.placeholder}>
            <Text style={styles.placeholderGlyph}>⌾</Text>
          </View>
        )}

        {rejection ? (
          <Text style={rejection.kind === "failed" ? styles.errorText : styles.warningText}>
            {rejection.message}
          </Text>
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

      <Pressable onPress={() => void checkAgain()} disabled={checkingAgain} hitSlop={12} style={styles.logoutLink}>
        <Text style={styles.logoutText}>{checkingAgain ? "Checking…" : "An admin fixed this? Check again"}</Text>
      </Pressable>

      <Pressable onPress={() => void logout()} hitSlop={12} style={styles.logoutLink}>
        <Text style={styles.logoutText}>Not you? Log out</Text>
      </Pressable>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { justifyContent: "center", flexGrow: 1 },
  kicker: { ...typography.label, letterSpacing: 2, color: colors.textSecondary },
  title: { ...typography.h1, color: colors.textPrimary, marginTop: spacing.xs, marginBottom: spacing.sm },
  subtitle: { ...typography.body, color: colors.textSecondary, marginBottom: spacing.lg },
  card: { alignItems: "stretch", gap: spacing.sm },
  preview: { width: "100%", height: 220, borderRadius: radius.lg, marginBottom: spacing.xs },
  placeholder: {
    width: "100%",
    height: 220,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderStyle: "dashed",
    borderColor: "rgba(134,119,111,0.55)",
    backgroundColor: colors.surfaceMuted,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: spacing.xs,
  },
  placeholderGlyph: { fontSize: 40, color: colors.textSecondary },
  actionButton: { marginTop: spacing.xs },
  pendingText: { ...typography.caption, color: colors.textSecondary, textAlign: "center" },
  errorText: { ...typography.caption, color: colors.danger },
  warningText: { ...typography.caption, color: colors.warning },
  logoutLink: { alignSelf: "center", marginTop: spacing.xl },
  logoutText: { ...typography.bodyStrong, color: colors.textSecondary, fontSize: 13 },
});
