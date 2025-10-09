// Servicio para obtener empleados desde la API de Holded
import * as XLSX from 'xlsx';

const HOLDED_API_KEYS = {
  solucions: 'cfe50911f41fe8de885b167988773e09',
  menjar: '44758c63e2fc4dc5dd37a3eedc1ae580'
};

const HOLDED_TEAM_BASE_URL = 'https://api.holded.com/api/team/v1';

class HoldedEmployeesService {
  constructor() {
    this.baseUrl = HOLDED_TEAM_BASE_URL;
  }

  // Método genérico para hacer peticiones a la API usando IPC
  async makeRequest(endpoint, options = {}, company = 'solucions') {
    try {
      const apiKey = HOLDED_API_KEYS[company];
      if (!apiKey) {
        throw new Error(`API key no encontrada para la empresa: ${company}`);
      }

      const requestData = {
        url: `${this.baseUrl}${endpoint}`,
        options: {
          headers: {
            'Content-Type': 'application/json',
            'key': apiKey,
            ...options.headers
          },
          ...options
        }
      };

      // Verificar que la API de Electron esté disponible
      if (!window.electronAPI || !window.electronAPI.makeHoldedRequest) {
        throw new Error('API de Electron no disponible. La aplicación debe ejecutarse en modo Electron.');
      }

      // Usar IPC para hacer la petición desde el main process
      const response = await window.electronAPI.makeHoldedRequest(requestData);

      if (!response.ok) {
        // Manejo específico para error 402 (Payment Required)
        if (response.status === 402) {
          throw new Error(`Error 402: La cuenta de Holded para ${company} ha alcanzado el límite de uso gratuito. Es necesario actualizar la suscripción para continuar usando la API.`);
        }
        throw new Error(`Error en la API de Holded (${company}): ${response.status} ${response.statusText}`);
      }

      return response.data;
    } catch (error) {
      console.error(`Error en la petición a Holded API (${company}):`, error);
      
      // Si el error indica que la API key es inválida, dar un mensaje más claro
      if (error.message.includes('Unexpected token') || error.message.includes('<div')) {
        throw new Error(`API key de Holded inválida o no autorizada para ${company}. Verifica tu API key.`);
      }
      
      throw error;
    }
  }

  // Obtener todos los empleados
  async getEmployees(company = 'solucions') {
    try {
      const response = await this.makeRequest('/employees', {}, company);
      
      // La API de Holded puede devolver un array directamente o un objeto con propiedad 'data' o 'employees'
      let employees = response;
      
      if (response && typeof response === 'object') {
        if (Array.isArray(response)) {
          employees = response;
        } else if (Array.isArray(response.data)) {
          employees = response.data;
        } else if (Array.isArray(response.employees)) {
          employees = response.employees;
        } else if (Array.isArray(response.items)) {
          employees = response.items;
        } else {
          // Si es un objeto único, convertirlo en array
          employees = [response];
        }
      }
      
      return employees || [];
    } catch (error) {
      console.error(`Error obteniendo empleados de ${company}:`, error);
      throw error;
    }
  }

  // Obtener un empleado específico por ID
  async getEmployee(employeeId, company = 'solucions') {
    try {
      const employee = await this.makeRequest(`/employees/${employeeId}`, {}, company);
      return employee;
    } catch (error) {
      console.error(`Error obteniendo empleado ${employeeId} de ${company}:`, error);
      throw error;
    }
  }

