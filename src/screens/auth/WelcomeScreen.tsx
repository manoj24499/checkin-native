import { useEffect, useRef, type ReactNode } from "react";
import { Animated, Easing, Pressable, StyleSheet, Text, View, useWindowDimensions } from "react-native";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import Svg, { Circle, Ellipse, G, Path, Rect } from "react-native-svg";
import { Button } from "@/components/ui";
import { colors, spacing, typography } from "@/theme";
import type { AuthStackParamList } from "@/navigation/types";

// The "playful splash" welcome: a field of floating stickers that pop in, bob and wiggle when tapped, above a
// two-line headline and the sign-in actions. Coordinates below are in the design's 390 x 540 space and are
// scaled to whatever screen this runs on.
const DESIGN_W = 390;
const DESIGN_H = 540;
// Space the headline, copy and buttons need below the illustration.
const TEXT_BLOCK_H = 310;
// The design staggers its entrance over ~2.2s; compressed so the sign-in buttons are never kept waiting.
const T = 0.6;

const ORANGE = "#ef6c00";
const GREEN = "#2E6F52";
const PEACH = "#F7B27A";
const GOLD = "#B8860B";
const RED = colors.danger;
const INK = "#1A1512";
const PAPER = colors.background;
const FACE = "#241E19";

interface SvgProps {
  width: number;
  height: number;
}

function LogoTile({ width, height }: SvgProps) {
  return (
    <Svg width={width} height={height} viewBox="0 0 68 68">
      <Rect x="1" y="1" width="66" height="66" rx="18" fill="#FFFFFF" stroke="rgba(26,21,18,0.10)" strokeWidth="2" />
      <Rect x="18" y="21" width="32" height="5" rx="2.5" fill={INK} />
      <Rect x="18" y="42" width="32" height="5" rx="2.5" fill={INK} />
      <Path d="M45 25L23 43" stroke={ORANGE} strokeWidth="5" strokeLinecap="round" />
    </Svg>
  );
}

function ClockSticker({ width, height }: SvgProps) {
  return (
    <Svg width={width} height={height} viewBox="0 0 64 64">
      <Circle cx="32" cy="32" r="28" fill={ORANGE} />
      <Circle cx="32" cy="32" r="21" fill={PAPER} />
      <Path d="M32 19v14l9 6" stroke={INK} strokeWidth="4" strokeLinecap="round" fill="none" />
    </Svg>
  );
}

function PinSticker({ width, height }: SvgProps) {
  return (
    <Svg width={width} height={height} viewBox="0 0 52 64">
      <Path d="M26 62S4 42 4 26a22 22 0 0 1 44 0c0 16-22 36-22 36z" fill={GREEN} />
      <Circle cx="26" cy="26" r="9" fill={PAPER} />
    </Svg>
  );
}

function BellSticker({ width, height }: SvgProps) {
  return (
    <Svg width={width} height={height} viewBox="0 0 56 56">
      <Path d="M28 6c-9 0-15 7-15 16v10l-5 8h40l-5-8V22c0-9-6-16-15-16z" fill={RED} />
      <Circle cx="28" cy="48" r="5" fill={RED} />
      <Path d="M20 20c1-5 4-8 8-9" stroke={PAPER} strokeWidth="3" strokeLinecap="round" fill="none" opacity={0.7} />
    </Svg>
  );
}

function TimerSticker({ width, height }: SvgProps) {
  return (
    <Svg width={width} height={height} viewBox="0 0 50 50">
      <Circle cx="25" cy="25" r="22" fill={GOLD} />
      <Circle cx="25" cy="25" r="14" fill="none" stroke={PAPER} strokeWidth="3" opacity={0.85} />
      <Path d="M25 17v8l5 3" stroke={PAPER} strokeWidth="3" strokeLinecap="round" fill="none" />
    </Svg>
  );
}

function BadgeSticker({ width, height }: SvgProps) {
  return (
    <Svg width={width} height={height} viewBox="0 0 64 64">
      <G fill={PEACH}>
        <Circle cx="32" cy="12" r="10" />
        <Circle cx="32" cy="52" r="10" />
        <Circle cx="12" cy="32" r="10" />
        <Circle cx="52" cy="32" r="10" />
        <Circle cx="18" cy="18" r="10" />
        <Circle cx="46" cy="18" r="10" />
        <Circle cx="18" cy="46" r="10" />
        <Circle cx="46" cy="46" r="10" />
        <Circle cx="32" cy="32" r="20" />
      </G>
      <Path d="M22 33l7 7 14-15" stroke={INK} strokeWidth="4.5" strokeLinecap="round" strokeLinejoin="round" fill="none" />
    </Svg>
  );
}

