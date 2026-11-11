import { useEffect, useRef, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { Animated, Easing, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { useNavigation } from "@react-navigation/native";
import { LinearGradient } from "expo-linear-gradient";
import {
  Screen,
  Button,
  Card,
  Icon,
  IconButton,
  Kicker,
  PulseRing,
  Rise,
  ScreenTitle,
  useReducedMotion,
} from "@/components/ui";
import { useChangePin } from "@/hooks";
import { getErrorMessage } from "@/utils/errors";
import { colors, fontFamilies, gradientDirection, gradients, spacing, typography } from "@/theme";

interface ChangePinFormValues {
  currentPin: string;
  newPin: string;
  confirmPin: string;
}

const RUN = "0123456789012345678909876543210987654321";

/** Strength card (ChangePin.dc.html): ink panel with light text. */
const STRENGTH_BG = colors.ink;
const STRENGTH_MUTED = "#C9C1B9";
const STRENGTH_TRACK = "rgba(255,255,255,0.18)";
const STRENGTH_WEAK = "#FF8A80";
const STRENGTH_OK = "#FFD27A";
const SEG_EASING = Easing.bezier(0.3, 0.7, 0.2, 1);

/** 0-4 score driving the strength meter (display only; validation stays in the form rules). */
function pinStrength(pin: string): { score: number; label: string; color: string } {
  const lenOk = pin.length >= 6;
  const notRepeat = pin.length > 0 && !/^(\d)\1+$/.test(pin);
  const notRun = pin.length > 0 && !(pin.length >= 4 && RUN.includes(pin));
  const distinct = new Set(pin.split("")).size;
  let score = 0;
  if (pin.length) score = 1;
  if (lenOk && notRepeat && notRun) score = 2;
  if (score === 2 && distinct >= 4) score = 3;
  if (score === 3 && pin.length >= 8) score = 4;
  // Colours are tuned for the dark strength card.
  const meta: [string, string][] = [
    ["Enter a new PIN", STRENGTH_MUTED],
    ["Too easy to guess", STRENGTH_WEAK],
    ["Okay", STRENGTH_OK],
    ["Strong", colors.primarySoftText],
    ["Very strong", colors.primarySoftText],
  ];
  return { score, label: meta[score][0], color: meta[score][1] };
}

/** One strength segment: the gradient fill grows in from the left (mockup `seg`, .6s, staggered on mount). */
function StrengthSeg({ filled, weak, index }: { filled: boolean; weak: boolean; index: number }) {
  const reduced = useReducedMotion();
  const v = useRef(new Animated.Value(reduced && filled ? 1 : 0)).current;
  const mounted = useRef(false);
  useEffect(() => {
    const delay = mounted.current ? 0 : index * 200;
    mounted.current = true;
    if (reduced) {
      v.setValue(filled ? 1 : 0);
      return;
    }
    const a = Animated.timing(v, {
      toValue: filled ? 1 : 0,
      duration: 600,
      delay: filled ? delay : 0,
      easing: SEG_EASING,
      useNativeDriver: true,
    });
    a.start();
    return () => a.stop();
  }, [filled, reduced, index, v]);
  return (
    <View style={styles.seg}>
      <Animated.View style={[StyleSheet.absoluteFill, { transformOrigin: "left", transform: [{ scaleX: v }] }]}>
        {weak ? (
          <View style={[StyleSheet.absoluteFill, { backgroundColor: STRENGTH_WEAK }]} />
        ) : (
          <LinearGradient
            pointerEvents="none"
            colors={gradients.orange}
            start={gradientDirection.horizontal.start}
            end={gradientDirection.horizontal.end}
            style={StyleSheet.absoluteFill}
          />
        )}
      </Animated.View>
    </View>
  );
}

function PinField({
  label,
  value,
  onChangeText,
  onBlur,
  error,
  show,
  valid,
}: {
  label: string;
  value: string;
  onChangeText: (v: string) => void;
  onBlur: () => void;
  error?: string;
  show: boolean;
  valid?: boolean;
}) {
  const [focused, setFocused] = useState(false);
  return (
    <View>
      <View style={styles.labelRow}>
        <Text style={styles.label}>{label.toUpperCase()}</Text>
        {valid && !error ? <Text style={styles.matchLabel}>PINs match</Text> : null}
      </View>
      <TextInput
        placeholder="••••••"
        placeholderTextColor={colors.textMuted}
        selectionColor={colors.primary}
        cursorColor={colors.primary}
        secureTextEntry={!show}
        keyboardType="number-pad"
        value={value}
        onChangeText={onChangeText}
        onFocus={() => setFocused(true)}
        onBlur={() => {
          setFocused(false);
          onBlur();
        }}
        autoComplete="off"
        accessibilityLabel={label}
        style={[
          styles.input,
          error ? styles.inputError : valid ? styles.inputOk : focused ? styles.inputFocused : null,
        ]}
      />
      {error ? <Text style={styles.fieldError}>{error}</Text> : null}
    </View>
  );
}

export function ChangePinScreen() {
  const navigation = useNavigation();
  const { mutateAsync, isPending } = useChangePin();
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [show, setShow] = useState(false);
  const {
    control,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<ChangePinFormValues>({ defaultValues: { currentPin: "", newPin: "", confirmPin: "" } });

  const newPin = watch("newPin");
  const confirmPin = watch("confirmPin");
  const strength = pinStrength(newPin ?? "");

  const onSubmit = async (values: ChangePinFormValues) => {
    setSubmitError(null);
    try {
      await mutateAsync({ currentPin: values.currentPin.trim(), newPin: values.newPin.trim() });
      setSuccess(true);
    } catch (error) {
      setSubmitError(getErrorMessage(error, "Couldn't change your PIN. Please try again."));
    }
  };

  const header = (
    <Rise style={styles.headerRow}>
      <IconButton icon="back" onPress={() => navigation.goBack()} accessibilityLabel="Back" />
      <View accessibilityRole="header">
        <Kicker>Security</Kicker>
        <ScreenTitle style={styles.title}>Change PIN</ScreenTitle>
      </View>
    </Rise>
  );

  if (success) {
    return (
      <Screen glow="topRight" glowIntensity={0.6} contentStyle={styles.content}>
        {header}
        <Rise delay={80}>
          <Card style={styles.successCard}>
            <View style={styles.successIconBox}>
              <PulseRing size={72} color={colors.liveDot} scaleTo={1.45} opacityFrom={0.45} />
              <View style={styles.successIcon}>
                <Icon name="lock" size={32} color={colors.success} strokeWidth={2} />
              </View>
            </View>
            <Text style={styles.successTitle}>PIN updated</Text>
            <Text style={styles.successBody}>Use your new PIN the next time you sign in or check in.</Text>
          </Card>
        </Rise>
        <View style={{ flex: 1 }} />
        <Rise delay={160}>
          <Button label="Done" size="lg" onPress={() => navigation.goBack()} />
        </Rise>
      </Screen>
    );
  }

  return (
    <Screen scroll glow="topRight" glowIntensity={0.6} contentStyle={styles.content}>
      {header}

      <Rise delay={80}>
        <View style={styles.strengthCard}>
          <View style={styles.strengthHead}>
            <Text style={styles.strengthKicker}>STRENGTH</Text>
            <Text style={[styles.strengthLabel, { color: strength.color }]}>{strength.label}</Text>
          </View>
          <View style={styles.segs}>
            {[1, 2, 3, 4].map((i) => (
              <StrengthSeg key={i} index={i - 1} filled={i <= strength.score} weak={strength.score === 1} />
            ))}
          </View>
          {/* Matches the 6-10 digit rule enforced below. */}
          <Text style={styles.hint}>Choose a PIN only you know — 6 to 10 digits.</Text>
        </View>
      </Rise>

      <Rise delay={160}>
        <Controller
          control={control}
          name="currentPin"
          rules={{ required: "Current PIN is required" }}
          render={({ field: { onChange, onBlur, value } }) => (
            <PinField
              label="Current PIN"
              show={show}
              value={value}
              onChangeText={onChange}
              onBlur={onBlur}
              error={errors.currentPin?.message}
            />
          )}
        />
      </Rise>

      <Rise delay={220}>
        <Controller
          control={control}
          name="newPin"
          rules={{
            required: "New PIN is required",
            pattern: { value: /^\d{6,10}$/, message: "PIN must be 6-10 digits" },
          }}
          render={({ field: { onChange, onBlur, value } }) => (
            <PinField
              label="New PIN"
              show={show}
              value={value}
              onChangeText={onChange}
              onBlur={onBlur}
              error={errors.newPin?.message}
            />
          )}
        />
      </Rise>

      <Rise delay={280}>
        <Controller
          control={control}
          name="confirmPin"
          rules={{
            required: "Please confirm your new PIN",
            validate: (value) => value === newPin || "PINs don't match",
          }}
          render={({ field: { onChange, onBlur, value } }) => (
            <PinField
              label="Confirm new PIN"
              show={show}
              value={value}
              onChangeText={onChange}
              onBlur={onBlur}
              error={errors.confirmPin?.message}
              valid={confirmPin.length > 0 && confirmPin === newPin}
            />
          )}
        />
      </Rise>

      <Rise delay={320}>
        <Pressable
          onPress={() => setShow((s) => !s)}
          accessibilityRole="button"
          accessibilityState={{ selected: show }}
          hitSlop={10}
          style={({ pressed }) => [styles.showBtn, pressed && { opacity: 0.6 }]}
        >
          <Text style={styles.showLabel}>{show ? "Hide digits" : "Show digits"}</Text>
        </Pressable>
      </Rise>

      {submitError ? <Text style={styles.error}>{submitError}</Text> : null}

      <View style={{ flex: 1, minHeight: 4 }} />
      <Rise delay={380}>
        <Button
          variant="solid"
          size="lg"
          pulse
          label={isPending ? "Updating…" : "Update PIN"}
          onPress={handleSubmit(onSubmit)}
          loading={isPending}
        />
      </Rise>
      <Rise delay={440}>
        <Text style={styles.footnote}>After saving, use your new PIN to sign in and check in.</Text>
      </Rise>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { flexGrow: 1, paddingHorizontal: spacing.gutter, paddingTop: 12, gap: 14 },
  headerRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  title: { fontSize: 26, lineHeight: 32 },
  strengthCard: { borderRadius: 22, backgroundColor: STRENGTH_BG, padding: 16, gap: 10 },
  strengthHead: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  strengthKicker: { ...typography.kicker, color: STRENGTH_MUTED },
  strengthLabel: { fontSize: 14, fontWeight: "600", fontFamily: fontFamilies.semiBold },
  segs: { flexDirection: "row", gap: 6 },
  seg: { flex: 1, height: 6, borderRadius: 3, backgroundColor: STRENGTH_TRACK, overflow: "hidden" },
  hint: { fontSize: 12, lineHeight: 17, fontFamily: fontFamilies.regular, color: STRENGTH_MUTED },
  labelRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 6 },
  label: { ...typography.statLabel, fontSize: 11, color: colors.textSecondary },
  matchLabel: { fontSize: 12, fontWeight: "600", fontFamily: fontFamilies.semiBold, color: colors.success },
  input: {
    height: 54,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    borderRadius: 14,
    backgroundColor: colors.surface,
    paddingHorizontal: 16,
    fontSize: 18,
    fontFamily: fontFamilies.semiBold,
    color: colors.ink,
    letterSpacing: 6,
  },
  inputFocused: { borderWidth: 1.5, borderColor: colors.primary },
  inputError: { borderWidth: 1.5, borderColor: colors.danger },
  inputOk: { borderWidth: 1.5, borderColor: colors.success },
  fieldError: { fontSize: 12, fontFamily: fontFamilies.regular, color: colors.danger, marginTop: 6 },
  showBtn: { alignSelf: "flex-start" },
  showLabel: { ...typography.link, color: colors.accentText },
  error: {
    fontSize: 13,
    fontFamily: fontFamilies.regular,
    color: colors.danger,
    backgroundColor: colors.dangerMuted,
    borderRadius: 14,
    paddingHorizontal: 13,
    paddingVertical: 10,
    overflow: "hidden",
  },
  footnote: { fontSize: 12, fontFamily: fontFamilies.regular, color: colors.textSecondary, textAlign: "center" },
  successCard: { alignItems: "center", gap: 14, paddingVertical: 28, paddingHorizontal: 24 },
  successIconBox: { width: 72, height: 72 },
  successIcon: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: colors.successMuted,
    alignItems: "center",
    justifyContent: "center",
  },
  successTitle: { ...typography.h2, color: colors.ink, textAlign: "center" },
  successBody: {
    fontSize: 14,
    lineHeight: 21,
    fontFamily: fontFamilies.regular,
    color: colors.textSecondary,
    textAlign: "center",
  },
});
