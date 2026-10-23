import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, Image, Pressable, StyleSheet, Text, View } from "react-native";
import { Button, Card, IconTile, Kicker, ListRow } from "@/components/ui";
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
export function FieldVisitCard({ openSignal }: { openSignal?: number } = {}) {
  const summaryQuery = useFieldSummary(true);
  const queue = useQueuedFieldVisit();
  const [expanded, setExpanded] = useState(false);
  const [form, setForm] = useState<VisitFormValues>(EMPTY_VISIT_FORM);
  const [photo, setPhoto] = useState<string | null>(null);
  const [capturing, setCapturing] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [locating, setLocating] = useState(false);

  // Home's "Visit" quick-action tile bumps `openSignal` to open the form
  // (same as tapping "Log a visit"); the initial value is ignored.
  const lastSignal = useRef(openSignal);
  useEffect(() => {
    if (openSignal !== undefined && openSignal !== lastSignal.current) setExpanded(true);
    lastSignal.current = openSignal;
  }, [openSignal]);

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
    <Card style={styles.card}>
      <View style={styles.headerRow}>
        <Kicker style={styles.kicker}>{`Field day · ${visits.length} stop${visits.length === 1 ? "" : "s"} logged`}</Kicker>
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
            {photo ? (
              <Image source={{ uri: photo }} style={styles.photoThumb} />
            ) : (
              <IconTile icon="camera" tone="white" size={44} />
            )}
            <View style={styles.photoText}>
              <Text style={styles.photoTileLabel}>{photo ? "Photo attached" : "Add a photo"}</Text>
              <Text style={styles.photoTileHint}>
                {photo ? "Tap to retake" : "One shot of the place — required"}
              </Text>
            </View>
          </Pressable>
          {submitError ? <Text style={styles.errorText}>{submitError}</Text> : null}
          <View style={styles.formActions}>
            <Button label="Cancel" variant="ghost" size="sm" onPress={reset} />
            <Button
              label="Save visit"
              size="sm"
              onPress={handleSubmit}
              disabled={!canSubmit}
              loading={locating}
              style={styles.submitButton}
            />
          </View>
        </View>
      ) : (
        <Button
          label="Log a visit"
          icon="plus"
          variant="secondary"
          size="sm"
          onPress={() => setExpanded(true)}
          style={styles.logButton}
        />
      )}

      {visits.length > 0 || queue.pending.length > 0 ? (
        <View style={styles.visitList}>
          {queue.pending.map((p, i) => (
            <ListRow
              key={p.key}
              divider={i > 0}
              leading={
                p.status === "saving" ? (
                  <View style={styles.savingTile}>
                    <ActivityIndicator color={colors.ink} />
                  </View>
                ) : (
                  <IconTile glyph="!" tone="danger" />
                )
              }
              title={p.name}
              subtitle={p.status === "saving" ? "Saving…" : p.error ?? "Couldn't save"}
              trailing={
                p.status === "failed" ? (
                  <View style={styles.pendingActions}>
                    <Pressable onPress={() => queue.retry(p.key)} hitSlop={8}>
                      <Text style={styles.pendingRetry}>Retry</Text>
                    </Pressable>
                    <Pressable onPress={() => queue.remove(p.key)} hitSlop={8}>
                      <Text style={styles.pendingRemove}>Remove</Text>
                    </Pressable>
                  </View>
                ) : undefined
              }
            />
          ))}
          {visits.map((v, i) => (
            <ListRow
              key={v.id}
              divider={queue.pending.length + i > 0}
              icon="pin"
              title={v.name}
              subtitle={new Date(v.reachedAt).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })}
              valueSub="Photo"
            >
              {v.description ? <Text style={styles.visitDescription}>{v.description}</Text> : null}
              {v.contactName || v.contactPhone ? (
                <Text style={styles.visitDescription}>
                  {[v.contactName, v.contactPhone].filter(Boolean).join(" · ")}
                </Text>
              ) : null}
            </ListRow>
          ))}
        </View>
      ) : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { marginTop: spacing.sm + 4 },
  headerRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: spacing.sm },
  kicker: { marginBottom: 0, flexShrink: 1 },
  distance: { ...typography.caption, color: colors.textSecondary, fontSize: 12 },
  blurb: { ...typography.caption, fontSize: 12.5, color: colors.textSecondary, marginTop: spacing.sm },
  logButton: { marginTop: spacing.sm + 4 },
  form: { marginTop: spacing.sm + 4, gap: spacing.sm },
  photoTile: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm + 4,
    borderRadius: radius.tile,
    backgroundColor: colors.surfaceMuted,
    borderWidth: 1.5,
    borderStyle: "dashed",
    borderColor: "rgba(14,36,16,0.3)",
    padding: spacing.sm + 2,
  },
  photoTileFilled: { borderStyle: "solid", borderColor: colors.ink, backgroundColor: colors.primaryMuted },
  photoThumb: { width: 44, height: 44, borderRadius: 14 },
  photoText: { flex: 1 },
  photoTileLabel: { ...typography.bodyStrong, fontSize: 13.5, color: colors.ink },
  photoTileHint: { ...typography.caption, fontSize: 12, color: colors.textSecondary, marginTop: 2 },
  errorText: { ...typography.caption, color: colors.danger },
  formActions: { flexDirection: "row", gap: spacing.sm, justifyContent: "flex-end", alignItems: "center" },
  submitButton: { minWidth: 120 },
  visitList: { marginTop: spacing.sm + 2 },
  savingTile: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: colors.surfaceMuted,
    alignItems: "center",
    justifyContent: "center",
  },
  visitDescription: { ...typography.caption, color: colors.textSecondary, fontSize: 12, marginTop: 1 },
  pendingActions: { gap: spacing.xs, alignItems: "flex-end" },
  pendingRetry: { ...typography.bodyStrong, fontSize: 12.5, color: colors.primaryDark },
  pendingRemove: { ...typography.caption, fontSize: 12, color: colors.textMuted },
});
