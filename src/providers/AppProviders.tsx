import { PropsWithChildren, useState } from "react";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { SafeAreaProvider, initialWindowMetrics } from "react-native-safe-area-context";
import { NavigationContainer } from "@react-navigation/native";
import { StatusBar } from "expo-status-bar";
import { useReactQueryLiveSync } from "@/config/reactQueryLiveSync";
import { useOfflineQueueSync } from "@/hooks/useOfflineQueueSync";
import { navigationRef } from "@/navigation/navigationRef";

export function AppProviders({ children }: PropsWithChildren) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            retry: 1,
            staleTime: 30_000,
            refetchOnReconnect: true,
            refetchOnMount: true,
          },
        },
      }),
  );

  useReactQueryLiveSync(queryClient);
  useOfflineQueueSync(queryClient);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      {/* initialMetrics: screens pushed onto a stack lay out with the real insets from their first frame, instead of a
          zero-size first render that can leave them blank until reopened. */}
      <SafeAreaProvider initialMetrics={initialWindowMetrics}>
        <QueryClientProvider client={queryClient}>
          <NavigationContainer ref={navigationRef}>
            <StatusBar style="dark" />
            {children}
          </NavigationContainer>
        </QueryClientProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
