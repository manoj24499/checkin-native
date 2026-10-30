import { useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { StyleSheet, Text, View } from "react-native";
import { useNavigation, useRoute, type RouteProp } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Screen, TextField, Button, IconButton, ScreenTitle } from "@/components/ui";
import { authService } from "@/api/services";
import { useSettingsStore } from "@/store/settingsStore";
import { env } from "@/config/env";
import { getErrorMessage } from "@/utils/errors";
import { colors, radius, spacing, typography } from "@/theme";
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

  return (
    <Screen scroll contentStyle={styles.content}>
      <IconButton icon="close" onPress={() => navigation.goBack()} accessibilityLabel="Close" style={styles.closeButton} />

      {step === "code" ? (
        <>
          <View style={styles.header}>
            <ScreenTitle style={styles.title}>Reset your PIN</ScreenTitle>
            <Text style={styles.subtitle}>
              Ask your admin for a one-time reset code, then enter it here with your employee code.
            </Text>
          </View>

          <Controller
            control={codeForm.control}
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
                error={codeForm.formState.errors.organizationCode?.message}
              />
            )}
          />
          <Controller
            control={codeForm.control}
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
                error={codeForm.formState.errors.employeeCode?.message}
              />
            )}
          />
          <Controller
            control={codeForm.control}
            name="code"
            rules={{ required: "Reset code is required", pattern: { value: /^\d{4,10}$/, message: "Digits only" } }}
            render={({ field: { onChange, onBlur, value } }) => (
              <TextField
                label="Reset code"
                icon="lock"
                placeholder="123456"
                keyboardType="number-pad"
                value={value}
                onChangeText={onChange}
                onBlur={onBlur}
                error={codeForm.formState.errors.code?.message}
              />
            )}
          />

          {submitError ? <Text style={styles.error}>{submitError}</Text> : null}

          <Button
            label="Continue"
            onPress={codeForm.handleSubmit(onVerify)}
            loading={codeForm.formState.isSubmitting}
            style={styles.submit}
          />
        </>
      ) : (
        <>
          <View style={styles.header}>
            <ScreenTitle style={styles.title}>Choose a new PIN</ScreenTitle>
            <Text style={styles.subtitle}>
              {who?.name ? `Hi ${who.name.split(" ")[0]}. ` : ""}Pick a PIN only you know, 6 to 10 digits. It can&apos;t be one
              another employee already uses.
            </Text>
          </View>

          <Controller
            control={pinForm.control}
            name="newPin"
            rules={{
              required: "New PIN is required",
              pattern: { value: /^\d{6,10}$/, message: "PIN must be 6-10 digits" },
            }}
            render={({ field: { onChange, onBlur, value } }) => (
              <TextField
                label="New PIN"
                icon="lock"
                placeholder="••••••"
                secureTextEntry
                keyboardType="number-pad"
                value={value}
                onChangeText={onChange}
                onBlur={onBlur}
                error={pinForm.formState.errors.newPin?.message}
              />
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
              <TextField
                label="Confirm new PIN"
                icon="lock"
                placeholder="••••••"
                secureTextEntry
                keyboardType="number-pad"
                value={value}
                onChangeText={onChange}
                onBlur={onBlur}
                error={pinForm.formState.errors.confirmPin?.message}
              />
            )}
          />

          {submitError ? <Text style={styles.error}>{submitError}</Text> : null}

          <Button
            label="Save PIN and continue"
            onPress={pinForm.handleSubmit(onSetPin)}
            loading={pinForm.formState.isSubmitting}
            style={styles.submit}
          />
        </>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { justifyContent: "center", flexGrow: 1 },
  closeButton: { alignSelf: "flex-end", marginBottom: spacing.md },
  header: { marginBottom: spacing.lg },
  title: { marginBottom: spacing.xs },
  subtitle: { ...typography.caption, fontSize: 13.5, lineHeight: 19, color: colors.textSecondary },
  error: {
    ...typography.caption,
    color: colors.danger,
    backgroundColor: colors.dangerMuted,
    borderRadius: radius.input,
    paddingHorizontal: 13,
    paddingVertical: 10,
    marginBottom: spacing.md,
    overflow: "hidden",
  },
  submit: { marginTop: spacing.sm },
});
