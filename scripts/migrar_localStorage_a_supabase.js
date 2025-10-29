/**
 * Script de Migración: localStorage → Supabase
 * 
 * IMPORTANTE: 
 * - Ejecutar después de crear las tablas en Supabase
 * - Hacer backup de localStorage antes de ejecutar
 * - Ejecutar en el navegador (consola) o como script Node.js
 */

import { supabase } from '../src/config/supabase';

class MigradorLocalStorage {
  constructor() {
    this.stats = {
      hojas: { total: 0, migradas: 0, errores: 0 },
      personal: { total: 0, migradas: 0 },
      equipamiento: { total: 0, migradas: 0 },
      menus: { total: 0, migradas: 0 },
      bebidas: { total: 0, migradas: 0 },
      checklist: { total: 0, migradas: 0 }
    };
  }

  // Leer datos de localStorage
  leerLocalStorage() {
    try {
      const stored = localStorage.getItem('hojas_ruta');
      if (!stored) {
        console.warn('⚠️ No hay datos en localStorage');
        return [];
      }
      return JSON.parse(stored);
    } catch (error) {
      console.error('❌ Error leyendo localStorage:', error);
      throw error;
    }
  }

  // Migrar una hoja de ruta completa
  async migrarHoja(hoja, index, total) {
    console.log(`\n📄 Migrando hoja ${index + 1}/${total}: ${hoja.cliente} (${hoja.fechaServicio})`);

    try {
      // 1. Insertar hoja principal
      const hojaData = {
        fecha_servicio: hoja.fechaServicio || null,
        cliente: hoja.cliente || 'Sin cliente',
        contacto: hoja.contacto || null,
        direccion: hoja.direccion || null,
        transportista: hoja.transportista || null,
        responsable: hoja.responsable || null,
        num_personas: hoja.numPersonas || 0,
        personal_text: hoja.personal || null,
        firma_responsable: hoja.firmaResponsable || null,
        firma_info: hoja.firmaInfo || {
          firmado: false,
          firmado_por: '',
          fecha_firma: null,
          firma_data: ''
        },
        horarios: hoja.horarios || {},
        estado: hoja.estado || hoja.estadoServicio || 'preparacion',
        notas: hoja.notas || [],
        created_by: null, // Se actualizará después si es necesario
      };

      // Si hay fecha_creacion en formato ISO, convertirla
      if (hoja.fechaCreacion) {
        hojaData.fecha_creacion = new Date(hoja.fechaCreacion).toISOString();
      }

      const { data: hojaInsertada, error: errorHoja } = await supabase
        .from('hojas_ruta')
        .insert(hojaData)
        .select()
        .single();

      if (errorHoja) {
        console.error('❌ Error insertando hoja:', errorHoja);
        this.stats.hojas.errores++;
        return null;
      }

      console.log(`✅ Hoja insertada: ${hojaInsertada.id}`);
      this.stats.hojas.migradas++;
      const hojaId = hojaInsertada.id;

      // 2. Migrar personal (horasPersonal)
      if (hoja.horasPersonal && Array.isArray(hoja.horasPersonal) && hoja.horasPersonal.length > 0) {
        await this.migrarPersonal(hojaId, hoja.horasPersonal);
      }

      // 3. Migrar equipamiento
      if (hoja.equipamiento && Array.isArray(hoja.equipamiento) && hoja.equipamiento.length > 0) {
        await this.migrarEquipamiento(hojaId, hoja.equipamiento);
      }

      // 4. Migrar menus
      if (hoja.menus && Array.isArray(hoja.menus) && hoja.menus.length > 0) {
        await this.migrarMenus(hojaId, hoja.menus);
      }

      // 5. Migrar bebidas
      if (hoja.bebidas && Array.isArray(hoja.bebidas) && hoja.bebidas.length > 0) {
        await this.migrarBebidas(hojaId, hoja.bebidas);
      }

      // 6. Migrar checklist
      if (hoja.checklist) {
        await this.migrarChecklist(hojaId, hoja.checklist);
      }

      return hojaId;
    } catch (error) {
      console.error(`❌ Error migrando hoja ${hoja.cliente}:`, error);
      this.stats.hojas.errores++;
      return null;
    }
  }

  // Migrar personal
  async migrarPersonal(hojaId, horasPersonal) {
    this.stats.personal.total += horasPersonal.length;

    const personalData = horasPersonal.map(hr => ({
      hoja_ruta_id: hojaId,
      nombre: hr.nombre || '',
      horas: hr.horas || 0,
      empleado_id: hr.empleadoId || null
    }));

    const { error } = await supabase
      .from('hojas_ruta_personal')
      .insert(personalData);

    if (error) {
      console.error('❌ Error insertando personal:', error);
      return;
    }

    this.stats.personal.migradas += personalData.length;
    console.log(`  ✅ Personal: ${personalData.length} trabajadores`);
  }

  // Migrar equipamiento
  async migrarEquipamiento(hojaId, equipamiento) {
    this.stats.equipamiento.total += equipamiento.length;

    const equipamientoData = equipamiento.map(eq => ({
      hoja_ruta_id: hojaId,
      item: eq.item || '',
      cantidad: eq.cantidad || '',
      orden: eq.orden || 0
    }));

    const { error } = await supabase
      .from('hojas_ruta_equipamiento')
      .insert(equipamientoData);

    if (error) {
      console.error('❌ Error insertando equipamiento:', error);
      return;
    }

    this.stats.equipamiento.migradas += equipamientoData.length;
    console.log(`  ✅ Equipamiento: ${equipamientoData.length} items`);
  }

