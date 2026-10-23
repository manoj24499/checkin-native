import { useMemo } from "react";
import { ActivityIndicator, FlatList, StyleSheet, View } from "react-native";
import { useNavigation } from "@react-navigation/native";
import { SafeAreaView } from "react-native-safe-area-context";
import {
  LoadingView,
  ErrorView,
  EmptyState,
  IconButton,
  Kicker,
  ScreenBackground,
  ScreenTitle,
} from "@/components/ui";
import { DayHistoryRow } from "@/components/attendance";
import { useAttendanceHistory } from "@/hooks";
import { groupAttendanceByDay } from "@/utils/attendanceGrouping";
import { getErrorMessage } from "@/utils/errors";
import { colors, radius, spacing } from "@/theme";

export function AttendanceHistoryScreen() {
  const navigation = useNavigation();
  const query = useAttendanceHistory();

  const days = useMemo(() => {
    const records = query.data?.pages.flatMap((page) => page.records) ?? [];
    return groupAttendanceByDay(records);
  }, [query.data]);

  if (query.isLoading) return <LoadingView label="Loading history…" fullScreen />;
  if (query.isError) {
    return (
      <ScreenBackground>
        <ErrorView message={getErrorMessage(query.error)} onRetry={() => query.refetch()} />
      </ScreenBackground>
    );
  }

  return (
    <ScreenBackground>
      <SafeAreaView style={styles.safeArea} edges={["top", "bottom"]}>
        <View style={styles.header}>
          {navigation.canGoBack() ? (
            <IconButton icon="back" onPress={() => navigation.goBack()} accessibilityLabel="Back" />
          ) : null}
          <View>
            <Kicker>Attendance</Kicker>
            <ScreenTitle style={styles.title}>History</ScreenTitle>
          </View>
        </View>
        <FlatList
          data={days}
          keyExtractor={(item) => item.dateKey}
          // Rows read as one white card: the first/last rows round its corners.
          renderItem={({ item, index }) => (
            <View
              style={[
                styles.cardRow,
                index === 0 && styles.cardTop,
                index === days.length - 1 && styles.cardBottom,
              ]}
            >
              <DayHistoryRow day={item} divider={index > 0} />
            </View>
          )}
          contentContainerStyle={styles.list}
          onEndReachedThreshold={0.4}
          onEndReached={() => {
            if (query.hasNextPage && !query.isFetchingNextPage) query.fetchNextPage();
          }}
          refreshing={query.isRefetching}
          onRefresh={() => query.refetch()}
          ListEmptyComponent={
            <EmptyState
              icon="history"
              title="No attendance yet"
              message="Your check-ins and check-outs will show up here."
            />
          }
          ListFooterComponent={
            query.isFetchingNextPage ? <ActivityIndicator style={styles.footer} color={colors.ink} /> : null
          }
        />
      </SafeAreaView>
    </ScreenBackground>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: "transparent" },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm + 2,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md,
  },
  title: { fontSize: 22 },
  list: { padding: spacing.md, flexGrow: 1 },
  cardRow: { backgroundColor: colors.surface, paddingHorizontal: 14 },
  cardTop: { borderTopLeftRadius: radius.card, borderTopRightRadius: radius.card, paddingTop: spacing.xs },
  cardBottom: { borderBottomLeftRadius: radius.card, borderBottomRightRadius: radius.card, paddingBottom: spacing.xs },
  footer: { marginVertical: spacing.md },
});
