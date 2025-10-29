// Función mejorada para procesar diferentes formatos de hojas de ruta
function createFlexibleProcessor() {
  return {
    // Detectar automáticamente el formato
    detectFormat(lines) {
      const format = {
        separator: ',',
        hasHeaders: false,
        fieldMappings: {},
        menuPatterns: [],
        equipmentPatterns: []
      };

      // Detectar separador
      const separators = [',', ';', '\t', '|'];
      const separatorCounts = {};
      
      separators.forEach(sep => {
        const count = lines.slice(0, 5).reduce((acc, line) => {
          return acc + (line.split(sep).length - 1);
        }, 0);
        separatorCounts[sep] = count;
      });
      
      format.separator = Object.entries(separatorCounts)
        .sort(([,a], [,b]) => b - a)[0][0];

      // Detectar campos por patrones flexibles
      const fieldPatterns = {
        fecha: ['fecha', 'date', 'servicio'],
        cliente: ['cliente', 'client', 'empresa', 'company'],
        contacto: ['contacto', 'contact', 'telefono', 'phone', 'mobil', 'mobile'],
        direccion: ['direccion', 'address', 'ubicacion', 'location'],
        transportista: ['transportista', 'transporter', 'conductor', 'driver'],
        personal: ['personal', 'staff', 'equipo', 'team'],
        responsable: ['responsable', 'responsible', 'encargado', 'manager'],
        personas: ['personas', 'people', 'comensales', 'guests', 'nº', 'numero']
      };

      // Buscar campos en las líneas
      lines.slice(0, 20).forEach((line, lineIndex) => {
        const lowerLine = line.toLowerCase();
        
        Object.entries(fieldPatterns).forEach(([field, patterns]) => {
          patterns.forEach(pattern => {
            if (lowerLine.includes(pattern)) {
              const parts = line.split(format.separator);
              // Buscar el valor en las columnas adyacentes
              const fieldIndex = parts.findIndex(part => 
                part.toLowerCase().includes(pattern)
              );
              
              if (fieldIndex !== -1) {
                // El valor suele estar en la siguiente columna o en la columna 3
                const valueIndex = fieldIndex + 1 < parts.length ? fieldIndex + 1 : 3;
                format.fieldMappings[field] = {
                  line: lineIndex,
                  fieldIndex,
                  valueIndex,
                  pattern
                };
              }
            }
          });
        });
      });

      return format;
    },

    // Procesar con formato detectado
    processWithFormat(lines, format) {
      const data = {
        fechaCreacion: new Date().toISOString(),
        fechaServicio: '',
        cliente: '',
        contacto: '',
        direccion: '',
        transportista: '',
        personal: '',
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
        notas: []
      };

      // Procesar campos detectados
      Object.entries(format.fieldMappings).forEach(([field, mapping]) => {
        const line = lines[mapping.line];
        const parts = line.split(format.separator);
        
        if (parts[mapping.valueIndex]) {
          const value = parts[mapping.valueIndex].trim();
          
          switch (field) {
            case 'fecha':
              data.fechaServicio = this.parseFlexibleDate(value);
              break;
            case 'cliente':
              data.cliente = value;
              break;
            case 'contacto':
              data.contacto = value;
              break;
            case 'direccion':
              data.direccion = value;
              break;
            case 'transportista':
              data.transportista = value;
              break;
            case 'personal':
              data.personal = value;
              break;
            case 'responsable':
              data.responsable = value;
              break;
            case 'personas':
              data.numPersonas = parseInt(value) || 0;
              break;
          }
        }
      });

      // Procesar horarios con patrones flexibles
      const horarioPatterns = {
        montaje: ['montaje', 'setup', 'instalacion'],
        welcome: ['welcome', 'bienvenida', 'recepcion'],
        desayuno: ['desayuno', 'breakfast', 'almuerzo'],
        comida: ['comida', 'lunch', 'almuerzo'],
        recogida: ['recogida', 'pickup', 'retirada']
      };

      lines.forEach(line => {
        const lowerLine = line.toLowerCase();
        const parts = line.split(format.separator);
        
        Object.entries(horarioPatterns).forEach(([horario, patterns]) => {
          patterns.forEach(pattern => {
            if (lowerLine.includes(pattern) && lowerLine.includes('hora')) {
              // Buscar la hora en las columnas
              const horaMatch = line.match(/(\d{1,2}[:\.]\d{2})/);
              if (horaMatch) {
                data.horarios[horario] = horaMatch[1].replace('.', ':');
              }
            }
          });
        });
      });

      // Procesar equipamiento y menús de manera más flexible
      lines.forEach(line => {
        const parts = line.split(format.separator);
        const firstColumn = parts[0]?.trim();
        
        if (firstColumn) {
          // Equipamiento - cualquier item que parezca material
          if (this.looksLikeEquipment(firstColumn)) {
            data.equipamiento.push({
              item: firstColumn,
              cantidad: parts[1] || '',
              notas: parts[2] || '',
              orden: data.equipamiento.length
            });
          }
          
          // Menús - cualquier item que parezca comida
          if (this.looksLikeMenu(firstColumn)) {
            data.menus.push({
              tipo: 'general',
              hora: '',
              item: firstColumn,
              cantidad: parts[1] || '',
              proveedor: parts[2] || '',
              orden: data.menus.length
            });
          }
          
          // Bebidas
          if (this.looksLikeBeverage(firstColumn)) {
            data.bebidas.push({
              item: firstColumn,
              cantidad: parts[1] || '',
              unidad: parts[2] || '',
              orden: data.bebidas.length
            });
          }
        }
      });

      return data;
    },

    // Funciones auxiliares
    parseFlexibleDate(dateStr) {
      if (!dateStr) return '';
      
      // Intentar diferentes formatos de fecha
      const formats = [
        /(\d{1,2})[\/\.\-](\d{1,2})[\/\.\-](\d{4})/, // DD/MM/YYYY o DD.MM.YYYY
        /(\d{4})[\/\.\-](\d{1,2})[\/\.\-](\d{1,2})/, // YYYY/MM/DD
        /(\d{1,2})\s+de\s+(\w+)\s+de\s+(\d{4})/i, // DD de MMMM de YYYY
      ];
      
      for (const format of formats) {
        const match = dateStr.match(format);
        if (match) {
          try {
            let date;
            if (format === formats[0]) {
              // DD/MM/YYYY
              date = new Date(`${match[3]}-${match[2].padStart(2, '0')}-${match[1].padStart(2, '0')}`);
            } else if (format === formats[1]) {
              // YYYY/MM/DD
              date = new Date(`${match[1]}-${match[2].padStart(2, '0')}-${match[3].padStart(2, '0')}`);
            } else if (format === formats[2]) {
              // DD de MMMM de YYYY
              const months = {
                'enero': '01', 'febrero': '02', 'marzo': '03', 'abril': '04',
                'mayo': '05', 'junio': '06', 'julio': '07', 'agosto': '08',
                'septiembre': '09', 'octubre': '10', 'noviembre': '11', 'diciembre': '12'
              };
              const month = months[match[2].toLowerCase()];
              if (month) {
                date = new Date(`${match[3]}-${month}-${match[1].padStart(2, '0')}`);
              }
            }
            
            if (date && !isNaN(date.getTime())) {
              return date.toISOString().split('T')[0];
            }
          } catch (e) {
            continue;
          }
        }
      }
      
      return dateStr; // Devolver original si no se puede parsear
    },

    looksLikeEquipment(item) {
      const equipmentKeywords = [
        'mesa', 'mantel', 'vaso', 'copa', 'cafetera', 'biombo', 'horno',
        'plato', 'cuchara', 'tenedor', 'cuchillo', 'servilleta', 'bandeja',
        'termo', 'calentador', 'display', 'roll', 'decoracion'
      ];
      
      return equipmentKeywords.some(keyword => 
        item.toLowerCase().includes(keyword)
      );
    },

    looksLikeMenu(item) {
      const menuKeywords = [
        'assortiment', 'galetes', 'cafè', 'tes', 'llet', 'croissant',
        'panet', 'fruita', 'iogurt', 'truita', 'broqueta', 'croqueta',
        'coca', 'petit four', 'refresco', 'vi', 'cava', 'brou'
      ];
      
      return menuKeywords.some(keyword => 
        item.toLowerCase().includes(keyword)
      );
    },

    looksLikeBeverage(item) {
      const beverageKeywords = [
        'refresco', 'coca cola', 'fanta', 'vino', 'cava', 'cerveza',
        'agua', 'zumo', 'botella', 'lata', 'hielo', 'bebida'
      ];
      
      return beverageKeywords.some(keyword => 
        item.toLowerCase().includes(keyword)
      );
    }
  };
}

// Exportar para uso en el servicio
export { createFlexibleProcessor };
