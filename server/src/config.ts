import 'dotenv/config';

export const config = {
  port: Number(process.env.PORT) || 8787,
  ttsWebhookSecret: process.env.TTS_WEBHOOK_SECRET || '',
  firebaseServiceAccountPath: process.env.FIREBASE_SERVICE_ACCOUNT_PATH || '',
  firebaseDatabaseURL: process.env.FIREBASE_DATABASE_URL || '',
  deviceTankMapJson: process.env.DEVICE_TANK_MAP || '{}',
};

export function getConfigWarnings(): string[] {
  const warnings: string[] = [];
  if (!config.ttsWebhookSecret) warnings.push('TTS_WEBHOOK_SECRET is not set — the webhook endpoint will accept unauthenticated requests. Set this before going live.');
  if (!config.firebaseServiceAccountPath) warnings.push('FIREBASE_SERVICE_ACCOUNT_PATH is not set — telemetry cannot be written to Firebase yet.');
  if (!config.firebaseDatabaseURL) warnings.push('FIREBASE_DATABASE_URL is not set — telemetry cannot be written to Firebase yet.');
  if (config.deviceTankMapJson === '{}') warnings.push('DEVICE_TANK_MAP is empty — no device will be recognized until you map at least one device_id to a tankId.');
  return warnings;
}
