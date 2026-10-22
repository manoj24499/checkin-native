import * as SecureStore from "expo-secure-store";
import { sha256Hex } from "@/utils/sha256";

/**
 * Local PIN check for offline check-ins. The server is the only real judge
 * of a PIN, but an offline attempt is only sent hours later — without a
 * local check, a mistyped PIN would only surface then, after the employee
 * believed they were checked in. So after every PIN the server accepted
 * (an online check-in/out, sign-in, PIN change) a salted SHA-256 of it is
 * kept in SecureStore, and an offline attempt is compared against that.
 * Wrong attempts are capped so the verifier can't be brute-forced offline.
 */

const MAX_LOCAL_ATTEMPTS = 5;

interface StoredVerifier {
  salt: string;
  hash: string;
}

export type LocalPinCheck =
  | { result: "ok" }
  // No verifier yet (never had an online check-in on this install): the
  // attempt may still be saved; the server checks the PIN when it's sent.
  | { result: "unverified" }
  | { result: "wrong"; attemptsLeft: number }
  | { result: "locked" };

// SecureStore keys only allow [A-Za-z0-9._-].
function safe(employeeCode: string): string {
  return employeeCode.replace(/[^A-Za-z0-9._-]/g, "_");
}

const verifierKey = (employeeCode: string) => `checkin.pinVerifier.${safe(employeeCode)}`;
const attemptsKey = (employeeCode: string) => `checkin.pinAttempts.${safe(employeeCode)}`;

function randomSalt(): string {
  let salt = "";
  for (let i = 0; i < 4; i++) salt += Math.random().toString(36).slice(2, 10);
  return `${Date.now().toString(36)}${salt}`;
}

function digest(employeeCode: string, salt: string, pin: string): string {
  return sha256Hex(`${employeeCode}${salt}${pin}`);
}

/** Call after the server has just accepted `pin` for this employee. Never throws. */
export async function rememberVerifiedPin(employeeCode: string, pin: string): Promise<void> {
  try {
    const salt = randomSalt();
    const value: StoredVerifier = { salt, hash: digest(employeeCode, salt, pin) };
    await SecureStore.setItemAsync(verifierKey(employeeCode), JSON.stringify(value));
    await SecureStore.deleteItemAsync(attemptsKey(employeeCode));
  } catch {
    // Best effort — without a verifier, offline attempts are simply marked
    // "PIN checked when sent".
  }
}

export async function checkPinLocally(employeeCode: string, pin: string): Promise<LocalPinCheck> {
  const attempts = Number((await SecureStore.getItemAsync(attemptsKey(employeeCode)).catch(() => null)) ?? 0) || 0;
  if (attempts >= MAX_LOCAL_ATTEMPTS) return { result: "locked" };

  const raw = await SecureStore.getItemAsync(verifierKey(employeeCode)).catch(() => null);
  if (!raw) return { result: "unverified" };
  let stored: StoredVerifier;
  try {
    stored = JSON.parse(raw) as StoredVerifier;
  } catch {
    return { result: "unverified" };
  }

  if (digest(employeeCode, stored.salt, pin) === stored.hash) {
    if (attempts > 0) await SecureStore.deleteItemAsync(attemptsKey(employeeCode)).catch(() => {});
    return { result: "ok" };
  }
  const next = attempts + 1;
  await SecureStore.setItemAsync(attemptsKey(employeeCode), String(next)).catch(() => {});
  return next >= MAX_LOCAL_ATTEMPTS ? { result: "locked" } : { result: "wrong", attemptsLeft: MAX_LOCAL_ATTEMPTS - next };
}

/** On sign-out: nothing of this employee's PIN may stay on a shared phone. */
export async function forgetVerifiedPin(employeeCode: string): Promise<void> {
  await Promise.all([
    SecureStore.deleteItemAsync(verifierKey(employeeCode)).catch(() => {}),
    SecureStore.deleteItemAsync(attemptsKey(employeeCode)).catch(() => {}),
  ]);
}
