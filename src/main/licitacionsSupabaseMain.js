const { createClient } = require('@supabase/supabase-js');

let client = null;
let storedSession = null;

function getSupabaseConfig() {
  const url = process.env.SUPABASE_URL || 'https://zalnsacawwekmibhoiba.supabase.co';
  const key = process.env.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InphbG5zYWNhd3dla21pYmhvaWJhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTIwNTgxNDMsImV4cCI6MjA2NzYzNDE0M30.vJKSFJGTg19lYgk8O1fr3YJ5wyW_6uEEjQwF3_y6R4I';
  return { url, key };
}

function getMainSupabaseClient() {
  if (!client) {
    const { url, key } = getSupabaseConfig();
    if (!url || !key) {
      throw new Error('SUPABASE_URL y SUPABASE_ANON_KEY requeridos para sync en background');
    }
    client = createClient(url, key, {
      auth: {
        autoRefreshToken: true,
        persistSession: false,
        detectSessionInUrl: false
      }
    });
  }
  return client;
}

async function setMainSupabaseSession(session) {
  if (!session?.access_token || !session?.refresh_token) {
    storedSession = null;
    return { ok: false, reason: 'no_session' };
  }
  storedSession = {
    access_token: session.access_token,
    refresh_token: session.refresh_token
  };
  const sb = getMainSupabaseClient();
  const { error } = await sb.auth.setSession(storedSession);
  if (error) {
    storedSession = null;
    return { ok: false, reason: error.message };
  }
  return { ok: true };
}

function hasMainSupabaseSession() {
  return Boolean(storedSession?.access_token);
}

module.exports = {
  getMainSupabaseClient,
  setMainSupabaseSession,
  hasMainSupabaseSession
};
