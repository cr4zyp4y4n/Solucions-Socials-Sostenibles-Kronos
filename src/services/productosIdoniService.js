import hojaRutaService from './hojaRutaService';

/**
 * Service for managing IDONI/BONCOR products from hojas de ruta
 */
class ProductosIdoniService {
    /**
     * Get all products grouped by hoja de ruta
     * Sorted by most recent service date first
     * @returns {Array} Array of hojas with their IDONI/BONCOR products
     */
    getProductosPorHojaRuta() {
        const hojas = hojaRutaService.getAllHojasRuta();

        return hojas
            .filter(hoja => hoja.productosIdoni && hoja.productosIdoni.length > 0)
            .sort((a, b) => {
                // Sort by service date, most recent first
                const dateA = new Date(a.fechaServicio || a.fechaCreacion);
                const dateB = new Date(b.fechaServicio || b.fechaCreacion);
                return dateB - dateA;
            })
            .map(hoja => ({
                hojaRutaId: hoja.id,
                cliente: hoja.cliente,
                fechaServicio: hoja.fechaServicio,
                fechaCreacion: hoja.fechaCreacion,
                productos: hoja.productosIdoni || [],
                nombreArchivo: hoja.nombreArchivo
            }));
    }

    /**
     * Get all products flattened (not grouped by hoja)
     * @returns {Array} Array of all products with hoja info
     */
    getAllProductos() {
        const hojasPorRuta = this.getProductosPorHojaRuta();
        const productos = [];

        hojasPorRuta.forEach(hoja => {
            hoja.productos.forEach(producto => {
                productos.push({
                    ...producto,
                    hojaRutaId: hoja.hojaRutaId,
                    cliente: hoja.cliente,
                    fechaServicio: hoja.fechaServicio
                });
            });
        });

        return productos;
    }

    /**
     * Update the estado of a specific product
     * @param {string} hojaRutaId - ID of the hoja de ruta
     * @param {string} productoId - ID of the product
     * @param {string} nuevoEstado - New estado (pendiente, disponible, no_disponible)
     * @returns {boolean} Success status
     */
    updateProductoEstado(hojaRutaId, productoId, nuevoEstado) {
        try {
            const hoja = hojaRutaService.getHojaRutaById(hojaRutaId);

            if (!hoja || !hoja.productosIdoni) {
                console.error('Hoja de ruta no encontrada o sin productos IDONI');
                return false;
            }

            const producto = hoja.productosIdoni.find(p => p.id === productoId);

            if (!producto) {
                console.error('Producto no encontrado:', productoId);
                return false;
            }

            // Update estado
            producto.estado = nuevoEstado;
            producto.fechaActualizacion = new Date().toISOString();

            // Save updated hoja
            hojaRutaService.updateHojaRuta(hojaRutaId, hoja);

            console.log(`✅ Producto actualizado: ${producto.producto} → ${nuevoEstado}`);
            return true;
        } catch (error) {
            console.error('Error actualizando estado de producto:', error);
            return false;
        }
    }

    /**
     * Get statistics of product estados
     * @returns {Object} Statistics object with counts
     */
    getEstadisticas() {
        const productos = this.getAllProductos();

        const stats = {
            total: productos.length,
            pendientes: 0,
            disponibles: 0,
            noDisponibles: 0
        };

        productos.forEach(p => {
            switch (p.estado) {
                case 'pendiente':
                    stats.pendientes++;
                    break;
                case 'disponible':
                    stats.disponibles++;
                    break;
                case 'no_disponible':
                    stats.noDisponibles++;
                    break;
            }
        });

        return stats;
    }

    /**
     * Search products by name
     * @param {string} searchTerm - Search term
     * @returns {Array} Filtered products
     */
    searchProductos(searchTerm) {
        if (!searchTerm || searchTerm.trim() === '') {
            return this.getProductosPorHojaRuta();
        }

        const term = searchTerm.toLowerCase();
        const hojasPorRuta = this.getProductosPorHojaRuta();

        return hojasPorRuta
            .map(hoja => ({
                ...hoja,
                productos: hoja.productos.filter(p =>
                    p.producto.toLowerCase().includes(term) ||
                    p.proveedor.toLowerCase().includes(term) ||
                    hoja.cliente.toLowerCase().includes(term)
                )
            }))
            .filter(hoja => hoja.productos.length > 0);
    }

    /**
     * Filter products by estado
     * @param {string} estado - Estado to filter by
     * @returns {Array} Filtered products
     */
    filterByEstado(estado) {
        const hojasPorRuta = this.getProductosPorHojaRuta();

        return hojasPorRuta
            .map(hoja => ({
                ...hoja,
                productos: hoja.productos.filter(p => p.estado === estado)
            }))
            .filter(hoja => hoja.productos.length > 0);
    }

    /**
     * Get summary for a specific hoja de ruta
     * @param {string} hojaRutaId - ID of the hoja de ruta
     * @returns {Object} Summary object
     */
    getResumenHoja(hojaRutaId) {
        const hoja = hojaRutaService.getHojaRutaById(hojaRutaId);

        if (!hoja || !hoja.productosIdoni) {
            return null;
        }

        const productos = hoja.productosIdoni;
        const resumen = {
            total: productos.length,
            pendientes: productos.filter(p => p.estado === 'pendiente').length,
            disponibles: productos.filter(p => p.estado === 'disponible').length,
            noDisponibles: productos.filter(p => p.estado === 'no_disponible').length
        };

        return resumen;
    }

    /**
     * Mark all products in a hoja as a specific estado
     * @param {string} hojaRutaId - ID of the hoja de ruta
     * @param {string} estado - Estado to set
     * @returns {boolean} Success status
     */
    marcarTodosProductos(hojaRutaId, estado) {
        try {
            const hoja = hojaRutaService.getHojaRutaById(hojaRutaId);

            if (!hoja || !hoja.productosIdoni) {
                return false;
            }

            hoja.productosIdoni.forEach(producto => {
                producto.estado = estado;
                producto.fechaActualizacion = new Date().toISOString();
            });

            hojaRutaService.updateHojaRuta(hojaRutaId, hoja);
            return true;
        } catch (error) {
            console.error('Error marcando todos los productos:', error);
            return false;
        }
    }
}

export default new ProductosIdoniService();
