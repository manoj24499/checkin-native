import { useState } from "react";
import { Image, Pressable, StyleSheet, Text, View } from "react-native";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import * as Notifications from "expo-notifications";
import * as ImagePicker from "expo-image-picker";
import { Screen, Button, Toggle, BottomSheet, IssueDialog } from "@/components/ui";
import { PhotoCaptureView } from "@/components/camera";
import { useAuth, useAttendanceStatus, useBiometricAuth, useUploadProfilePhoto } from "@/hooks";
import { formatSlotLabel } from "@/components/checkin";
import type { ProfileStackParamList } from "@/navigation/types";
import { useSettingsStore } from "@/store/settingsStore";
import { useAuthStore } from "@/store/authStore";
import { promptBiometricAuth, getLastBiometricError } from "@/services/biometrics";
import { registerPushTokenBestEffort } from "@/services/notifications";
import { employeeService } from "@/api/services";
import { endpoints } from "@/api/endpoints";
import { env } from "@/config/env";
import { getErrorMessage, isNetworkError } from "@/utils/errors";
import { colors, radius, spacing, typography } from "@/theme";

// Same gallery-pick shape as ReportIssueScreen's — quality/size choices
// mirror PhotoCaptureView's own camera capture, so a gallery pick and a
// fresh photo cost the backend the same either way. `allowsEditing: false`
// deliberately — the native OS crop screen this would otherwise launch
// varies a lot across Android OEM skins, and at least one employee found
// it confusing (looked like the only option, with no obvious "confirm/set"
// action). Not needed anyway: the avatar already displays as a circle via
// its own style (resizeMode defaults to "cover"), so whatever's picked
// gets visually cropped square on display without making the employee do
// it by hand first.
const GALLERY_PICK_OPTIONS: ImagePicker.ImagePickerOptions = {
  mediaTypes: ["images"],
  quality: 0.6,
  base64: true,
  allowsEditing: false,
};

const WORK_MODE_LABEL: Record<string, string> = {
  OFFICE: "Office",
  WFH: "Work from home",
  FIELD: "Anywhere",
};

interface SettingsRowProps {
  label: string;
  help: string;
  value: boolean;
  disabled?: boolean;
  onValueChange: (value: boolean) => void;
}

function SettingsRow({ label, help, value, disabled, onValueChange }: SettingsRowProps) {
  return (
    <View style={styles.settingsRow}>
      <View style={styles.settingsRowText}>
        <Text style={styles.settingsLabel}>{label}</Text>
        <Text style={styles.settingsHelp}>{help}</Text>
      </View>
      <Toggle value={value} onValueChange={onValueChange} disabled={disabled} />
    </View>
  );
}

