export const appConfig = {
  supabaseUrl: process.env.EXPO_PUBLIC_SUPABASE_URL ?? '',
  supabaseAnonKey: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '',
  functionsBaseUrl: process.env.EXPO_PUBLIC_SUPABASE_URL
    ? `${process.env.EXPO_PUBLIC_SUPABASE_URL}/functions/v1`
    : '',
};

export const isSupabaseConfigured =
  appConfig.supabaseUrl.length > 0 && appConfig.supabaseAnonKey.length > 0;
