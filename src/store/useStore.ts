import { create } from 'zustand';
import { ref, get as fbGet, set as fbSet, update as fbUpdate, remove as fbRemove, push as fbPush } from 'firebase/database';
import { getFirebaseDb } from '../lib/firebase';
import { normalizeSensorPayload, normalizeSensorHistoryPayload } from '../lib/sensorAdapter';
import { FIREBASE_PATHS } from '../constants/firebasePaths';
import type { Tank, Notification, AuditLog, TankInput, PumpLog, TankHistory } from '../types';

export interface SourceToast {
  id: string;
  source: string;
  message: string;
  tankName: string;
}

interface StoreState {
  tanks: Tank[];
  notifications: Notification[];
  auditLogs: AuditLog[];
  pumpLogs: PumpLog[];
  history: TankHistory[];
  loading: boolean;
  error: string | null;
  unreadNotifications: number;
  sourceToasts: SourceToast[];

  fetchTanks: () => Promise<void>;
  fetchNotifications: () => Promise<void>;
  fetchAuditLogs: () => Promise<void>;
  fetchPumpLogs: () => Promise<void>;
  fetchHistory: () => Promise<void>;
  markNotificationRead: (id: string) => Promise<void>;
  markAllNotificationsRead: () => Promise<void>;
  saveTank: (input: TankInput, source?: string, updatedBy?: string) => Promise<{ success: boolean; message: string }>;
  updateTank: (id: string, input: TankInput, source?: string, updatedBy?: string) => Promise<{ success: boolean; message: string }>;
  deleteTank: (id: string) => Promise<{ success: boolean; message: string }>;
  setTanks: (tanks: Tank[]) => void;
  setNotifications: (n: Notification[]) => void;
  setAuditLogs: (l: AuditLog[]) => void;
  setPumpLogs: (l: PumpLog[]) => void;
  setHistory: (h: TankHistory[]) => void;
  addNotification: (n: Notification) => void;
  addAuditLog: (log: AuditLog) => void;
  addPumpLog: (log: PumpLog) => void;
  upsertTank: (tank: Tank) => void;
  removeTank: (id: string) => void;
  pushSourceToast: (toast: SourceToast) => void;
  dismissSourceToast: (id: string) => void;
}

function db() {
  const database = getFirebaseDb();
  if (!database) throw new Error('Firebase database not initialized');
  return database;
}

function inputToTank(input: TankInput, id: string): Tank {
  return {
    id,
    property: input.property,
    name: input.name,
    shape: input.shape || 'Vertical Cylinder',
    capacity: input.capacity,
    currentWater: input.currentWater,
    quantitySource: 'measured',
    waterLevel: input.waterLevel,
    pumpStatus: input.pump,
    pumpMode: input.pumpMode || 'Auto',
    battery: input.battery,
    batteryVoltage: input.batteryVoltage,
    signal: input.signal,
    temperature: input.temperature,
    humidity: input.humidity,
    flowRate: input.flowRate,
    ph: null,
    leak: input.leak,
    overflow: input.overflow,
    dryRun: input.dryRun,
    sensorHealth: input.sensorHealth,
    remarks: input.remarks,
    customImageUrl: input.customImageUrl || null,
    status: input.waterLevel >= 90 ? 'overflow_risk' : input.waterLevel <= 20 ? 'low' : 'normal',
    lastUpdated: Date.now(),
  };
}

function tankToHistory(tank: Tank, source: string, updatedBy: string): Omit<TankHistory, 'id'> {
  return {
    tankId: tank.id,
    name: tank.name,
    property: tank.property,
    capacity: tank.capacity,
    currentWater: tank.currentWater,
    quantitySource: tank.quantitySource,
    waterLevel: tank.waterLevel,
    pumpStatus: tank.pumpStatus,
    pumpMode: tank.pumpMode,
    battery: tank.battery,
    batteryVoltage: tank.batteryVoltage,
    signal: tank.signal,
    temperature: tank.temperature,
    humidity: tank.humidity,
    flowRate: tank.flowRate,
    ph: tank.ph,
    leak: tank.leak,
    overflow: tank.overflow,
    dryRun: tank.dryRun,
    sensorHealth: tank.sensorHealth,
    remarks: tank.remarks,
    source: source as TankHistory['source'],
    updatedBy,
    timestamp: Date.now(),
  };
}

