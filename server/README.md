# TankSync TTS → Firebase Bridge

A small, separate Node/TypeScript server. Its only job: receive The Things
Stack (TTS) webhook uplinks, validate them, and write normalized telemetry
into the **same** Firebase Realtime Database the TankSync frontend already
reads — no frontend changes needed to consume it.

This is deliberately not a big backend. It has three endpoints and five
small source files.

## Status (read this first)

- **Implemented and tested locally** against a realistic sample payload — see [Testing](#testing) below. All real code paths (auth rejection, unmapped device, invalid values, successful diagnostic decode) were actually run and verified, not just written.
- **Not verified against a live TTS account, a real ESP32, or a live Firebase write.** That requires a real TTS webhook pointed at a publicly reachable instance of this server, and real Firebase Admin credentials — neither of which exist in a local dev sandbox by default. See [Going Live](#going-live).

## Architecture

```
ESP32 (LoRaWAN) → The Things Stack → webhook → THIS SERVER → Firebase Admin SDK → Firebase Realtime Database
```

- `src/ttsDecoder.ts` — decodes the real, documented TTS v3 webhook envelope. The device-specific `decoded_payload` field names are isolated in `PAYLOAD_FIELD_ALIASES` — the one place to edit once you know your real payload.
- `src/validate.ts` — range/type checks. Rejects bad values instead of inventing replacements.
- `src/deviceTankMap.ts` — server-side `device_id → tankId` mapping. The webhook payload's own IDs are never trusted directly.
- `src/firebaseAdmin.ts` — writes into TankSync's existing schema (`tanks/{id}` partial update + `history/` push).
- `src/server.ts` — the three HTTP endpoints.

## Setup

```bash
cd server
npm install
cp .env.example .env
```

Fill in `.env`:

- `PORT` — defaults to 8787.
- `TTS_WEBHOOK_SECRET` — pick any long random string. You'll set the identical value as a custom header in the TTS console (see below).
- `FIREBASE_SERVICE_ACCOUNT_PATH` — path to a Firebase service-account JSON (Firebase Console → Project Settings → Service Accounts → Generate new private key). Keep it outside version control — `server/secrets/` is already gitignored.
- `FIREBASE_DATABASE_URL` — the same Realtime Database URL as the frontend's `VITE_FIREBASE_DATABASE_URL`.
- `DEVICE_TANK_MAP` — JSON object mapping TTS `device_id` to TankSync tank IDs, e.g. `{"eui-a1b2c3":"tank_1"}`. The tank must already exist in Firebase (created via the TankSync UI) — this only updates telemetry fields, it doesn't create a fully-configured tank from nothing.

Run it:

```bash
npm run dev     # tsx watch — restarts on file changes
# or
npm run build && npm start
```

## Configuring the TTS webhook

In the TTS Console: your Application → Integrations → Webhooks → Add webhook.

- **Webhook format:** JSON
- **Base URL:** wherever you've deployed/tunneled this server, e.g. `https://your-host.example.com`
- **Path:** `/webhooks/tts`
- **Headers:** add `Authorization: Bearer <the same value as TTS_WEBHOOK_SECRET>`
- **Enabled event:** Uplink message

This header check is the actual security mechanism — a shared secret, not cryptographic payload signing. TTS does not sign webhook payloads by default, so this bridge doesn't claim it does.

## Testing

**Local pipeline test (no network, no real Firebase needed):**

```bash
npm run test:local
```

Runs the exact decode → map → validate pipeline against `scripts/sample-tts-payload.json` (a realistic sample of the TTS envelope shape — not a captured real device payload) and prints each stage's output.

**Diagnostic endpoint (with the server running):**

```bash
curl -X POST http://localhost:8787/webhooks/test \
  -H "Content-Type: application/json" \
  -d @scripts/sample-tts-payload.json
```

Shows the received device ID, mapped tank ID, decoded fields, and validation result without writing anything unless you add `?write=true` (and only then if the device is mapped, the payload is valid, and Firebase is configured).

## Going Live

1. Replace `scripts/sample-tts-payload.json`'s `decoded_payload` with your device's real uplink once you have one, and update `PAYLOAD_FIELD_ALIASES` in `src/ttsDecoder.ts` if the field names differ.
2. Deploy this server somewhere with a public HTTPS URL (any small Node host works — Render, Railway, Fly.io, a VPS, etc.), or tunnel your local instance (e.g. ngrok) for testing.
3. Point the TTS webhook at that URL (see above).
4. Add real Firebase Admin credentials and your real `DEVICE_TANK_MAP`.
5. Send one real uplink and confirm it appears in TankSync — check the bridge's logs and `GET /health` first if it doesn't.
