import { useCallback, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { attendanceService } from "@/api/services";
import { startLocationTracking, stopLocationTracking } from "@/services/locationTracking";
import { registerPushTokenBestEffort } from "@/services/notifications";
import { rememberVerifiedPin } from "@/services/pinVerifier";
import { enqueueOfflineAttempt, localSessionIdFor, type EnqueueInput } from "@/services/offlineQueue";
import { useAttendanceSessionStore } from "@/store/attendanceSessionStore";
import { useSettingsStore } from "@/store/settingsStore";
import type { ScanRequest, ScanResult } from "@/types";

export function useCheckInOut() {
  const queryClient = useQueryClient();
  const stopTracking = useAttendanceSessionStore((s) => s.stopTracking);
  const liveLocationEnabled = useSettingsStore((s) => s.liveLocationEnabled);

  return useMutation({
    mutationFn: (payload: ScanRequest) => attendanceService.scan(payload),
    onSuccess: async (result: ScanResult, payload: ScanRequest) => {
      // The server just accepted this PIN — keep the local verifier current
      // so an offline attempt can catch a mistyped PIN right away.
      void rememberVerifiedPin(payload.employeeCode, payload.pin);

      // Location tracking is best-effort: it can fail for reasons that have
      // nothing to do with whether the check-in/out itself succeeded (e.g.
      // Expo Go has no background-location entitlement, permission was
      // denied, etc.). A failure here must never mask a successful scan or
      // block the dashboard/history from refreshing.
      try {
        if (result.type === "CHECK_IN") {
          if (liveLocationEnabled) {
            await startLocationTracking(result.id, result.timestamp);
            // Best-effort: so the "you've left your work area" auto-pause
            // warning can actually reach this device, independent of the
            // separate (off-by-default) "Shift reminders" toggle.
            void registerPushTokenBestEffort();
          }
        } else {
          await stopLocationTracking();
          stopTracking();
        }
      } catch (error) {
        console.warn("Location tracking failed to start/stop:", error);
      }

      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["attendance-status"] }),
        queryClient.invalidateQueries({ queryKey: ["attendance-history"] }),
      ]);
    },
  });
}

/**
 * Saves a check-in/out on the phone to be sent later (see
 * services/offlineQueue.ts) — the offline counterpart of useCheckInOut, with
 * the same tracking side effects: a saved CHECK_IN starts tracking under a
 * temporary "local-<clientId>" session (samples are only buffered until the
 * check-in is recorded and gets its real id), a saved CHECK_OUT stops it.
 * The caller checks the PIN locally first (services/pinVerifier.ts).
 *
 * Deliberately not a useMutation: its variables (the PIN included) would sit
 * in React Query's mutation cache, and the PIN must only ever be stored in
 * SecureStore. (Also, React Query pauses "online" mutations while offline —
 * the very case this exists for.)
 */
export function useSaveOfflineAttempt() {
  const stopTracking = useAttendanceSessionStore((s) => s.stopTracking);
  const liveLocationEnabled = useSettingsStore((s) => s.liveLocationEnabled);
  const [isSaving, setIsSaving] = useState(false);

  const save = useCallback(
    async (input: EnqueueInput) => {
      setIsSaving(true);
      try {
        const item = await enqueueOfflineAttempt(input);
        try {
          if (item.action === "CHECK_IN") {
            if (liveLocationEnabled) await startLocationTracking(localSessionIdFor(item.clientId), item.capturedAt);
          } else {
            await stopLocationTracking();
            stopTracking();
          }
        } catch (error) {
          console.warn("Location tracking failed to start/stop:", error);
        }
        return item;
      } finally {
        setIsSaving(false);
      }
    },
    [liveLocationEnabled, stopTracking],
  );

  return { save, isSaving };
}
