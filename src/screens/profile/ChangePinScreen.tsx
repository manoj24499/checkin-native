import { useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { StyleSheet, Text, View } from "react-native";
import { useNavigation } from "@react-navigation/native";
import { Screen, TextField, Button, Card, IconButton, IconTile, ScreenTitle } from "@/components/ui";
import { useChangePin } from "@/hooks";
import { getErrorMessage } from "@/utils/errors";
import { colors, radius, spacing, typography } from "@/theme";

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
        <Card style={styles.successCard}>
          <IconTile icon="checkmark" size={64} radius={32} style={styles.successIcon} />
          <Text style={styles.successTitle}>PIN updated</Text>
          <Text style={[styles.subtitle, styles.centered]}>Use your new PIN the next time you sign in.</Text>
        </Card>
        <Button label="Done" onPress={() => navigation.goBack()} style={styles.submit} />
      </Screen>
    );
  }

  return (
    <Screen scroll contentStyle={styles.content}>
      <IconButton icon="close" onPress={() => navigation.goBack()} accessibilityLabel="Close" style={styles.closeButton} />

      <View style={styles.header}>
        <ScreenTitle style={styles.title}>Change PIN</ScreenTitle>
        {/* Matches the 6-10 digit rule enforced below (the old copy said 4). */}
        <Text style={styles.subtitle}>Choose a PIN only you know — 6 to 10 digits.</Text>
      </View>

      <Controller
        control={control}
        name="currentPin"
        rules={{ required: "Current PIN is required" }}
        render={({ field: { onChange, onBlur, value } }) => (
          <TextField
            label="Current PIN"
            icon="lock"
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

      <Button label="Update PIN" onPress={handleSubmit(onSubmit)} loading={isPending} style={styles.submit} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { justifyContent: "center", flexGrow: 1 },
  closeButton: { alignSelf: "flex-end", marginBottom: spacing.md },
  header: { marginBottom: spacing.lg },
  title: { marginBottom: spacing.xs },
  subtitle: { ...typography.caption, fontSize: 13.5, lineHeight: 19, color: colors.textSecondary },
  centered: { textAlign: "center" },
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
  successCard: { alignItems: "center", paddingVertical: spacing.lg, marginBottom: spacing.md },
  successIcon: { marginBottom: spacing.md },
  successTitle: { ...typography.h2, color: colors.ink, marginBottom: spacing.xs },
});
