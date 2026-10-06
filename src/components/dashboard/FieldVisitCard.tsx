import { useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import Svg, { Path } from "react-native-svg";
import { PhotoCaptureView } from "@/components/camera";
import { useFieldSummary, useQueuedFieldVisit } from "@/hooks";
import { getQuickPosition, formatDistance } from "@/utils/geo";
import {
  EMPTY_VISIT_FORM,
  VisitFormFields,
  validateVisitForm,
  visitFormToPayload,
  type VisitFormValues,
} from "./VisitFormFields";
import { getErrorMessage } from "@/utils/errors";
import { colors, radius, spacing, typography } from "@/theme";

/**
 * Field-worker quick-log card — moved here from the map screen per the
 * "Inzivo Redesign" mockup, so a field employee can log a stop (place name +
 * photo) the moment they reach it without opening the map at all. Only
 * rendered by DashboardScreen when the employee is on a Field day and
 * currently checked in.
 */
export function FieldVisitCard() {
  const summaryQuery = useFieldSummary(true);
  const queue = useQueuedFieldVisit();
  const [expanded, setExpanded] = useState(false);
  const [form, setForm] = useState<VisitFormValues>(EMPTY_VISIT_FORM);
  const [photo, setPhoto] = useState<string | null>(null);
  const [capturing, setCapturing] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [locating, setLocating] = useState(false);

  const summary = summaryQuery.data;
  const visits = summary?.active ? summary.visits : [];
  const distanceMeters = summary?.active ? summary.distanceMeters : 0;

  const canSubmit = form.name.trim().length > 0 && !!photo && !locating;

  const reset = () => {
    setExpanded(false);
    setForm(EMPTY_VISIT_FORM);
    setPhoto(null);
    setSubmitError(null);
  };

  // Saving is deliberately non-blocking: the position comes from the device's
  // cached fix (instant), the visit is queued, and the form closes right away —
  // the photo upload runs in the background and shows "Saving…" in the list.
  const handleSubmit = async () => {
    if (!canSubmit || !photo) return;
    const invalid = validateVisitForm(form);
    if (invalid) {
      setSubmitError(invalid);
      return;
    }
    setSubmitError(null);
    setLocating(true);
    try {
      const position = await getQuickPosition();
      queue.submit({
        ...visitFormToPayload(form),
        photo,
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
      });
      reset();
    } catch {
      setSubmitError("Couldn't get your location. Move to a clearer spot and try again.");
    } finally {
      setLocating(false);
    }
  };

  if (capturing) {
    return (
      <PhotoCaptureView
        // "back" — this is a photo of the place the employee just reached,
        // not of themselves. Matches LiveMapScreen.tsx's identical "Add a
        // location" flow, which has the same requirement.
        facing="back"
        onCapture={(base64) => {
          setPhoto(`data:image/jpeg;base64,${base64}`);
          setCapturing(false);
        }}
        onCancel={() => setCapturing(false)}
      />
    );
  }

  return (
    <View style={styles.card}>
      <View style={styles.headerRow}>
        <Text style={styles.kicker}>FIELD DAY · {visits.length} STOP{visits.length === 1 ? "" : "S"} LOGGED</Text>
        <Text style={styles.distance}>{formatDistance(distanceMeters)} travelled</Text>
      </View>
      <Text style={styles.blurb}>
        Log a stop the moment you reach it — photo and place name, right here. No map needed.
      </Text>

      {expanded ? (
        <View style={styles.form}>
          <VisitFormFields values={form} onChange={setForm} />
          <Pressable
            onPress={() => setCapturing(true)}
            style={[styles.photoTile, photo && styles.photoTileFilled]}
          >
            <Text style={styles.photoTileLabel}>{photo ? "Photo attached" : "Add a photo"}</Text>
            <Text style={styles.photoTileHint}>
              {photo ? "Tap to retake" : "One shot of the place — required"}
            </Text>
          </Pressable>
          {submitError ? <Text style={styles.errorText}>{submitError}</Text> : null}
          <View style={styles.formActions}>
            <Pressable onPress={reset} style={styles.cancelButton}>
              <Text style={styles.cancelButtonLabel}>Cancel</Text>
            </Pressable>
            <Pressable
              onPress={handleSubmit}
              disabled={!canSubmit}
              style={[styles.submitButton, !canSubmit && styles.submitButtonDisabled]}
            >
              {locating ? (
                <ActivityIndicator color={colors.primaryDark} />
              ) : (
                <Text style={styles.submitButtonLabel}>Save visit</Text>
              )}
            </Pressable>
          </View>
        </View>
      ) : (
        <Pressable onPress={() => setExpanded(true)} style={styles.logButton}>
          <Svg width={16} height={16} viewBox="0 0 24 24" fill="none">
            <Path d="M12 5v14M5 12h14" stroke={colors.primaryDark} strokeWidth={1.7} strokeLinecap="round" />
          </Svg>
          <Text style={styles.logButtonLabel}>Log a visit</Text>
        </Pressable>
      )}

      {visits.length > 0 || queue.pending.length > 0 ? (
        <View style={styles.visitList}>
          {queue.pending.map((p) => (
            <View key={p.key} style={styles.visitRow}>
              <View style={styles.visitPhoto}>
                {p.status === "saving" ? (
                  <ActivityIndicator color={colors.primary} />
                ) : (
                  <Text style={styles.visitPhotoLabel}>FAILED</Text>
                )}
              </View>
              <View style={styles.visitInfo}>
                <Text style={styles.visitName}>{p.name}</Text>
                <Text style={[styles.visitMeta, p.status === "failed" && styles.pendingFailed]}>
                  {p.status === "saving" ? "Saving…" : p.error ?? "Couldn't save"}
                </Text>
              </View>
              {p.status === "failed" ? (
                <View style={styles.pendingActions}>
                  <Pressable onPress={() => queue.retry(p.key)} hitSlop={8}>
                    <Text style={styles.pendingRetry}>Retry</Text>
                  </Pressable>
                  <Pressable onPress={() => queue.remove(p.key)} hitSlop={8}>
                    <Text style={styles.pendingRemove}>Remove</Text>
                  </Pressable>
                </View>
              ) : null}
            </View>
          ))}
          {visits.map((v) => (
            <View key={v.id} style={styles.visitRow}>
              <View style={styles.visitPhoto}>
                <Text style={styles.visitPhotoLabel}>PHOTO</Text>
              </View>
              <View style={styles.visitInfo}>
                <Text style={styles.visitName}>{v.name}</Text>
                {v.description ? <Text style={styles.visitDescription}>{v.description}</Text> : null}
                {v.contactName || v.contactPhone ? (
                  <Text style={styles.visitDescription}>
                    {[v.contactName, v.contactPhone].filter(Boolean).join(" · ")}
                  </Text>
                ) : null}
                <Text style={styles.visitMeta}>
                  {new Date(v.reachedAt).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })}
                </Text>
              </View>
            </View>
          ))}
        </View>
      ) : null}
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
  distance: { ...typography.caption, color: colors.textSecondary, fontSize: 11.5 },
  blurb: { ...typography.caption, color: colors.textSecondary, marginTop: spacing.xs + 2 },
  logButton: {
    marginTop: spacing.sm + 3,
    minHeight: 44,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.primary,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.xs + 2,
  },
  logButtonLabel: { ...typography.bodyStrong, color: colors.primaryDark },
  form: { marginTop: spacing.sm + 3, gap: spacing.sm },
  photoTile: {
    borderRadius: radius.sm,
    backgroundColor: colors.surfaceMuted,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.sm + 2,
  },
  photoTileFilled: { borderColor: colors.primary, backgroundColor: colors.primaryMuted },
  photoTileLabel: { ...typography.bodyStrong, fontSize: 13, color: colors.textPrimary },
  photoTileHint: { ...typography.caption, color: colors.textSecondary, marginTop: 2 },
  errorText: { ...typography.caption, color: colors.danger },
  formActions: { flexDirection: "row", gap: spacing.sm, justifyContent: "flex-end" },
  cancelButton: { minHeight: 40, paddingHorizontal: spacing.md, alignItems: "center", justifyContent: "center" },
  cancelButtonLabel: { ...typography.bodyStrong, color: colors.textSecondary },
  submitButton: {
    minHeight: 40,
    paddingHorizontal: spacing.md,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  submitButtonDisabled: { opacity: 0.45 },
  submitButtonLabel: { ...typography.bodyStrong, color: colors.primaryDark },
  visitList: { marginTop: spacing.md, gap: spacing.sm + 2 },
  visitRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm + 3 },
  visitPhoto: {
    width: 40,
    height: 40,
    borderRadius: radius.sm - 2,
    backgroundColor: colors.surfaceMuted,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
  },
  visitPhotoLabel: { fontSize: 8, letterSpacing: 1, color: colors.textMuted, fontWeight: "600" },
  visitInfo: { flex: 1 },
  visitName: { ...typography.bodyStrong, fontSize: 13, color: colors.textPrimary },
  visitDescription: { ...typography.caption, color: colors.textSecondary, fontSize: 12, marginTop: 1 },
  pendingFailed: { color: colors.danger },
  pendingActions: { gap: spacing.xs, alignItems: "flex-end" },
  pendingRetry: { ...typography.bodyStrong, fontSize: 12.5, color: colors.primaryDark },
  pendingRemove: { ...typography.caption, fontSize: 12, color: colors.textMuted },
  visitMeta: { ...typography.caption, color: colors.textSecondary, fontSize: 11.5 },
});
