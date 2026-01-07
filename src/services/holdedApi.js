// Servicio para la API de Holded
const HOLDED_API_KEYS = {
  solucions: 'cfe50911f41fe8de885b167988773e09',
  menjar: '44758c63e2fc4dc5dd37a3eedc1ae580'
};
const HOLDED_BASE_URL = 'https://api.holded.com/api/invoicing/v1';

class HoldedApiService {
  constructor() {
    this.baseUrl = HOLDED_BASE_URL;
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
      
      // Detectar diferentes tipos de errores y proporcionar mensajes más claros
      const errorMessage = error.message || '';
      
      // Error de parsing JSON (respuesta no válida)
      if (errorMessage.includes('Error parsing JSON') || errorMessage.includes('Unexpected token')) {
        // Verificar si es un error de servidor/gateway
        if (errorMessage.includes('upstream') || errorMessage.includes('502') || errorMessage.includes('503') || errorMessage.includes('504')) {
          throw new Error(`Error de conexión con Holded API (${company}): El servidor de Holded no está disponible temporalmente. Intenta de nuevo en unos momentos.`);
        }
        // Verificar si es un error de autenticación
        if (errorMessage.includes('401') || errorMessage.includes('403') || errorMessage.includes('autenticación')) {
          throw new Error(`API key de Holded inválida o no autorizada para ${company}. Verifica tu API key en Configuración > Conexiones.`);
        }
        // Error genérico de respuesta no válida
        throw new Error(`Error en la respuesta de Holded API (${company}): La respuesta no es válida. Verifica tu conexión a internet y las API keys.`);
      }
      
      // Error de autenticación explícito
      if (errorMessage.includes('autenticación') || errorMessage.includes('API key inválida')) {
        throw new Error(`API key de Holded inválida o no autorizada para ${company}. Verifica tu API key en Configuración > Conexiones.`);
      }
      
      // Error de servidor/gateway
      if (errorMessage.includes('servidor') || errorMessage.includes('gateway') || errorMessage.includes('502') || errorMessage.includes('503') || errorMessage.includes('504')) {
        throw new Error(`Error de conexión con Holded API (${company}): El servidor de Holded no está disponible temporalmente. Intenta de nuevo en unos momentos.`);
      }
      
      // Error de conexión
      if (errorMessage.includes('Request failed') || errorMessage.includes('ECONNREFUSED') || errorMessage.includes('ETIMEDOUT')) {
        throw new Error(`Error de conexión con Holded API (${company}): No se pudo conectar al servidor. Verifica tu conexión a internet.`);
      }
      
      // Si el error ya tiene un mensaje claro, lanzarlo tal cual
      throw error;
    }
  }

  // Método de prueba simple para verificar conexión
  async testConnection(company = 'solucions') {
    return this.makeRequest('/documents/purchase?page=1&limit=1', {}, company);
  }

  // Obtener compras (purchases) con filtros opcionales
  async getPurchases(params = {}, company = 'solucions') {
    const {
      page = 1,
      limit = 100,
      starttmp,
      endtmp,
      contactid,
      paid,
      billed,
      sort = 'created-desc'
    } = params;

    let endpoint = `/documents/purchase?page=${page}&limit=${limit}&sort=${sort}`;
    
    if (starttmp) endpoint += `&starttmp=${starttmp}`;
    if (endtmp) endpoint += `&endtmp=${endtmp}`;
    if (contactid) endpoint += `&contactid=${contactid}`;
    if (paid !== undefined) endpoint += `&paid=${paid}`;
    if (billed !== undefined) endpoint += `&billed=${billed}`;

    console.log(`📡 [Holded API] ${company} - Petición: ${endpoint}`);
    if (starttmp || endtmp) {
      const startDate = starttmp ? new Date(starttmp * 1000).toISOString() : 'N/A';
      const endDate = endtmp ? new Date(endtmp * 1000).toISOString() : 'N/A';
      console.log(`   📅 Filtros de fecha: ${startDate} a ${endDate}`);
    }

    const result = await this.makeRequest(endpoint, {}, company);
    
    console.log(`   ✅ Respuesta: ${Array.isArray(result) ? result.length : 0} facturas en página ${page}`);
    if (Array.isArray(result) && result.length > 0) {
      // Mostrar fechas de las primeras y últimas facturas
      const dates = result
        .map(doc => doc.date ? new Date(doc.date * 1000).toISOString().split('T')[0] : null)
        .filter(Boolean)
        .sort();
      if (dates.length > 0) {
        console.log(`   📆 Rango de fechas: ${dates[0]} a ${dates[dates.length - 1]}`);
      }
    }
    
    return result;
  }

  // Obtener compras pendientes (no pagadas)
  async getPendingPurchases(page = 1, limit = 100, company = 'solucions') {
    return this.getPurchases({
      page,
      limit,
      paid: '0' // 0 = not paid
    }, company);
  }

  // Obtener compras parcialmente pagadas (paid=2)
  async getPartiallyPaidPurchases(page = 1, limit = 100, company = 'solucions', year = null) {
    const params = {
      page,
      limit,
      paid: '2' // 2 = partially paid
    };
    
    // Si se especifica un año, añadir filtros de fecha (timestamps Unix)
    if (year) {
      const startDate = new Date(`${year}-01-01T00:00:00Z`);
      const endDate = new Date(`${year}-12-31T23:59:59Z`);
      params.starttmp = Math.floor(startDate.getTime() / 1000); // Timestamp en segundos
      params.endtmp = Math.floor(endDate.getTime() / 1000); // Timestamp en segundos
    }
    
    return await this.getPurchases(params, company);
  }

  // Obtener TODAS las compras parcialmente pagadas (todas las páginas)
  async getAllPartiallyPaidPurchasesPages(company = 'solucions', year = null) {
    console.log(`🔄 [Holded API] ${company} - Obteniendo todas las compras parcialmente pagadas${year ? ` (año ${year})` : ' (sin filtro de año)'}...`);
    const allPartiallyPaidPurchases = [];
    let page = 1;
    let hasMorePages = true;
    const limit = 100; // Máximo por página

    while (hasMorePages) {
      try {
        const purchases = await this.getPartiallyPaidPurchases(page, limit, company, year);
        
        if (purchases && purchases.length > 0) {
          allPartiallyPaidPurchases.push(...purchases);
          
          // Si obtenemos menos del límite, significa que es la última página
          if (purchases.length < limit) {
            hasMorePages = false;
          } else {
            page++;
          }
        } else {
          hasMorePages = false;
        }
      } catch (error) {
        console.error(`Error obteniendo compras parcialmente pagadas en página ${page}:`, error);
        hasMorePages = false;
      }
    }

    return allPartiallyPaidPurchases;
  }

  // Obtener compras pendientes incluyendo parcialmente pagadas
  // NOTA: Cuando year es null, obtenemos TODAS las facturas no pagadas completamente (de cualquier año)
  async getPendingPurchasesIncludingPartial(page = 1, limit = 100, company = 'solucions', year = null) {
    // Estrategia: obtener facturas con paid=0 (no pagadas) y paid=2 (parcialmente pagadas)
    // sin filtro de fecha cuando year es null para obtener todas las facturas pendientes
    const allPendingPurchases = [];
    
    // Obtener facturas no pagadas (paid=0)
    const paramsUnpaid = {
      page,
      limit,
      paid: '0', // no pagadas
      sort: 'created-desc'
    };
    
    // Si se especifica un año, añadir filtros de fecha (timestamps Unix)
    if (year) {
      const startDate = new Date(`${year}-01-01T00:00:00Z`);
      const endDate = new Date(`${year}-12-31T23:59:59Z`);
      paramsUnpaid.starttmp = Math.floor(startDate.getTime() / 1000);
      paramsUnpaid.endtmp = Math.floor(endDate.getTime() / 1000);
    }
    // Si year es null, NO aplicamos filtro de fecha para obtener todas las facturas no pagadas
    
    const unpaidPurchases = await this.getPurchases(paramsUnpaid, company);
    console.log(`   💰 [getPendingPurchasesIncludingPartial] ${company} - Página ${page}: ${unpaidPurchases.length} facturas no pagadas (paid=0)`);
    allPendingPurchases.push(...unpaidPurchases);
    
    // También obtener facturas parcialmente pagadas (paid=2) de esta misma página
    const paramsPartiallyPaid = {
      page,
      limit,
      paid: '2', // parcialmente pagadas
      sort: 'created-desc'
    };
    
    if (year) {
      const startDate = new Date(`${year}-01-01T00:00:00Z`);
      const endDate = new Date(`${year}-12-31T23:59:59Z`);
      paramsPartiallyPaid.starttmp = Math.floor(startDate.getTime() / 1000);
      paramsPartiallyPaid.endtmp = Math.floor(endDate.getTime() / 1000);
    }
    // Si year es null, NO aplicamos filtro de fecha
    
    const partiallyPaidPurchases = await this.getPurchases(paramsPartiallyPaid, company);
    console.log(`   💰 [getPendingPurchasesIncludingPartial] ${company} - Página ${page}: ${partiallyPaidPurchases.length} facturas parcialmente pagadas (paid=2)`);
    allPendingPurchases.push(...partiallyPaidPurchases);
    
    // Eliminar duplicados
    const uniquePurchases = allPendingPurchases.filter((purchase, index, self) => 
      index === self.findIndex(p => p.id === purchase.id)
    );
    
    return uniquePurchases;
  }

  // Obtener compras pendientes incluyendo status=2
  async getPendingPurchasesWithStatus2(page = 1, limit = 100, company = 'solucions') {
    // Primero obtener compras con paid=0
    const unpaidPurchases = await this.getPurchases({
      page,
      limit,
      paid: '0'
    }, company);
    
    // Luego obtener compras con status=2 (que pueden estar pagadas)
    const status2Purchases = await this.getPurchases({
      page,
      limit,
      status: '2'
    }, company);
    
    // Combinar y eliminar duplicados
    const allPurchases = [...unpaidPurchases, ...status2Purchases];
    const uniquePurchases = allPurchases.filter((purchase, index, self) => 
      index === self.findIndex(p => p.id === purchase.id)
    );
    
    return uniquePurchases;
  }

  // Obtener compras pendientes de manera más eficiente (sin duplicados)
  async getPendingPurchasesEfficient(page = 1, limit = 100, company = 'solucions') {
    // Obtener todas las compras de esta página
    const allPurchases = await this.getPurchases({
      page,
      limit,
      sort: 'created-desc'
    }, company);
    
    // Filtrar solo las que realmente son pendientes
    const pendingPurchases = allPurchases.filter(purchase => {
      // Solo incluir:
      // 1. Las compras con status=2 (las 3 que faltan)
      // 2. Las compras con status=0 (borradores)
      // NO incluir status=1 porque son la mayoría y no son pendientes
      
      const isStatus2 = purchase.status === 2;
      const isStatus0 = purchase.status === 0;
      
      const shouldInclude = isStatus2 || isStatus0;
      
      return shouldInclude;
    });
    
    return pendingPurchases;
  }

  // Obtener compras vencidas (pendientes con fecha de vencimiento pasada)
  // NOTA: Cuando year es null, NO aplicamos filtro de fecha para obtener TODAS las facturas vencidas
  async getOverduePurchases(page = 1, limit = 100, company = 'solucions', year = null) {
    const params = {
      page,
      limit,
      paid: '0' // no pagadas
    };
    
    // Si se especifica un año, usar el último día del año como límite (timestamps Unix)
    // Si no, NO aplicar filtro de fecha para obtener todas las facturas vencidas (de cualquier año)
    if (year) {
      const startDate = new Date(`${year}-01-01T00:00:00Z`);
      const endDate = new Date(`${year}-12-31T23:59:59Z`);
      params.starttmp = Math.floor(startDate.getTime() / 1000); // Timestamp en segundos
      params.endtmp = Math.floor(endDate.getTime() / 1000); // Timestamp en segundos
    }
    // Si year es null, no añadimos endtmp para obtener todas las facturas vencidas de cualquier año
    
    return this.getPurchases(params, company);
  }

  // Obtener compras vencidas incluyendo status=2
  async getOverduePurchasesWithStatus2(page = 1, limit = 100, company = 'solucions') {
    const today = new Date().toISOString().split('T')[0];
    
    // Primero obtener compras vencidas con paid=0
    const unpaidOverdue = await this.getPurchases({
      page,
      limit,
      paid: '0',
      endtmp: today
    }, company);
    
    // Luego obtener compras con status=2 que estén vencidas
    const status2Overdue = await this.getPurchases({
      page,
      limit,
      status: '2',
      endtmp: today
    }, company);
    
    // Combinar y eliminar duplicados
    const allOverdue = [...unpaidOverdue, ...status2Overdue];
    const uniqueOverdue = allOverdue.filter((purchase, index, self) => 
      index === self.findIndex(p => p.id === purchase.id)
    );
    
    return uniqueOverdue;
  }

  // Obtener compras vencidas de manera más eficiente (sin duplicados)
  async getOverduePurchasesEfficient(page = 1, limit = 100, company = 'solucions') {
    const today = new Date().toISOString().split('T')[0];
    
    // Obtener todas las compras de esta página
    const allPurchases = await this.getPurchases({
      page,
      limit,
      sort: 'created-desc'
    }, company);
    
    // Filtrar solo las que necesitamos: (paid=0 O status=2) Y vencidas
    const overduePurchases = allPurchases.filter(purchase => {
      // Solo incluir:
      // 1. Las compras con status=2 (las 3 que faltan)
      // 2. Las compras con status=0 (borradores)
      // NO incluir status=1 porque son la mayoría y no son pendientes
      // Y además está vencida
      
      const isStatus2 = purchase.status === 2;
      const isStatus0 = purchase.status === 0;
      const isOverdue = purchase.dueDate && new Date(purchase.dueDate) < new Date(today);
      
      const shouldInclude = (isStatus2 || isStatus0) && isOverdue;
      
      return shouldInclude;
    });
    
    return overduePurchases;
  }

  // Obtener TODAS las compras pendientes (todas las páginas)
  // NOTA: Cuando year es null, obtenemos TODAS las facturas pendientes de cualquier año
  async getAllPendingPurchasesPages(company = 'solucions', year = null) {
    console.log(`🔄 [Holded API] ${company} - Obteniendo todas las compras pendientes${year ? ` (año ${year})` : ' (sin filtro de año - TODAS las facturas pendientes)'}...`);
    const allPurchases = [];
    let page = 1;
    let hasMorePages = true;
    const limit = 100; // Máximo por página
    let consecutiveEmptyPages = 0;
    const maxEmptyPages = 2; // Detener después de 2 páginas vacías consecutivas

    while (hasMorePages) {
      try {
        const purchases = await this.getPendingPurchasesIncludingPartial(page, limit, company, year);
        
        if (purchases && purchases.length > 0) {
          consecutiveEmptyPages = 0; // Resetear contador
          allPurchases.push(...purchases);
          console.log(`   📄 Página ${page}: ${purchases.length} facturas (Total acumulado: ${allPurchases.length})`);
          
          // Si obtenemos menos del límite, puede ser la última página
          // Pero continuamos por si hay más páginas con menos resultados
          if (purchases.length < limit) {
            consecutiveEmptyPages++;
            if (consecutiveEmptyPages >= maxEmptyPages) {
              hasMorePages = false;
              console.log(`   ✅ Última página alcanzada (${purchases.length} < ${limit}, ${consecutiveEmptyPages} páginas vacías consecutivas)`);
            } else {
              page++;
            }
          } else {
            page++;
          }
        } else {
          consecutiveEmptyPages++;
          if (consecutiveEmptyPages >= maxEmptyPages) {
            hasMorePages = false;
            console.log(`   ⚠️ Página ${page} vacía, finalizando (${consecutiveEmptyPages} páginas vacías consecutivas)`);
          } else {
            page++;
          }
        }
      } catch (error) {
        console.error(`   ❌ Error en página ${page}:`, error);
        hasMorePages = false;
      }
    }

    console.log(`   ✅ Total de compras pendientes obtenidas: ${allPurchases.length}`);
    return allPurchases;
  }

  // Obtener TODAS las compras parcialmente pagadas (todas las páginas)
  async getAllPartiallyPaidPurchasesPages(company = 'solucions', year = null) {
    console.log(`🔄 [Holded API] ${company} - Obteniendo todas las compras parcialmente pagadas${year ? ` (año ${year})` : ' (sin filtro de año)'}...`);
    
    const allPartiallyPaidPurchases = [];
    let page = 1;
    let hasMorePages = true;
    const limit = 100; // Máximo por página
    let firstError = null;

    while (hasMorePages) {
      try {
        const purchases = await this.getPartiallyPaidPurchases(page, limit, company, year);
        
        if (purchases && purchases.length > 0) {
          allPartiallyPaidPurchases.push(...purchases);
          console.log(`   📄 Página ${page}: ${purchases.length} facturas (Total acumulado: ${allPartiallyPaidPurchases.length})`);
          
          // Si obtenemos menos del límite, significa que es la última página
          if (purchases.length < limit) {
            hasMorePages = false;
            console.log(`   ✅ Última página alcanzada (${purchases.length} < ${limit})`);
          } else {
            page++;
          }
        } else {
          hasMorePages = false;
          console.log(`   ⚠️ Página ${page} vacía, finalizando`);
        }
      } catch (error) {
        console.error(`   ❌ Error en página ${page}:`, error);
        // Guardar el primer error para lanzarlo al final si no hay datos
        if (!firstError) {
          firstError = error;
        }
        // Si es un error de autenticación o servidor, detener inmediatamente
        if (error.message && (error.message.includes('API key') || error.message.includes('servidor') || error.message.includes('conexión'))) {
          throw error;
        }
        hasMorePages = false;
      }
    }

    // Si no se obtuvo ningún dato y hubo un error, lanzarlo
    if (allPartiallyPaidPurchases.length === 0 && firstError) {
      throw firstError;
    }

    console.log(`   ✅ Total de compras parcialmente pagadas obtenidas: ${allPartiallyPaidPurchases.length}`);
    return allPartiallyPaidPurchases;
  }

  // Obtener TODAS las compras vencidas (todas las páginas)
  async getAllOverduePurchasesPages(company = 'solucions', year = null) {
    console.log(`🔄 [Holded API] ${company} - Obteniendo todas las compras vencidas${year ? ` (año ${year})` : ' (sin filtro de año)'}...`);
    const allPurchases = [];
    let page = 1;
    let hasMorePages = true;
    const limit = 100; // Máximo por página

    while (hasMorePages) {
      try {
        const purchases = await this.getOverduePurchases(page, limit, company, year);
        
        if (purchases && purchases.length > 0) {
          allPurchases.push(...purchases);
          console.log(`   📄 Página ${page}: ${purchases.length} facturas (Total acumulado: ${allPurchases.length})`);
          
          // Si obtenemos menos del límite, significa que es la última página
          if (purchases.length < limit) {
            hasMorePages = false;
            console.log(`   ✅ Última página alcanzada (${purchases.length} < ${limit})`);
          } else {
            page++;
          }
        } else {
          hasMorePages = false;
          console.log(`   ⚠️ Página ${page} vacía, finalizando`);
        }
      } catch (error) {
        console.error(`   ❌ Error en página ${page}:`, error);
        hasMorePages = false;
      }
    }

    console.log(`   ✅ Total de compras vencidas obtenidas: ${allPurchases.length}`);
    return allPurchases;
  }

  // Obtener TODAS las compras sin filtros (para diagnóstico)
  async getAllPurchasesForDiagnosis(company = 'solucions') {
    const allPurchases = [];
    let page = 1;
    let hasMorePages = true;
    const limit = 100;

    while (hasMorePages) {
      try {
        const purchases = await this.getPurchases({
          page,
          limit,
          sort: 'created-desc'
        }, company);
        
        if (purchases && purchases.length > 0) {
          allPurchases.push(...purchases);
          
          if (purchases.length < limit) {
            hasMorePages = false;
          } else {
            page++;
          }
        } else {
          hasMorePages = false;
        }
      } catch (error) {
        hasMorePages = false;
      }
    }

    // Análisis completo de status
    const totalStatusCount = {};
    allPurchases.forEach(purchase => {
      const status = purchase.status || 'sin_status';
      totalStatusCount[status] = (totalStatusCount[status] || 0) + 1;
    });
    
    // Mostrar compras no pagadas
    const unpaidPurchases = allPurchases.filter(p => p.paid === false || p.paid === 0);
    
    return allPurchases;
  }

  // Obtener compras con diferentes filtros para encontrar las faltantes
  async findMissingPurchases(company = 'solucions') {
    // 1. Obtener todas las compras
    const allPurchases = await this.getAllPurchasesForDiagnosis(company);
    
    // 2. Obtener compras con diferentes filtros
    const filters = [
      { name: 'paid=0', filter: p => p.paid === false || p.paid === 0 },
      { name: 'paid=1', filter: p => p.paid === true || p.paid === 1 },
      { name: 'status=1', filter: p => p.status === 1 },
      { name: 'status=2', filter: p => p.status === 2 },
      { name: 'status=3', filter: p => p.status === 3 },
      { name: 'pending>0', filter: p => p.pending > 0 },
      { name: 'total>0', filter: p => p.total > 0 }
    ];
    
    filters.forEach(({ name, filter }) => {
      const filtered = allPurchases.filter(filter);
    });
    
    return allPurchases;
  }

  // Obtener contactos (proveedores)
  async getContacts(page = 1, limit = 100, company = 'solucions') {
    return this.makeRequest(`/contacts?page=${page}&limit=${limit}`, {}, company);
  }

  // Obtener un contacto específico
  async getContact(contactId, company = 'solucions') {
    return this.makeRequest(`/contacts/${contactId}`, {}, company);
  }

  // Obtener grupos de contactos
  async getContactGroups(company = 'solucions') {
    return this.makeRequest('/contacts/groups', {}, company);
  }

  // Obtener todos los contactos (múltiples páginas)
  async getAllContacts(company = 'solucions') {
    try {
      let allContacts = [];
      let page = 1;
      const limit = 100;
      let hasMore = true;
      
      while (hasMore) {
        const contacts = await this.getContacts(page, limit, company);
        
        if (contacts && contacts.length > 0) {
          allContacts = allContacts.concat(contacts);
          page++;
        } else {
          hasMore = false;
        }
      }
      
      return allContacts;
    } catch (error) {
      throw error;
    }
  }

  // Crear un nuevo contacto
  async createContact(contactData, company = 'solucions') {
    try {
      const response = await this.makeRequest('/contacts', {
        method: 'POST',
        body: contactData
      }, company);
      
      return response;
    } catch (error) {
      throw error;
    }
  }

  // Actualizar un contacto existente
  async updateContact(contactId, contactData, company = 'solucions') {
    try {
      const response = await this.makeRequest(`/contacts/${contactId}`, {
        method: 'PUT',
        body: contactData
      }, company);
      
      return response;
    } catch (error) {
      throw error;
    }
  }

  // Eliminar un contacto
  async deleteContact(contactId, company = 'solucions') {
    try {
      const response = await this.makeRequest(`/contacts/${contactId}`, {
        method: 'DELETE'
      }, company);
      
      return response;
    } catch (error) {
      throw error;
    }
  }

  // Obtener productos
  async getProducts(page = 1, limit = 100, company = 'solucions') {
    return this.makeRequest(`/products?page=${page}&limit=${limit}`, {}, company);
  }

  // Obtener servicios
  async getServices(page = 1, limit = 100, company = 'solucions') {
    return this.makeRequest(`/services?page=${page}&limit=${limit}`, {}, company);
  }

  // Obtener métodos de pago
  async getPaymentMethods(company = 'solucions') {
    return this.makeRequest('/paymentmethods', {}, company);
  }

  // Obtener pagos
  async getPayments(page = 1, limit = 100, company = 'solucions') {
    return this.makeRequest(`/payments?page=${page}&limit=${limit}`, {}, company);
  }

  // Obtener impuestos
  async getTaxes(company = 'solucions') {
    return this.makeRequest('/taxes', {}, company);
  }

  // Obtener tesorería
  async getTreasury(company = 'solucions') {
    return this.makeRequest('/treasury', {}, company);
  }

  // Obtener cuentas de gastos
  async getExpensesAccounts(company = 'solucions') {
    return this.makeRequest('/expensesaccounts', {}, company);
  }

  // Obtener series de numeración
  async getNumberingSeries(type, company = 'solucions') {
    return this.makeRequest(`/numberingseries/${type}`, {}, company);
  }

  // Obtener canales de venta
  async getSalesChannels(company = 'solucions') {
    return this.makeRequest('/saleschannels', {}, company);
  }

  // Obtener remesas
  async getRemittances(page = 1, limit = 100, company = 'solucions') {
    return this.makeRequest(`/remittances?page=${page}&limit=${limit}`, {}, company);
  }

  // ========== FUNCIONES PARA FACTURAS DE VENTA (SALES) ==========
  
  // Obtener facturas de venta (sales invoices) con filtros opcionales
  // Según la API de Holded, el docType para facturas de venta es "invoice"
  async getSales(params = {}, company = 'solucions') {
    const {
      page = 1,
      limit = 100,
      starttmp,
      endtmp,
      contactid,
      paid,
      billed,
      sort = 'created-desc'
    } = params;

    // El endpoint correcto es /documents/invoice (no /documents/sale)
    let endpoint = `/documents/invoice?page=${page}&limit=${limit}&sort=${sort}`;
    
    if (starttmp) endpoint += `&starttmp=${starttmp}`;
    if (endtmp) endpoint += `&endtmp=${endtmp}`;
    if (contactid) endpoint += `&contactid=${contactid}`;
    if (paid !== undefined) endpoint += `&paid=${paid}`;
    if (billed !== undefined) endpoint += `&billed=${billed}`;

    return this.makeRequest(endpoint, {}, company);
  }

  // Obtener facturas de venta pendientes (no pagadas)
  async getPendingSales(page = 1, limit = 100, company = 'solucions') {
    // Intentar primero sin el filtro paid para ver si el endpoint funciona
    try {
      const allSales = await this.getSales({
        page,
        limit,
        sort: 'created-desc'
      }, company);
      
      // Filtrar manualmente las no pagadas
      return allSales.filter(sale => {
        const isUnpaid = sale.paid === false || sale.paid === 0 || sale.paid === '0';
        return isUnpaid;
      });
    } catch (error) {
      console.error(`Error obteniendo facturas de venta pendientes (intentando sin filtro paid):`, error);
      // Si falla, intentar con el filtro paid
      return this.getSales({
        page,
        limit,
        paid: '0' // 0 = not paid
      }, company);
    }
  }

  // Obtener facturas de venta parcialmente pagadas (paid=2)
  async getPartiallyPaidSales(page = 1, limit = 100, company = 'solucions') {
    // Intentar primero sin el filtro paid para ver si el endpoint funciona
    try {
      const allSales = await this.getSales({
        page,
        limit,
        sort: 'created-desc'
      }, company);
      
      // Filtrar manualmente las parcialmente pagadas
      return allSales.filter(sale => {
        const isPartiallyPaid = sale.status === 2 && (sale.paymentsPending > 0 || sale.pending > 0);
        return isPartiallyPaid;
      });
    } catch (error) {
      console.error(`Error obteniendo facturas de venta parcialmente pagadas (intentando sin filtro paid):`, error);
      // Si falla, intentar con el filtro paid
      return await this.getSales({
        page,
        limit,
        paid: '2' // 2 = partially paid
      }, company);
    }
  }

  // Obtener TODAS las facturas de venta pendientes (todas las páginas)
  // Igual que getAllPendingPurchasesPages - usa getPendingSalesIncludingPartial
  async getAllPendingSalesPages(company = 'solucions') {
    const allSales = [];
    let page = 1;
    let hasMorePages = true;
    const limit = 100; // Máximo por página

    while (hasMorePages) {
      try {
        const sales = await this.getPendingSalesIncludingPartial(page, limit, company);
        
        if (sales && sales.length > 0) {
          allSales.push(...sales);
          
          // Si obtenemos menos del límite, significa que es la última página
          if (sales.length < limit) {
            hasMorePages = false;
          } else {
            page++;
          }
        } else {
          hasMorePages = false;
        }
      } catch (error) {
        console.error(`Error obteniendo facturas de venta pendientes en página ${page}:`, error);
        hasMorePages = false;
      }
    }

    return allSales;
  }

  // Obtener TODAS las facturas de venta parcialmente pagadas (todas las páginas)
  async getAllPartiallyPaidSalesPages(company = 'solucions') {
    const allPartiallyPaidSales = [];
    let page = 1;
    let hasMorePages = true;
    const limit = 100; // Máximo por página

    while (hasMorePages) {
      try {
        const sales = await this.getPartiallyPaidSales(page, limit, company);
        
        if (sales && sales.length > 0) {
          allPartiallyPaidSales.push(...sales);
          
          // Si obtenemos menos del límite, significa que es la última página
          if (sales.length < limit) {
            hasMorePages = false;
          } else {
            page++;
          }
        } else {
          hasMorePages = false;
        }
      } catch (error) {
        console.error(`Error obteniendo facturas de venta parcialmente pagadas en página ${page}:`, error);
        hasMorePages = false;
      }
    }

    return allPartiallyPaidSales;
  }

  // Obtener facturas de venta pendientes incluyendo parcialmente pagadas
  // Igual que getPendingPurchasesIncludingPartial
  async getPendingSalesIncludingPartial(page = 1, limit = 100, company = 'solucions') {
    // Obtener todas las facturas de venta de esta página
    const allSales = await this.getSales({
      page,
      limit,
      sort: 'created-desc'
    }, company);
    
    // Filtrar solo las que realmente son pendientes
    const pendingSales = allSales.filter(sale => {
      // Incluir:
      // 1. Las facturas con paid=false (no pagadas)
      // 2. Las facturas con status=2 que tienen paymentsPending > 0 (parcialmente pagadas)
      
      const isUnpaid = sale.paid === false || sale.paid === 0 || sale.paid === '0';
      const isPartiallyPaid = sale.status === 2 && (sale.paymentsPending > 0 || sale.pending > 0);
      
      return isUnpaid || isPartiallyPaid;
    });
    
    return pendingSales;
  }

  // Obtener facturas de venta vencidas (pendientes con fecha de vencimiento pasada)
  async getOverdueSales(page = 1, limit = 100, company = 'solucions') {
    const today = new Date().toISOString().split('T')[0];
    return this.getSales({
      page,
      limit,
      paid: '0', // no pagadas
      endtmp: today // hasta hoy (vencidas)
    }, company);
  }

  // Obtener TODAS las facturas de venta vencidas (todas las páginas)
  async getAllOverdueSalesPages(company = 'solucions') {
    const allSales = [];
    let page = 1;
    let hasMorePages = true;
    const limit = 100; // Máximo por página

    while (hasMorePages) {
      try {
        const sales = await this.getOverdueSales(page, limit, company);
        
        if (sales && sales.length > 0) {
          allSales.push(...sales);
          
          // Si obtenemos menos del límite, significa que es la última página
          if (sales.length < limit) {
            hasMorePages = false;
          } else {
            page++;
          }
        } else {
          hasMorePages = false;
        }
      } catch (error) {
        console.error(`Error obteniendo facturas de venta vencidas en página ${page}:`, error);
        hasMorePages = false;
      }
    }

    return allSales;
  }

  // Obtener facturas de venta de tipo "salesreceipt" (tickets de venta/TPV)
  async getSalesReceipts(params = {}, company = 'solucions') {
    const {
      page = 1,
      limit = 100,
      starttmp,
      endtmp,
      contactid,
      paid,
      billed,
      sort = 'created-desc'
    } = params;

    // El endpoint para tickets de venta es /documents/salesreceipt
    let endpoint = `/documents/salesreceipt?page=${page}&limit=${limit}&sort=${sort}`;
    
    if (starttmp) endpoint += `&starttmp=${starttmp}`;
    if (endtmp) endpoint += `&endtmp=${endtmp}`;
    if (contactid) endpoint += `&contactid=${contactid}`;
    if (paid !== undefined) endpoint += `&paid=${paid}`;
    if (billed !== undefined) endpoint += `&billed=${billed}`;

    return this.makeRequest(endpoint, {}, company);
  }

  // Obtener TODAS las facturas de venta pendientes, parcialmente pagadas y vencidas
  // Igual que getAllPendingAndOverduePurchases pero para ventas
  async getAllPendingAndPartiallyPaidSales(company = 'solucions') {
    try {
      // Obtener pendientes, parcialmente pagadas y vencidas en paralelo (igual que en purchases)
      const [pendingSales, partiallyPaidSales, overdueSales] = await Promise.all([
        this.getAllPendingSalesPages(company).catch(error => {
          console.error(`Error obteniendo facturas de venta pendientes para ${company}:`, error);
          return [];
        }),
        this.getAllPartiallyPaidSalesPages(company).catch(error => {
          console.error(`Error obteniendo facturas de venta parcialmente pagadas para ${company}:`, error);
          return [];
        }),
        this.getAllOverdueSalesPages(company).catch(error => {
          console.error(`Error obteniendo facturas de venta vencidas para ${company}:`, error);
          return [];
        })
      ]);

      // También obtener tickets de venta (salesreceipt) que pueden ser las facturas que faltan
      console.log(`🔍 [Holded API] Buscando tickets de venta (salesreceipt) para ${company}...`);
      let allSalesReceipts = [];
      let page = 1;
      let hasMorePages = true;
      const limit = 100;

      while (hasMorePages) {
        try {
          const receipts = await this.getSalesReceipts({
            page,
            limit,
            sort: 'created-desc'
          }, company);
          
          if (receipts && receipts.length > 0) {
            allSalesReceipts.push(...receipts);
            
            if (receipts.length < limit) {
              hasMorePages = false;
            } else {
              page++;
            }
          } else {
            hasMorePages = false;
          }
        } catch (error) {
          console.error(`Error obteniendo tickets de venta en página ${page}:`, error);
          hasMorePages = false;
        }
      }

      console.log(`📄 [Holded API] Tickets de venta obtenidos: ${allSalesReceipts.length}`);

      // Filtrar tickets de venta pendientes o vencidos
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      const pendingReceipts = allSalesReceipts.filter(receipt => {
        const isUnpaid = receipt.paid === false || receipt.paid === 0 || receipt.paid === '0';
        const isPartiallyPaid = receipt.status === 2 && (receipt.paymentsPending > 0 || receipt.pending > 0);
        const isPending = isUnpaid || isPartiallyPaid;
        
        let isOverdue = false;
        if (receipt.dueDate) {
          try {
            const dueDate = new Date(receipt.dueDate);
            dueDate.setHours(0, 0, 0, 0);
            isOverdue = dueDate < today;
          } catch (e) {
            isOverdue = false;
          }
        }
        
        return isPending || isOverdue;
      });

      console.log(`📄 [Holded API] Tickets de venta pendientes/vencidos: ${pendingReceipts.length}`);

      // Combinar facturas normales y tickets de venta, y eliminar duplicados basándose en el ID
      const allDocuments = [...pendingSales, ...partiallyPaidSales, ...overdueSales, ...pendingReceipts];
      const uniqueDocuments = allDocuments.filter((doc, index, self) => 
        index === self.findIndex(d => d.id === doc.id)
      );

      console.log(`✅ [Holded API] Facturas de venta para ${company}:`);
      console.log(`  - Pendientes: ${pendingSales.length}`);
      console.log(`  - Parcialmente pagadas: ${partiallyPaidSales.length}`);
      console.log(`  - Vencidas: ${overdueSales.length}`);
      console.log(`  - Tickets de venta pendientes/vencidos: ${pendingReceipts.length}`);
      console.log(`  - Total únicas: ${uniqueDocuments.length}`);

      // Búsqueda de respaldo para facturas específicas que puedan faltar
      // (por ejemplo, facturas con estados especiales o formatos de número diferentes)
      const missingNumbers = ['079T'];
      const foundNumbers = uniqueDocuments.map(doc => doc.docNumber || doc.num || doc.number || '');
      const stillMissing = missingNumbers.filter(num => 
        !foundNumbers.some(found => found.includes(num) || num.includes(found))
      );

      if (stillMissing.length > 0) {
        console.log(`🔍 Buscando facturas faltantes: ${stillMissing.join(', ')}`);
        
        // Buscar en todas las facturas sin filtros
        try {
          let searchPage = 1;
          let foundMissing = [];
          const searchLimit = 100;
          const maxSearchPages = 5; // Limitar búsqueda a 5 páginas para no tardar mucho
          
          while (searchPage <= maxSearchPages && stillMissing.length > foundMissing.length) {
            try {
              const allInvoices = await this.getSales({
                page: searchPage,
                limit: searchLimit,
                sort: 'created-desc'
              }, company);
              
              if (allInvoices && allInvoices.length > 0) {
                // Buscar facturas faltantes en esta página
                stillMissing.forEach(missingNum => {
                  if (foundMissing.includes(missingNum)) return; // Ya encontrada
                  
                  const found = allInvoices.find(doc => {
                    const docNum = doc.docNumber || doc.num || doc.number || '';
                    return docNum.includes(missingNum) || missingNum.includes(docNum);
                  });
                  
                  if (found) {
                    // Verificar si cumple criterios (pendiente o vencida)
                    const isUnpaid = found.paid === false || found.paid === 0 || found.paid === '0';
                    const isPartiallyPaid = found.status === 2 && (found.paymentsPending > 0 || found.pending > 0);
                    let isOverdue = false;
                    if (found.dueDate) {
                      try {
                        const dueDate = new Date(found.dueDate);
                        dueDate.setHours(0, 0, 0, 0);
                        isOverdue = dueDate < today;
                      } catch (e) {}
                    }
                    
                    if (isUnpaid || isPartiallyPaid || isOverdue) {
                      console.log(`  ✅ Encontrada y añadida: ${missingNum}`);
                      uniqueDocuments.push(found);
                      foundMissing.push(missingNum);
                    } else {
                      console.log(`  ⚠️ Encontrada pero no cumple criterios: ${missingNum}`, {
                        paid: found.paid,
                        status: found.status,
                        pending: found.pending
                      });
                    }
                  }
                });
                
                if (allInvoices.length < searchLimit) {
                  break; // No hay más páginas
                }
                searchPage++;
              } else {
                break; // No hay más facturas
              }
            } catch (error) {
              console.error(`Error buscando facturas faltantes en página ${searchPage}:`, error);
              break;
            }
          }
        } catch (error) {
          console.error(`Error en búsqueda de respaldo:`, error);
        }
      }

      // Log simplificado de facturas de venta
      console.log(`📊 [Holded API] Facturas de Venta obtenidas (${company}): ${uniqueDocuments.length} facturas`);
      
      // Mostrar 1 factura aleatoria con TODOS los campos que devuelve la API
      if (uniqueDocuments.length > 0) {
        const randomIndex = Math.floor(Math.random() * uniqueDocuments.length);
        const randomInvoice = uniqueDocuments[randomIndex];
        console.log(`\n🔍 Factura aleatoria (índice ${randomIndex}) - TODOS los campos de la API:`);
        console.log(JSON.stringify(randomInvoice, null, 2));
      }

      return uniqueDocuments.map(doc => this.transformHoldedDocumentToSaleInvoice(doc));
    } catch (error) {
      console.error(`❌ [Holded API] Error obteniendo facturas de venta para ${company}:`, error);
      // Retornar array vacío en lugar de lanzar error para que la app no se rompa
      return [];
    }
  }

  // Función para transformar datos de Holded al formato de factura de venta
  transformHoldedDocumentToSaleInvoice(holdedDocument) {
    // Transformando documento de venta
    
    // Obtener información del cliente
    const contactInfo = holdedDocument.contact || {};
    const contactName = contactInfo.name || contactInfo.company || holdedDocument.contactName || 'Cliente Holded';

    // Construir descripción con todos los productos (name y desc)
    const productsDescriptions = [];
    if (holdedDocument.products && Array.isArray(holdedDocument.products) && holdedDocument.products.length > 0) {
      holdedDocument.products.forEach(product => {
        if (product) {
          const productName = product.name || product.productName || '';
          const productDesc = product.desc || product.description || '';
          
          if (productName || productDesc) {
            const productInfo = [];
            if (productName) productInfo.push(productName);
            if (productDesc) productInfo.push(productDesc);
            productsDescriptions.push(productInfo.join(' - '));
          }
        }
      });
    }
    
    // SIEMPRE usar la descripción de productos si existe, sin importar otros campos
    let resolvedDescription;
    if (productsDescriptions.length > 0) {
      resolvedDescription = productsDescriptions.join(' | ');
      console.log(`🔍 [Holded] Descripción de productos para ${holdedDocument.docNumber || holdedDocument.id}:`, resolvedDescription);
    } else {
      // Solo si no hay productos, usar otros campos
      resolvedDescription = [
        holdedDocument.notes,
        holdedDocument.description,
        holdedDocument.desc,
      ].find(value => typeof value === 'string' && value.trim() !== '') || 
      `Venta - ${contactName}`;
      if (holdedDocument.products && holdedDocument.products.length > 0) {
        console.log(`⚠️ [Holded] Hay ${holdedDocument.products.length} productos pero no se extrajo descripción para ${holdedDocument.docNumber || holdedDocument.id}`);
      }
    }

    // Determinar si está pagada basándose en paymentsPending y status
    const isUnpaid = holdedDocument.paid === false || holdedDocument.paid === 0 || holdedDocument.paid === '0';
    const isPartiallyPaid = holdedDocument.status === 2 && (holdedDocument.paymentsPending > 0 || holdedDocument.pending > 0);
    const isFullyPaid = (holdedDocument.paymentsPending === 0 || holdedDocument.paymentsPending === null) && 
                        (holdedDocument.paid === true || holdedDocument.paid === 1 || holdedDocument.paid === '1');
    const isPaid = isFullyPaid && !isPartiallyPaid;
    
    // Calcular el monto pendiente correctamente
    let pendingAmount = holdedDocument.total || 0;
    if (holdedDocument.paymentsPending !== undefined && holdedDocument.paymentsPending !== null) {
      pendingAmount = holdedDocument.paymentsPending;
    } else if (holdedDocument.pending !== undefined && holdedDocument.pending !== null) {
      pendingAmount = holdedDocument.pending;
    }
    
    // Para facturas parcialmente pagadas, asegurar que se muestren como pendientes
    if (isPartiallyPaid) {
      pendingAmount = holdedDocument.paymentsPending || holdedDocument.pending || holdedDocument.total || 0;
    }

    // Mapear valores numéricos correctamente - verificar todos los campos posibles
    const subtotal = holdedDocument.subtotal || holdedDocument.net || holdedDocument.base || 0;
    const vat = holdedDocument.tax || holdedDocument.vat || holdedDocument.iva || 0;
    const retention = holdedDocument.retention || holdedDocument.retencion || 0;
    const total = holdedDocument.total || holdedDocument.gross || holdedDocument.amount || 0;
    
    // Determinar el estado basándose en el status y fechas
    let statusText = 'Pendiente';
    if (holdedDocument.status === 1) {
      statusText = 'Pagado';
    } else if (holdedDocument.status === 2) {
      statusText = 'Parcialmente pagado';
    } else if (holdedDocument.status === 3) {
      statusText = 'Anulado';
    }
    
    // Verificar si está vencida
    if (holdedDocument.dueDate) {
      try {
        const dueDate = new Date(holdedDocument.dueDate);
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        dueDate.setHours(0, 0, 0, 0);
        if (dueDate < today && (isUnpaid || isPartiallyPaid)) {
          statusText = 'Vençut';
        }
      } catch (e) {
        // Error parseando fecha
      }
    }

    const transformed = {
      invoice_number: holdedDocument.docNumber || holdedDocument.num || holdedDocument.number || `HOLD-${holdedDocument.id}`,
      internal_number: holdedDocument.internalNum || holdedDocument.docNumber || holdedDocument.num || holdedDocument.number,
      issue_date: this.convertHoldedDate(holdedDocument.date),
      accounting_date: this.convertHoldedDate(holdedDocument.accountingDate),
      due_date: this.convertHoldedDate(holdedDocument.dueDate),
      client: contactName,
      description: resolvedDescription && resolvedDescription.trim() ? resolvedDescription.trim() : `Venta - ${contactName}`,
      tags: holdedDocument.tags?.join(', ') || '',
      account: holdedDocument.account || '',
      project: holdedDocument.project || '',
      subtotal: subtotal,
      vat: vat,
      retention: retention,
      total: total,
      paid: isPaid,
      pending: pendingAmount,
      status: statusText,
      payment_date: this.convertHoldedDate(holdedDocument.paymentDate),
      holded_id: holdedDocument.id, // ID original de Holded para referencia
      holded_contact_id: holdedDocument.contact?.id,
      document_type: 'sale' // Tipo: factura de venta
    };
    
    const finalData = this.validateAndCleanInvoiceData(transformed);
    
    return finalData;
  }

  // Función auxiliar para convertir fechas de Holded
  convertHoldedDate(dateValue) {
    if (!dateValue) return null;
    
    // Si es un timestamp Unix (número)
    if (typeof dateValue === 'number' || (typeof dateValue === 'string' && /^\d+$/.test(dateValue))) {
      const timestamp = parseInt(dateValue);
      // Verificar si es en segundos o milisegundos
      const date = timestamp > 1000000000000 ? new Date(timestamp) : new Date(timestamp * 1000);
      return date.toISOString();
    }
    
    // Si ya es una fecha en formato ISO
    if (typeof dateValue === 'string' && dateValue.includes('-')) {
      return dateValue;
    }
    
    // Si es un objeto Date
    if (dateValue instanceof Date) {
      return dateValue.toISOString();
    }
    
    return null;
  }

  // Función para validar y limpiar datos antes de la inserción
  validateAndCleanInvoiceData(invoiceData) {
    const cleaned = { ...invoiceData };
    
    // Asegurar que los campos numéricos sean números válidos
    const numericFields = ['subtotal', 'vat', 'retention', 'total', 'pending'];
    numericFields.forEach(field => {
      if (cleaned[field] !== null && cleaned[field] !== undefined) {
        const num = parseFloat(cleaned[field]);
        cleaned[field] = isNaN(num) ? 0 : num;
      } else {
        cleaned[field] = 0;
      }
    });
    
    // Asegurar que los campos booleanos sean booleanos
    cleaned.paid = Boolean(cleaned.paid);
    
    // Limpiar campos de texto
    const textFields = ['invoice_number', 'internal_number', 'provider', 'description', 'tags', 'account', 'project', 'status'];
    textFields.forEach(field => {
      if (cleaned[field] !== null && cleaned[field] !== undefined) {
        cleaned[field] = String(cleaned[field]).trim();
      } else {
        cleaned[field] = '';
      }
    });
    
    // Asegurar que las fechas sean válidas
    const dateFields = ['issue_date', 'accounting_date', 'due_date', 'payment_date'];
    dateFields.forEach(field => {
      if (cleaned[field] && !this.isValidDate(cleaned[field])) {
        cleaned[field] = null;
      }
    });
    
    return cleaned;
  }

  // Función auxiliar para validar fechas
  isValidDate(dateString) {
    if (!dateString) return false;
    const date = new Date(dateString);
    return !isNaN(date.getTime());
  }

  // Función para transformar datos de Holded al formato de nuestra aplicación
  transformHoldedDocumentToInvoice(holdedDocument) {
    // Transformando documento
    
    // Determinar el canal basándose en el proveedor o tags
    const determineChannel = (provider, tags) => {
      const providerLower = (provider || '').toLowerCase();
      const tagsLower = (tags || '').toLowerCase();

      const productTexts = (holdedDocument.products || [])
        .flatMap(product => {
          if (!product) return [];
          return [
            product.desc,
            product.description,
            product.name,
            product.productName,
            product.concept,
            product.account,
            product.accountingAccount,
            product.taxAccount,
            product.expenseAccount
          ].map(value => (typeof value === 'string' ? value.toLowerCase() : ''));
        })
        .filter(Boolean);

      const documentTexts = [
        typeof holdedDocument.desc === 'string' ? holdedDocument.desc.toLowerCase() : '',
        typeof holdedDocument.description === 'string' ? holdedDocument.description.toLowerCase() : '',
        typeof holdedDocument.account === 'string' ? holdedDocument.account.toLowerCase() : '',
        typeof holdedDocument.accountingAccount === 'string' ? holdedDocument.accountingAccount.toLowerCase() : ''
      ].filter(Boolean);

      // Buscar palabras clave en proveedor, tags y descripciones de productos/cuentas
      const searchText = [providerLower, tagsLower, ...productTexts, ...documentTexts].join(' ');
      
      // Categorías para Solucions Socials
      if (searchText.includes('catering') || searchText.includes('comida') || searchText.includes('alimentación')) {
        return 'CATERING';
      } else if (searchText.includes('estructura') || searchText.includes('montaje') || searchText.includes('instalación')) {
        return 'ESTRUCTURA';
      } else if (searchText.includes('idoni') || searchText.includes('pink')) {
        return 'IDONI';
      }
      
      // Categorías específicas para Menjar D'Hort
      if (searchText.includes('obrador') || searchText.includes('panadería') || searchText.includes('pastelería') || 
          searchText.includes('horno') || searchText.includes('masa') || searchText.includes('pan')) {
        return 'OBRADOR';
      } else if (searchText.includes('catering') || searchText.includes('comida') || searchText.includes('alimentación') ||
                 searchText.includes('restaurante') || searchText.includes('cocina') || searchText.includes('chef')) {
        return 'CATERING';
      } else if (searchText.includes('estructura') || searchText.includes('montaje') || searchText.includes('instalación') ||
                 searchText.includes('toldos') || searchText.includes('carpa') || searchText.includes('escenario')) {
        return 'ESTRUCTURA';
      }
      
      // Categorías adicionales para Menjar D'Hort
      if (searchText.includes('hort') || searchText.includes('menjar') || searchText.includes('d\'hort')) {
        return 'MENJAR_D_HORT';
      }
      
      return 'OTROS';
    };

    const channel = determineChannel(holdedDocument.contact?.name, holdedDocument.tags?.join(', '));
    
    // Obtener información adicional del contacto si está disponible
    const contactInfo = holdedDocument.contact || {};
    const contactName = contactInfo.name || contactInfo.company || holdedDocument.contactName || 'Proveedor Holded';

    const primaryProduct = (holdedDocument.products || []).find(product => {
      if (!product) return false;
      const possibleDesc = product.desc || product.description || product.name || product.productName || product.concept;
      return typeof possibleDesc === 'string' && possibleDesc.trim() !== '';
    });

    const productDescription = primaryProduct
      ? (primaryProduct.desc || primaryProduct.description || primaryProduct.name || primaryProduct.productName || primaryProduct.concept || '').toString().trim()
      : '';

    const resolvedDescription = [
      holdedDocument.notes,
      holdedDocument.description,
      holdedDocument.desc,
      productDescription,
    ].find(value => typeof value === 'string' && value.trim() !== '');

    // Logs de facturas clasificadas como OTROS eliminados para reducir ruido en consola
    const contactEmail = contactInfo.email || '';
    const contactPhone = contactInfo.phone || '';
    
    // Usar el IBAN del contacto enriquecido (si existe)
    let contactIban = contactInfo.iban || '';
    
    // Si no hay IBAN del contacto enriquecido, buscar en otros campos
    if (!contactIban) {
      if (contactInfo.bankAccount) {
        contactIban = contactInfo.bankAccount;
      } else if (contactInfo.bank_account) {
        contactIban = contactInfo.bank_account;
      } else if (contactInfo.accountNumber) {
        contactIban = contactInfo.accountNumber;
      } else if (contactInfo.account_number) {
        contactIban = contactInfo.account_number;
      } else if (contactInfo.bankDetails) {
        contactIban = contactInfo.bankDetails;
      } else if (contactInfo.bank_details) {
        contactIban = contactInfo.bank_details;
      } else if (contactInfo.paymentInfo) {
        contactIban = contactInfo.paymentInfo;
      } else if (contactInfo.payment_info) {
        contactIban = contactInfo.payment_info;
      }
    }
    
    // Si no se encontró IBAN, buscar en campos adicionales del documento
    if (!contactIban) {
      if (holdedDocument.iban) {
        contactIban = holdedDocument.iban;
      } else if (holdedDocument.bankAccount) {
        contactIban = holdedDocument.bankAccount;
      } else if (holdedDocument.bank_account) {
        contactIban = holdedDocument.bank_account;
      } else if (holdedDocument.paymentInfo) {
        contactIban = holdedDocument.paymentInfo;
      } else if (holdedDocument.payment_info) {
        contactIban = holdedDocument.payment_info;
      }
    }
    

    
    // Calcular el monto pendiente correctamente
    let pendingAmount = holdedDocument.total;
    if (holdedDocument.paymentsPending !== undefined && holdedDocument.paymentsPending !== null) {
      pendingAmount = holdedDocument.paymentsPending;
    } else if (holdedDocument.pending !== undefined && holdedDocument.pending !== null) {
      pendingAmount = holdedDocument.pending;
    }

    // Determinar si está pagada basándose en paymentsPending y status
    const isPartiallyPaid = holdedDocument.status === 2 && holdedDocument.paymentsPending > 0;
    const isFullyPaid = holdedDocument.paymentsPending === 0 || holdedDocument.paymentsPending === null;
    const isPaid = isFullyPaid && !isPartiallyPaid;
    
    // Para facturas parcialmente pagadas, asegurar que se muestren como pendientes
    if (isPartiallyPaid) {
      pendingAmount = holdedDocument.paymentsPending || holdedDocument.total;
    }

    const transformed = {
      invoice_number: holdedDocument.docNumber || holdedDocument.num || holdedDocument.number || `HOLD-${holdedDocument.id}`,
      internal_number: holdedDocument.internalNum || holdedDocument.docNumber || holdedDocument.num || holdedDocument.number,
      issue_date: this.convertHoldedDate(holdedDocument.date),
      accounting_date: this.convertHoldedDate(holdedDocument.accountingDate),
      due_date: this.convertHoldedDate(holdedDocument.dueDate),
      provider: contactName,
      description: resolvedDescription ? resolvedDescription.trim() : `Compra ${channel} - ${contactName}`,
      tags: holdedDocument.tags?.join(', ') || '',
      account: channel, // Usar el canal como cuenta para filtros
      project: holdedDocument.project || channel,
      subtotal: holdedDocument.subtotal,
      vat: holdedDocument.tax,
      retention: holdedDocument.retention,
      employees: holdedDocument.employees,
      equipment_recovery: holdedDocument.equipmentRecovery,
      total: holdedDocument.total,
      paid: isPaid,
      pending: pendingAmount,
      status: holdedDocument.status || 'Pendiente',
      payment_date: this.convertHoldedDate(holdedDocument.paymentDate),
      holded_id: holdedDocument.id, // ID original de Holded para referencia
      holded_contact_id: holdedDocument.contact?.id,
      iban: contactIban, // IBAN del proveedor
      document_type: 'purchase' // Solo compras ahora
    };
    
    const finalData = this.validateAndCleanInvoiceData(transformed);
    
    // Documento transformado
    
    return finalData;
  }

  // Función para obtener todas las compras pendientes y vencidas
  // ESTRATEGIA: Hacer consultas específicas para cada año (2025, 2026, etc.) y combinar resultados
  async getAllPendingAndOverduePurchases(company = 'solucions', year = null) {
    try {
      // Si se especifica un año, solo obtener facturas de ese año
      if (year) {
        console.log(`🚀 [Holded API] ${company} - Iniciando carga de facturas para el año ${year}...`);
        const [pendingPurchases, partiallyPaidPurchases, overduePurchases] = await Promise.all([
          this.getAllPendingPurchasesPages(company, year),
          this.getAllPartiallyPaidPurchasesPages(company, year),
          this.getAllOverduePurchasesPages(company, year)
        ]);

        const allDocuments = [...pendingPurchases, ...partiallyPaidPurchases, ...overduePurchases];
        const uniqueDocuments = allDocuments.filter((doc, index, self) => 
          index === self.findIndex(d => d.id === doc.id)
        );
        
        return uniqueDocuments;
      }
      
      // Si no se especifica año, obtener facturas de los últimos 2 años (2025 y 2026)
      console.log(`🚀 [Holded API] ${company} - Iniciando carga de facturas para 2025 y 2026...`);
      const currentYear = new Date().getFullYear();
      const yearsToFetch = [currentYear - 1, currentYear]; // [2025, 2026]
      
      console.log(`   📅 Obteniendo facturas de los años: ${yearsToFetch.join(', ')}`);
      
      // Obtener facturas de cada año en paralelo
      const allYearResults = await Promise.all(
        yearsToFetch.map(async (yearToFetch) => {
          console.log(`   🔍 Obteniendo facturas de ${yearToFetch}...`);
          const [pending, partiallyPaid, overdue] = await Promise.all([
            this.getAllPendingPurchasesPages(company, yearToFetch),
            this.getAllPartiallyPaidPurchasesPages(company, yearToFetch),
            this.getAllOverduePurchasesPages(company, yearToFetch)
          ]);
          
          const yearDocuments = [...pending, ...partiallyPaid, ...overdue];
          console.log(`   ✅ ${yearToFetch}: ${yearDocuments.length} facturas obtenidas`);
          return yearDocuments;
        })
      );
      
      // Combinar todas las facturas de todos los años
      const allDocuments = allYearResults.flat();
      
      console.log(`📊 [Holded API] ${company} - Resumen de facturas obtenidas:`);
      console.log(`   - Total antes de eliminar duplicados: ${allDocuments.length}`);

      // Eliminar duplicados basándose en el ID
      const uniqueDocuments = allDocuments.filter((doc, index, self) => 
        index === self.findIndex(d => d.id === doc.id)
      );
      
      console.log(`   - Total después de eliminar duplicados: ${uniqueDocuments.length}`);
      
      // Analizar años presentes en las facturas
      const years = new Set();
      uniqueDocuments.forEach(doc => {
        if (doc.date) {
          const date = new Date(doc.date * 1000);
          years.add(date.getFullYear());
        }
      });
      console.log(`   - Años encontrados: ${Array.from(years).sort().join(', ')}`);

      // Resumen de datos procesados

      // Obtener todos los contactos de una vez para hacer match por nombre
      const allContacts = await this.getAllContacts(company);
      
      // Crear un mapa de contactos por nombre (normalizado)
      const contactsMap = new Map();
      allContacts.forEach(contact => {
        const name = contact.name || contact.company || '';
        const normalizedName = name.toLowerCase().trim();
        if (normalizedName) {
          contactsMap.set(normalizedName, contact);
        }
      });

      // Enriquecer documentos con información de contactos
      const enrichedDocuments = uniqueDocuments.map((doc) => {
        try {
          // Obtener el nombre del proveedor del documento
          const providerName = doc.contact?.name || doc.contactName || '';
          const normalizedProviderName = providerName.toLowerCase().trim();
          
          // Buscar el contacto en el mapa
          const contactInfo = contactsMap.get(normalizedProviderName);
          
          if (contactInfo) {
            // Buscar IBAN en los datos del contacto
            let iban = '';
            if (contactInfo.iban) {
              iban = contactInfo.iban;
            } else if (contactInfo.bankAccount) {
              iban = contactInfo.bankAccount;
            } else if (contactInfo.bank_account) {
              iban = contactInfo.bank_account;
            } else if (contactInfo.accountNumber) {
              iban = contactInfo.accountNumber;
            } else if (contactInfo.account_number) {
              iban = contactInfo.account_number;
            } else if (contactInfo.bankDetails) {
              iban = contactInfo.bankDetails;
            } else if (contactInfo.bank_details) {
              iban = contactInfo.bank_details;
            } else if (contactInfo.paymentInfo) {
              iban = contactInfo.paymentInfo;
            } else if (contactInfo.payment_info) {
              iban = contactInfo.payment_info;
            }
            
            return {
              ...doc,
              contact: {
                ...doc.contact,
                ...contactInfo,
                iban: iban // Agregar el IBAN al contacto
              }
            };
          } else {
            return doc;
          }
        } catch (error) {
          return doc;
        }
      });

      return enrichedDocuments.map(doc => this.transformHoldedDocumentToInvoice(doc));
    } catch (error) {
      throw error;
    }
  }

  // Función para obtener información detallada de una compra específica
  async getPurchaseDetails(purchaseId, company = 'solucions') {
    try {
      const purchase = await this.makeRequest(`/documents/purchase/${purchaseId}`, {}, company);
      
      // Obtener información del contacto si está disponible
      if (purchase.contact?.id) {
        try {
          const contactInfo = await this.getContact(purchase.contact.id, company);
          purchase.contact = { ...purchase.contact, ...contactInfo };
        } catch (error) {
          // No se pudo obtener información del contacto
        }
      }
      
      return this.transformHoldedDocumentToInvoice(purchase);
    } catch (error) {
      throw error;
    }
  }



  // Función para sincronizar datos con nuestra base de datos
  async syncDocumentsWithDatabase(supabase, company = 'solucions') {
    try {
      const holdedDocuments = await this.getAllPendingAndOverduePurchases(company);
      
      // Obtener el usuario actual
      const { data: { user } } = await supabase.auth.getUser();
      
      // Crear un registro de sincronización PRIMERO
      const { data: syncRecord, error: syncError } = await supabase
        .from('excel_uploads')
        .insert({
          filename: `holded_sync_${new Date().toISOString()}`,
          size: 0,
          type: 'holded_api',
          uploaded_by: user?.id, // Incluir el ID del usuario actual
          metadata: {
            source: 'holded_api',
            documents_count: holdedDocuments.length,
            sync_date: new Date().toISOString()
          },
          processed: true,
          processed_at: new Date().toISOString()
        })
        .select()
        .single();

      if (syncError) {
        throw new Error(`Error creando registro de sincronización: ${syncError.message}`);
      }

      // Si no hay documentos para insertar, retornar éxito
      if (holdedDocuments.length === 0) {
        return {
          success: true,
          documentsCount: 0,
          insertedCount: 0,
          updatedCount: 0,
          syncRecord
        };
      }

      // Obtener holded_ids existentes para evitar duplicados
      const existingHoldedIds = holdedDocuments
        .filter(doc => doc.holded_id)
        .map(doc => doc.holded_id);

      const { data: existingInvoices, error: fetchError } = await supabase
        .from('invoices')
        .select('holded_id, id')
        .in('holded_id', existingHoldedIds);

      if (fetchError) {
        throw new Error(`Error verificando facturas existentes: ${fetchError.message}`);
      }

      // Crear mapas para facilitar la búsqueda
      const existingHoldedIdsMap = new Map(
        existingInvoices?.map(invoice => [invoice.holded_id, invoice.id]) || []
      );

      // Separar documentos en nuevos y existentes
      const newDocuments = [];
      const existingDocuments = [];

      holdedDocuments.forEach(doc => {
        if (doc.holded_id && existingHoldedIdsMap.has(doc.holded_id)) {
          existingDocuments.push({
            ...doc,
            upload_id: syncRecord.id,
            processed_at: new Date().toISOString()
          });
        } else {
          newDocuments.push({
            ...doc,
            upload_id: syncRecord.id,
            processed_at: new Date().toISOString()
          });
        }
      });

      let insertedCount = 0;
      let updatedCount = 0;

      // Insertar documentos nuevos
      if (newDocuments.length > 0) {
        const { data: insertedDocs, error: insertError } = await supabase
          .from('invoices')
          .insert(newDocuments)
          .select();

        if (insertError) {
          throw new Error(`Error insertando documentos nuevos: ${insertError.message}`);
        }

        insertedCount = insertedDocs?.length || 0;
      }

      // Actualizar documentos existentes
      if (existingDocuments.length > 0) {
        for (const doc of existingDocuments) {
          const existingId = existingHoldedIdsMap.get(doc.holded_id);
          if (existingId) {
            const { error: updateError } = await supabase
              .from('invoices')
              .update({
                invoice_number: doc.invoice_number,
                internal_number: doc.internal_number,
                issue_date: doc.issue_date,
                accounting_date: doc.accounting_date,
                due_date: doc.due_date,
                provider: doc.provider,
                description: doc.description,
                tags: doc.tags,
                account: doc.account,
                project: doc.project,
                subtotal: doc.subtotal,
                vat: doc.vat,
                retention: doc.retention,
                employees: doc.employees,
                equipment_recovery: doc.equipment_recovery,
                total: doc.total,
                paid: doc.paid,
                pending: doc.pending,
                status: doc.status,
                payment_date: doc.payment_date,
                holded_contact_id: doc.holded_contact_id,
                document_type: doc.document_type,
                upload_id: doc.upload_id,
                processed_at: doc.processed_at
              })
              .eq('id', existingId);

            if (!updateError) {
              updatedCount++;
            }
          }
        }
      }

      return {
        success: true,
        documentsCount: holdedDocuments.length,
        insertedCount: insertedCount,
        updatedCount: updatedCount,
        syncRecord
      };

    } catch (error) {
      // Intentar eliminar el registro de sincronización si existe
      if (syncRecord?.id) {
        try {
          await supabase
            .from('excel_uploads')
            .delete()
            .eq('id', syncRecord.id);
        } catch (deleteError) {
          // Error eliminando registro de sincronización
        }
      }
      
      throw error;
    }
  }

  // ==================== PRODUCTOS / INVENTARIO ====================
  
  /**
   * Obtener todos los productos de Holded
   * @param {Object} params - Parámetros de consulta (page, limit, etc.)
   * @param {string} company - Empresa ('solucions' o 'menjar')
   * @returns {Promise<Array>} Array de productos
   */
  async getProducts(params = {}, company = 'solucions') {
    try {
      const queryParams = new URLSearchParams();
      if (params.page) queryParams.append('page', params.page);
      if (params.limit) queryParams.append('limit', params.limit);
      
      const endpoint = `/products${queryParams.toString() ? `?${queryParams.toString()}` : ''}`;
      const products = await this.makeRequest(endpoint, {}, company);
      
      // La API puede devolver un array directamente o un objeto con paginación
      return Array.isArray(products) ? products : (products.products || products.data || []);
    } catch (error) {
      console.error(`Error obteniendo productos de Holded (${company}):`, error);
      throw error;
    }
  }

  /**
   * Obtener TODOS los productos de Holded paginando automáticamente
   * @param {string} company - Empresa ('solucions' o 'menjar')
   * @returns {Promise<Array>} Array completo de productos
   */
  async getAllProducts(company = 'solucions') {
    try {
      let allProducts = [];
      let page = 1;
      let hasMorePages = true;
      const limit = 100; // Límite por página (ajustar si es necesario)
      
      console.log(`🔍 [Holded API] Obteniendo todos los productos para ${company}...`);
      
      while (hasMorePages) {
        try {
          const products = await this.getProducts({ page, limit }, company);
          
          if (products && products.length > 0) {
            allProducts.push(...products);
            console.log(`📦 [Holded API] Página ${page}: ${products.length} productos (Total acumulado: ${allProducts.length})`);
            
            // Si recibimos menos productos que el límite, no hay más páginas
            if (products.length < limit) {
              hasMorePages = false;
            } else {
              page++;
            }
          } else {
            hasMorePages = false;
          }
        } catch (error) {
          console.error(`Error obteniendo productos en página ${page}:`, error);
          hasMorePages = false;
        }
      }
      
      console.log(`✅ [Holded API] Total de productos obtenidos para ${company}: ${allProducts.length}`);
      return allProducts;
    } catch (error) {
      console.error(`Error obteniendo todos los productos de Holded (${company}):`, error);
      throw error;
    }
  }

  /**
   * Obtener un producto específico por ID
   * @param {string} productId - ID del producto
   * @param {string} company - Empresa ('solucions' o 'menjar')
   * @returns {Promise<Object>} Producto
   */
  async getProduct(productId, company = 'solucions') {
    try {
      const endpoint = `/products/${productId}`;
      return await this.makeRequest(endpoint, {}, company);
    } catch (error) {
      console.error(`Error obteniendo producto ${productId} de Holded (${company}):`, error);
      throw error;
    }
  }

  /**
   * Crear un nuevo producto en Holded
   * @param {Object} productData - Datos del producto
   * @param {string} company - Empresa ('solucions' o 'menjar')
   * @returns {Promise<Object>} Producto creado
   */
  async createProduct(productData, company = 'solucions') {
    try {
      const endpoint = '/products';
      const options = {
        method: 'POST',
        body: JSON.stringify(productData)
      };
      return await this.makeRequest(endpoint, options, company);
    } catch (error) {
      console.error(`Error creando producto en Holded (${company}):`, error);
      throw error;
    }
  }

  /**
   * Actualizar un producto existente en Holded
   * @param {string} productId - ID del producto
   * @param {Object} productData - Datos a actualizar
   * @param {string} company - Empresa ('solucions' o 'menjar')
   * @returns {Promise<Object>} Producto actualizado
   */
  async updateProduct(productId, productData, company = 'solucions') {
    try {
      const endpoint = `/products/${productId}`;
      const options = {
        method: 'PUT',
        body: JSON.stringify(productData)
      };
      return await this.makeRequest(endpoint, options, company);
    } catch (error) {
      console.error(`Error actualizando producto ${productId} en Holded (${company}):`, error);
      throw error;
    }
  }

  /**
   * Eliminar un producto de Holded
   * @param {string} productId - ID del producto
   * @param {string} company - Empresa ('solucions' o 'menjar')
   * @returns {Promise<Object>} Resultado de la eliminación
   */
  async deleteProduct(productId, company = 'solucions') {
    try {
      const endpoint = `/products/${productId}`;
      const options = {
        method: 'DELETE'
      };
      return await this.makeRequest(endpoint, options, company);
    } catch (error) {
      console.error(`Error eliminando producto ${productId} de Holded (${company}):`, error);
      throw error;
    }
  }

  /**
   * Obtener la imagen principal de un producto
   * @param {string} productId - ID del producto
   * @param {string} company - Empresa ('solucions' o 'menjar')
   * @returns {Promise<Blob|Object>} Imagen del producto
   */
  async getProductMainImage(productId, company = 'solucions') {
    try {
      const endpoint = `/products/${productId}/image`;
      return await this.makeRequest(endpoint, {}, company);
    } catch (error) {
      console.error(`Error obteniendo imagen principal del producto ${productId} (${company}):`, error);
      throw error;
    }
  }

  /**
   * Listar todas las imágenes secundarias de un producto
   * @param {string} productId - ID del producto
   * @param {string} company - Empresa ('solucions' o 'menjar')
   * @returns {Promise<Array>} Lista de imágenes secundarias
   */
  async listProductImages(productId, company = 'solucions') {
    try {
      const endpoint = `/products/${productId}/imagesList`;
      const images = await this.makeRequest(endpoint, {}, company);
      return Array.isArray(images) ? images : (images.images || images.data || []);
    } catch (error) {
      console.error(`Error listando imágenes del producto ${productId} (${company}):`, error);
      throw error;
    }
  }

  /**
   * Obtener una imagen secundaria específica de un producto
   * @param {string} productId - ID del producto
   * @param {string} imageFileName - Nombre del archivo de imagen
   * @param {string} company - Empresa ('solucions' o 'menjar')
   * @returns {Promise<Blob|Object>} Imagen secundaria del producto
   */
  async getProductSecondaryImage(productId, imageFileName, company = 'solucions') {
    try {
      const endpoint = `/products/${productId}/image/${imageFileName}`;
      return await this.makeRequest(endpoint, {}, company);
    } catch (error) {
      console.error(`Error obteniendo imagen secundaria ${imageFileName} del producto ${productId} (${company}):`, error);
      throw error;
    }
  }

  /**
   * Actualizar el stock de un producto
   * @param {string} productId - ID del producto
   * @param {Object} stockData - Datos del stock (objeto con propiedades de stock)
   * @param {string} company - Empresa ('solucions' o 'menjar')
   * @returns {Promise<Object>} Producto actualizado
   */
  async updateProductStock(productId, stockData, company = 'solucions') {
    try {
      const endpoint = `/products/${productId}/stock`;
      const options = {
        method: 'PUT',
        body: JSON.stringify({ stock: stockData })
      };
      return await this.makeRequest(endpoint, options, company);
    } catch (error) {
      console.error(`Error actualizando stock del producto ${productId} (${company}):`, error);
      throw error;
    }
  }
}

export default new HoldedApiService(); 