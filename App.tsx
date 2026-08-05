import { useEffect } from "react";
import { AppState, type AppStateStatus } from "react-native";
import { AppProviders } from "@/providers/AppProviders";
import { RootNavigator } from "@/navigation/RootNavigator";
import { useAuthStore } from "@/store/authStore";
import { reconcileLocationTrackingOnStartup } from "@/services/locationTracking";

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
    const subscription = AppState.addEventListener("change", (status: AppStateStatus) => {
      if (status === "active") {
        reconcileLocationTrackingOnStartup();
      }
    });
    return () => subscription.remove();
  }, [bootstrap]);

  return (
    <AppProviders>
      <RootNavigator />
    </AppProviders>
  );
}