function GreenBlob({ width, height }: SvgProps) {
  return (
    <Svg width={width} height={height} viewBox="0 0 124 112">
      <Path d="M10 70C10 40 30 18 62 18s50 24 48 52c-2 26-24 36-50 36S10 94 10 70z" fill={GREEN} />
      <Circle cx="50" cy="60" r="5" fill={INK} />
      <Circle cx="78" cy="60" r="5" fill={INK} />
      <Path d="M54 76q10 10 22 0" stroke={INK} strokeWidth="3.5" strokeLinecap="round" fill="none" />
      <Circle cx="38" cy="72" r="5" fill={PEACH} opacity={0.7} />
      <Circle cx="90" cy="72" r="5" fill={PEACH} opacity={0.7} />
      <Path d="M108 52l12-14" stroke={INK} strokeWidth="3.5" strokeLinecap="round" />
    </Svg>
  );
}

function PeachBlob({ width, height }: SvgProps) {
  return (
    <Svg width={width} height={height} viewBox="0 0 110 120">
      <Path d="M55 8C75 8 98 40 104 78c3 20-10 36-50 36S-3 98 4 78C12 40 35 8 55 8z" fill={PEACH} />
      <Path d="M34 62q6-9 12 0M62 62q6-9 12 0" stroke={INK} strokeWidth="3.5" strokeLinecap="round" fill="none" />
      <Path d="M42 76q13 16 26 0z" fill={INK} />
      <Circle cx="30" cy="74" r="5" fill={RED} opacity={0.5} />
      <Circle cx="80" cy="74" r="5" fill={RED} opacity={0.5} />
    </Svg>
  );
}

function CardSticker({ width, height }: SvgProps) {
  return (
    <Svg width={width} height={height} viewBox="0 0 64 48">
      <Rect x="1" y="1" width="62" height="46" rx="9" fill="#FFFFFF" stroke="rgba(26,21,18,0.14)" strokeWidth="2" />
      <Circle cx="19" cy="19" r="8" fill={PEACH} />
      <Rect x="33" y="13" width="22" height="5" rx="2.5" fill={INK} />
      <Rect x="33" y="23" width="14" height="5" rx="2.5" fill="#A0A99B" />
      <Path d="M2 36h60v2a9 9 0 0 1-9 9H11a9 9 0 0 1-9-9z" fill={ORANGE} />
    </Svg>
  );
}

function ShieldSticker({ width, height }: SvgProps) {
  return (
    <Svg width={width} height={height} viewBox="0 0 56 64">
      <Path d="M28 4l22 8v18c0 16-10 26-22 30C16 56 6 46 6 30V12z" fill={GREEN} />
      <Path d="M18 31l7 7 13-14" stroke={PAPER} strokeWidth="4.5" strokeLinecap="round" strokeLinejoin="round" fill="none" />
    </Svg>
  );
}

function Mascot({ width, height }: SvgProps) {
  return (
    <Svg width={width} height={height} viewBox="0 0 130 156">
      <G fill={PEACH}>
        <Circle cx="65" cy="26" r="20" />
        <Circle cx="65" cy="94" r="20" />
        <Circle cx="31" cy="60" r="20" />
        <Circle cx="99" cy="60" r="20" />
        <Circle cx="41" cy="36" r="20" />
        <Circle cx="89" cy="36" r="20" />
        <Circle cx="41" cy="84" r="20" />
        <Circle cx="89" cy="84" r="20" />
        <Circle cx="65" cy="60" r="36" />
      </G>
      <Rect x="40" y="35" width="50" height="50" rx="11" fill={FACE} />
      <Circle cx="56" cy="55" r="4.5" fill="#F7F3EF" />
      <Circle cx="74" cy="55" r="4.5" fill="#F7F3EF" />
      <Path d="M57 68q8 7 16 0" stroke="#F7F3EF" strokeWidth="3" strokeLinecap="round" fill="none" />
      <Path d="M55 112v26M75 112v26" stroke={INK} strokeWidth="5" strokeLinecap="round" />
      <Ellipse cx="50" cy="143" rx="10" ry="5.5" fill={INK} />
      <Ellipse cx="80" cy="143" rx="10" ry="5.5" fill={INK} />
    </Svg>
  );
}

