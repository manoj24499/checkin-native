import { forwardRef, useEffect, useRef, useState } from "react";
import {
  Animated,
  Easing,
  StyleSheet,
  Text,
  TextInput,
  View,
  type StyleProp,
  type TextInputProps,
  type ViewStyle,
} from "react-native";
import { Icon, useLoop, useReducedMotion } from "@/components/ui";
import { colors, fontFamilies } from "@/theme";
import { FOCUS_ORANGE } from "./AuthField";

// ---------------------------------------------------------------------------------------------------------
// Small animated pieces
// ---------------------------------------------------------------------------------------------------------

/** CSS `steps(1)` blink: 0 for the first half of the cycle, 1 for the second. Module constant = stable. */
const STEP_EASING = (t: number) => (t < 0.5 ? 0 : 1);
const POP_EASING = Easing.bezier(0.3, 0.7, 0.2, 1);

/** Blinking text caret (mockup `caret` keyframe: 1s, steps). Solid under reduced motion. */
export function Caret({ height = 24, color = FOCUS_ORANGE }: { height?: number; color?: string }) {
  const t = useLoop({ duration: 1000, easing: STEP_EASING });
  return (
    <Animated.View
      style={{ width: 2, height, borderRadius: 1, backgroundColor: color, opacity: t.interpolate({ inputRange: [0, 1], outputRange: [1, 0] }) }}
    />
  );
}

/** A dot that pops in (scale 0 -> 1, .3s) when it mounts — one per typed digit (SetupPin `pop`). */
export function PopDot({ size = 10, color = colors.ink, delay = 0 }: { size?: number; color?: string; delay?: number }) {
  const reduced = useReducedMotion();
  const v = useRef(new Animated.Value(reduced ? 1 : 0)).current;
  useEffect(() => {
    if (reduced) return;
    const a = Animated.timing(v, { toValue: 1, duration: 300, delay, easing: POP_EASING, useNativeDriver: true });
    a.start();
    return () => a.stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return <Animated.View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: color, transform: [{ scale: v }] }} />;
}

/** Idle "typing" dot from Login.dc.html (`dot` keyframe: grow, hold, shrink over 3.6s, staggered .4s). */
function IdleDot({ index, size, color }: { index: number; size: number; color: string }) {
  const t = useLoop({ duration: 3600, delay: index * 400, easing: LINEAR, restValue: 0.5 });
  return (
    <Animated.View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: color,
        opacity: 0.35,
        transform: [{ scale: t.interpolate({ inputRange: [0, 0.15, 0.85, 1], outputRange: [0, 1, 1, 0] }) }],
      }}
    />
  );
}
const LINEAR = Easing.linear;

// ---------------------------------------------------------------------------------------------------------
// PIN entry: dots inside one box, typed via an invisible TextInput laid over it
// ---------------------------------------------------------------------------------------------------------

interface PinDotsFieldProps extends Omit<TextInputProps, "style" | "value"> {
  value: string;
  /**
   * "hero": Login's 62-high box, radius 16, centred orange 12px dots (+ idle typing dots while empty).
   * "inline": SetupPin/ChangePin `.fd` box, radius 14, left-aligned ink 10px dots.
   */
  variant?: "hero" | "inline";
  /** Box height (inline: 50 SetupPin, 54 ChangePin). */
  height?: number;
  /** Render the digits as text instead of dots ("Show digits"). */
  showDigits?: boolean;
  /** Border state: error = red, ok = green (PINs match). */
  tone?: "error" | "ok";
  style?: StyleProp<ViewStyle>;
}

export const PinDotsField = forwardRef<TextInput, PinDotsFieldProps>(function PinDotsField(
  { value, variant = "inline", height, showDigits, tone, style, onFocus, onBlur, accessibilityLabel, ...props },
  ref,
) {
  const [focused, setFocused] = useState(false);
  const hero = variant === "hero";
  const dotSize = hero ? 12 : 10;
  const dotColor = hero ? FOCUS_ORANGE : colors.ink;
  const h = height ?? (hero ? 62 : 50);
  const border =
    tone === "error"
      ? { borderColor: colors.danger, borderWidth: 1.5 }
      : tone === "ok"
        ? { borderColor: colors.success, borderWidth: 1.5 }
        : focused
          ? { borderColor: hero ? FOCUS_ORANGE : colors.primary, borderWidth: 1.5 }
          : null;
  return (
    <View
      style={[
        pin.box,
        { height: h, borderRadius: hero ? 16 : 14 },
        hero ? pin.heroBox : pin.inlineBox,
        hero ? null : { borderColor: colors.cardBorder },
        border,
        style,
      ]}
    >
      {showDigits && value.length > 0 ? (
        <Text style={[pin.digits, hero && pin.digitsHero]}>{value}</Text>
      ) : (
        Array.from({ length: value.length }, (_, i) => <PopDot key={i} size={dotSize} color={dotColor} />)
      )}
      {hero && value.length === 0 && !focused
        ? [0, 1, 2].map((i) => <IdleDot key={i} index={i} size={dotSize} color={dotColor} />)
        : null}
      {focused ? <Caret height={hero ? 24 : 22} color={hero ? FOCUS_ORANGE : colors.primary} /> : null}
      <TextInput
        ref={ref}
        value={value}
        keyboardType="number-pad"
        caretHidden
        contextMenuHidden
        accessibilityLabel={accessibilityLabel}
        onFocus={(e) => {
          setFocused(true);
          onFocus?.(e);
        }}
        onBlur={(e) => {
          setFocused(false);
          onBlur?.(e);
        }}
        style={pin.hiddenInput}
        {...props}
      />
    </View>
  );
});

