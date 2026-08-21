import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/useAuth';
import { useRoleGuard } from '../../hooks/useRoleGuard';
import type { AuditLogEntry, AuditModule } from '../../types/audit';
import { exportAuditLogsToCSV, exportAuditLogsToPDFReport } from '../../utils/auditExport';
import {
  FileText,
  Search,
  Filter,
  RefreshCw,
  ShieldAlert,
  ChevronDown,
  ChevronRight,
  Clock,
  User,
  Activity,
  Download,
  FileSpreadsheet,
  FileType,
} from 'lucide-react';

const MODULE_BADGES: Record<AuditModule, { label: string; color: string }> = {
  admin: { label: 'Admin & Auth', color: 'bg-purple-950/80 text-purple-300 border-purple-500/30' },
  auth: { label: 'Security', color: 'bg-red-950/80 text-red-300 border-red-500/30' },
  pos: { label: 'Retail POS', color: 'bg-emerald-950/80 text-emerald-300 border-emerald-500/30' },
  pharmacy: { label: 'Pharmacy', color: 'bg-teal-950/80 text-teal-300 border-teal-500/30' },
  susu: { label: 'Susu / Finance', color: 'bg-amber-950/80 text-amber-300 border-amber-500/30' },
  water: { label: 'Water Dist.', color: 'bg-cyan-950/80 text-cyan-300 border-cyan-500/30' },
  inventory: { label: 'Inventory', color: 'bg-blue-950/80 text-blue-300 border-blue-500/30' },
  school: { label: 'School', color: 'bg-violet-950/80 text-violet-300 border-violet-500/30' },
  clinic: { label: 'Clinic', color: 'bg-rose-950/80 text-rose-300 border-rose-500/30' },
  electrical: { label: 'Electrical', color: 'bg-amber-950/80 text-amber-300 border-amber-500/30' },
};

