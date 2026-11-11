import { ReactNode } from "react";
import { Image, StyleSheet, Text, View, type ViewStyle } from "react-native";
import { GradientFill } from "./GradientFill";
import { PulseRing } from "./PulseRing";
import { colors, fontFamilies } from "@/theme";

export interface AvatarBadgeProps {
  /** Shown as-is (max 3 chars). Omit and pass `name` to derive ("Manoj Gupta" -> "MG"). */
  initials?: string;
  name?: string;
  /** Optional photo URI (drawn over the gradient, clipped to the circle). */
  photoUri?: string | null;
  /** Diameter. Default 44 (Home header); Profile uses 68, the login identity card 52. */
  size?: number;
  /**
   * Pulsing halo: true / "fill" = soft orange disc expanding behind (Home), "ring" = expanding 2px outline
   * (Profile). false (default) = none.
   */
  pulse?: boolean | "fill" | "ring";
  /** Bottom-right adornment (e.g. a 24px dark circle with a camera icon). */
  badge?: ReactNode;
  style?: ViewStyle;
}

function deriveInitials(name?: string) {
  if (!name) return "";
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "";
  const first = parts[0][0] ?? "";
  const last = parts.length > 1 ? parts[parts.length - 1][0] ?? "" : "";
  return (first + last).toUpperCase();
}

/** Orange-gradient circle with dark initials (Inter 700), optional photo, pulse halo and corner badge. */
export function AvatarBadge({ initials, name, photoUri, size = 44, pulse = false, badge, style }: AvatarBadgeProps) {
  const text = (initials ?? deriveInitials(name)).slice(0, 3);
  const pulseVariant = pulse === "ring" ? "ring" : "fill";
  return (
    <View style={[{ width: size, height: size }, style]}>
      {pulse ? (
        <PulseRing
          size={size}
          variant={pulseVariant}
          scaleTo={pulseVariant === "ring" ? 1.5 : 1.8}
          opacityFrom={pulseVariant === "ring" ? 0.8 : 0.55}
          duration={pulseVariant === "ring" ? 2600 : 2400}
        />
      ) : null}
      <GradientFill style={[styles.circle, { width: size, height: size, borderRadius: size / 2 }]}>
        {text ? (
          <Text style={[styles.initials, { fontSize: Math.round(size * 0.33) }]} numberOfLines={1}>
            {text}
          </Text>
        ) : null}
        {photoUri ? <Image source={{ uri: photoUri }} style={StyleSheet.absoluteFill} resizeMode="cover" /> : null}
      </GradientFill>
      {badge ? <View style={styles.badge}>{badge}</View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  circle: { alignItems: "center", justifyContent: "center" },
  initials: { fontFamily: fontFamilies.bold, fontWeight: "700", color: colors.onOrange },
  badge: { position: "absolute", right: -2, bottom: -2 },
});
