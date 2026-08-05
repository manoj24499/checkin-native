import { useEffect, useState } from "react";

const BAR_COUNT = 16;
const FLAT_PATTERN = Array.from({ length: BAR_COUNT }, () => 12);

function randomPattern() {
  return Array.from({ length: BAR_COUNT }, () => 30 + Math.random() * 70);
}

/**
 * Decorative "activity" visualization for the presence card / live map ping
 * panel. This is NOT real historical ping data — there's no endpoint for the
 * mobile app to fetch its own past pings — just an honest "something is
 * happening" indicator that animates while tracking is active and goes flat
 * when it isn't.
 */
export function useActivityPattern(active: boolean) {
  const [pattern, setPattern] = useState(() => (active ? randomPattern() : FLAT_PATTERN));

  useEffect(() => {
    if (!active) {
      setPattern(FLAT_PATTERN);
      return;
    }
    setPattern(randomPattern());
    const id = setInterval(() => setPattern(randomPattern()), 4000);
    return () => clearInterval(id);
  }, [active]);

  return pattern;
}