export const useStore = create<StoreState>((set, get) => ({
  tanks: [],
  notifications: [],
  auditLogs: [],
  pumpLogs: [],
  history: [],
  loading: false,
  error: null,
  unreadNotifications: 0,
  sourceToasts: [],

  fetchTanks: async () => {
    set({ loading: true, error: null });
    try {
      const snap = await fbGet(ref(db(), FIREBASE_PATHS.tanks));
      const val = snap.val() as Record<string, unknown> | null;
      const tanks = val
        ? Object.entries(val).map(([id, t]) => normalizeSensorPayload(t as Record<string, unknown>, id))
        : [];
      tanks.sort((a, b) => (b.lastUpdated || 0) - (a.lastUpdated || 0));
      set({ tanks, loading: false });
    } catch (err) {
      set({ error: err instanceof Error ? err.message : 'Failed to fetch tanks', loading: false });
    }
  },

  fetchNotifications: async () => {
    try {
      const snap = await fbGet(ref(db(), FIREBASE_PATHS.notifications));
      const val = snap.val() as Record<string, Notification> | null;
      const notifs = val
        ? Object.entries(val).map(([id, n]) => ({ ...n, id }))
        : [];
      notifs.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
      set({
        notifications: notifs.slice(0, 100),
        unreadNotifications: notifs.filter((n) => !n.isRead).length,
      });
    } catch { /* ignore */ }
  },

  fetchAuditLogs: async () => {
    try {
      const snap = await fbGet(ref(db(), FIREBASE_PATHS.auditLogs));
      const val = snap.val() as Record<string, AuditLog> | null;
      const logs = val
        ? Object.entries(val).map(([id, l]) => ({ ...l, id }))
        : [];
      logs.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
      set({ auditLogs: logs.slice(0, 200) });
    } catch { /* ignore */ }
  },

  fetchPumpLogs: async () => {
    try {
      const snap = await fbGet(ref(db(), FIREBASE_PATHS.pumpLogs));
      const val = snap.val() as Record<string, PumpLog> | null;
      const logs = val
        ? Object.entries(val).map(([id, l]) => ({ ...l, id }))
        : [];
      logs.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
      set({ pumpLogs: logs.slice(0, 50) });
    } catch { /* ignore */ }
  },

  fetchHistory: async () => {
    try {
      const snap = await fbGet(ref(db(), FIREBASE_PATHS.history));
      const val = snap.val() as Record<string, unknown> | null;
      const hist = val
        ? Object.entries(val).map(([id, h]) => normalizeSensorHistoryPayload(h as Record<string, unknown>, id))
        : [];
      hist.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
      set({ history: hist.slice(0, 500) });
    } catch { /* ignore */ }
  },

  markNotificationRead: async (id) => {
    try {
      await fbUpdate(ref(db(), `notifications/${id}`), { isRead: true });
    } catch { /* ignore */ }
    set((s) => ({
      notifications: s.notifications.map((n) => (n.id === id ? { ...n, isRead: true } : n)),
      unreadNotifications: Math.max(0, s.unreadNotifications - 1),
    }));
  },

  markAllNotificationsRead: async () => {
    const { notifications } = get();
    const unread = notifications.filter((n) => !n.isRead);
    for (const n of unread) {
      try {
        await fbUpdate(ref(db(), `notifications/${n.id}`), { isRead: true });
      } catch { /* ignore */ }
    }
    set({
      notifications: notifications.map((n) => ({ ...n, isRead: true })),
      unreadNotifications: 0,
    });
  },

  saveTank: async (input, source = 'Admin', updatedBy = 'Admin') => {
    try {
      const newRef = fbPush(ref(db(), FIREBASE_PATHS.tanks));
      const id = newRef.key!;
      const tank = inputToTank(input, id);
      await fbSet(newRef, tank);

      await pushHistory(tank, source, updatedBy);
      await pushNotification(tank, null, String(input.waterLevel), source, updatedBy);
      await pushAudit(tank, null, tank as unknown as Record<string, unknown>, source, updatedBy, 'CREATE');

      set((s) => ({ tanks: [tank, ...s.tanks] }));
      return { success: true, message: 'Tank saved successfully' };
    } catch (err) {
      return { success: false, message: err instanceof Error ? err.message : 'Failed to save tank' };
    }
  },

  updateTank: async (id, input, source = 'Admin', updatedBy = 'Admin') => {
    const existing = get().tanks.find((t) => t.id === id);
    try {
      const tank = inputToTank(input, id);
      await fbUpdate(ref(db(), `tanks/${id}`), tank);

      const prevLevel = existing ? String(existing.waterLevel) : null;
      await pushHistory(tank, source, updatedBy);
      await pushNotification(tank, prevLevel, String(input.waterLevel), source, updatedBy);
      await pushAudit(tank, existing || null, tank as unknown as Record<string, unknown>, source, updatedBy, 'UPDATE');

      if (existing && existing.pumpStatus !== input.pump) {
        await fbPush(ref(db(), FIREBASE_PATHS.pumpLogs), {
          tankId: id,
          name: input.name,
          property: input.property,
          pumpStatus: input.pump,
          pumpMode: input.pumpMode || 'Auto',
          previousStatus: existing.pumpStatus,
          source,
          updatedBy,
          timestamp: Date.now(),
        });
      }

      set((s) => ({ tanks: s.tanks.map((t) => (t.id === id ? tank : t)) }));
      return { success: true, message: 'Tank updated successfully' };
    } catch (err) {
      return { success: false, message: err instanceof Error ? err.message : 'Failed to update tank' };
    }
  },

  deleteTank: async (id) => {
    const existing = get().tanks.find((t) => t.id === id);
    try {
      await fbRemove(ref(db(), `tanks/${id}`));
      if (existing) {
        await pushAudit(existing, existing, null, 'Admin', 'Admin', 'DELETE');
      }
      set((s) => ({ tanks: s.tanks.filter((t) => t.id !== id) }));
      return { success: true, message: 'Tank deleted successfully' };
    } catch (err) {
      return { success: false, message: err instanceof Error ? err.message : 'Failed to delete tank' };
    }
  },

  setTanks: (tanks) => set({ tanks }),
  setNotifications: (n) => set({ notifications: n, unreadNotifications: n.filter((x) => !x.isRead).length }),
  setAuditLogs: (l) => set({ auditLogs: l }),
  setPumpLogs: (l) => set({ pumpLogs: l }),
  setHistory: (h) => set({ history: h }),
  addNotification: (n) =>
    set((s) => ({ notifications: [n, ...s.notifications].slice(0, 100), unreadNotifications: s.unreadNotifications + 1 })),
  addAuditLog: (log) => set((s) => ({ auditLogs: [log, ...s.auditLogs].slice(0, 200) })),
  addPumpLog: (log) => set((s) => ({ pumpLogs: [log, ...s.pumpLogs].slice(0, 50) })),
  upsertTank: (tank) =>
    set((s) => {
      const idx = s.tanks.findIndex((t) => t.id === tank.id);
      if (idx >= 0) {
        const tanks = [...s.tanks];
        tanks[idx] = tank;
        return { tanks };
      }
      return { tanks: [tank, ...s.tanks] };
    }),
  removeTank: (id) => set((s) => ({ tanks: s.tanks.filter((t) => t.id !== id) })),

  pushSourceToast: (toast) => {
    set((s) => ({ sourceToasts: [...s.sourceToasts, toast] }));
    setTimeout(() => {
      set((s) => ({ sourceToasts: s.sourceToasts.filter((t) => t.id !== toast.id) }));
    }, 6000);
  },

  dismissSourceToast: (id) =>
    set((s) => ({ sourceToasts: s.sourceToasts.filter((t) => t.id !== id) })),
}));

