import * as XLSX from 'xlsx';
import { supabase } from '../config/supabase';
import { createFlexibleProcessor } from './flexibleHojaRutaProcessor';

class HojaRutaService {
  constructor() {
    this.storageKey = 'hojas_ruta';
    this.hojasRuta = this.loadFromStorage();
    this.flexibleProcessor = createFlexibleProcessor();
  }

  // Cargar datos desde localStorage
  loadFromStorage() {
    try {
      const stored = localStorage.getItem(this.storageKey);
      return stored ? JSON.parse(stored) : [];
    } catch (error) {
      console.error('Error cargando hojas de ruta desde localStorage:', error);
      return [];
    }
  }

  // Guardar datos en localStorage
  saveToStorage() {
    try {
      localStorage.setItem(this.storageKey, JSON.stringify(this.hojasRuta));
      return true;
    } catch (error) {
      console.error('Error guardando hojas de ruta en localStorage:', error);
      return false;
    }
  }

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

  // Procesar CSV y extraer datos estructurados
  processCSV(csvContent) {
    try {
      const lines = csvContent.split('\n');

      // Intentar primero el procesamiento estándar
      try {
        const standardData = this.processCSVStandard(lines);
        if (this.isValidStandardData(standardData)) {
          console.log('✅ Procesamiento estándar exitoso');
          return standardData;
        }
      } catch (error) {
        console.log('⚠️ Procesamiento estándar falló, intentando procesamiento flexible...');
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

  // Procesamiento estándar (método original)
  processCSVStandard(lines) {
    const data = {
      fechaCreacion: new Date().toISOString(),
      fechaServicio: '',
      cliente: '',
      contacto: '',
      direccion: '',
      transportista: '',
      personal: '',
      horasPersonal: [], // Array de objetos { nombre: string, horas: number, empleadoId?: string }
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
        // Checklist general (mantenemos la original)
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
        // Checklists específicas por elementos
        equipamiento: [],
        menus: [],
        bebidas: []
      },
      estadoServicio: 'preparacion', // preparacion, en_camino, montaje, servicio, recogida, completado
      notificaciones: []
    };

    // Procesar línea por línea
    let currentMenuType = null; // Para rastrear el menú actual

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

      // Detectar títulos de menú en la columna 3 (parts[3])
      if (parts[3] && this.isMenuTitle(parts[3])) {
        currentMenuType = this.getMenuTypeFromTitle(parts[3]);

        // Guardar el título completo para usar como encabezado
        data.menuTitles = data.menuTitles || {};
        data.menuTitles[currentMenuType] = parts[3];
      }

      // Equipamiento/Material - Solo items específicos
      if (this.isEquipamientoItem(parts[0])) {
        data.equipamiento.push({
          item: parts[0],
          cantidad: parts[1] || '',
          notas: parts[2] || '',
          orden: data.equipamiento.length
        });
      }

      // Items de menú - Solo si hay contenido en la columna 3 Y es un item de menú
      if (parts[3] && parts[3].length > 0 && this.isMenuItem(parts[3]) && currentMenuType) {
        data.menus.push({
          tipo: currentMenuType,
          hora: this.extractHora(parts[3]),
          item: parts[3],
          cantidad: parts[5] || '', // Columna F para cantidades de menús
          proveedor: parts[6] || '', // Columna G para proveedores de menús
          orden: data.menus.length
        });
      }

      // Bebidas - Más flexible
      if (this.isBebidaItem(parts[0]) || this.isAnyBebida(parts[0])) {
        data.bebidas.push({
          item: parts[0],
          cantidad: parts[1] || '',
          unidad: parts[2] || '',
          orden: data.bebidas.length
        });
      }

      // Notas importantes - Capturar TODAS las notas
      if (parts[2] && parts[2].includes('OJO!!!')) {
        data.notas.push(`${parts[0]}: ${parts[2]}`);
      }

      // Capturar notas de otras columnas
      if (parts[3] && parts[3].includes('OJO!!!')) {
        data.notas.push(`${parts[0]}: ${parts[3]}`);
      }
    }

    return data;
  }

  // Verificar si es un item de equipamiento
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

  // Detectar cualquier item que no sea información general
  isAnyItem(item) {
    if (!item) return false;

    // Excluir campos de información general
    const generalFields = [
      'HOJA DE RUTA', 'Fecha', 'Cliente', 'Contacto y Mobil', 'Direccion',
      'Transportista', 'PERSONAL', 'RESPONSABLE', 'Nº de personas',
      'Hora de montaje', 'HORA ENTREGA WELCOME', 'HORA WELCOME', 'HORA DESAYUNO',
      'HORA ENTREGA IDONI', 'HORA COMIDA', 'Hora de recogida'
    ];

    if (generalFields.includes(item)) return false;

    // Si tiene contenido y no es vacío, probablemente es un item
    return item.length > 0;
  }

  // Detectar títulos de menú en la columna 3
  isMenuTitle(text) {
    if (!text) return false;

    const menuTitles = [
      'MENÚ WELCOME', 'MENÚ PAUSA', 'MENU COMIDA', 'MENU DESAYUNO',
      'MENU ALMUERZO', 'MENU CENA', 'CAFETERAS', 'REFRESCOS'
    ];

    return menuTitles.some(title => text.includes(title));
  }

  // Obtener tipo de menú desde el título
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

  // Detectar items de menú por contenido
  isMenuItem(text) {
    if (!text) return false;

    // Excluir títulos de menú
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

  // Detectar tipo de menú por contenido
  detectMenuType(content) {
    if (!content) return null;

    if (content.includes('WELCOME') || content.includes('galetes')) return 'welcome';
    if (content.includes('PAUSA') || content.includes('crusants')) return 'pausa_cafe';
    if (content.includes('COMIDA') || content.includes('truita') || content.includes('Broqueta')) return 'comida';

    return null;
  }

  // Detectar cualquier bebida
  isAnyBebida(item) {
    if (!item) return false;

    const bebidaKeywords = [
      'REFRESCOS', 'COCA COLA', 'Fanta', 'VINO', 'CAVA', 'Hielo',
      'Cerveza', 'BIDONES', 'ZUMOS', 'BOTELLAS', 'LATAS'
    ];

    return bebidaKeywords.some(keyword => item.toUpperCase().includes(keyword));
  }

  // Verificar si es una sección de menú
  isMenuSection(item) {
    if (!item) return false;

    const menuSections = [
      'MENÚ WELCOME', 'MENÚ PAUSA', 'MENU COMIDA', 'MENU DESAYUNO',
      'MENU ALMUERZO', 'MENU CENA', 'CAFETERAS', 'REFRESCOS'
    ];

    return menuSections.some(section => item.includes(section));
  }

  // Obtener tipo de menú
  getMenuType(item) {
    if (!item) return 'general';

    if (item.includes('WELCOME')) return 'welcome';
    if (item.includes('PAUSA') || item.includes('CAFÈ')) return 'pausa_cafe';
    if (item.includes('COMIDA')) return 'comida';
    if (item.includes('DESAYUNO')) return 'desayuno';
    if (item.includes('ALMUERZO')) return 'almuerzo';
    if (item.includes('CENA')) return 'cena';
    if (item.includes('CAFETERAS')) return 'cafeteras';
    if (item.includes('REFRESCOS')) return 'refrescos';

    return 'general';
  }

  // Extraer hora del texto del menú
  extractHora(text) {
    const match = text.match(/(\d{1,2}:\d{2}H?)/);
    return match ? match[1] : '';
  }

  // Verificar si es un item de bebida
  isBebidaItem(item) {
    const bebidaItems = [
      'REFRESCOS', 'COCA COLA', 'Fanta Limon', 'Fanta Naranja',
      'VINO NEGRO', 'VINO BLANCO', 'CAVA', 'Hielo', 'Cerveza individual'
    ];
    return bebidaItems.includes(item);
  }

  // Subir nueva hoja de ruta desde Excel o CSV
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

      // Añadir metadatos
      hojaRutaData.id = this.generateId();
      hojaRutaData.creadoPor = userId;
      hojaRutaData.nombreArchivo = file.name;
      hojaRutaData.tipoArchivo = isExcel ? 'excel' : 'csv';

      // Guardar en localStorage
      this.hojasRuta.unshift(hojaRutaData); // Añadir al principio
      this.saveToStorage();

      // Crear notificación en base de datos si hay usuario
      if (userId) {
        // Obtener información del usuario desde Supabase
        const { data: userProfile } = await supabase
          .from('user_profiles')
          .select('*')
          .eq('id', userId)
          .single();

        if (userProfile) {
          await this.crearNotificacionHojaRuta(hojaRutaData, 'nueva', userProfile);
        }
      }

      return hojaRutaData;
    } catch (error) {
      console.error('Error subiendo archivo:', error);
      throw error;
    }
  }

