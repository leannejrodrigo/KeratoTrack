/**
 * Provides the Repository to the component tree and keeps a cached list of
 * measurements in React state.
 *
 * Why a context and not a global import? Components ask for "a repository",
 * not "IndexedDB". Tests pass a MemoryMeasurementRepository; the app passes
 * IndexedDB. This is dependency injection, the same idea as ADR 0001's
 * Repository interface, applied to the component tree.
 *
 * Data flow is deliberately simple: every mutation goes to the repository
 * first, then we re-read the list. The repository stays the single source of
 * truth; React state is only a cache of it.
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import type { Measurement } from "../domain/measurement";
import type { MeasurementRepository } from "../storage/repository";

interface StoreValue {
  measurements: Measurement[];
  loading: boolean;
  error: string | null;
  repo: MeasurementRepository;
  /** Run a write, then refresh the cache. Errors are returned, not thrown. */
  mutate: (fn: (repo: MeasurementRepository) => Promise<void>) => Promise<string | null>;
}

const Ctx = createContext<StoreValue | null>(null);

export function RepositoryProvider({ repo, children }: { repo: MeasurementRepository; children: ReactNode }) {
  const [measurements, setMeasurements] = useState<Measurement[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      setMeasurements(await repo.list());
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, [repo]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const mutate = useCallback(
    async (fn: (repo: MeasurementRepository) => Promise<void>) => {
      try {
        await fn(repo);
        await refresh();
        return null;
      } catch (e) {
        await refresh();
        return e instanceof Error ? e.message : String(e);
      }
    },
    [repo, refresh],
  );

  const value = useMemo(() => ({ measurements, loading, error, repo, mutate }), [measurements, loading, error, repo, mutate]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useStore(): StoreValue {
  const v = useContext(Ctx);
  if (!v) throw new Error("useStore must be used inside RepositoryProvider");
  return v;
}
