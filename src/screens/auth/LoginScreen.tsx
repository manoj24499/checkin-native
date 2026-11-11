import { useEffect, useState } from "react";
import { useNavigation, useRoute, type RouteProp } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Controller, useForm } from "react-hook-form";
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { AmbientGlow, Button, GradientFill, Icon, LivePill, Rise } from "@/components/ui";
import { BrandLockup } from "@/components/branding/BrandLockup";
import { AuthField, Caps, fieldLabelStyles } from "./AuthField";
import { Banner, PinDotsField } from "./PinParts";
import { BreathRings, WaveLayers } from "./AuthDecor";
import { useAuth } from "@/hooks";
import { useSettingsStore } from "@/store/settingsStore";
import { env } from "@/config/env";
import { AxiosError } from "axios";
import { getErrorMessage } from "@/utils/errors";
import { colors, fontFamilies, typography } from "@/theme";
import type { AuthStackParamList } from "@/navigation/types";

interface LoginFormValues {
  organizationCode: string;
  employeeCode: string;
  pin: string;
}

export function LoginScreen() {
  const { login } = useAuth();
  const navigation = useNavigation<NativeStackNavigationProp<AuthStackParamList, "Login">>();
  const route = useRoute<RouteProp<AuthStackParamList, "Login">>();
  const notice = route.params?.notice ?? null;
  const lastOrganizationCode = useSettingsStore((s) => s.lastOrganizationCode);
  const setLastOrganizationCode = useSettingsStore((s) => s.setLastOrganizationCode);
  const [submitError, setSubmitError] = useState<string | null>(null);
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

  // Arriving from a finished PIN reset: fill in who they are so only the new PIN is left to type.
  useEffect(() => {
    if (route.params?.organizationCode) setValue("organizationCode", route.params.organizationCode);
    if (route.params?.employeeCode) setValue("employeeCode", route.params.employeeCode);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [route.params?.organizationCode, route.params?.employeeCode]);

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
      // Signed in with the temporary PIN an admin generated: off to choose their own, with the fields filled in.
      if (error instanceof AxiosError && (error.response?.data as { code?: string } | undefined)?.code === "PIN_CHANGE_REQUIRED") {
        navigation.navigate("SetupPin", {
          organizationCode,
          employeeCode: values.employeeCode.trim().toUpperCase(),
          tempPin: values.pin.trim(),
        });
        return;
      }
      setSubmitError(getErrorMessage(error, "Invalid organization code, employee code, or PIN."));
    }
  };

  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
  const empTrim = employeeCode.trim();
  const orgTrim = organizationCode.trim();
  const chips = [
    { label: "Org", done: orgTrim.length > 0 },
    { label: "ID", done: empTrim.length >= 4 },
    { label: `PIN ${pin.length}`, done: pin.length >= 4 },
  ];

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <StatusBar style="dark" />
      <AmbientGlow preset="login" />
      <WaveLayers />
      <BreathRings />
      <SafeAreaView edges={["top"]} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          <Rise style={styles.topRow}>
            <BrandLockup />
            <LivePill tone="glass" label="Sign in" dotColor="#FF9A3D" style={styles.signInChip} />
          </Rise>

          <Rise delay={100}>
            <Caps>{greeting}</Caps>
            <Text style={styles.headline}>Who&apos;s checking in?</Text>
            <Text style={styles.sub}>Use the codes and PIN your admin gave you.</Text>
          </Rise>

          <Rise delay={200} style={styles.idCard}>
            <GradientFill style={styles.avatar}>
              {empTrim ? (
                <Text style={styles.avatarText}>{empTrim.slice(-3).toUpperCase()}</Text>
              ) : (
                <Icon name="person" size={22} color={colors.onOrange} strokeWidth={2} />
              )}
            </GradientFill>
            <View style={{ flex: 1 }}>
              <Text numberOfLines={1} style={[styles.idName, !empTrim && styles.idPlaceholder]}>
                {empTrim.toUpperCase() || "Employee code"}
              </Text>
              <Text numberOfLines={1} style={styles.idOrg}>
                {orgTrim ? `Organization ${orgTrim}` : "Organization —"}
              </Text>
              <View style={styles.chipRow}>
                {chips.map((c) => (
                  <View key={c.label} style={[styles.chip, c.done ? styles.chipDone : styles.chipTodo]}>
                    <Text style={[styles.chipText, { color: c.done ? colors.success : colors.textSecondary }]}>
                      {c.done ? `${c.label} ✓` : c.label}
                    </Text>
                  </View>
                ))}
              </View>
            </View>
          </Rise>

          <Rise delay={300} style={styles.twoCol}>
            <Controller
              control={control}
              name="organizationCode"
              rules={{ required: "Organization code is required" }}
              render={({ field: { onChange, onBlur, value } }) => (
                <AuthField
                  label="Organization code"
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
                <AuthField
                  label="Employee code"
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
          </Rise>

          <Rise delay={380} style={{ gap: 6 }}>
            <View style={styles.pinHeader}>
              <Text style={fieldLabelStyles.label}>PIN</Text>
              <Pressable
                onPress={() =>
                  navigation.navigate("ResetPin", {
                    organizationCode: organizationCode.trim() || undefined,
                    employeeCode: employeeCode.trim().toUpperCase() || undefined,
                  })
                }
                hitSlop={8}
                accessibilityRole="button"
                style={{ paddingVertical: 4 }}
              >
                <Text style={styles.link}>Forgot PIN?</Text>
              </Pressable>
            </View>
            <Controller
              control={control}
              name="pin"
              rules={{
                required: "PIN is required",
                minLength: { value: 4, message: "PIN is too short" },
              }}
              render={({ field: { onChange, onBlur, value } }) => (
                <PinDotsField
                  variant="hero"
                  secureTextEntry
                  accessibilityLabel="PIN"
                  value={value}
                  onChangeText={onChange}
                  onBlur={onBlur}
                  tone={submitError || errors.pin ? "error" : undefined}
                />
              )}
            />
            {errors.pin?.message ? <Text style={styles.fieldError}>{errors.pin.message}</Text> : null}
            {submitError ? (
              <Banner tone="error">{submitError}</Banner>
            ) : notice ? (
              <Banner tone="ok">{notice}</Banner>
            ) : (
              <Text style={styles.hint}>6 to 10 digits. Your phone&apos;s number pad opens when you tap the field.</Text>
            )}
          </Rise>

          <Rise delay={460}>
            <Button
              size="lg"
              pulse
              label={isSubmitting ? "Signing you in…" : ready ? "Sign in" : "Enter code and PIN"}
              onPress={handleSubmit(onSubmit)}
              loading={isSubmitting}
              disabled={!ready}
            />
          </Rise>

          <Rise delay={540} style={styles.footer}>
            <Pressable
              onPress={() =>
                navigation.navigate("SetupPin", {
                  organizationCode: organizationCode.trim() || undefined,
                  employeeCode: employeeCode.trim().toUpperCase() || undefined,
                })
              }
              hitSlop={8}
              accessibilityRole="button"
              style={{ padding: 4 }}
            >
              <Text style={styles.firstTimeText}>
                First time here? <Text style={styles.firstTimeAccent}>Set up your PIN</Text>
              </Text>
            </Pressable>
            <View style={styles.verified}>
              <View style={styles.footerDot} />
              <Text style={styles.verifiedText}>GEOFENCE AND PIN VERIFIED ON THE SERVER</Text>
            </View>
          </Rise>
        </ScrollView>
      </SafeAreaView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background, overflow: "hidden" },
  content: { paddingHorizontal: 20, paddingTop: 12, paddingBottom: 32, gap: 16, flexGrow: 1 },
  topRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  signInChip: { alignSelf: "center", paddingVertical: 6 },
  headline: { ...typography.h1, fontSize: 32, lineHeight: 38, letterSpacing: -0.4, color: colors.ink, marginTop: 4 },
  sub: { fontSize: 14, lineHeight: 20, fontFamily: fontFamilies.regular, color: colors.textSecondary, marginTop: 6 },
  idCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    padding: 14,
    borderRadius: 20,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.cardBorder,
  },
  avatar: { width: 52, height: 52, borderRadius: 26, alignItems: "center", justifyContent: "center" },
  avatarText: { fontSize: 16, fontFamily: fontFamilies.bold, fontWeight: "700", color: colors.onOrange },
  idName: { fontSize: 16, fontFamily: fontFamilies.display700, fontWeight: "700", letterSpacing: 1, color: colors.ink },
  idPlaceholder: { color: colors.textMuted, letterSpacing: 0 },
  idOrg: { fontSize: 12, fontFamily: fontFamilies.regular, color: colors.textSecondary, marginTop: 2 },
  chipRow: { flexDirection: "row", gap: 6, marginTop: 8 },
  chip: { borderRadius: 99, paddingHorizontal: 10, paddingVertical: 5 },
  chipDone: { backgroundColor: colors.successMuted },
  chipTodo: { backgroundColor: "rgba(23,19,15,0.10)" },
  chipText: { fontSize: 11, fontFamily: fontFamilies.semiBold, fontWeight: "600" },
  twoCol: { flexDirection: "row", gap: 10 },
  pinHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  link: { ...typography.link, color: colors.accentText },
  hint: { fontSize: 12, lineHeight: 17, fontFamily: fontFamilies.regular, color: colors.textSecondary },
  fieldError: { fontSize: 12, fontFamily: fontFamilies.regular, color: colors.danger },
  footer: { alignItems: "center", gap: 10, marginTop: "auto" },
  firstTimeText: { fontSize: 14, fontFamily: fontFamilies.regular, color: colors.textSecondary },
  firstTimeAccent: { color: colors.accentText },
  verified: { flexDirection: "row", alignItems: "center", gap: 6 },
  footerDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.liveDot },
  verifiedText: { fontSize: 11, fontFamily: fontFamilies.semiBold, fontWeight: "600", letterSpacing: 0.8, color: colors.success },
});
