import { View } from "react-native";

interface BarSparkProps {
  /** Bar heights as 0-100 percentages. */
  values: number[];
  color: string;
  height?: number;
  gap?: number;
}

/** Small bar-spark row shared by the presence card's activity strip, the
 * live-map ping panel, and the weekly-hours chart. */
export function BarSpark({ values, color, height = 26, gap = 4 }: BarSparkProps) {
  return (
    <View style={{ flexDirection: "row", alignItems: "flex-end", gap, height }}>
      {values.map((v, i) => (
        <View
          key={i}
          style={{
            flex: 1,
            borderRadius: 2,
            backgroundColor: color,
            height: `${Math.max(4, Math.min(100, v))}%`,
          }}
        />
      ))}
    </View>
  );
}
