/**
 * SCRIPT SIMPLIFICADO PARA EJECUTAR EN CONSOLA DEL NAVEGADOR
 * 
 * INSTRUCCIONES:
 * 1. Abre la consola del navegador (F12)
 * 2. Copia y pega este código completo
 * 3. Presiona Enter
 * 4. Ejecuta: migrarAHojasRuta()
 * 
 * IMPORTANTE: 
 * - Asegúrate de estar logueado en la app
 * - Las tablas deben estar creadas en Supabase
 */

async function migrarAHojasRuta() {
  console.log('🚀 Iniciando migración...\n');
  
  // Importar supabase (ajusta la ruta según tu configuración)
  const { createClient } = await import('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2');
  // O usa tu instancia existente:
  // const supabase = window.supabase; // Si ya está disponible globalmente
  
  // Leer localStorage
  const hojasRuta = JSON.parse(localStorage.getItem('hojas_ruta') || '[]');
  console.log(`📦 Encontradas ${hojasRuta.length} hojas de ruta\n`);
  
  let migradas = 0;
  let errores = 0;
  
  for (let i = 0; i < hojasRuta.length; i++) {
    const hoja = hojasRuta[i];
    console.log(`Migrando ${i + 1}/${hojasRuta.length}: ${hoja.cliente}`);
    
    try {
      // Insertar hoja principal
      const { data: hojaInsertada, error } = await supabase
        .from('hojas_ruta')
        .insert({
          fecha_servicio: hoja.fechaServicio,
          cliente: hoja.cliente || 'Sin cliente',
          contacto: hoja.contacto,
          direccion: hoja.direccion,
          transportista: hoja.transportista,
          responsable: hoja.responsable,
          num_personas: hoja.numPersonas || 0,
          personal_text: hoja.personal,
          firma_responsable: hoja.firmaResponsable,
          firma_info: hoja.firmaInfo || { firmado: false },
          horarios: hoja.horarios || {},
          estado: hoja.estado || hoja.estadoServicio || 'preparacion',
          notas: hoja.notas || []
        })
        .select()
        .single();
      
      if (error) throw error;
      
      const hojaId = hojaInsertada.id;
      
      // Migrar personal
      if (hoja.horasPersonal?.length > 0) {
        await supabase
          .from('hojas_ruta_personal')
          .insert(hoja.horasPersonal.map(hr => ({
            hoja_ruta_id: hojaId,
            nombre: hr.nombre,
            horas: hr.horas || 0,
            empleado_id: hr.empleadoId || null
          })));
      }
      
      // Migrar equipamiento
      if (hoja.equipamiento?.length > 0) {
        await supabase
          .from('hojas_ruta_equipamiento')
          .insert(hoja.equipamiento.map(eq => ({
            hoja_ruta_id: hojaId,
            item: eq.item,
            cantidad: eq.cantidad,
            orden: eq.orden || 0
          })));
      }
      
      // Migrar menus
      if (hoja.menus?.length > 0) {
        await supabase
          .from('hojas_ruta_menus')
          .insert(hoja.menus.map(m => ({
            hoja_ruta_id: hojaId,
            tipo: m.tipo,
            hora: m.hora,
            item: m.item,
            cantidad: m.cantidad,
            proveedor: m.proveedor,
            orden: m.orden || 0
          })));
      }
      
      // Migrar bebidas
      if (hoja.bebidas?.length > 0) {
        await supabase
          .from('hojas_ruta_bebidas')
          .insert(hoja.bebidas.map(b => ({
            hoja_ruta_id: hojaId,
            item: b.item,
            cantidad: b.cantidad,
            unidad: b.unidad,
            orden: b.orden || 0
          })));
      }
      
      // Migrar checklist
      const tareas = [];
      if (hoja.checklist?.general) {
        Object.entries(hoja.checklist.general).forEach(([fase, tareasFase]) => {
          if (Array.isArray(tareasFase)) {
            tareas.push(...tareasFase.map(t => ({
              hoja_ruta_id: hojaId,
              tipo: 'general',
              fase: fase,
              tarea_id: t.id,
              task: t.task,
              completed: t.completed || false,
              assigned_to: t.assignedTo || null,
              priority: t.priority || 'media'
            })));
          }
        });
      }
      ['equipamiento', 'menus', 'bebidas'].forEach(tipo => {
        if (hoja.checklist?.[tipo]?.length > 0) {
          tareas.push(...hoja.checklist[tipo].map(t => ({
            hoja_ruta_id: hojaId,
            tipo: tipo,
            fase: null,
            tarea_id: t.id,
            task: t.task,
            completed: t.completed || false,
            assigned_to: t.assignedTo || null,
            priority: t.priority || 'media'
          })));
        }
      });
      
      if (tareas.length > 0) {
        await supabase.from('hojas_ruta_checklist').insert(tareas);
      }
      
      migradas++;
      console.log(`✅ Migrada: ${hoja.cliente}`);
      
    } catch (error) {
      errores++;
      console.error(`❌ Error: ${hoja.cliente}`, error);
    }
  }
  
  console.log(`\n✅ Migración completada: ${migradas} hojas migradas, ${errores} errores`);
}

// Ejecutar migración
migrarAHojasRuta();