// ---------------------------------------------------------------------------------------------------------
// PIN slots (SetupPin steps 2/3): one box per digit, plus the cursor box
// ---------------------------------------------------------------------------------------------------------

interface PinSlotsProps extends Omit<TextInputProps, "style" | "value"> {
  value: string;
  /** Confirm step: filled slots compare against this PIN (red on a wrong digit) and the row is its length. */
  compareTo?: string;
}

/**
 * The mockup's `.sl` row: 52-high boxes, radius 12, gap 6, a 10px ink dot per digit that pops in, and a 1.5px
 * orange box where the next digit goes. Choosing: at least 6 boxes (the minimum), growing to 10. Confirming:
 * one box per digit of the PIN being confirmed. Typed through an invisible TextInput over the row.
 */
export const PinSlots = forwardRef<TextInput, PinSlotsProps>(function PinSlots(
  { value, compareTo, onFocus, onBlur, ...props },
  ref,
) {
  const [focused, setFocused] = useState(false);
  const count = compareTo !== undefined ? Math.max(compareTo.length, value.length, 1) : Math.min(10, Math.max(6, value.length + 1));
  return (
    <View style={pin.slots}>
      {Array.from({ length: count }, (_, i) => {
        const filled = i < value.length;
        const cur = i === value.length;
        let slotStyle: ViewStyle | null = null;
        let dot: string = colors.ink;
        if (compareTo !== undefined && filled) {
          const ok = value[i] === compareTo[i];
          if (!ok) {
            slotStyle = { borderColor: colors.danger, borderWidth: 1.5 };
            dot = colors.danger;
          }
        } else if (cur) {
          slotStyle = { borderColor: colors.primary, borderWidth: 1.5 };
        }
        return (
          <View key={i} style={[pin.slot, slotStyle]}>
            {filled ? <PopDot color={dot} /> : cur && focused ? <Caret height={22} color={colors.primary} /> : null}
          </View>
        );
      })}
      <TextInput
        ref={ref}
        value={value}
        keyboardType="number-pad"
        caretHidden
        contextMenuHidden
        onFocus={(e) => {
          setFocused(true);
          onFocus?.(e);
        }}
        onBlur={(e) => {
          setFocused(false);
          onBlur?.(e);
        }}
        style={pin.hiddenInput}
        {...props}
      />
    </View>
  );
});

// ---------------------------------------------------------------------------------------------------------
// Rule ticks + banners
// ---------------------------------------------------------------------------------------------------------

/** Round tick used by the rule lists (SetupPin `.rl b`: 20px, green tint, 12px green check). */
export function CheckBadge({ ok, bad, size = 20 }: { ok?: boolean; bad?: boolean; size?: number }) {
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: ok ? "rgba(30,122,77,0.14)" : bad ? colors.dangerMuted : "rgba(23,19,15,0.06)",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      {ok ? <Icon name="checkmark" size={Math.round(size * 0.6)} color={colors.success} strokeWidth={3} /> : null}
      {bad ? <Icon name="close" size={Math.round(size * 0.55)} color={colors.danger} strokeWidth={3} /> : null}
    </View>
  );
}

/**
 * Rounded note (radius 12, padding 10/12):
 * ok = green 13/600 with a tick ("PIN set…", "PINs match"); error = red with an alert glyph;
 * info = 12px secondary on a faint orange wash (SetupPin hint); muted = secondary on the muted fill.
 */
export function Banner({ tone, children, icon = true }: { tone: "error" | "info" | "ok" | "muted"; children: React.ReactNode; icon?: boolean }) {
  const bg =
    tone === "error" ? colors.dangerMuted : tone === "ok" ? "rgba(30,122,77,0.10)" : tone === "info" ? "rgba(239,108,0,0.08)" : colors.surfaceMuted;
  const fg = tone === "error" ? colors.danger : tone === "ok" ? colors.success : colors.textSecondary;
  const glyph = icon && (tone === "ok" || tone === "error");
  return (
    <View style={[pin.banner, { backgroundColor: bg }]} accessibilityLiveRegion={tone === "error" ? "polite" : "none"}>
      {glyph ? <Icon name={tone === "ok" ? "checkmark" : "alert"} size={16} color={fg} strokeWidth={2.6} /> : null}
      <Text style={[tone === "info" ? pin.bannerInfo : pin.bannerText, { color: fg }]}>{children}</Text>
    </View>
  );
}

const pin = StyleSheet.create({
  box: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.inputBorder,
    position: "relative",
  },
  heroBox: { justifyContent: "center", gap: 12 },
  inlineBox: { justifyContent: "flex-start", gap: 8, paddingHorizontal: 16 },
  digits: { fontSize: 18, fontFamily: fontFamilies.semiBold, fontWeight: "600", letterSpacing: 4, color: colors.ink },
  digitsHero: { fontSize: 22, letterSpacing: 6 },
  hiddenInput: { ...StyleSheet.absoluteFillObject, opacity: 0, color: "transparent" },
  slots: { flexDirection: "row", gap: 6, position: "relative" },
  slot: {
    flex: 1,
    height: 52,
    borderRadius: 12,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    alignItems: "center",
    justifyContent: "center",
  },
  banner: { flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 12, paddingVertical: 10, borderRadius: 12 },
  bannerText: { flex: 1, fontSize: 13, lineHeight: 18, fontFamily: fontFamilies.semiBold, fontWeight: "600" },
  bannerInfo: { flex: 1, fontSize: 12, lineHeight: 18, fontFamily: fontFamilies.regular },
});
