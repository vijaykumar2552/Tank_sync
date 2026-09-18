export type TankShape =
  | 'Rectangle'
  | 'Circle'
  | 'Vertical Cylinder'
  | 'Horizontal Cylinder'
  | 'Square'
  | 'Custom Image';

export type PumpStatus = 'ON' | 'OFF';
export type PumpMode = 'Manual' | 'Auto';
export type SensorHealth = 'Good' | 'Fair' | 'Poor' | 'Offline';
export type UpdateSource = 'Admin' | 'API' | 'Firebase';
export type NotificationType = 'info' | 'warning' | 'error' | 'success';

export interface Tank {
  id: string;
  property: string;
  name: string;
  shape: TankShape;
  capacity: number;
  currentWater: number;
  /** Whether currentWater came directly from the sensor payload or was derived from waterLevel x capacity because the sensor didn't send a volume. Never silently presented as measured when it wasn't. */
  quantitySource: 'measured' | 'calculated' | 'unavailable';
  waterLevel: number;
  pumpStatus: PumpStatus;
  pumpMode: PumpMode;
  battery: number;
  batteryVoltage: number;
  signal: number;
  temperature: number;
  humidity: number;
  flowRate: number;
  ph: number | null;
  leak: boolean;
  overflow: boolean;
  dryRun: boolean;
  sensorHealth: SensorHealth;
  remarks: string;
  customImageUrl: string | null;
  status: string;
  lastUpdated: number;
}

export interface TankHistory {
  id: string;
  tankId: string;
  name: string;
  property: string;
  capacity: number;
  currentWater: number;
  quantitySource: 'measured' | 'calculated' | 'unavailable';
  waterLevel: number;
  pumpStatus: PumpStatus;
  pumpMode: PumpMode;
  battery: number;
  batteryVoltage: number;
  signal: number;
  temperature: number;
  humidity: number;
  flowRate: number;
  ph: number | null;
  leak: boolean;
  overflow: boolean;
  dryRun: boolean;
  sensorHealth: SensorHealth;
  remarks: string;
  source: UpdateSource;
  updatedBy: string;
  timestamp: number;
}

export interface Notification {
  id: string;
  name: string;
  property: string;
  title: string;
  message: string;
  previousValue: string | null;
  newValue: string | null;
  source: UpdateSource;
  updatedBy: string;
  isRead: boolean;
  type: NotificationType;
  timestamp: number;
}

export interface AuditLog {
  id: string;
  name: string;
  property: string;
  userName: string;
  phoneNumber: string | null;
  apiKey: string | null;
  source: UpdateSource;
  action: string;
  oldValue: Record<string, unknown> | null;
  newValue: Record<string, unknown> | null;
  field: string | null;
  ipAddress: string | null;
  remarks: string | null;
  timestamp: number;
}

export interface PumpLog {
  id: string;
  tankId: string;
  name: string;
  property: string;
  pumpStatus: PumpStatus;
  pumpMode: PumpMode;
  previousStatus: string | null;
  source: UpdateSource;
  updatedBy: string;
  timestamp: number;
}

export interface BatteryLog {
  id: string;
  tankId: string;
  name: string;
  property: string;
  battery: number;
  batteryVoltage: number;
  source: UpdateSource;
  updatedBy: string;
  timestamp: number;
}

export interface SensorLog {
  id: string;
  tankId: string;
  name: string;
  property: string;
  temperature: number;
  humidity: number;
  signal: number;
  flowRate: number;
  source: UpdateSource;
  updatedBy: string;
  timestamp: number;
}

export interface TankInput {
  property: string;
  name: string;
  shape?: TankShape;
  capacity: number;
  currentWater: number;
  waterLevel: number;
  pump: PumpStatus;
  pumpMode?: PumpMode;
  battery: number;
  batteryVoltage: number;
  signal: number;
  temperature: number;
  humidity: number;
  flowRate: number;
  leak: boolean;
  overflow: boolean;
  dryRun: boolean;
  sensorHealth: SensorHealth;
  remarks: string;
  customImageUrl?: string;
}

export interface AppSettings {
  autoPump: boolean;
  highThreshold: number;
  lowThreshold: number;
}

export interface Telemetry {
  waterLevel: number;
  flowRate: number;
  pumpActive: boolean;
}

export interface FirebaseConfig {
  apiKey: string;
  authDomain: string;
  databaseURL: string;
  projectId: string;
  storageBucket: string;
  messagingSenderId: string;
  appId: string;
  measurementId: string;
  telemetryPath: string;
}

export type ConnectionStatus =
  | 'connected'
  | 'connecting'
  | 'reconnecting'
  | 'offline'
  | 'demo';

export interface AuthUser {
  uid: string;
  email: string | null;
  displayName: string | null;
  photoURL: string | null;
  provider: string;
}
