import { useEffect, useRef } from "react";
import { Animated, Pressable, StyleSheet, TextInput, View } from "react-native";
import { useReducedMotion } from "@/components/ui";
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
 *
 * Look (CheckIn.dc.html `.pbx`): 48-high muted boxes, radius 14; the next box
 * to fill gets a white fill + orange 1.5px border; each entered digit pops in
 * as an ink dot.
 */
export function PinBoxInput({ value, onChange, maxLength = 6 }: PinBoxInputProps) {
  const inputRef = useRef<TextInput>(null);

  return (
    <Pressable onPress={() => inputRef.current?.focus()} style={styles.row}>
      {Array.from({ length: maxLength }, (_, i) => {
        const filled = i < value.length;
        const next = i === value.length;
        return (
          <View key={i} style={[styles.box, next && styles.boxNext]}>
            {filled ? <PinDot /> : null}
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

/** Mockup `pop`: scale .4 -> 1 + fade in, 250ms, once on mount. */
function PinDot() {
  const reduced = useReducedMotion();
  const t = useRef(new Animated.Value(reduced ? 1 : 0)).current;
  useEffect(() => {
    if (reduced) return;
    const anim = Animated.timing(t, { toValue: 1, duration: 250, useNativeDriver: true });
    anim.start();
    return () => anim.stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return (
    <Animated.View
      style={[
        styles.dot,
        { opacity: t, transform: [{ scale: t.interpolate({ inputRange: [0, 1], outputRange: [0.4, 1] }) }] },
      ]}
    />
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", gap: spacing.sm, position: "relative" },
  box: {
    flex: 1,
    height: 48,
    borderRadius: radius.input,
    backgroundColor: "#EEEAE5",
    borderWidth: 1.5,
    borderColor: "transparent",
    alignItems: "center",
    justifyContent: "center",
  },
  boxNext: { borderColor: colors.primary, backgroundColor: colors.surface },
  dot: { width: 11, height: 11, borderRadius: 6, backgroundColor: colors.ink },
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
