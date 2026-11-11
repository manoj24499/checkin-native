import { useState } from "react";
import { Image, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { useNavigation } from "@react-navigation/native";
import * as ImagePicker from "expo-image-picker";
import {
  Screen,
  Button,
  Card,
  IssueDialog,
  Icon,
  IconButton,
  Kicker,
  Rise,
  ScreenTitle,
  StatusBadge,
  PulseRing,
  type IconName,
} from "@/components/ui";
import { PhotoCaptureView } from "@/components/camera";
import { useSubmitSupportTicket } from "@/hooks";
import { getErrorMessage, isNetworkError } from "@/utils/errors";
import { colors, fontFamilies, spacing, typography } from "@/theme";

const CATEGORIES: { id: string; label: string; icon: IconName; placeholder: string }[] = [
  { id: "hours", label: "Wrong hours", icon: "clock", placeholder: "e.g. My check-out from yesterday looks wrong" },
  { id: "geo", label: "Geofence trouble", icon: "pin", placeholder: "e.g. It says I'm outside the office when I'm at my desk" },
  { id: "pin", label: "PIN reset", icon: "lock", placeholder: "e.g. I forgot my PIN and don't have a reset code" },
  { id: "other", label: "Something else", icon: "help", placeholder: "Tell us what happened" },
];

/** ReportIssue.dc.html hairline on topic tiles / photo buttons (10% ink). */
const TILE_BORDER = "rgba(23,19,15,0.10)";

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
  const [cat, setCat] = useState("hours");
  const [photoDataUrl, setPhotoDataUrl] = useState<string | null>(null);
  const [capturing, setCapturing] = useState(false);
  const [pickError, setPickError] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<unknown>(null);
  const [submitted, setSubmitted] = useState(false);
  const [focused, setFocused] = useState(false);

  const currentCat = CATEGORIES.find((c) => c.id === cat) ?? CATEGORIES[0];
  const canSubmit = message.trim().length >= 10;

  const onSubmit = async () => {
    if (!canSubmit) return;
    setSubmitError(null);
    try {
      // The topic chip is prefixed onto the message so the admin sees it (the API takes only a message).
      await mutateAsync({ message: `[${currentCat.label}] ${message.trim()}`, photo: photoDataUrl ?? undefined });
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

  const header = (
    <Rise style={styles.headerRow}>
      <IconButton icon="back" onPress={() => navigation.goBack()} accessibilityLabel="Back" />
      <View accessibilityRole="header">
        <Kicker>Support</Kicker>
        <ScreenTitle style={styles.title}>Report an issue</ScreenTitle>
      </View>
    </Rise>
  );

  if (submitted) {
    return (
      <Screen scroll glow="topRight" glowIntensity={0.6} contentStyle={styles.content}>
        {header}
        <Rise delay={80}>
          <Card style={styles.successCard}>
            <View style={styles.successIconBox}>
              <PulseRing size={72} color={colors.liveDot} scaleTo={1.45} opacityFrom={0.45} />
              <View style={styles.successIcon}>
                <Icon name="checkmark" size={32} color={colors.success} strokeWidth={2.5} />
              </View>
            </View>
            <Text style={styles.successTitle}>Thanks — we'll take a look</Text>
            <Text style={styles.successBody}>Your admin has it now. You'll get a notification when it's resolved.</Text>
          </Card>
        </Rise>
        <Rise delay={160}>
          <Card style={styles.summaryCard}>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Topic</Text>
              <Text style={styles.summaryValue}>{currentCat.label}</Text>
            </View>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Photo</Text>
              <Text style={styles.summaryValue}>{photoDataUrl ? "1 attached" : "None"}</Text>
            </View>
            <View style={[styles.summaryRow, { borderBottomWidth: 0 }]}>
              <Text style={styles.summaryLabel}>Status</Text>
              <StatusBadge label="Open" tone="warning" />
            </View>
          </Card>
        </Rise>
        <View style={{ flex: 1 }} />
        <Rise delay={240}>
          <Button label="Done" size="lg" onPress={() => navigation.goBack()} />
        </Rise>
      </Screen>
    );
  }

  return (
    <Screen scroll glow="topRight" glowIntensity={0.6} contentStyle={styles.content}>
      {header}

      <Rise delay={80}>
        <Text style={styles.label}>WHAT'S IT ABOUT?</Text>
        <View style={styles.catGrid}>
          {CATEGORIES.map((c) => {
            const on = c.id === cat;
            return (
              <Pressable
                key={c.id}
                onPress={() => setCat(c.id)}
                accessibilityRole="button"
                accessibilityState={{ selected: on }}
                style={({ pressed }) => [styles.tp, on && styles.tpOn, pressed && { opacity: 0.8 }]}
              >
                <View style={[styles.tpIcon, on && styles.tpIconOn]}>
                  <Icon name={c.icon} size={17} color={on ? "#FFFFFF" : colors.ink} />
                </View>
                <Text style={[styles.tpLabel, on && styles.tpLabelOn]} numberOfLines={2}>
                  {c.label}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </Rise>

      <Rise delay={160}>
        <View style={styles.labelRow}>
          <Text style={[styles.label, { marginBottom: 0 }]}>WHAT'S WRONG?</Text>
          <Text style={styles.count}>{message.length} / 500</Text>
        </View>
        <TextInput
          placeholder={currentCat.placeholder}
          placeholderTextColor={colors.textMuted}
          selectionColor={colors.primary}
          cursorColor={colors.primary}
          value={message}
          onChangeText={(t) => setMessage(t.slice(0, 500))}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          multiline
          textAlignVertical="top"
          style={[styles.textarea, focused && styles.textareaFocused]}
        />
      </Rise>

      <Rise delay={240}>
        <Text style={styles.label}>SCREENSHOT OR PHOTO (OPTIONAL)</Text>
        {photoDataUrl ? (
          <View style={styles.photoRow}>
            <Image source={{ uri: photoDataUrl }} style={styles.photoThumb} />
            <View style={{ flex: 1 }}>
              <Text style={styles.photoTitle}>Photo attached</Text>
              <Text style={styles.photoSub}>Screenshot · 1 image</Text>
            </View>
            <Pressable onPress={() => setPhotoDataUrl(null)} style={styles.remove} accessibilityRole="button">
              <Text style={styles.removeLabel}>Remove photo</Text>
            </Pressable>
          </View>
        ) : (
          <View style={styles.photoSourceRow}>
            <Pressable
              onPress={() => setCapturing(true)}
              accessibilityRole="button"
              style={({ pressed }) => [styles.ph, pressed && { opacity: 0.7 }]}
            >
              <Icon name="camera" size={17} color={colors.ink} />
              <Text style={styles.phLabel} numberOfLines={1}>
                Take a photo
              </Text>
            </Pressable>
            <Pressable
              onPress={pickFromGallery}
              accessibilityRole="button"
              style={({ pressed }) => [styles.ph, pressed && { opacity: 0.7 }]}
            >
              <Icon name="image" size={17} color={colors.ink} />
              <Text style={styles.phLabel} numberOfLines={1}>
                Choose from gallery
              </Text>
            </Pressable>
          </View>
        )}
        {pickError ? <Text style={styles.errorText}>{pickError}</Text> : null}
      </Rise>

      <Rise delay={300}>
        <Text style={styles.noteText}>Your name, employee code and app version are sent with this report.</Text>
      </Rise>

      <Rise delay={360}>
        <Button
          variant="solid"
          size="lg"
          pulse={canSubmit}
          label={message.trim().length < 10 ? "Describe the issue to submit" : "Submit"}
          onPress={onSubmit}
          loading={isPending}
          disabled={!canSubmit}
        />
      </Rise>

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
  content: { flexGrow: 1, paddingHorizontal: spacing.gutter, paddingTop: 12, gap: 14 },
  headerRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  title: { fontSize: 26, lineHeight: 32 },
  label: { ...typography.kicker, color: colors.textSecondary, marginBottom: 8 },
  labelRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 8 },
  count: { fontSize: 12, fontFamily: fontFamilies.regular, color: colors.textSecondary, fontVariant: ["tabular-nums"] },
  catGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  tp: {
    width: "48%",
    flexGrow: 1,
    height: 60,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: TILE_BORDER,
    backgroundColor: colors.surface,
    paddingHorizontal: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  tpOn: { borderWidth: 1.5, borderColor: colors.primary, backgroundColor: "rgba(239,108,0,0.08)" },
  tpIcon: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: "rgba(23,19,15,0.06)",
    alignItems: "center",
    justifyContent: "center",
  },
  tpIconOn: { backgroundColor: colors.primary },
  tpLabel: { flex: 1, fontSize: 13, lineHeight: 17, fontWeight: "500", fontFamily: fontFamilies.medium, color: colors.ink },
  tpLabelOn: { fontWeight: "600", fontFamily: fontFamilies.semiBold },
  textarea: {
    minHeight: 116,
    borderWidth: 1,
    borderColor: colors.inputBorder,
    borderRadius: 16,
    backgroundColor: colors.surface,
    paddingHorizontal: 14,
    paddingTop: 12,
    paddingBottom: 12,
    fontSize: 14,
    lineHeight: 21,
    fontFamily: fontFamilies.regular,
    color: colors.ink,
  },
  textareaFocused: { borderWidth: 1.5, borderColor: colors.primary },
  photoSourceRow: { flexDirection: "row", gap: 10 },
  ph: {
    flex: 1,
    height: 48,
    flexDirection: "row",
    gap: 8,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: TILE_BORDER,
    backgroundColor: colors.surface,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 8,
  },
  phLabel: { fontSize: 13, fontWeight: "500", fontFamily: fontFamilies.medium, color: colors.ink, flexShrink: 1 },
  photoRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 8,
    borderRadius: 16,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: TILE_BORDER,
  },
  photoThumb: { width: 48, height: 48, borderRadius: 10, backgroundColor: colors.surfaceMuted },
  photoTitle: { fontSize: 14, fontWeight: "600", fontFamily: fontFamilies.semiBold, color: colors.ink },
  photoSub: { fontSize: 12, fontFamily: fontFamilies.regular, color: colors.textSecondary },
  remove: { minHeight: 44, paddingHorizontal: 12, justifyContent: "center" },
  removeLabel: { fontSize: 13, fontWeight: "500", fontFamily: fontFamilies.medium, color: colors.danger },
  errorText: { fontSize: 13, fontFamily: fontFamilies.regular, color: colors.danger, marginTop: 8 },
  noteText: { fontSize: 12, lineHeight: 18, fontFamily: fontFamilies.regular, color: colors.textSecondary },
  successCard: { alignItems: "center", gap: 14, paddingVertical: 28, paddingHorizontal: 24 },
  successIconBox: { width: 72, height: 72 },
  successIcon: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: colors.successMuted,
    alignItems: "center",
    justifyContent: "center",
  },
  successTitle: { ...typography.h2, color: colors.ink, textAlign: "center" },
  successBody: { fontSize: 14, lineHeight: 21, fontFamily: fontFamilies.regular, color: colors.textSecondary, textAlign: "center" },
  summaryCard: { paddingVertical: 4 },
  summaryRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.hairlineSoft,
  },
  summaryLabel: { fontSize: 14, fontFamily: fontFamilies.regular, color: colors.textSecondary },
  summaryValue: { fontSize: 14, fontWeight: "600", fontFamily: fontFamilies.semiBold, color: colors.ink },
});
