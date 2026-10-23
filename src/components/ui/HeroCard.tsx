import { PropsWithChildren, ReactNode } from "react";
import { Pressable, StyleSheet, Text, View, ViewStyle } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Icon } from "./Icon";
import { colors, gradients, radius, shadows, spacing, typography } from "@/theme";

export interface HeroCardProps extends PropsWithChildren {
  /** Small label at the top-left ("Worked today"). */
  label?: string;
  /** Node at the top-right, opposite the label (an icon button, a Pill). */
  labelRight?: ReactNode;
  /** Big number ("3h 12m", "18.4", "₹2,840"). Rendered with typography.display. */
  value?: string;
  /** Smaller, faded text right after the value ("of 9h", "km · 3h 12m worked"). */
  valueSuffix?: string;
  /**
   * The small tab hanging under the card. `true` draws the default chevron;
   * pass a node to put something else in it. Omit for no notch.
   */
  notch?: boolean | ReactNode;
  /** Makes the notch tappable (e.g. expand/collapse more stats). */
  onNotchPress?: () => void;
  /** Outer wrapper style (margins). */
  style?: ViewStyle;
  /** Inner padding/layout overrides for the lime card itself. */
  contentStyle?: ViewStyle;
}

/**
 * The big lime gradient card at the top of Home (and Reimbursement): ink
 * text, radius 30, greenish glow, optional "notch" tab underneath.
 * Everything inside is free-form `children` rendered after the optional
 * label/value header — e.g. a row of `Pill`s, then `<QuickActions />`.
 */
export function HeroCard({
  label,
  labelRight,
  value,
  valueSuffix,
  notch,
  onNotchPress,
  style,
  contentStyle,
  children,
}: HeroCardProps) {
  const notchContent = notch === true ? <Icon name="chevronDown" size={16} color={colors.ink} /> : notch;
  return (
    <View style={style}>
      <View style={styles.shadowWrap}>
        <LinearGradient
          colors={gradients.hero}
          start={{ x: 0.1, y: 0 }}
          end={{ x: 0.9, y: 1 }}
          style={[styles.card, contentStyle]}
        >
          {/* Soft white highlight in the top-right (mockup's radial glow). */}
          <View pointerEvents="none" style={styles.glow} />
          {label || labelRight ? (
            <View style={styles.headerRow}>
              {label ? <Text style={styles.label}>{label}</Text> : <View />}
              {labelRight}
            </View>
          ) : null}
          {value ? (
            <Text style={styles.value} numberOfLines={1} adjustsFontSizeToFit>
              {value}
              {valueSuffix ? <Text style={styles.suffix}>{`  ${valueSuffix}`}</Text> : null}
            </Text>
          ) : null}
          {children}
        </LinearGradient>
      </View>
      {notch ? (
        <Pressable onPress={onNotchPress} disabled={!onNotchPress} hitSlop={8} style={styles.notch}>
          {notchContent}
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  shadowWrap: { borderRadius: radius.hero, backgroundColor: "#D3EC55", ...shadows.hero },
  card: {
    borderTopLeftRadius: radius.hero,
    borderTopRightRadius: radius.hero,
    borderBottomLeftRadius: 34,
    borderBottomRightRadius: 34,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md + 2,
    overflow: "hidden",
  },
  glow: {
    position: "absolute",
    right: -60,
    top: -60,
    width: 200,
    height: 200,
    borderRadius: 100,
    backgroundColor: "rgba(255,255,255,0.28)",
  },
  headerRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  label: { fontSize: 13, fontWeight: "600", fontFamily: "Inter_600SemiBold", color: colors.onLimeSecondary },
  value: { ...typography.display, color: colors.ink, marginTop: spacing.sm + 4 },
  suffix: {
    fontSize: 15,
    fontWeight: "500",
    fontFamily: "Inter_500Medium",
    letterSpacing: 0,
    color: colors.inkMuted,
  },
  notch: {
    alignSelf: "center",
    width: 60,
    height: 22,
    backgroundColor: gradients.hero[1],
    borderBottomLeftRadius: 22,
    borderBottomRightRadius: 22,
    alignItems: "center",
    justifyContent: "center",
  },
});