async function pushHistory(tank: Tank, source: string, updatedBy: string) {
  await fbPush(ref(db(), FIREBASE_PATHS.history), tankToHistory(tank, source, updatedBy));
}

async function pushNotification(
  tank: Tank,
  prevValue: string | null,
  newValue: string,
  source: string,
  updatedBy: string
) {
  await fbPush(ref(db(), FIREBASE_PATHS.notifications), {
    name: tank.name,
    property: tank.property,
    title: `${tank.name} updated`,
    message: `${tank.name} at ${tank.property} was updated via ${source}`,
    previousValue: prevValue,
    newValue,
    source,
    updatedBy,
    isRead: false,
    type: 'info',
    timestamp: Date.now(),
  });
}

async function pushAudit(
  tank: Tank,
  oldVal: Tank | null,
  newVal: Record<string, unknown> | null,
  source: string,
  updatedBy: string,
  action: string
) {
  await fbPush(ref(db(), FIREBASE_PATHS.auditLogs), {
    name: tank.name,
    property: tank.property,
    userName: updatedBy,
    source,
    action,
    oldValue: oldVal ? (oldVal as unknown as Record<string, unknown>) : null,
    newValue: newVal,
    remarks: `${action} on ${tank.name}`,
    timestamp: Date.now(),
  });
}
