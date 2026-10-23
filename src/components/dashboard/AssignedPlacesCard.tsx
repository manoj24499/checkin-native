import { StyleSheet, Text, View } from "react-native";
import { Button, Card, Kicker } from "@/components/ui";
import { useAssignedPlaces } from "@/hooks";
import { colors, spacing, typography } from "@/theme";

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
    <Card style={styles.card}>
      <View style={styles.headerRow}>
        <Kicker style={styles.kicker}>Assigned places</Kicker>
        <Text style={styles.count}>
          {visited} of {places.length} done
        </Text>
      </View>
      {next ? (
        <>
          <Text style={styles.blurb}>
            {pending.length} {pending.length === 1 ? "place" : "places"} left today. Next: {next.name}
          </Text>
          <Button label="View route and navigate" icon="navigate" size="sm" onPress={onOpen} style={styles.button} />
        </>
      ) : (
        <Text style={styles.blurb}>All of today&apos;s assigned places are done.</Text>
      )}
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { marginTop: spacing.sm + 4 },
  headerRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  kicker: { marginBottom: 0 },
  count: { ...typography.caption, color: colors.textSecondary, fontSize: 12 },
  blurb: { ...typography.caption, fontSize: 12.5, color: colors.textSecondary, marginTop: spacing.sm },
  button: { marginTop: spacing.sm + 4 },
});
