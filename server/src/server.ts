import express, { type Request, type Response } from 'express';
import { config, getConfigWarnings } from './config.js';
import { decodeTTSUplink, type TTSUplinkEnvelope } from './ttsDecoder.js';
import { validateTelemetry } from './validate.js';
import { loadDeviceTankMap, resolveTankId, getConfiguredDeviceCount } from './deviceTankMap.js';
import { initFirebaseAdmin, isFirebaseAdminReady, writeTelemetry } from './firebaseAdmin.js';

loadDeviceTankMap(config.deviceTankMapJson);

const firebaseInit = config.firebaseServiceAccountPath && config.firebaseDatabaseURL
  ? initFirebaseAdmin(config.firebaseServiceAccountPath, config.firebaseDatabaseURL)
  : { ok: false, error: 'Firebase Admin not configured (missing service account path or database URL).' };

const app = express();
app.use(express.json({ limit: '256kb' }));

// Malformed JSON from express.json() surfaces here as a SyntaxError before
// reaching any route handler — catch it explicitly so it never falls through
// to Express's default error handler, which can include a stack trace.
app.use((err: unknown, _req: Request, res: Response, next: express.NextFunction) => {
  if (err instanceof SyntaxError && 'body' in err) {
    console.warn('[bridge] Rejected request with malformed JSON body.');
    return res.status(400).json({ ok: false, error: 'Malformed JSON body.' });
  }
  next(err);
});

/** Shared-secret header check. NOT cryptographic signature verification — TTS does not sign webhook payloads by default; this checks a header value you configure identically in both places. */
function isAuthorized(req: Request): boolean {
  if (!config.ttsWebhookSecret) return true; // no secret configured — see startup warning
  const header = req.header('Authorization') || req.header('X-Webhook-Secret') || '';
  const bearerMatch = header.match(/^Bearer\s+(.+)$/i);
  const provided = bearerMatch ? bearerMatch[1] : header;
  return provided === config.ttsWebhookSecret;
}

async function processEnvelope(envelope: TTSUplinkEnvelope) {
  const decoded = decodeTTSUplink(envelope);
  const validation = validateTelemetry(decoded);
  const tankId = resolveTankId(decoded.deviceId);

  return { decoded, validation, tankId };
}

app.post('/webhooks/tts', async (req: Request, res: Response) => {
  if (!isAuthorized(req)) {
    console.warn('[bridge] Rejected webhook call: invalid or missing shared secret.');
    return res.status(401).json({ ok: false, error: 'Unauthorized' });
  }

  const { decoded, validation, tankId } = await processEnvelope(req.body as TTSUplinkEnvelope);

  if (!decoded.deviceId) {
    return res.status(400).json({ ok: false, error: 'Missing end_device_ids.device_id in payload.' });
  }

  if (!tankId) {
    console.warn(`[bridge] Uplink from unmapped device "${decoded.deviceId}" — add it to DEVICE_TANK_MAP to accept it.`);
    return res.status(404).json({ ok: false, error: `Device "${decoded.deviceId}" is not mapped to a tank.` });
  }

  if (!validation.valid) {
    console.warn(`[bridge] Rejected uplink from ${decoded.deviceId}:`, validation.errors);
    return res.status(422).json({ ok: false, error: 'Telemetry failed validation.', details: validation.errors });
  }

  if (!isFirebaseAdminReady()) {
    console.error('[bridge] Firebase Admin not configured — cannot write telemetry.', firebaseInit.error);
    return res.status(503).json({ ok: false, error: 'Bridge is not connected to Firebase yet.' });
  }

  const result = await writeTelemetry(tankId, validation.sanitized);
  if (!result.ok) {
    console.error(`[bridge] Firebase write failed for tank ${tankId}:`, result.error);
    return res.status(502).json({ ok: false, error: 'Failed to write telemetry to Firebase.' });
  }

  console.log(`[bridge] Wrote telemetry for device ${decoded.deviceId} -> tank ${tankId} at ${new Date(validation.sanitized.timestamp!).toISOString()}`);
  return res.status(200).json({ ok: true, tankId, warnings: validation.errors });
});

/**
 * Diagnostic endpoint (section 41). Runs the exact same decode -> map ->
 * validate pipeline as the real webhook. Only actually writes to Firebase
 * if `write: true` is passed AND Firebase Admin is configured — otherwise
 * it returns what WOULD be written, without writing it, so this can be
 * used safely to test payload shapes.
 */
app.post('/webhooks/test', async (req: Request, res: Response) => {
  const { write } = req.query;
  const { decoded, validation, tankId } = await processEnvelope(req.body as TTSUplinkEnvelope);

  const diagnostic = {
    receivedDeviceId: decoded.deviceId,
    mappedTankId: tankId,
    decodedFields: {
      waterLevelPercent: decoded.waterLevelPercent,
      quantityLiters: decoded.quantityLiters,
      temperatureC: decoded.temperatureC,
      ph: decoded.ph,
      pumpStatus: decoded.pumpStatus,
      deviceStatus: decoded.deviceStatus,
      timestamp: decoded.timestamp,
    },
    validation: { valid: validation.valid, errors: validation.errors },
    wouldWriteTo: tankId ? `tanks/${tankId}` : null,
    firebaseWrite: 'not attempted',
  };

  if (write === 'true' && tankId && validation.valid && isFirebaseAdminReady()) {
    const result = await writeTelemetry(tankId, validation.sanitized);
    diagnostic.firebaseWrite = result.ok ? 'SUCCEEDED (real write)' : `FAILED: ${result.error}`;
  } else if (write === 'true') {
    diagnostic.firebaseWrite = 'skipped (device unmapped, invalid, or Firebase not configured)';
  }

  return res.status(200).json({ ok: true, diagnostic });
});

app.get('/health', (_req: Request, res: Response) => {
  res.status(200).json({
    ok: true,
    firebaseConfigured: isFirebaseAdminReady(),
    devicesMapped: getConfiguredDeviceCount(),
    webhookAuthEnabled: Boolean(config.ttsWebhookSecret),
  });
});

// Final safety net: any error that reaches here (a stray synchronous throw
// in a route we didn't anticipate) gets a generic response — never the
// error's message or stack, which could leak internal details externally.
app.use((err: unknown, _req: Request, res: Response, _next: express.NextFunction) => {
  console.error('[bridge] Unhandled error:', err);
  res.status(500).json({ ok: false, error: 'Internal server error.' });
});

const warnings = getConfigWarnings();
if (warnings.length > 0) {
  console.warn('[bridge] Startup warnings:');
  warnings.forEach((w) => console.warn(`  - ${w}`));
}
if (!firebaseInit.ok) {
  console.warn(`[bridge] Firebase Admin not ready: ${firebaseInit.error}`);
}

app.listen(config.port, () => {
  console.log(`[bridge] TankSync TTS bridge listening on port ${config.port}`);
  console.log(`[bridge] Webhook endpoint: POST http://localhost:${config.port}/webhooks/tts`);
  console.log(`[bridge] Health check:    GET  http://localhost:${config.port}/health`);
});
