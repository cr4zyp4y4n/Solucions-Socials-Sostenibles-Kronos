import { createClient } from '@supabase/supabase-js';

// CONFIGURACIÓN DE SUPABASE
// IMPORTANTE: Reemplaza estas URLs con las de tu proyecto Supabase

// 1. Ve a tu proyecto en Supabase Dashboard
// 2. Ve a Settings > API
// 3. Copia la "Project URL" y "anon public" key

const SUPABASE_URL = 'https://tu-proyecto-id.supabase.co';
const SUPABASE_ANON_KEY = 'tu-anon-key-aqui';

// Crear cliente de Supabase
export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false
  }
});

// Configuración de la base de datos
export const DB_CONFIG = {
  // Tablas principales
  TABLES: {
    USERS: 'user_profiles',
    EXCEL_UPLOADS: 'excel_uploads',
    INVOICES: 'invoices',
    PROVIDERS: 'providers',
    ANALYTICS: 'analytics'
  },
  
  // Roles de usuario
  ROLES: {
    ADMIN: 'admin',
    MANAGEMENT: 'management',
    MANAGER: 'manager',
    USER: 'user'
  }
};

// Funciones de autenticación
export const authService = {
  // Iniciar sesión
  async signIn(email, password) {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password
    });
    return { data, error };
  },

  // Registrar usuario
  async signUp(email, password, userData = {}) {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: userData
      }
    });
    return { data, error };
  },

  // Cerrar sesión
  async signOut() {
    const { error } = await supabase.auth.signOut();
    return { error };
  },

  // Obtener usuario actual
  async getCurrentUser() {
    const { data: { user }, error } = await supabase.auth.getUser();
    return { user, error };
  },

  // Escuchar cambios de autenticación
  onAuthStateChange(callback) {
    return supabase.auth.onAuthStateChange(callback);
  }
};

// Funciones de base de datos
export const dbService = {
  // Subir archivo Excel
  async uploadExcel(file, metadata = {}) {
    const { data, error } = await supabase
      .from(DB_CONFIG.TABLES.EXCEL_UPLOADS)
      .insert({
        filename: file.name,
        size: file.size,
        type: file.type,
        metadata: metadata,
        uploaded_at: new Date().toISOString()
      })
      .select();
    return { data, error };
  },

  // Guardar datos procesados
  async saveProcessedData(data, uploadId) {
    const { data: result, error } = await supabase
      .from(DB_CONFIG.TABLES.INVOICES)
      .insert(data.map(item => ({
        ...item,
        upload_id: uploadId,
        processed_at: new Date().toISOString()
      })));
    return { data: result, error };
  },

  // Obtener datos de facturas
  async getInvoices(filters = {}) {
    let query = supabase
      .from(DB_CONFIG.TABLES.INVOICES)
      .select('*');
    
    // Aplicar filtros
    if (filters.provider) {
      query = query.eq('provider', filters.provider);
    }
    if (filters.dateFrom) {
      query = query.gte('issue_date', filters.dateFrom);
    }
    if (filters.dateTo) {
      query = query.lte('issue_date', filters.dateTo);
    }
    
    const { data, error } = await query;
    return { data, error };
  },

  // Obtener estadísticas
  async getAnalytics() {
    const { data, error } = await supabase
      .from(DB_CONFIG.TABLES.ANALYTICS)
      .select('*')
      .order('created_at', { ascending: false })
      .limit(1);
    return { data, error };
  }
}; 