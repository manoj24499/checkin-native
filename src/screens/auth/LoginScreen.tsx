import { useEffect, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { LinearGradient } from "expo-linear-gradient";
import { TextField, Button } from "@/components/ui";
import { BarSpark } from "@/components/dashboard";
import { LogoMark } from "@/components/branding/LogoMark";
import { useAuth, useActivityPattern } from "@/hooks";
import { useSettingsStore } from "@/store/settingsStore";
import { env } from "@/config/env";
import { getErrorMessage } from "@/utils/errors";
import { colors, gradients, radius, spacing, typography } from "@/theme";

interface LoginFormValues {
  organizationCode: string;
  employeeCode: string;
  pin: string;
}

export function LoginScreen() {
  const { login } = useAuth();
  const lastOrganizationCode = useSettingsStore((s) => s.lastOrganizationCode);
  const setLastOrganizationCode = useSettingsStore((s) => s.setLastOrganizationCode);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const spark = useActivityPattern(true);
  const {
    control,
    handleSubmit,
    watch,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<LoginFormValues>({
    defaultValues: { organizationCode: lastOrganizationCode || env.defaultOrganizationCode, employeeCode: "", pin: "" },
  });

  // zustand-persist rehydrates from AsyncStorage asynchronously — this
  // screen can mount before that finishes, in which case the defaultValues
  // above capture an empty string. Correcting the field once the real value
  // loads, rather than only setting it at mount, handles that race.
  useEffect(() => {
    if (lastOrganizationCode) setValue("organizationCode", lastOrganizationCode);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lastOrganizationCode]);

  const organizationCode = watch("organizationCode");
  const employeeCode = watch("employeeCode");
  const pin = watch("pin");
  const ready = organizationCode.trim().length > 0 && employeeCode.trim().length >= 4 && pin.length >= 4;

  const onSubmit = async (values: LoginFormValues) => {
    setSubmitError(null);
    const organizationCode = values.organizationCode.trim();
    try {
      await login(organizationCode, values.employeeCode.trim().toUpperCase(), values.pin.trim());
      // Only remembered on a successful login — an unsuccessful attempt
      // might just be a typo, not the device's real org.
      setLastOrganizationCode(organizationCode);
    } catch (error) {
      setSubmitError(getErrorMessage(error, "Invalid organization code, employee code, or PIN."));
    }
  };

  return (
    <View style={styles.container}>
      <StatusBar style="dark" />
      <LinearGradient colors={gradients.hero} start={{ x: 0.2, y: 0 }} end={{ x: 0.8, y: 1 }} style={styles.heroShell}>
        <View pointerEvents="none" style={styles.heroGlow} />
        <SafeAreaView edges={["top"]} style={styles.hero}>
          <View style={styles.logoRow}>
            <LogoMark animated size={28} barColor={colors.ink} accentColor={colors.limeDeep} />
          </View>
          <Text style={styles.headline}>Check-in Application.</Text>
          <Text style={styles.heroSubtitle}>
            Check in, share your dot while you work, check out. Nothing more.
          </Text>
          <View style={styles.sparkRow}>
            <BarSpark values={spark} color={colors.ink} height={30} />
          </View>
        </SafeAreaView>
      </LinearGradient>

      <ScrollView
        contentContainerStyle={styles.formContent}
        keyboardShouldPersistTaps="handled"
      >
        <Controller
          control={control}
          name="organizationCode"
          rules={{ required: "Organization code is required" }}
          render={({ field: { onChange, onBlur, value } }) => (
            <TextField
              label="Organization code"
              icon="shield"
              placeholder="acme-corp"
              autoCapitalize="none"
              autoCorrect={false}
              value={value}
              onChangeText={onChange}
              onBlur={onBlur}
              error={errors.organizationCode?.message}
            />
          )}
        />

        <Controller
          control={control}
          name="employeeCode"
          rules={{ required: "Employee code is required" }}
          render={({ field: { onChange, onBlur, value } }) => (
            <TextField
              label="Employee code"
              icon="id"
              placeholder="EMP001"
              autoCapitalize="characters"
              autoCorrect={false}
              value={value}
              onChangeText={onChange}
              onBlur={onBlur}
              error={errors.employeeCode?.message}
            />
          )}
        />

        <Controller
          control={control}
          name="pin"
          rules={{
            required: "PIN is required",
            minLength: { value: 4, message: "PIN is too short" },
          }}
          render={({ field: { onChange, onBlur, value } }) => (
            <TextField
              label="PIN"
              icon="lock"
              placeholder="••••••"
              secureTextEntry
              keyboardType="number-pad"
              value={value}
              onChangeText={onChange}
              onBlur={onBlur}
              error={errors.pin?.message}
            />
          )}
        />

        {submitError ? <Text style={styles.error}>{submitError}</Text> : null}

        <Button
          label={ready ? "Sign in" : "Enter code and PIN"}
          onPress={handleSubmit(onSubmit)}
          loading={isSubmitting}
          disabled={!ready}
          style={styles.submit}
        />

        <View style={styles.footer}>
          <View style={styles.footerDot} />
          <Text style={styles.footerText}>
            Geofence and PIN are verified on the server
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  heroShell: {
    borderBottomLeftRadius: radius.hero,
    borderBottomRightRadius: radius.hero,
    overflow: "hidden",
  },
  heroGlow: {
    position: "absolute",
    right: -70,
    top: -50,
    width: 220,
    height: 220,
    borderRadius: 110,
    backgroundColor: "rgba(255,255,255,0.3)",
  },
  hero: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.lg,
  },
  logoRow: { marginTop: spacing.md },
  headline: {
    fontSize: 34,
    fontWeight: "300",
    lineHeight: 39,
    letterSpacing: -0.8,
    color: colors.ink,
    marginTop: spacing.lg - 2,
    maxWidth: 260,
  },
  heroSubtitle: {
    ...typography.body,
    fontSize: 14,
    color: colors.inkMuted,
    marginTop: spacing.sm + 2,
    maxWidth: 280,
  },
  sparkRow: { marginTop: spacing.lg - 2 },
  formContent: { paddingHorizontal: spacing.lg - 4, paddingTop: spacing.lg, paddingBottom: spacing.xl },
  error: {
    ...typography.caption,
    color: colors.danger,
    marginBottom: spacing.md,
  },
  submit: { marginTop: spacing.sm },
  footer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
    marginTop: spacing.lg,
  },
  footerDot: {
    width: 7,
    height: 7,
    borderRadius: 99,
    backgroundColor: colors.success,
  },
  footerText: { ...typography.caption, color: colors.textSecondary },
});
