import { StyleSheet, Text, View } from "react-native";
import { colors, radius, spacing, typography } from "@/theme";

interface LateNoticeCardProps {
  leaveType: "PERMISSION" | "HALF_DAY";
  lateMinutes: number | null;
}

// PresenceCard's warningBox uses the same rgba(184,134,11,0.35) /
// rgba(179,69,63,0.35) border convention — kept in sync manually here since
// colors.ts only defines the 0.10 "muted" fill tokens, not a border variant.
const TONE = {
  PERMISSION: { tint: colors.warning, fill: colors.warningMuted, border: "rgba(184,134,11,0.35)" },
  HALF_DAY: { tint: colors.danger, fill: colors.dangerMuted, border: "rgba(179,69,63,0.35)" },
} as const;

export function LateNoticeCard({ leaveType, lateMinutes }: LateNoticeCardProps) {
  const tone = TONE[leaveType];

  return (
    <View style={[styles.card, { backgroundColor: tone.fill, borderColor: tone.border }]}>
      <View style={[styles.iconWrap, { borderColor: tone.border }]}>
        <Text style={[styles.icon, { color: tone.tint }]}>!</Text>
      </View>
      <View style={styles.textWrap}>
        <Text style={[styles.headline, { color: tone.tint }]}>
          {leaveType === "PERMISSION" ? "Permission" : "Half-day leave"}
        </Text>
        <Text style={styles.subline}>Checked in {lateMinutes} min late today</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm + 2,
    borderRadius: radius.md,
    borderWidth: 1,
    padding: spacing.sm + 4,
    marginTop: spacing.md,
  },
  iconWrap: {
    width: 30,
    height: 30,
    borderRadius: 99,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.surface,
  },
  icon: { fontSize: 14, fontWeight: "800" },
  textWrap: { flex: 1 },
  headline: { ...typography.bodyStrong, fontSize: 14.5 },
  subline: { ...typography.caption, color: colors.textSecondary, marginTop: 1 },
});
