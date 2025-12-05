import { supabase } from '../config/supabase';
import { createFlexibleProcessor } from './flexibleHojaRutaProcessor';
import * as XLSX from 'xlsx';

class HojaRutaSupabaseService {
  constructor() {
    this.flexibleProcessor = createFlexibleProcessor();
  }

  // =====================================================
  // PROCESAMIENTO DE ARCHIVOS
  // =====================================================

  // Procesar archivo Excel y convertir a CSV
  processExcel(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const data = new Uint8Array(e.target.result);
          const workbook = XLSX.read(data, { type: 'array' });
          
          // Obtener la primera hoja
          const sheetName = workbook.SheetNames[0];
          const worksheet = workbook.Sheets[sheetName];
          
          // Convertir a CSV
          const csvContent = XLSX.utils.sheet_to_csv(worksheet);
          resolve(csvContent);
        } catch (error) {
          reject(new Error('Error al procesar el archivo Excel: ' + error.message));
        }
      };
      reader.onerror = () => reject(new Error('Error al leer el archivo'));
      reader.readAsArrayBuffer(file);
    });
  }

  // Leer archivo como texto
  readFileAsText(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => resolve(e.target.result);
      reader.onerror = (e) => reject(e);
      reader.readAsText(file, 'UTF-8');
    });
  }

  // Generar ID único
  generateId() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
  }

  // Validar datos estándar
  isValidStandardData(data) {
    return data.cliente && data.responsable;
  }

  // Procesar CSV y extraer datos estructurados
  processCSV(csvContent) {
    try {
      const lines = csvContent.split('\n');
      
      // Intentar primero el procesamiento estándar (como el servicio original)
      try {
        const standardData = this.processCSVStandard(lines);
        if (this.isValidStandardData(standardData)) {
          console.log('✅ Procesamiento estándar exitoso');
          return standardData;
        }
      } catch (error) {
        console.log('⚠️ Procesamiento estándar falló, intentando procesamiento flexible...', error);
      }
      
      // Si el estándar falla, usar procesamiento flexible
      console.log('🔄 Usando procesamiento flexible...');
      const format = this.flexibleProcessor.detectFormat(lines);
      const flexibleData = this.flexibleProcessor.processWithFormat(lines, format);
      
      console.log('📊 Campos detectados:', Object.keys(format.fieldMappings));
      console.log('📋 Datos extraídos:', {
        cliente: flexibleData.cliente,
        fechaServicio: flexibleData.fechaServicio,
        responsable: flexibleData.responsable,
        numPersonas: flexibleData.numPersonas
      });
      
      return flexibleData;
      
    } catch (error) {
      console.error('Error procesando CSV:', error);
      throw new Error('Error al procesar el archivo CSV');
    }
  }

  // Procesamiento estándar (método original que funcionaba)
  processCSVStandard(lines) {
    const data = {
      fechaCreacion: new Date().toISOString(),
      fechaServicio: '',
      cliente: '',
      contacto: '',
      direccion: '',
      transportista: '',
      personal: '',
      horasPersonal: [],
      responsable: '',
      firmaResponsable: '',
      firmaInfo: {
        firmado: false,
        firmadoPor: '',
        fechaFirma: '',
        firmaData: ''
      },
      numPersonas: 0,
      horarios: {
        montaje: '',
        welcome: '',
        desayuno: '',
        comida: '',
        recogida: ''
      },
      equipamiento: [],
      menus: [],
      bebidas: [],
      notas: [],
      checklist: {
        general: {
          preEvento: [
            { id: 'equipamiento', task: 'Verificar equipamiento completo', completed: false, assignedTo: '', priority: 'alta' },
            { id: 'menus', task: 'Confirmar menús y cantidades', completed: false, assignedTo: '', priority: 'alta' },
            { id: 'personal', task: 'Confirmar personal asignado', completed: false, assignedTo: '', priority: 'alta' },
            { id: 'transporte', task: 'Verificar transporte y ruta', completed: false, assignedTo: '', priority: 'media' },
            { id: 'contacto', task: 'Contactar cliente para confirmación', completed: false, assignedTo: '', priority: 'media' }
          ],
          duranteEvento: [
            { id: 'montaje', task: 'Montaje del servicio', completed: false, assignedTo: '', priority: 'alta' },
            { id: 'welcome', task: 'Bienvenida y organización', completed: false, assignedTo: '', priority: 'alta' },
            { id: 'servicio', task: 'Servicio de comida/bebida', completed: false, assignedTo: '', priority: 'alta' },
            { id: 'atencion', task: 'Atención al cliente', completed: false, assignedTo: '', priority: 'media' },
            { id: 'limpieza', task: 'Limpieza durante el servicio', completed: false, assignedTo: '', priority: 'media' }
          ],
          postEvento: [
            { id: 'recogida', task: 'Recogida de equipamiento', completed: false, assignedTo: '', priority: 'alta' },
            { id: 'limpieza_final', task: 'Limpieza final del espacio', completed: false, assignedTo: '', priority: 'alta' },
            { id: 'inventario', task: 'Inventario de materiales', completed: false, assignedTo: '', priority: 'media' },
            { id: 'feedback', task: 'Recoger feedback del cliente', completed: false, assignedTo: '', priority: 'baja' },
            { id: 'reporte', task: 'Completar reporte del servicio', completed: false, assignedTo: '', priority: 'media' }
          ]
        },
        equipamiento: [],
        menus: [],
        bebidas: []
      },
      estadoServicio: 'preparacion'
    };

    // Procesar línea por línea
    let currentMenuType = null;
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;

      const parts = this.parseCSVLine(line);
        
      // Información general
      if (parts[0] === 'Fecha' && parts[3]) {
        data.fechaServicio = this.parseFecha(parts[3]);
      } else if (parts[0] === 'Cliente' && parts[3]) {
        data.cliente = parts[3];
      } else if (parts[0] === 'Contacto y Mobil' && parts[3]) {
        data.contacto = parts[3];
      } else if (parts[0] === 'Direccion' && parts[3]) {
        data.direccion = parts[3];
      } else if (parts[0] === 'Transportista' && parts[3]) {
        data.transportista = parts[3];
      } else if (parts[0] === 'PERSONAL' && parts[3]) {
        data.personal = parts[3];
      } else if (parts[0] === 'RESPONSABLE' && parts[1]) {
        data.responsable = parts[1];
      } else if (parts[0] === 'Nº de personas' && parts[1]) {
        data.numPersonas = parseInt(parts[1]) || 0;
      }

      // Horarios
      if (parts[0] === 'Hora de montaje' && parts[1]) {
        data.horarios.montaje = parts[1];
        if (parts[2]) data.notas.push(parts[2]);
      } else if (parts[0] === 'HORA WELCOME' && parts[1]) {
        data.horarios.welcome = parts[1];
      } else if (parts[0] === 'HORA DESAYUNO' && parts[1]) {
        data.horarios.desayuno = parts[1];
        if (parts[3]) data.notas.push(parts[3]);
      } else if (parts[0] === 'HORA COMIDA' && parts[1]) {
        data.horarios.comida = parts[1];
      } else if (parts[0] === 'Hora de recogida' && parts[1]) {
        data.horarios.recogida = parts[1];
      }

      // Detectar títulos de menú
      if (parts[3] && this.isMenuTitle(parts[3])) {
        currentMenuType = this.getMenuTypeFromTitle(parts[3]);
      }

      // Equipamiento
      if (this.isEquipamientoItem(parts[0])) {
        data.equipamiento.push({
          item: parts[0],
          cantidad: parts[1] || '',
          orden: data.equipamiento.length
        });
      }

      // Items de menú
      if (parts[3] && parts[3].length > 0 && this.isMenuItem(parts[3]) && currentMenuType) {
        data.menus.push({
          tipo: currentMenuType,
          hora: this.extractHora(parts[3]),
          item: parts[3],
          cantidad: parts[5] || '',
          proveedor: parts[6] || '',
          orden: data.menus.length
        });
      }

      // Bebidas
      if (this.isBebidaItem(parts[0]) || this.isAnyBebida(parts[0])) {
        data.bebidas.push({
          item: parts[0],
          cantidad: parts[1] || '',
          unidad: parts[2] || '',
          orden: data.bebidas.length
        });
      }

      // Notas
      if (parts[2] && parts[2].includes('OJO!!!')) {
        data.notas.push(`${parts[0]}: ${parts[2]}`);
      }
      if (parts[3] && parts[3].includes('OJO!!!')) {
        data.notas.push(`${parts[0]}: ${parts[3]}`);
      }
    }

    return data;
  }

  // Métodos auxiliares para procesamiento estándar
  parseCSVLine(line) {
    const result = [];
    let current = '';
    let inQuotes = false;
    
    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      
      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === ',' && !inQuotes) {
        result.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }
    result.push(current.trim());
    
    return result;
  }

  parseFecha(fechaStr) {
    try {
      const fechaLimpia = fechaStr.replace(/^[A-ZÁÉÍÓÚÑ]+/, '').trim();
      const partes = fechaLimpia.split('.');
      if (partes.length === 3) {
        const dia = partes[0];
        const mes = partes[1];
        const año = partes[2];
        const fecha = new Date(`${año}-${mes}-${dia}`);
        if (!isNaN(fecha.getTime())) {
          return fecha.toISOString().split('T')[0];
        }
      }
      return fechaStr;
    } catch (error) {
      return fechaStr;
    }
  }

  isMenuTitle(text) {
    if (!text) return false;
    const menuTitles = [
      'MENÚ WELCOME', 'MENÚ PAUSA', 'MENU COMIDA', 'MENU DESAYUNO',
      'MENU ALMUERZO', 'MENU CENA', 'CAFETERAS', 'REFRESCOS'
    ];
    return menuTitles.some(title => text.includes(title));
  }

  getMenuTypeFromTitle(text) {
    if (!text) return 'general';
    if (text.includes('WELCOME')) return 'welcome';
    if (text.includes('PAUSA') || text.includes('CAFÈ')) return 'pausa_cafe';
    if (text.includes('COMIDA')) return 'comida';
    if (text.includes('DESAYUNO')) return 'desayuno';
    if (text.includes('ALMUERZO')) return 'almuerzo';
    if (text.includes('CENA')) return 'cena';
    if (text.includes('CAFETERAS')) return 'cafeteras';
    if (text.includes('REFRESCOS')) return 'refrescos';
    return 'general';
  }

  isMenuItem(text) {
    if (!text) return false;
    if (this.isMenuTitle(text)) return false;
    const menuKeywords = [
      'Assortiment', 'galetes', 'Aigua Mineral', 'Cafè', 'Tes', 'Llet',
      'mini crusants', 'panets', 'fruites ecològiques', 'iogurt',
      'Xips de verdures', 'Mochi', 'truita', 'Broqueta', 'croquetes',
      'Coca ESCALIVADA', 'petit fours', 'Refrescos', 'Vi', 'Cava',
      'CALENTADOR', 'BROU', 'TERMOS', 'Cafè LO HACEMOS', 'Leche',
      'Agua caliente', 'soja', 'AVENA', 'BOTELLAS', 'ZUMOS',
      'COCA COLA', 'Fanta', 'Hielo', 'VINO', 'Cerveza'
    ];
    return menuKeywords.some(keyword => text.includes(keyword));
  }

  isEquipamientoItem(item) {
    const equipamientoItems = [
      'Mesas rectangulares', 'Mesas redondas altas', 'Mesas emplatar',
      'BIOMBOS', 'Mantel rectangular', 'Mantel redondo', 'Camino BONCOR',
      'HORNO PARA BROCHETAS', 'LLEVAR BANDEJAS HORNO', 'LLEVAR GUANTES PARA PAELLA',
      'COPAS DE AGUA/VINO', 'VASOS BLANCOS CARTON', 'VASOS CAFÉ CON LECHE CERAMICA',
      'VASOS CAFÉ CERAMICA', 'Servilletas', 'SERVILLETEROS JOSE',
      'PLATAFORMAS JOSE PARA PLATO RECTANGULAR', 'AZUCAREROS PARA AZUCAR BLANCO',
      'VASOS CAFÉ CERAMICA CAFÉ', 'VASOS CAFÉ CON LECHE CERAMICA',
      'CUCHARILLAS METAL CAFÉ', 'CESTAS PARA PONER CUCHARITAS CAFÉ',
      'Infusiones y té PARA 100', 'PINCHO MOCHIS', 'VASOS VIDRIO FRUTA + IOGURT',
      'TOPINS PARA IOGURT', 'CUCHARAS IOGURT', 'TENEDORES VASO FRUTA',
      'CAFETERAS', 'Café en polvo + garrafa de agua', 'CALIENTA LECHES',
      'CALIENTA AGUA PEQUEÑO', 'TERMOS VACIOS LIMPIOS', 'Guantes de latex',
      'Papelera', 'Papel de manos', 'DISPLAY BONCOR', 'PLATAFORMAS MADERA PARA PLATOS',
      'ROLL UP BONCOR', 'DECORACION PLANTAS JOSE', 'Bolsas de basura',
      'Cubitera', 'Pinzas', 'Abridores', 'Bandeja de camarero', 'Litos',
      'Ginebra y lito', 'JABON LAVAVAJILLAS + PAÑO SECAR COPAS'
    ];
    return equipamientoItems.includes(item);
  }

  isBebidaItem(item) {
    if (!item) return false;
    const bebidaKeywords = [
      'REFRESCOS', 'COCA COLA', 'Fanta', 'VINO', 'CAVA', 'Hielo',
      'Cerveza', 'BIDONES', 'ZUMOS', 'BOTELLAS', 'LATAS'
    ];
    return bebidaKeywords.some(keyword => item.toUpperCase().includes(keyword));
  }

  isAnyBebida(item) {
    return this.isBebidaItem(item);
  }

  extractHora(text) {
    const horaMatch = text.match(/(\d{1,2}):(\d{2})/);
    return horaMatch ? horaMatch[0] : '';
  }

  // Subir archivo y crear hoja de ruta
  async uploadFile(file, userId) {
    try {
      let csvContent;
      
      // Determinar el tipo de archivo
      const fileName = file.name.toLowerCase();
      const isExcel = fileName.endsWith('.xlsx') || fileName.endsWith('.xls');
      const isCSV = fileName.endsWith('.csv');
      
      if (!isExcel && !isCSV) {
        throw new Error('Solo se permiten archivos Excel (.xlsx, .xls) o CSV (.csv)');
      }
      
      // Procesar según el tipo
      if (isExcel) {
        csvContent = await this.processExcel(file);
      } else {
        csvContent = await this.readFileAsText(file);
      }
      
      const hojaRutaData = this.processCSV(csvContent);
      
      console.log('📋 Datos procesados del CSV:', hojaRutaData);
      
      // Validar que tenemos datos esenciales
      if (!hojaRutaData.cliente || (typeof hojaRutaData.cliente === 'string' && hojaRutaData.cliente.trim() === '')) {
        console.warn('⚠️ No se encontró cliente en los datos. Datos disponibles:', Object.keys(hojaRutaData));
      }
      
      // Añadir metadatos
      hojaRutaData.creadoPor = userId;
      hojaRutaData.nombreArchivo = file.name;
      hojaRutaData.tipoArchivo = isExcel ? 'excel' : 'csv';
      
      // Asegurar que tiene estructura completa
      hojaRutaData.horasPersonal = hojaRutaData.horasPersonal || [];
      
      // Si no hay cliente, intentar usar el nombre del archivo o un valor por defecto
      if (!hojaRutaData.cliente || hojaRutaData.cliente.trim() === '') {
        console.warn('⚠️ Cliente vacío, usando valor por defecto');
        hojaRutaData.cliente = file.name.replace(/\.(xlsx|xls|csv)$/i, '') || 'Cliente sin nombre';
      }
      
      hojaRutaData.checklist = hojaRutaData.checklist || {
        general: {
          preEvento: [
            { id: 'equipamiento', task: 'Verificar equipamiento completo', completed: false, assignedTo: '', priority: 'alta' },
            { id: 'menus', task: 'Confirmar menús y cantidades', completed: false, assignedTo: '', priority: 'alta' },
            { id: 'personal', task: 'Confirmar personal asignado', completed: false, assignedTo: '', priority: 'alta' },
            { id: 'transporte', task: 'Verificar transporte y ruta', completed: false, assignedTo: '', priority: 'media' },
            { id: 'contacto', task: 'Contactar cliente para confirmación', completed: false, assignedTo: '', priority: 'media' }
          ],
          duranteEvento: [
            { id: 'montaje', task: 'Montaje del servicio', completed: false, assignedTo: '', priority: 'alta' },
            { id: 'welcome', task: 'Bienvenida y organización', completed: false, assignedTo: '', priority: 'alta' },
            { id: 'servicio', task: 'Servicio de comida/bebida', completed: false, assignedTo: '', priority: 'alta' },
            { id: 'atencion', task: 'Atención al cliente', completed: false, assignedTo: '', priority: 'media' },
            { id: 'limpieza', task: 'Limpieza durante el servicio', completed: false, assignedTo: '', priority: 'media' }
          ],
          postEvento: [
            { id: 'recogida', task: 'Recogida de equipamiento', completed: false, assignedTo: '', priority: 'alta' },
            { id: 'limpieza_final', task: 'Limpieza final del espacio', completed: false, assignedTo: '', priority: 'alta' },
            { id: 'inventario', task: 'Inventario de materiales', completed: false, assignedTo: '', priority: 'media' },
            { id: 'feedback', task: 'Recoger feedback del cliente', completed: false, assignedTo: '', priority: 'baja' },
            { id: 'reporte', task: 'Completar reporte del servicio', completed: false, assignedTo: '', priority: 'media' }
          ]
        },
        equipamiento: [],
        menus: [],
        bebidas: []
      };
      
      // Crear hoja de ruta en Supabase
      const hojaCreada = await this.createHojaRuta(hojaRutaData, userId);
      
      // Generar checklists automáticas basadas en elementos
      if (hojaCreada) {
        await this.actualizarChecklistElementos(hojaCreada.id);
      }
      
      return hojaCreada;
    } catch (error) {
      console.error('❌ Error subiendo archivo:', error);
      throw error;
    }
  }

  // =====================================================
  // MÉTODOS DE LECTURA
  // =====================================================

  // Obtener todas las hojas de ruta
  async getHojasRuta() {
    try {
      const { data, error } = await supabase
        .from('hojas_ruta')
        .select('*')
        .order('fecha_servicio', { ascending: false });

      if (error) throw error;

      // Enriquecer con datos relacionados
      const hojasEnriquecidas = await Promise.all(
        data.map(hoja => this.enriquecerHojaRuta(hoja))
      );

      return hojasEnriquecidas;
    } catch (error) {
      console.error('❌ Error obteniendo hojas de ruta:', error);
      throw error;
    }
  }

  // Obtener una hoja de ruta por ID
  async getHojaRuta(id) {
    try {
      const { data, error } = await supabase
        .from('hojas_ruta')
        .select('*')
        .eq('id', id)
        .single();

      if (error) throw error;
      if (!data) return null;

      return await this.enriquecerHojaRuta(data);
    } catch (error) {
      console.error('❌ Error obteniendo hoja de ruta:', error);
      throw error;
    }
  }

  // Enriquecer hoja de ruta con datos relacionados
  async enriquecerHojaRuta(hoja) {
    const [
      personal,
      equipamiento,
      menus,
      bebidas,
      checklist
    ] = await Promise.all([
      this.getPersonal(hoja.id),
      this.getEquipamiento(hoja.id),
      this.getMenus(hoja.id),
      this.getBebidas(hoja.id),
      this.getChecklist(hoja.id)
    ]);

    return {
      id: hoja.id,
      fechaCreacion: hoja.fecha_creacion,
      fechaServicio: hoja.fecha_servicio,
      cliente: hoja.cliente,
      contacto: hoja.contacto,
      direccion: hoja.direccion,
      transportista: hoja.transportista,
      responsable: hoja.responsable,
      numPersonas: hoja.num_personas,
      personal: hoja.personal_text || '',
      horasPersonal: personal,
      firmaResponsable: hoja.firma_responsable,
      firmaInfo: hoja.firma_info || { firmado: false },
      horarios: hoja.horarios || {},
      estado: hoja.estado || 'preparacion',
      notas: hoja.notas || [],
      notasServicio: hoja.notas_servicio || [],
      equipamiento: equipamiento,
      menus: menus,
      bebidas: bebidas,
      checklist: checklist
    };
  }

  // Obtener personal de una hoja
  async getPersonal(hojaId) {
    try {
      const { data, error } = await supabase
        .from('hojas_ruta_personal')
        .select('*')
        .eq('hoja_ruta_id', hojaId)
        .order('nombre');

      if (error) throw error;

      return (data || []).map(hr => ({
        nombre: hr.nombre,
        horas: parseFloat(hr.horas) || 0,
        empleadoId: hr.empleado_id || null
      }));
    } catch (error) {
      console.error('❌ Error obteniendo personal:', error);
      return [];
    }
  }

  // Obtener equipamiento de una hoja
  async getEquipamiento(hojaId) {
    try {
      const { data, error } = await supabase
        .from('hojas_ruta_equipamiento')
        .select('*')
        .eq('hoja_ruta_id', hojaId)
        .order('orden');

      if (error) throw error;

      return (data || []).map(eq => ({
        item: eq.item,
        cantidad: eq.cantidad,
        orden: eq.orden || 0
      }));
    } catch (error) {
      console.error('❌ Error obteniendo equipamiento:', error);
      return [];
    }
  }

  // Obtener menus de una hoja
  async getMenus(hojaId) {
    try {
      const { data, error } = await supabase
        .from('hojas_ruta_menus')
        .select('*')
        .eq('hoja_ruta_id', hojaId)
        .order('orden');

      if (error) throw error;

      return (data || []).map(m => ({
        tipo: m.tipo,
        hora: m.hora,
        item: m.item,
        cantidad: m.cantidad,
        proveedor: m.proveedor,
        orden: m.orden || 0
      }));
    } catch (error) {
      console.error('❌ Error obteniendo menus:', error);
      return [];
    }
  }

  // Obtener bebidas de una hoja
  async getBebidas(hojaId) {
    try {
      const { data, error } = await supabase
        .from('hojas_ruta_bebidas')
        .select('*')
        .eq('hoja_ruta_id', hojaId)
        .order('orden');

      if (error) throw error;

      return (data || []).map(b => ({
        item: b.item,
        cantidad: b.cantidad,
        unidad: b.unidad,
        orden: b.orden || 0
      }));
    } catch (error) {
      console.error('❌ Error obteniendo bebidas:', error);
      return [];
    }
  }

  // Obtener checklist de una hoja
  async getChecklist(hojaId) {
    try {
      const { data, error } = await supabase
        .from('hojas_ruta_checklist')
        .select('*')
        .eq('hoja_ruta_id', hojaId);

      if (error) throw error;

      // Organizar checklist por tipo y fase
      const checklist = {
        general: {
          preEvento: [],
          duranteEvento: [],
          postEvento: []
        },
        equipamiento: [],
        menus: [],
        bebidas: []
      };

      (data || []).forEach(tarea => {
        const tareaObj = {
          id: tarea.tarea_id,
          task: tarea.task,
          completed: tarea.completed,
          assignedTo: tarea.assigned_to || '',
          priority: tarea.priority || 'media'
        };

        if (tarea.tipo === 'general' && tarea.fase) {
          if (checklist.general[tarea.fase]) {
            checklist.general[tarea.fase].push(tareaObj);
          }
        } else if (checklist[tarea.tipo]) {
          checklist[tarea.tipo].push(tareaObj);
        }
      });

      return checklist;
    } catch (error) {
      console.error('❌ Error obteniendo checklist:', error);
      return {
        general: { preEvento: [], duranteEvento: [], postEvento: [] },
        equipamiento: [],
        menus: [],
        bebidas: []
      };
    }
  }

  // =====================================================
  // MÉTODOS DE ESCRITURA
  // =====================================================

  // Crear nueva hoja de ruta
  async createHojaRuta(hojaData, userId) {
    try {
      // Validar y formatear fecha_servicio
      let fechaServicio = hojaData.fechaServicio;
      if (fechaServicio) {
        // Si ya está en formato YYYY-MM-DD, usarlo directamente
        if (/^\d{4}-\d{2}-\d{2}$/.test(fechaServicio)) {
          // Ya está en formato correcto
        } else {
          // Intentar convertir a formato DATE
          const fechaObj = new Date(fechaServicio);
          if (!isNaN(fechaObj.getTime())) {
            // Formatear como YYYY-MM-DD
            fechaServicio = fechaObj.toISOString().split('T')[0];
          } else {
            // Si no se puede parsear, usar fecha actual
            console.warn('⚠️ No se pudo parsear la fecha:', fechaServicio, 'usando fecha actual');
            fechaServicio = new Date().toISOString().split('T')[0];
          }
        }
      } else {
        // Si no hay fecha, usar fecha actual
        fechaServicio = new Date().toISOString().split('T')[0];
      }

      // Validar y asegurar que tenemos cliente
      let cliente = hojaData.cliente;
      if (!cliente || (typeof cliente === 'string' && cliente.trim() === '')) {
        // Intentar otras fuentes
        cliente = hojaData.nombreArchivo 
          ? hojaData.nombreArchivo.replace(/\.(xlsx|xls|csv)$/i, '').trim()
          : 'Cliente sin nombre';
        console.warn('⚠️ Cliente no encontrado, usando:', cliente);
      }
      cliente = typeof cliente === 'string' ? cliente.trim() : String(cliente).trim();

      const hojaInsert = {
        fecha_servicio: fechaServicio || new Date().toISOString().split('T')[0], // Si no hay fecha, usar hoy
        cliente: cliente || 'Cliente sin nombre',
        contacto: hojaData.contacto || null,
        direccion: hojaData.direccion || null,
        transportista: hojaData.transportista || null,
        responsable: hojaData.responsable || null,
        num_personas: hojaData.numPersonas || 0,
        personal_text: hojaData.personal || null,
        firma_responsable: hojaData.firmaResponsable || null,
        firma_info: hojaData.firmaInfo || { firmado: false },
        horarios: hojaData.horarios || {},
        estado: hojaData.estado || hojaData.estadoServicio || 'preparacion',
        notas: Array.isArray(hojaData.notas) ? hojaData.notas : [],
        notas_servicio: Array.isArray(hojaData.notasServicio) ? hojaData.notasServicio : [],
        created_by: userId || null // Puede ser null si no hay usuario
      };

      console.log('📝 Insertando hoja de ruta:', JSON.stringify(hojaInsert, null, 2));

      // Si no hay userId, no incluir created_by (será NULL por defecto)
      if (!userId) {
        delete hojaInsert.created_by;
      }

      const { data: hojaInsertada, error: errorHoja } = await supabase
        .from('hojas_ruta')
        .insert(hojaInsert)
        .select()
        .single();

      if (errorHoja) {
        console.error('❌ Error detallado de Supabase:', {
          message: errorHoja.message,
          code: errorHoja.code,
          details: errorHoja.details,
          hint: errorHoja.hint,
          data: hojaInsert
        });
        throw new Error(errorHoja.message || 'Error al crear la hoja de ruta');
      }

      const hojaId = hojaInsertada.id;

      // Insertar datos relacionados
      await Promise.all([
        this.insertPersonal(hojaId, hojaData.horasPersonal || []),
        this.insertEquipamiento(hojaId, hojaData.equipamiento || []),
        this.insertMenus(hojaId, hojaData.menus || []),
        this.insertBebidas(hojaId, hojaData.bebidas || []),
        this.insertChecklist(hojaId, hojaData.checklist)
      ]);

      return await this.getHojaRuta(hojaId);
    } catch (error) {
      console.error('❌ Error creando hoja de ruta:', error);
      throw error;
    }
  }

  // Actualizar horas de personal
  async actualizarHorasPersonal(hojaId, horasPersonal) {
    try {
      // Eliminar personal existente
      await supabase
        .from('hojas_ruta_personal')
        .delete()
        .eq('hoja_ruta_id', hojaId);

      // Insertar nuevo personal
      if (horasPersonal && horasPersonal.length > 0) {
        const personalData = horasPersonal.map(hr => ({
          hoja_ruta_id: hojaId,
          nombre: hr.nombre,
          horas: hr.horas || 0,
          empleado_id: hr.empleadoId || null
        }));

        const { error } = await supabase
          .from('hojas_ruta_personal')
          .insert(personalData);

        if (error) throw error;
      }

      return await this.getHojaRuta(hojaId);
    } catch (error) {
      console.error('❌ Error actualizando horas de personal:', error);
      throw error;
    }
  }

  // Actualizar tarea de checklist
  async actualizarTareaChecklist(hojaId, tipo, fase, tareaId, completed, assignedTo = '', userId = null) {
    try {
      const updateData = {
        completed: completed,
        assigned_to: assignedTo || null,
        updated_at: new Date().toISOString()
      };

      if (completed && userId) {
        updateData.completed_at = new Date().toISOString();
        updateData.completed_by = userId;
      } else if (!completed) {
        updateData.completed_at = null;
        updateData.completed_by = null;
      }

      let query = supabase
        .from('hojas_ruta_checklist')
        .update(updateData)
        .eq('hoja_ruta_id', hojaId)
        .eq('tipo', tipo)
        .eq('tarea_id', tareaId);

      if (tipo === 'general' && fase) {
        query = query.eq('fase', fase);
      } else {
        query = query.is('fase', null);
      }

      const { error } = await query;

      if (error) throw error;

      return await this.getHojaRuta(hojaId);
    } catch (error) {
      console.error('❌ Error actualizando checklist:', error);
      throw error;
    }
  }

  // Cambiar estado de servicio
  async cambiarEstadoServicio(hojaId, nuevoEstado) {
    try {
      const { error } = await supabase
        .from('hojas_ruta')
        .update({ estado: nuevoEstado })
        .eq('id', hojaId);

      if (error) throw error;

      return await this.getHojaRuta(hojaId);
    } catch (error) {
      console.error('❌ Error cambiando estado:', error);
      throw error;
    }
  }

  // Eliminar hoja de ruta
  async deleteHojaRuta(hojaId) {
    try {
      const { error } = await supabase
        .from('hojas_ruta')
        .delete()
        .eq('id', hojaId);

      if (error) throw error;
      return true;
    } catch (error) {
      console.error('❌ Error eliminando hoja de ruta:', error);
      throw error;
    }
  }

  // =====================================================
  // MÉTODOS PARA GESTIÓN DE NOTAS DE SERVICIO
  // =====================================================

  // Añadir una nota de servicio
  async añadirNotaServicio(hojaId, nota) {
    try {
      // Obtener la hoja actual
      const { data: hoja, error: errorHoja } = await supabase
        .from('hojas_ruta')
        .select('notas_servicio')
        .eq('id', hojaId)
        .single();

      if (errorHoja) throw errorHoja;

      // Obtener notas actuales o inicializar array vacío
      const notasActuales = hoja?.notas_servicio || [];
      
      // Añadir la nueva nota
      const nuevasNotas = [...notasActuales, nota.trim()];

      // Actualizar en la base de datos
      const { error } = await supabase
        .from('hojas_ruta')
        .update({ notas_servicio: nuevasNotas })
        .eq('id', hojaId);

      if (error) throw error;

      return await this.getHojaRuta(hojaId);
    } catch (error) {
      console.error('❌ Error añadiendo nota de servicio:', error);
      throw error;
    }
  }

  // Editar una nota de servicio
  async editarNotaServicio(hojaId, indice, nuevaNota) {
    try {
      // Obtener la hoja actual
      const { data: hoja, error: errorHoja } = await supabase
        .from('hojas_ruta')
        .select('notas_servicio')
        .eq('id', hojaId)
        .single();

      if (errorHoja) throw errorHoja;

      // Obtener notas actuales
      const notasActuales = hoja?.notas_servicio || [];
      
      // Verificar que el índice es válido
      if (indice < 0 || indice >= notasActuales.length) {
        throw new Error('Índice de nota inválido');
      }

      // Actualizar la nota en el índice especificado
      const nuevasNotas = [...notasActuales];
      nuevasNotas[indice] = nuevaNota.trim();

      // Actualizar en la base de datos
      const { error } = await supabase
        .from('hojas_ruta')
        .update({ notas_servicio: nuevasNotas })
        .eq('id', hojaId);

      if (error) throw error;

      return await this.getHojaRuta(hojaId);
    } catch (error) {
      console.error('❌ Error editando nota de servicio:', error);
      throw error;
    }
  }

  // Eliminar una nota de servicio
  async eliminarNotaServicio(hojaId, indice) {
    try {
      // Obtener la hoja actual
      const { data: hoja, error: errorHoja } = await supabase
        .from('hojas_ruta')
        .select('notas_servicio')
        .eq('id', hojaId)
        .single();

      if (errorHoja) throw errorHoja;

      // Obtener notas actuales
      const notasActuales = hoja?.notas_servicio || [];
      
      // Verificar que el índice es válido
      if (indice < 0 || indice >= notasActuales.length) {
        throw new Error('Índice de nota inválido');
      }

      // Eliminar la nota en el índice especificado
      const nuevasNotas = notasActuales.filter((_, i) => i !== indice);

      // Actualizar en la base de datos
      const { error } = await supabase
        .from('hojas_ruta')
        .update({ notas_servicio: nuevasNotas })
        .eq('id', hojaId);

      if (error) throw error;

      return await this.getHojaRuta(hojaId);
    } catch (error) {
      console.error('❌ Error eliminando nota de servicio:', error);
      throw error;
    }
  }

  // =====================================================
  // MÉTODOS AUXILIARES DE INSERCIÓN
  // =====================================================

  async insertPersonal(hojaId, horasPersonal) {
    if (!horasPersonal || horasPersonal.length === 0) return;

    const personalData = horasPersonal.map(hr => ({
      hoja_ruta_id: hojaId,
      nombre: hr.nombre,
      horas: hr.horas || 0,
      empleado_id: hr.empleadoId || null
    }));

    const { error } = await supabase
      .from('hojas_ruta_personal')
      .insert(personalData);

    if (error) throw error;
  }

  async insertEquipamiento(hojaId, equipamiento) {
    if (!equipamiento || equipamiento.length === 0) return;

    const equipamientoData = equipamiento.map(eq => ({
      hoja_ruta_id: hojaId,
      item: eq.item,
      cantidad: eq.cantidad,
      orden: eq.orden || 0
    }));

    const { error } = await supabase
      .from('hojas_ruta_equipamiento')
      .insert(equipamientoData);

    if (error) throw error;
  }

  async insertMenus(hojaId, menus) {
    if (!menus || menus.length === 0) return;

    const menusData = menus.map(m => ({
      hoja_ruta_id: hojaId,
      tipo: m.tipo,
      hora: m.hora,
      item: m.item,
      cantidad: m.cantidad,
      proveedor: m.proveedor,
      orden: m.orden || 0
    }));

    const { error } = await supabase
      .from('hojas_ruta_menus')
      .insert(menusData);

    if (error) throw error;
  }

  async insertBebidas(hojaId, bebidas) {
    if (!bebidas || bebidas.length === 0) return;

    const bebidasData = bebidas.map(b => ({
      hoja_ruta_id: hojaId,
      item: b.item,
      cantidad: b.cantidad,
      unidad: b.unidad,
      orden: b.orden || 0
    }));

    const { error } = await supabase
      .from('hojas_ruta_bebidas')
      .insert(bebidasData);

    if (error) throw error;
  }

  async insertChecklist(hojaId, checklist) {
    if (!checklist) return;

    const tareas = [];

    // Checklist general
    if (checklist.general) {
      Object.entries(checklist.general).forEach(([fase, tareasFase]) => {
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

    // Checklists específicas
    ['equipamiento', 'menus', 'bebidas'].forEach(tipo => {
      if (checklist[tipo] && Array.isArray(checklist[tipo])) {
        tareas.push(...checklist[tipo].map(t => ({
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
      const { error } = await supabase
        .from('hojas_ruta_checklist')
        .insert(tareas);

      if (error) throw error;
    }
  }

  // =====================================================
  // MÉTODOS DE HISTÓRICO Y ESTADÍSTICAS
  // =====================================================

  // Obtener histórico de servicios de un empleado
  async obtenerHistorialServicios(empleadoId) {
    try {
      console.log('🔍 Buscando histórico para empleado ID:', empleadoId);
      
      // Primero obtener el personal con empleado_id
      const { data: personalData, error: personalError } = await supabase
        .from('hojas_ruta_personal')
        .select('hoja_ruta_id, horas, nombre, empleado_id')
        .eq('empleado_id', String(empleadoId))
        .gt('horas', 0);

      if (personalError) {
        console.error('❌ Error obteniendo personal:', personalError);
        throw personalError;
      }

      console.log('📋 Personal encontrado:', personalData?.length || 0, 'registros');

      if (!personalData || personalData.length === 0) {
        return [];
      }

      // Obtener los IDs de las hojas de ruta
      const hojaIds = personalData.map(p => p.hoja_ruta_id);

      // Obtener las hojas de ruta
      const { data: hojasData, error: hojasError } = await supabase
        .from('hojas_ruta')
        .select('id, fecha_servicio, cliente, estado')
        .in('id', hojaIds)
        .order('fecha_servicio', { ascending: false });

      if (hojasError) {
        console.error('❌ Error obteniendo hojas de ruta:', hojasError);
        throw hojasError;
      }

      console.log('📋 Hojas encontradas:', hojasData?.length || 0);

      // Combinar los datos
      const historial = personalData
        .map(personal => {
          const hoja = hojasData?.find(h => h.id === personal.hoja_ruta_id);
          if (!hoja) return null;
          
          return {
            hojaId: hoja.id,
            fechaServicio: hoja.fecha_servicio,
            cliente: hoja.cliente,
            horas: parseFloat(personal.horas) || 0,
            nombre: personal.nombre,
            estado: hoja.estado || 'pendiente'
          };
        })
        .filter(item => item !== null)
        .sort((a, b) => {
          // Ordenar por fecha descendente
          const fechaA = new Date(a.fechaServicio);
          const fechaB = new Date(b.fechaServicio);
          return fechaB - fechaA;
        });

      console.log('✅ Historial obtenido:', historial.length, 'servicios');
      return historial;
    } catch (error) {
      console.error('❌ Error obteniendo historial:', error);
      return [];
    }
  }

  // Obtener estadísticas de horas por empleado
  async obtenerEstadisticasHorasEmpleado(empleadoId) {
    try {
      const historial = await this.obtenerHistorialServicios(empleadoId);

      const estadisticas = {
        totalServicios: historial.length,
        totalHoras: historial.reduce((sum, servicio) => sum + servicio.horas, 0),
        promedioHoras: historial.length > 0 
          ? Math.round((historial.reduce((sum, servicio) => sum + servicio.horas, 0) / historial.length) * 10) / 10 
          : 0,
        serviciosCompletados: historial.filter(s => s.estado === 'completado').length,
        ultimoServicio: historial.length > 0 ? historial[0].fechaServicio : null
      };

      return estadisticas;
    } catch (error) {
      console.error('❌ Error obteniendo estadísticas:', error);
      return {
        totalServicios: 0,
        totalHoras: 0,
        promedioHoras: 0,
        serviciosCompletados: 0,
        ultimoServicio: null
      };
    }
  }

  // Obtener horas de personal de una hoja
  async obtenerHorasPersonal(hojaId) {
    return await this.getPersonal(hojaId);
  }

  // =====================================================
  // MÉTODOS ADICIONALES (Compatibilidad)
  // =====================================================

  // Obtener la última hoja de ruta
  async getUltimaHojaRuta() {
    try {
      const hojas = await this.getHojasRuta();
      return hojas.length > 0 ? hojas[0] : null;
    } catch (error) {
      console.error('❌ Error obteniendo última hoja:', error);
      return null;
    }
  }

  // Obtener histórico (todas las hojas)
  async getHistorico() {
    try {
      const hojas = await this.getHojasRuta();
      return hojas; // Devolver todas las hojas, el componente filtrará la actual
    } catch (error) {
      console.error('❌ Error obteniendo histórico:', error);
      return [];
    }
  }

  // Firmar hoja de ruta
  async firmarHojaRuta(hojaId, firmaData, firmadoPor) {
    try {
      // Verificar si ya está firmada
      const hojaActual = await this.getHojaRuta(hojaId);
      if (hojaActual?.firmaInfo?.firmado) {
        throw new Error('Esta hoja de ruta ya está firmada y no se puede modificar la firma');
      }

      // firmaData ahora es el nombre (texto), no una imagen
      const firmaInfo = {
        firmado: true,
        firmado_por: firmadoPor, // El nombre del firmante
        fecha_firma: new Date().toISOString(),
        firma_data: firmaData // El nombre también se guarda aquí como texto
      };

      const { error } = await supabase
        .from('hojas_ruta')
        .update({
          firma_info: firmaInfo,
          firma_responsable: firmaData // Guardar el nombre como texto
        })
        .eq('id', hojaId);

      if (error) throw error;

      return await this.getHojaRuta(hojaId);
    } catch (error) {
      console.error('❌ Error firmando hoja:', error);
      throw error;
    }
  }

  // Generar checklist de elementos automáticamente
  generarChecklistElementos(hojaRuta) {
    const checklistElementos = {
      equipamiento: [],
      menus: [],
      bebidas: []
    };

    // Generar checklist de equipamiento
    if (hojaRuta.equipamiento && hojaRuta.equipamiento.length > 0) {
      hojaRuta.equipamiento.forEach((item, index) => {
        checklistElementos.equipamiento.push({
          id: `equipamiento_${index}`,
          task: `${item.item}${item.cantidad ? ` (${item.cantidad})` : ''}`,
          completed: false,
          assignedTo: '',
          priority: 'alta'
        });
      });
    }

    // Generar checklist de menús
    if (hojaRuta.menus && hojaRuta.menus.length > 0) {
      hojaRuta.menus.forEach((menu, menuIndex) => {
        if (menu.item) {
          checklistElementos.menus.push({
            id: `menu_${menuIndex}`,
            task: `${menu.item}${menu.cantidad ? ` (${menu.cantidad})` : ''}`,
            completed: false,
            assignedTo: '',
            priority: 'alta',
            tipoMenu: menu.tipo,
            hora: menu.hora || '',
            proveedor: menu.proveedor || ''
          });
        }
      });
    }

    // Generar checklist de bebidas
    if (hojaRuta.bebidas && hojaRuta.bebidas.length > 0) {
      hojaRuta.bebidas.forEach((bebida, index) => {
        if (bebida.item) {
          checklistElementos.bebidas.push({
            id: `bebida_${index}`,
            task: `${bebida.item}${bebida.cantidad ? ` (${bebida.cantidad}${bebida.unidad ? ' ' + bebida.unidad : ''})` : ''}`,
            completed: false,
            assignedTo: '',
            priority: 'alta'
          });
        }
      });
    }

    return checklistElementos;
  }

  // Actualizar checklist elementos (generar automáticamente)
  async actualizarChecklistElementos(hojaId) {
    try {
      const hoja = await this.getHojaRuta(hojaId);
      if (!hoja) return null;

      // Generar nuevas checklists basándose en los elementos actuales
      const nuevasChecklists = this.generarChecklistElementos(hoja);

      // Obtener checklist actual para mantener estados existentes
      const checklistActual = hoja.checklist || {
        general: { preEvento: [], duranteEvento: [], postEvento: [] },
        equipamiento: [],
        menus: [],
        bebidas: []
      };

      // Mantener el estado de las tareas existentes
      ['equipamiento', 'menus', 'bebidas'].forEach(tipo => {
        if (checklistActual[tipo] && checklistActual[tipo].length > 0) {
          nuevasChecklists[tipo].forEach(nuevaTarea => {
            const tareaExistente = checklistActual[tipo].find(t => t.task === nuevaTarea.task);
            if (tareaExistente) {
              nuevaTarea.completed = tareaExistente.completed;
              nuevaTarea.assignedTo = tareaExistente.assignedTo;
            }
          });
        }
      });

      // Actualizar checklist en BD
      const todasLasTareas = [];

      // Checklist general (mantener como está)
      if (checklistActual.general) {
        Object.entries(checklistActual.general).forEach(([fase, tareasFase]) => {
          if (Array.isArray(tareasFase)) {
            tareasFase.forEach(t => {
              todasLasTareas.push({
                hoja_ruta_id: hojaId,
                tipo: 'general',
                fase: fase,
                tarea_id: t.id,
                task: t.task,
                completed: t.completed || false,
                assigned_to: t.assignedTo || null,
                priority: t.priority || 'media'
              });
            });
          }
        });
      }

      // Checklists específicas (actualizadas)
      ['equipamiento', 'menus', 'bebidas'].forEach(tipo => {
        nuevasChecklists[tipo].forEach(t => {
          todasLasTareas.push({
            hoja_ruta_id: hojaId,
            tipo: tipo,
            fase: null,
            tarea_id: t.id,
            task: t.task,
            completed: t.completed || false,
            assigned_to: t.assignedTo || null,
            priority: t.priority || 'media'
          });
        });
      });

      // Eliminar checklist existente y crear nuevo
      await supabase
        .from('hojas_ruta_checklist')
        .delete()
        .eq('hoja_ruta_id', hojaId);

      if (todasLasTareas.length > 0) {
        const { error } = await supabase
          .from('hojas_ruta_checklist')
          .insert(todasLasTareas);

        if (error) throw error;
      }

      return await this.getHojaRuta(hojaId);
    } catch (error) {
      console.error('❌ Error actualizando checklist elementos:', error);
      throw error;
    }
  }

  // Obtener estadísticas del checklist
  async obtenerEstadisticasChecklist(hojaId) {
    try {
      const hoja = await this.getHojaRuta(hojaId);
      if (!hoja) return null;

      const checklist = hoja.checklist || {
        general: { preEvento: [], duranteEvento: [], postEvento: [] },
        equipamiento: [],
        menus: [],
        bebidas: []
      };

      // Combinar todas las tareas
      const todasLasTareas = [
        ...(checklist.general.preEvento || []),
        ...(checklist.general.duranteEvento || []),
        ...(checklist.general.postEvento || []),
        ...(checklist.equipamiento || []),
        ...(checklist.menus || []),
        ...(checklist.bebidas || [])
      ];

      const completadas = todasLasTareas.filter(t => t.completed).length;
      const total = todasLasTareas.length;
      const porcentaje = total > 0 ? Math.round((completadas / total) * 100) : 0;

      return {
        total,
        completadas,
        pendientes: total - completadas,
        porcentaje,
        porFase: {
          preEvento: {
            total: (checklist.general.preEvento || []).length,
            completadas: (checklist.general.preEvento || []).filter(t => t.completed).length
          },
          duranteEvento: {
            total: (checklist.general.duranteEvento || []).length,
            completadas: (checklist.general.duranteEvento || []).filter(t => t.completed).length
          },
          postEvento: {
            total: (checklist.general.postEvento || []).length,
            completadas: (checklist.general.postEvento || []).filter(t => t.completed).length
          }
        },
        porElemento: {
          equipamiento: {
            total: (checklist.equipamiento || []).length,
            completadas: (checklist.equipamiento || []).filter(t => t.completed).length
          },
          menus: {
            total: (checklist.menus || []).length,
            completadas: (checklist.menus || []).filter(t => t.completed).length
          },
          bebidas: {
            total: (checklist.bebidas || []).length,
            completadas: (checklist.bebidas || []).filter(t => t.completed).length
          }
        }
      };
    } catch (error) {
      console.error('❌ Error obteniendo estadísticas:', error);
      return null;
    }
  }
}

export default new HojaRutaSupabaseService();

