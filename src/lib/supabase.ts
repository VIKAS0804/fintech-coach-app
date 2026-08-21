import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';

import { appConfig } from '../config/env';

export const supabase =
  appConfig.supabaseUrl && appConfig.supabaseAnonKey
    ? createClient(appConfig.supabaseUrl, appConfig.supabaseAnonKey, {
        auth: {
          autoRefreshToken: true,
          detectSessionInUrl: false,
          persistSession: true,
          storage: AsyncStorage,
        },
      })
    : null;
