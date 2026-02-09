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

  // Método genérico para hacer peticiones a la API
  async makeRequest(endpoint, options = {}, company = 'solucions') {
    try {
      const apiKey = HOLDED_API_KEYS[company];
      if (!apiKey) {
        throw new Error(`API key no encontrada para la empresa: ${company}`);
      }

      const url = `${this.baseUrl}${endpoint}`;
      const headers = {
        'Content-Type': 'application/json',
        'key': apiKey,
        ...options.headers
      };

      const response = await fetch(url, {
        method: 'GET',
        headers: headers,
        ...options
      });

      if (!response.ok) {
        // Manejo específico para error 402 (Payment Required)
        if (response.status === 402) {
          throw new Error(`Error 402: La cuenta de Holded para ${company} ha alcanzado el límite de uso gratuito. Es necesario actualizar la suscripción para continuar usando la API.`);
        }
        throw new Error(`Error en la API de Holded (${company}): ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      if (process.env.NODE_ENV === 'development') {
        console.log(`[Holded Employees] ${company} - ${endpoint} → OK`);
      }
      return data;
    } catch (error) {
      console.error(`Error en la petición a Holded API (${company}):`, error);
      
      // Manejo específico para errores de parsing JSON (respuesta HTML)
      if (error.message.includes('Unexpected token') && error.message.includes('<div')) {
        console.error(`❌ La API de Holded está devolviendo HTML en lugar de JSON para ${endpoint}`);
        console.error(`🔍 Esto puede indicar:`);
        console.error(`   - Problema de CORS (navegador bloqueando la petición)`);
        console.error(`   - API key inválida o sin permisos`);
        console.error(`   - Endpoint no existe o no está disponible`);
        console.error(`   - Límite de uso alcanzado`);
        throw new Error(`API de Holded devolvió HTML en lugar de JSON para ${endpoint}. Verifica la configuración.`);
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

  // Intentar obtener información sobre lugares de trabajo
  async getWorkplaces(company = 'solucions') {
    try {
      return await this.makeRequest('/workplaces', {}, company);
    } catch (error) {
      return [];
    }
  }

  // Intentar obtener información sobre equipos/teams
  async getTeams(company = 'solucions') {
    try {
      return await this.makeRequest('/teams', {}, company);
    } catch (error) {
      return [];
    }
  }

  // Intentar obtener información sobre políticas de vacaciones
  async getTimeOffPolicies(company = 'solucions') {
    try {
      return await this.makeRequest('/timeoff/policies', {}, company);
    } catch (error) {
      return [];
    }
  }

  // Intentar obtener información sobre supervisores
  async getSupervisors(company = 'solucions') {
    try {
      return await this.makeRequest('/supervisors', {}, company);
    } catch (error) {
      return [];
    }
  }


  // Método para explorar endpoints disponibles
  async exploreEndpoints(company = 'solucions') {
    const endpointsToTry = [
      '/workplaces',
      '/workplace',
      '/offices',
      '/office',
      '/locations',
      '/location',
      '/teams',
      '/team',
      '/departments',
      '/department',
      '/groups',
      '/group',
      '/timeoff/policies',
      '/timeoff/policy',
      '/policies',
      '/policy',
      '/supervisors',
      '/supervisor',
      '/managers',
      '/manager',
      '/contracts',
      '/contract',
      '/positions',
      '/position',
      '/roles',
      '/role'
    ];

    const results = {};

    for (const endpoint of endpointsToTry) {
      try {
        const data = await this.makeRequest(endpoint, {}, company);
        results[endpoint] = {
          success: true,
          data: data,
          count: Array.isArray(data) ? data.length : (data ? 1 : 0)
        };
      } catch (error) {
        results[endpoint] = {
          success: false,
          error: error.message
        };
      }
    }

    if (process.env.NODE_ENV === 'development') {
      const ok = Object.values(results).filter(r => r.success).length;
      const total = endpointsToTry.length;
      console.log(`[Holded Employees] ${company} - Endpoints: ${ok}/${total} OK`);
    }

    return results;
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

    return {
      // Datos básicos (usando campos reales de Holded)
      id: toString(employee.id),
      nombre: toString(employee.name),
      apellidos: toString(employee.lastName), // Usar lastName en lugar de surname
      nombreCompleto: `${employee.name || ''} ${employee.lastName || ''}`.trim() || 'Sin nombre',
      email: toString(employee.mainEmail || employee.email), // Usar mainEmail si está disponible
      telefono: toString(employee.mobile),
      telefonoEmpresa: toString(employee.companyPhone),
      
      // Datos laborales (usando campos reales)
      puesto: toString(employee.title), // Usar title en lugar de position
      departamento: toString(employee.teamIds?.[0]), // Usar teamIds
      fechaAlta: employee.startDate ? new Date(employee.startDate * 1000).toLocaleDateString('es-ES') : '',
      fechaBaja: employee.endDate ? new Date(employee.endDate * 1000).toLocaleDateString('es-ES') : null,
      activo: !employee.terminated, // Usar terminated en lugar de endDate
      terminado: employee.terminated ? new Date(employee.terminated * 1000).toLocaleDateString('es-ES') : null,
      tipoTerminacion: toString(employee.terminatedType),
      motivoTerminacion: toString(employee.terminatedReason),
      
      // Datos personales (usando campos reales)
      dni: toString(employee.code), // Usar code en lugar de dni/nif
      nss: toString(employee.socialSecurityNum), // Usar socialSecurityNum
      fechaNacimiento: employee.dateOfBirth ? new Date(employee.dateOfBirth * 1000).toLocaleDateString('es-ES') : '',
      edad: calcularEdad(employee.dateOfBirth), // Usar dateOfBirth
      genero: toString(employee.gender),
      nacionalidad: toString(employee.nationality),
      nivelAcademico: toString(employee.academicLevel),
      idiomas: employee.languages || [],
      idiomaPrincipal: toString(employee.mainLanguage),
      
      // Datos de dirección (usando campos reales)
      direccion: employee.address?.address || '',
      ciudad: employee.address?.city || '',
      codigoPostal: employee.address?.postalCode || '',
      provincia: employee.address?.province || '',
      pais: employee.address?.country || '',
      
      // Dirección fiscal (si es diferente)
      direccionFiscal: employee.fiscalAddress?.address || '',
      ciudadFiscal: employee.fiscalAddress?.city || '',
      codigoPostalFiscal: employee.fiscalAddress?.postalCode || '',
      provinciaFiscal: employee.fiscalAddress?.province || '',
      paisFiscal: employee.fiscalAddress?.country || '',
      residenciaFiscal: toString(employee.fiscalResidence),
      
      // Datos financieros
      iban: toString(employee.iban),
      cuentasNomina: employee.payrollAccounts || {},
      
      // Datos laborales adicionales
      lugarTrabajo: toString(employee.workplace),
      supervisor: toString(employee.reportingTo),
      supervisoresVacaciones: employee.timeOffSupervisors || [],
      politicaVacaciones: toString(employee.timeOffPolicyId),
      contratoActual: employee.currentContract || [],
      
      // Datos adicionales
      foto: toString(employee.photo || employee.avatar),
      notas: toString(employee.notes),
      tags: employee.tags || [],
      camposPersonalizados: employee.customFields || [],
      archivos: employee.files || [],
      
      // Campos para subvenciones (si están disponibles)
      colectivo: toString(employee.collective || employee.targetGroup),
      servicioSocial: toString(employee.socialService || employee.social_service),
      subvencionPrevia: toString(employee.previousSubsidy || employee.previous_subsidy),
      fechaInicioSubvencion: employee.subsidyStartDate ? new Date(employee.subsidyStartDate * 1000).toLocaleDateString('es-ES') : '',
      fechaFinSubvencion: employee.subsidyEndDate ? new Date(employee.subsidyEndDate * 1000).toLocaleDateString('es-ES') : '',
      
      // Campos legacy (mantener para compatibilidad)
      dniLegacy: toString(employee.dni || employee.nif),
      nssLegacy: toString(employee.socialSecurityNumber || employee.nss),
      puestoLegacy: toString(employee.position),
      departamentoLegacy: toString(employee.department),
      tipoContratoLegacy: toString(employee.contractType),
      salarioLegacy: employee.salary || null,
      jornadaSemanalLegacy: employee.weeklyHours || employee.weekly_hours || employee.hoursPerWeek || '',
      porcentajeJornadaLegacy: employee.percentageHours || employee.percentage_hours || employee.workPercentage || '',
      codigoContratoLegacy: employee.contractCode || employee.contract_code || '',
      
      // Mantener datos originales para análisis
      raw: employee
    };
  }

  // Obtener empleados con transformación
  async getEmployeesTransformed(company = 'solucions') {
    try {
      const employees = await this.getEmployees(company);
      const transformedEmployees = employees.map(emp => this.transformEmployee(emp));

      if (process.env.NODE_ENV === 'development') {
        const activos = employees.filter(emp => !emp.endDate || emp.endDate === 0).length;
        const inactivos = employees.filter(emp => emp.endDate && emp.endDate !== 0).length;
        console.log(`[Holded Employees] ${company} - Empleados: ${transformedEmployees.length} (activos: ${activos}, inactivos: ${inactivos})`);
      }

      return transformedEmployees;
    } catch (error) {
      console.error('❌ Error en getEmployeesTransformed:', error);
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
      emp.nss.toLowerCase().includes(term) ||
      emp.puesto.toLowerCase().includes(term) ||
      emp.departamento.toLowerCase().includes(term) ||
      emp.telefono.includes(term) ||
      emp.ciudad.toLowerCase().includes(term) ||
      emp.tags.some(tag => tag.toLowerCase().includes(term))
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
    const nacionalidades = [...new Set(employees.map(emp => emp.nacionalidad).filter(n => n))];
    const idiomas = [...new Set(employees.flatMap(emp => emp.idiomas).filter(i => i))];
    const ciudades = [...new Set(employees.map(emp => emp.ciudad).filter(c => c))];

    return {
      total,
      activos,
      inactivos,
      departamentos: departamentos.length,
      puestos: puestos.length,
      nacionalidades: nacionalidades.length,
      idiomas: idiomas.length,
      ciudades: ciudades.length,
      listaDepartamentos: departamentos,
      listaPuestos: puestos,
      listaNacionalidades: nacionalidades,
      listaIdiomas: idiomas,
      listaCiudades: ciudades
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

