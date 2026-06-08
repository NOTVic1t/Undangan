/**
 * OMEGA INVITATION PLATFORM
 * Supabase Configuration & Client
 * Replace SUPABASE_URL and SUPABASE_ANON_KEY with your project values
 */

const OMEGA_CONFIG = {
  supabaseUrl: window.SUPABASE_URL || 'https://YOUR_PROJECT_ID.supabase.co',
  supabaseAnonKey: window.SUPABASE_ANON_KEY || 'YOUR_ANON_KEY',
  platformName: 'OMEGA Invitation',
  defaultBranding: 'Created By Victor Rizki Valentiano',
  brandingUrl: 'https://omega-invite.com',
  version: '1.0.0',
};

// Initialize Supabase client (loaded via CDN in HTML)
let supabaseClient = null;

function initSupabase() {
  if (!window.supabase) {
    console.error('Supabase SDK not loaded. Include the CDN script before this file.');
    return null;
  }
  if (!supabaseClient) {
    supabaseClient = window.supabase.createClient(
      OMEGA_CONFIG.supabaseUrl,
      OMEGA_CONFIG.supabaseAnonKey,
      {
        auth: {
          autoRefreshToken: true,
          persistSession: true,
          detectSessionInUrl: true,
        },
        realtime: {
          params: { eventsPerSecond: 10 },
        },
      }
    );
  }
  return supabaseClient;
}

function getSupabase() {
  if (!supabaseClient) return initSupabase();
  return supabaseClient;
}

// Export for module use
window.OMEGA = window.OMEGA || {};
window.OMEGA.config = OMEGA_CONFIG;
window.OMEGA.getSupabase = getSupabase;
window.OMEGA.initSupabase = initSupabase;
