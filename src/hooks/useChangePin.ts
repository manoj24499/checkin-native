import { useMutation } from "@tanstack/react-query";
import { employeeService } from "@/api/services";
import type { ChangePinRequest } from "@/types";

export function useChangePin() {
  return useMutation({
    mutationFn: (payload: ChangePinRequest) => employeeService.changePin(payload),
  });
}
