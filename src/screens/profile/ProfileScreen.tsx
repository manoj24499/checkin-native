import { useState } from "react";
import { Image, Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import * as Notifications from "expo-notifications";
import * as ImagePicker from "expo-image-picker";
import {
  Screen,
  Button,
  Toggle,
  BottomSheet,
  IssueDialog,
  Card,
  Icon,
  IconButton,
  IconTile,
  Rise,
  Kicker,
  ScreenTitle,
  AvatarBadge,
} from "@/components/ui";
import { PhotoCaptureView } from "@/components/camera";
import { useAuth, useAttendanceStatus, useBiometricAuth, useUploadProfilePhoto } from "@/hooks";
import { formatSlotLabel } from "@/components/checkin";
import type { ProfileStackParamList } from "@/navigation/types";
import { useSettingsStore } from "@/store/settingsStore";
import { useAuthStore } from "@/store/authStore";
import { useOfflineQueueStore } from "@/store/offlineQueueStore";
import { discardOfflineQueue } from "@/services/offlineQueue";
import { countWaitingVisits, discardVisitQueue } from "@/services/visitQueue";
import { useVisitQueueStore } from "@/store/visitQueueStore";
import { forgetVerifiedPin } from "@/services/pinVerifier";
import { promptBiometricAuth, getLastBiometricError } from "@/services/biometrics";
import { registerPushTokenBestEffort } from "@/services/notifications";
import { employeeService } from "@/api/services";
import { endpoints } from "@/api/endpoints";
import { env } from "@/config/env";
import { getErrorMessage, isNetworkError } from "@/utils/errors";
import { colors, fontFamilies, radius, spacing, typography } from "@/theme";

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
  HYBRID: "Hybrid",
};

interface SettingsRowProps {
  label: string;
  help: string;
  value: boolean;
  disabled?: boolean;
  onValueChange: (value: boolean) => void;
  /** Hairline above the row (every row but the first in its card). */
  divider?: boolean;
}

/** Profile.dc.html `.li` with a switch: 14/600 title over a 12px help line, padding 11/16. */
function SettingsRow({ label, help, value, disabled, onValueChange, divider }: SettingsRowProps) {
  return (
    <View style={[styles.li, divider && styles.liDivider]}>
      <View style={styles.liText}>
        <Text style={styles.liTitle}>{label}</Text>
        <Text style={styles.liSub}>{help}</Text>
      </View>
      <Toggle value={value} onValueChange={onValueChange} disabled={disabled} accessibilityLabel={label} />
    </View>
  );
}

