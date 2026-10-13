import { QueryClient } from '@tanstack/react-query';
import { ApiError } from './client';

declare module '@tanstack/react-query' {
  interface Register { defaultError: ApiError }
}

export const MINUTE = 60_000;

/** GET retry policy: up to 2 retries, never for 4xx or legacy 200-{error} (those will not change). */
export function shouldRetry(failureCount: number, error: unknown): boolean {
  if (failureCount >= 2) return false;
  if (error instanceof ApiError && error.status !== 0 && error.status < 500) return false;
  if (error instanceof ApiError && error.code === 'state_not_initialized') return false;   // deterministic
  return true;
}

export function createQueryClient(opts: { retryDelay?: number } = {}): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: shouldRetry,
        retryDelay: opts.retryDelay ?? ((i) => Math.min(1000 * 2 ** i, 5000)),
        refetchOnWindowFocus: false,
      },
      mutations: { retry: 0 },
    },
  });
}
