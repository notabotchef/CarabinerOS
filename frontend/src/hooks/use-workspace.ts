"use client";

import { useState, useEffect } from "react";

interface UseWorkspaceReturn<T> {
  data: T[];
  loading: boolean;
  error: string | null;
  refresh: () => void;
}

export function useWorkspace<T = Record<string, unknown>>(
  endpoint: string,
  locationId?: string,
): UseWorkspaceReturn<T> {
  const [data, setData] = useState<T[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    const url = locationId
      ? `${endpoint}?location_id=${locationId}`
      : endpoint;

    setLoading(true);
    fetch(url, { credentials: "include" })
      .then(async (res) => {
        if (!res.ok) throw new Error(`${res.status}`);
        const json = await res.json();
        setData(Array.isArray(json) ? json : json.items ?? json.data ?? []);
        setError(null);
      })
      .catch((err) => {
        setError(err.message);
        setData([]);
      })
      .finally(() => setLoading(false));
  }, [endpoint, locationId, refreshKey]);

  return { data, loading, error, refresh: () => setRefreshKey((k) => k + 1) };
}