  // Transformar datos de empleado de Holded a formato más legible
  transformEmployee(employee) {
    // Función auxiliar para convertir objetos a string
    const toString = (value) => {
      if (!value) return '';
      if (typeof value === 'string') return value;
      if (typeof value === 'object') {
        // Si es un objeto de dirección, construir string
        if (value.address || value.city || value.postalCode) {
          const parts = [
            value.address,
            value.city,
            value.postalCode,
            value.province,
            value.country
          ].filter(Boolean);
          return parts.join(', ');
        }
        // Para otros objetos, intentar convertir a JSON o devolver vacío
        try {
          return JSON.stringify(value);
        } catch {
          return '';
        }
      }
      return String(value);
    };

    // Función para calcular edad
    const calcularEdad = (fechaNacimiento) => {
      if (!fechaNacimiento) return '';
      const fecha = new Date(fechaNacimiento * 1000);
      const hoy = new Date();
      let edad = hoy.getFullYear() - fecha.getFullYear();
      const mes = hoy.getMonth() - fecha.getMonth();
      if (mes < 0 || (mes === 0 && hoy.getDate() < fecha.getDate())) {
        edad--;
      }
      return edad;
    };

    // Manejar dirección que puede venir como objeto o string
    let direccion = '';
    let ciudad = '';
    let codigoPostal = '';
    let pais = '';

    if (employee.address && typeof employee.address === 'object') {
      direccion = employee.address.address || '';
      ciudad = employee.address.city || '';
      codigoPostal = employee.address.postalCode || '';
      pais = employee.address.country || '';
    } else {
      direccion = toString(employee.address);
      ciudad = toString(employee.city);
      codigoPostal = toString(employee.postalCode || employee.zipCode);
      pais = toString(employee.country);
    }

    // Log para debugging - ver todos los campos disponibles
    console.log('🔍 Campos disponibles en Holded para empleado:', employee.name || employee.id);
    console.log('📋 Datos completos:', employee);

    return {
      id: toString(employee.id),
      nombre: toString(employee.name),
      apellidos: toString(employee.surname),
      nombreCompleto: `${employee.name || ''} ${employee.surname || ''}`.trim() || 'Sin nombre',
      email: toString(employee.email),
      telefono: toString(employee.mobile || employee.phone),
      puesto: toString(employee.position),
      departamento: toString(employee.department),
      fechaAlta: employee.startDate ? new Date(employee.startDate * 1000).toLocaleDateString('es-ES') : '',
      fechaBaja: employee.endDate ? new Date(employee.endDate * 1000).toLocaleDateString('es-ES') : null,
      activo: !employee.endDate || employee.endDate === 0,
      dni: toString(employee.dni || employee.nif),
      nss: toString(employee.socialSecurityNumber || employee.nss),
      direccion: direccion,
      ciudad: ciudad,
      codigoPostal: codigoPostal,
      pais: pais,
      fechaNacimiento: employee.birthDate ? new Date(employee.birthDate * 1000).toLocaleDateString('es-ES') : '',
      edad: calcularEdad(employee.birthDate),
      genero: toString(employee.gender),
      estadoCivil: toString(employee.maritalStatus),
      tipoContrato: toString(employee.contractType),
      salario: employee.salary || null,
      iban: toString(employee.iban),
      foto: toString(employee.photo || employee.avatar),
      notas: toString(employee.notes),
      
      // Campos adicionales que podrían estar en Holded
      jornadaSemanal: employee.weeklyHours || employee.weekly_hours || employee.hoursPerWeek || '',
      porcentajeJornada: employee.percentageHours || employee.percentage_hours || employee.workPercentage || '',
      codigoContrato: employee.contractCode || employee.contract_code || '',
      servicioSocial: employee.socialService || employee.social_service || '',
      colectivo: employee.collective || employee.targetGroup || '',
      subvencionPrevia: employee.previousSubsidy || employee.previous_subsidy || '',
      fechaInicioSubvencion: employee.subsidyStartDate ? new Date(employee.subsidyStartDate * 1000).toLocaleDateString('es-ES') : '',
      fechaFinSubvencion: employee.subsidyEndDate ? new Date(employee.subsidyEndDate * 1000).toLocaleDateString('es-ES') : '',
      
      // Mantener datos originales para análisis
      raw: employee
    };
  }

  // Obtener empleados con transformación
  async getEmployeesTransformed(company = 'solucions') {
    try {
      const employees = await this.getEmployees(company);
      return employees.map(emp => this.transformEmployee(emp));
    } catch (error) {
      throw error;
    }
  }

  // Filtrar empleados por estado (activos/inactivos)
  filterByStatus(employees, activeOnly = true) {
    return employees.filter(emp => emp.activo === activeOnly);
  }

  // Buscar empleados por nombre, email o DNI
  searchEmployees(employees, searchTerm) {
    if (!searchTerm || searchTerm.trim() === '') {
      return employees;
    }

    const term = searchTerm.toLowerCase().trim();
    return employees.filter(emp => 
      emp.nombreCompleto.toLowerCase().includes(term) ||
      emp.email.toLowerCase().includes(term) ||
      emp.dni.toLowerCase().includes(term) ||
      emp.puesto.toLowerCase().includes(term) ||
      emp.departamento.toLowerCase().includes(term)
    );
  }

  // Agrupar empleados por departamento
  groupByDepartment(employees) {
    const grouped = {};
    employees.forEach(emp => {
      const dept = emp.departamento || 'Sin Departamento';
      if (!grouped[dept]) {
        grouped[dept] = [];
      }
      grouped[dept].push(emp);
    });
    return grouped;
  }

