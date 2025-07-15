// Servicio para la API de Holded
const HOLDED_API_KEY = 'cfe50911f41fe8de885b167988773e09';
const HOLDED_BASE_URL = 'https://api.holded.com/api/invoicing/v1';

class HoldedApiService {
  constructor() {
    this.apiKey = HOLDED_API_KEY;
    this.baseUrl = HOLDED_BASE_URL;
  }

  // Método genérico para hacer peticiones a la API usando IPC
  async makeRequest(endpoint, options = {}) {
    try {
      // Usar IPC para hacer la petición desde el main process
      const response = await window.electronAPI.makeHoldedRequest({
        url: `${this.baseUrl}${endpoint}`,
        options: {
          headers: {
            'Content-Type': 'application/json',
            'key': this.apiKey,
            ...options.headers
          },
          ...options
        }
      });

      if (!response.ok) {
        throw new Error(`Error en la API de Holded: ${response.status} ${response.statusText}`);
      }

      return response.data;
    } catch (error) {
      console.error('Error en la petición a Holded API:', error);
      
      // Si el error indica que la API key es inválida, dar un mensaje más claro
      if (error.message.includes('Unexpected token') || error.message.includes('<div')) {
        throw new Error('API key de Holded inválida o no autorizada. Verifica tu API key.');
      }
      
      throw error;
    }
  }

  // Método de prueba simple para verificar conexión
  async testConnection() {
    return this.makeRequest('/documents/purchase?page=1&limit=1');
  }

  // Obtener compras (purchases) con filtros opcionales
  async getPurchases(params = {}) {
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

    return this.makeRequest(endpoint);
  }

  // Obtener compras pendientes (no pagadas)
  async getPendingPurchases(page = 1, limit = 100) {
    return this.getPurchases({
      page,
      limit,
      paid: '0' // 0 = not paid
    });
  }

  // Obtener compras vencidas (pendientes con fecha de vencimiento pasada)
  async getOverduePurchases(page = 1, limit = 100) {
    const today = new Date().toISOString().split('T')[0];
    return this.getPurchases({
      page,
      limit,
      paid: '0', // no pagadas
      endtmp: today // hasta hoy (vencidas)
    });
  }

  // Obtener contactos (proveedores)
  async getContacts(page = 1, limit = 100) {
    return this.makeRequest(`/contacts?page=${page}&limit=${limit}`);
  }

  // Obtener un contacto específico
  async getContact(contactId) {
    return this.makeRequest(`/contacts/${contactId}`);
  }

  // Obtener grupos de contactos
  async getContactGroups() {
    return this.makeRequest('/contacts/groups');
  }

  // Obtener productos
  async getProducts(page = 1, limit = 100) {
    return this.makeRequest(`/products?page=${page}&limit=${limit}`);
  }

  // Obtener servicios
  async getServices(page = 1, limit = 100) {
    return this.makeRequest(`/services?page=${page}&limit=${limit}`);
  }

  // Obtener métodos de pago
  async getPaymentMethods() {
    return this.makeRequest('/paymentmethods');
  }

  // Obtener pagos
  async getPayments(page = 1, limit = 100) {
    return this.makeRequest(`/payments?page=${page}&limit=${limit}`);
  }

  // Obtener impuestos
  async getTaxes() {
    return this.makeRequest('/taxes');
  }

  // Obtener tesorería
  async getTreasury() {
    return this.makeRequest('/treasury');
  }

  // Obtener cuentas de gastos
  async getExpensesAccounts() {
    return this.makeRequest('/expensesaccounts');
  }

  // Obtener series de numeración
  async getNumberingSeries(type) {
    return this.makeRequest(`/numberingseries/${type}`);
  }

  // Obtener canales de venta
  async getSalesChannels() {
    return this.makeRequest('/saleschannels');
  }

  // Obtener remesas
  async getRemittances(page = 1, limit = 100) {
    return this.makeRequest(`/remittances?page=${page}&limit=${limit}`);
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
      
      if (providerLower.includes('catering') || tagsLower.includes('catering')) {
        return 'CATERING';
      } else if (providerLower.includes('estructura') || tagsLower.includes('estructura')) {
        return 'ESTRUCTURA';
      } else if (providerLower.includes('idoni') || tagsLower.includes('idoni')) {
        return 'IDONI';
      } else {
        return 'OTROS';
      }
    };

    const channel = determineChannel(holdedDocument.contact?.name, holdedDocument.tags?.join(', '));
    
    // Obtener información adicional del contacto si está disponible
    const contactInfo = holdedDocument.contact || {};
    const contactName = contactInfo.name || contactInfo.company || holdedDocument.contactName || 'Proveedor Holded';
    const contactEmail = contactInfo.email || '';
    const contactPhone = contactInfo.phone || '';
    
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
      document_type: 'purchase' // Solo compras ahora
    };
    
    return this.validateAndCleanInvoiceData(transformed);
  }

  // Función para obtener todas las compras pendientes y vencidas
  async getAllPendingAndOverduePurchases() {
    try {
      const [pendingPurchases, overduePurchases] = await Promise.all([
        this.getPendingPurchases(),
        this.getOverduePurchases()
      ]);

      // Combinar y eliminar duplicados basándose en el ID
      const allDocuments = [...pendingPurchases, ...overduePurchases];
      const uniqueDocuments = allDocuments.filter((doc, index, self) => 
        index === self.findIndex(d => d.id === doc.id)
      );

      // Obtener información adicional de contactos para cada compra
      const enrichedDocuments = await Promise.all(
        uniqueDocuments.map(async (doc) => {
          try {
            // Si tenemos un contact ID, obtener información adicional del contacto
            if (doc.contact?.id) {
              const contactInfo = await this.getContact(doc.contact.id);
              return {
                ...doc,
                contact: {
                  ...doc.contact,
                  ...contactInfo
                }
              };
            }
            return doc;
          } catch (error) {
            console.log(`No se pudo obtener información adicional del contacto ${doc.contact?.id}:`, error.message);
            return doc;
          }
        })
      );

      return enrichedDocuments.map(doc => this.transformHoldedDocumentToInvoice(doc));
    } catch (error) {
      console.error('Error obteniendo compras de Holded:', error);
      throw error;
    }
  }

  // Función para obtener información detallada de una compra específica
  async getPurchaseDetails(purchaseId) {
    try {
      const purchase = await this.makeRequest(`/documents/purchase/${purchaseId}`);
      
      // Obtener información del contacto si está disponible
      if (purchase.contact?.id) {
        try {
          const contactInfo = await this.getContact(purchase.contact.id);
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
  async syncDocumentsWithDatabase(supabase) {
    try {
      const holdedDocuments = await this.getAllPendingAndOverduePurchases();
      
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