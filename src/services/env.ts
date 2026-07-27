export const env = {
  kakaoMapAppKey: import.meta.env.VITE_KAKAO_MAP_APP_KEY as string | undefined,
  googleClientId: import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined,
  supabaseUrl: import.meta.env.VITE_SUPABASE_URL as string | undefined,
  supabaseAnonKey: import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined,
  mountainWeatherProxyUrl: import.meta.env.VITE_MOUNTAIN_WEATHER_PROXY_URL as string | undefined,
  siteUrl: import.meta.env.VITE_SITE_URL as string | undefined,
  vercelUrl: import.meta.env.VITE_VERCEL_URL as string | undefined
};

export const isSupabaseConfigured = Boolean(env.supabaseUrl && env.supabaseAnonKey);
export const isGoogleIdentityConfigured = Boolean(env.googleClientId);
export const isKakaoMapConfigured = Boolean(env.kakaoMapAppKey);