  // Obtener estadísticas de empleados
  getStatistics(employees) {
    const total = employees.length;
    const activos = employees.filter(emp => emp.activo).length;
    const inactivos = total - activos;
    
    const departamentos = [...new Set(employees.map(emp => emp.departamento).filter(d => d))];
    const puestos = [...new Set(employees.map(emp => emp.puesto).filter(p => p))];

    return {
      total,
      activos,
      inactivos,
      departamentos: departamentos.length,
      puestos: puestos.length,
      listaDepartamentos: departamentos,
      listaPuestos: puestos
    };
  }

  // Preparar datos para export de subvención L2
  prepareSubsidyData(employees, selectedEmployees = []) {
    const employeesToExport = selectedEmployees.length > 0 
      ? employees.filter(emp => selectedEmployees.includes(emp.nombreCompleto))
      : employees;

    return employeesToExport.map(emp => ({
      // Datos básicos requeridos por Bruno
      'Nombre de la persona trabajadora': emp.nombreCompleto,
      'DNI/NIE de la trabajadora': emp.dni,
      'Nº de la Seguridad social de la trabajadora': emp.nss,
      'DNI/NIE anterior (si cambió)': '', // Campo manual
      'Género': emp.genero,
      'Edad': emp.edad,
      'Colectivo': emp.colectivo || '', // Campo manual si no está en Holded
      'Servicio social Público': emp.servicioSocial || '', // Campo manual
      'Subvención previa 2025': emp.subvencionPrevia || 'No', // Campo manual
      'Código de contrato': emp.codigoContrato || '', // Campo manual
      'Fecha inicio REAL del contrato': emp.fechaAlta,
      'Jornada semanal ordinaria empresa (horas)': '40', // Estándar, campo manual
      'Jornada semanal trabajadora (horas)': emp.jornadaSemanal || '', // Campo manual
      'Porcentaje sobre jornada ordinaria': emp.porcentajeJornada || '', // Campo manual
      'Fecha inicial período solicitado': '01/04/2025', // Fijo según Bruno
      'Fecha final período solicitado': '31/08/2025', // Fijo según Bruno
      
      // Datos adicionales útiles
      'Email': emp.email,
      'Teléfono': emp.telefono,
      'Puesto': emp.puesto,
      'Departamento': emp.departamento,
      'Fecha nacimiento': emp.fechaNacimiento,
      'Estado civil': emp.estadoCivil,
      'Tipo contrato': emp.tipoContrato,
      'IBAN': emp.iban,
      'Dirección': emp.direccion,
      'Ciudad': emp.ciudad,
      'Código postal': emp.codigoPostal,
      'País': emp.pais,
      'Activo': emp.activo ? 'Sí' : 'No',
      'Notas': emp.notas
    }));
  }

  // Exportar a Excel para subvención L2
  exportToExcelForSubsidy(employees, selectedEmployees = [], filename = 'empleados_subvencion_l2') {
    const data = this.prepareSubsidyData(employees, selectedEmployees);
    
    // Crear workbook
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(data);
    
    // Ajustar ancho de columnas
    const colWidths = [
      { wch: 25 }, // Nombre
      { wch: 15 }, // DNI
      { wch: 20 }, // NSS
      { wch: 15 }, // DNI anterior
      { wch: 8 },  // Género
      { wch: 6 },  // Edad
      { wch: 15 }, // Colectivo
      { wch: 20 }, // Servicio social
      { wch: 15 }, // Subvención previa
      { wch: 15 }, // Código contrato
      { wch: 18 }, // Fecha inicio
      { wch: 15 }, // Jornada empresa
      { wch: 15 }, // Jornada trabajadora
      { wch: 15 }, // Porcentaje
      { wch: 18 }, // Fecha inicial período
      { wch: 18 }, // Fecha final período
      { wch: 25 }, // Email
      { wch: 15 }, // Teléfono
      { wch: 20 }, // Puesto
      { wch: 15 }, // Departamento
      { wch: 12 }, // Fecha nacimiento
      { wch: 12 }, // Estado civil
      { wch: 15 }, // Tipo contrato
      { wch: 25 }, // IBAN
      { wch: 30 }, // Dirección
      { wch: 15 }, // Ciudad
      { wch: 12 }, // Código postal
      { wch: 10 }, // País
      { wch: 8 },  // Activo
      { wch: 30 }  // Notas
    ];
    
    ws['!cols'] = colWidths;
    
    // Añadir hoja al workbook
    XLSX.utils.book_append_sheet(wb, ws, 'Empleados Subvención L2');
    
    // Descargar archivo
    const timestamp = new Date().toISOString().slice(0, 19).replace(/[:-]/g, '');
    XLSX.writeFile(wb, `${filename}_${timestamp}.xlsx`);
    
    return data.length;
  }
}

export default new HoldedEmployeesService();

