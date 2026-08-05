import { AxiosError } from "axios";

/** Extracts a user-facing message from a failed API call, matching the
 * backend's consistent `{ error: string }` error body shape. */
export function getErrorMessage(error: unknown, fallback = "Something went wrong. Please try again."): string {
  if (error instanceof AxiosError) {
    const data = error.response?.data as { error?: string } | undefined;
    if (data?.error) return data.error;
    if (error.message === "Network Error") {
      return "Can't reach the server. Check your connection and try again.";
    }
  }
  if (error instanceof Error && error.message) return error.message;
  return fallback;
}