/** Profile.dc.html `.li` link row with a chevron. */
function LinkRow({
  title,
  subtitle,
  onPress,
  divider,
}: {
  title: string;
  subtitle: string;
  onPress: () => void;
  divider?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={title}
      style={({ pressed }) => [styles.li, divider && styles.liDivider, pressed && { opacity: 0.6 }]}
    >
      <View style={styles.liText}>
        <Text style={styles.liTitle}>{title}</Text>
        <Text style={styles.liSub}>{subtitle}</Text>
      </View>
      <Icon name="chevronRight" size={16} color={colors.textSecondary} strokeWidth={2} />
    </Pressable>
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
  // Tapping the avatar opens a full-screen viewer of the current photo
  // first (WhatsApp-style) — "Change photo" from inside that is what
  // actually opens the take-a-photo/choose-from-gallery sheet. An employee
  // with no photo yet has nothing to view, so tapping their avatar skips
  // straight to that sheet instead.
  const [viewingPhoto, setViewingPhoto] = useState(false);
  const [avatarSheetOpen, setAvatarSheetOpen] = useState(false);
  const [capturingAvatar, setCapturingAvatar] = useState(false);
  const [avatarError, setAvatarError] = useState<unknown>(null);
  // Cache-busts the profile photo URL so RN's Image component re-fetches
  // instead of reusing previously-cached bytes at the same URL — its own
  // image cache doesn't reliably honor the backend's `Cache-Control:
  // no-store` header the way a browser would. Seeded from Date.now(), not
  // 0: a plain incrementing counter restarts at 0/1/2... on every fresh
  // app launch, so the *same* low nonce values (and therefore the *same*
  // URLs) get reused across different sessions/devices — if the image
  // cache keys purely on URL, a later session's "?v=0" can still hit an
  // earlier session's cached response for that exact URL, which is exactly
  // what caused a real re-uploaded photo to keep showing the old one
  // (confirmed live: EMP001's DB row had genuinely fresh photo bytes, but
  // the app kept displaying the previous photo). Date.now() never repeats
  // across sessions, so this can't happen again.
  const [photoNonce, setPhotoNonce] = useState(() => Date.now());

  const biometricUnlockEnabled = useSettingsStore((s) => s.biometricUnlockEnabled);
  const shiftRemindersEnabled = useSettingsStore((s) => s.shiftRemindersEnabled);
  const liveLocationEnabled = useSettingsStore((s) => s.liveLocationEnabled);
  const setBiometricUnlockEnabled = useSettingsStore((s) => s.setBiometricUnlockEnabled);
  const setShiftRemindersEnabled = useSettingsStore((s) => s.setShiftRemindersEnabled);
  const setLiveLocationEnabled = useSettingsStore((s) => s.setLiveLocationEnabled);

  const [biometricError, setBiometricError] = useState<string | null>(null);
  const [shiftRemindersError, setShiftRemindersError] = useState<string | null>(null);

  // Check-ins/outs saved offline and not sent yet (see services/offlineQueue.ts).
  // They can only be sent with this employee's own sign-in, so signing out
  // means losing them — warn first. Signing out always wipes the queue (PINs
  // and photos included) and the local PIN verifier, so nothing of this
  // employee's stays on a possibly shared phone.
  const unsentCheckIns = useOfflineQueueStore(
    (s) =>
      s.items.filter(
        (i) => i.employeeCode === user?.employeeCode && (i.status === "pending" || i.status === "syncing"),
      ).length,
  );
  // Field visits saved on the phone and not sent yet (services/visitQueue.ts) — same deal.
  const unsentVisits = useVisitQueueStore((s) => countWaitingVisits(s.items, user?.employeeCode));
  const unsentCount = unsentCheckIns + unsentVisits;
  const [confirmLogoutOpen, setConfirmLogoutOpen] = useState(false);
  const signOut = async () => {
    setConfirmLogoutOpen(false);
    await discardOfflineQueue();
    await discardVisitQueue();
    if (user) await forgetVerifiedPin(user.employeeCode);
    await logout();
  };

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
      setPhotoNonce(Date.now());
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
  const photoSource = {
    uri: `${env.apiUrl}${endpoints.profilePhoto}?v=${photoNonce}`,
    headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : undefined,
  };

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
    <Screen scroll glow="topRight" contentStyle={styles.content}>
      <Rise>
        <View accessibilityRole="header">
          <Kicker>Account</Kicker>
          <ScreenTitle style={styles.pageTitle}>Profile</ScreenTitle>
        </View>
      </Rise>

      <Rise delay={80}>
        <Card style={styles.identityCard}>
          <View style={styles.identityRow}>
            <Pressable
              onPress={() => (user?.hasProfilePhoto ? setViewingPhoto(true) : setAvatarSheetOpen(true))}
              style={styles.avatarWrapper}
              accessibilityRole="button"
              accessibilityLabel="Profile photo"
            >
              <AvatarBadge initials={initials} size={AVATAR} pulse="ring" />
              {user?.hasProfilePhoto ? <Image source={photoSource} style={styles.avatarImage} /> : null}
              <View style={styles.avatarEditBadge}>
                <Icon name="camera" size={13} color={colors.primarySoftText} strokeWidth={2} />
              </View>
            </Pressable>
            <View style={styles.identityText}>
              <Text style={styles.name} numberOfLines={2}>
                {user?.name}
              </Text>
              <Text style={styles.meta} numberOfLines={2}>
                {user?.employeeCode} · {user?.email}
              </Text>
            </View>
          </View>

          <View style={styles.statRow}>
            <View style={[styles.statCell, { flex: 1 }]}>
              <Text style={styles.statLabel}>WORK MODE</Text>
              <Text style={styles.statValue} numberOfLines={1} adjustsFontSizeToFit>
                {WORK_MODE_LABEL[user?.workMode ?? "OFFICE"]}
              </Text>
            </View>
            <View style={[styles.statCell, { flex: 1.3 }]}>
              <Text style={styles.statLabel}>SHIFT TIMING</Text>
              <Text style={styles.statValue} numberOfLines={1} adjustsFontSizeToFit>
                {shiftTimingLabel}
              </Text>
            </View>
          </View>
        </Card>
      </Rise>

      <Rise delay={160}>
        <Card style={styles.groupCard}>
          <SettingsRow
            label="Biometric unlock"
            help={biometricAvailable ? "Face ID / fingerprint to unlock the app." : "Not available on this device"}
            value={biometricUnlockEnabled}
            disabled={!biometricAvailable}
            onValueChange={handleBiometricToggle}
          />
          {biometricError ? <Text style={styles.errorText}>Biometric error: {biometricError}</Text> : null}
          <SettingsRow
            label="Shift reminders"
            help="A nudge before your shift starts and ends."
            value={shiftRemindersEnabled}
            onValueChange={handleShiftRemindersToggle}
            divider
          />
          {shiftRemindersError ? <Text style={styles.errorText}>{shiftRemindersError}</Text> : null}
          <SettingsRow
            label="Live location"
            help="Only ever on while checked in"
            value={liveLocationEnabled}
            onValueChange={setLiveLocationEnabled}
            divider
          />
        </Card>
      </Rise>

      <Rise delay={240}>
        <Card style={styles.groupCard}>
          <LinkRow title="Change PIN" subtitle="Keep it private" onPress={() => navigation.navigate("ChangePin")} />
          <LinkRow
            title="History"
            subtitle="Past check-ins and hours"
            onPress={() => navigation.navigate("History")}
            divider
          />
          <LinkRow
            title="Help & report an issue"
            subtitle="Wrong hours, geofence trouble, PIN reset"
            onPress={() => navigation.navigate("ReportIssue")}
            divider
          />
        </Card>
      </Rise>

      <Rise delay={320}>
        <Button
          label="Log out"
          variant="danger"
          onPress={() => (unsentCount > 0 ? setConfirmLogoutOpen(true) : void signOut())}
          style={styles.logout}
          labelStyle={styles.logoutLabel}
        />
      </Rise>

      <Text style={styles.footer}>Inzivo · Employee app</Text>

      <Modal
        visible={viewingPhoto}
        transparent
        animationType="fade"
        statusBarTranslucent
        onRequestClose={() => setViewingPhoto(false)}
      >
        <View style={styles.viewerBackdrop}>
          <IconButton
            icon="close"
            variant="dark"
            onPress={() => setViewingPhoto(false)}
            accessibilityLabel="Close photo"
            style={styles.viewerCloseButton}
          />

          <Image
            source={photoSource}
            style={styles.viewerImage}
            resizeMode="contain"
          />

          <Button
            label="Change photo"
            onPress={() => {
              setViewingPhoto(false);
              setAvatarSheetOpen(true);
            }}
            style={styles.viewerChangeButton}
          />
        </View>
      </Modal>

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
          <IconTile icon="camera" />
          <Text style={styles.avatarSheetOptionLabel}>Take a photo</Text>
        </Pressable>
        <Pressable onPress={pickAvatarFromGallery} style={[styles.avatarSheetOption, styles.avatarSheetOptionLast]}>
          <IconTile icon="image" />
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

      <IssueDialog
        visible={confirmLogoutOpen}
        kicker="UNSENT ITEMS"
        title={
          unsentVisits === 0
            ? `You have ${unsentCount} unsent ${unsentCount === 1 ? "check-in" : "check-ins"}`
            : unsentCheckIns === 0
              ? `You have ${unsentCount} unsent ${unsentCount === 1 ? "visit" : "visits"}`
              : `You have ${unsentCount} unsent check-ins and visits`
        }
        body="They're saved on this phone and will be sent when you're back online. If you log out now, they'll be deleted and won't be recorded."
        primaryLabel="Stay signed in"
        onPrimary={() => setConfirmLogoutOpen(false)}
        secondaryLabel="Log out anyway"
        onSecondary={() => void signOut()}
      />
    </Screen>
  );
}

