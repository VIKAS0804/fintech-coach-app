import { createClient } from '@supabase/supabase-js';

import { appConfig } from '../config/env';

export const supabase =
  appConfig.supabaseUrl && appConfig.supabaseAnonKey
    ? createClient(appConfig.supabaseUrl, appConfig.supabaseAnonKey, {
        auth: {
          autoRefreshToken: false,
          detectSessionInUrl: false,
          persistSession: false,
        },
      })
    : null;