function Sparkle({ width, height, color }: SvgProps & { color: string }) {
  return (
    <Svg width={width} height={height} viewBox="0 0 24 24">
      <Path d="M12 0c1 7 5 11 12 12-7 1-11 5-12 12-1-7-5-11-12-12 7-1 11-5 12-12z" fill={color} />
    </Svg>
  );
}

interface Layout {
  s: number;
  offX: number;
  offY: number;
}

interface StickerDef {
  x: number;
  y: number;
  w: number;
  h: number;
  delay: number;
  phase: number;
  Art: (p: SvgProps) => ReactNode;
}

const STICKERS: StickerDef[] = [
  { x: 150, y: 28, w: 68, h: 68, delay: 200, phase: 0, Art: LogoTile },
  { x: 28, y: 74, w: 62, h: 62, delay: 300, phase: 500, Art: ClockSticker },
  { x: 306, y: 52, w: 50, h: 62, delay: 400, phase: 1100, Art: PinSticker },
  { x: 100, y: 150, w: 54, h: 54, delay: 500, phase: 300, Art: BellSticker },
  { x: 160, y: 126, w: 50, h: 50, delay: 600, phase: 800, Art: TimerSticker },
  { x: 268, y: 124, w: 66, h: 66, delay: 700, phase: 1400, Art: BadgeSticker },
  { x: -18, y: 218, w: 124, h: 112, delay: 800, phase: 600, Art: GreenBlob },
  { x: 296, y: 222, w: 112, h: 122, delay: 900, phase: 200, Art: PeachBlob },
  { x: 40, y: 388, w: 64, h: 48, delay: 1000, phase: 900, Art: CardSticker },
  { x: 290, y: 380, w: 54, h: 62, delay: 1100, phase: 1200, Art: ShieldSticker },
  { x: 130, y: 318, w: 130, h: 156, delay: 1300, phase: 100, Art: Mascot },
];

interface TwinkleDef {
  x: number;
  y: number;
  size: number;
  delay: number;
  color: string;
  dot?: boolean;
}

const TWINKLES: TwinkleDef[] = [
  { x: 74, y: 40, size: 22, delay: 1200, color: PEACH },
  { x: 252, y: 36, size: 18, delay: 1300, color: GOLD },
  { x: 36, y: 190, size: 16, delay: 1400, color: ORANGE },
  { x: 348, y: 176, size: 22, delay: 1500, color: GREEN },
  { x: 110, y: 330, size: 18, delay: 1600, color: PEACH },
  { x: 268, y: 340, size: 20, delay: 1700, color: RED },
  { x: 24, y: 150, size: 12, delay: 1500, color: GREEN, dot: true },
  { x: 340, y: 118, size: 12, delay: 1600, color: PEACH, dot: true },
  { x: 244, y: 188, size: 10, delay: 1700, color: ORANGE, dot: true },
];

