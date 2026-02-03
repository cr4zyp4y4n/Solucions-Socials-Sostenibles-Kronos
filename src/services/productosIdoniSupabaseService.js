import { supabase } from '../config/supabase';

/**
 * Servicio para gestionar productos IDONI/BONCOR desde Supabase
 */
class ProductosIdoniSupabaseService {

    /**
     * Obtener todos los productos IDONI/BONCOR agrupados por hoja de ruta
     * Ordenados por fecha de servicio más reciente primero
     */
    async getProductosPorHojaRuta() {
        try {
            console.log('📦 Obteniendo productos IDONI/BONCOR desde Supabase...');

            // Obtener productos con información de la hoja de ruta
            const { data: productos, error } = await supabase
                .from('productos_idoni')
                .select(`
          *,
          hojas_ruta (
            id,
            cliente,
            fecha_servicio
          )
        `)
                .order('created_at', { ascending: false });

            if (error) {
                console.error('❌ Error obteniendo productos:', error);
                throw error;
            }

            console.log('✅ Productos obtenidos:', productos?.length || 0);
            console.log('📋 Datos completos:', productos);

            // Agrupar por hoja de ruta
            const productosAgrupados = {};

            productos?.forEach(producto => {
                const hojaId = producto.hoja_ruta_id;

                console.log('Procesando producto:', {
                    id: producto.id,
                    hojaId: hojaId,
                    producto: producto.producto,
                    hojas_ruta: producto.hojas_ruta
                });

                if (!productosAgrupados[hojaId]) {
                    productosAgrupados[hojaId] = {
                        hojaId: hojaId,
                        cliente: producto.hojas_ruta?.cliente || 'Sin cliente',
                        fechaServicio: producto.hojas_ruta?.fecha_servicio || new Date().toISOString(),
                        productos: []
                    };
                }

                productosAgrupados[hojaId].productos.push({
                    id: producto.id,
                    producto: producto.producto,
                    cantidad: producto.cantidad,
                    proveedor: producto.proveedor,
                    estado: producto.estado,
                    orden: producto.orden,
                    fechaActualizacion: producto.fecha_actualizacion
                });
            });

            // Convertir a array y ordenar por fecha
            const resultado = Object.values(productosAgrupados).sort((a, b) => {
                return new Date(b.fechaServicio) - new Date(a.fechaServicio);
            });

            console.log('📊 Resultado final:', resultado.length, 'hojas de ruta con productos');
            console.log('📦 Hojas agrupadas:', resultado);
            return resultado;
        } catch (error) {
            console.error('❌ Error en getProductosPorHojaRuta:', error);
            return [];
        }
    }

    /**
     * Actualizar el estado de un producto
     */
    async updateProductoEstado(productoId, nuevoEstado) {
        try {
            const { error } = await supabase
                .from('productos_idoni')
                .update({
                    estado: nuevoEstado,
                    fecha_actualizacion: new Date().toISOString()
                })
                .eq('id', productoId);

            if (error) throw error;

            console.log(`✅ Producto ${productoId} actualizado a estado: ${nuevoEstado}`);
            return true;
        } catch (error) {
            console.error('❌ Error actualizando estado:', error);
            throw error;
        }
    }

    /**
     * Obtener estadísticas de productos
     */
    async getEstadisticas() {
        try {
            const { data: productos, error } = await supabase
                .from('productos_idoni')
                .select('estado');

            if (error) throw error;

            const stats = {
                total: productos?.length || 0,
                pendientes: productos?.filter(p => p.estado === 'pendiente').length || 0,
                disponibles: productos?.filter(p => p.estado === 'disponible').length || 0,
                noDisponibles: productos?.filter(p => p.estado === 'no_disponible').length || 0
            };

            return stats;
        } catch (error) {
            console.error('❌ Error obteniendo estadísticas:', error);
            return { total: 0, pendientes: 0, disponibles: 0, noDisponibles: 0 };
        }
    }

    /**
     * Buscar productos por término
     */
    async searchProductos(searchTerm) {
        try {
            const productosAgrupados = await this.getProductosPorHojaRuta();

            if (!searchTerm || searchTerm.trim() === '') {
                return productosAgrupados;
            }

            const term = searchTerm.toLowerCase();

            return productosAgrupados
                .map(hoja => ({
                    ...hoja,
                    productos: hoja.productos.filter(p =>
                        p.producto.toLowerCase().includes(term) ||
                        p.proveedor.toLowerCase().includes(term) ||
                        hoja.cliente.toLowerCase().includes(term)
                    )
                }))
                .filter(hoja => hoja.productos.length > 0);
        } catch (error) {
            console.error('❌ Error buscando productos:', error);
            return [];
        }
    }

    /**
     * Filtrar productos por estado
     */
    async filterByEstado(estado) {
        try {
            const productosAgrupados = await this.getProductosPorHojaRuta();

            if (estado === 'todos') {
                return productosAgrupados;
            }

            return productosAgrupados
                .map(hoja => ({
                    ...hoja,
                    productos: hoja.productos.filter(p => p.estado === estado)
                }))
                .filter(hoja => hoja.productos.length > 0);
        } catch (error) {
            console.error('❌ Error filtrando productos:', error);
            return [];
        }
    }

    /**
     * Marcar todos los productos de una hoja de ruta con un estado
     */
    async marcarTodosProductosHoja(hojaId, estado) {
        try {
            const { error } = await supabase
                .from('productos_idoni')
                .update({
                    estado: estado,
                    fecha_actualizacion: new Date().toISOString()
                })
                .eq('hoja_ruta_id', hojaId);

            if (error) throw error;

            console.log(`✅ Todos los productos de la hoja ${hojaId} marcados como: ${estado}`);
            return true;
        } catch (error) {
            console.error('❌ Error marcando productos:', error);
            throw error;
        }
    }
}

export default new ProductosIdoniSupabaseService();
