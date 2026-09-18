/**
 * LOCALLY TESTED WITH SAMPLE PAYLOAD -- NOT A LIVE TEST.
 * This exercises the exact same decode -> map -> validate pipeline the
 * real webhook uses, in-process (no HTTP, no real Firebase network call
 * unless you've configured real credentials and pass --write).
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { config } from '../src/config.js';
import { decodeTTSUplink, type TTSUplinkEnvelope } from '../src/ttsDecoder.js';
import { validateTelemetry } from '../src/validate.js';
import { loadDeviceTankMap, resolveTankId } from '../src/deviceTankMap.js';
import { initFirebaseAdmin, isFirebaseAdminReady, writeTelemetry } from '../src/firebaseAdmin.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const samplePath = join(__dirname, 'sample-tts-payload.json');
const envelope = JSON.parse(readFileSync(samplePath, 'utf-8')) as TTSUplinkEnvelope;

console.log('=== TankSync TTS Bridge — Local Pipeline Test ===');
console.log('Source: server/scripts/sample-tts-payload.json (SAMPLE, not a real captured device payload)\n');

const decoded = decodeTTSUplink(envelope);
console.log('1. Decoded fields:', {
  deviceId: decoded.deviceId,
  waterLevelPercent: decoded.waterLevelPercent,
  quantityLiters: decoded.quantityLiters,
  temperatureC: decoded.temperatureC,
  ph: decoded.ph,
  pumpStatus: decoded.pumpStatus,
  deviceStatus: decoded.deviceStatus,
  timestamp: decoded.timestamp ? new Date(decoded.timestamp).toISOString() : null,
});

const validation = validateTelemetry(decoded);
console.log('\n2. Validation result:', validation.valid ? 'VALID' : 'INVALID');
if (validation.errors.length > 0) console.log('   Notes:', validation.errors);

// For this test, map the sample device explicitly (doesn't require the
// operator's real DEVICE_TANK_MAP to be populated to test the pipeline).
loadDeviceTankMap(JSON.stringify({ 'eui-tank-sensor-01': 'test_tank_local' }));
const tankId = resolveTankId(decoded.deviceId);
console.log(`\n3. Device -> Tank mapping: ${decoded.deviceId} -> ${tankId ?? 'UNMAPPED'}`);

const shouldWrite = process.argv.includes('--write');
if (!shouldWrite) {
  console.log('\n4. Firebase write: SKIPPED (run with --write to attempt a real write using your configured credentials)');
} else if (!config.firebaseServiceAccountPath || !config.firebaseDatabaseURL) {
  console.log('\n4. Firebase write: SKIPPED — FIREBASE_SERVICE_ACCOUNT_PATH / FIREBASE_DATABASE_URL not set in server/.env');
} else {
  const init = initFirebaseAdmin(config.firebaseServiceAccountPath, config.firebaseDatabaseURL);
  if (!init.ok || !isFirebaseAdminReady()) {
    console.log(`\n4. Firebase write: FAILED to initialize — ${init.error}`);
  } else if (!tankId || !validation.valid) {
    console.log('\n4. Firebase write: SKIPPED — device unmapped or telemetry invalid');
  } else {
    const result = await writeTelemetry(tankId, validation.sanitized);
    console.log(`\n4. Firebase write: ${result.ok ? `SUCCEEDED — check tanks/${tankId} and history/ in your Realtime Database` : `FAILED — ${result.error}`}`);
    console.log('   THIS WAS A REAL NETWORK WRITE using your configured service account, not a simulation.');
  }
}

console.log('\n=== End of local pipeline test (sample payload — not a live device test) ===');
