import { useMutation } from "@tanstack/react-query";
import { employeeService } from "@/api/services";
import { useAuthStore } from "@/store/authStore";
import type { ChangePinRequest } from "@/types";

export function useChangePin() {
  const applyTokens = useAuthStore((s) => s.applyTokens);
  return useMutation({
    mutationFn: (payload: ChangePinRequest) => employeeService.changePin(payload),
    // The server invalidates this device's previous tokens the instant the
    // PIN changes and returns a fresh pair in the same response — store it
    // right away, or the next request (even the success screen navigating
    // away) 401s and looks like the change silently failed.
    onSuccess: (result) => {
      void applyTokens(result.accessToken, result.refreshToken);
    },
  });
}