const AVATAR = 68;

const styles = StyleSheet.create({
  content: { paddingHorizontal: spacing.gutter, paddingTop: 12, gap: 12 },
  pageTitle: { fontSize: 30, lineHeight: 36 },
  identityCard: { borderRadius: 26, padding: 16, gap: 14 },
  identityRow: { flexDirection: "row", alignItems: "center", gap: 14 },
  avatarWrapper: { width: AVATAR, height: AVATAR },
  avatarImage: {
    position: "absolute",
    left: 0,
    top: 0,
    width: AVATAR,
    height: AVATAR,
    borderRadius: AVATAR / 2,
    backgroundColor: colors.surfaceMuted,
  },
  avatarEditBadge: {
    position: "absolute",
    right: -2,
    bottom: -2,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: colors.ink,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarSheetOption: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm + 4,
    paddingVertical: spacing.sm + 4,
    borderBottomWidth: 1,
    borderBottomColor: colors.hairlineSoft,
  },
  avatarSheetOptionLast: { borderBottomWidth: 0 },
  avatarSheetOptionLabel: { ...typography.bodyStrong, color: colors.ink },
  viewerBackdrop: {
    flex: 1,
    backgroundColor: "black",
    alignItems: "center",
    justifyContent: "center",
    padding: spacing.lg,
  },
  viewerCloseButton: { position: "absolute", top: 56, right: spacing.lg, zIndex: 1 },
  viewerImage: { width: "100%", aspectRatio: 1, borderRadius: radius.lg },
  viewerChangeButton: { marginTop: spacing.xl, alignSelf: "stretch" },
  identityText: { flex: 1, minWidth: 0 },
  name: { ...typography.h2, lineHeight: 28, color: colors.ink },
  meta: { fontSize: 12, lineHeight: 16, fontFamily: fontFamilies.regular, color: colors.textSecondary, marginTop: 2 },
  statRow: { flexDirection: "row", gap: 10 },
  statCell: {
    minWidth: 0,
    borderRadius: 14,
    backgroundColor: colors.surfaceMuted,
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  statLabel: { ...typography.statLabel, color: colors.textSecondary },
  statValue: { fontSize: 14, fontWeight: "600", fontFamily: fontFamilies.semiBold, color: colors.ink, marginTop: 3 },
  groupCard: { padding: 0 },
  li: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 11, paddingHorizontal: 16 },
  liDivider: { borderTopWidth: 1, borderTopColor: colors.hairlineSoft },
  liText: { flex: 1, minWidth: 0 },
  liTitle: { fontSize: 14, fontWeight: "600", fontFamily: fontFamilies.semiBold, color: colors.ink, marginBottom: 1 },
  liSub: { fontSize: 12, lineHeight: 16, fontFamily: fontFamilies.regular, color: colors.textSecondary },
  errorText: {
    fontSize: 12,
    lineHeight: 16,
    fontFamily: fontFamilies.regular,
    color: colors.danger,
    paddingHorizontal: 16,
    paddingBottom: 10,
    marginTop: -4,
  },
  footer: { textAlign: "center", fontSize: 11, fontFamily: fontFamilies.regular, color: colors.textSecondary },
  logout: { minHeight: 50, borderRadius: 25 },
  logoutLabel: { fontSize: 15 },
});
