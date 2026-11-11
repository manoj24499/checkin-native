import { useEffect, useState } from "react";
import { AccessibilityInfo } from "react-native";

// One shared OS query + listener for every animated component (Rise, AmbientGlow, pulses, the tab bar), so
// mounting dozens of them doesn't fire dozens of async lookups.
let current = false;
let initialised = false;
const subscribers = new Set<(v: boolean) => void>();

function ensureInitialised() {
  if (initialised) return;
  initialised = true;
  AccessibilityInfo.isReduceMotionEnabled()
    .then((v) => {
      current = v;
      subscribers.forEach((fn) => fn(v));
    })
    .catch(() => {});
  AccessibilityInfo.addEventListener("reduceMotionChanged", (v) => {
    current = v;
    subscribers.forEach((fn) => fn(v));
  });
}

/** True when the user asked the OS to reduce motion: skip loops and entrance animations. */
export function useReducedMotion() {
  ensureInitialised();
  const [reduced, setReduced] = useState(current);
  useEffect(() => {
    subscribers.add(setReduced);
    setReduced(current);
    return () => {
      subscribers.delete(setReduced);
    };
  }, []);
  return reduced;
}