export const AuditTrail: React.FC = () => {
  const { organization } = useAuth();
  const { isAuthorized } = useRoleGuard(['admin', 'manager']);

  const [logs, setLogs] = useState<AuditLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedModule, setSelectedModule] = useState<string>('all');
  const [expandedLogId, setExpandedLogId] = useState<string | null>(null);
  const [showExportMenu, setShowExportMenu] = useState(false);

  const fetchAuditLogs = useCallback(async () => {
    if (!organization) return;
    setLoading(true);

    let query = supabase
      .from('audit_logs')
      .select('*')
      .eq('org_id', organization.id)
      .order('created_at', { ascending: false })
      .limit(200);

    if (selectedModule !== 'all') {
      query = query.eq('module', selectedModule);
    }

    const { data, error } = await query;

    if (!error && data) {
      setLogs(data as AuditLogEntry[]);
    }
    setLoading(false);
  }, [organization, selectedModule]);

  useEffect(() => {
    fetchAuditLogs();

    const channel = supabase
      .channel('realtime-audit-logs')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'audit_logs' },
        (payload: any) => {
          if (payload.new.org_id === organization?.id) {
            setLogs((prev) => [payload.new as AuditLogEntry, ...prev]);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [organization, selectedModule, fetchAuditLogs]);

  if (!isAuthorized) {
    return (
      <div className="flex h-full flex-col items-center justify-center p-8 text-center text-slate-100">
        <ShieldAlert className="h-16 w-16 text-red-500 mb-4" />
        <h2 className="text-xl font-bold">Access Restricted</h2>
        <p className="text-xs text-slate-400 mt-1 max-w-sm">
          You must have Administrator or Manager privileges to view the system audit trail.
        </p>
      </div>
    );
  }

  const filteredLogs = logs.filter(
    (log) =>
      log.action.toLowerCase().includes(searchTerm.toLowerCase()) ||
      log.actor_email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      log.target_resource?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      JSON.stringify(log.details || {}).toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleExportCSV = () => {
    const timestamp = new Date().toISOString().split('T')[0];
    exportAuditLogsToCSV(filteredLogs, `security_audit_${organization?.name || 'org'}_${timestamp}.csv`);
    setShowExportMenu(false);
  };

  const handleExportPDF = () => {
    exportAuditLogsToPDFReport(
      filteredLogs,
      organization?.name || 'Organization Security Operations',
      selectedModule
    );
    setShowExportMenu(false);
  };

  return (
    <div className="flex flex-col h-full bg-slate-950 p-6 text-slate-100">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800 pb-4 mb-6">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <FileText className="h-6 w-6 text-cyan-400" />
            System Audit Trail & Security Log
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Real-time immutable log of system access, role adjustments, and critical operational events
          </p>
        </div>

        <div className="flex items-center gap-2">
          {/* Export Dropdown Menu */}
          <div className="relative">
            <button
              onClick={() => setShowExportMenu((prev) => !prev)}
              className="flex items-center gap-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 px-4 py-2.5 text-xs font-semibold text-white shadow-lg shadow-cyan-950/50 transition-all"
            >
              <Download className="h-4 w-4" /> Export Report <ChevronDown className="h-3.5 w-3.5" />
            </button>

            {showExportMenu && (
              <div className="absolute right-0 mt-2 w-48 rounded-xl border border-slate-800 bg-slate-900 shadow-2xl z-50 py-1">
                <button
                  onClick={handleExportCSV}
                  className="w-full flex items-center gap-2 px-4 py-2 text-xs text-slate-200 hover:bg-slate-800 text-left"
                >
                  <FileSpreadsheet className="h-4 w-4 text-emerald-400" /> Export as CSV
                </button>
                <button
                  onClick={handleExportPDF}
                  className="w-full flex items-center gap-2 px-4 py-2 text-xs text-slate-200 hover:bg-slate-800 text-left"
                >
                  <FileType className="h-4 w-4 text-rose-400" /> Generate PDF Report
                </button>
              </div>
            )}
          </div>

          <button
            onClick={fetchAuditLogs}
            className="flex items-center gap-2 rounded-xl bg-slate-900 border border-slate-800 px-4 py-2.5 text-xs font-semibold text-slate-300 hover:bg-slate-800"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} /> Refresh
          </button>
        </div>
      </div>

      {/* Filters Bar */}
      <div className="flex flex-col md:flex-row gap-3 mb-6">
        <div className="relative flex-1">
          <Search className="absolute left-3.5 top-3 h-4 w-4 text-slate-500" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search by action, staff email, resource, or metadata..."
            className="w-full rounded-xl border border-slate-800 bg-slate-900 pl-10 pr-4 py-2.5 text-xs text-white placeholder-slate-500 focus:border-cyan-500 focus:outline-none"
          />
        </div>

        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4 text-slate-500 shrink-0" />
          <select
            value={selectedModule}
            onChange={(e) => setSelectedModule(e.target.value)}
            className="rounded-xl border border-slate-800 bg-slate-900 px-3 py-2.5 text-xs text-white focus:border-cyan-500 focus:outline-none"
          >
            <option value="all">All Modules</option>
            <option value="admin">Admin & Auth</option>
            <option value="pos">Retail POS</option>
            <option value="pharmacy">Pharmacy</option>
            <option value="susu">Susu / Finance</option>
            <option value="water">Water Distribution</option>
            <option value="inventory">Inventory</option>
          </select>
        </div>
      </div>

      {/* Audit Log Table */}
      <div className="overflow-x-auto rounded-2xl border border-slate-800 bg-slate-900 shadow-xl">
        <table className="w-full text-left text-xs">
          <thead className="border-b border-slate-800 bg-slate-950/50 uppercase text-slate-400">
            <tr>
              <th className="w-8 px-4 py-3.5"></th>
              <th className="px-4 py-3.5">Timestamp</th>
              <th className="px-4 py-3.5">Actor</th>
              <th className="px-4 py-3.5">Module</th>
              <th className="px-4 py-3.5">Action Event</th>
              <th className="px-4 py-3.5">Target Resource</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800 text-slate-200">
            {filteredLogs.length === 0 ? (
              <tr>
                <td colSpan={6} className="py-8 text-center text-slate-500">
                  {loading ? 'Fetching security records...' : 'No audit entries match the criteria.'}
                </td>
              </tr>
            ) : (
              filteredLogs.map((log) => {
                const isExpanded = expandedLogId === log.id;
                const moduleBadge = MODULE_BADGES[log.module] || {
                  label: log.module,
                  color: 'bg-slate-800 text-slate-300',
                };

                return (
                  <React.Fragment key={log.id}>
                    <tr
                      onClick={() => setExpandedLogId(isExpanded ? null : log.id)}
                      className="hover:bg-slate-800/40 cursor-pointer transition-colors"
                    >
                      <td className="px-4 py-3.5 text-slate-500">
                        {isExpanded ? (
                          <ChevronDown className="h-4 w-4 text-cyan-400" />
                        ) : (
                          <ChevronRight className="h-4 w-4" />
                        )}
                      </td>
                      <td className="px-4 py-3.5 whitespace-nowrap text-slate-400 font-mono text-[11px]">
                        <div className="flex items-center gap-1.5">
                          <Clock className="h-3 w-3 text-slate-500 shrink-0" />
                          {new Date(log.created_at).toLocaleString()}
                        </div>
                      </td>
                      <td className="px-4 py-3.5">
                        <div className="font-semibold text-white flex items-center gap-1.5">
                          <User className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                          {log.actor_email || 'System Action'}
                        </div>
                        {log.actor_role && (
                          <span className="text-[10px] text-slate-500 uppercase font-mono">
                            [{log.actor_role}]
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3.5">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded-md border text-[10px] font-bold ${moduleBadge.color}`}
                        >
                          {moduleBadge.label}
                        </span>
                      </td>
                      <td className="px-4 py-3.5 font-mono text-cyan-300 font-bold">
                        {log.action}
                      </td>
                      <td className="px-4 py-3.5 text-slate-400 font-mono text-[11px]">
                        {log.target_resource || '—'}
                      </td>
                    </tr>

                    {/* Expandable JSON Metadata View */}
                    {isExpanded && (
                      <tr className="bg-slate-950/80">
                        <td colSpan={6} className="px-6 py-4">
                          <div className="rounded-xl border border-slate-800 bg-slate-900/90 p-4 text-xs font-mono">
                            <div className="flex items-center justify-between text-slate-400 text-[11px] mb-2 border-b border-slate-800 pb-2">
                              <span className="flex items-center gap-1">
                                <Activity className="h-3.5 w-3.5 text-cyan-400" /> Event Payload Metadata
                              </span>
                              <span>Log ID: {log.id}</span>
                            </div>
                            <pre className="text-emerald-400 overflow-x-auto text-[11px]">
                              {JSON.stringify(log.details || {}, null, 2)}
                            </pre>
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};