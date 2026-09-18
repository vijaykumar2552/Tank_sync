import ExcelJS from 'exceljs';
import type { Tank, TankHistory, Notification, AuditLog, PumpLog } from '../types';
import { generateInsights, groupHistoryByTank, calculateWeeklyUsage, calculatePrevWeeklyUsage } from './insights';
import { sanitizeForSpreadsheet } from './utils';

const HEADER_FILL = 'FF1E5A8E';
const HEADER_FONT = 'FFFFFFFF';

interface ColumnDef<T> {
  header: string;
  key: string;
  width?: number;
  numFmt?: string;
  value: (row: T) => string | number | boolean | Date | null;
}

function styleHeaderRow(row: ExcelJS.Row) {
  row.eachCell((cell) => {
    cell.font = { bold: true, color: { argb: HEADER_FONT } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: HEADER_FILL } };
    cell.alignment = { vertical: 'middle', horizontal: 'left' };
  });
  row.height = 20;
}

function addDataSheet<T>(
  wb: ExcelJS.Workbook,
  sheetName: string,
  columns: ColumnDef<T>[],
  rows: T[],
  emptyMessage: string
): ExcelJS.Worksheet {
  const ws = wb.addWorksheet(sheetName, {
    views: [{ state: 'frozen', ySplit: 1 }],
  });

  ws.columns = columns.map((c) => ({ header: c.header, key: c.key, width: c.width ?? 16 }));
  styleHeaderRow(ws.getRow(1));

  if (rows.length === 0) {
    const row = ws.addRow({});
    ws.mergeCells(2, 1, 2, Math.max(columns.length, 1));
    const cell = ws.getCell(2, 1);
    cell.value = emptyMessage;
    cell.font = { italic: true, color: { argb: 'FF888888' } };
    cell.alignment = { horizontal: 'left', vertical: 'middle' };
    row.height = 22;
    return ws;
  }

  rows.forEach((r) => {
    const values: Record<string, string | number | boolean | Date | null> = {};
    columns.forEach((c) => { values[c.key] = sanitizeForSpreadsheet(c.value(r)) as typeof values[string]; });
    const row = ws.addRow(values);
    columns.forEach((c, i) => {
      if (c.numFmt) row.getCell(i + 1).numFmt = c.numFmt;
    });
  });

  ws.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: columns.length } };
  return ws;
}

const PCT_FMT = '0"%"';
const DATETIME_FMT = 'dd mmm yyyy hh:mm AM/PM';
const NUM_FMT = '#,##0';

function maskSecret(v: string | null | undefined): string | null {
  if (!v) return null;
  if (v.length <= 4) return '****';
  return `****${v.slice(-4)}`;
}

export interface ExportSource {
  tanks: Tank[];
  history: TankHistory[];
  notifications: Notification[];
  auditLogs: AuditLog[];
  pumpLogs: PumpLog[];
  projectName?: string;
}

