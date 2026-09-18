# TankSync

TankSync is a real-time smart water tank monitoring and management platform. It shows live tank levels, pump status, and sensor health from your own ESP32 hardware via Firebase, with analytics, data-driven alerts, AI-style insights, and Excel/CSV/PDF reporting — all built on real data, with no fabricated readings.

## Features

- **Live dashboard** — tank levels, pump status, battery/signal/temperature/humidity, updated in real time with no page refresh
- **Multiple tanks & properties** — filter and compare across locations
- **Analytics** — daily/weekly/monthly consumption, pump activity, trends, computed only from real historical readings
- **Data-driven alerts** — low/critical water, overflow risk, rapid drop, possible leak, pump running too long, sensor/device offline, low battery, weak signal, stale data — deduplicated so a persisting condition doesn't spam
- **AI Insights** — pattern-based analysis (anomaly detection, time-to-empty prediction, efficiency score) computed from real tank + history data; never fabricated
- **Reports** — Excel (multi-sheet, formatted), CSV, and PDF exports, with a Current View / All Data scope toggle
- **Device management** — a guided "Connect a Sensor / Device" workflow that generates the exact Firebase path and payload for your ESP32
- **Authentication** — Firebase Auth (Google, Microsoft, email/password)
- **Demo Mode** — a clearly-labeled simulated data mode for trying the UI before hardware is connected; never mixed into real production data

## Architecture

```
ESP32 + Sensors
      │  writes JSON to Firebase Realtime Database
      ▼
Firebase Realtime Database  (or, optionally, a REST backend — see below)
      │
      ▼
Sensor Adapter  (src/lib/sensorAdapter.ts)
   — maps arbitrary field names (water_level, level, waterLevelPercent, ...)
     onto TankSync's internal model
      │
      ▼
Validation / Normalization  (src/lib/utils.ts: sanitizeTank, sanitizeTankHistory)
   — coerces types, clamps invalid values, fills safe defaults for missing fields
      │
      ▼
Zustand store  (src/store/useStore.ts)  — single source of truth for the UI
      │
      ▼
Dashboard · Tanks · Analytics · Alerts · AI Insights · Reports (Excel/CSV/PDF)
```

Realtime updates are pushed to the UI via a single Firebase listener per data type (see `src/hooks/useFirebaseTanks.ts` for live tank state, `src/hooks/useRealtime.ts` for notifications and the one-off history/audit/pump-log fetches). There is intentionally only **one** listener on the `tanks` node — it used to be duplicated across two hooks, which has been consolidated.

## Technology Stack

- React 18 + TypeScript + Vite
- Zustand (state), TanStack Query/Table
- Firebase (Realtime Database + Authentication)
- Tailwind CSS, Framer Motion
- Recharts (charts), ExcelJS (multi-sheet workbook export)
- Zod (validation schemas)

## Folder Structure

```
src/
  components/     Reusable UI (TankVisualization, DeviceConnect, ConfigField, ...)
  constants/      firebasePaths.ts (Firebase path config), config.ts, routes.ts
  context/        AuthContext, FirebaseContext, ThemeContext
  hooks/          useFirebaseTanks, useRealtime, useDemoMode
  lib/            sensorAdapter.ts, apiAdapter.ts, alertsEngine.ts, insights.ts,
                  excelExport.ts, firebase.ts, utils.ts, validation.ts
  pages/          Dashboard, Tanks, Analytics, Reports, Devices, PumpControls,
                  AIInsights, Notifications, AuditLogs, Settings, Login
  store/          useStore.ts (Zustand)
  types/          Shared TypeScript types
database.rules.json   Recommended Firebase Realtime Database security rules
```

## Installation

```bash
npm install
cp .env.example .env
# fill in your Firebase config in .env (see below)
npm run dev
```

Available scripts (only these exist — nothing else is claimed):

```bash
npm run dev       # start the Vite dev server
npm run build     # tsc -b && vite build — type-checks then builds
npm run preview   # preview the production build locally
```

There is no `lint` or `test` script configured in this project.

## Environment Variables

