import { useEffect, useRef, useState, type PropsWithChildren } from "react";
import { Animated, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import type { BottomTabNavigationProp } from "@react-navigation/bottom-tabs";
import {
  Card,
  EmptyState,
  GradientFill,
  Icon,
  IconButton,
  Kicker,
  PulseRing,
  Screen,
  useReducedMotion,
  type GlowSpec,
} from "@/components/ui";
import { useNotifications } from "@/hooks";
import type { NotificationItem, NotificationKind, NotificationTone } from "@/hooks/useNotifications";
import { useNotificationStore } from "@/store/notificationStore";
import type { AppTabParamList, DashboardStackParamList } from "@/navigation/types";
import { colors, fontFamilies, motion, radius, spacing, typography } from "@/theme";

type Nav = NativeStackNavigationProp<DashboardStackParamList, "Notifications">;
type Filter = "all" | "unread" | NotificationKind;

const FILTERS: { id: Filter; label: string }[] = [
  { id: "all", label: "All" },
  { id: "unread", label: "Unread" },
  { id: "approvals", label: "Approvals" },
  { id: "alerts", label: "Alerts" },
  { id: "reminders", label: "Reminders" },
];

// Notifications.dc.html icon tiles: tinted 40px squares, glyph in the tone colour.
const TONE: Record<NotificationTone, { bg: string; fg: string }> = {
  good: { bg: "rgba(74,222,128,0.16)", fg: colors.success },
  bad: { bg: "rgba(255,92,92,0.16)", fg: colors.danger },
  warn: { bg: "rgba(255,176,60,0.16)", fg: colors.warning },
  brand: { bg: colors.primaryMuted, fg: colors.accentText },
};

// One soft orange glow on the left, a third of the way down (the mockup's only glow).
const GLOWS: GlowSpec[] = [{ corner: "topLeft", size: 300, opacity: 0.35, duration: 10000, x: -90, y: 200 }];

/**
 * Dashboard-stack route `Notifications`. There is no feed endpoint, so the items are derived from the leave /
 * overtime requests and late arrivals the app already loads (see useNotifications); read + dismissed marks are
 * kept locally (notificationStore).
 */
export function NotificationsScreen() {
  const navigation = useNavigation<Nav>();
  const { items, unreadCount } = useNotifications();
  const markRead = useNotificationStore((s) => s.markRead);
  const dismiss = useNotificationStore((s) => s.dismiss);
  const dismissAll = useNotificationStore((s) => s.dismissAll);
  const [filter, setFilter] = useState<Filter>("all");
  const [openId, setOpenId] = useState<string | null>(null);

  const visible = items.filter((n) => (filter === "all" ? true : filter === "unread" ? n.unread : n.kind === filter));
  const groups = (["Today", "Earlier"] as const)
    .map((title) => ({ title, items: visible.filter((n) => n.group === title) }))
    .filter((g) => g.items.length > 0);

  const go = (n: NotificationItem) => {
    const tabs = navigation.getParent<BottomTabNavigationProp<AppTabParamList>>();
    switch (n.target) {
      case "requests-leave":
        tabs?.navigate("Requests", { tab: "leave" });
        break;
      case "requests-overtime":
        tabs?.navigate("Requests", { tab: "overtime" });
        break;
      case "history":
        tabs?.navigate("Profile", { screen: "History" });
        break;
      case "checkin":
        tabs?.navigate("CheckIn");
        break;
      case "home":
        navigation.navigate("DashboardHome");
        break;
    }
  };

  // Row entrance stagger runs across both groups (Today first, then Earlier).
  let rowIndex = 0;

  return (
    <Screen scroll glows={GLOWS} contentStyle={styles.content}>
      <View style={styles.header}>
        <IconButton icon="chevronLeft" onPress={() => navigation.goBack()} accessibilityLabel="Back" />
        <View style={styles.headerText}>
          <View style={styles.kickerRow}>
            <Kicker style={styles.kicker}>{unreadCount ? `${unreadCount} unread` : "All caught up"}</Kicker>
            <View style={styles.headerActions}>
              <Pressable
                onPress={() => markRead(items.map((n) => n.id))}
                disabled={unreadCount === 0}
                accessibilityRole="button"
                hitSlop={10}
                style={({ pressed }) => [unreadCount === 0 && styles.disabled, pressed && styles.pressed]}
              >
                <Text style={styles.markAllLabel}>Mark all read</Text>
              </Pressable>
              <Pressable
                onPress={() => {
                  setOpenId(null);
                  dismissAll(items.map((n) => n.id));
                }}
                disabled={items.length === 0}
                accessibilityRole="button"
                accessibilityLabel="Clear all notifications"
                hitSlop={10}
                style={({ pressed }) => [items.length === 0 && styles.disabled, pressed && styles.pressed]}
              >
                <Text style={styles.clearLabel}>Clear all</Text>
              </Pressable>
            </View>
          </View>
          <Text style={styles.title} numberOfLines={1} adjustsFontSizeToFit>
            Notifications
          </Text>
        </View>
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.chipScroll}
        contentContainerStyle={styles.chips}
      >
        {FILTERS.map((f) => {
          const on = filter === f.id;
          return (
            <Pressable
              key={f.id}
              onPress={() => setFilter(f.id)}
              accessibilityRole="tab"
              accessibilityState={{ selected: on }}
              style={({ pressed }) => [styles.chip, pressed && styles.pressed]}
            >
              {on ? <GradientFill style={StyleSheet.absoluteFill} /> : null}
              <Text style={[styles.chipLabel, on && styles.chipLabelOn]}>{f.label}</Text>
              {f.id === "unread" && unreadCount > 0 ? (
                <View style={styles.count}>
                  <Text style={styles.countLabel}>{unreadCount}</Text>
                </View>
              ) : null}
            </Pressable>
          );
        })}
      </ScrollView>

      {groups.map((g) => (
        <View key={g.title} style={styles.section}>
          <Kicker style={styles.sectionTitle}>{g.title}</Kicker>
          <Card size="sm" style={styles.card}>
            {g.items.map((n, i) => {
              const open = openId === n.id;
              const tone = TONE[n.tone];
              const strong = n.unread || open;
              return (
                <SlideIn key={n.id} delay={Math.min(rowIndex++, 8) * 80} style={i > 0 ? styles.rule : undefined}>
                  <Pressable
                    onPress={() => {
                      setOpenId(open ? null : n.id);
                      markRead([n.id]);
                    }}
                    accessibilityRole="button"
                    accessibilityState={{ expanded: open }}
                    style={({ pressed }) => [styles.row, pressed && !open && styles.rowPressed]}
                  >
                    <View style={[styles.tile, { backgroundColor: tone.bg }]}>
                      <Icon name={n.icon} size={20} color={tone.fg} strokeWidth={2} />
                    </View>
                    <View style={styles.rowBody}>
                      <View style={styles.rowTop}>
                        <Text style={[styles.rowTitle, !strong && styles.rowTitleRead]} numberOfLines={1}>
                          {n.title}
                        </Text>
                        <Text style={styles.rowTime}>{n.time}</Text>
                      </View>
                      <Text style={styles.rowSummary}>{n.summary}</Text>

                      {open ? (
                        <>
                          <View style={styles.table}>
                            {n.details.map((d) => (
                              <View key={d.k} style={styles.tableRow}>
                                <Text style={styles.tableKey}>{d.k}</Text>
                                <Text style={[styles.tableValue, d.tone && { color: TONE[d.tone].fg }]}>{d.v}</Text>
                              </View>
                            ))}
                          </View>
                          <View style={styles.actions}>
                            <Pressable
                              onPress={() => go(n)}
                              accessibilityRole="button"
                              style={({ pressed }) => [styles.cta, pressed && styles.ctaPressed]}
                            >
                              <GradientFill style={StyleSheet.absoluteFill} />
                              <Text style={styles.ctaLabel}>{n.cta}</Text>
                            </Pressable>
                            <Pressable
                              onPress={() => {
                                dismiss(n.id);
                                setOpenId(null);
                              }}
                              accessibilityRole="button"
                              hitSlop={6}
                              style={({ pressed }) => [styles.dismiss, pressed && styles.pressed]}
                            >
                              <Text style={styles.dismissLabel}>Dismiss</Text>
                            </Pressable>
                          </View>
                        </>
                      ) : null}
                    </View>
                    {n.unread ? (
                      <View style={styles.dot} accessibilityLabel="Unread">
                        <PulseRing size={9} scaleTo={2.4} duration={2000} />
                        <View style={styles.dotCore} />
                      </View>
                    ) : null}
                  </Pressable>
                </SlideIn>
              );
            })}
          </Card>
        </View>
      ))}

      {groups.length === 0 ? (
        <View style={styles.empty}>
          <EmptyState icon="bell" title="Nothing here" message="Nothing pending — you're all caught up." />
        </View>
      ) : null}
    </Screen>
  );
}