  // Método legacy para mantener compatibilidad
  async uploadCSV(file, userId) {
    return this.uploadFile(file, userId);
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

  // Obtener última hoja de ruta
  getUltimaHojaRuta() {
    return this.hojasRuta.length > 0 ? this.hojasRuta[0] : null;
  }

  // Obtener histórico de hojas de ruta
  getHistorico() {
    return this.hojasRuta.slice(1); // Todas excepto la primera (actual)
  }

  // Obtener todas las hojas de ruta
  getAllHojasRuta() {
    return this.hojasRuta;
  }

  // Obtener hoja de ruta por ID
  getHojaRutaById(id) {
    return this.hojasRuta.find(hoja => hoja.id === id);
  }

  // Actualizar hoja de ruta
  updateHojaRuta(id, updates) {
    const index = this.hojasRuta.findIndex(hoja => hoja.id === id);
    if (index !== -1) {
      this.hojasRuta[index] = { ...this.hojasRuta[index], ...updates };
      this.saveToStorage();
      return this.hojasRuta[index];
    }
    return null;
  }

  // Eliminar hoja de ruta
  deleteHojaRuta(id) {
    const index = this.hojasRuta.findIndex(hoja => hoja.id === id);
    if (index !== -1) {
      const deleted = this.hojasRuta.splice(index, 1)[0];
      this.saveToStorage();
      return deleted;
    }
    return null;
  }

  // Firmar hoja de ruta
  firmarHojaRuta(id, firmaData, firmadoPor) {
    const index = this.hojasRuta.findIndex(hoja => hoja.id === id);
    if (index !== -1) {
      // Verificar si ya está firmada
      if (this.hojasRuta[index].firmaInfo?.firmado) {
        throw new Error('Esta hoja de ruta ya está firmada y no se puede modificar la firma');
      }

      this.hojasRuta[index].firmaInfo = {
        firmado: true,
        firmadoPor: firmadoPor,
        fechaFirma: new Date().toISOString(),
        firmaData: firmaData
      };
      // Mantener compatibilidad con el campo anterior
      this.hojasRuta[index].firmaResponsable = firmaData;
      this.saveToStorage();
      return this.hojasRuta[index];
    }
    return null;
  }

  // Obtener estadísticas
  getEstadisticas() {
    return {
      total: this.hojasRuta.length,
      ultimaActualizacion: this.hojasRuta.length > 0 ? this.hojasRuta[0].fechaCreacion : null,
      clientesUnicos: [...new Set(this.hojasRuta.map(hoja => hoja.cliente))].length
    };
  }

  // Parsear línea CSV manejando comillas correctamente
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

    // Añadir el último campo
    result.push(current.trim());

    return result;
  }

