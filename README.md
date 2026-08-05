# Check-In Mobile App

Expo (React Native + TypeScript) client for the existing Employee Attendance
System. This app does **not** implement any attendance/geofencing/location
business logic itself — it is a thin, typed client over the existing Next.js
backend at `D:\projects\qube-space-login\checkin-app`. All validation
(geofence radius, one check-in/out per day, PIN verification) happens
server-side; the mobile app only mirrors it for instant UI feedback.

## Backend relationship

| Feature | Backend endpoint | Notes |
|---|---|---|
| Login | `POST /api/mobile/login` | New, additive route (see below) |
| Refresh session | `POST /api/mobile/refresh` | New, additive route |
| Profile | `GET /api/mobile/me` | New, additive route |
| Attendance history | `GET /api/mobile/me/attendance` | New, additive route |
| Check-in photo | `GET /api/mobile/me/attendance/:id/photo` | New, additive route |
| Today's status | `GET /api/kiosk/status` | Existing — public, no auth |
| Check in / out | `POST /api/kiosk/scan` | Existing — the PIN payload IS the auth |
| Office location | `GET /api/kiosk/office-location` | Existing — public |
| Location ping | `POST /api/kiosk/location` | Existing — `attendanceId` from check-in is the capability token |

### Why 5 new backend routes exist

The backend's employee-facing auth (`employee-login` NextAuth provider) is
cookie/JWT-session based with no bearer-token support, and there was no
self-service endpoint for an employee to read their own profile or
attendance history (only an admin-gated one existed). Rather than
reverse-engineer NextAuth's CSRF/cookie flow from a mobile client — fragile
and unsupported — five small, additive routes were added under
`app/api/mobile/**` in the backend project. They:

- reuse the exact same `bcrypt`/Prisma logic already in `lib/auth.ts` (no
  duplicated business logic),
- sign a stateless JWT with the same `AUTH_SECRET` NextAuth already uses (no
  new env var, no schema change),
- add zero new Prisma models or migrations.

See `lib/mobileAuth.ts` in the backend project for the token implementation.

### Check-in/out is *not* a separate mobile API

`POST /api/kiosk/scan` is the same endpoint the physical kiosk uses — this
app is effectively "a personal kiosk in your pocket." Check-in requires a
presence photo and enforces geofencing (except for `FIELD`/Anywhere
employees). There is no bearer-token requirement on this endpoint — the PIN
in the request body **is** the credential, independent of the
`/api/mobile/login` session used for Profile/History.

QR check-in existed in an earlier version of this app but was removed — it
was strictly weaker than PIN mode (no photo, no geofence) and isn't used.

## Project structure

```
src/
  api/            axios instance + interceptors, endpoint constants, typed services
  components/     reusable UI (ui/), attendance-specific (attendance/), camera (camera/)
  config/         env.ts — reads EXPO_PUBLIC_API_URL
  hooks/          React Query hooks + geofence/biometric hooks
  navigation/     React Navigation stacks/tabs
  screens/        one folder per feature (auth, dashboard, checkin, history, profile)
  services/       non-React services: background location tracking, biometrics, notifications
  store/          Zustand stores (auth session, active attendance/tracking session)
  theme/          colors, spacing, typography
  types/          shared request/response types matching the backend contracts
  utils/          secure storage, geo math, error formatting
```

## Visual design

