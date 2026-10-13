import { Pressable, StyleSheet, Text, View } from "react-native";
import { useAssignedPlaces } from "@/hooks";
import { colors, radius, spacing, typography } from "@/theme";

/**
 * Dashboard card for the places an admin assigned to this field worker today: how many are left,
 * the next one, and a button to the list with navigation. Renders nothing when no places are assigned.
 */
export function AssignedPlacesCard({ onOpen }: { onOpen: () => void }) {
  const query = useAssignedPlaces(true);
  const places = query.data ?? [];
  if (places.length === 0) return null;

  const pending = places.filter((p) => p.status === "PENDING");
  const visited = places.filter((p) => p.status === "VISITED").length;
  const next = pending[0];

  return (
    <View style={styles.card}>
      <View style={styles.headerRow}>
        <Text style={styles.kicker}>ASSIGNED PLACES</Text>
        <Text style={styles.count}>
          {visited} of {places.length} done
        </Text>
      </View>
      {next ? (
        <>
          <Text style={styles.blurb}>
            {pending.length} {pending.length === 1 ? "place" : "places"} left today. Next: {next.name}
          </Text>
          <Pressable onPress={onOpen} style={styles.button}>
            <Text style={styles.buttonLabel}>View route and navigate</Text>
          </Pressable>
        </>
      ) : (
        <Text style={styles.blurb}>All of today&apos;s assigned places are done.</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    marginTop: spacing.sm + 3,
    borderRadius: radius.sm,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md - 2,
  },
  headerRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  kicker: { fontSize: 9, letterSpacing: 1.5, color: colors.textMuted, fontWeight: "600" },
  count: { ...typography.caption, color: colors.textSecondary, fontSize: 11.5 },
  blurb: { ...typography.caption, color: colors.textSecondary, marginTop: spacing.xs + 2 },
  button: {
    marginTop: spacing.sm + 3,
    minHeight: 44,
    borderRadius: radius.sm,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  buttonLabel: { ...typography.bodyStrong, color: colors.primaryText },
});
