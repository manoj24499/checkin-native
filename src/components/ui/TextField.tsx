import { forwardRef } from "react";
import { StyleSheet, Text, TextInput, TextInputProps, View } from "react-native";
import { Icon, type IconName } from "./Icon";
import { colors, radius, spacing, typography } from "@/theme";

interface TextFieldProps extends TextInputProps {
  label?: string;
  error?: string;
  /** Optional leading icon inside the field (login: shield / id / lock). When
   * set, `style` applies to the bordered row instead of the bare input. */
  icon?: IconName;
}

export const TextField = forwardRef<TextInput, TextFieldProps>(function TextField(
  { label, error, style, icon, ...props },
  ref,
) {
  return (
    <View style={styles.container}>
      {label ? <Text style={styles.label}>{label}</Text> : null}
      {icon ? (
        <View style={[styles.box, styles.iconRow, error ? styles.inputError : null, style]}>
          <Icon name={icon} size={18} color={colors.textSecondary} />
          <TextInput
            ref={ref}
            placeholderTextColor={colors.textMuted}
            selectionColor={colors.ink}
            style={styles.bareInput}
            {...props}
          />
        </View>
      ) : (
        <TextInput
          ref={ref}
          placeholderTextColor={colors.textMuted}
          selectionColor={colors.ink}
          style={[styles.box, styles.input, error ? styles.inputError : null, style]}
          {...props}
        />
      )}
      {error ? <Text style={styles.error}>{error}</Text> : null}
    </View>
  );
});

const styles = StyleSheet.create({
  container: { marginBottom: spacing.md },
  label: { ...typography.label, fontSize: 12, color: colors.textSecondary, marginBottom: 6 },
  box: {
    borderWidth: 1.5,
    borderColor: colors.inkBorder,
    borderRadius: radius.input,
    backgroundColor: colors.surface,
  },
  input: {
    minHeight: 50,
    paddingHorizontal: spacing.md - 2,
    paddingVertical: spacing.sm + 4,
    fontSize: 16,
    color: colors.textPrimary,
  },
  iconRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm + 2, paddingHorizontal: spacing.md - 2, minHeight: 50 },
  bareInput: { flex: 1, fontSize: 16, color: colors.textPrimary, paddingVertical: spacing.sm + 4 },
  inputError: { borderColor: colors.danger },
  error: { ...typography.caption, fontSize: 12, color: colors.danger, marginTop: spacing.xs },
});
