import { Pressable, StyleSheet, Text, View } from "react-native";
import { colors, radius, spacing } from "@/theme";

interface PinKeypadProps {
  value: string;
  onChange: (value: string) => void;
  maxLength?: number;
}

const KEYS = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "•", "0", "⌫"];

export function PinKeypad({ value, onChange, maxLength = 6 }: PinKeypadProps) {
  const press = (key: string) => {
    if (key === "⌫") {
      onChange(value.slice(0, -1));
      return;
    }
    if (key === "•") return; // decorative filler, keeps the grid symmetric
    if (value.length < maxLength) onChange(value + key);
  };

  return (
    <View>
      <View style={styles.dotsRow}>
        {Array.from({ length: maxLength }, (_, i) => i < value.length).map((filled, i) => (
          <View key={i} style={[styles.dot, filled && styles.dotFilled]}>
            <View style={[styles.dotInner, filled && styles.dotInnerFilled]} />
          </View>
        ))}
      </View>

      <View style={styles.grid}>
        {KEYS.map((key) => (
          <Pressable
            key={key}
            onPress={() => press(key)}
            disabled={key === "•"}
            style={({ pressed }) => [styles.key, pressed && key !== "•" && styles.keyPressed]}
          >
            <Text style={styles.keyLabel}>{key}</Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  dotsRow: { flexDirection: "row", gap: spacing.sm },
  dot: {
    flex: 1,
    height: 44,
    borderRadius: radius.md - 1,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    alignItems: "center",
    justifyContent: "center",
  },
  dotFilled: {
    borderColor: "rgba(240,100,0,0.55)",
    backgroundColor: "rgba(240,100,0,0.07)",
  },
  dotInner: {
    width: 9,
    height: 9,
    borderRadius: 99,
    backgroundColor: "rgba(26,21,18,0.16)",
  },
  dotInnerFilled: { backgroundColor: colors.primary },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  key: {
    width: "31%",
    height: 46,
    borderRadius: radius.md - 1,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
  },
  keyPressed: { backgroundColor: colors.primaryMuted, borderColor: colors.primary },
  keyLabel: { fontSize: 19, color: colors.textPrimary, fontVariant: ["tabular-nums"] },
});
