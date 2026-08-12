import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://example.supabase.co';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'demo-anon-key';

const isSupabaseConfigured = Boolean(import.meta.env.VITE_SUPABASE_URL && import.meta.env.VITE_SUPABASE_ANON_KEY);

if (!isSupabaseConfigured) {
  console.warn('Supabase environment variables are missing. Running with safe demo-mode client.');
}

const createDemoQueryBuilder = () => {
  const builder: any = {
    select: () => builder,
    eq: () => builder,
    order: () => builder,
    limit: () => builder,
    single: async () => ({ data: null, error: null }),
    maybeSingle: async () => ({ data: null, error: null }),
    insert: async () => ({ data: null, error: null }),
    update: async () => ({ data: null, error: null }),
    upsert: async () => ({ data: null, error: null }),
  };

  return builder;
};

const demoSupabase = {
  auth: {
    getSession: async () => ({ data: { session: null }, error: null }),
    onAuthStateChange: () => ({
      data: { subscription: { unsubscribe: () => undefined } },
      error: null,
    }),
    signInWithPassword: async () => ({ data: null, error: null }),
    signUp: async () => ({ data: { user: null, session: null }, error: null }),
    signOut: async () => ({ error: null }),
    resetPasswordForEmail: async () => ({ data: null, error: null }),
  },
  from: () => createDemoQueryBuilder(),
  channel: () => ({
    on: () => ({ subscribe: () => ({ unsubscribe: () => undefined }) }),
    subscribe: () => ({ unsubscribe: () => undefined }),
  }),
  removeChannel: () => undefined,
};

export const supabase = isSupabaseConfigured
  ? createClient(supabaseUrl, supabaseAnonKey)
  : (demoSupabase as any);
