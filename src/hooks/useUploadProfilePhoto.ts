import { useMutation } from "@tanstack/react-query";
import { employeeService } from "@/api/services";

/** No query invalidation here — the caller (ProfileScreen) also needs to
 * re-fetch the auth store's own `user.hasProfilePhoto` (not react-query
 * state) and cache-bust the actual `<Image>` URI, so it drives both of
 * those explicitly in its own onSuccess rather than this hook guessing. */
export function useUploadProfilePhoto() {
  return useMutation({
    mutationFn: (photo: string) => employeeService.uploadProfilePhoto(photo),
  });
}
