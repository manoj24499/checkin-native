import { useEffect, useRef, useState, type ReactNode } from "react";
import { Animated, Easing, Pressable, StyleSheet, Text, View, useWindowDimensions } from "react-native";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import Svg, { Circle, G, Path, Rect } from "react-native-svg";
import { colors } from "@/theme";
import type { AuthStackParamList } from "@/navigation/types";

// "Welcome Screen Final": a live clock inside a seconds ring, with a slowly rotating ring of stickers around
// it, orbiting comets, sonar ripples and twinkles, then the headline and sign-in actions. The whole thing is
// laid out on the design's 390 x 844 stage and scaled to fit the screen.
const STAGE_W = 390;
const STAGE_H = 844;
const CX = 195;
const CY = 250;
const SPIN_MS = 60_000;
// The design staggers its entrance; compressed a little so the sign-in button is never kept waiting.
const T = 0.6;

const ORANGE = "#ef6c00";
const ORANGE_SOFT = "#FF8A3D";
const GREEN = "#2E6F52";
const PEACH = "#F7B27A";
const GOLD = "#B8860B";
const RED = "#F0746D";
const INK = "#1A1512";
const PAPER = "#0A0A0A";
const HAND = "#F5F5F5";

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
      <Path d="M32 19v14l9 6" stroke={HAND} strokeWidth="4" strokeLinecap="round" fill="none" />
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

function Sparkle({ size, color }: { size: number; color: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path d="M12 0c1 7 5 11 12 12-7 1-11 5-12 12-1-7-5-11-12-12 7-1 11-5 12-12z" fill={color} />
    </Svg>
  );
}

type Art = (p: SvgProps) => ReactNode;

// The ring of stickers around the clock: [art, width, height, angle in degrees].
const RING_SPEC: [Art, number, number, number][] = [
  [LogoTile, 60, 60, -90],
  [ClockSticker, 52, 52, -38],
  [PinSticker, 44, 54, 12],
  [BadgeSticker, 56, 56, 58],
  [ShieldSticker, 46, 54, 112],
  [BellSticker, 48, 48, 160],
  [TimerSticker, 44, 44, 195],
  [CardSticker, 56, 42, 228],
];

const RING_R = 150;
const GROUP = 400; // the rotating group is a square centred on the clock
const GROUP_X = CX - GROUP / 2;
const GROUP_Y = CY - GROUP / 2;

const RING = RING_SPEC.map(([art, w, h, deg], i) => {
  const t = (deg * Math.PI) / 180;
  return {
    art,
    w,
    h,
    // position inside the rotating group
    x: GROUP / 2 + RING_R * Math.cos(t) - w / 2,
    y: GROUP / 2 + RING_R * Math.sin(t) - h / 2,
    delay: 200 + i * 110,
    phase: (i * 370) % 1400,
  };
});

const TWINKLES = [
  { x: 58, y: 96, size: 18, delay: 1200, color: PEACH },
  { x: 326, y: 70, size: 16, delay: 1300, color: GOLD },
  { x: 352, y: 372, size: 20, delay: 1500, color: GREEN },
  { x: 26, y: 396, size: 14, delay: 1600, color: ORANGE },
  { x: 250, y: 90, size: 10, delay: 1500, color: ORANGE, dot: true },
  { x: 120, y: 420, size: 10, delay: 1700, color: PEACH, dot: true },
];