function Sticker({ def, layout }: { def: StickerDef; layout: Layout }) {
  const pop = useRef(new Animated.Value(0)).current;
  const bob = useRef(new Animated.Value(0)).current;
  const tap = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const popIn = Animated.sequence([
      Animated.delay(def.delay * T),
      Animated.spring(pop, { toValue: 1, friction: 5, tension: 90, useNativeDriver: true }),
    ]);
    const float = Animated.sequence([
      Animated.delay((def.delay + 500 + def.phase) * T),
      Animated.loop(
        Animated.sequence([
          Animated.timing(bob, { toValue: 1, duration: 3400, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
          Animated.timing(bob, { toValue: 0, duration: 3400, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        ]),
      ),
    ]);
    popIn.start();
    float.start();
    return () => {
      popIn.stop();
      float.stop();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onTap = () => {
    tap.setValue(0);
    Animated.timing(tap, { toValue: 1, duration: 600, easing: Easing.out(Easing.quad), useNativeDriver: true }).start();
  };

  const { s, offX, offY } = layout;
  const width = def.w * s;
  const height = def.h * s;

  return (
    <Animated.View
      style={{
        position: "absolute",
        left: offX + def.x * s,
        top: offY + def.y * s,
        width,
        height,
        opacity: pop.interpolate({ inputRange: [0, 0.4], outputRange: [0, 1], extrapolate: "clamp" }),
        transform: [{ scale: pop }, { rotate: pop.interpolate({ inputRange: [0, 1], outputRange: ["-30deg", "0deg"] }) }],
      }}
    >
      <Animated.View
        style={{
          transform: [
            { translateY: bob.interpolate({ inputRange: [0, 1], outputRange: [0, -8 * s] }) },
            { rotate: bob.interpolate({ inputRange: [0, 1], outputRange: ["-2deg", "2deg"] }) },
          ],
        }}
      >
        <Pressable onPress={onTap} accessible={false} importantForAccessibility="no-hide-descendants">
          <Animated.View
            style={{
              transform: [
                { scale: tap.interpolate({ inputRange: [0, 0.35, 0.65, 1], outputRange: [1, 1.35, 0.92, 1] }) },
                { rotate: tap.interpolate({ inputRange: [0, 0.35, 0.65, 1], outputRange: ["0deg", "-14deg", "8deg", "0deg"] }) },
              ],
            }}
          >
            {def.Art({ width, height })}
          </Animated.View>
        </Pressable>
      </Animated.View>
    </Animated.View>
  );
}

function Twinkle({ def, layout }: { def: TwinkleDef; layout: Layout }) {
  const pop = useRef(new Animated.Value(0)).current;
  const pulse = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const popIn = Animated.sequence([Animated.delay(def.delay * T), Animated.timing(pop, { toValue: 1, duration: 500, useNativeDriver: true })]);
    popIn.start();
    let loop: Animated.CompositeAnimation | undefined;
    if (!def.dot) {
      loop = Animated.loop(
        Animated.sequence([
          Animated.timing(pulse, { toValue: 1, duration: 1300, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
          Animated.timing(pulse, { toValue: 0, duration: 1300, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        ]),
      );
      loop.start();
    }
    return () => {
      popIn.stop();
      loop?.stop();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const { s, offX, offY } = layout;
  const size = def.size * s;
  return (
    <Animated.View
      pointerEvents="none"
      style={{
        position: "absolute",
        left: offX + def.x * s,
        top: offY + def.y * s,
        width: size,
        height: size,
        opacity: pop,
        transform: [
          { scale: pop },
          { scale: pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 0.55] }) },
          { rotate: pulse.interpolate({ inputRange: [0, 1], outputRange: ["0deg", "45deg"] }) },
        ],
      }}
    >
      {def.dot ? (
        <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: def.color }} />
      ) : (
        <Sparkle width={size} height={size} color={def.color} />
      )}
    </Animated.View>
  );
}

function Orbit({ diameter, delay, layout }: { diameter: number; delay: number; layout: Layout }) {
  const grow = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const anim = Animated.sequence([Animated.delay(delay), Animated.timing(grow, { toValue: 1, duration: 1000, easing: Easing.out(Easing.ease), useNativeDriver: true })]);
    anim.start();
    return () => anim.stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const size = diameter * layout.s;
  return (
    <Animated.View
      pointerEvents="none"
      style={{
        position: "absolute",
        left: layout.offX + (DESIGN_W * layout.s) / 2 - size / 2,
        top: layout.offY + 380 * layout.s - size / 2,
        width: size,
        height: size,
        borderRadius: size / 2,
        borderWidth: 1,
        borderColor: "rgba(26,21,18,0.07)",
        opacity: grow,
        transform: [{ scale: grow.interpolate({ inputRange: [0, 1], outputRange: [0.6, 1] }) }],
      }}
    />
  );
}

/** Fades and slides up into place after `delay` ms. */
function Rise({ delay, children, style }: { delay: number; children: ReactNode; style?: object }) {
  const v = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const anim = Animated.sequence([Animated.delay(delay * T), Animated.timing(v, { toValue: 1, duration: 600, easing: Easing.out(Easing.cubic), useNativeDriver: true })]);
    anim.start();
    return () => anim.stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return (
    <Animated.View style={[style, { opacity: v, transform: [{ translateY: v.interpolate({ inputRange: [0, 1], outputRange: [14, 0] }) }] }]}>
      {children}
    </Animated.View>
  );
}

/** One headline line that slides up out of a clipped box. */
function HeadlineLine({ text, delay }: { text: string; delay: number }) {
  const v = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const anim = Animated.sequence([Animated.delay(delay * T), Animated.timing(v, { toValue: 1, duration: 800, easing: Easing.out(Easing.cubic), useNativeDriver: true })]);
    anim.start();
    return () => anim.stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return (
    <View style={styles.lineClip}>
      <Animated.Text style={[styles.headline, { transform: [{ translateY: v.interpolate({ inputRange: [0, 1], outputRange: [52, 0] }) }] }]}>
        {text}
      </Animated.Text>
    </View>
  );
}

/**
 * First screen a signed-out employee sees. Sign in goes to the form, Forgot PIN? to the reset-code flow, and
 * "Set up your PIN" to the first-time flow for an employee holding a temporary PIN from their admin.
 */
export function WelcomeScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<AuthStackParamList, "Welcome">>();
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();

  const illusH = Math.max(height - insets.top - insets.bottom - TEXT_BLOCK_H, 260);
  const s = Math.min(width / DESIGN_W, illusH / DESIGN_H);
  const layout: Layout = { s, offX: (width - DESIGN_W * s) / 2, offY: 0 };

  return (
    <View style={[styles.container, { paddingTop: insets.top, paddingBottom: Math.max(insets.bottom, spacing.md) }]}>
      <StatusBar style="light" />

      <View style={{ height: illusH, overflow: "hidden" }}>
        <Orbit diameter={300} delay={0} layout={layout} />
        <Orbit diameter={480} delay={150} layout={layout} />
        <Orbit diameter={660} delay={300} layout={layout} />
        {TWINKLES.map((t, i) => (
          <Twinkle key={`t${i}`} def={t} layout={layout} />
        ))}
        {STICKERS.map((def, i) => (
          <Sticker key={`s${i}`} def={def} layout={layout} />
        ))}
        {/* Fades the bottom of the field into the page so the stickers don't end on a hard edge. */}
        <View pointerEvents="none" style={styles.fade}>
          <View style={[styles.fadeBand, { opacity: 0.25 }]} />
          <View style={[styles.fadeBand, { opacity: 0.5 }]} />
          <View style={[styles.fadeBand, { opacity: 0.8 }]} />
          <View style={[styles.fadeBand, { opacity: 1 }]} />
        </View>
      </View>

      <View style={styles.body}>
        <View accessible accessibilityRole="header" accessibilityLabel="Your day. One tap.">
          <HeadlineLine text="Your day." delay={900} />
          <HeadlineLine text="One tap." delay={1050} />
        </View>
        <Rise delay={1250}>
          <Text style={styles.copy}>Sign in to check in, track your hours and view your attendance.</Text>
        </Rise>

        <View style={styles.actions}>
          <Rise delay={1400}>
            <Button label="Sign in" onPress={() => navigation.navigate("Login")} />
          </Rise>
          <Rise delay={1500}>
            <Button label="Forgot PIN?" variant="secondary" onPress={() => navigation.navigate("ResetPin")} />
          </Rise>
          <Rise delay={1600} style={styles.firstTimeRow}>
            <Pressable onPress={() => navigation.navigate("SetupPin")} hitSlop={8} accessibilityRole="button">
              <Text style={styles.firstTime}>
                First time here? <Text style={styles.firstTimeLink}>Set up your PIN</Text>
              </Text>
            </Pressable>
          </Rise>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  fade: { position: "absolute", left: 0, right: 0, bottom: 0, height: 72 },
  fadeBand: { flex: 1, backgroundColor: colors.background },
  body: { flex: 1, alignItems: "center", paddingHorizontal: spacing.lg, paddingTop: spacing.xs },
  lineClip: { overflow: "hidden", paddingBottom: 4 },
  headline: {
    fontFamily: "Inter_700Bold",
    fontSize: 40,
    lineHeight: 44,
    letterSpacing: -0.8,
    color: colors.ink,
    textAlign: "center",
  },
  copy: {
    ...typography.body,
    lineHeight: 22,
    color: colors.textSecondary,
    textAlign: "center",
    maxWidth: 300,
    marginTop: spacing.sm + 4,
  },
  actions: { marginTop: "auto", alignSelf: "stretch", gap: spacing.sm },
  firstTimeRow: { alignItems: "center", marginTop: spacing.xs },
  firstTime: { ...typography.caption, fontSize: 13, color: colors.textSecondary },
  firstTimeLink: { ...typography.bodyStrong, fontSize: 13, color: colors.primaryDark },
});
