import { Component, type ErrorInfo, type PropsWithChildren } from "react";
import { ScrollView, StatusBar, StyleSheet, Text, View } from "react-native";
import { Button } from "@/components/ui";
import { colors, radius, spacing, typography } from "@/theme";

interface State {
  error: Error | null;
}

/**
 * The last line of defense against an uncaught render-time error anywhere in
 * the component tree below it. Without this, React Native's default
 * behavior for an uncaught error thrown during render is to unmount the
 * whole app to a native red-screen (dev) or a blank/frozen screen (a
 * production release build has no red-screen at all) — either way, a bug in
 * one screen takes the entire app down with no way back in except force-
 * quitting and relaunching.
 *
 * Deliberately wraps the whole app once, in App.tsx — outside AppProviders,
 * not just around RootNavigator — rather than each screen individually:
 * React error boundaries only catch errors thrown during render/lifecycle
 * in their children, not in event handlers or async code (those are already
 * surfaced per-screen via each hook's own `isError`/`error` state, e.g.
 * ErrorView), so one boundary at the very root is enough to catch what
 * would otherwise be an unrecoverable crash, without needing to thread a
 * boundary through every screen. Being the outermost component also means
 * its own fallback UI can't lean on any provider further in (SafeAreaProvider,
 * NavigationContainer, ...) actually having mounted — it has to render with
 * plain React Native primitives only, since the very provider that broke
 * might be what's being caught.
 */
export class ErrorBoundary extends Component<PropsWithChildren, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // No crash-reporting SDK wired up yet — this at least lands in device
    // logs (adb logcat / Xcode console) instead of vanishing along with the
    // crashed tree.
    console.error("[ErrorBoundary] Uncaught render error:", error, info.componentStack);
  }

  private reset = () => this.setState({ error: null });

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;

    return (
      <View style={styles.safeArea}>
        <View style={styles.container}>
          <Text style={styles.title}>Something went wrong</Text>
          <Text style={styles.message}>
            The app hit an unexpected error. Try again — if it keeps happening, force-close and reopen the app.
          </Text>
          {__DEV__ ? (
            <ScrollView style={styles.debugBox} contentContainerStyle={styles.debugContent}>
              <Text style={styles.debugText}>
                {error.name}: {error.message}
                {"\n\n"}
                {error.stack}
              </Text>
            </ScrollView>
          ) : null}
          <Button label="Try again" onPress={this.reset} style={styles.retry} />
        </View>
      </View>
    );
  }
}

const styles = StyleSheet.create({
  // Plain View, not SafeAreaView — this can render before/without
  // SafeAreaProvider ever mounting (see the class doc comment above), so it
  // falls back to the platform's own status bar height instead.
  safeArea: {
    flex: 1,
    backgroundColor: colors.background,
    paddingTop: StatusBar.currentHeight ?? 0,
  },
  container: { flex: 1, alignItems: "center", justifyContent: "center", padding: spacing.lg },
  title: { ...typography.h2, color: colors.textPrimary, marginBottom: spacing.xs, textAlign: "center" },
  message: { ...typography.body, color: colors.textSecondary, textAlign: "center" },
  debugBox: {
    marginTop: spacing.md,
    maxHeight: 220,
    width: "100%",
    borderRadius: radius.md,
    backgroundColor: colors.surfaceMuted,
  },
  debugContent: { padding: spacing.sm },
  debugText: { ...typography.caption, color: colors.textSecondary },
  retry: { marginTop: spacing.lg, minWidth: 160 },
});
