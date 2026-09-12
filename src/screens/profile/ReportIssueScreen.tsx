import { useState } from "react";
import { Image, Pressable, StyleSheet, Text, View } from "react-native";
import { useNavigation } from "@react-navigation/native";
import * as ImagePicker from "expo-image-picker";
import { Screen, Button, TextField, IssueDialog } from "@/components/ui";
import { PhotoCaptureView } from "@/components/camera";
import { useSubmitSupportTicket } from "@/hooks";
import { getErrorMessage, isNetworkError } from "@/utils/errors";
import { colors, radius, spacing, typography } from "@/theme";

// Quality/size choices mirror PhotoCaptureView's own camera capture, so a
// gallery pick and a fresh photo end up costing the backend the same either
// way (decodePhoto resizes/recompresses server-side regardless, but there's
// no reason to upload a full-resolution gallery original just to have it
// thrown away).
const GALLERY_PICK_OPTIONS: ImagePicker.ImagePickerOptions = {
  mediaTypes: ["images"],
  quality: 0.6,
  base64: true,
  allowsEditing: false,
};

/**
 * Replaces the old static "Help & who to contact" sheet (which showed
 * placeholder HR contact info that was never real) — an employee describes
 * what's wrong and optionally attaches a photo, an admin reviews it on
 * /admin/support. No reply thread, but the employee does get a push
 * notification once the admin marks it resolved (see
 * app/api/admin/support/[id]/route.ts in the backend) so they know it was
 * seen — this screen itself only ever confirms the report went through.
 */
export function ReportIssueScreen() {
  const navigation = useNavigation();
  const { mutateAsync, isPending } = useSubmitSupportTicket();
  const [message, setMessage] = useState("");
  const [photoDataUrl, setPhotoDataUrl] = useState<string | null>(null);
  const [capturing, setCapturing] = useState(false);
  const [pickError, setPickError] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<unknown>(null);
  const [submitted, setSubmitted] = useState(false);

  const canSubmit = message.trim().length > 0;

  const onSubmit = async () => {
    if (!canSubmit) return;
    setSubmitError(null);
    try {
      await mutateAsync({ message: message.trim(), photo: photoDataUrl ?? undefined });
      setSubmitted(true);
    } catch (error) {
      setSubmitError(error);
    }
  };

  // Whatever the issue is has usually already happened by the time it's
  // reported (a wrong hours display from yesterday, an error message that
  // already flashed by) — a live camera shot can't capture that after the
  // fact, so picking an existing photo (a screenshot, most often) has to be
  // an option here, not just the camera-only flow check-in/overtime use.
  const pickFromGallery = async () => {
    setPickError(null);
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      setPickError("Photo library access is needed to attach a photo. Enable it in your phone's Settings.");
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync(GALLERY_PICK_OPTIONS);
    if (!result.canceled && result.assets[0]?.base64) {
      setPhotoDataUrl(`data:image/jpeg;base64,${result.assets[0].base64}`);
    }
  };

  if (capturing) {
    return (
      <PhotoCaptureView
        // "back", not the front/selfie default the check-in flow uses —
        // reporting an issue is about photographing a problem (a screen, a
        // location), never the employee's own face.
        facing="back"
        onCapture={(base64) => {
          setPhotoDataUrl(`data:image/jpeg;base64,${base64}`);
          setCapturing(false);
        }}
        onCancel={() => setCapturing(false)}
      />
    );
  }

  if (submitted) {
    return (
      <Screen>
        <Text style={styles.kicker}>SUPPORT</Text>
        <Text style={styles.title}>Thanks — we'll take a look</Text>
        <Text style={styles.body}>
          Your report went through. Your admin can see it from their dashboard and will follow up if they need
          more from you.
        </Text>
        <Button label="Done" onPress={() => navigation.goBack()} style={styles.submit} />
      </Screen>
    );
  }

  return (
    <Screen scroll>
      <Text style={styles.kicker}>SUPPORT</Text>
      <Text style={styles.title}>Report an issue</Text>
      <Text style={styles.body}>
        Wrong hours, geofence trouble, a forgotten PIN, anything else — describe what happened and your admin
        will follow up.
      </Text>

      <TextField
        label="WHAT'S WRONG?"
        placeholder="e.g. My check-out from yesterday looks wrong"
        value={message}
        onChangeText={setMessage}
        multiline
        style={styles.messageField}
      />

      {photoDataUrl ? (
        <>
          <View style={[styles.photoTile, styles.photoTileReady]}>
            <Image source={{ uri: photoDataUrl }} style={styles.photoPreview} />
          </View>
          <Pressable onPress={() => setPhotoDataUrl(null)} style={styles.retake}>
            <Text style={styles.retakeLabel}>Remove photo</Text>
          </Pressable>
        </>
      ) : (
        <View style={styles.photoSourceRow}>
          <Pressable onPress={() => setCapturing(true)} style={styles.photoSourceButton}>
            <Text style={styles.photoSourceLabel}>Take a photo</Text>
          </Pressable>
          <Pressable onPress={pickFromGallery} style={styles.photoSourceButton}>
            <Text style={styles.photoSourceLabel}>Choose from gallery</Text>
          </Pressable>
        </View>
      )}
      {pickError ? <Text style={styles.errorText}>{pickError}</Text> : null}

      <Button label="Submit" onPress={onSubmit} loading={isPending} disabled={!canSubmit} style={styles.submit} />

      <IssueDialog
        visible={!!submitError}
        kicker={isNetworkError(submitError) ? "NO CONNECTION" : "REQUEST NOT SENT"}
        title={isNetworkError(submitError) ? "You're offline" : "Couldn't submit your report"}
        body={getErrorMessage(submitError, "Couldn't submit your report. Please try again.")}
        primaryLabel="Dismiss"
        onPrimary={() => setSubmitError(null)}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  kicker: { ...typography.label, letterSpacing: 2, color: colors.textSecondary },
  title: { ...typography.h2, color: colors.textPrimary, marginTop: spacing.xs },
  body: { ...typography.body, color: colors.textSecondary, marginTop: spacing.sm },
  messageField: { marginTop: spacing.lg },
  photoTile: {
    marginTop: spacing.md,
    height: 96,
    borderWidth: 1,
    borderStyle: "dashed",
    borderColor: colors.border,
    borderRadius: radius.sm,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  photoTileReady: { borderStyle: "solid", borderColor: colors.success },
  photoPreview: { width: "100%", height: "100%" },
  photoSourceRow: { flexDirection: "row", gap: spacing.sm, marginTop: spacing.md },
  photoSourceButton: {
    flex: 1,
    height: 96,
    borderWidth: 1,
    borderStyle: "dashed",
    borderColor: colors.border,
    borderRadius: radius.sm,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: spacing.sm,
  },
  photoSourceLabel: { ...typography.caption, color: colors.textSecondary, textAlign: "center" },
  retake: { marginTop: spacing.sm, alignSelf: "flex-start" },
  retakeLabel: { ...typography.caption, color: colors.danger },
  errorText: { ...typography.caption, color: colors.danger, marginTop: spacing.sm },
  submit: { marginTop: spacing.xl },
});
