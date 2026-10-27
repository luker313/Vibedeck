import { getDisplayIdentifiers, logger, registerForDisplayStateChanges } from "../lib";
import { useEffect, useState } from "react";

export function useCurrentDisplayIdentifier(): string | null {
  const [currentDisplay, setCurrentDisplay] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    let generation = 0;
    const refresh = (): void => {
      const request = ++generation;
      getDisplayIdentifiers().then((displays) => {
        if (!cancelled && request === generation) setCurrentDisplay(displays?.current ?? null);
      }).catch((error) => logger.error(error));
    };
    refresh();
    const unsub = registerForDisplayStateChanges(refresh);
    return () => {
      cancelled = true;
      unsub();
    };
  }, []);

  return currentDisplay;
}