  // Parsear fecha desde formato "MARTES 20.05.2025"
  parseFecha(fechaStr) {
    try {
      // Remover el día de la semana y limpiar
      const fechaLimpia = fechaStr.replace(/^[A-ZÁÉÍÓÚÑ]+/, '').trim();

      // Parsear formato DD.MM.YYYY
      const partes = fechaLimpia.split('.');
      if (partes.length === 3) {
        const dia = partes[0];
        const mes = partes[1];
        const año = partes[2];

        // Crear fecha en formato ISO
        const fecha = new Date(`${año}-${mes}-${dia}`);

        // Verificar que la fecha es válida
        if (!isNaN(fecha.getTime())) {
          return fecha.toISOString().split('T')[0]; // Retornar YYYY-MM-DD
        }
      }

      // Si no se puede parsear, retornar la fecha original
      console.warn('⚠️ No se pudo parsear la fecha:', fechaStr);
      return fechaStr;
    } catch (error) {
      console.error('❌ Error parseando fecha:', error);
      return fechaStr;
    }
  }
  // Validar si los datos estándar son válidos
  isValidStandardData(data) {
    // Considerar válido si tiene al menos cliente y responsable
    return data.cliente && data.responsable;
  }

  // Métodos para notificaciones en base de datos
  async crearNotificacionHojaRuta(hojaRuta, tipo, user) {
    if (!user?.id) return;

    try {
      // Obtener todos los usuarios para enviar la notificación
      const { data: users, error: usersError } = await supabase
        .from('user_profiles')
        .select('id');

      if (usersError) {
        console.error('Error obteniendo usuarios:', usersError);
        return;
      }

      let title, message;

      if (tipo === 'nueva') {
        title = 'Nueva Hoja de Ruta';
        message = `Nueva hoja de ruta para "${hojaRuta.cliente}" creada por ${user.name || user.email}`;
      } else if (tipo === 'checklist_completada') {
        title = 'Tarea Completada';
        message = `Tarea completada en "${hojaRuta.cliente}" por ${user.name || user.email}`;
      }

      // Crear notificaciones para todos los usuarios (excepto el creador)
      const notifications = users
        .filter(u => u.id !== user.id)
        .map(u => ({
          recipient_id: u.id,
          sender_id: user.id,
          title: title,
          message: message,
          type: 'system',
          data: {
            hoja_ruta_id: hojaRuta.id,
            cliente: hojaRuta.cliente,
            fecha_servicio: hojaRuta.fechaServicio,
            tipo: tipo,
            responsable: hojaRuta.responsable || 'No asignado',
            direccion: hojaRuta.direccion || 'No especificada',
            num_personas: hojaRuta.numPersonas || 0,
            contacto: hojaRuta.contacto || 'No especificado',
            transportista: hojaRuta.transportista || 'No asignado',
            personal: hojaRuta.personal || 'No asignado',
            action_by: user.name || user.email,
            action_type: tipo === 'nueva' ? 'created' : 'task_completed',
            navigation_target: 'hoja_ruta'
          },
          read_at: null,
          created_at: new Date().toISOString()
        }));

      const { error: notificationError } = await supabase
        .from('notifications')
        .insert(notifications);

      if (notificationError) {
        console.error('Error creando notificaciones de hoja de ruta:', notificationError);
      } else {
        console.log('✅ Notificaciones de hoja de ruta creadas:', notifications.length);
      }
    } catch (error) {
      console.error('Error en notificación de hoja de ruta:', error);
    }
  }

