import { useMemo } from "react";
import { ActivityIndicator, FlatList, StyleSheet, Text } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { LoadingView, ErrorView, EmptyState } from "@/components/ui";
import { DayHistoryRow } from "@/components/attendance";
import { useAttendanceHistory } from "@/hooks";
import { groupAttendanceByDay } from "@/utils/attendanceGrouping";
import { getErrorMessage } from "@/utils/errors";
import { colors, spacing, typography } from "@/theme";

export function AttendanceHistoryScreen() {
  const query = useAttendanceHistory();

  const days = useMemo(() => {
    const records = query.data?.pages.flatMap((page) => page.records) ?? [];
    return groupAttendanceByDay(records);
  }, [query.data]);

  if (query.isLoading) return <LoadingView label="Loading history…" />;
  if (query.isError) {
    return <ErrorView message={getErrorMessage(query.error)} onRetry={() => query.refetch()} />;
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={["top", "bottom"]}>
      <Text style={styles.kicker}>ATTENDANCE</Text>
      <Text style={styles.title}>History</Text>
      <FlatList
        data={days}
        keyExtractor={(item) => item.dateKey}
        renderItem={({ item }) => <DayHistoryRow day={item} />}
        contentContainerStyle={styles.list}
        onEndReachedThreshold={0.4}
        onEndReached={() => {
          if (query.hasNextPage && !query.isFetchingNextPage) query.fetchNextPage();
        }}
        refreshing={query.isRefetching}
        onRefresh={() => query.refetch()}
        ListEmptyComponent={
          <EmptyState title="No attendance yet" message="Your check-ins and check-outs will show up here." />
        }
        ListFooterComponent={
          query.isFetchingNextPage ? <ActivityIndicator style={styles.footer} color={colors.primary} /> : null
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.background },
  kicker: {
    ...typography.label,
    letterSpacing: 2,
    color: colors.textSecondary,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md,
  },
  title: {
    ...typography.h1,
    color: colors.textPrimary,
    paddingHorizontal: spacing.md,
    marginTop: spacing.xs,
  },
  list: { padding: spacing.md, flexGrow: 1 },
  footer: { marginVertical: spacing.md },
});