export function ProfileScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<ProfileStackParamList>>();
  const { user, logout, refreshProfile } = useAuth();
  const accessToken = useAuthStore((s) => s.accessToken);
  const { available: biometricAvailable } = useBiometricAuth();
  const statusQuery = useAttendanceStatus(user?.employeeCode);
  const shiftStartTime = statusQuery.data?.exists ? statusQuery.data.shiftStartTime : null;
  const shiftEndTime = statusQuery.data?.exists ? statusQuery.data.shiftEndTime : null;
  const shiftTimingLabel =
    shiftStartTime && shiftEndTime ? `${formatSlotLabel(shiftStartTime)} – ${formatSlotLabel(shiftEndTime)}` : "—";

  const uploadPhoto = useUploadProfilePhoto();
  const [avatarSheetOpen, setAvatarSheetOpen] = useState(false);
  const [capturingAvatar, setCapturingAvatar] = useState(false);
  const [avatarError, setAvatarError] = useState<unknown>(null);
  // Bumped after every successful upload so the <Image> below re-fetches
  // instead of showing its previously-cached bytes at the same URL.
  const [photoNonce, setPhotoNonce] = useState(0);

  const biometricUnlockEnabled = useSettingsStore((s) => s.biometricUnlockEnabled);
  const shiftRemindersEnabled = useSettingsStore((s) => s.shiftRemindersEnabled);
  const liveLocationEnabled = useSettingsStore((s) => s.liveLocationEnabled);
  const setBiometricUnlockEnabled = useSettingsStore((s) => s.setBiometricUnlockEnabled);
  const setShiftRemindersEnabled = useSettingsStore((s) => s.setShiftRemindersEnabled);
  const setLiveLocationEnabled = useSettingsStore((s) => s.setLiveLocationEnabled);

  const [biometricError, setBiometricError] = useState<string | null>(null);
  const [shiftRemindersError, setShiftRemindersError] = useState<string | null>(null);

  const handleBiometricToggle = async (next: boolean) => {
    setBiometricError(null);
    if (next) {
      const verified = await promptBiometricAuth("Enable biometric unlock");
      if (!verified) {
        setBiometricError(getLastBiometricError());
        return;
      }
    }
    setBiometricUnlockEnabled(next);
  };

  const handleShiftRemindersToggle = async (next: boolean) => {
    setShiftRemindersError(null);
    setShiftRemindersEnabled(next);
    if (next) {
      const result = await registerPushTokenBestEffort();
      if (!result.ok) {
        setShiftRemindersEnabled(false);
        // "Denied and can't re-ask" is the one case with a concrete fix the
        // employee can take themselves (the OS won't re-prompt; it has to be
        // flipped on from the phone's own Settings app) — check for it
        // specifically. Every other failure now shows the actual underlying
        // reason (see PushTokenRegistrationResult) instead of a generic
        // "check your connection" that was previously shown regardless of
        // real cause.
        const { status, canAskAgain } = await Notifications.getPermissionsAsync();
        setShiftRemindersError(
          status === "denied" && !canAskAgain
            ? "Notifications are turned off for this app. Enable them in your phone's Settings, then try again."
            : `Couldn't enable reminders: ${result.reason ?? "unknown error"}`,
        );
        return;
      }
    }
    // Best-effort — if this fails (offline, etc.), the local toggle still
    // reflects what the employee asked for; it'll just retry silently next
    // time they flip it, rather than blocking the UI on a network call.
    try {
      await employeeService.updateShiftReminders(next);
    } catch {
      // Non-fatal.
    }
  };

  const handleAvatarPhoto = async (dataUrl: string) => {
    setAvatarError(null);
    try {
      await uploadPhoto.mutateAsync(dataUrl);
      setPhotoNonce((n) => n + 1);
      // Updates user.hasProfilePhoto so the <Image> below actually renders
      // instead of still falling back to initials after a first-ever upload.
      await refreshProfile();
    } catch (err) {
      setAvatarError(err);
    }
  };

  const pickAvatarFromGallery = async () => {
    setAvatarSheetOpen(false);
    setAvatarError(null);
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      setAvatarError(
        new Error("Photo library access is needed to choose a photo. Enable it in your phone's Settings."),
      );
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync(GALLERY_PICK_OPTIONS);
    if (!result.canceled && result.assets[0]?.base64) {
      await handleAvatarPhoto(`data:image/jpeg;base64,${result.assets[0].base64}`);
    }
  };

  const initials = (user?.name ?? "?")
    .split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  if (capturingAvatar) {
    return (
      <PhotoCaptureView
        // "front" — a profile photo is a picture of the employee
        // themselves, unlike ReportIssueScreen's back-camera default.
        facing="front"
        onCapture={(base64) => {
          setCapturingAvatar(false);
          void handleAvatarPhoto(`data:image/jpeg;base64,${base64}`);
        }}
        onCancel={() => setCapturingAvatar(false)}
      />
    );
  }

  return (
    <Screen scroll>
      <Text style={styles.kicker}>ACCOUNT</Text>

      <View style={styles.identityRow}>
        <Pressable onPress={() => setAvatarSheetOpen(true)} style={styles.avatarWrapper}>
          {user?.hasProfilePhoto ? (
            <Image
              source={{
                uri: `${env.apiUrl}${endpoints.profilePhoto}?v=${photoNonce}`,
                headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : undefined,
              }}
              style={styles.avatarImage}
            />
          ) : (
            <View style={styles.avatar}>
              <Text style={styles.avatarLabel}>{initials}</Text>
            </View>
          )}
          <View style={styles.avatarEditBadge}>
            <Text style={styles.avatarEditGlyph}>📷</Text>
          </View>
        </Pressable>
        <View style={styles.identityText}>
          <Text style={styles.name}>{user?.name}</Text>
          <Text style={styles.meta}>
            {user?.employeeCode} · {user?.email}
          </Text>
        </View>
      </View>

      <View style={styles.statRow}>
        <View style={styles.statCell}>
          <Text style={styles.statLabel}>WORK MODE</Text>
          <Text style={styles.statValue}>{WORK_MODE_LABEL[user?.workMode ?? "OFFICE"]}</Text>
        </View>
        <View style={styles.statCell}>
          <Text style={styles.statLabel}>SHIFT TIMING</Text>
          <Text style={styles.statValue}>{shiftTimingLabel}</Text>
        </View>
      </View>

      <View style={styles.divider} />

      <SettingsRow
        label="Biometric unlock"
        help={
          biometricAvailable
            ? "Face ID / fingerprint to unlock the app. If that fails, your phone's own lock code works too — not your employee PIN."
            : "Not available on this device"
        }
        value={biometricUnlockEnabled}
        disabled={!biometricAvailable}
        onValueChange={handleBiometricToggle}
      />
      {biometricError ? <Text style={styles.errorText}>Biometric error: {biometricError}</Text> : null}
      <SettingsRow
        label="Shift reminders"
        help="A nudge to check out ~10 minutes before your shift (or approved overtime) ends"
        value={shiftRemindersEnabled}
        onValueChange={handleShiftRemindersToggle}
      />
      {shiftRemindersError ? <Text style={styles.errorText}>{shiftRemindersError}</Text> : null}
      <SettingsRow
        label="Live location"
        help="Only ever on while checked in"
        value={liveLocationEnabled}
        onValueChange={setLiveLocationEnabled}
      />

      <View style={styles.linkGroup}>
        <Pressable style={styles.linkRow} onPress={() => navigation.navigate("History")}>
          <Text style={styles.linkLabel}>History</Text>
          <Text style={styles.linkChevron}>›</Text>
        </Pressable>

        <Pressable style={styles.linkRow} onPress={() => navigation.navigate("ChangePin")}>
          <Text style={styles.linkLabel}>Change PIN</Text>
          <Text style={styles.linkChevron}>›</Text>
        </Pressable>

        <Pressable style={[styles.linkRow, styles.linkRowLast]} onPress={() => navigation.navigate("ReportIssue")}>
          <View style={styles.linkTextGroup}>
            <Text style={styles.linkLabel}>Help & report an issue</Text>
            <Text style={styles.linkSub}>Wrong hours, geofence trouble, PIN reset</Text>
          </View>
          <Text style={styles.linkChevron}>›</Text>
        </Pressable>
      </View>

      <Button label="Log out" variant="danger" onPress={() => logout()} style={styles.logout} />

      <BottomSheet
        visible={avatarSheetOpen}
        onClose={() => setAvatarSheetOpen(false)}
        kicker="PROFILE PHOTO"
        title="Update your photo"
      >
        <Pressable
          onPress={() => {
            setAvatarSheetOpen(false);
            setCapturingAvatar(true);
          }}
          style={styles.avatarSheetOption}
        >
          <Text style={styles.avatarSheetOptionLabel}>Take a photo</Text>
        </Pressable>
        <Pressable onPress={pickAvatarFromGallery} style={[styles.avatarSheetOption, styles.avatarSheetOptionLast]}>
          <Text style={styles.avatarSheetOptionLabel}>Choose from gallery</Text>
        </Pressable>
      </BottomSheet>

      <IssueDialog
        visible={!!avatarError}
        kicker={isNetworkError(avatarError) ? "NO CONNECTION" : "COULDN'T UPDATE PHOTO"}
        title={isNetworkError(avatarError) ? "You're offline" : "Couldn't update your photo"}
        body={getErrorMessage(avatarError, "Couldn't update your photo. Please try again.")}
        primaryLabel="Dismiss"
        onPrimary={() => setAvatarError(null)}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  kicker: { ...typography.label, letterSpacing: 2, color: colors.textSecondary },
  identityRow: { flexDirection: "row", alignItems: "center", gap: spacing.md, marginTop: spacing.md },
  avatarWrapper: { width: 60, height: 60 },
  avatar: {
    width: 60,
    height: 60,
    borderRadius: 99,
    backgroundColor: colors.primaryMuted,
    borderWidth: 1,
    borderColor: colors.primaryMuted,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarImage: { width: 60, height: 60, borderRadius: 99 },
  avatarLabel: { ...typography.h3, color: colors.primaryDark },
  avatarEditBadge: {
    position: "absolute",
    right: -2,
    bottom: -2,
    width: 22,
    height: 22,
    borderRadius: 99,
    backgroundColor: colors.primary,
    borderWidth: 2,
    borderColor: colors.background,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarEditGlyph: { fontSize: 10 },
  avatarSheetOption: {
    paddingVertical: spacing.sm + 6,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  avatarSheetOptionLast: { borderBottomWidth: 0 },
  avatarSheetOptionLabel: { ...typography.bodyStrong, color: colors.textPrimary },
  identityText: { flex: 1, minWidth: 0 },
  name: { ...typography.h2, color: colors.textPrimary },
  meta: { ...typography.body, color: colors.textSecondary, marginTop: spacing.xs },
  statRow: {
    flexDirection: "row",
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  statCell: {
    flex: 1,
    borderRadius: radius.sm,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.sm + 3,
  },
  statLabel: { fontSize: 9, letterSpacing: 1.5, color: colors.textMuted, fontWeight: "600" },
  statValue: { ...typography.bodyStrong, color: colors.textPrimary, marginTop: 4 },
  divider: { height: 1, backgroundColor: colors.border, marginVertical: spacing.lg },
  settingsRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    paddingVertical: spacing.sm + 4,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  settingsRowText: { flex: 1, minWidth: 0 },
  settingsLabel: { ...typography.bodyStrong, color: colors.textPrimary },
  settingsHelp: { ...typography.caption, color: colors.textSecondary, marginTop: 4 },
  errorText: { ...typography.caption, color: colors.danger, marginTop: -spacing.xs, marginBottom: spacing.sm },
  linkGroup: { marginTop: spacing.sm, borderTopWidth: 1, borderTopColor: colors.border },
  linkRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: spacing.sm + 4,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  linkRowLast: { borderBottomWidth: 0 },
  linkTextGroup: { flex: 1, minWidth: 0 },
  linkLabel: { ...typography.bodyStrong, color: colors.textPrimary },
  linkSub: { ...typography.caption, color: colors.textSecondary, marginTop: 2 },
  linkChevron: { ...typography.h3, color: colors.textMuted },
  logout: { marginTop: spacing.xl },
});
