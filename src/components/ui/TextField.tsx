import { forwardRef, useState } from "react";
import { StyleSheet, Text, TextInput, TextInputProps, View } from "react-native";
import { Icon, type IconName } from "./Icon";
import { colors, fontFamilies, radius, spacing, typography } from "@/theme";

interface TextFieldProps extends TextInputProps {
  label?: string;
  error?: string;
  /** Optional leading icon inside the field (login: shield / id / lock). When
   * set, `style` applies to the bordered row instead of the bare input. */
  icon?: IconName;
}

export const TextField = forwardRef<TextInput, TextFieldProps>(function TextField(
  { label, error, style, icon, onFocus, onBlur, ...props },
  ref,
) {
  const [focused, setFocused] = useState(false);
  const focusProps = {
    onFocus: (e: Parameters<NonNullable<TextInputProps["onFocus"]>>[0]) => {
      setFocused(true);
      onFocus?.(e);
    },
    onBlur: (e: Parameters<NonNullable<TextInputProps["onBlur"]>>[0]) => {
      setFocused(false);
      onBlur?.(e);
    },
  };
  const stateStyle = error ? styles.inputError : focused ? styles.inputFocused : null;
  return (
    <View style={styles.container}>
      {label ? <Text style={styles.label}>{label}</Text> : null}
      {icon ? (
        <View style={[styles.box, styles.iconRow, stateStyle, style]}>
          <Icon name={icon} size={18} color={colors.textSecondary} />
          <TextInput
            ref={ref}
            placeholderTextColor={colors.textMuted}
            selectionColor={colors.primary}
            cursorColor={colors.primary}
            style={styles.bareInput}
            {...props}
            {...focusProps}
          />
        </View>
      ) : (
        <TextInput
          ref={ref}
          placeholderTextColor={colors.textMuted}
          selectionColor={colors.primary}
          cursorColor={colors.primary}
          style={[styles.box, styles.input, stateStyle, style]}
          {...props}
          {...focusProps}
        />
      )}
      {error ? <Text style={styles.error}>{error}</Text> : null}
    </View>
  );
});

const styles = StyleSheet.create({
  container: { marginBottom: spacing.md },
  // Label above the field: 12/500, secondary, +0.4 tracking (Login.dc.html).
  label: { fontSize: 12, fontWeight: "500", fontFamily: fontFamilies.medium, letterSpacing: 0.4, color: colors.textSecondary, marginBottom: 6 },
  box: {
    borderWidth: 1,
    borderColor: colors.inputBorder,
    borderRadius: radius.input,
    backgroundColor: colors.surface,
  },
  input: {
    minHeight: 48,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 15,
    fontFamily: fontFamilies.medium,
    color: colors.textPrimary,
  },
  iconRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm + 2, paddingHorizontal: 14, minHeight: 48 },
  bareInput: { flex: 1, fontSize: 15, fontFamily: fontFamilies.medium, color: colors.textPrimary, paddingVertical: 10 },
  // Focused: 1.5px warm orange edge (Login.dc.html PIN field).
  inputFocused: { borderColor: "#FF9A3D", borderWidth: 1.5 },
  inputError: { borderColor: colors.danger, borderWidth: 1.5 },
  error: { ...typography.caption, fontSize: 12, color: colors.danger, marginTop: spacing.xs },
});