/** The mockup's row entrance: fade in while sliding 30px in from the right (0.7s, rise easing), once on mount. */
function SlideIn({ delay, style, children }: PropsWithChildren<{ delay: number; style?: object }>) {
  const reduced = useReducedMotion();
  const t = useRef(new Animated.Value(reduced ? 1 : 0)).current;
  useEffect(() => {
    if (reduced) {
      t.setValue(1);
      return;
    }
    const anim = Animated.timing(t, { toValue: 1, duration: 700, delay, easing: motion.riseEasing, useNativeDriver: true });
    anim.start();
    return () => anim.stop();
    // Entrance only.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reduced]);
  return (
    <Animated.View
      style={[
        style,
        { opacity: t, transform: [{ translateX: t.interpolate({ inputRange: [0, 1], outputRange: [30, 0] }) }] },
      ]}
    >
      {children}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: spacing.gutter, paddingTop: 12, gap: spacing.md },
  header: { flexDirection: "row", alignItems: "center", gap: 12 },
  headerText: { flex: 1, minWidth: 0 },
  kickerRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: spacing.sm },
  kicker: { marginBottom: 0, flexShrink: 1 },
  headerActions: { flexDirection: "row", alignItems: "center", gap: 14 },
  markAllLabel: { fontSize: 13, fontWeight: "600", fontFamily: fontFamilies.semiBold, color: colors.accentText },
  clearLabel: { fontSize: 13, fontWeight: "500", fontFamily: fontFamilies.medium, color: colors.textSecondary },
  title: { ...typography.h1, fontSize: 26, color: colors.ink },
  disabled: { opacity: 0.4 },
  pressed: { opacity: 0.7 },

  chipScroll: { flexGrow: 0, marginHorizontal: -spacing.gutter },
  chips: { gap: 8, paddingHorizontal: spacing.gutter },
  chip: {
    height: 36,
    paddingHorizontal: 14,
    borderRadius: 18,
    backgroundColor: colors.surface,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    overflow: "hidden",
  },
  chipLabel: { fontSize: 13, fontWeight: "500", fontFamily: fontFamilies.medium, color: colors.textSecondary },
  chipLabelOn: { color: colors.onOrange, fontWeight: "600", fontFamily: fontFamilies.semiBold },
  count: { minWidth: 18, borderRadius: 9, paddingHorizontal: 7, paddingVertical: 1, backgroundColor: colors.pulse, alignItems: "center" },
  countLabel: { fontSize: 11, fontWeight: "700", fontFamily: fontFamilies.bold, color: colors.onOrange },

  section: { gap: spacing.md },
  sectionTitle: { marginBottom: 0, marginTop: 4 },
  card: { padding: 0, overflow: "hidden" },
  rule: { borderTopWidth: 1, borderTopColor: colors.hairlineSoft },
  row: { flexDirection: "row", alignItems: "flex-start", gap: 14, padding: 16 },
  rowPressed: { backgroundColor: colors.surfaceMuted },
  tile: { width: 40, height: 40, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  rowBody: { flex: 1, minWidth: 0 },
  rowTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 },
  rowTitle: { flex: 1, fontSize: 14, fontWeight: "600", fontFamily: fontFamilies.semiBold, color: colors.ink },
  rowTitleRead: { fontWeight: "500", fontFamily: fontFamilies.medium, color: colors.textSecondary },
  rowTime: { fontSize: 11, fontFamily: fontFamilies.regular, color: colors.textSecondary, fontVariant: ["tabular-nums"] },
  rowSummary: { fontSize: 12, lineHeight: 17, fontFamily: fontFamilies.regular, color: colors.textSecondary, marginTop: 3 },
  dot: { width: 9, height: 9, marginTop: 6 },
  dotCore: { width: 9, height: 9, borderRadius: 5, backgroundColor: colors.pulse },

  table: {
    marginTop: 10,
    borderRadius: radius.input,
    backgroundColor: colors.surfaceMuted,
    paddingVertical: 10,
    paddingHorizontal: 12,
    gap: 6,
  },
  tableRow: { flexDirection: "row", justifyContent: "space-between", gap: 8 },
  tableKey: { fontSize: 12, fontFamily: fontFamilies.regular, color: colors.textSecondary },
  tableValue: { flex: 1, fontSize: 12, fontFamily: fontFamilies.regular, color: colors.ink, textAlign: "right" },
  actions: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 10 },
  cta: { height: 36, paddingHorizontal: 16, borderRadius: 18, justifyContent: "center", overflow: "hidden" },
  ctaPressed: { opacity: 0.88, transform: [{ scale: 0.98 }] },
  ctaLabel: { fontSize: 13, fontWeight: "600", fontFamily: fontFamilies.semiBold, color: colors.onOrange },
  dismiss: { padding: 8 },
  dismissLabel: { fontSize: 12, fontWeight: "500", fontFamily: fontFamilies.medium, color: colors.textSecondary },
  empty: { paddingVertical: spacing.xl },
});
