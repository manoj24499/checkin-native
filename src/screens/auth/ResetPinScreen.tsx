import { useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { StatusBar } from "expo-status-bar";
import { useNavigation, useRoute, type RouteProp } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { AmbientGlow, Button, Icon, Rise } from "@/components/ui";
import { AuthField, Caps, FOCUS_ORANGE, HeaderIconButton, InkHeader, fieldLabelStyles, inkHeaderColors } from "./AuthField";
import { Banner, Caret, CheckBadge, PinDotsField } from "./PinParts";
import { authService } from "@/api/services";
import { useSettingsStore } from "@/store/settingsStore";
import { env } from "@/config/env";
import { getErrorMessage } from "@/utils/errors";
import { colors, fontFamilies, typography } from "@/theme";
import type { AuthStackParamList } from "@/navigation/types";

interface CodeFormValues {
  organizationCode: string;
  employeeCode: string;
  code: string;
}

interface PinFormValues {
  newPin: string;
  confirmPin: string;
}

/**
 * Forgot-PIN flow, two steps on one screen. 1) The employee enters the one-time code their admin gave them
 * (with their organization and employee code); the server swaps it for a short-lived reset token. 2) They
 * choose a new PIN and confirm it; the server refuses a PIN another employee already uses. Then straight
 * back to the sign-in form (not signed in automatically), pre-filled, so they sign in with the new PIN.
 *
 * No dedicated mockup: styled as a sibling of SetupPin.dc.html (ink header) and ChangePin.dc.html (PIN boxes).
 */
export function ResetPinScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<AuthStackParamList, "ResetPin">>();
  const route = useRoute<RouteProp<AuthStackParamList, "ResetPin">>();
  const lastOrganizationCode = useSettingsStore((s) => s.lastOrganizationCode);

  const [step, setStep] = useState<"code" | "pin">("code");
  const [resetToken, setResetToken] = useState("");
  const [who, setWho] = useState<{ organizationCode: string; employeeCode: string; name: string } | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const codeForm = useForm<CodeFormValues>({
    defaultValues: {
      organizationCode: route.params?.organizationCode || lastOrganizationCode || env.defaultOrganizationCode,
      employeeCode: route.params?.employeeCode ?? "",
      code: "",
    },
  });
  const pinForm = useForm<PinFormValues>({ defaultValues: { newPin: "", confirmPin: "" } });
  const newPin = pinForm.watch("newPin");
  const confirmPin = pinForm.watch("confirmPin");
  const codeValue = codeForm.watch("code");
  const orgValue = codeForm.watch("organizationCode");
  const empValue = codeForm.watch("employeeCode");
  const [showDigits, setShowDigits] = useState(false);

  const onVerify = async (values: CodeFormValues) => {
    setSubmitError(null);
    const organizationCode = values.organizationCode.trim();
    const employeeCode = values.employeeCode.trim().toUpperCase();
    try {
      const res = await authService.verifyPinResetCode({ organizationCode, employeeCode, code: values.code.trim() });
      setResetToken(res.resetToken);
      setWho({ organizationCode, employeeCode, name: res.name });
      setStep("pin");
    } catch (error) {
      setSubmitError(getErrorMessage(error, "That reset code didn't work. Check it and try again."));
    }
  };

  const onSetPin = async (values: PinFormValues) => {
    setSubmitError(null);
    try {
      await authService.completePinReset({ resetToken, newPin: values.newPin.trim() });
      navigation.reset({
        index: 0,
        routes: [
          {
            name: "Login",
            params: {
              organizationCode: who?.organizationCode,
              employeeCode: who?.employeeCode,
              notice: "PIN updated. Sign in with your new PIN.",
            },
          },
        ],
      });
    } catch (error) {
      setSubmitError(getErrorMessage(error, "Couldn't set your PIN. Please try again."));
    }
  };

  const isCode = step === "code";
  const codeErr = submitError && isCode ? true : false;
  const lenOk = newPin.length >= 6 && newPin.length <= 10;
  const matchOk = confirmPin.length > 0 && confirmPin === newPin;
  const mismatch = confirmPin.length > 0 && !newPin.startsWith(confirmPin);
  const pinReady = lenOk && matchOk;
  const codeReady = orgValue.trim().length > 0 && empValue.trim().length >= 4 && codeValue.length >= 4;
  const checks = [
    { label: "6 to 10 digits", ok: lenOk, bad: newPin.length > 10 },
    { label: "Digits only", ok: newPin.length > 0, bad: false },
    { label: mismatch ? "PINs don't match" : "Both PINs match", ok: matchOk, bad: mismatch },
  ];
  const firstName = who?.name ? who.name.split(" ")[0] : "";

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      {/* The ink header sits under the status bar, so light icons. */}
      <StatusBar style="light" />
      <AmbientGlow glows={[{ corner: "topRight", size: 320, x: -90, y: 220, opacity: 0.25, duration: 10000 }]} />

      <InkHeader>
        <View style={styles.topRow}>
          <View style={styles.kickerRow}>
            <View style={styles.keyTile}>
              <Icon name="lock" size={18} color={inkHeaderColors.accent} strokeWidth={2} />
            </View>
            <Caps color={inkHeaderColors.accent}>{isCode ? "Forgot PIN" : "Step 2 of 2"}</Caps>
          </View>
          <HeaderIconButton icon="close" onPress={() => navigation.goBack()} label="Close" />
        </View>

        <Text style={styles.title}>{isCode ? "Reset your PIN" : "Choose a new PIN"}</Text>

        {isCode ? (
          <View style={{ gap: 10 }}>
            <View style={styles.boxes}>
              {Array.from({ length: 6 }, (_, i) => {
                const filled = i < codeValue.length;
                const caret = i === codeValue.length;
                return (
                  <View
                    key={i}
                    style={[
                      styles.box,
                      codeErr
                        ? { borderColor: colors.danger, borderWidth: 1.5 }
                        : caret
                          ? { borderColor: FOCUS_ORANGE, borderWidth: 1.5 }
                          : filled
                            ? { borderColor: "rgba(255,255,255,0.32)" }
                            : null,
                    ]}
                  >
                    {filled ? (
                      <Text style={[styles.boxDigit, codeErr && { color: "#F0A39E" }]}>{codeValue[i]}</Text>
                    ) : caret && !codeErr ? (
                      <Caret height={22} />
                    ) : null}
                  </View>
                );
              })}
            </View>
            <Text style={styles.panelNote}>One-time code from your admin · digits only</Text>
          </View>
        ) : (
          <View style={styles.accepted}>
            <View style={styles.acceptedIcon}>
              <Icon name="checkmark" size={20} color={colors.liveTextOnDark} strokeWidth={2.4} />
            </View>
            <View style={{ gap: 2, flex: 1 }}>
              <Text style={styles.acceptedTitle}>{firstName ? `Code accepted, ${firstName}.` : "Code accepted."}</Text>
              <Text numberOfLines={1} style={styles.panelNote}>
                {who ? `${who.employeeCode} · ${who.organizationCode}` : ""}
              </Text>
            </View>
          </View>
        )}
      </InkHeader>

      <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        <Rise key={step} distance={22} duration={600} style={styles.stepBody}>
          {isCode ? (
            <>
              <View style={styles.twoCol}>
                <Controller
                  control={codeForm.control}
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
                      error={codeForm.formState.errors.organizationCode?.message}
                    />
                  )}
                />
                <Controller
                  control={codeForm.control}
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
                      error={codeForm.formState.errors.employeeCode?.message}
                    />
                  )}
                />
              </View>

              {submitError ? (
                <Banner tone="error">{submitError}</Banner>
              ) : (
                <Text style={styles.hint}>Don&apos;t have a code? Your admin creates one from Employees › Reset PIN.</Text>
              )}

              <Controller
                control={codeForm.control}
                name="code"
                rules={{ required: "Reset code is required", pattern: { value: /^\d{4,10}$/, message: "Digits only" } }}
                render={({ field: { onChange, onBlur, value } }) => (
                  <AuthField
                    tall
                    label="Reset code"
                    placeholder="123456"
                    keyboardType="number-pad"
                    value={value}
                    onChangeText={onChange}
                    onBlur={onBlur}
                    error={codeForm.formState.errors.code?.message}
                    style={styles.codeInput}
                    containerStyle={{ flex: 0 }}
                  />
                )}
              />

              <Button
                size="lg"
                pulse
                label={codeForm.formState.isSubmitting ? "Checking code…" : "Continue"}
                onPress={codeForm.handleSubmit(onVerify)}
                loading={codeForm.formState.isSubmitting}
                disabled={!codeReady}
                style={styles.cta}
              />
            </>
          ) : (
            <>
              <Text style={styles.lead}>Pick a PIN only you know. It can&apos;t be one another employee already uses.</Text>

              <Controller
                control={pinForm.control}
                name="newPin"
                rules={{
                  required: "New PIN is required",
                  pattern: { value: /^\d{6,10}$/, message: "PIN must be 6-10 digits" },
                }}
                render={({ field: { onChange, onBlur, value } }) => (
                  <View style={{ gap: 6 }}>
                    <Text style={fieldLabelStyles.caps}>New PIN</Text>
                    <PinDotsField
                      height={54}
                      autoFocus
                      secureTextEntry={!showDigits}
                      showDigits={showDigits}
                      accessibilityLabel="New PIN"
                      value={value}
                      onChangeText={(t) => onChange(t.replace(/\D/g, "").slice(0, 10))}
                      onBlur={onBlur}
                      tone={pinForm.formState.errors.newPin ? "error" : undefined}
                    />
                    {pinForm.formState.errors.newPin?.message ? (
                      <Text style={styles.fieldError}>{pinForm.formState.errors.newPin.message}</Text>
                    ) : null}
                  </View>
                )}
              />
              <Controller
                control={pinForm.control}
                name="confirmPin"
                rules={{
                  required: "Please confirm your new PIN",
                  validate: (value) => value === newPin || "PINs don't match",
                }}
                render={({ field: { onChange, onBlur, value } }) => (
                  <View style={{ gap: 6 }}>
                    <View style={styles.labelRow}>
                      <Text style={fieldLabelStyles.caps}>Confirm new PIN</Text>
                      {matchOk ? <Text style={styles.matchText}>PINs match</Text> : null}
                    </View>
                    <PinDotsField
                      height={54}
                      secureTextEntry={!showDigits}
                      showDigits={showDigits}
                      accessibilityLabel="Confirm new PIN"
                      value={value}
                      onChangeText={(t) => onChange(t.replace(/\D/g, "").slice(0, 10))}
                      onBlur={onBlur}
                      tone={mismatch || pinForm.formState.errors.confirmPin ? "error" : matchOk ? "ok" : undefined}
                    />
                    {pinForm.formState.errors.confirmPin?.message ? (
                      <Text style={styles.fieldError}>{pinForm.formState.errors.confirmPin.message}</Text>
                    ) : null}
                  </View>
                )}
              />

              <Pressable
                onPress={() => setShowDigits((v) => !v)}
                accessibilityRole="button"
                accessibilityState={{ selected: showDigits }}
                hitSlop={8}
                style={styles.showBtn}
              >
                <Text style={styles.showText}>{showDigits ? "Hide digits" : "Show digits"}</Text>
              </Pressable>

              <View style={styles.checks}>
                {checks.map((c, i) => (
                  <View key={c.label} style={[styles.check, i > 0 && styles.checkRule]}>
                    <CheckBadge ok={c.ok} bad={c.bad} size={22} />
                    <Text
                      style={[
                        styles.checkText,
                        { color: c.ok ? colors.textPrimary : c.bad ? colors.danger : colors.textSecondary },
                      ]}
                    >
                      {c.label}
                    </Text>
                  </View>
                ))}
              </View>

              {submitError ? <Banner tone="error">{submitError}</Banner> : null}

              <Button
                size="lg"
                pulse
                label={pinForm.formState.isSubmitting ? "Saving…" : "Save PIN and continue"}
                onPress={pinForm.handleSubmit(onSetPin)}
                loading={pinForm.formState.isSubmitting}
                disabled={!pinReady}
                style={styles.cta}
              />
              <Text style={styles.footnote}>After saving, use your new PIN to sign in and check in.</Text>
            </>
          )}
        </Rise>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background, overflow: "hidden" },
  topRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", height: 44 },
  kickerRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  keyTile: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: "rgba(239,108,0,0.18)",
    alignItems: "center",
    justifyContent: "center",
  },
  title: { ...typography.h1, fontSize: 28, lineHeight: 34, color: inkHeaderColors.text },
  boxes: { flexDirection: "row", gap: 8 },
  box: {
    flex: 1,
    height: 58,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.14)",
    backgroundColor: "rgba(255,255,255,0.06)",
    alignItems: "center",
    justifyContent: "center",
  },
  boxDigit: { fontFamily: fontFamilies.display700, fontWeight: "700", fontSize: 26, color: inkHeaderColors.text },
  panelNote: { fontSize: 12, fontFamily: fontFamilies.regular, color: inkHeaderColors.muted },
  accepted: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    borderRadius: 16,
    padding: 14,
    backgroundColor: "rgba(255,255,255,0.08)",
  },
  acceptedIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.liveBgOnDark,
    alignItems: "center",
    justifyContent: "center",
  },
  acceptedTitle: { fontFamily: fontFamilies.display700, fontWeight: "700", fontSize: 16, color: inkHeaderColors.text },
  body: { paddingHorizontal: 20, paddingTop: 20, paddingBottom: 32, flexGrow: 1 },
  stepBody: { flexGrow: 1, gap: 14 },
  twoCol: { flexDirection: "row", gap: 10 },
  lead: { fontSize: 14, lineHeight: 21, fontFamily: fontFamilies.regular, color: colors.textSecondary },
  hint: { fontSize: 12, lineHeight: 17, fontFamily: fontFamilies.regular, color: colors.textSecondary },
  codeInput: { fontSize: 18, letterSpacing: 4 },
  labelRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  matchText: { fontSize: 12, fontFamily: fontFamilies.semiBold, fontWeight: "600", color: colors.success },
  fieldError: { fontSize: 12, fontFamily: fontFamilies.regular, color: colors.danger },
  showBtn: { alignSelf: "flex-start", paddingVertical: 4 },
  showText: { ...typography.link, color: colors.accentText },
  checks: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.cardBorder, borderRadius: 20 },
  check: { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 16, paddingVertical: 12 },
  checkRule: { borderTopWidth: 1, borderTopColor: colors.hairlineSoft },
  checkText: { fontSize: 14, lineHeight: 20, fontFamily: fontFamilies.regular },
  cta: { marginTop: "auto" },
  footnote: { fontSize: 12, fontFamily: fontFamilies.regular, color: colors.textSecondary, textAlign: "center" },
});
