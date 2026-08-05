import { Pressable, StyleSheet, View } from "react-native";
import { colors } from "@/theme";

interface ToggleProps {
  value: boolean;
  onValueChange: (value: boolean) => void;
  disabled?: boolean;
}

export function Toggle({ value, onValueChange, disabled }: ToggleProps) {
  return (
    <Pressable
      onPress={() => !disabled && onValueChange(!value)}
      disabled={disabled}
      style={[
        styles.track,
        {
          backgroundColor: value ? "rgba(240,100,0,0.16)" : colors.surfaceMuted,
          borderColor: value ? "rgba(240,100,0,0.5)" : colors.border,
        },
        disabled && styles.disabled,
      ]}
    >
      <View
        style={[
          styles.knob,
          { left: value ? 22 : 3, backgroundColor: value ? colors.primary : "#B8ADA6" },
        ]}
      />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  track: { width: 44, height: 26, borderRadius: 99, borderWidth: 1, justifyContent: "center" },
  knob: { position: "absolute", top: 3, width: 18, height: 18, borderRadius: 99 },
  disabled: { opacity: 0.5 },
});
