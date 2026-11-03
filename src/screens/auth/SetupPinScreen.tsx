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

interface SetupPinFormValues {
  organizationCode: string;
  employeeCode: string;
  tempPin: string;
  newPin: string;
  confirmPin: string;
}

/**
 * First sign-in for an employee whose PIN the admin generated: the temporary PIN the admin handed over, and
 * below it the PIN they want to use from now on. Done returns to the sign-in form (pre-filled), where they
 * sign in with their employee code and the new PIN. Reached from the sign-in screen, either by the "first
 * time here" link or automatically when someone signs in with a still-temporary PIN.
 */
export function SetupPinScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<AuthStackParamList, "SetupPin">>();
  const route = useRoute<RouteProp<AuthStackParamList, "SetupPin">>();
  const lastOrganizationCode = useSettingsStore((s) => s.lastOrganizationCode);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const {
    control,
    handleSubmit,
    watch,
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

  return (
    <Screen scroll contentStyle={styles.content}>
      <IconButton icon="close" onPress={() => navigation.goBack()} accessibilityLabel="Close" style={styles.closeButton} />

      <View style={styles.header}>
        <ScreenTitle style={styles.title}>Set up your PIN</ScreenTitle>
        <Text style={styles.subtitle}>
          Enter the temporary PIN your admin gave you, then choose a PIN of your own, 6 to 10 digits.
        </Text>
      </View>

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
        name="tempPin"
        rules={{ required: "Temporary PIN is required" }}
        render={({ field: { onChange, onBlur, value } }) => (
          <TextField
            label="Temporary PIN"
            icon="lock"
            placeholder="••••••"
            secureTextEntry
            keyboardType="number-pad"
            value={value}
            onChangeText={onChange}
            onBlur={onBlur}
            error={errors.tempPin?.message}
          />
        )}
      />

      <View style={styles.divider} />

      <Controller
        control={control}
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
            error={errors.newPin?.message}
          />
        )}
      />
      <Controller
        control={control}
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
            error={errors.confirmPin?.message}
          />
        )}
      />

      {submitError ? <Text style={styles.error}>{submitError}</Text> : null}

      <Button label="Done" onPress={handleSubmit(onSubmit)} loading={isSubmitting} style={styles.submit} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { justifyContent: "center", flexGrow: 1 },
  closeButton: { alignSelf: "flex-end", marginBottom: spacing.md },
  header: { marginBottom: spacing.lg },
  title: { marginBottom: spacing.xs },
  subtitle: { ...typography.caption, fontSize: 13.5, lineHeight: 19, color: colors.textSecondary },
  divider: { height: 1, backgroundColor: colors.border, marginVertical: spacing.sm, marginBottom: spacing.md },
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
