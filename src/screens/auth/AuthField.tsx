import { forwardRef, useState } from "react";
import {
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  type StyleProp,
  type TextInputProps,
  type TextStyle,
  type ViewStyle,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Icon } from "@/components/ui";
import { colors, fontFamilies } from "@/theme";

/** Warm orange focus edge used by every auth input (Login.dc.html PIN field). */
export const FOCUS_ORANGE = "#FF9A3D";

interface AuthFieldProps extends TextInputProps {
  label?: string;
  error?: string;
  /** 50 high (SetupPin `.fd`) instead of 48 (Login `.f`). */
  tall?: boolean;
  /** "default": 12/500 sentence-case label (Login). "caps": 11/600 +1.2 UPPERCASE label (SetupPin / ChangePin). */
  labelVariant?: "default" | "caps";
  containerStyle?: StyleProp<ViewStyle>;
}

/** Light text field: label above, 48 high white input, radius 14, 1px ink border; 1.5px orange when focused. */
export const AuthField = forwardRef<TextInput, AuthFieldProps>(function AuthField(
  { label, error, tall, labelVariant = "default", containerStyle, style, onFocus, onBlur, ...props },
  ref,
) {
  const [focused, setFocused] = useState(false);
  return (
    <View style={[styles.container, containerStyle]}>
      {label ? <Text style={labelVariant === "caps" ? styles.capsLabel : styles.label}>{label}</Text> : null}
      <TextInput
        ref={ref}
        placeholderTextColor={colors.textMuted}
        selectionColor={colors.primary}
        cursorColor={colors.primary}
        onFocus={(e) => {
          setFocused(true);
          onFocus?.(e);
        }}
        onBlur={(e) => {
          setFocused(false);
          onBlur?.(e);
        }}
        style={[
          styles.input,
          tall && styles.tall,
          labelVariant === "caps" && styles.capsInput,
          focused && styles.focused,
          error ? styles.err : null,
          style,
        ]}
        {...props}
      />
      {error ? <Text style={styles.error}>{error}</Text> : null}
    </View>
  );
});

export const authStyles = StyleSheet.create({
  caps: { fontSize: 11, fontFamily: fontFamilies.semiBold, fontWeight: "600", letterSpacing: 1.4, textTransform: "uppercase" },
});

/** Field label typography, exported for custom (PIN) fields so they line up with AuthField. */
export const fieldLabelStyles = StyleSheet.create({
  label: { fontSize: 12, fontFamily: fontFamilies.medium, fontWeight: "500", letterSpacing: 0.4, color: colors.textSecondary },
  caps: {
    fontSize: 11,
    fontFamily: fontFamilies.semiBold,
    fontWeight: "600",
    letterSpacing: 1.2,
    textTransform: "uppercase",
    color: colors.textSecondary,
  },
});

const styles = StyleSheet.create({
  container: { gap: 6, flex: 1 },
  label: fieldLabelStyles.label,
  capsLabel: fieldLabelStyles.caps,
  input: {
    height: 48,
    borderWidth: 1,
    borderColor: colors.inputBorder,
    borderRadius: 14,
    backgroundColor: colors.surface,
    paddingHorizontal: 14,
    fontSize: 15,
    fontFamily: fontFamilies.medium,
    color: colors.textPrimary,
  },
  tall: { height: 50, paddingHorizontal: 16 },
  capsInput: { borderColor: colors.cardBorder },
  focused: { borderColor: FOCUS_ORANGE, borderWidth: 1.5 },
  err: { borderColor: colors.danger, borderWidth: 1.5 },
  error: { fontSize: 12, fontFamily: fontFamilies.regular, color: colors.danger },
});

export function Caps({ children, color, style }: { children: React.ReactNode; color?: string; style?: StyleProp<TextStyle> }) {
  return <Text style={[authStyles.caps, { color: color ?? colors.kicker }, style]}>{children}</Text>;
}

/** 44px translucent round button on the dark ink header (SetupPin.dc.html `.xb`). */
export function HeaderIconButton({ icon, onPress, label }: { icon: "close" | "chevronLeft"; onPress: () => void; label: string }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      hitSlop={4}
      style={({ pressed }) => [header.btn, pressed && { opacity: 0.7 }]}
    >
      <Icon name={icon} size={icon === "close" ? 18 : 20} color="#FFFFFF" strokeWidth={2} />
    </Pressable>
  );
}

/**
 * Dark ink header that runs under the status bar with rounded bottom corners (SetupPin.dc.html):
 * #17130F, radius 0 0 28 28, padding 20 (top = safe area + 8), gap 14.
 */
export function InkHeader({ children, style }: { children: React.ReactNode; style?: StyleProp<ViewStyle> }) {
  return (
    <View style={[header.panel, style]}>
      <SafeAreaView edges={["top"]} style={header.inner}>
        {children}
      </SafeAreaView>
    </View>
  );
}

export const inkHeaderColors = {
  bg: "#17130F",
  text: "#F7F5F2",
  muted: "#C9C1B9",
  accent: "#FFB067",
  segOn: FOCUS_ORANGE,
  segOff: "rgba(255,255,255,0.2)",
  chip: "rgba(255,255,255,0.12)",
} as const;

const header = StyleSheet.create({
  panel: {
    backgroundColor: inkHeaderColors.bg,
    borderBottomLeftRadius: 28,
    borderBottomRightRadius: 28,
  },
  inner: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 20, gap: 14 },
  btn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: inkHeaderColors.chip,
    alignItems: "center",
    justifyContent: "center",
  },
});
