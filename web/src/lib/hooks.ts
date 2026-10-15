import { useCallback, useEffect, useRef, useState } from "react";
import { useConnection } from "@solana/wallet-adapter-react";
import { PublicKey } from "@solana/web3.js";
import { deployment } from "../config";
import { fetchHolding, fetchOfferingState, fetchPurchasesOf, fetchRecentPurchases, type Holding, type OfferingState, type Purchase } from "./chain";

type AsyncState<T> = { data: T | null; error: string | null; loading: boolean; refresh: () => void; updatedAt: number | null };

/** Haalt data op, ververst elke `refreshMs` en bij `refresh()`. Oude data blijft zichtbaar tijdens het verversen. */
export function useAsync<T>(load: (() => Promise<T>) | null, deps: unknown[], refreshMs = 0): AsyncState<T> {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(Boolean(load));
  const [updatedAt, setUpdatedAt] = useState<number | null>(null);
  const [tick, setTick] = useState(0);
  const loadRef = useRef(load);
  loadRef.current = load;

  useEffect(() => {
    setData(null);
    setUpdatedAt(null);
  }, deps); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const fn = loadRef.current;
    if (!fn) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    fn()
      .then((value) => {
        if (cancelled) return;
        setData(value);
        setError(null);
        setUpdatedAt(Date.now());
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(err instanceof Error ? err.message : String(err));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [...deps, tick]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!refreshMs || !load) return;
    const id = window.setInterval(() => {
      if (document.visibilityState === "visible") setTick((t) => t + 1);
    }, refreshMs);
    return () => window.clearInterval(id);
  }, [refreshMs, Boolean(load)]); // eslint-disable-line react-hooks/exhaustive-deps

  const refresh = useCallback(() => setTick((t) => t + 1), []);
  return { data, error, loading, refresh, updatedAt };
}

export function useOfferingState(refreshMs = 20_000) {
  const { connection } = useConnection();
  const dep = deployment;
  return useAsync<OfferingState>(dep ? () => fetchOfferingState(connection, dep) : null, [connection], refreshMs);
}

export function useRecentPurchases(limit = 10, refreshMs = 30_000) {
  const { connection } = useConnection();
  const dep = deployment;
  return useAsync<Purchase[]>(dep ? () => fetchRecentPurchases(connection, dep, limit) : null, [connection, limit], refreshMs);
}

export function useHolding(owner: string | null, refreshMs = 30_000) {
  const { connection } = useConnection();
  const dep = deployment;
  return useAsync<Holding>(
    dep && owner ? () => fetchHolding(connection, dep, new PublicKey(owner)) : null,
    [connection, owner],
    refreshMs,
  );
}

export function usePurchasesOf(shareAccount: string | null) {
  const { connection } = useConnection();
  const dep = deployment;
  return useAsync<Purchase[]>(
    dep && shareAccount ? () => fetchPurchasesOf(connection, dep, shareAccount) : null,
    [connection, shareAccount],
  );
}

/** Werkt een "x s geleden"-label elke 5 seconden bij. */
export function useNow(intervalMs = 5000): number {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), intervalMs);
    return () => window.clearInterval(id);
  }, [intervalMs]);
  return now;
}