export async function buildTankSyncWorkbook(data: ExportSource): Promise<ExcelJS.Workbook> {
  const { tanks, history, notifications, auditLogs, pumpLogs } = data;
  const wb = new ExcelJS.Workbook();
  wb.creator = 'TankSync';
  wb.created = new Date();

  // ---- 01. Summary ----
  const { insights, summary: insightSummary } = generateInsights(tanks, history);
  const dateRange = history.length > 0
    ? `${new Date(Math.min(...history.map((h) => h.timestamp))).toLocaleDateString()} – ${new Date(Math.max(...history.map((h) => h.timestamp))).toLocaleDateString()}`
    : 'No historical data yet';
  const activeAlerts = notifications.filter((n) => !n.isRead).length;

  const summarySheet = wb.addWorksheet('01_Summary');
  summarySheet.columns = [{ key: 'label', width: 30 }, { key: 'value', width: 40 }];
  const summaryRows: [string, string | number][] = [
    ['Report generated', new Date().toLocaleString()],
    ['Source project', data.projectName || 'Not configured'],
    ['Tanks monitored', tanks.length],
    ['Properties', new Set(tanks.map((t) => t.property)).size],
    ['Readings covered', history.length],
    ['Reading date range', dateRange],
    ['Average water level', tanks.length ? `${Math.round(tanks.reduce((s, t) => s + t.waterLevel, 0) / tanks.length)}%` : 'N/A'],
    ['System efficiency score', `${insightSummary.efficiency}/100`],
    ['Weekly consumption (all tanks)', insightSummary.weeklyUsage !== null ? `${insightSummary.weeklyUsage} L` : 'Not enough data'],
    ['Active (unread) alerts', activeAlerts],
    ['Total notifications on file', notifications.length],
    ['Total audit log entries', auditLogs.length],
    ['Total pump events on file', pumpLogs.length],
    ['Active AI insights', insights.length],
  ];
  summaryRows.forEach(([label, value]) => summarySheet.addRow({ label, value }));
  summarySheet.getColumn(1).font = { bold: true };
  summarySheet.insertRow(1, ['TankSync Data Export', '']);
  summarySheet.getRow(1).font = { bold: true, size: 14 };
  summarySheet.mergeCells(1, 1, 1, 2);

  // ---- 02. Tank Summary ----
  addDataSheet<Tank>(
    wb, '02_Tank_Summary',
    [
      { header: 'Tank ID', key: 'id', width: 14, value: (t) => t.id },
      { header: 'Tank Name', key: 'name', width: 20, value: (t) => t.name },
      { header: 'Property', key: 'property', width: 18, value: (t) => t.property },
      { header: 'Shape', key: 'shape', width: 16, value: (t) => t.shape },
      { header: 'Water Level', key: 'waterLevel', width: 12, numFmt: PCT_FMT, value: (t) => t.waterLevel },
      { header: 'Current Water (L)', key: 'currentWater', width: 16, numFmt: NUM_FMT, value: (t) => t.currentWater },
      { header: 'Water Source', key: 'quantitySource', width: 14, value: (t) => t.quantitySource },
      { header: 'Capacity (L)', key: 'capacity', width: 14, numFmt: NUM_FMT, value: (t) => t.capacity },
      { header: 'Pump Status', key: 'pumpStatus', width: 12, value: (t) => t.pumpStatus },
      { header: 'Pump Mode', key: 'pumpMode', width: 12, value: (t) => t.pumpMode },
      { header: 'Battery', key: 'battery', width: 10, numFmt: PCT_FMT, value: (t) => t.battery },
      { header: 'Battery Voltage', key: 'batteryVoltage', width: 14, value: (t) => t.batteryVoltage },
      { header: 'Signal', key: 'signal', width: 10, numFmt: PCT_FMT, value: (t) => t.signal },
      { header: 'Temperature (°C)', key: 'temperature', width: 16, value: (t) => t.temperature },
      { header: 'pH', key: 'ph', width: 10, value: (t) => t.ph },
      { header: 'Humidity', key: 'humidity', width: 10, numFmt: PCT_FMT, value: (t) => t.humidity },
      { header: 'Flow Rate (L/min)', key: 'flowRate', width: 16, value: (t) => t.flowRate },
      { header: 'Leak', key: 'leak', width: 8, value: (t) => (t.leak ? 'Yes' : 'No') },
      { header: 'Overflow', key: 'overflow', width: 10, value: (t) => (t.overflow ? 'Yes' : 'No') },
      { header: 'Dry Run', key: 'dryRun', width: 10, value: (t) => (t.dryRun ? 'Yes' : 'No') },
      { header: 'Sensor Health', key: 'sensorHealth', width: 14, value: (t) => t.sensorHealth },
      { header: 'Status', key: 'status', width: 14, value: (t) => t.status },
      { header: 'Last Updated', key: 'lastUpdated', width: 20, numFmt: DATETIME_FMT, value: (t) => (t.lastUpdated ? new Date(t.lastUpdated) : null) },
      { header: 'Remarks', key: 'remarks', width: 30, value: (t) => t.remarks },
    ],
    tanks,
    'No tanks configured yet.'
  );

  // ---- 03. Readings / History ----
  addDataSheet<TankHistory>(
    wb, '03_Readings_History',
    [
      { header: 'Timestamp', key: 'timestamp', width: 20, numFmt: DATETIME_FMT, value: (h) => (h.timestamp ? new Date(h.timestamp) : null) },
      { header: 'Property', key: 'property', width: 18, value: (h) => h.property },
      { header: 'Tank', key: 'name', width: 20, value: (h) => h.name },
      { header: 'Water Level', key: 'waterLevel', width: 12, numFmt: PCT_FMT, value: (h) => h.waterLevel },
      { header: 'Current Water (L)', key: 'currentWater', width: 16, numFmt: NUM_FMT, value: (h) => h.currentWater },
      { header: 'Water Source', key: 'quantitySource', width: 14, value: (h) => h.quantitySource },
      { header: 'Capacity (L)', key: 'capacity', width: 14, numFmt: NUM_FMT, value: (h) => h.capacity },
      { header: 'Pump Status', key: 'pumpStatus', width: 12, value: (h) => h.pumpStatus },
      { header: 'Pump Mode', key: 'pumpMode', width: 12, value: (h) => h.pumpMode },
      { header: 'Battery', key: 'battery', width: 10, numFmt: PCT_FMT, value: (h) => h.battery },
      { header: 'Signal', key: 'signal', width: 10, numFmt: PCT_FMT, value: (h) => h.signal },
      { header: 'Temperature (°C)', key: 'temperature', width: 16, value: (h) => h.temperature },
      { header: 'pH', key: 'ph', width: 10, value: (h) => h.ph },
      { header: 'Humidity', key: 'humidity', width: 10, numFmt: PCT_FMT, value: (h) => h.humidity },
      { header: 'Flow Rate (L/min)', key: 'flowRate', width: 16, value: (h) => h.flowRate },
      { header: 'Leak', key: 'leak', width: 8, value: (h) => (h.leak ? 'Yes' : 'No') },
      { header: 'Overflow', key: 'overflow', width: 10, value: (h) => (h.overflow ? 'Yes' : 'No') },
      { header: 'Dry Run', key: 'dryRun', width: 10, value: (h) => (h.dryRun ? 'Yes' : 'No') },
      { header: 'Sensor Health', key: 'sensorHealth', width: 14, value: (h) => h.sensorHealth },
      { header: 'Source', key: 'source', width: 12, value: (h) => h.source },
      { header: 'Updated By', key: 'updatedBy', width: 16, value: (h) => h.updatedBy },
      { header: 'Remarks', key: 'remarks', width: 30, value: (h) => h.remarks },
    ],
    history,
    'Historical data will appear here once sufficient sensor readings are collected.'
  );

  // ---- 04. Water Consumption (per-tank, derived from real readings) ----
  const byTank = groupHistoryByTank(history);
  const consumptionRows = tanks
    .map((t) => {
      const entries = byTank.get(t.id) ?? [];
      const weekly = calculateWeeklyUsage(entries);
      const prevWeekly = calculatePrevWeeklyUsage(entries);
      const changePercent = weekly !== null && prevWeekly !== null && prevWeekly > 0
        ? Math.round(((weekly - prevWeekly) / prevWeekly) * 100)
        : null;
      return { tank: t.name, property: t.property, weekly, prevWeekly, changePercent };
    })
    .filter((r) => r.weekly !== null || r.prevWeekly !== null);

  addDataSheet(
    wb, '04_Water_Consumption',
    [
      { header: 'Tank', key: 'tank', width: 20, value: (r: typeof consumptionRows[number]) => r.tank },
      { header: 'Property', key: 'property', width: 18, value: (r: typeof consumptionRows[number]) => r.property },
      { header: 'This Week (L)', key: 'weekly', width: 16, numFmt: NUM_FMT, value: (r: typeof consumptionRows[number]) => r.weekly },
      { header: 'Previous Week (L)', key: 'prevWeekly', width: 18, numFmt: NUM_FMT, value: (r: typeof consumptionRows[number]) => r.prevWeekly },
      { header: 'Change', key: 'changePercent', width: 12, numFmt: PCT_FMT, value: (r: typeof consumptionRows[number]) => r.changePercent },
    ],
    consumptionRows,
    'Not enough historical data yet to calculate weekly consumption.'
  );

  // ---- 05. Pump Activity ----
  addDataSheet<PumpLog>(
    wb, '05_Pump_Activity',
    [
      { header: 'Timestamp', key: 'timestamp', width: 20, numFmt: DATETIME_FMT, value: (p) => (p.timestamp ? new Date(p.timestamp) : null) },
      { header: 'Tank', key: 'name', width: 20, value: (p) => p.name },
      { header: 'Property', key: 'property', width: 18, value: (p) => p.property },
      { header: 'Pump Status', key: 'pumpStatus', width: 12, value: (p) => p.pumpStatus },
      { header: 'Pump Mode', key: 'pumpMode', width: 12, value: (p) => p.pumpMode },
      { header: 'Previous Status', key: 'previousStatus', width: 16, value: (p) => p.previousStatus },
      { header: 'Source', key: 'source', width: 12, value: (p) => p.source },
      { header: 'Updated By', key: 'updatedBy', width: 16, value: (p) => p.updatedBy },
    ],
    pumpLogs,
    'No pump status changes recorded yet.'
  );

  // ---- 06. Device / Sensor Health (derived from live tank sensor fields) ----
  addDataSheet<Tank>(
    wb, '06_Device_Sensor_Health',
    [
      { header: 'Device / Tank ID', key: 'id', width: 16, value: (t) => t.id },
      { header: 'Tank', key: 'name', width: 20, value: (t) => t.name },
      { header: 'Property', key: 'property', width: 18, value: (t) => t.property },
      { header: 'Sensor Health', key: 'sensorHealth', width: 14, value: (t) => t.sensorHealth },
      { header: 'Battery', key: 'battery', width: 10, numFmt: PCT_FMT, value: (t) => t.battery },
      { header: 'Battery Voltage', key: 'batteryVoltage', width: 14, value: (t) => t.batteryVoltage },
      { header: 'Signal', key: 'signal', width: 10, numFmt: PCT_FMT, value: (t) => t.signal },
      { header: 'Status', key: 'status', width: 14, value: (t) => t.status },
      { header: 'Last Seen', key: 'lastUpdated', width: 20, numFmt: DATETIME_FMT, value: (t) => (t.lastUpdated ? new Date(t.lastUpdated) : null) },
    ],
    tanks,
    'No devices configured yet.'
  );

  // ---- 07. Alerts & Notifications ----
  addDataSheet<Notification>(
    wb, '07_Alerts_Notifications',
    [
      { header: 'Timestamp', key: 'timestamp', width: 20, numFmt: DATETIME_FMT, value: (n) => (n.timestamp ? new Date(n.timestamp) : null) },
      { header: 'Tank', key: 'name', width: 20, value: (n) => n.name },
      { header: 'Property', key: 'property', width: 18, value: (n) => n.property },
      { header: 'Title', key: 'title', width: 24, value: (n) => n.title },
      { header: 'Message', key: 'message', width: 40, value: (n) => n.message },
      { header: 'Type', key: 'type', width: 10, value: (n) => n.type },
      { header: 'Previous Value', key: 'previousValue', width: 14, value: (n) => n.previousValue },
      { header: 'New Value', key: 'newValue', width: 12, value: (n) => n.newValue },
      { header: 'Source', key: 'source', width: 12, value: (n) => n.source },
      { header: 'Updated By', key: 'updatedBy', width: 16, value: (n) => n.updatedBy },
      { header: 'Read', key: 'isRead', width: 8, value: (n) => (n.isRead ? 'Yes' : 'No') },
    ],
    notifications,
    'No notifications recorded yet.'
  );

  // ---- 08. Audit Logs (secrets masked) ----
  addDataSheet<AuditLog>(
    wb, '08_Audit_Logs',
    [
      { header: 'Timestamp', key: 'timestamp', width: 20, numFmt: DATETIME_FMT, value: (l) => (l.timestamp ? new Date(l.timestamp) : null) },
      { header: 'User', key: 'userName', width: 16, value: (l) => l.userName },
      { header: 'Source', key: 'source', width: 12, value: (l) => l.source },
      { header: 'Action', key: 'action', width: 12, value: (l) => l.action },
      { header: 'Tank', key: 'name', width: 20, value: (l) => l.name },
      { header: 'Property', key: 'property', width: 18, value: (l) => l.property },
      { header: 'Field', key: 'field', width: 14, value: (l) => l.field },
      { header: 'API Key (masked)', key: 'apiKey', width: 18, value: (l) => maskSecret(l.apiKey) },
      { header: 'IP Address', key: 'ipAddress', width: 16, value: (l) => l.ipAddress },
      { header: 'Remarks', key: 'remarks', width: 30, value: (l) => l.remarks },
    ],
    auditLogs,
    'No audit log entries recorded yet.'
  );

  // ---- 09. AI Insights ----
  addDataSheet(
    wb, '09_AI_Insights',
    [
      { header: 'Priority', key: 'priority', width: 14, value: (i: typeof insights[number]) => i.priority.toUpperCase() },
      { header: 'Tank', key: 'tankName', width: 20, value: (i: typeof insights[number]) => i.tankName || 'All tanks' },
      { header: 'Title', key: 'title', width: 26, value: (i: typeof insights[number]) => i.title },
      { header: 'What Happened', key: 'what', width: 40, value: (i: typeof insights[number]) => i.what },
      { header: 'Why It Matters', key: 'why', width: 40, value: (i: typeof insights[number]) => i.why },
      { header: 'Suggested Action', key: 'action', width: 40, value: (i: typeof insights[number]) => i.action },
    ],
    insights,
    'Not enough historical data to generate reliable insights yet.'
  );

  return wb;
}

export async function exportTankSyncWorkbook(data: ExportSource): Promise<void> {
  const wb = await buildTankSyncWorkbook(data);
  const buffer = await wb.xlsx.writeBuffer();
  const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `TankSync_Report_${Date.now()}.xlsx`;
  a.click();
  URL.revokeObjectURL(url);
}
