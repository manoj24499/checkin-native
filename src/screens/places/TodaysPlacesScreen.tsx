import { useCallback, useMemo, useRef, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Button, Card, ErrorView, IconButton, Kicker, LoadingView, Screen } from "@/components/ui";
import { useAssignedPlaces, useRoutePlanner } from "@/hooks";
import { useAttendanceSessionStore } from "@/store/attendanceSessionStore";
import { getQuickPosition } from "@/utils/geo";
import { formatDuration, formatMeters } from "@/utils/navigation";
import { getErrorMessage } from "@/utils/errors";
import { colors, radius, spacing, typography } from "@/theme";
import type { DashboardStackParamList } from "@/navigation/types";
import type { AssignedPlace } from "@/types";

type Nav = NativeStackNavigationProp<DashboardStackParamList, "TodaysPlaces">;

/**
 * The places an admin assigned for today, in the order to visit them: nearest to where the worker
 * is now first, then the nearest to that one, and so on. "Start navigation" opens the turn-by-turn
 * screen.
 */
export function TodaysPlacesScreen() {
  const navigation = useNavigation<Nav>();
  const placesQuery = useAssignedPlaces(true);
  const { plan, planning, offline, replan } = useRoutePlanner();
  const activeAttendanceId = useAttendanceSessionStore((s) => s.activeAttendanceId);
  const [positionNote, setPositionNote] = useState<string | null>(null);
  const refetchRef = useRef(placesQuery.refetch);
  refetchRef.current = placesQuery.refetch;

  const load = useCallback(async () => {
    const places = (await refetchRef.current()).data ?? [];
    try {
      const position = await getQuickPosition();
      setPositionNote(null);
      await replan({ latitude: position.coords.latitude, longitude: position.coords.longitude }, places);
    } catch {
      // No position yet: the list stays in the order the admin's plan saved.
      setPositionNote("Couldn't get your location, so distances are not shown.");
    }
  }, [replan]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const places = useMemo(() => placesQuery.data ?? [], [placesQuery.data]);
  const pending = useMemo(() => {
    const order = plan?.ordered.map((p) => p.id) ?? [];
    const planned = new Map((plan?.ordered ?? []).map((p) => [p.id, p]));
    const stillPending = places.filter((p) => p.status === "PENDING");
    return [...stillPending]
      .sort((a, b) => {
        const ia = order.indexOf(a.id);
        const ib = order.indexOf(b.id);
        if (ia === -1 && ib === -1) return a.sortOrder - b.sortOrder;
        if (ia === -1) return 1;
        if (ib === -1) return -1;
        return ia - ib;
      })
      .map((p) => ({ place: p, planned: planned.get(p.id) }));
  }, [places, plan]);
  const visited = places.filter((p) => p.status === "VISITED");
  const skipped = places.filter((p) => p.status === "SKIPPED");

  if (placesQuery.isLoading) return <LoadingView label="Loading your places…" />;
  if (placesQuery.isError && places.length === 0) {
    return <ErrorView message={getErrorMessage(placesQuery.error)} onRetry={() => void load()} />;
  }

  return (
    <Screen scroll refreshing={placesQuery.isRefetching || planning} onRefresh={() => void load()}>
      <View style={styles.header}>
        <IconButton icon="back" onPress={() => navigation.goBack()} accessibilityLabel="Back" />
        <View style={styles.headerText}>
          <Text style={styles.title}>Today&apos;s places</Text>
          <Text style={styles.subtitle}>
            {pending.length} to visit · {visited.length} done{skipped.length > 0 ? ` · ${skipped.length} skipped` : ""}
          </Text>
        </View>
      </View>

      {!activeAttendanceId ? (
        <Text style={styles.warning}>You&apos;re not checked in. Check in with Field work before you log a visit.</Text>
      ) : null}
      {offline ? (
        <Text style={styles.note}>No connection, so the order is by straight-line distance and may differ from the road route.</Text>
      ) : plan && !plan.roads && pending.length > 1 ? (
        <Text style={styles.note}>Ordered by straight-line distance.</Text>
      ) : null}
      {positionNote ? <Text style={styles.note}>{positionNote}</Text> : null}

      {pending.length > 0 ? (
        <>
          <View style={styles.startWrap}>
            <Button label="Start navigation" icon="navigate" onPress={() => navigation.navigate("Navigate")} />
          </View>
          {pending.map(({ place, planned }, i) => (
            <PlaceCard
              key={place.id}
              place={place}
              order={i + 1}
              fromLabel={i === 0 ? "from you" : "from the previous stop"}
              distanceMeters={planned?.distanceMeters}
              durationSeconds={planned?.durationSeconds}
            />
          ))}
        </>
      ) : places.length > 0 ? (
        <Text style={styles.allDone}>Everything assigned for today is done.</Text>
      ) : (
        <Text style={styles.allDone}>No places are assigned for today.</Text>
      )}

      {visited.length > 0 ? <Kicker style={styles.section}>Done</Kicker> : null}
      {visited.map((p) => (
        <PlaceCard key={p.id} place={p} done />
      ))}
      {skipped.length > 0 ? <Kicker style={styles.section}>Skipped</Kicker> : null}
      {skipped.map((p) => (
        <PlaceCard key={p.id} place={p} skippedReason={p.skipReason ?? ""} />
      ))}
    </Screen>
  );
}

function PlaceCard({
  place,
  order,
  fromLabel,
  distanceMeters,
  durationSeconds,
  done,
  skippedReason,
}: {
  place: AssignedPlace;
  order?: number;
  fromLabel?: string;
  distanceMeters?: number;
  durationSeconds?: number;
  done?: boolean;
  skippedReason?: string;
}) {
  const contact = [place.contactName, place.contactPhone].filter(Boolean).join(" · ");
  return (
    <Card style={[styles.card, (done || skippedReason !== undefined) && styles.cardMuted]}>
      <View style={styles.cardRow}>
        <View style={[styles.badge, done && styles.badgeDone, skippedReason !== undefined && styles.badgeSkipped]}>
          <Text style={[styles.badgeLabel, (done || skippedReason !== undefined) && styles.badgeLabelMuted]}>
            {done ? "✓" : skippedReason !== undefined ? "–" : order}
          </Text>
        </View>
        <View style={styles.cardBody}>
          <Text style={styles.name}>{place.name}</Text>
          {place.address ? <Text style={styles.detail}>{place.address}</Text> : null}
          {distanceMeters !== undefined && durationSeconds !== undefined ? (
            <Text style={styles.meta}>
              {formatMeters(distanceMeters)} · {formatDuration(durationSeconds)} {fromLabel}
            </Text>
          ) : null}
          {place.description ? <Text style={styles.detail}>{place.description}</Text> : null}
          {contact ? <Text style={styles.detail}>{contact}</Text> : null}
          {place.notes ? <Text style={styles.notes}>Note: {place.notes}</Text> : null}
          {done && place.visitedAt ? (
            <Text style={styles.meta}>
              Visited at {new Date(place.visitedAt).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })}
            </Text>
          ) : null}
          {skippedReason !== undefined ? <Text style={styles.meta}>Skipped: {skippedReason}</Text> : null}
        </View>
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: "row", alignItems: "center", gap: spacing.sm + 2, marginBottom: spacing.xs },
  headerText: { flex: 1 },
  title: { ...typography.h2, color: colors.ink },
  subtitle: { ...typography.caption, fontSize: 12.5, color: colors.textSecondary, marginTop: 1 },
  warning: {
    ...typography.caption,
    color: colors.warningText,
    backgroundColor: colors.warningMuted,
    borderRadius: radius.input,
    paddingHorizontal: 13,
    paddingVertical: 11,
    marginTop: spacing.sm + 2,
    overflow: "hidden",
  },
  note: {
    ...typography.caption,
    color: colors.textSecondary,
    backgroundColor: colors.surfaceMuted,
    borderRadius: radius.input,
    paddingHorizontal: 13,
    paddingVertical: 11,
    marginTop: spacing.sm + 2,
    overflow: "hidden",
  },
  startWrap: { marginTop: spacing.md, marginBottom: spacing.xs },
  allDone: { ...typography.body, color: colors.textSecondary, marginTop: spacing.lg, textAlign: "center" },
  section: { marginTop: spacing.lg, marginBottom: 0 },
  card: { marginTop: spacing.sm + 2, padding: 14 },
  cardMuted: { opacity: 0.7 },
  cardRow: { flexDirection: "row", gap: spacing.sm + 4 },
  cardBody: { flex: 1 },
  badge: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: colors.ink,
    alignItems: "center",
    justifyContent: "center",
  },
  badgeDone: { backgroundColor: colors.successMuted },
  badgeSkipped: { backgroundColor: colors.surfaceMuted },
  // Lime on the ink order badge; done/skipped badges are pale, so they get dark text.
  badgeLabel: { ...typography.bodyStrong, color: colors.lime, fontSize: 13 },
  badgeLabelMuted: { color: colors.textSecondary },
  name: { ...typography.bodyStrong, fontSize: 14, color: colors.ink },
  detail: { ...typography.caption, fontSize: 12, color: colors.textSecondary, marginTop: 2 },
  meta: { ...typography.caption, color: colors.limeDeep, fontWeight: "600", fontFamily: "Inter_600SemiBold", marginTop: 3, fontSize: 12 },
  notes: { ...typography.caption, fontSize: 12, fontStyle: "italic", color: colors.textSecondary, marginTop: 3 },
});
