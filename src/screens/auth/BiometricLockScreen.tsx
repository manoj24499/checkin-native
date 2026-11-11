import { useEffect, useRef, useState } from "react";
import { Animated, Easing, Pressable, StyleSheet, Text, View } from "react-native";
import Svg, { Circle, Path } from "react-native-svg";
import { SafeAreaView } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { AmbientGlow, Button, LivePill, PulseRing, Rise } from "@/components/ui";
import { BrandLockup } from "@/components/branding/BrandLockup";
import { colors, fontFamilies, typography } from "@/theme";
import { Caps } from "./AuthField";

const SIZE = 168;
const R = 80;
const C = 2 * Math.PI * R;
const HOLD_MS = 800;

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

/**
 * Biometric lock overlay. Presses on the sensor ring fill a progress ring; holding for the full duration (or
 * tapping "Try again") calls `onRetry`, which re-opens the system biometric prompt. The real unlock decision
 * still comes from that prompt — this component only presents it.
 *
 * No dedicated mockup: built from the Login.dc.html language (light page, glows, brand lockup + glass chip,
 * Space Grotesk title, gradient CTA).
 */
export function BiometricLockScreen({ onRetry }: { onRetry: () => void }) {
  const progress = useRef(new Animated.Value(0)).current;
  const anim = useRef<Animated.CompositeAnimation | null>(null);
  const [holding, setHolding] = useState(false);

  useEffect(() => () => anim.current?.stop(), []);

  const start = () => {
    setHolding(true);
    progress.setValue(0);
    anim.current = Animated.timing(progress, { toValue: 1, duration: HOLD_MS, easing: Easing.linear, useNativeDriver: false });
    anim.current.start(({ finished }) => {
      if (finished) {
        setHolding(false);
        progress.setValue(0);
        onRetry();
      }
    });
  };
  const end = () => {
    if (!holding) return;
    anim.current?.stop();
    setHolding(false);
    progress.setValue(0);
  };

  const dashOffset = progress.interpolate({ inputRange: [0, 1], outputRange: [C, 0] });

  return (
    <View style={styles.root}>
      <StatusBar style="dark" />
      <AmbientGlow preset="login" />
      <SafeAreaView style={styles.safe}>
        <Rise style={styles.top}>
          <BrandLockup />
          <LivePill tone="glass" label="Locked" dotColor="#FF9A3D" style={{ alignSelf: "center", paddingVertical: 6 }} />
        </Rise>

        <Rise delay={100} style={styles.copy}>
          <Caps>App locked</Caps>
          <Text style={styles.title}>Locked</Text>
          <Text style={styles.message}>Unlock with Face ID / fingerprint to continue.</Text>
        </Rise>

        <Rise delay={200} style={styles.sensorWrap}>
          <View style={styles.sensorBox}>
            <PulseRing size={SIZE} variant="ring" color="rgba(239,108,0,0.45)" scaleTo={1.35} opacityFrom={0.8} duration={2400} enabled={!holding} />
            <Pressable
              onPressIn={start}
              onPressOut={end}
              accessibilityRole="button"
              accessibilityLabel="Hold to unlock with fingerprint"
              style={[styles.sensor, holding && styles.sensorHolding]}
            >
              <Svg width={SIZE} height={SIZE} viewBox={`0 0 ${SIZE} ${SIZE}`} style={StyleSheet.absoluteFill}>
                <Circle cx={84} cy={84} r={R} fill="none" stroke="rgba(23,19,15,0.08)" strokeWidth={4} />
                <AnimatedCircle
                  cx={84}
                  cy={84}
                  r={R}
                  fill="none"
                  stroke={colors.primary}
                  strokeWidth={4}
                  strokeLinecap="round"
                  strokeDasharray={`${C} ${C}`}
                  strokeDashoffset={dashOffset}
                  rotation={-90}
                  origin="84, 84"
                />
              </Svg>
              <Svg
                width={72}
                height={72}
                viewBox="0 0 24 24"
                fill="none"
                stroke={holding ? colors.primary : colors.ink}
                strokeWidth={1.4}
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <Path d="M12 10a2 2 0 0 0-2 2c0 1.02-.1 2.51-.26 4" />
                <Path d="M14 13.12c0 2.38 0 6.38-1 8.88" />
                <Path d="M17.29 21.02c.12-.6.43-2.3.5-3.02" />
                <Path d="M2 12a10 10 0 0 1 18-6" />
                <Path d="M2 16h.01" />
                <Path d="M21.8 16c.2-2 .131-5.354 0-6" />
                <Path d="M5 19.5C5.5 18 6 15 6 12a6 6 0 0 1 .34-2" />
                <Path d="M8.65 22c.21-.66.45-1.32.57-2" />
                <Path d="M9 6.8a6 6 0 0 1 9 5.2v2" />
              </Svg>
            </Pressable>
          </View>
          <Text style={styles.hint}>{holding ? "Keep holding…" : "Press and hold the sensor"}</Text>
        </Rise>

        <Rise delay={300}>
          <Button size="lg" pulse label="Try again" onPress={onRetry} />
        </Rise>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background, overflow: "hidden" },
  safe: { flex: 1, paddingHorizontal: 20, paddingTop: 12, paddingBottom: 16, gap: 16 },
  top: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  copy: { alignItems: "center", marginTop: 32 },
  title: { ...typography.h1, fontSize: 32, lineHeight: 38, color: colors.ink, marginTop: 4 },
  message: {
    fontSize: 14,
    lineHeight: 21,
    fontFamily: fontFamilies.regular,
    color: colors.textSecondary,
    textAlign: "center",
    maxWidth: 280,
    marginTop: 6,
  },
  sensorWrap: { flex: 1, alignItems: "center", justifyContent: "center", gap: 20 },
  sensorBox: { width: SIZE, height: SIZE },
  sensor: {
    width: SIZE,
    height: SIZE,
    borderRadius: SIZE / 2,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    alignItems: "center",
    justifyContent: "center",
  },
  sensorHolding: { borderColor: "#FF9A3D" },
  hint: { fontSize: 13, fontFamily: fontFamilies.regular, color: colors.textSecondary },
});