/** Starts an animation on mount; stops it on unmount. */
function useAnimation(make: () => Animated.CompositeAnimation) {
  useEffect(() => {
    const anim = make();
    anim.start();
    return () => anim.stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}

function ringAbs(left: number, top: number, w: number, h: number) {
  return { position: "absolute" as const, left, top, width: w, height: h };
}

function Orbit({ diameter, delay }: { diameter: number; delay: number }) {
  const v = useRef(new Animated.Value(0)).current;
  useAnimation(() =>
    Animated.sequence([Animated.delay(delay), Animated.timing(v, { toValue: 1, duration: 1000, easing: Easing.out(Easing.ease), useNativeDriver: true })]),
  );
  return (
    <Animated.View
      pointerEvents="none"
      style={[
        ringAbs(CX - diameter / 2, CY - diameter / 2, diameter, diameter),
        {
          borderRadius: diameter / 2,
          borderWidth: 1,
          borderColor: "rgba(255,255,255,0.08)",
          opacity: v,
          transform: [{ scale: v.interpolate({ inputRange: [0, 1], outputRange: [0.6, 1] }) }],
        },
      ]}
    />
  );
}

/** Sonar ripple: a ring that grows from the seconds ring outwards and fades. */
function Ripple({ delay }: { delay: number }) {
  const v = useRef(new Animated.Value(0)).current;
  useAnimation(() =>
    Animated.sequence([
      Animated.delay(delay),
      Animated.loop(Animated.timing(v, { toValue: 1, duration: 2800, easing: Easing.bezier(0.2, 0.8, 0.2, 1), useNativeDriver: true })),
    ]),
  );
  return (
    <Animated.View
      pointerEvents="none"
      style={[
        ringAbs(CX - 100, CY - 100, 200, 200),
        {
          borderRadius: 100,
          borderWidth: 1,
          borderColor: "rgba(239,108,0,0.5)",
          opacity: v.interpolate({ inputRange: [0, 1], outputRange: [0.55, 0] }),
          transform: [{ scale: v.interpolate({ inputRange: [0, 1], outputRange: [1, 2.1] }) }],
        },
      ]}
    />
  );
}

/** A glowing dot travelling around a circle of the given diameter. */
function Comet({
  diameter,
  seconds,
  color,
  dot,
  reverse,
  offset = 0,
}: {
  diameter: number;
  seconds: number;
  color: string;
  dot: number;
  reverse?: boolean;
  offset?: number;
}) {
  const spin = useRef(new Animated.Value(offset)).current;
  const fade = useRef(new Animated.Value(0)).current;
  useAnimation(() =>
    Animated.parallel([
      Animated.sequence([Animated.delay(900), Animated.timing(fade, { toValue: 1, duration: 1000, useNativeDriver: true })]),
      Animated.loop(Animated.timing(spin, { toValue: offset + 1, duration: seconds * 1000, easing: Easing.linear, useNativeDriver: true })),
    ]),
  );
  // `offset` starts the dot part-way round; the range covers two turns so it never runs off the end.
  const deg = spin.interpolate({ inputRange: [0, 2], outputRange: reverse ? ["0deg", "-720deg"] : ["0deg", "720deg"] });
  return (
    <Animated.View
      pointerEvents="none"
      style={[ringAbs(CX - diameter / 2, CY - diameter / 2, diameter, diameter), { opacity: fade, transform: [{ rotate: deg }] }]}
    >
      <View style={{ position: "absolute", left: diameter / 2 - dot * 1.6, top: -dot * 1.6, width: dot * 3.2, height: dot * 3.2, borderRadius: dot * 1.6, backgroundColor: color, opacity: 0.22 }} />
      <View style={{ position: "absolute", left: diameter / 2 - dot / 2, top: -dot / 2, width: dot, height: dot, borderRadius: dot / 2, backgroundColor: color }} />
    </Animated.View>
  );
}

function Twinkle({ def }: { def: (typeof TWINKLES)[number] }) {
  const pop = useRef(new Animated.Value(0)).current;
  const pulse = useRef(new Animated.Value(0)).current;
  useAnimation(() =>
    Animated.parallel([
      Animated.sequence([Animated.delay(def.delay * T), Animated.timing(pop, { toValue: 1, duration: 500, useNativeDriver: true })]),
      ...(def.dot
        ? []
        : [
            Animated.loop(
              Animated.sequence([
                Animated.timing(pulse, { toValue: 1, duration: 1300, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
                Animated.timing(pulse, { toValue: 0, duration: 1300, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
              ]),
            ),
          ]),
    ]),
  );
  return (
    <Animated.View
      pointerEvents="none"
      style={[
        ringAbs(def.x, def.y, def.size, def.size),
        {
          opacity: pop,
          transform: [
            { scale: pop },
            { scale: pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 0.55] }) },
            { rotate: pulse.interpolate({ inputRange: [0, 1], outputRange: ["0deg", "45deg"] }) },
          ],
        },
      ]}
    >
      {def.dot ? (
        <View style={{ width: def.size, height: def.size, borderRadius: def.size / 2, backgroundColor: def.color }} />
      ) : (
        <Sparkle size={def.size} color={def.color} />
      )}
    </Animated.View>
  );
}

function RingSticker({ def, spin }: { def: (typeof RING)[number]; spin: Animated.Value }) {
  const pop = useRef(new Animated.Value(0)).current;
  const bob = useRef(new Animated.Value(0)).current;
  const tap = useRef(new Animated.Value(0)).current;
  useAnimation(() =>
    Animated.parallel([
      Animated.sequence([Animated.delay(def.delay * T), Animated.spring(pop, { toValue: 1, friction: 5, tension: 90, useNativeDriver: true })]),
      Animated.sequence([
        Animated.delay((def.delay + 500 + def.phase) * T),
        Animated.loop(
          Animated.sequence([
            Animated.timing(bob, { toValue: 1, duration: 3400, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
            Animated.timing(bob, { toValue: 0, duration: 3400, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
          ]),
        ),
      ]),
    ]),
  );
  const onTap = () => {
    tap.setValue(0);
    Animated.timing(tap, { toValue: 1, duration: 600, easing: Easing.out(Easing.quad), useNativeDriver: true }).start();
  };
  // Counter-rotate against the ring so every sticker stays upright as the ring turns.
  const upright = spin.interpolate({ inputRange: [0, 1], outputRange: ["0deg", "-360deg"] });
  return (
    <Animated.View
      style={[
        ringAbs(def.x, def.y, def.w, def.h),
        {
          opacity: pop.interpolate({ inputRange: [0, 0.4], outputRange: [0, 1], extrapolate: "clamp" }),
          transform: [{ scale: pop }, { rotate: pop.interpolate({ inputRange: [0, 1], outputRange: ["-30deg", "0deg"] }) }],
        },
      ]}
    >
      <Animated.View style={{ transform: [{ rotate: upright }] }}>
        <Animated.View
          style={{
            transform: [
              { translateY: bob.interpolate({ inputRange: [0, 1], outputRange: [0, -8] }) },
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
              {def.art({ width: def.w, height: def.h })}
            </Animated.View>
          </Pressable>
        </Animated.View>
      </Animated.View>
    </Animated.View>
  );
}

/** The slowly turning ring of stickers. */
function StickerRing() {
  const spin = useRef(new Animated.Value(0)).current;
  useAnimation(() => Animated.loop(Animated.timing(spin, { toValue: 1, duration: SPIN_MS, easing: Easing.linear, useNativeDriver: true })));
  return (
    <Animated.View
      style={[
        ringAbs(GROUP_X, GROUP_Y, GROUP, GROUP),
        { transform: [{ rotate: spin.interpolate({ inputRange: [0, 1], outputRange: ["0deg", "360deg"] }) }] },
      ]}
    >
      {RING.map((def, i) => (
        <RingSticker key={i} def={def} spin={spin} />
      ))}
    </Animated.View>
  );
}

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** Time in IST regardless of the phone's own time zone (the product runs on IST). */
function istParts(now: number) {
  const d = new Date(now + 5.5 * 3600_000);
  const p = (n: number) => String(n).padStart(2, "0");
  return {
    hh: p(d.getUTCHours()),
    mm: p(d.getUTCMinutes()),
    sec: d.getUTCSeconds(),
    date: `${DAYS[d.getUTCDay()]} ${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]}`,
  };
}

const ARC = 2 * Math.PI * 99;

/** Live clock inside a seconds ring, with a blinking colon and a live dot beside the date. */
function ClockFace() {
  const [now, setNow] = useState(Date.now());
  const rise = useRef(new Animated.Value(0)).current;
  const live = useRef(new Animated.Value(1)).current;
  const fade = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const iv = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(iv);
  }, []);
  useAnimation(() =>
    Animated.parallel([
      Animated.sequence([Animated.delay(200), Animated.timing(fade, { toValue: 1, duration: 1000, useNativeDriver: true })]),
      Animated.sequence([Animated.delay(300), Animated.timing(rise, { toValue: 1, duration: 600, easing: Easing.out(Easing.cubic), useNativeDriver: true })]),
      Animated.loop(
        Animated.sequence([
          Animated.timing(live, { toValue: 0.35, duration: 800, useNativeDriver: true }),
          Animated.timing(live, { toValue: 1, duration: 800, useNativeDriver: true }),
        ]),
      ),
    ]),
  );
  const t = istParts(now);
  const offset = ARC * (1 - (t.sec + 1) / 60);
  return (
    <>
      <Animated.View pointerEvents="none" style={[ringAbs(95, 150, 200, 200), { opacity: fade, transform: [{ rotate: "-90deg" }] }]}>
        <Svg width={200} height={200} viewBox="0 0 200 200">
          <Circle cx="100" cy="100" r="99" fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="2" />
          <Circle cx="100" cy="100" r="99" fill="none" stroke={ORANGE} strokeWidth="2" strokeLinecap="round" strokeDasharray={`${ARC}`} strokeDashoffset={offset} />
        </Svg>
      </Animated.View>
      <Animated.View
        pointerEvents="none"
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          top: 204,
          alignItems: "center",
          opacity: rise,
          transform: [{ translateY: rise.interpolate({ inputRange: [0, 1], outputRange: [14, 0] }) }],
        }}
      >
        <Text style={styles.clock}>
          {t.hh}
          <Text style={{ opacity: t.sec % 2 === 0 ? 1 : 0 }}>:</Text>
          {t.mm}
        </Text>
        <View style={styles.dateRow}>
          <Animated.View style={[styles.liveDot, { opacity: live }]} />
          <Text style={styles.date}>{t.date} · IST</Text>
        </View>
      </Animated.View>
    </>
  );
}

/** Fades and slides up into place after `delay` ms. */
function Rise({ delay, children, style }: { delay: number; children: ReactNode; style?: object }) {
  const v = useRef(new Animated.Value(0)).current;
  useAnimation(() => Animated.sequence([Animated.delay(delay * T), Animated.timing(v, { toValue: 1, duration: 600, easing: Easing.out(Easing.cubic), useNativeDriver: true })]));
  return (
    <Animated.View style={[style, { opacity: v, transform: [{ translateY: v.interpolate({ inputRange: [0, 1], outputRange: [14, 0] }) }] }]}>
      {children}
    </Animated.View>
  );
}

/** One headline line that slides up out of a clipped box. */
function HeadlineLine({ text, delay, color }: { text: string; delay: number; color: string }) {
  const v = useRef(new Animated.Value(0)).current;
  useAnimation(() => Animated.sequence([Animated.delay(delay * T), Animated.timing(v, { toValue: 1, duration: 800, easing: Easing.out(Easing.cubic), useNativeDriver: true })]));
  return (
    <View style={styles.lineClip}>
      <Animated.Text style={[styles.headline, { color, transform: [{ translateY: v.interpolate({ inputRange: [0, 1], outputRange: [52, 0] }) }] }]}>
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

  const scale = Math.min(width / STAGE_W, (height - insets.top - insets.bottom) / STAGE_H);

  return (
    <View style={[styles.container, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
      <StatusBar style="light" />
      <View style={[styles.stage, { transform: [{ scale }] }]}>
        <Orbit diameter={200} delay={0} />
        <Orbit diameter={300} delay={150} />
        <Orbit diameter={420} delay={300} />
        <Ripple delay={1200} />
        <Ripple delay={2600} />
        <Comet diameter={420} seconds={9} color={ORANGE} dot={7} />
        <Comet diameter={300} seconds={14} color={PEACH} dot={5} reverse />
        <Comet diameter={420} seconds={9} color="rgba(239,108,0,0.5)" dot={4} offset={0.75} />
        {TWINKLES.map((t, i) => (
          <Twinkle key={i} def={t} />
        ))}
        <StickerRing />
        <ClockFace />

        <View style={styles.bottom}>
          <View accessible accessibilityRole="header" accessibilityLabel="Your day. One tap.">
            <HeadlineLine text="Your day." delay={540} color={HAND} />
            <HeadlineLine text="One tap." delay={630} color={ORANGE} />
          </View>
          <Rise delay={750}>
            <Text style={styles.copy}>Sign in to check in, track your hours and view your attendance.</Text>
          </Rise>
          <View style={styles.actions}>
            <Rise delay={840}>
              <Pressable
                onPress={() => navigation.navigate("Login")}
                accessibilityRole="button"
                style={({ pressed }) => [styles.signIn, pressed && styles.pressed]}
              >
                <Text style={styles.signInLabel}>Sign in</Text>
              </Pressable>
            </Rise>
            <Rise delay={940} style={styles.links}>
              <Pressable onPress={() => navigation.navigate("ResetPin")} hitSlop={10} accessibilityRole="button">
                <Text style={styles.linkStrong}>Forgot PIN?</Text>
              </Pressable>
              <Text style={styles.dot}>·</Text>
              <Pressable onPress={() => navigation.navigate("SetupPin")} hitSlop={10} accessibilityRole="button">
                <Text style={styles.linkMuted}>
                  First time here? <Text style={styles.linkAccent}>Set up your PIN</Text>
                </Text>
              </Pressable>
            </Rise>
          </View>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0A0A0A", alignItems: "center", justifyContent: "center", overflow: "hidden" },
  stage: { width: STAGE_W, height: STAGE_H },
  clock: {
    fontFamily: "Inter_500Medium",
    fontSize: 52,
    lineHeight: 56,
    letterSpacing: -1.5,
    color: HAND,
    fontVariant: ["tabular-nums"],
  },
  dateRow: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 2 },
  liveDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: ORANGE },
  date: { fontFamily: "Inter_400Regular", fontSize: 13, color: "#A3A3A3" },
  bottom: { position: "absolute", left: 0, right: 0, top: 468, bottom: 0, alignItems: "center", paddingHorizontal: 24, paddingBottom: 34 },
  lineClip: { overflow: "hidden", paddingBottom: 4 },
  headline: { fontFamily: "Inter_700Bold", fontSize: 36, lineHeight: 40, letterSpacing: -0.8, textAlign: "center" },
  copy: { fontFamily: "Inter_400Regular", fontSize: 15, lineHeight: 22, color: "#A3A3A3", textAlign: "center", maxWidth: 300, marginTop: 10 },
  actions: { alignSelf: "stretch", marginTop: 40, gap: 14 },
  signIn: {
    minHeight: 50,
    borderRadius: 25,
    borderWidth: 1.5,
    borderColor: ORANGE,
    backgroundColor: "rgba(239,108,0,0.18)",
    alignItems: "center",
    justifyContent: "center",
  },
  pressed: { opacity: 0.8, transform: [{ scale: 0.98 }] },
  signInLabel: { fontFamily: "Inter_600SemiBold", fontSize: 15, color: ORANGE_SOFT },
  links: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 12 },
  linkStrong: { fontFamily: "Inter_600SemiBold", fontSize: 13, color: HAND },
  dot: { fontSize: 13, color: "#737373" },
  linkMuted: { fontFamily: "Inter_400Regular", fontSize: 13, color: "#A3A3A3" },
  linkAccent: { fontFamily: "Inter_600SemiBold", color: ORANGE_SOFT },
});
