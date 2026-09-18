import { useState, useMemo, useEffect, memo } from 'react';
import {
  useReactTable, getCoreRowModel, getSortedRowModel, getFilteredRowModel,
  getPaginationRowModel, createColumnHelper, flexRender, SortingState,
} from '@tanstack/react-table';
import { Search, ChevronUp, ChevronDown, ChevronLeft, ChevronRight, Download, FileSpreadsheet, FileText, Printer, Loader2, Check } from 'lucide-react';
import { getFirebaseDb } from '../lib/firebase';
import { ref, get, limitToLast, query } from 'firebase/database';
import type { TankHistory } from '../types';
import { formatDate, formatTime, formatNumber, cn, sanitizeForSpreadsheet } from '../lib/utils';
import { useStore } from '../store/useStore';
import { useFirebaseConfig } from '../context/FirebaseContext';
import { normalizeSensorHistoryPayload } from '../lib/sensorAdapter';
import { FIREBASE_PATHS } from '../constants/firebasePaths';

function Reports() {
  const [data, setData] = useState<TankHistory[]>([]);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [exportSuccess, setExportSuccess] = useState(false);
  const [exportScope, setExportScope] = useState<'filtered' | 'all'>('all');
  const [sorting, setSorting] = useState<SortingState>([{ id: 'timestamp', desc: true }]);
  const [globalFilter, setGlobalFilter] = useState('');
  const { tanks, notifications, auditLogs, pumpLogs } = useStore();
  const { projectName } = useFirebaseConfig();

  useEffect(() => {
    (async () => {
      const database = getFirebaseDb();
      if (!database) { setLoading(false); return; }
      const snap = await get(query(ref(database, FIREBASE_PATHS.history), limitToLast(500)));
      const val = snap.val() as Record<string, unknown> | null;
      if (val) {
        const rows = Object.entries(val).map(([id, r]) => normalizeSensorHistoryPayload(r as Record<string, unknown>, id));
        rows.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
        setData(rows);
      }
      setLoading(false);
    })();
  }, []);

  const ch = createColumnHelper<TankHistory>();

  const columns = useMemo(() => [
    ch.accessor('timestamp', {
      header: 'Date / Time',
      cell: (info) => (
        <div>
          <div className="font-medium text-neutral-900 dark:text-neutral-100">{formatDate(info.getValue())}</div>
          <div className="text-xs text-neutral-500 dark:text-neutral-400">{formatTime(info.getValue())}</div>
        </div>
      ),
    }),
    ch.accessor('property', { header: 'Property', cell: (info) => info.getValue() }),
    ch.accessor('name', { header: 'Tank', cell: (info) => info.getValue() }),
    ch.accessor('capacity', { header: 'Capacity', cell: (info) => `${info.getValue()} L` }),
    ch.accessor('currentWater', { header: 'Current Water', cell: (info) => `${info.getValue()} L` }),
    ch.accessor('waterLevel', {
      header: '%',
      cell: (info) => {
        const v = info.getValue();
        return <span className={cn('font-semibold', v >= 75 ? 'text-success-600' : v >= 40 ? 'text-warning-500' : 'text-error-500')}>{v}%</span>;
      },
    }),
    ch.accessor('pumpStatus', {
      header: 'Pump',
      cell: (info) => <span className={cn('badge', info.getValue() === 'ON' ? 'badge-success' : 'badge-info')}>{info.getValue()}</span>,
    }),
    ch.accessor('battery', { header: 'Battery', cell: (info) => `${info.getValue()}%` }),
    ch.accessor('signal', { header: 'Signal', cell: (info) => `${info.getValue()}%` }),
    ch.accessor('temperature', { header: 'Temp', cell: (info) => `${info.getValue()}°C` }),
    ch.accessor('ph', { header: 'pH', cell: (info) => { const v = info.getValue(); return v !== null ? v.toFixed(1) : 'N/A'; } }),
    ch.accessor('humidity', { header: 'Humidity', cell: (info) => `${info.getValue()}%` }),
    ch.accessor('flowRate', { header: 'Flow', cell: (info) => `${info.getValue()} L/min` }),
    ch.accessor('leak', { header: 'Leak', cell: (info) => (info.getValue() ? <span className="badge-error">Yes</span> : 'No') }),
    ch.accessor('overflow', { header: 'Overflow', cell: (info) => (info.getValue() ? <span className="badge-warning">Yes</span> : 'No') }),
    ch.accessor('dryRun', { header: 'Dry Run', cell: (info) => (info.getValue() ? <span className="badge-error">Yes</span> : 'No') }),
    ch.accessor('sensorHealth', { header: 'Sensor', cell: (info) => info.getValue() }),
    ch.accessor('remarks', { header: 'Remarks', cell: (info) => <span className="text-neutral-600 dark:text-neutral-400 text-sm">{info.getValue()}</span> }),
    ch.accessor('updatedBy', { header: 'Updated By', cell: (info) => info.getValue() }),
    ch.accessor('source', {
      header: 'Source',
      cell: (info) => <span className={cn('badge', info.getValue() === 'Admin' ? 'badge-info' : info.getValue() === 'API' ? 'badge-success' : 'badge-warning')}>{info.getValue()}</span>,
    }),
  ], []);

  const table = useReactTable({
    data,
    columns,
    state: { sorting, globalFilter },
    onSortingChange: setSorting,
    onGlobalFilterChange: setGlobalFilter,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    initialState: { pagination: { pageSize: 10 } },
  });

  const csvEsc = (s: string | number | boolean) => {
    const str = String(sanitizeForSpreadsheet(s));
    if (str.includes(',') || str.includes('"') || str.includes('\n')) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  };

  const exportRows = useMemo(
    () => (exportScope === 'all' ? data : table.getFilteredRowModel().rows.map((r) => r.original)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [exportScope, data, globalFilter, sorting]
  );

  const exportCSV = () => {
    const rows = exportRows;
    const headers = ['Date', 'Time', 'Property', 'Tank', 'Capacity', 'Current Water', 'Percentage', 'Pump', 'Battery', 'Signal', 'Temperature', 'pH', 'Humidity', 'Flow Rate', 'Leak', 'Overflow', 'Dry Run', 'Sensor Health', 'Remarks', 'Updated By', 'Source'];
    const csv = [
      headers.join(','),
      ...rows.map((r) => [
        csvEsc(formatDate(r.timestamp)), csvEsc(formatTime(r.timestamp)), csvEsc(r.property), csvEsc(r.name),
        csvEsc(r.capacity), csvEsc(r.currentWater), csvEsc(r.waterLevel), csvEsc(r.pumpStatus),
        csvEsc(r.battery), csvEsc(r.signal), csvEsc(r.temperature), csvEsc(r.ph !== null ? r.ph : ''), csvEsc(r.humidity), csvEsc(r.flowRate),
        csvEsc(r.leak), csvEsc(r.overflow), csvEsc(r.dryRun), csvEsc(r.sensorHealth),
        csvEsc(r.remarks), csvEsc(r.updatedBy), csvEsc(r.source),
      ].join(',')),
    ].join('\n');
    // UTF-8 BOM so Excel renders °, — and other non-ASCII characters correctly
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `tanksync-readings-${exportScope}-${Date.now()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const exportExcel = async () => {
    setExporting(true);
    setExportSuccess(false);
    try {
      const { exportTankSyncWorkbook } = await import('../lib/excelExport');
      await exportTankSyncWorkbook({
        tanks, history: exportRows, notifications, auditLogs, pumpLogs, projectName,
      });
      setExportSuccess(true);
      setTimeout(() => setExportSuccess(false), 2000);
    } finally {
      setExporting(false);
    }
  };

  const exportPDF = () => {
    const rows = exportRows;
    const win = window.open('', '_blank');
    if (!win) return;
    const esc = (s: string | number | boolean) =>
      String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

    const activeAlerts = notifications.filter((n) => !n.isRead).slice(0, 10);
    const tankAverages = tanks.map((t) => ({ name: t.name, level: t.waterLevel }));

    win.document.write(`
      <html><head><title>TankSync Report</title>
      <style>
        body { font-family: sans-serif; padding: 24px; color: #1e293b; }
        h1 { color: #1e40af; margin-bottom: 2px; } h2 { color: #64748b; font-size: 14px; margin-top: 0; font-weight: 500; }
        h3 { color: #1e293b; font-size: 15px; margin: 24px 0 8px; border-bottom: 2px solid #e2e8f0; padding-bottom: 4px; }
        table { width: 100%; border-collapse: collapse; margin-top: 8px; font-size: 11px; }
        th { background: #1e40af; color: white; padding: 8px; text-align: left; }
        td { padding: 6px; border-bottom: 1px solid #e2e8f0; }
        tr:nth-child(even) { background: #f8fafc; }
        .header { display: flex; justify-content: space-between; align-items: center; border-bottom: 3px solid #1e40af; padding-bottom: 12px; }
        .meta { color: #94a3b8; font-size: 12px; text-align: right; }
        .summary-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; margin-top: 12px; }
        .summary-card { border: 1px solid #e2e8f0; border-radius: 8px; padding: 10px 12px; }
        .summary-card .label { font-size: 10px; color: #94a3b8; text-transform: uppercase; }
        .summary-card .value { font-size: 18px; font-weight: 700; color: #1e293b; }
        .bar-row { display: flex; align-items: center; gap: 8px; margin: 6px 0; font-size: 11px; }
        .bar-label { width: 140px; flex-shrink: 0; }
        .bar-track { flex: 1; background: #f1f5f9; border-radius: 4px; height: 14px; overflow: hidden; }
        .bar-fill { height: 100%; border-radius: 4px; }
        .alert-row { padding: 6px 0; border-bottom: 1px solid #f1f5f9; font-size: 11px; }
        .badge { display: inline-block; padding: 1px 6px; border-radius: 4px; font-size: 9px; font-weight: 700; margin-right: 6px; }
        .badge-critical { background: #fee2e2; color: #991b1b; } .badge-warning { background: #fef3c7; color: #92400e; } .badge-info { background: #dbeafe; color: #1e40af; }
        @media print { .no-print { display: none; } }
      </style></head><body>
      <div class="header">
        <div><h1>TankSync — Tank Report</h1><h2>Smart Water Management System</h2></div>
        <div class="meta">
          Generated: ${esc(formatDateTime(new Date()))}<br/>
          Scope: ${esc(exportScope === 'all' ? 'All available data' : 'Current filtered view')} · ${esc(String(rows.length))} record${rows.length === 1 ? '' : 's'}
          ${globalFilter && exportScope === 'filtered' ? `<br/>Filter: "${esc(globalFilter)}"` : ''}
        </div>
      </div>

      ${summary ? `
      <h3>Summary</h3>
      <div class="summary-grid">
        <div class="summary-card"><div class="label">Records in Report</div><div class="value">${esc(rows.length)}</div></div>
        <div class="summary-card"><div class="label">Tanks / Properties</div><div class="value">${esc(summary.tanks)} / ${esc(summary.properties)}</div></div>
        <div class="summary-card"><div class="label">Avg Water Level</div><div class="value">${esc(summary.avgLevel)}%</div></div>
        <div class="summary-card"><div class="label">Alerts (leak/overflow/dry-run)</div><div class="value">${esc(summary.leakCount + summary.overflowCount + summary.dryRunCount)}</div></div>
      </div>` : ''}

      ${tankAverages.length > 0 ? `
      <h3>Current Water Level by Tank</h3>
      ${tankAverages.map((t) => `
        <div class="bar-row">
          <div class="bar-label">${esc(t.name)}</div>
          <div class="bar-track"><div class="bar-fill" style="width:${Math.max(0, Math.min(100, t.level))}%; background:${t.level <= 20 ? '#ef4444' : t.level <= 40 ? '#f59e0b' : '#22c55e'}"></div></div>
          <div style="width:36px; text-align:right;">${esc(t.level)}%</div>
        </div>`).join('')}
      ` : ''}

      ${activeAlerts.length > 0 ? `
      <h3>Active Alerts (${activeAlerts.length})</h3>
      ${activeAlerts.map((n) => `
        <div class="alert-row">
          <span class="badge ${n.type === 'error' ? 'badge-critical' : n.type === 'warning' ? 'badge-warning' : 'badge-info'}">${esc(n.type.toUpperCase())}</span>
          <strong>${esc(n.title)}</strong> — ${esc(n.message)} <span style="color:#94a3b8;">(${esc(formatDateTime(n.timestamp))})</span>
        </div>`).join('')}
      ` : '<h3>Active Alerts</h3><p style="color:#94a3b8; font-size:12px;">No active alerts.</p>'}

      <h3>Readings (${rows.length})</h3>
      <table><tr>
        <th>Date</th><th>Time</th><th>Property</th><th>Tank</th><th>Capacity</th><th>Water</th><th>%</th><th>Pump</th><th>Battery</th><th>Signal</th><th>Temp</th><th>pH</th><th>Source</th>
      </tr>
      ${rows.map((r) => `<tr>
        <td>${esc(formatDate(r.timestamp))}</td><td>${esc(formatTime(r.timestamp))}</td>
        <td>${esc(r.property)}</td><td>${esc(r.name)}</td><td>${esc(r.capacity)}L</td>
        <td>${esc(r.currentWater)}L</td><td>${esc(r.waterLevel)}%</td>
        <td>${esc(r.pumpStatus)}</td><td>${esc(r.battery)}%</td>
        <td>${esc(r.signal)}%</td><td>${esc(r.temperature)}C</td><td>${esc(r.ph !== null ? r.ph.toFixed(1) : 'N/A')}</td><td>${esc(r.source)}</td>
      </tr>`).join('')}
      </table></body></html>
    `);
    win.document.close();
    setTimeout(() => win.print(), 500);
  };

  const summary = useMemo(() => {
    if (data.length === 0) return null;
    const tanks = new Set(data.map((r) => r.name));
    const properties = new Set(data.map((r) => r.property));
    const leakCount = data.filter((r) => r.leak).length;
    const overflowCount = data.filter((r) => r.overflow).length;
    const dryRunCount = data.filter((r) => r.dryRun).length;
    const pumpOnCount = data.filter((r) => r.pumpStatus === 'ON').length;
    const avgLevel = Math.round(data.reduce((s, r) => s + r.waterLevel, 0) / data.length);
    const totalCapacity = data.reduce((s, r) => s + r.capacity, 0);
    const totalWater = data.reduce((s, r) => s + r.currentWater, 0);
    const dateRange = data.length > 0
      ? `${formatDate(data[data.length - 1].timestamp)} – ${formatDate(data[0].timestamp)}`
      : '';
    return { tanks: tanks.size, properties: properties.size, leakCount, overflowCount, dryRunCount, pumpOnCount, avgLevel, totalCapacity, totalWater, dateRange };
  }, [data]);

  return (
    <div className="space-y-6">
      {summary && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="card">
            <p className="text-xs text-neutral-500 dark:text-neutral-400">Records</p>
            <p className="text-2xl font-bold text-neutral-900 dark:text-neutral-100 mt-1">{data.length}</p>
            <p className="text-xs text-neutral-400 mt-1">{summary.dateRange}</p>
          </div>
          <div className="card">
            <p className="text-xs text-neutral-500 dark:text-neutral-400">Tanks / Properties</p>
            <p className="text-2xl font-bold text-neutral-900 dark:text-neutral-100 mt-1">{summary.tanks} / {summary.properties}</p>
            <p className="text-xs text-neutral-400 mt-1">Avg level: {summary.avgLevel}%</p>
          </div>
          <div className="card">
            <p className="text-xs text-neutral-500 dark:text-neutral-400">Total Water</p>
            <p className="text-2xl font-bold text-neutral-900 dark:text-neutral-100 mt-1">{formatNumber(summary.totalWater)} L</p>
            <p className="text-xs text-neutral-400 mt-1">Capacity: {formatNumber(summary.totalCapacity)} L</p>
          </div>
          <div className="card">
            <p className="text-xs text-neutral-500 dark:text-neutral-400">Alerts</p>
            <p className="text-2xl font-bold text-neutral-900 dark:text-neutral-100 mt-1">
              {summary.leakCount + summary.overflowCount + summary.dryRunCount}
            </p>
            <p className="text-xs text-neutral-400 mt-1">
              {summary.leakCount} leaks · {summary.overflowCount} overflow · {summary.dryRunCount} dry run
            </p>
          </div>
        </div>
      )}

      <div className="card">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-4">
          <div>
            <h3 className="text-lg font-bold text-neutral-900 dark:text-neutral-100">Tank Reports</h3>
            <p className="text-sm text-neutral-500 dark:text-neutral-400">{data.length} records available</p>
          </div>
          <div className="flex flex-col items-start sm:items-end gap-2">
            <div className="flex items-center gap-2 text-xs">
              <span className="text-neutral-500 dark:text-neutral-400">Export scope:</span>
              <div className="flex rounded-lg border border-neutral-200 dark:border-neutral-700 overflow-hidden">
                <button
                  onClick={() => setExportScope('filtered')}
                  className={cn('px-2.5 py-1', exportScope === 'filtered' ? 'bg-primary-600 text-white' : 'bg-transparent text-neutral-500 dark:text-neutral-400')}
                >
                  Current View
                </button>
                <button
                  onClick={() => setExportScope('all')}
                  className={cn('px-2.5 py-1', exportScope === 'all' ? 'bg-primary-600 text-white' : 'bg-transparent text-neutral-500 dark:text-neutral-400')}
                >
                  All Data
                </button>
              </div>
            </div>
            <div className="flex gap-2 flex-wrap">
              <button onClick={exportExcel} disabled={exporting} className="btn-success disabled:opacity-60">
                {exporting ? <Loader2 className="w-4 h-4 animate-spin" /> : exportSuccess ? <Check className="w-4 h-4" /> : <FileSpreadsheet className="w-4 h-4" />}
                {exporting ? 'Generating…' : exportSuccess ? 'Done' : 'Excel'}
              </button>
              <button onClick={exportCSV} className="btn-secondary"><Download className="w-4 h-4" /> CSV</button>
              <button onClick={exportPDF} className="btn-secondary"><FileText className="w-4 h-4" /> PDF</button>
              <button onClick={exportPDF} className="btn-secondary"><Printer className="w-4 h-4" /> Print</button>
            </div>
          </div>
        </div>

        <div className="mb-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400" />
            <input className="input pl-10" placeholder="Search by property, tank, source, remarks..." value={globalFilter} onChange={(e) => setGlobalFilter(e.target.value)} />
          </div>
        </div>

        <div className="overflow-x-auto rounded-xl border border-neutral-200 dark:border-neutral-800">
          <table className="w-full text-sm">
            <thead className="bg-neutral-50 dark:bg-neutral-800/50">
              {table.getHeaderGroups().map((hg) => (
                <tr key={hg.id}>
                  {hg.headers.map((header) => (
                    <th key={header.id} onClick={header.column.getToggleSortingHandler()} className="px-3 py-3 text-left font-semibold text-neutral-700 dark:text-neutral-300 cursor-pointer select-none whitespace-nowrap hover:bg-neutral-100 dark:hover:bg-neutral-800">
                      <div className="flex items-center gap-1">
                        {flexRender(header.column.columnDef.header, header.getContext())}
                        {header.column.getIsSorted() === 'asc' && <ChevronUp className="w-3 h-3" />}
                        {header.column.getIsSorted() === 'desc' && <ChevronDown className="w-3 h-3" />}
                      </div>
                    </th>
                  ))}
                </tr>
              ))}
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={columns.length} className="text-center py-12 text-neutral-400 dark:text-neutral-500">Loading...</td></tr>
              ) : table.getRowModel().rows.length === 0 ? (
                <tr><td colSpan={columns.length} className="text-center py-12 text-neutral-400 dark:text-neutral-500">No records found</td></tr>
              ) : (
                table.getRowModel().rows.map((row) => (
                  <tr key={row.id} className="border-t border-neutral-100 dark:border-neutral-800 hover:bg-neutral-50 dark:hover:bg-neutral-800/30">
                    {row.getVisibleCells().map((cell) => (
                      <td key={cell.id} className="px-3 py-2.5 whitespace-nowrap">{flexRender(cell.column.columnDef.cell, cell.getContext())}</td>
                    ))}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="flex items-center justify-between mt-4">
          <div className="flex items-center gap-2">
            <button onClick={() => table.previousPage()} disabled={!table.getCanPreviousPage()} aria-label="Previous page" className="btn-secondary p-2"><ChevronLeft className="w-4 h-4" /></button>
            <span className="text-sm text-neutral-600 dark:text-neutral-400">Page {table.getState().pagination.pageIndex + 1} of {table.getPageCount() || 1}</span>
            <button onClick={() => table.nextPage()} disabled={!table.getCanNextPage()} aria-label="Next page" className="btn-secondary p-2"><ChevronRight className="w-4 h-4" /></button>
          </div>
          <select className="input w-auto" value={table.getState().pagination.pageSize} onChange={(e) => table.setPageSize(Number(e.target.value))}>
            {[10, 25, 50, 100].map((s) => <option key={s} value={s}>{s} per page</option>)}
          </select>
        </div>
      </div>
    </div>
  );
}

function formatDateTime(d: Date | number) {
  const date = typeof d === 'number' ? new Date(d) : d;
  return `${formatDate(date)} ${formatTime(date)}`;
}

export default memo(Reports);
