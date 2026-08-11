import type { AuditLogEntry } from '../types/audit';

/**
 * Generates and triggers download of a CSV file containing audit entries.
 */
export const exportAuditLogsToCSV = (logs: AuditLogEntry[], filename = 'audit_security_log.csv') => {
  if (!logs || logs.length === 0) return;

  const headers = [
    'Log ID',
    'Timestamp (UTC)',
    'Actor Email',
    'Actor Role',
    'Module',
    'Action Event',
    'Target Resource',
    'Details (JSON)',
  ];

  const escapeCSV = (val: string | number | undefined | null) => {
    if (val === undefined || val === null) return '""';
    const str = String(val).replace(/"/g, '""');
    return `"${str}"`;
  };

  const rows = logs.map((log) => [
    escapeCSV(log.id),
    escapeCSV(new Date(log.created_at).toISOString()),
    escapeCSV(log.actor_email || 'System Action'),
    escapeCSV(log.actor_role || 'N/A'),
    escapeCSV(log.module),
    escapeCSV(log.action),
    escapeCSV(log.target_resource || 'N/A'),
    escapeCSV(JSON.stringify(log.details || {})),
  ]);

  const csvContent = [headers.join(','), ...rows.map((row) => row.join(','))].join('\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};

/**
 * Opens a print-optimized security audit report window for saving directly as PDF.
 */
export const exportAuditLogsToPDFReport = (
  logs: AuditLogEntry[],
  orgName: string = 'Organization',
  actorFilter: string = 'All'
) => {
  const printWindow = window.open('', '_blank');
  if (!printWindow) {
    alert('Please allow popups to view and export the PDF report.');
    return;
  }

  const generatedAt = new Date().toLocaleString();
  const totalEvents = logs.length;
  const uniqueActors = new Set(logs.map((l) => l.actor_email || 'System')).size;

  const reportHTML = `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <title>Security Audit Report - ${orgName}</title>
      <style>
        @page { size: A4 landscape; margin: 12mm; }
        body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; color: #0f172a; margin: 0; padding: 20px; font-size: 11px; }
        .header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #0f172a; padding-bottom: 12px; margin-bottom: 16px; }
        .title { font-size: 20px; font-weight: 800; color: #0f172a; text-transform: uppercase; letter-spacing: 0.5px; }
        .subtitle { font-size: 11px; color: #64748b; margin-top: 4px; }
        .meta-box { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; padding: 10px 14px; margin-bottom: 16px; display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; }
        .meta-item { display: flex; flex-direction: column; }
        .meta-label { font-size: 9px; text-transform: uppercase; color: #64748b; font-weight: 700; margin-bottom: 2px; }
        .meta-value { font-size: 12px; font-weight: 700; color: #0f172a; font-family: monospace; }
        table { width: 100%; border-collapse: collapse; margin-top: 8px; }
        th { background: #1e293b; color: #ffffff; font-size: 9px; font-weight: 700; text-transform: uppercase; text-align: left; padding: 8px 10px; }
        td { border-bottom: 1px solid #e2e8f0; padding: 8px 10px; vertical-align: top; font-size: 10px; }
        tr:nth-child(even) { background-color: #f8fafc; }
        .badge { display: inline-block; padding: 2px 6px; border-radius: 4px; font-size: 9px; font-weight: 700; font-family: monospace; background: #e2e8f0; color: #334155; }
        .action { font-family: monospace; font-weight: 700; color: #0369a1; }
        .details { font-family: monospace; font-size: 9px; color: #475569; word-break: break-all; white-space: pre-wrap; }
        .footer { margin-top: 24px; text-align: center; font-size: 9px; color: #94a3b8; border-top: 1px solid #e2e8f0; padding-top: 8px; }
        @media print {
          body { padding: 0; }
          .no-print { display: none; }
        }
      </style>
    </head>
    <body>
      <div class="header">
        <div>
          <div class="title">Security & Operational Audit Report</div>
          <div class="subtitle">${orgName} — System Security Log</div>
        </div>
        <div style="text-align: right;">
          <div style="font-weight: bold; color: #0f172a;">CONFIDENTIAL</div>
          <div class="subtitle">Generated: ${generatedAt}</div>
        </div>
      </div>

      <div class="meta-box">
        <div class="meta-item">
          <span class="meta-label">Total Audit Events</span>
          <span class="meta-value">${totalEvents}</span>
        </div>
        <div class="meta-item">
          <span class="meta-label">Unique Actors</span>
          <span class="meta-value">${uniqueActors}</span>
        </div>
        <div class="meta-item">
          <span class="meta-label">Module Filter</span>
          <span class="meta-value">${actorFilter.toUpperCase()}</span>
        </div>
        <div class="meta-item">
          <span class="meta-label">Report ID</span>
          <span class="meta-value">SEC-${Date.now().toString(36).toUpperCase()}</span>
        </div>
      </div>

      <table>
        <thead>
          <tr>
            <th style="width: 140px;">Timestamp</th>
            <th style="width: 180px;">Actor</th>
            <th style="width: 80px;">Module</th>
            <th style="width: 160px;">Action</th>
            <th style="width: 120px;">Target Resource</th>
            <th>Metadata Payload</th>
          </tr>
        </thead>
        <tbody>
          ${logs
            .map(
              (log) => `
            <tr>
              <td style="font-family: monospace; font-size: 9px;">${new Date(log.created_at).toLocaleString()}</td>
              <td>
                <strong>${log.actor_email || 'System'}</strong><br/>
                <span style="font-size: 8px; color: #64748b;">[${log.actor_role || 'system'}]</span>
              </td>
              <td><span class="badge">${log.module.toUpperCase()}</span></td>
              <td class="action">${log.action}</td>
              <td style="font-family: monospace; font-size: 9px;">${log.target_resource || '—'}</td>
              <td class="details">${JSON.stringify(log.details || {})}</td>
            </tr>
          `
            )
            .join('')}
        </tbody>
      </table>

      <div class="footer">
        This document contains sensitive security audit records for internal compliance and auditing purposes.
      </div>

      <script>
        window.onload = function() {
          window.print();
        };
      </script>
    </body>
    </html>
  `;

  printWindow.document.write(reportHTML);
  printWindow.document.close();
};