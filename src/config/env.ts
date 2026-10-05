const apiUrl = process.env.EXPO_PUBLIC_API_URL;

if (!apiUrl) {
  throw new Error(
    "EXPO_PUBLIC_API_URL is not set. Copy .env.example to .env and point it at your backend.",
  );
}

export const env = {
  apiUrl: apiUrl.replace(/\/+$/, ""),
  // Optional: organization-specific builds (e.g. "qs" for Qubespace) pre-fill the
  // login screen's organization code. Still editable, and a remembered code from
  // a previous successful login takes precedence.
  defaultOrganizationCode: (process.env.EXPO_PUBLIC_DEFAULT_ORG_CODE ?? "").trim(),
} as const;
