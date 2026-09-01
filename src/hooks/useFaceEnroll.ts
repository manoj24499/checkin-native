import { useMutation } from "@tanstack/react-query";
import { employeeService } from "@/api/services";

/** Submits a selfie to POST /api/mobile/me/face-enroll. On a `"failed"` or
 * `"unavailable"` result the mutation still resolves (not throws) — those
 * are valid server responses the caller should branch on, not error states
 * (a genuine network/HTTP failure still rejects normally). */
export function useFaceEnroll() {
  return useMutation({
    mutationFn: (photo: string) => employeeService.enrollFace(photo),
  });
}
