import { useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useNavigation } from "@react-navigation/native";
import { Screen, TextField, Button } from "@/components/ui";
import { useChangePin } from "@/hooks";
import { getErrorMessage } from "@/utils/errors";
import { colors, spacing, typography } from "@/theme";

interface ChangePinFormValues {
  currentPin: string;
  newPin: string;
  confirmPin: string;
}

export function ChangePinScreen() {
  const navigation = useNavigation();
  const { mutateAsync, isPending } = useChangePin();
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const {
    control,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<ChangePinFormValues>({ defaultValues: { currentPin: "", newPin: "", confirmPin: "" } });

  const newPin = watch("newPin");

  const onSubmit = async (values: ChangePinFormValues) => {
    setSubmitError(null);
    try {
      await mutateAsync({ currentPin: values.currentPin.trim(), newPin: values.newPin.trim() });
      setSuccess(true);
    } catch (error) {
      setSubmitError(getErrorMessage(error, "Couldn't change your PIN. Please try again."));
    }
  };

  if (success) {
    return (
      <Screen contentStyle={styles.content}>
        <Text style={styles.title}>PIN updated</Text>
        <Text style={styles.subtitle}>Use your new PIN the next time you sign in.</Text>
        <Button label="Done" onPress={() => navigation.goBack()} style={styles.submit} />
      </Screen>
    );
  }

  return (
    <Screen scroll contentStyle={styles.content}>
      <Pressable onPress={() => navigation.goBack()} style={styles.closeButton} hitSlop={12}>
        <Text style={styles.closeGlyph}>✕</Text>
      </Pressable>

      <View style={styles.header}>
        <Text style={styles.title}>Change PIN</Text>
        <Text style={styles.subtitle}>Choose a PIN only you know — 4 to 10 digits.</Text>
      </View>

      <Controller
        control={control}
        name="currentPin"
        rules={{ required: "Current PIN is required" }}
        render={({ field: { onChange, onBlur, value } }) => (
          <TextField
            label="Current PIN"
            placeholder="••••••"
            secureTextEntry
            keyboardType="number-pad"
            value={value}
            onChangeText={onChange}
            onBlur={onBlur}
            error={errors.currentPin?.message}
          />
        )}
      />

      <Controller
        control={control}
        name="newPin"
        rules={{
          required: "New PIN is required",
          pattern: { value: /^\d{4,10}$/, message: "PIN must be 4-10 digits" },
        }}
        render={({ field: { onChange, onBlur, value } }) => (
          <TextField
            label="New PIN"
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

      <Button label="Update PIN" onPress={handleSubmit(onSubmit)} loading={isPending} style={styles.submit} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { justifyContent: "center", flexGrow: 1 },
  closeButton: {
    alignSelf: "flex-end",
    width: 34,
    height: 34,
    borderRadius: 99,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: spacing.md,
  },
  closeGlyph: { color: colors.textSecondary, fontSize: 15 },
  header: { marginBottom: spacing.xl },
  title: { ...typography.h1, color: colors.textPrimary, marginBottom: spacing.xs },
  subtitle: { ...typography.body, color: colors.textSecondary },
  error: { ...typography.caption, color: colors.danger, marginBottom: spacing.md },
  submit: { marginTop: spacing.sm },
});
