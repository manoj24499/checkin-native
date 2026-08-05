import { useMutation, useQueryClient } from "@tanstack/react-query";
import { attendanceService } from "@/api/services";
import { startLocationTracking, stopLocationTracking } from "@/services/locationTracking";
import { registerPushTokenBestEffort } from "@/services/notifications";
import { useAttendanceSessionStore } from "@/store/attendanceSessionStore";
import { useSettingsStore } from "@/store/settingsStore";
import type { ScanRequest, ScanResult } from "@/types";

export function useCheckInOut() {
  const queryClient = useQueryClient();
  const stopTracking = useAttendanceSessionStore((s) => s.stopTracking);
  const liveLocationEnabled = useSettingsStore((s) => s.liveLocationEnabled);

  return useMutation({
    mutationFn: (payload: ScanRequest) => attendanceService.scan(payload),
    onSuccess: async (result: ScanResult) => {
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