  // Métodos para gestión de checklist
  async actualizarTareaChecklist(id, tipo, fase, tareaId, completed, assignedTo = '') {
    console.log('📝 Actualizando tarea checklist:', { id, tipo, fase, tareaId, completed, assignedTo });
    const index = this.hojasRuta.findIndex(hoja => hoja.id === id);
    if (index !== -1) {
      // Migrar si es necesario
      this.migrarChecklistAntiguo(this.hojasRuta[index]);

      let tarea;

      if (tipo === 'general') {
        tarea = this.hojasRuta[index].checklist.general[fase].find(t => t.id === tareaId);
      } else {
        tarea = this.hojasRuta[index].checklist[tipo].find(t => t.id === tareaId);
      }

      if (tarea) {
        console.log('✅ Tarea encontrada, actualizando:', tarea);

        // Crear una copia profunda para evitar mutación directa
        const hojaActualizada = JSON.parse(JSON.stringify(this.hojasRuta[index]));

        // Encontrar la tarea en la copia
        let tareaCopia;
        if (tipo === 'general') {
          tareaCopia = hojaActualizada.checklist.general[fase].find(t => t.id === tareaId);
        } else {
          tareaCopia = hojaActualizada.checklist[tipo].find(t => t.id === tareaId);
        }

        if (tareaCopia) {
          tareaCopia.completed = completed;
          tareaCopia.assignedTo = assignedTo;
          tareaCopia.completedAt = completed ? new Date().toISOString() : null;

          // Reemplazar la hoja original con la copia actualizada
          this.hojasRuta[index] = hojaActualizada;
          this.saveToStorage();

          // Crear notificación en base de datos si se completó la tarea
          if (completed && assignedTo) {
            console.log('🔔 Intentando crear notificación para:', { completed, assignedTo });

            // Obtener información del usuario desde Supabase
            // assignedTo puede ser email o nombre, intentar ambos
            let userProfile = null;

            // Primero intentar por email
            const { data: userByEmail } = await supabase
              .from('user_profiles')
              .select('*')
              .eq('email', assignedTo)
              .single();

            if (userByEmail) {
              userProfile = userByEmail;
              console.log('✅ Usuario encontrado por email:', userProfile);
            } else {
              // Si no se encuentra por email, intentar por nombre
              const { data: userByName } = await supabase
                .from('user_profiles')
                .select('*')
                .eq('name', assignedTo)
                .single();

              if (userByName) {
                userProfile = userByName;
                console.log('✅ Usuario encontrado por nombre:', userProfile);
              }
            }

            if (userProfile) {
              console.log('📤 Creando notificación con usuario:', userProfile);
              await this.crearNotificacionHojaRuta(hojaActualizada, 'checklist_completada', userProfile);
            } else {
              console.log('❌ No se encontró el usuario:', assignedTo);
            }
          } else {
            console.log('⚠️ No se crea notificación:', { completed, assignedTo });
          }

          console.log('💾 Hoja actualizada:', hojaActualizada);
          return hojaActualizada;
        } else {
          console.log('❌ Tarea no encontrada en la copia');
        }
      } else {
        console.log('❌ Tarea no encontrada');
      }
    } else {
      console.log('❌ Hoja no encontrada');
    }
    return null;
  }