Warm off-white / brand-orange theme (`src/theme/colors.ts`) — token names kept
stable from the original blue theme, only values changed, plus a few new
dark-"presence panel" tokens (`panelDark`, `panelDarker`, `primarySoftText`,
`textOnDark*`). System rule: primary/danger buttons are **outlined**, not
filled (`Button`'s `primary`/`danger` variants) — the only solid fills are the
dark presence card and the live map.

Two new interaction patterns replace the originals on `CheckInOutScreen`:
- **`HoldToConfirmRing`** (`components/checkin/`) — press-and-hold (~1.1s) SVG
  progress ring instead of a tap button, deliberately un-mistappable. Uses
  `react-native-svg` + the built-in `Animated` API (no reanimated needed).
- **`PinKeypad`** (`components/checkin/`) — custom on-screen numeric keypad
  with dot-indicator progress, replacing the plain PIN text field.

`DashboardScreen` gained a dark **presence card** (`components/dashboard/PresenceCard.tsx`)
showing live tracking status, a real elapsed-since-check-in timer, and an
estimated next-ping countdown — plus a **`LiveMapScreen`** (`screens/map/`,
pushed as a full-screen modal from "View on map") with a stylized radar/beacon
visualization. Neither uses real map tiles or `react-native-maps` — the
design calls for an abstract radar view, not a literal map. The ping-activity
bars shown on both screens are **decorative**, not real historical data —
there's no endpoint for the mobile app to fetch its own past pings, so this
intentionally isn't presented as precise history.

`AttendanceHistoryScreen` now groups raw check-in/out records into one row
per calendar day (`utils/attendanceGrouping.ts`) with a visual time-span bar,
computed entirely client-side from existing data — no backend change.

`ProfileScreen`'s three toggles are genuinely functional (`store/settingsStore.ts`,
persisted): **Biometric unlock** gates an app-foreground Face ID/fingerprint
prompt (`RootNavigator`'s lock screen); **Shift reminders** requests
notification permission when turned on (no reminder-scheduling backend exists
yet — this only prepares for one); **Live location** is a real opt-out that
skips starting tracking on check-in when disabled.

## Setup

```bash
cp .env.example .env
```

Edit `.env` and point `EXPO_PUBLIC_API_URL` at the backend:
- Physical device on the same network: your machine's LAN IP (`http://192.168.x.x:3000`)
- Android emulator: `http://10.0.2.2:3000`
- iOS simulator: `http://localhost:3000`

```bash
npm install
npm run start
```

Camera, location, and biometric features require a native build (Expo Go
supports most of this on SDK 57, but background location and the
foreground-service notification require a development build for full
fidelity):

```bash
npx expo run:android
npx expo run:ios
```

## Auth flow

1. `LoginScreen` posts `{ employeeCode, pin }` to `/api/mobile/login`.
2. The response's `accessToken` (15 min) + `refreshToken` (30 days) are
   stored in `expo-secure-store` (`src/utils/secureStorage.ts`) and in the
   Zustand `authStore`.
3. On every `/api/mobile/me*` request, the axios request interceptor attaches
   `Authorization: Bearer <accessToken>`. A 401 from those routes triggers a
   single-flight refresh via `/api/mobile/refresh`; other routes' 401s
   (e.g. a wrong PIN on `/api/kiosk/scan`) are left alone since they're
   business-logic rejections, not session expiry.
4. `App.tsx` calls `authStore.bootstrap()` once on launch, which reads stored
   tokens and re-fetches the profile to restore a persistent session.

`expo-secure-store` was used over MMKV for token storage — it's Expo Go
compatible (no dev client required) and is the standard choice for small,
sensitive values like tokens; MMKV would require a custom dev client purely
for slightly faster key-value reads that don't matter at this data size.

## Geofencing

`useGeofence` (`src/hooks/useGeofence.ts`) reads the device's current
position via `expo-location` and computes distance to the applicable target
(the office singleton from `/api/kiosk/office-location`, or the employee's
WFH home coordinates from `/api/mobile/me`) using the same Haversine formula
as the backend (`src/utils/geo.ts`). This only gates the UI — the backend
re-validates independently on every `/api/kiosk/scan` call.

A third `workMode`, `FIELD` ("Anywhere" in the admin portal), skips
geofencing entirely for field workers — `CheckInOutScreen` never computes a
target for them, and `useGeofence` skips requesting location permission at
all in that case, since nothing would be done with it.

### Mock-location detection

`useGeofence` checks `position.mocked` (Android only — set when the OS flags
a reading as coming from a mock/fake-GPS provider, e.g. Developer Options →
"Allow mock locations"). If true, check-in is blocked client-side with a
clear error, and the `mocked` flag is also sent to `/api/kiosk/scan`, which
rejects the check-in server-side too — so a modified client that skips the
client-side check still can't bypass this. The same flag is checked on each
background location ping; a mocked reading is silently dropped rather than
reported as real. This doesn't defend against root/jailbreak-level GPS
spoofing (e.g. Frida-based tools) — it stops the common case of a stock
Android "fake GPS" app, not a fully instrumented device.

## Live location tracking

While checked in, `src/services/locationTracking.ts` runs an
`expo-task-manager` background task that pings `POST /api/kiosk/location`
every 2 minutes with the `attendanceId` returned from check-in (which doubles
as the backend's capability token — no re-auth needed per ping). The task is
registered in `index.ts` before the app root mounts, so it also fires if
iOS/Android relaunches the app headlessly to deliver a location update.
Tracking stops automatically when the server responds `{ tracking: false }`
(e.g. after a check-out from any device) or when the employee checks out
from this app.

The existing web kiosk pings every 60 seconds; the admin dashboard marks an
employee "Offline" once their last ping is older than 3 minutes
(`LIVE_THRESHOLD_MS` in `components/DashboardWorkspace.tsx`), so the mobile
interval must stay under that or the employee will flicker between
Live/Offline by design. 2 minutes leaves headroom for network latency while
still being meaningfully lighter than the web kiosk's 60s.

Android note: `startLocationUpdatesAsync`'s `foregroundService` option lets
tracking continue with just foreground location permission and a visible
notification — it does not strictly require the separate "Allow all the
time" background grant. Since Android 11, that background permission can
only be granted from system Settings anyway (the OS no longer shows an
in-app dialog for it), so `requestBackgroundPermissionsAsync()` silently
returning denied with no prompt is expected, not a bug.

## Future-ready features (stubbed, not wired to a backend)

- **Face verification**: `PhotoCaptureView` already captures a photo via
  `expo-camera`; wiring actual face verification would mean adding a
  comparison step before/after this capture once the backend exposes it.
- **Push notifications**: `src/services/notifications.ts` registers the
  device and returns an Expo push token, but there's no backend endpoint yet
  to store it against the employee record.
- **Offline sync**: `@react-native-community/netinfo` is installed but not
  yet wired to a queue — check-in/out and location pings currently require
  connectivity.
- **Biometric login**: `useBiometricAuth` wraps `expo-local-authentication`
  and is surfaced as an availability indicator on the Profile screen; gating
  the login screen behind it (unlock stored tokens with Face ID/fingerprint
  instead of re-entering a PIN) is the natural next step.
- **react-native-maps**: installed for a future "see office location on a
  map" or live-tracking map view; not used by any screen yet. Android will
  need a Google Maps API key (`android.config.googleMaps.apiKey` in
  `app.json`) if a map view is added later.

## What was intentionally not built

Admin features (employee CRUD, live-location dashboard, CSV export) were
left out — the original request scoped this app to **employee** features
(Dashboard, Check In/Out, History, Profile). Those admin routes also require
a full NextAuth cookie-session dance from a non-browser client, which was one
of the two options presented and not the one chosen for this build.