Copy `.env.example` to `.env` and fill in your **web app** Firebase config (from Firebase Console → Project Settings → General → Your apps). These are public client identifiers, not secrets — Firebase security is enforced by database rules, not by hiding this config. `VITE_FIREBASE_DATABASE_URL` is the one field **not** included in that config snippet — copy it separately from the Realtime Database console page.

```
VITE_FIREBASE_API_KEY=
VITE_FIREBASE_AUTH_DOMAIN=
VITE_FIREBASE_DATABASE_URL=
VITE_FIREBASE_PROJECT_ID=
VITE_FIREBASE_STORAGE_BUCKET=
VITE_FIREBASE_MESSAGING_SENDER_ID=
VITE_FIREBASE_APP_ID=
VITE_FIREBASE_MEASUREMENT_ID=

# Optional — only if you're using a REST backend instead of/alongside Firebase
VITE_API_BASE_URL=
```

`.env` is git-ignored. Never commit real credentials or a Firebase **service account** key (that's a server-side secret, unrelated to the web config above, and this project never needs one).

`VITE_FIREBASE_MEASUREMENT_ID` is optional and only enables Analytics — a missing or invalid value never blocks Authentication or the Realtime Database from initializing (Analytics is loaded lazily and fails silently if unsupported).

### Config precedence — how TankSync decides which Firebase config to use

There is exactly one place this is decided: `resolveFirebaseConfig()` in `src/lib/firebase.ts`. Both Authentication and the Realtime Database read from it — they can't disagree.

1. **A fully-populated `.env` always wins**, unconditionally — even if a config was previously saved through the in-app Settings page.
2. **A saved Settings config is never applied automatically.** If `.env` is incomplete, TankSync does *not* silently fall back to whatever's in the browser's local storage from an earlier session. It reports the app as "not configured" and shows exactly which `VITE_FIREBASE_*` variable names (never values) are missing. If a saved config does exist, Settings shows a "Use previously saved configuration" button — using it is always an explicit choice.
3. **No invalid/empty config is ever silently activated.** Missing configuration is reported, not papered over with a demo/mock state.

This exists specifically to prevent a real failure mode: setting up `.env` correctly but still seeing `auth/api-key-not-valid` because an earlier, different config saved via Settings was silently taking over. If you ever hit that, Settings → **Reset** clears the saved copy and re-checks `.env`.

## Firebase Setup

1. Create a Firebase project at console.firebase.google.com
2. Enable **Realtime Database** (choose a region close to your devices)
3. Enable **Authentication** → turn on the sign-in providers you want (Google, Microsoft, Email/Password)
4. Add a **Web app** to the project, copy its config into `.env` — remember `databaseURL` isn't in that snippet (see above)
5. Deploy the recommended rules in `database.rules.json` (Realtime Database → Rules tab, paste and publish — or `firebase deploy --only database` if you use the CLI)
6. Restart the dev server (Vite only reads `.env` at startup, not on hot-reload)
7. Open TankSync — with no data yet you'll see "Waiting for Sensor Data", not fake numbers

### Realtime Database Structure

This is the actual structure TankSync reads and writes (see `src/constants/firebasePaths.ts` — the one place to change these path names if yours differ):

```
tanks/
  {tankId}/
    name, property, shape, capacity, currentWater, waterLevel,
    pumpStatus, pumpMode, battery, batteryVoltage, signal,
    temperature, humidity, flowRate, leak, overflow, dryRun,
    sensorHealth, remarks, status, lastUpdated

history/
  {entryId}/            (append-only log, one entry per update)
    tankId, name, property, ...same sensor fields..., source, updatedBy, timestamp

notifications/
  {notifId}/
    name, property, title, message, previousValue, newValue,
    source, updatedBy, isRead, type, timestamp

auditLogs/
  {entryId}/             (append-only compliance trail)
    name, property, userName, source, action, oldValue, newValue, timestamp

pumpLogs/
  {entryId}/              (append-only pump ON/OFF transitions)
    tankId, name, property, pumpStatus, previousStatus, source, updatedBy, timestamp
```

## How to Connect Your ESP32

1. In TankSync, go to **Devices → Connect Device**. Fill in a Device ID (this becomes the tank's key in Firebase), pick which sensors you have, and copy the Firebase path it shows you (`tanks/<your-device-id>`).
2. Your ESP32 firmware should periodically `PATCH`/`PUT` a JSON object to that path in your Realtime Database, containing whatever fields you have. You do **not** need every field — missing ones safely default rather than crashing anything.
3. Field names are flexible. TankSync's sensor adapter (`src/lib/sensorAdapter.ts`) recognizes common variants automatically, e.g.:

   | You can send any of... | TankSync reads it as |
   |---|---|
   | `waterLevel`, `water_level`, `level`, `waterLevelPercent` | `waterLevel` |
   | `batteryVoltage`, `battery_voltage`, `batteryV` | `batteryVoltage` |
   | `signal`, `signalStrength`, `rssi` | `signal` |
   | `pumpStatus`, `pump_status`, `pump` | `pumpStatus` |
   | `ph`, `pH`, `ph_level`, `phLevel` | `ph` (stays `null`, not `0`, when absent) |

   If your firmware uses something not yet listed, add it to `FIELD_ALIASES` in that one file — nothing else needs to change.
4. Example payload:
   ```json
   {
     "waterLevel": 68,
     "temperature": 27.5,
     "batteryVoltage": 3.9,
     "signal": 90,
     "pumpStatus": "OFF",
     "lastUpdated": 1737020400000
   }
   ```
5. Since the recommended database rules require `auth != null`, your ESP32 needs to authenticate. The simplest approach for a device: enable **Anonymous Authentication** in Firebase Auth, then have the ESP32 sign in anonymously via the Firebase Auth REST API to get an ID token, and send that token on each Realtime Database REST call (`?auth=<idToken>`). This avoids putting a long-lived secret on the device.
6. Once your ESP32 starts writing, the dashboard updates within moments — no code changes, no redeploy.

### Optional: REST API instead of Firebase

If you'd rather have ESP32 → your own backend → TankSync, `src/lib/apiAdapter.ts` documents the exact endpoints a backend would need (`GET /api/tanks`, `/api/tanks/:id`, `/api/devices`, `/api/readings`, `/api/alerts`) and includes a ready client that normalizes responses through the same sensor adapter. **This is not wired into the running app** — no such backend exists yet, and TankSync does not pretend otherwise. Set `VITE_API_BASE_URL` and wire it into `useStore` once you have a real backend to point it at.

## Optional: The Things Stack (LoRaWAN) → Firebase Bridge

If your ESP32 talks LoRaWAN through **The Things Stack (TTS)** rather than writing to Firebase directly, `server/` contains a small, real, tested bridge:

```
ESP32 --LoRaWAN--> The Things Stack --webhook--> server/ bridge --Admin SDK--> Firebase --> this frontend
```

- The bridge is a separate Node/TypeScript project (`server/`), not part of the Vite frontend bundle — it never ships to the browser, and it's the only place that ever holds a Firebase **service account** (Admin) credential.
- It decodes the real, documented TTS webhook envelope; the device-specific `decoded_payload` field names are isolated in one file (`server/src/ttsDecoder.ts`, `PAYLOAD_FIELD_ALIASES`) — that's the one place to edit once you know your device's real payload shape.
- It validates every value (range checks, NaN/Infinity rejection, timestamp normalization) and rejects bad readings instead of inventing replacements.
- Device → tank mapping is server-side config (`DEVICE_TANK_MAP`) — a webhook payload can never write to an arbitrary tank.
- It writes into TankSync's existing schema (`tanks/{id}` partial update + a `history/` entry), so nothing in the frontend needs to change to consume it.
- Authentication on the webhook endpoint is a **shared-secret header** you configure identically in both the bridge's `.env` and the TTS console's webhook integration settings. This is not cryptographic signature verification — TTS does not sign webhook payloads by default — and this bridge does not claim otherwise.

**Status: implemented and tested locally against a realistic sample payload (see `server/scripts/sample-tts-payload.json` and `npm run test:local`). It has not been verified against a live TTS account, real ESP32, or production Firebase project** — that requires your real TTS webhook pointed at a publicly reachable instance of this bridge, which is outside what a local development environment can do on its own (e.g. deploy `server/` to any small Node host, or tunnel it locally with a tool like ngrok for testing).

Full setup instructions: see `server/README.md`.

## Data Validation

Every value coming from Firebase (or, later, the API) passes through `sanitizeTank` / `sanitizeTankHistory` (`src/lib/utils.ts`): non-numeric values fall back to `0`, missing strings fall back to `''`, unrecognized enum values fall back to a safe default (e.g. unknown pump status → `'OFF'`). pH is the one exception — it stays `null` rather than defaulting to `0`, since `0` is itself a valid pH reading. Nothing here fabricates plausible-looking data — it only prevents a malformed reading from crashing the app.

## Reports: Excel / CSV / PDF

From the **Reports** page:
- **Excel** — a real multi-sheet `.xlsx` workbook (ExcelJS): Summary, Tank Summary, Readings/History, Water Consumption (derived per-tank from real readings), Pump Activity, Device/Sensor Health, Alerts/Notifications, Audit Logs (API keys masked), AI Insights. Sheets with no data show a clear placeholder rather than being silently invented.
- **CSV** — raw readings, UTF-8 BOM for correct character display in Excel.
- **PDF** — a printable report: summary stats, a per-tank water-level bar chart, active alerts, and the readings table.
- **Export scope** — toggle between "Current View" (respects your search/sort) and "All Data".

## Analytics

Daily/weekly/monthly views computed from real `history` and `pumpLogs` data only. If there isn't enough history yet, the page says so rather than drawing a chart from nothing. (A custom date-range picker is not yet implemented — only the three preset ranges.)

`src/lib/analyticsEngine.ts` is a separate, unit-tested statistics module (kept deliberately out of React components) covering: refill-aware consumption (a rising level is treated as a refill and excluded from consumption totals, never counted as usage), peak usage hour/day, trend direction with % change, statistical anomaly detection (z-score + IQR — explainable, not ML), exponential-smoothing forecasts for remaining-water estimates, water quality (pH/temperature) stats, pump runtime analytics, tank utilization (time spent low/normal/high, refill interval, estimated days remaining), tank-relative refill classification (partial/normal/large), behavior change-point detection (recent vs. historical baseline), and both Pearson and Spearman correlation between two series. Every function returns an explicit "insufficient data" result (or a `READY`/`LIMITED`/`INSUFFICIENT` tri-state) rather than a guessed number when there isn't enough history — named thresholds are in the module itself.

`src/lib/dataQuality.ts` classifies every reading as `VALID` / `INVALID` / `SUSPECT` / `MISSING` *before* any of the above runs — flags negative/out-of-range values, duplicate timestamps, large timestamp gaps, sudden implausible jumps, and long runs of identical readings (a possible stuck sensor). Flagged readings aren't silently deleted; invalid ones are excluded from calculations, suspect ones are kept with a stated reason.

**On machine learning**: deliberately not included. There's no accumulated real production dataset yet (no hardware connected), and every pattern-discovery use case here is already covered by the explainable statistical methods above. Adding an ML dependency now would mean training on synthetic data, which is exactly what this project avoids — see the doc-comment at the top of `analyticsEngine.ts` for the full reasoning. Revisit once real historical data exists and a concrete gap emerges.

## Alerts & Notifications

`src/lib/alertsEngine.ts` watches live tank state and raises a notification the moment a real threshold is crossed — critical/low water, overflow risk, rapid drop, leak, dry run, sensor offline, low battery, weak signal, stale data (no update for 15+ minutes), and pump running continuously for over an hour (using actual `pumpLogs` transitions). Each condition has a stable key so it won't re-fire every tick while it persists — only when it clears and happens again.

## AI Insights

Two layers, both real data only, no fabricated readings:
- `src/lib/insights.ts` — the original rule-based pass (leak/dry-run flags, threshold crossings, 24-hour drift/overnight-spike anomaly detection, time-to-low-level projection), shared between the AI Insights page and the Excel export.
- `src/lib/structuredInsights.ts` — converts `analyticsEngine.ts`'s statistical output into a structured schema (title, summary, metric, value, baseline, changePercent, severity, confidence, evidence, recommendation) shown in the page's "Analytics Intelligence" section, grouped into Consumption Patterns, Anomalies, Water Quality, Pump Intelligence, and Forecast. There is no LLM in this pipeline — `AIProvider` in that file is an unused pass-through interface for if one is ever added later (any real key would stay server-side, never in this frontend).

Multi-tank histories are grouped strictly by tank ID everywhere in both layers — two tanks that happen to share a display name can never have their histories or predictions mixed (this was a real bug, fixed and regression-tested this pass).

With no tanks or insufficient history, both layers say so plainly rather than inventing an insight to fill space.

## Pump Control

**Important:** the pump control page writes a command to Firebase (`tanks/{id}/pumpStatus`) — it does **not** confirm the physical pump changed state. That only happens once your ESP32 firmware is listening on that path and actually switches a relay. The UI says so explicitly; treat it as request-only until your hardware acknowledges commands. A future acknowledgement flow would look like:

```
TankSync → writes command → Firebase → ESP32 reads command → switches relay
                                              │
ESP32 writes actual state ← Firebase ← ───────┘
TankSync reads actual state from the same tanks/{id} node
```

## Security

- Firebase web config in `.env` is a public client identifier, not a secret — real access control is enforced by `database.rules.json` (auth-gated reads/writes; `history`/`auditLogs`/`pumpLogs` are append-only — once written, an entry can't be edited or deleted).
- No service-account keys or admin SDK credentials are used or needed by this frontend.
- `.env` is git-ignored; `.env.example` contains placeholders only.
- Audit log exports mask API-key values (`****last4`) rather than exposing them in full.
- Client-side hiding is not security — the database rules are what actually protect the data. Deploy `database.rules.json` before going to production.

## Demo Mode

Settings → toggle Demo Mode to see simulated tank data drift over time, for exploring the UI before hardware is ready. It's a separate, clearly-labeled state (`status: 'demo'`) that never gets mixed into real Firebase data, and turns off the live listeners while active.

## Deployment

The project includes a `vercel.json` and builds to a standard static `dist/` (via `npm run build`) that can be deployed to Vercel, Netlify, Firebase Hosting, or any static host. Set the same environment variables in your host's dashboard that you set in `.env` locally.

## Troubleshooting

- **"Firebase Not Configured"** — check that all `VITE_FIREBASE_*` variables are set and you've restarted the dev server (Vite only reads `.env` at startup). Check the browser console — it names exactly which variable(s) are still unset.
- **`auth/api-key-not-valid-please-pass-a-valid-api-key` even after setting `.env` correctly** — this almost always means one required variable besides `apiKey` is still blank (most commonly `VITE_FIREBASE_DATABASE_URL`, since it isn't in Firebase's default config snippet). While any required variable is missing, TankSync won't use your `.env` at all, and if a config was ever saved through Settings in this browser before, that state is now visible and explicit (Settings shows a "Use previously saved configuration" button) rather than silently active — check whether that banner is showing. Fix the missing variable, restart the dev server, and if Settings still shows a saved-config banner you don't want, click **Reset**.
- **"Waiting for Sensor Data"** — Firebase is connected but the `tanks` path is empty; this is expected before your first ESP32 write.
- **Dashboard not updating live** — confirm your ESP32 is writing to the same path shown in Devices → Connect Device → Test Connection, and that the Telemetry Path in Settings matches.
- **Excel export slow to start** — the export library loads on demand the first time you click Export, to keep the Reports page itself lightweight.

## Future Hardware Integration Notes

- When your ESP32 is ready, you should not need to touch the frontend at all — just point it at the Firebase path shown in Devices → Connect Device.
- If your firmware's field names don't match the aliases already listed, the only file to touch is `src/lib/sensorAdapter.ts`.
- For pump acknowledgement (confirmed physical state, not just a command), extend the `tanks/{id}` schema with an `actualPumpStatus` field written by the ESP32, and surface it alongside the requested `pumpStatus` in `PumpControls.tsx`.
