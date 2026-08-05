import { useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { TextField, Button } from "@/components/ui";
import { BarSpark } from "@/components/dashboard";
import { useAuth, useActivityPattern } from "@/hooks";
import { getErrorMessage } from "@/utils/errors";
import { colors, spacing, typography } from "@/theme";

interface LoginFormValues {
  employeeCode: string;
  pin: string;
}

export function LoginScreen() {
  const { login } = useAuth();
  const [submitError, setSubmitError] = useState<string | null>(null);
  const spark = useActivityPattern(true);
  const {
    control,
    handleSubmit,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<LoginFormValues>({
    defaultValues: { employeeCode: "", pin: "" },
  });

  const employeeCode = watch("employeeCode");
  const pin = watch("pin");
  const ready = employeeCode.trim().length >= 4 && pin.length >= 4;

  const onSubmit = async (values: LoginFormValues) => {
    setSubmitError(null);
    try {
      await login(values.employeeCode.trim().toUpperCase(), values.pin.trim());
    } catch (error) {
      setSubmitError(getErrorMessage(error, "Invalid employee code or PIN."));
    }
  };

  return (
    <View style={styles.container}>
      <StatusBar style="light" />
      <SafeAreaView edges={["top"]} style={styles.hero}>
        <Text style={styles.kicker}>QUBE SPACE</Text>
        <Text style={styles.headline}>Check-in Application.</Text>
        <Text style={styles.heroSubtitle}>
          Check in, share your dot while you work, check out. Nothing more.
        </Text>
        <View style={styles.sparkRow}>
          <BarSpark values={spark} color={colors.primary} height={30} />
        </View>
      </SafeAreaView>

      <ScrollView
        contentContainerStyle={styles.formContent}
        keyboardShouldPersistTaps="handled"
      >
        <Controller
          control={control}
          name="employeeCode"
          rules={{ required: "Employee code is required" }}
          render={({ field: { onChange, onBlur, value } }) => (
            <TextField
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
  hero: {
    backgroundColor: colors.panelDark,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.lg,
  },
  kicker: {
    ...typography.label,
    letterSpacing: 2,
    color: colors.primarySoftText,
    marginTop: spacing.md,
  },
  headline: {
    fontSize: 34,
    fontWeight: "300",
    lineHeight: 39,
    color: colors.textOnDark,
    marginTop: spacing.md - 2,
    maxWidth: 260,
  },
  heroSubtitle: {
    ...typography.body,
    color: colors.textOnDarkMuted,
    marginTop: spacing.sm + 2,
    maxWidth: 280,
  },
  sparkRow: { marginTop: spacing.lg + 2 },
  formContent: { padding: spacing.md, paddingTop: spacing.lg },
  error: {
    ...typography.caption,
    color: colors.danger,
    marginBottom: spacing.md,
  },
  submit: { marginTop: spacing.xs },
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
