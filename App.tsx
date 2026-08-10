import { useEffect } from "react";
import { AppState, type AppStateStatus } from "react-native";
import { AppProviders } from "@/providers/AppProviders";
import { RootNavigator } from "@/navigation/RootNavigator";
import { useAuthStore } from "@/store/authStore";
import { reconcileLocationTrackingOnStartup } from "@/services/locationTracking";

// Some Android OEM skins (MIUI/HyperOS in particular) fire spurious
// background→active blips a couple of seconds apart while the location
// foreground-service notification for attendance tracking is kept alive —
// see the identical guards in RootNavigator.tsx and reactQueryLiveSync.ts.
// reconcileLocationTrackingOnStartup() always re-checks location
// permissions (requestForegroundPermissionsAsync/requestBackgroundPermissionsAsync),
// even when tracking is already healthy — and permission-check calls are
// themselves a known trigger for the same kind of blip on some devices.
// Without debouncing, each blip re-triggers a permission check, which can
// cause another blip, which triggers another check — a continuous loop
// that shows up as the screen flickering non-stop. Debouncing collapses a
// burst of blips into a single reconcile once AppState actually settles.
const RECONCILE_DEBOUNCE_MS = 8000;

export default function App() {
  const bootstrap = useAuthStore((s) => s.bootstrap);

  useEffect(() => {
    bootstrap();
    reconcileLocationTrackingOnStartup();

    // The OS can silently kill the background location task (battery
    // optimization, Doze, aggressive OEM task managers) without ever telling
    // the app — a cold-launch check alone can miss this for hours if the app
    // is just reopened from the background rather than fully relaunched. Re-
    // verify (and resume if needed) every time the app comes back to the
    // foreground instead. This is idempotent — a no-op if tracking is
    // already healthy.
    let debounceTimeout: ReturnType<typeof setTimeout> | null = null;
    const subscription = AppState.addEventListener("change", (status: AppStateStatus) => {
      if (status !== "active") return;
      if (debounceTimeout) clearTimeout(debounceTimeout);
      debounceTimeout = setTimeout(() => {
        reconcileLocationTrackingOnStartup();
      }, RECONCILE_DEBOUNCE_MS);
    });
    return () => {
      if (debounceTimeout) clearTimeout(debounceTimeout);
      subscription.remove();
    };
  }, [bootstrap]);

  return (
    <AppProviders>
      <RootNavigator />
    </AppProviders>
  );
}
