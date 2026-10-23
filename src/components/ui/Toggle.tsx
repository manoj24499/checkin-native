import { Pressable, StyleSheet, View } from "react-native";
import { colors } from "@/theme";

interface ToggleProps {
  value: boolean;
  onValueChange: (value: boolean) => void;
  disabled?: boolean;
}

/** On = ink track with a lime knob; off = muted track with a white knob. */
export function Toggle({ value, onValueChange, disabled }: ToggleProps) {
  return (
    <Pressable
      onPress={() => !disabled && onValueChange(!value)}
      disabled={disabled}
      accessibilityRole="switch"
      accessibilityState={{ checked: value, disabled: !!disabled }}
      hitSlop={6}
      style={[styles.track, { backgroundColor: value ? colors.ink : "#D5DEC4" }, disabled && styles.disabled]}
    >
      <View style={[styles.knob, { left: value ? 22 : 4, backgroundColor: value ? colors.lime : colors.surface }]} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  track: { width: 44, height: 26, borderRadius: 13, justifyContent: "center" },
  knob: { position: "absolute", top: 4, width: 18, height: 18, borderRadius: 99 },
  disabled: { opacity: 0.5 },
});
