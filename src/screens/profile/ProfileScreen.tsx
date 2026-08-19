import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Screen, Button, StatusBadge, Toggle } from "@/components/ui";
import { useAuth, useBiometricAuth } from "@/hooks";
import type { ProfileStackParamList } from "@/navigation/types";
import { useSettingsStore } from "@/store/settingsStore";
import { promptBiometricAuth, getLastBiometricError } from "@/services/biometrics";
import { registerPushTokenBestEffort } from "@/services/notifications";
import { colors, spacing, typography } from "@/theme";

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
  const { user, logout } = useAuth();
  const { available: biometricAvailable } = useBiometricAuth();

  const biometricUnlockEnabled = useSettingsStore((s) => s.biometricUnlockEnabled);
  const shiftRemindersEnabled = useSettingsStore((s) => s.shiftRemindersEnabled);
  const liveLocationEnabled = useSettingsStore((s) => s.liveLocationEnabled);
  const setBiometricUnlockEnabled = useSettingsStore((s) => s.setBiometricUnlockEnabled);
  const setShiftRemindersEnabled = useSettingsStore((s) => s.setShiftRemindersEnabled);
  const setLiveLocationEnabled = useSettingsStore((s) => s.setLiveLocationEnabled);

  const [biometricError, setBiometricError] = useState<string | null>(null);

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
    setShiftRemindersEnabled(next);
    if (next) {
      const registered = await registerPushTokenBestEffort();
      if (!registered) setShiftRemindersEnabled(false);
    }
  };

  const initials = (user?.name ?? "?")
    .split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <Screen scroll>
      <Text style={styles.kicker}>ACCOUNT</Text>

      <View style={styles.identityRow}>
        <View style={styles.avatar}>
          <Text style={styles.avatarLabel}>{initials}</Text>
        </View>
        <View style={styles.identityText}>
          <Text style={styles.name}>{user?.name}</Text>
          <Text style={styles.meta}>
            {user?.employeeCode} · {user?.email}
          </Text>
        </View>
      </View>

      <View style={styles.badgeRow}>
        <StatusBadge label={WORK_MODE_LABEL[user?.workMode ?? "OFFICE"]} tone="neutral" />
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
        help="Coming soon — this just enables notification permission now so it's ready when reminders launch"
        value={shiftRemindersEnabled}
        onValueChange={handleShiftRemindersToggle}
      />
      <SettingsRow
        label="Live location"
        help="Only ever on while checked in"
        value={liveLocationEnabled}
        onValueChange={setLiveLocationEnabled}
      />

      <View style={styles.linkGroup}>
        <Pressable style={styles.linkRow} onPress={() => navigation.navigate("Leave")}>
          <Text style={styles.linkLabel}>Leave</Text>
          <Text style={styles.linkChevron}>›</Text>
        </Pressable>

        <Pressable style={[styles.linkRow, styles.linkRowLast]} onPress={() => navigation.navigate("ChangePin")}>
          <Text style={styles.linkLabel}>Change PIN</Text>
          <Text style={styles.linkChevron}>›</Text>
        </Pressable>
      </View>

      <Button label="Log out" variant="danger" onPress={() => logout()} style={styles.logout} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  kicker: { ...typography.label, letterSpacing: 2, color: colors.textSecondary },
  identityRow: { flexDirection: "row", alignItems: "center", gap: spacing.md, marginTop: spacing.md },
  avatar: {
    width: 60,
    height: 60,
    borderRadius: 99,
    backgroundColor: colors.panelDark,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarLabel: { ...typography.h3, color: colors.primarySoftText },
  identityText: { flex: 1, minWidth: 0 },
  name: { ...typography.h2, color: colors.textPrimary },
  meta: { ...typography.body, color: colors.textSecondary, marginTop: spacing.xs },
  badgeRow: { marginTop: spacing.sm },
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
  linkLabel: { ...typography.bodyStrong, color: colors.textPrimary },
  linkChevron: { ...typography.h3, color: colors.textMuted },
  logout: { marginTop: spacing.xl },
});
