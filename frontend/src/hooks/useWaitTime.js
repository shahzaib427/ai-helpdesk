import { useEffect, useState } from "react";

// Re-renders every 30s so "Waiting 3 min" stays accurate without a manual
// refresh, but without the overhead of a per-second ticking clock.
export function useWaitTime(iso) {
  const [, forceTick] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => forceTick((n) => n + 1), 30000);
    return () => clearInterval(interval);
  }, []);

  if (!iso) return null;
  const diffMs = Date.now() - new Date(iso).getTime();
  const minutes = Math.floor(diffMs / 60000);

  if (minutes < 1) return "Just now";
  if (minutes < 60) return `Waiting ${minutes} min`;
  const hours = Math.floor(minutes / 60);
  return `Waiting ${hours}h ${minutes % 60}m`;
}