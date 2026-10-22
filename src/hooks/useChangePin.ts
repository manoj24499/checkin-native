import { useMutation } from "@tanstack/react-query";
import { employeeService } from "@/api/services";
import { useAuthStore } from "@/store/authStore";
import { rememberVerifiedPin } from "@/services/pinVerifier";
import type { ChangePinRequest } from "@/types";

export function useChangePin() {
  const applyTokens = useAuthStore((s) => s.applyTokens);
  return useMutation({
    mutationFn: (payload: ChangePinRequest) => employeeService.changePin(payload),
    // The server invalidates this device's previous tokens the instant the
    // PIN changes and returns a fresh pair in the same response — store it
    // right away, or the next request (even the success screen navigating
    // away) 401s and looks like the change silently failed.
    onSuccess: (result, payload) => {
      void applyTokens(result.accessToken, result.refreshToken);
      // Otherwise an offline check-in would be checked against the old PIN.
      const employeeCode = useAuthStore.getState().user?.employeeCode;
      if (employeeCode) void rememberVerifiedPin(employeeCode, payload.newPin);
    },
  });
}
