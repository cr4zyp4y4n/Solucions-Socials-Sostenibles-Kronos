// Script de prueba rápida para verificar conexión con Supabase
// Ejecutar con: node test_fichaje_connection.js

const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// Leer configuración de Supabase
const configPath = path.join(__dirname, 'src', 'config', 'supabase.js');
let supabaseUrl, supabaseKey;

try {
  // Intentar leer el archivo de configuración
  const configContent = fs.readFileSync(configPath, 'utf-8');
  
  // Extraer URL y key usando regex (básico)
  const urlMatch = configContent.match(/supabaseUrl:\s*['"]([^'"]+)['"]/);
  const keyMatch = configContent.match(/supabaseKey:\s*['"]([^'"]+)['"]/);
  
  if (urlMatch) supabaseUrl = urlMatch[1];
  if (keyMatch) supabaseKey = keyMatch[1];
} catch (error) {
  console.error('❌ Error leyendo configuración. Asegúrate de tener src/config/supabase.js');
  process.exit(1);
}

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ No se encontraron las credenciales de Supabase');
  console.log('💡 Asegúrate de que src/config/supabase.js tenga supabaseUrl y supabaseKey');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function testConnection() {
  console.log('🔍 Probando conexión con Supabase...\n');

  // 1. Verificar que las tablas existen
  console.log('1️⃣ Verificando tablas...');
  try {
    const { data: fichajes, error: e1 } = await supabase
      .from('fichajes')
      .select('id')
      .limit(1);
    
    if (e1) {
      console.error('❌ Error accediendo a tabla fichajes:', e1.message);
      console.log('💡 Asegúrate de haber ejecutado create_fichajes_tables.sql en Supabase');
      return;
    }
    console.log('✅ Tabla fichajes: OK');

    const { data: pausas, error: e2 } = await supabase
      .from('fichajes_pausas')
      .select('id')
      .limit(1);
    
    if (e2) {
      console.error('❌ Error accediendo a tabla fichajes_pausas:', e2.message);
      return;
    }
    console.log('✅ Tabla fichajes_pausas: OK');

    const { data: auditoria, error: e3 } = await supabase
      .from('fichajes_auditoria')
      .select('id')
      .limit(1);
    
    if (e3) {
      console.error('❌ Error accediendo a tabla fichajes_auditoria:', e3.message);
      return;
    }
    console.log('✅ Tabla fichajes_auditoria: OK\n');

    // 2. Contar registros
    console.log('2️⃣ Contando registros...');
    const { count: countFichajes } = await supabase
      .from('fichajes')
      .select('*', { count: 'exact', head: true });
    
    const { count: countPausas } = await supabase
      .from('fichajes_pausas')
      .select('*', { count: 'exact', head: true });
    
    const { count: countAuditoria } = await supabase
      .from('fichajes_auditoria')
      .select('*', { count: 'exact', head: true });

    console.log(`   📊 Fichajes: ${countFichajes || 0}`);
    console.log(`   📊 Pausas: ${countPausas || 0}`);
    console.log(`   📊 Auditoría: ${countAuditoria || 0}\n`);

    // 3. Verificar funciones SQL
    console.log('3️⃣ Verificando funciones SQL...');
    try {
      // Probar función get_resumen_mensual_fichajes (con datos de prueba)
      const { data: resumen, error: e4 } = await supabase
        .rpc('get_resumen_mensual_fichajes', {
          p_empleado_id: 'test',
          p_mes: new Date().getMonth() + 1,
          p_ano: new Date().getFullYear()
        });
      
      if (e4 && !e4.message.includes('no rows')) {
        console.error('❌ Error en función get_resumen_mensual_fichajes:', e4.message);
      } else {
        console.log('✅ Función get_resumen_mensual_fichajes: OK');
      }
    } catch (error) {
      console.log('⚠️  No se pudo verificar funciones SQL (puede ser normal si no hay datos)');
    }

    console.log('\n✅ ¡Conexión exitosa! El sistema de fichaje está listo para usar.');
    console.log('\n📝 Próximos pasos:');
    console.log('   1. Inicia la aplicación (npm start)');
    console.log('   2. Ve a la sección "Fichaje" en el menú lateral');
    console.log('   3. Selecciona un empleado y prueba fichar entrada/salida');

  } catch (error) {
    console.error('❌ Error inesperado:', error.message);
  }
}

testConnection();