  // Mapeo de tipos de menú a nombres descriptivos
  mapeoTiposMenu = {
    'welcome': 'Bienvenida',
    'pausa_cafe': 'Coffee Break',
    'desayuno': 'Desayuno',
    'almuerzo': 'Almuerzo',
    'comida': 'Comida',
    'merienda': 'Merienda',
    'cena': 'Cena',
    'entrante': 'Entrante',
    'plato_principal': 'Plato Principal',
    'postre': 'Postre',
    'aperitivo': 'Aperitivo',
    'snack': 'Snack',
    'general': 'Menú General'
  };

  // Generar checklist automática basándose en los elementos de la hoja de ruta
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
          priority: 'alta',
          fase: 'preEvento',
          tipo: 'equipamiento',
          notas: item.notas || '',
          cantidad: item.cantidad || ''
        });
      });
    }

    // Generar checklist de menús (elementos específicos de cada menú)
    if (hojaRuta.menus && hojaRuta.menus.length > 0) {
      hojaRuta.menus.forEach((menu, menuIndex) => {
        // Usar el campo 'item' que contiene el elemento específico del menú
        if (menu.item) {
          checklistElementos.menus.push({
            id: `menu_${menuIndex}`,
            task: `${menu.item}${menu.cantidad ? ` (${menu.cantidad})` : ''}`,
            completed: false,
            assignedTo: '',
            priority: 'alta',
            fase: 'duranteEvento',
            tipo: 'menu',
            notas: menu.notas || '',
            cantidad: menu.cantidad || '',
            tipoMenu: menu.tipo,
            hora: menu.hora || '',
            proveedor: menu.proveedor || ''
          });
        }
      });
    }

    // Generar checklist de bebidas (elementos específicos)
    if (hojaRuta.bebidas && hojaRuta.bebidas.length > 0) {
      hojaRuta.bebidas.forEach((bebida, index) => {
        // Usar el campo 'item' que contiene el elemento específico de la bebida
        if (bebida.item) {
          checklistElementos.bebidas.push({
            id: `bebida_${index}`,
            task: `${bebida.item}${bebida.cantidad ? ` (${bebida.cantidad})` : ''}`,
            completed: false,
            assignedTo: '',
            priority: 'media',
            fase: 'duranteEvento',
            tipo: 'bebida',
            notas: bebida.notas || '',
            cantidad: bebida.cantidad || '',
            unidad: bebida.unidad || ''
          });
        }
      });
    }

    return checklistElementos;
  }

  // Actualizar checklist de elementos cuando se carga una hoja de ruta
  actualizarChecklistElementos(hojaId) {
    const index = this.hojasRuta.findIndex(hoja => hoja.id === hojaId);
    if (index !== -1) {
      const hoja = this.hojasRuta[index];

      // Migrar si es necesario
      this.migrarChecklistAntiguo(hoja);

      // Generar nuevas checklists basándose en los elementos actuales
      const nuevasChecklists = this.generarChecklistElementos(hoja);

      // Mantener el estado de las tareas existentes
      ['equipamiento', 'menus', 'bebidas'].forEach(tipo => {
        if (hoja.checklist[tipo] && hoja.checklist[tipo].length > 0) {
          // Mantener el estado de las tareas existentes
          nuevasChecklists[tipo].forEach(nuevaTarea => {
            const tareaExistente = hoja.checklist[tipo].find(t => t.task === nuevaTarea.task);
            if (tareaExistente) {
              nuevaTarea.completed = tareaExistente.completed;
              nuevaTarea.assignedTo = tareaExistente.assignedTo;
              nuevaTarea.completedAt = tareaExistente.completedAt;
            }
          });
        }

        // Actualizar la checklist
        hoja.checklist[tipo] = nuevasChecklists[tipo];
      });

      this.saveToStorage();
      return hoja;
    }
    return null;
  }

  cambiarEstadoServicio(id, nuevoEstado) {
    const index = this.hojasRuta.findIndex(hoja => hoja.id === id);
    if (index !== -1) {
      const estadoAnterior = this.hojasRuta[index].estadoServicio;
      this.hojasRuta[index].estadoServicio = nuevoEstado;
      this.saveToStorage();

      // Crear notificación de cambio de estado
      this.crearNotificacionEstado(id, estadoAnterior, nuevoEstado);

      return this.hojasRuta[index];
    }
    return null;
  }

  // Crear notificaciones para cambios de estado del servicio
  crearNotificacionEstado(hojaId, estadoAnterior, estadoNuevo) {
    const hoja = this.hojasRuta.find(h => h.id === hojaId);
    if (!hoja) return;

    const estadosLabels = {
      'preparacion': 'Preparación',
      'en_camino': 'En Camino',
      'montaje': 'Montaje',
      'servicio': 'Servicio',
      'recogida': 'Recogida',
      'completado': 'Completado'
    };

    const iconosEstados = {
      'preparacion': '📋',
      'en_camino': '🚚',
      'montaje': '🔧',
      'servicio': '🍽️',
      'recogida': '📦',
      'completado': '✅'
    };

    const notificacion = {
      id: Date.now().toString(),
      tipo: 'estado',
      titulo: `${iconosEstados[estadoNuevo]} Estado Actualizado`,
      mensaje: `El servicio para ${hoja.cliente} ha cambiado de estado: ${estadosLabels[estadoAnterior]} → ${estadosLabels[estadoNuevo]}`,
      fecha: new Date().toISOString(),
      leida: false,
      prioridad: 'alta',
      datos: {
        hojaId: hojaId,
        cliente: hoja.cliente,
        estadoAnterior: estadoAnterior,
        estadoNuevo: estadoNuevo
      }
    };

    // Añadir a la lista de notificaciones de la hoja
    hoja.notificaciones.unshift(notificacion);

    // Mantener solo las últimas 50 notificaciones
    if (hoja.notificaciones.length > 50) {
      hoja.notificaciones = hoja.notificaciones.slice(0, 50);
    }

    this.saveToStorage();
  }

  // Marcar notificación como leída
  marcarNotificacionLeida(hojaId, notificacionId) {
    const index = this.hojasRuta.findIndex(hoja => hoja.id === hojaId);
    if (index !== -1) {
      const notificacion = this.hojasRuta[index].notificaciones.find(n => n.id === notificacionId);
      if (notificacion) {
        notificacion.leida = true;
        this.saveToStorage();
        return true;
      }
    }
    return false;
  }

  // Migrar checklist antiguo al nuevo formato
  migrarChecklistAntiguo(hoja) {
    if (!hoja.checklist) {
      // Si no hay checklist, crear uno nuevo
      hoja.checklist = {
        general: {
          preEvento: [],
          duranteEvento: [],
          postEvento: []
        },
        equipamiento: [],
        menus: [],
        bebidas: []
      };
      return hoja;
    }

    // Si tiene el formato antiguo (sin .general), migrar
    if (hoja.checklist.preEvento && !hoja.checklist.general) {
      hoja.checklist = {
        general: {
          preEvento: hoja.checklist.preEvento || [],
          duranteEvento: hoja.checklist.duranteEvento || [],
          postEvento: hoja.checklist.postEvento || []
        },
        equipamiento: hoja.checklist.equipamiento || [],
        menus: hoja.checklist.menus || [],
        bebidas: hoja.checklist.bebidas || []
      };
    }

    // Asegurar que todas las propiedades existen
    if (!hoja.checklist.general) {
      hoja.checklist.general = {
        preEvento: [],
        duranteEvento: [],
        postEvento: []
      };
    }
    if (!hoja.checklist.equipamiento) hoja.checklist.equipamiento = [];
    if (!hoja.checklist.menus) hoja.checklist.menus = [];
    if (!hoja.checklist.bebidas) hoja.checklist.bebidas = [];

    return hoja;
  }

  // Obtener estadísticas del checklist
  obtenerEstadisticasChecklist(hojaId) {
    const hoja = this.hojasRuta.find(h => h.id === hojaId);
    if (!hoja) return null;

    // Migrar si es necesario
    const hojaMigrada = this.migrarChecklistAntiguo(hoja);

    // Combinar todas las tareas (general + específicas)
    const todasLasTareas = [
      ...hojaMigrada.checklist.general.preEvento,
      ...hojaMigrada.checklist.general.duranteEvento,
      ...hojaMigrada.checklist.general.postEvento,
      ...hojaMigrada.checklist.equipamiento,
      ...hojaMigrada.checklist.menus,
      ...hojaMigrada.checklist.bebidas
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
          total: hojaMigrada.checklist.general.preEvento.length,
          completadas: hojaMigrada.checklist.general.preEvento.filter(t => t.completed).length
        },
        duranteEvento: {
          total: hojaMigrada.checklist.general.duranteEvento.length,
          completadas: hojaMigrada.checklist.general.duranteEvento.filter(t => t.completed).length
        },
        postEvento: {
          total: hojaMigrada.checklist.general.postEvento.length,
          completadas: hojaMigrada.checklist.general.postEvento.filter(t => t.completed).length
        }
      },
      porElemento: {
        equipamiento: {
          total: hojaMigrada.checklist.equipamiento.length,
          completadas: hojaMigrada.checklist.equipamiento.filter(t => t.completed).length
        },
        menus: {
          total: hojaMigrada.checklist.menus.length,
          completadas: hojaMigrada.checklist.menus.filter(t => t.completed).length
        },
        bebidas: {
          total: hojaMigrada.checklist.bebidas.length,
          completadas: hojaMigrada.checklist.bebidas.filter(t => t.completed).length
        }
      }
    };
  }

  // Gestionar horas de personal
  actualizarHorasPersonal(hojaId, horasPersonal) {
    console.log('📝 Actualizando horas de personal:', { hojaId, horasPersonal });

    const hojaIndex = this.hojasRuta.findIndex(h => h.id === hojaId);
    if (hojaIndex === -1) {
      console.error('❌ Hoja de ruta no encontrada:', hojaId);
      return null;
    }

    // Crear copia profunda para React
    const hojaActualizada = JSON.parse(JSON.stringify(this.hojasRuta[hojaIndex]));
    hojaActualizada.horasPersonal = horasPersonal;

    // Actualizar en el array
    this.hojasRuta[hojaIndex] = hojaActualizada;

    // Guardar en localStorage
    this.saveToStorage();

    console.log('✅ Horas de personal actualizadas:', hojaActualizada.horasPersonal);
    return hojaActualizada;
  }

  // Obtener horas de personal de una hoja
  obtenerHorasPersonal(hojaId) {
    const hoja = this.hojasRuta.find(h => h.id === hojaId);
    return hoja ? hoja.horasPersonal || [] : [];
  }

  // Obtener histórico de servicios de un empleado
  obtenerHistorialServicios(empleadoId) {
    const historial = [];

    // Normalizar el empleadoId a string para comparación
    const empleadoIdBuscado = String(empleadoId);
    console.log('🔍 Buscando histórico para empleado ID:', empleadoIdBuscado);

    console.log('📋 Total hojas de ruta:', this.hojasRuta.length);

    this.hojasRuta.forEach((hoja, index) => {
      if (hoja.horasPersonal && Array.isArray(hoja.horasPersonal)) {
        console.log(`📝 Hoja ${index + 1} (${hoja.id}): ${hoja.horasPersonal.length} trabajadores asignados`);

        hoja.horasPersonal.forEach((h, idx) => {
          console.log(`  - Trabajador ${idx + 1}: nombre="${h.nombre}", empleadoId="${h.empleadoId}", horas=${h.horas}`);
        });

        const asignacion = hoja.horasPersonal.find(h => {
          // Comparar como strings para asegurar match
          if (!h.empleadoId) {
            return false;
          }
          const empleadoIdGuardado = String(h.empleadoId);
          const match = empleadoIdGuardado === empleadoIdBuscado;

          if (match) {
            console.log('✅ ENCONTRADA ASIGNACIÓN:');
            console.log('  - Hoja ID:', hoja.id);
            console.log('  - Cliente:', hoja.cliente);
            console.log('  - EmpleadoId buscado:', empleadoIdBuscado);
            console.log('  - EmpleadoId guardado:', empleadoIdGuardado);
            console.log('  - Nombre:', h.nombre);
            console.log('  - Horas:', h.horas);
          } else {
            // Solo mostrar los primeros 3 que no coinciden para no llenar la consola
            if (index === 0 && hoja.horasPersonal.indexOf(h) < 3) {
              console.log('❌ No coincide - Buscado:', empleadoIdBuscado, 'Guardado:', empleadoIdGuardado, 'Nombre:', h.nombre);
            }
          }
          return match;
        });

        if (asignacion && asignacion.horas > 0) {
          historial.push({
            hojaId: hoja.id,
            fechaServicio: hoja.fechaServicio,
            cliente: hoja.cliente,
            horas: asignacion.horas,
            nombre: asignacion.nombre,
            estado: hoja.estado || 'pendiente'
          });
        }
      } else {
        console.log(`⚠️ Hoja ${index + 1} (${hoja.id}): sin horasPersonal o no es array`);
      }
    });

    console.log('📊 Historial encontrado:', historial.length, 'servicios');

    // Ordenar por fecha de servicio (más reciente primero)
    return historial.sort((a, b) => {
      const fechaA = new Date(a.fechaServicio);
      const fechaB = new Date(b.fechaServicio);
      return fechaB - fechaA;
    });
  }

  // Obtener estadísticas de horas por empleado
  obtenerEstadisticasHorasEmpleado(empleadoId) {
    const historial = this.obtenerHistorialServicios(empleadoId);

    const estadisticas = {
      totalServicios: historial.length,
      totalHoras: historial.reduce((sum, servicio) => sum + servicio.horas, 0),
      promedioHoras: historial.length > 0 ? Math.round((historial.reduce((sum, servicio) => sum + servicio.horas, 0) / historial.length) * 10) / 10 : 0,
      serviciosCompletados: historial.filter(s => s.estado === 'completado').length,
      ultimoServicio: historial.length > 0 ? historial[0].fechaServicio : null
    };

    return estadisticas;
  }
}

export default new HojaRutaService();
