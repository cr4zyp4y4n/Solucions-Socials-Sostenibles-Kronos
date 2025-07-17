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

      // Usar IPC para hacer la petición desde el main process
      const response = await window.electronAPI.makeHoldedRequest({
        url: `${this.baseUrl}${endpoint}`,
        options: {
          headers: {
            'Content-Type': 'application/json',
            'key': apiKey,
            ...options.headers
          },
          ...options
        }
      });

      if (!response.ok) {
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

    return this.makeRequest(endpoint, {}, company);
  }

  // Obtener compras pendientes (no pagadas)
  async getPendingPurchases(page = 1, limit = 100, company = 'solucions') {
    return this.getPurchases({
      page,
      limit,
      paid: '0' // 0 = not paid
    }, company);
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
  async getOverduePurchases(page = 1, limit = 100, company = 'solucions') {
    const today = new Date().toISOString().split('T')[0];
    return this.getPurchases({
      page,
      limit,
      paid: '0', // no pagadas
      endtmp: today // hasta hoy (vencidas)
    }, company);
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
  async getAllPendingPurchasesPages(company = 'solucions') {
    const allPurchases = [];
    let page = 1;
    let hasMorePages = true;
    const limit = 100; // Máximo por página

    while (hasMorePages) {
      try {
        const purchases = await this.getPendingPurchases(page, limit, company);
        
        if (purchases && purchases.length > 0) {
          allPurchases.push(...purchases);
          
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
        console.error(`Error obteniendo página ${page} de compras pendientes:`, error);
        hasMorePages = false;
      }
    }

    return allPurchases;
  }

  // Obtener TODAS las compras vencidas (todas las páginas)
  async getAllOverduePurchasesPages(company = 'solucions') {
    const allPurchases = [];
    let page = 1;
    let hasMorePages = true;
    const limit = 100; // Máximo por página

    while (hasMorePages) {
      try {
        const purchases = await this.getOverduePurchases(page, limit, company);
        
        if (purchases && purchases.length > 0) {
          allPurchases.push(...purchases);
          
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
        console.error(`Error obteniendo página ${page} de compras vencidas:`, error);
        hasMorePages = false;
      }
    }

    return allPurchases;
  }

  // Obtener TODAS las compras sin filtros (para diagnóstico)
  async getAllPurchasesForDiagnosis(company = 'solucions') {
    const allPurchases = [];
    let page = 1;
    let hasMorePages = true;
    const limit = 100;

    console.log('🔍 DIAGNÓSTICO: Obteniendo TODAS las compras sin filtros...');

    while (hasMorePages) {
      try {
        const purchases = await this.getPurchases({
          page,
          limit,
          sort: 'created-desc'
        }, company);
        
        if (purchases && purchases.length > 0) {
          allPurchases.push(...purchases);
          console.log(`Página ${page}: ${purchases.length} compras totales`);
          
          // Analizar status de esta página
          const statusCount = {};
          purchases.forEach(purchase => {
            const status = purchase.status || 'sin_status';
            statusCount[status] = (statusCount[status] || 0) + 1;
          });
          console.log(`Status en página ${page}:`, statusCount);
          
          if (purchases.length < limit) {
            hasMorePages = false;
          } else {
            page++;
          }
        } else {
          hasMorePages = false;
        }
      } catch (error) {
        console.error(`Error obteniendo página ${page} de compras totales:`, error);
        hasMorePages = false;
      }
    }

    console.log(`🔍 Total de compras obtenidas: ${allPurchases.length}`);
    
    // Análisis completo de status
    const totalStatusCount = {};
    allPurchases.forEach(purchase => {
      const status = purchase.status || 'sin_status';
      totalStatusCount[status] = (totalStatusCount[status] || 0) + 1;
    });
    console.log('📊 Análisis completo de status:', totalStatusCount);
    
    // Mostrar compras no pagadas
    const unpaidPurchases = allPurchases.filter(p => p.paid === false || p.paid === 0);
    console.log(`💰 Compras no pagadas (paid=false/0): ${unpaidPurchases.length}`);
    
    return allPurchases;
  }

  // Obtener compras con diferentes filtros para encontrar las faltantes
  async findMissingPurchases(company = 'solucions') {
    console.log('🔍 Buscando compras faltantes...');
    
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
      console.log(`📋 ${name}: ${filtered.length} compras`);
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
      console.error('Error obteniendo todos los contactos:', error);
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
        console.warn(`Fecha inválida en ${field}:`, cleaned[field]);
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
    // Determinar el canal basándose en el proveedor o tags
    const determineChannel = (provider, tags) => {
      const providerLower = (provider || '').toLowerCase();
      const tagsLower = (tags || '').toLowerCase();
      
      // Buscar palabras clave en proveedor y tags
      const searchText = `${providerLower} ${tagsLower}`;
      
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
    

    
    const transformed = {
      invoice_number: holdedDocument.docNumber || holdedDocument.num || holdedDocument.number || `HOLD-${holdedDocument.id}`,
      internal_number: holdedDocument.internalNum || holdedDocument.docNumber || holdedDocument.num || holdedDocument.number,
      issue_date: this.convertHoldedDate(holdedDocument.date),
      accounting_date: this.convertHoldedDate(holdedDocument.accountingDate),
      due_date: this.convertHoldedDate(holdedDocument.dueDate),
      provider: contactName,
      description: holdedDocument.notes || holdedDocument.description || `Compra ${channel} - ${contactName}`,
      tags: holdedDocument.tags?.join(', ') || '',
      account: channel, // Usar el canal como cuenta para filtros
      project: holdedDocument.project || channel,
      subtotal: holdedDocument.subtotal,
      vat: holdedDocument.tax,
      retention: holdedDocument.retention,
      employees: holdedDocument.employees,
      equipment_recovery: holdedDocument.equipmentRecovery,
      total: holdedDocument.total,
      paid: holdedDocument.paid || false,
      pending: holdedDocument.pending || holdedDocument.total,
      status: holdedDocument.status || 'Pendiente',
      payment_date: this.convertHoldedDate(holdedDocument.paymentDate),
      holded_id: holdedDocument.id, // ID original de Holded para referencia
      holded_contact_id: holdedDocument.contact?.id,
      iban: contactIban, // IBAN del proveedor
      document_type: 'purchase' // Solo compras ahora
    };
    
    return this.validateAndCleanInvoiceData(transformed);
  }

  // Función para obtener todas las compras pendientes y vencidas
  async getAllPendingAndOverduePurchases(company = 'solucions') {
    try {
      const [pendingPurchases, overduePurchases] = await Promise.all([
        this.getAllPendingPurchasesPages(company),
        this.getAllOverduePurchasesPages(company)
      ]);

      // Combinar y eliminar duplicados basándose en el ID
      const allDocuments = [...pendingPurchases, ...overduePurchases];
      const uniqueDocuments = allDocuments.filter((doc, index, self) => 
        index === self.findIndex(d => d.id === doc.id)
      );

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
      console.error('Error obteniendo compras de Holded:', error);
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
          console.log(`No se pudo obtener información del contacto:`, error.message);
        }
      }
      
      return this.transformHoldedDocumentToInvoice(purchase);
    } catch (error) {
      console.error('Error obteniendo detalles de la compra:', error);
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

      // Verificar que el registro se creó correctamente
      console.log('Registro de sincronización creado:', syncRecord);

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

      console.log('Verificando facturas existentes...');
      const { data: existingInvoices, error: fetchError } = await supabase
        .from('invoices')
        .select('holded_id, id')
        .in('holded_id', existingHoldedIds);

      if (fetchError) {
        console.error('Error obteniendo facturas existentes:', fetchError);
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

      console.log(`Documentos nuevos: ${newDocuments.length}, Documentos existentes: ${existingDocuments.length}`);

      let insertedCount = 0;
      let updatedCount = 0;

      // Insertar documentos nuevos
      if (newDocuments.length > 0) {
        console.log('Insertando documentos nuevos...');
        const { data: insertedDocs, error: insertError } = await supabase
          .from('invoices')
          .insert(newDocuments)
          .select();

        if (insertError) {
          console.error('Error insertando documentos nuevos:', insertError);
          throw new Error(`Error insertando documentos nuevos: ${insertError.message}`);
        }

        insertedCount = insertedDocs?.length || 0;
        console.log(`Insertados ${insertedCount} documentos nuevos`);
      }

      // Actualizar documentos existentes
      if (existingDocuments.length > 0) {
        console.log('Actualizando documentos existentes...');
        
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

            if (updateError) {
              console.error(`Error actualizando documento ${doc.holded_id}:`, updateError);
            } else {
              updatedCount++;
            }
          }
        }
        
        console.log(`Actualizados ${updatedCount} documentos existentes`);
      }

      return {
        success: true,
        documentsCount: holdedDocuments.length,
        insertedCount: insertedCount,
        updatedCount: updatedCount,
        syncRecord
      };

    } catch (error) {
      console.error('Error en sincronización con Holded:', error);
      
      // Intentar eliminar el registro de sincronización si existe
      if (syncRecord?.id) {
        try {
          await supabase
            .from('excel_uploads')
            .delete()
            .eq('id', syncRecord.id);
          console.log('Registro de sincronización eliminado debido al error');
        } catch (deleteError) {
          console.error('Error eliminando registro de sincronización:', deleteError);
        }
      }
      
      throw error;
    }
  }
}

export default new HoldedApiService(); 