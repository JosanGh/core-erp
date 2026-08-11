import { supabase } from './supabase';
import type { AuditModule } from '../types/audit';

interface LogAuditParams {
  orgId: string;
  module: AuditModule;
  action: string;
  targetResource?: string;
  details?: Record<string, any>;
}

export const logAuditEvent = async ({
  orgId,
  module,
  action,
  targetResource,
  details = {},
}: LogAuditParams): Promise<void> => {
  try {
    const { error } = await supabase.rpc('log_audit_event', {
      p_org_id: orgId,
      p_module: module,
      p_action: action,
      p_target_resource: targetResource || null,
      p_details: details,
    });

    if (error) {
      console.error('Audit log registration failed:', error.message);
    }
  } catch (err) {
    console.error('Audit logging error:', err);
  }
};