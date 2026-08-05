import { useCallback, useEffect, useState } from "react";
import { isBiometricAuthAvailable, promptBiometricAuth } from "@/services/biometrics";

export function useBiometricAuth() {
  const [available, setAvailable] = useState(false);

  useEffect(() => {
    isBiometricAuthAvailable().then(setAvailable);
  }, []);

  const authenticate = useCallback((reason?: string) => promptBiometricAuth(reason), []);

  return { available, authenticate };
}
