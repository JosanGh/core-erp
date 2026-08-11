export interface SusuAccount {
    id: string;
    org_id: string;
    account_number: string;
    customer_name: string;
    customer_phone: string;
    collector_id?: string;
    daily_target_amount: number;
    current_balance: number;
    status: 'active' | 'suspended' | 'closed';
    created_at: string;
  }
  
  export interface SusuLedgerEntry {
    id: string;
    org_id: string;
    account_id: string;
    collector_id: string;
    transaction_type: 'deposit' | 'withdrawal' | 'collector_fee' | 'interest_payout';
    amount: number;
    balance_after: number;
    notes?: string;
    created_at: string;
  }
  
  export interface MicrofinanceLoan {
    id: string;
    org_id: string;
    account_id: string;
    loan_number: string;
    principal_amount: number;
    interest_rate_percentage: number;
    total_repayment_amount: number;
    amount_paid: number;
    disbursement_date: string;
    due_date: string;
    status: 'pending' | 'active' | 'fully_paid' | 'defaulted';
    created_at: string;
    account?: SusuAccount;
  }
  
  export interface LoanScheduleItem {
    id: string;
    loan_id: string;
    due_date: string;
    expected_amount: number;
    paid_amount: number;
    status: 'pending' | 'partial' | 'paid' | 'overdue';
  }