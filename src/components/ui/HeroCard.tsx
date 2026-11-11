import { PropsWithChildren, ReactNode } from "react";
import { Pressable, StyleSheet, Text, View, ViewStyle } from "react-native";
import { Icon } from "./Icon";
import { GlowPanel } from "./GlowPanel";
import { colors, fontFamilies, radius, spacing, typography } from "@/theme";

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
 * The dark presence hero (GlowPanel, radius 28, padding 18, gap 16): optional caps label + right node, a big
 * Space Grotesk value, then free-form `children` — e.g. a `StatRow` of `StatBox`es, a solid `Button`, then
 * `<QuickActions />`. Optional "notch" tab underneath (legacy).
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
  const notchContent = notch === true ? <Icon name="chevronDown" size={16} color={colors.panelHeroText} /> : notch;
  return (
    <View style={style}>
      <View style={styles.shadowWrap}>
        <GlowPanel rounded style={[styles.card, contentStyle]}>
          {label || labelRight ? (
            <View style={styles.headerRow}>
              {label ? <Text style={styles.label}>{label.toUpperCase()}</Text> : <View />}
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
        </GlowPanel>
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
  shadowWrap: { borderRadius: radius.hero },
  card: { gap: 0 },
  headerRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  label: { ...typography.kicker, color: colors.panelHeroMuted },
  value: { ...typography.display, lineHeight: 48, color: colors.panelHeroText, marginTop: spacing.sm },
  suffix: {
    fontSize: 13,
    fontWeight: "500",
    fontFamily: fontFamilies.medium,
    letterSpacing: 0,
    color: colors.panelHeroMuted,
  },
  notch: {
    alignSelf: "center",
    width: 60,
    height: 22,
    backgroundColor: colors.panelHero,
    borderBottomLeftRadius: 22,
    borderBottomRightRadius: 22,
    alignItems: "center",
    justifyContent: "center",
  },
});
