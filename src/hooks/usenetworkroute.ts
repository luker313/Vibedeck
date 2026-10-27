import { useEffect, useState } from "react";
import { ProfileTransport } from "../lib/streamingprofile";
import { call } from "@decky/api";

export interface NetworkRoute {
  transport: ProfileTransport;
  interface: string | null;
  reason: string;
}

export function useNetworkRoute(address: string): { route: NetworkRoute | null; refresh: () => void } {
  const [result, setResult] = useState<{ address: string; route: NetworkRoute } | null>(null);
  const [generation, setGeneration] = useState(0);
  useEffect(() => {
    let cancelled = false;
    let pending = false;
    const refresh = async (): Promise<void> => {
      if (pending) return;
      pending = true;
      try {
        const route = await call<[string], NetworkRoute>("get_network_route", address);
        if (!cancelled) setResult({ address, route });
      } catch {
        if (!cancelled) setResult({ address, route: { transport: "unknown", interface: null, reason: "Connection detection unavailable; use a forced profile if needed." } });
      } finally {
        pending = false;
      }
    };
    void refresh();
    const timer = setInterval(() => { void refresh(); }, 15000);
    return () => { cancelled = true; clearInterval(timer); };
  }, [address, generation]);
  return { route: result?.address === address ? result.route : null, refresh: () => setGeneration((value) => value + 1) };
}