  // Migrar menus
  async migrarMenus(hojaId, menus) {
    this.stats.menus.total += menus.length;

    const menusData = menus.map(menu => ({
      hoja_ruta_id: hojaId,
      tipo: menu.tipo || 'general',
      hora: menu.hora || '',
      item: menu.item || '',
      cantidad: menu.cantidad || '',
      proveedor: menu.proveedor || '',
      orden: menu.orden || 0
    }));

    const { error } = await supabase
      .from('hojas_ruta_menus')
      .insert(menusData);

    if (error) {
      console.error('❌ Error insertando menus:', error);
      return;
    }

    this.stats.menus.migradas += menusData.length;
    console.log(`  ✅ Menús: ${menusData.length} items`);
  }

  // Migrar bebidas
  async migrarBebidas(hojaId, bebidas) {
    this.stats.bebidas.total += bebidas.length;

    const bebidasData = bebidas.map(beb => ({
      hoja_ruta_id: hojaId,
      item: beb.item || '',
      cantidad: beb.cantidad || '',
      unidad: beb.unidad || '',
      orden: beb.orden || 0
    }));

    const { error } = await supabase
      .from('hojas_ruta_bebidas')
      .insert(bebidasData);

    if (error) {
      console.error('❌ Error insertando bebidas:', error);
      return;
    }

    this.stats.bebidas.migradas += bebidasData.length;
    console.log(`  ✅ Bebidas: ${bebidasData.length} items`);
  }

  // Migrar checklist
  async migrarChecklist(hojaId, checklist) {
    const tareas = [];

    // Checklist general
    if (checklist.general) {
      Object.entries(checklist.general).forEach(([fase, tareasFase]) => {
        if (Array.isArray(tareasFase)) {
          tareasFase.forEach(tarea => {
            tareas.push({
              hoja_ruta_id: hojaId,
              tipo: 'general',
              fase: fase,
              tarea_id: tarea.id || '',
              task: tarea.task || '',
              completed: tarea.completed || false,
              assigned_to: tarea.assignedTo || null,
              priority: tarea.priority || 'media',
              completed_at: tarea.completedAt || null,
              completed_by: null // Se puede mapear después si hay relación
            });
          });
        }
      });
    }

    // Checklists específicas
    ['equipamiento', 'menus', 'bebidas'].forEach(tipo => {
      if (checklist[tipo] && Array.isArray(checklist[tipo])) {
        checklist[tipo].forEach(tarea => {
          tareas.push({
            hoja_ruta_id: hojaId,
            tipo: tipo,
            fase: null,
            tarea_id: tarea.id || '',
            task: tarea.task || '',
            completed: tarea.completed || false,
            assigned_to: tarea.assignedTo || null,
            priority: tarea.priority || 'media',
            completed_at: null,
            completed_by: null
          });
        });
      }
    });

    if (tareas.length === 0) return;

    this.stats.checklist.total += tareas.length;

    const { error } = await supabase
      .from('hojas_ruta_checklist')
      .insert(tareas);

    if (error) {
      console.error('❌ Error insertando checklist:', error);
      return;
    }

    this.stats.checklist.migradas += tareas.length;
    console.log(`  ✅ Checklist: ${tareas.length} tareas`);
  }

  // Ejecutar migración completa
  async migrar() {
    console.log('🚀 Iniciando migración de localStorage a Supabase...\n');

    try {
      // 1. Leer datos
      const hojasRuta = this.leerLocalStorage();
      this.stats.hojas.total = hojasRuta.length;

      if (hojasRuta.length === 0) {
        console.log('⚠️ No hay hojas de ruta para migrar');
        return this.stats;
      }

      console.log(`📦 Se encontraron ${hojasRuta.length} hojas de ruta\n`);

      // 2. Migrar cada hoja
      for (let i = 0; i < hojasRuta.length; i++) {
        await this.migrarHoja(hojasRuta[i], i, hojasRuta.length);
        
        // Pequeño delay para no saturar la BD
        if (i < hojasRuta.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 100));
        }
      }

      // 3. Mostrar estadísticas
      this.mostrarEstadisticas();

      return this.stats;
    } catch (error) {
      console.error('❌ Error crítico en migración:', error);
      throw error;
    }
  }

  // Mostrar estadísticas finales
  mostrarEstadisticas() {
    console.log('\n' + '='.repeat(50));
    console.log('📊 ESTADÍSTICAS DE MIGRACIÓN');
    console.log('='.repeat(50));
    console.log(`\n✅ Hojas de ruta: ${this.stats.hojas.migradas}/${this.stats.hojas.total}`);
    console.log(`✅ Personal: ${this.stats.personal.migradas}/${this.stats.personal.total}`);
    console.log(`✅ Equipamiento: ${this.stats.equipamiento.migradas}/${this.stats.equipamiento.total}`);
    console.log(`✅ Menús: ${this.stats.menus.migradas}/${this.stats.menus.total}`);
    console.log(`✅ Bebidas: ${this.stats.bebidas.migradas}/${this.stats.bebidas.total}`);
    console.log(`✅ Checklist: ${this.stats.checklist.migradas}/${this.stats.checklist.total}`);
    
    if (this.stats.hojas.errores > 0) {
      console.log(`\n⚠️ Errores: ${this.stats.hojas.errores}`);
    }
    
    console.log('\n' + '='.repeat(50));
  }
}

// Función para ejecutar migración
export async function migrarLocalStorageASupabase() {
  const migrador = new MigradorLocalStorage();
  return await migrador.migrar();
}

// Si se ejecuta directamente
if (typeof window !== 'undefined') {
  window.migrarHojasRuta = migrarLocalStorageASupabase;
}

export default MigradorLocalStorage;

