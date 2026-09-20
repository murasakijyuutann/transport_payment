import type { HealthResponse } from './types';

export async function fetchHealth(): Promise<HealthResponse> {
  const res = await fetch('/api/health');
  if (!res.ok) throw new Error('health failed');
  return res.json() as Promise<HealthResponse>;
}
