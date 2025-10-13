import * as XLSX from 'xlsx';

class HojaRutaService {
  constructor() {
    this.storageKey = 'hojas_ruta';
    this.hojasRuta = this.loadFromStorage();
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
      const data = {
        fechaCreacion: new Date().toISOString(),
        fechaServicio: '',
        cliente: '',
        contacto: '',
        direccion: '',
        transportista: '',
        personal: '',
        responsable: '',
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
        notas: []
      };

      // Procesar línea por línea
      let currentMenuType = null; // Para rastrear el menú actual
      
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;

        const parts = this.parseCSVLine(line);
        
        // Debug: Log todas las líneas para ver qué se está procesando
        if (parts[0] && parts[0].length > 0) {
          console.log(`📝 Línea ${i}:`, parts);
        }
        
        // Información general
        if (parts[0] === 'Fecha' && parts[3]) {
          console.log('📅 Fecha detectada:', parts[3]);
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
          console.log('☕ Título de menú detectado:', parts[3], 'Tipo:', currentMenuType);
          
          // Guardar el título completo para usar como encabezado
          data.menuTitles = data.menuTitles || {};
          data.menuTitles[currentMenuType] = parts[3];
        }

        // Equipamiento/Material - Solo items específicos
        if (this.isEquipamientoItem(parts[0])) {
          console.log('🍴 Equipamiento detectado:', parts[0], 'Cantidad:', parts[1]);
          data.equipamiento.push({
            item: parts[0],
            cantidad: parts[1] || '',
            notas: parts[2] || '',
            orden: data.equipamiento.length
          });
        }

        // Items de menú - Solo si hay contenido en la columna 3 Y es un item de menú
        if (parts[3] && parts[3].length > 0 && this.isMenuItem(parts[3]) && currentMenuType) {
          console.log('☕ Item de menú detectado:', parts[3], 'Tipo:', currentMenuType);
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
          console.log('🥤 Bebida detectada:', parts[0], 'Cantidad:', parts[1]);
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
    } catch (error) {
      console.error('Error procesando CSV:', error);
      throw new Error('Error al procesar el archivo CSV');
    }
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
}

export default new HojaRutaService();
