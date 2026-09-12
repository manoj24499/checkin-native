import { useRef } from "react";
import { Pressable, StyleSheet, TextInput, View } from "react-native";
import { colors, radius, spacing } from "@/theme";

interface PinBoxInputProps {
  value: string;
  onChange: (value: string) => void;
  maxLength?: number;
}

/**
 * Replaces PinKeypad's custom on-screen keypad with the mockup's pattern:
 * boxes that reflect how many digits are in, laid over the phone's own
 * native number-pad keyboard via a hidden TextInput, rather than a
 * hand-drawn key grid. Tapping anywhere in the row focuses the hidden
 * input. Same `value`/`onChange` contract as PinKeypad, so CheckInOutScreen's
 * canSubmit/handleSubmit logic didn't need to change — only which component
 * renders the PIN entry.
 */
export function PinBoxInput({ value, onChange, maxLength = 6 }: PinBoxInputProps) {
  const inputRef = useRef<TextInput>(null);

  return (
    <Pressable onPress={() => inputRef.current?.focus()} style={styles.row}>
      {Array.from({ length: maxLength }, (_, i) => {
        const filled = i < value.length;
        const next = i === value.length;
        return (
          <View key={i} style={[styles.box, filled && styles.boxFilled, next && styles.boxNext]}>
            {filled ? <View style={styles.dot} /> : null}
          </View>
        );
      })}
      <TextInput
        ref={inputRef}
        value={value}
        onChangeText={(text) => onChange(text.replace(/\D/g, "").slice(0, maxLength))}
        keyboardType="number-pad"
        maxLength={maxLength}
        caretHidden
        style={styles.hiddenInput}
        accessibilityLabel="PIN"
      />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", gap: spacing.sm, position: "relative" },
  box: {
    flex: 1,
    height: 52,
    borderRadius: radius.sm,
    backgroundColor: colors.surfaceMuted,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
  },
  boxFilled: { borderColor: colors.primary },
  boxNext: { borderWidth: 2, borderColor: colors.primaryMuted },
  dot: { width: 10, height: 10, borderRadius: 99, backgroundColor: colors.primaryDark },
  hiddenInput: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    opacity: 0,
    color: "transparent",
  },
});
