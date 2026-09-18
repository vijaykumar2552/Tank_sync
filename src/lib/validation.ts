import { z } from 'zod';

export const tankShapeSchema = z.enum([
  'Rectangle', 'Circle', 'Vertical Cylinder', 'Horizontal Cylinder', 'Square', 'Custom Image',
]);

export const pumpStatusSchema = z.enum(['ON', 'OFF']);
export const pumpModeSchema = z.enum(['Manual', 'Auto']);
export const sensorHealthSchema = z.enum(['Good', 'Fair', 'Poor', 'Offline']);
export const updateSourceSchema = z.enum(['Admin', 'API', 'Firebase']);

export const tankInputSchema = z.object({
  property: z.string().trim().min(1, 'Property is required').max(100),
  name: z.string().trim().min(1, 'Tank name is required').max(100),
  shape: tankShapeSchema.optional().default('Vertical Cylinder'),
  capacity: z.number().min(1, 'Capacity must be greater than 0').max(10_000_000),
  currentWater: z.number().min(0, 'Current water cannot be negative').max(10_000_000),
  waterLevel: z.number().min(0, 'Must be 0-100').max(100, 'Must be 0-100'),
  pump: pumpStatusSchema,
  pumpMode: pumpModeSchema.optional().default('Auto'),
  battery: z.number().min(0).max(100),
  batteryVoltage: z.number().min(0).max(100),
  signal: z.number().min(0).max(100),
  temperature: z.number().min(-50).max(100),
  humidity: z.number().min(0).max(100),
  flowRate: z.number().min(0).max(100_000),
  leak: z.boolean(),
  overflow: z.boolean(),
  dryRun: z.boolean(),
  sensorHealth: sensorHealthSchema,
  remarks: z.string().max(500).default(''),
  customImageUrl: z.string().url().optional().or(z.literal('')),
});

export type TankInputValidated = z.infer<typeof tankInputSchema>;

export const firebaseConfigSchema = z.object({
  apiKey: z.string().trim().min(1, 'API Key is required'),
  authDomain: z.string().trim().min(1, 'Auth Domain is required'),
  databaseURL: z.string().trim().url('Database URL must be a valid URL').startsWith('https://', 'Must start with https://'),
  projectId: z.string().trim().min(1, 'Project ID is required'),
  storageBucket: z.string().trim().min(1, 'Storage Bucket is required'),
  messagingSenderId: z.string().trim().min(1, 'Messaging Sender ID is required'),
  appId: z.string().trim().min(1, 'App ID is required'),
  measurementId: z.string().trim().optional().default(''),
  telemetryPath: z.string().trim().min(1, 'Telemetry path is required').default('/tanks'),
});

export type FirebaseConfigValidated = z.infer<typeof firebaseConfigSchema>;

export const pumpCommandSchema = z.object({
  tankId: z.string().min(1, 'Tank ID is required'),
  pumpStatus: pumpStatusSchema,
});

export type PumpCommandValidated = z.infer<typeof pumpCommandSchema>;
