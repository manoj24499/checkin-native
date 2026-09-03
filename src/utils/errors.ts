import { AxiosError } from "axios";

/**
 * True when a request never reached the server at all — offline, DNS
 * failure, or the 15s timeout in api/client.ts — as opposed to the server
 * responding with an error status. Axios leaves `error.response` undefined
 * in exactly (and only) this case; any real HTTP response, even a 401 or
 * 500, always carries one. Session/auth logic (authStore.ts, client.ts's
 * response interceptor) relies on this distinction to avoid treating "can't
 * reach the server right now" the same as "the server confirmed this
 * session is dead."
 */
export function isNetworkError(error: unknown): boolean {
  return error instanceof AxiosError && !error.response;
}

/** Extracts a user-facing message from a failed API call, matching the
 * backend's consistent `{ error: string }` error body shape. */
export function getErrorMessage(error: unknown, fallback = "Something went wrong. Please try again."): string {
  if (error instanceof AxiosError) {
    const data = error.response?.data as { error?: string } | undefined;
    if (data?.error) return data.error;
    if (isNetworkError(error)) {
      return "Can't reach the server. Check your connection and try again.";
    }
  }
  if (error instanceof Error && error.message) return error.message;
  return fallback;
}
