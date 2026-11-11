import { useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from "react-native";
import { StatusBar } from "expo-status-bar";
import { useNavigation, useRoute, type RouteProp } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { AmbientGlow, Button, Rise } from "@/components/ui";
import { authService } from "@/api/services";
import { useSettingsStore } from "@/store/settingsStore";
import { env } from "@/config/env";
import { getErrorMessage } from "@/utils/errors";
import { colors, fontFamilies } from "@/theme";
import type { AuthStackParamList } from "@/navigation/types";
import { AuthField, Caps, HeaderIconButton, InkHeader, fieldLabelStyles, inkHeaderColors } from "./AuthField";
import { Banner, CheckBadge, PinDotsField, PinSlots } from "./PinParts";

interface SetupPinFormValues {
  organizationCode: string;
  employeeCode: string;
  tempPin: string;
  newPin: string;
  confirmPin: string;
}

type Step = "identity" | "choose" | "confirm";

const STEP_META: Record<Step, { num: string; kicker: string; title: string }> = {
  identity: { num: "01", kicker: "Step 1 of 3", title: "Who you are" },
  choose: { num: "02", kicker: "Step 2 of 3", title: "Choose a PIN" },
  confirm: { num: "03", kicker: "Step 3 of 3", title: "Type it once more" },
};
const STEP_ORDER: Step[] = ["identity", "choose", "confirm"];
const STEP_LABELS = ["Identity", "New PIN", "Confirm"];

const digits = (v: string) => v.replace(/\D/g, "").slice(0, 10);

/**
 * First sign-in for an employee whose PIN the admin generated: the temporary PIN the admin handed over, and
 * then the PIN they want to use from now on (chosen and confirmed on separate steps). Done returns to the
 * sign-in form (pre-filled), where they sign in with their employee code and the new PIN. Reached from the
 * sign-in screen, either by the "first time here" link or automatically when someone signs in with a
 * still-temporary PIN.
 */
export function SetupPinScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<AuthStackParamList, "SetupPin">>();
  const route = useRoute<RouteProp<AuthStackParamList, "SetupPin">>();
  const lastOrganizationCode = useSettingsStore((s) => s.lastOrganizationCode);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [step, setStep] = useState<Step>("identity");

  const {
    control,
    handleSubmit,
    watch,
    trigger,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<SetupPinFormValues>({
    defaultValues: {
      organizationCode: route.params?.organizationCode || lastOrganizationCode || env.defaultOrganizationCode,
      employeeCode: route.params?.employeeCode ?? "",
      tempPin: route.params?.tempPin ?? "",
      newPin: "",
      confirmPin: "",
    },
  });
  const newPin = watch("newPin");
  const confirmPin = watch("confirmPin");
  const tempPin = watch("tempPin");
  const organizationCode = watch("organizationCode");
  const employeeCode = watch("employeeCode");

  const onSubmit = async (values: SetupPinFormValues) => {
    setSubmitError(null);
    const organizationCode = values.organizationCode.trim();
    const employeeCode = values.employeeCode.trim().toUpperCase();
    try {
      await authService.setInitialPin({
        organizationCode,
        employeeCode,
        tempPin: values.tempPin.trim(),
        newPin: values.newPin.trim(),
      });
      // Not signed in automatically: back to the real sign-in page to use the new PIN.
      navigation.reset({
        index: 0,
        routes: [
          {
            name: "Login",
            params: { organizationCode, employeeCode, notice: "PIN set. Sign in with your new PIN." },
          },
        ],
      });
    } catch (error) {
      setSubmitError(getErrorMessage(error, "Couldn't set your PIN. Please try again."));
    }
  };

  const stepIdx = STEP_ORDER.indexOf(step);
  const meta = STEP_META[step];

  const rules = [
    { label: "6 to 10 digits", ok: newPin.length >= 6 && newPin.length <= 10 },
    { label: "Not one digit repeated", ok: newPin.length > 0 && !/^(\d)\1+$/.test(newPin) },
    {
      label: "Not a straight run",
      ok:
        newPin.length > 0 &&
        !(newPin.length >= 4 && ("01234567890123456789".includes(newPin) || "98765432109876543210".includes(newPin))),
    },
    { label: "Not your temporary PIN", ok: newPin.length > 0 && newPin !== tempPin },
  ];
  const pinValid = rules.every((r) => r.ok);
  const matches = confirmPin.length > 0 && newPin.startsWith(confirmPin);
  const fullMatch = confirmPin === newPin && pinValid;
  const mismatch = confirmPin.length > 0 && !matches;

  const advance = async () => {
    setSubmitError(null);
    if (step === "identity") {
      const ok = await trigger(["organizationCode", "employeeCode", "tempPin"]);
      if (ok) setStep("choose");
    } else if (step === "choose") {
      const ok = await trigger("newPin");
      if (ok && pinValid) {
        setValue("confirmPin", "");
        setStep("confirm");
      }
    } else {
      void handleSubmit(onSubmit)();
    }
  };

  const back = () => {
    setSubmitError(null);
    if (stepIdx > 0) {
      setValue("confirmPin", "");
      setStep(STEP_ORDER[stepIdx - 1]);
    } else {
      navigation.goBack();
    }
  };

  const idReady = organizationCode.trim().length > 0 && employeeCode.trim().length >= 4 && tempPin.length >= 4;
  const canAdvance = step === "identity" ? idReady : step === "choose" ? pinValid : fullMatch && !isSubmitting;
  const current = step === "confirm" ? confirmPin : newPin;
  const fieldName = step === "confirm" ? "confirmPin" : "newPin";

  let matchLabel = "Enter the same PIN again";
  if (mismatch) matchLabel = "PINs don't match — check the red digit";
  else if (fullMatch) matchLabel = "PINs match";
  else if (confirmPin.length > 0) matchLabel = `So far so good · ${confirmPin.length} of ${newPin.length}`;

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      {/* The ink header sits under the status bar, so light icons. */}
      <StatusBar style="light" />
      <AmbientGlow glows={[{ corner: "topRight", size: 320, x: -90, y: 200, opacity: 0.25, duration: 10000 }]} />

      <InkHeader>
        <View style={styles.topRow}>
          {stepIdx > 0 ? (
            <HeaderIconButton icon="chevronLeft" onPress={back} label="Back" />
          ) : (
            <Caps color={inkHeaderColors.accent}>First-time setup</Caps>
          )}
          <HeaderIconButton icon="close" onPress={() => navigation.goBack()} label="Close" />
        </View>

        <View style={styles.stepRow}>
          <Text style={styles.stepNum}>{meta.num}</Text>
          <View style={{ flex: 1 }}>
            <Caps color={inkHeaderColors.muted}>{meta.kicker}</Caps>
            <Text style={styles.stepTitle}>{meta.title}</Text>
          </View>
        </View>

        <View style={{ gap: 14 }}>
          <View style={styles.progress}>
            {STEP_LABELS.map((label, i) => (
              <View key={label} style={[styles.seg, { backgroundColor: i <= stepIdx ? inkHeaderColors.segOn : inkHeaderColors.segOff }]} />
            ))}
          </View>
          <View style={styles.progress}>
            {STEP_LABELS.map((label, i) => (
              <Text key={label} style={[styles.segLabel, i <= stepIdx && { color: inkHeaderColors.text }]}>
                {label}
              </Text>
            ))}
          </View>
        </View>
      </InkHeader>

      <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        <Rise key={step} distance={22} duration={600} style={styles.stepBody}>
          {step === "identity" ? (
            <>
              <Text style={styles.lead}>Enter the temporary PIN your admin gave you. Next you&apos;ll choose one of your own.</Text>
              <Controller
                control={control}
                name="organizationCode"
                rules={{ required: "Organization code is required" }}
                render={({ field: { onChange, onBlur, value } }) => (
                  <AuthField
                    tall
                    labelVariant="caps"
                    label="Organization code"
                    placeholder="acme-corp"
                    autoCapitalize="none"
                    autoCorrect={false}
                    value={value}
                    onChangeText={onChange}
                    onBlur={onBlur}
                    error={errors.organizationCode?.message}
                    containerStyle={{ flex: 0 }}
                  />
                )}
              />
              <Controller
                control={control}
                name="employeeCode"
                rules={{ required: "Employee code is required" }}
                render={({ field: { onChange, onBlur, value } }) => (
                  <AuthField
                    tall
                    labelVariant="caps"
                    label="Employee code"
                    placeholder="EMP001"
                    autoCapitalize="characters"
                    autoCorrect={false}
                    value={value}
                    onChangeText={onChange}
                    onBlur={onBlur}
                    error={errors.employeeCode?.message}
                    containerStyle={{ flex: 0 }}
                  />
                )}
              />
              <Controller
                control={control}
                name="tempPin"
                rules={{ required: "Temporary PIN is required" }}
                render={({ field: { onChange, onBlur, value } }) => (
                  <View style={{ gap: 6 }}>
                    <Text style={fieldLabelStyles.caps}>Temporary PIN</Text>
                    <PinDotsField
                      variant="inline"
                      height={50}
                      secureTextEntry
                      accessibilityLabel="Temporary PIN"
                      value={value}
                      onChangeText={onChange}
                      onBlur={onBlur}
                      tone={errors.tempPin ? "error" : undefined}
                    />
                    {errors.tempPin?.message ? <Text style={styles.fieldError}>{errors.tempPin.message}</Text> : null}
                  </View>
                )}
              />
              <Banner tone="info">
                No temporary PIN? Ask your admin. It&apos;s on the welcome message they sent when your account was created.
              </Banner>
            </>
          ) : (
            <>
              <View style={{ gap: 6 }}>
                <View style={styles.labelRow}>
                  <Text style={fieldLabelStyles.caps}>{step === "confirm" ? "Confirm new PIN" : "New PIN"}</Text>
                  {step === "choose" ? <Text style={styles.count}>{current.length} / 10 · min 6</Text> : null}
                </View>
                <Controller
                  key={fieldName}
                  control={control}
                  name={fieldName}
                  rules={
                    step === "confirm"
                      ? {
                          required: "Please confirm your new PIN",
                          validate: (value) => value === newPin || "PINs don't match",
                        }
                      : {
                          required: "New PIN is required",
                          pattern: { value: /^\d{6,10}$/, message: "PIN must be 6-10 digits" },
                        }
                  }
                  render={({ field: { onChange, onBlur, value } }) => (
                    <PinSlots
                      secureTextEntry
                      autoFocus
                      accessibilityLabel={step === "confirm" ? "Confirm new PIN" : "New PIN"}
                      value={value}
                      compareTo={step === "confirm" ? newPin : undefined}
                      onChangeText={(t) => onChange(digits(t))}
                      onBlur={onBlur}
                    />
                  )}
                />
                {errors[fieldName]?.message ? <Text style={styles.fieldError}>{errors[fieldName]?.message}</Text> : null}
              </View>

              {step === "choose" ? (
                <View style={styles.rules}>
                  {rules.map((r) => (
                    <View key={r.label} style={styles.rule}>
                      <CheckBadge ok={r.ok} />
                      <Text style={[styles.ruleText, { color: r.ok ? colors.ink : colors.textSecondary }]}>{r.label}</Text>
                    </View>
                  ))}
                </View>
              ) : (
                <Banner tone={mismatch ? "error" : fullMatch ? "ok" : "muted"} icon={mismatch}>
                  {matchLabel}
                </Banner>
              )}
            </>
          )}

          {submitError ? <Banner tone="error">{submitError}</Banner> : null}

          <Button
            variant="solid"
            size="lg"
            pulse
            label={isSubmitting ? "Saving your PIN…" : step === "confirm" ? "Done" : "Continue"}
            onPress={() => void advance()}
            loading={isSubmitting}
            disabled={!canAdvance}
            labelStyle={{ color: colors.ink }}
          />
          {step === "confirm" ? <Text style={styles.footnote}>You&apos;ll go back to sign in with your new PIN.</Text> : null}
        </Rise>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background, overflow: "hidden" },
  topRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", height: 44 },
  stepRow: { flexDirection: "row", alignItems: "flex-end", gap: 14 },
  stepNum: { fontFamily: fontFamilies.display700, fontWeight: "700", fontSize: 54, lineHeight: 56, color: inkHeaderColors.accent },
  stepTitle: { fontFamily: fontFamilies.display700, fontWeight: "700", fontSize: 22, lineHeight: 28, color: inkHeaderColors.text },
  progress: { flexDirection: "row", gap: 6 },
  seg: { flex: 1, height: 5, borderRadius: 3 },
  segLabel: { flex: 1, fontSize: 11, fontFamily: fontFamilies.medium, fontWeight: "500", color: inkHeaderColors.muted },
  body: { paddingHorizontal: 20, paddingTop: 20, paddingBottom: 32, flexGrow: 1 },
  stepBody: { gap: 14 },
  lead: { fontSize: 14, lineHeight: 21, fontFamily: fontFamilies.regular, color: colors.textSecondary },
  labelRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  count: { fontSize: 12, fontFamily: fontFamilies.medium, fontWeight: "500", color: colors.textSecondary },
  rules: { flexDirection: "row", flexWrap: "wrap", rowGap: 10 },
  rule: { width: "50%", flexDirection: "row", alignItems: "center", gap: 8, paddingRight: 12 },
  ruleText: { flex: 1, fontSize: 13, lineHeight: 18, fontFamily: fontFamilies.regular },
  fieldError: { fontSize: 12, fontFamily: fontFamilies.regular, color: colors.danger },
  footnote: { fontSize: 12, fontFamily: fontFamilies.regular, color: colors.textSecondary, textAlign: "center" },
});
