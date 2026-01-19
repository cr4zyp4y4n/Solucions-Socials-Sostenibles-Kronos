import { supabase } from '../config/supabase';
import { compressImage, validateImageFile } from '../utils/imageCompression';

/**
 * Service for managing Hojas Técnicas (Technical Sheets)
 */
class HojasTecnicasService {
    constructor() {
        this.tableName = 'hojas_tecnicas';
        this.ingredientesTable = 'hoja_tecnica_ingredientes';
        this.allergenosTable = 'hoja_tecnica_alergenos';
        this.storageBucket = 'dish-images';
    }

    /**
     * Get all hojas técnicas with their ingredients and allergens
     * @returns {Promise<Array>} Array of hojas técnicas
     */
    async getHojasTecnicas() {
        try {
            const { data, error } = await supabase
                .from(this.tableName)
                .select(`
          *,
          ingredientes:hoja_tecnica_ingredientes(
            id,
            nombre_ingrediente,
            peso_gramos,
            coste_euros,
            gastos_euros,
            orden
          ),
          alergenos:hoja_tecnica_alergenos(
            id,
            tipo_alergeno
          )
        `)
                .order('created_at', { ascending: false });

            if (error) {
                console.error('❌ Error fetching hojas técnicas:', error);
                throw error;
            }

            // Calculate cost summary for each hoja técnica
            const hojasConResumen = (data || []).map(hoja => ({
                ...hoja,
                resumen_costes: this.calculateCostSummary(hoja.ingredientes || [])
            }));

            return hojasConResumen;
        } catch (error) {
            console.error('💥 Error in getHojasTecnicas:', error);
            throw new Error('Error al obtener las hojas técnicas');
        }
    }

    /**
     * Get a single hoja técnica by ID
     * @param {string} id - The hoja técnica ID
     * @returns {Promise<Object>} Hoja técnica with details
     */
    async getHojaTecnicaById(id) {
        try {
            const { data, error } = await supabase
                .from(this.tableName)
                .select(`
          *,
          ingredientes:hoja_tecnica_ingredientes(
            id,
            nombre_ingrediente,
            peso_gramos,
            coste_euros,
            gastos_euros,
            orden
          ),
          alergenos:hoja_tecnica_alergenos(
            id,
            tipo_alergeno
          )
        `)
                .eq('id', id)
                .single();

            if (error) {
                console.error('❌ Error fetching hoja técnica:', error);
                throw error;
            }

            return {
                ...data,
                resumen_costes: this.calculateCostSummary(data.ingredientes || [])
            };
        } catch (error) {
            console.error('💥 Error in getHojaTecnicaById:', error);
            throw new Error('Error al obtener la hoja técnica');
        }
    }

    /**
     * Create a new hoja técnica
     * @param {Object} hojaData - The hoja técnica data
     * @param {string} hojaData.nombre_plato - Dish name (required)
     * @param {File} hojaData.imagen - Image file (optional)
     * @param {Array} hojaData.ingredientes - Array of ingredients
     * @param {Array} hojaData.alergenos - Array of allergens
     * @returns {Promise<Object>} Created hoja técnica
     */
    async createHojaTecnica(hojaData) {
        try {
            let imagenUrl = null;

            // Upload image if provided
            if (hojaData.imagen) {
                imagenUrl = await this.uploadDishImage(hojaData.imagen);
            }

            // Get current user
            const { data: { user } } = await supabase.auth.getUser();

            // Create main hoja técnica record
            const { data: hoja, error: hojaError } = await supabase
                .from(this.tableName)
                .insert([{
                    nombre_plato: hojaData.nombre_plato.trim(),
                    imagen_url: imagenUrl,
                    created_by: user?.id
                }])
                .select()
                .single();

            if (hojaError) {
                console.error('❌ Error creating hoja técnica:', hojaError);
                // Clean up uploaded image if hoja creation failed
                if (imagenUrl) {
                    await this.deleteDishImage(imagenUrl);
                }
                throw hojaError;
            }

            // Add ingredients
            if (hojaData.ingredientes && hojaData.ingredientes.length > 0) {
                await this.updateIngredientes(hoja.id, hojaData.ingredientes);
            }

            // Add allergens
            if (hojaData.alergenos && hojaData.alergenos.length > 0) {
                await this.updateAlergenos(hoja.id, hojaData.alergenos);
            }

            // Fetch complete hoja técnica
            return await this.getHojaTecnicaById(hoja.id);
        } catch (error) {
            console.error('💥 Error in createHojaTecnica:', error);
            throw new Error('Error al crear la hoja técnica: ' + error.message);
        }
    }

    /**
     * Update an existing hoja técnica
     * @param {string} id - The hoja técnica ID
     * @param {Object} hojaData - Updated data
     * @returns {Promise<Object>} Updated hoja técnica
     */
    async updateHojaTecnica(id, hojaData) {
        try {
            // Get existing hoja to check for image changes
            const existing = await this.getHojaTecnicaById(id);
            let imagenUrl = existing.imagen_url;

            // Handle image update
            if (hojaData.imagen instanceof File) {
                // Delete old image if exists
                if (existing.imagen_url) {
                    await this.deleteDishImage(existing.imagen_url);
                }
                // Upload new image
                imagenUrl = await this.uploadDishImage(hojaData.imagen);
            } else if (hojaData.imagen === null && existing.imagen_url) {
                // User wants to remove image
                await this.deleteDishImage(existing.imagen_url);
                imagenUrl = null;
            }

            // Update main record
            const { data: hoja, error: hojaError } = await supabase
                .from(this.tableName)
                .update({
                    nombre_plato: hojaData.nombre_plato.trim(),
                    imagen_url: imagenUrl
                })
                .eq('id', id)
                .select()
                .single();

            if (hojaError) {
                console.error('❌ Error updating hoja técnica:', hojaError);
                throw hojaError;
            }

            // Update ingredients
            if (hojaData.ingredientes) {
                await this.updateIngredientes(id, hojaData.ingredientes);
            }

            // Update allergens
            if (hojaData.alergenos) {
                await this.updateAlergenos(id, hojaData.alergenos);
            }

            // Fetch complete updated hoja técnica
            return await this.getHojaTecnicaById(id);
        } catch (error) {
            console.error('💥 Error in updateHojaTecnica:', error);
            throw new Error('Error al actualizar la hoja técnica');
        }
    }

    /**
     * Delete a hoja técnica
     * @param {string} id - The hoja técnica ID
     * @returns {Promise<boolean>} Success status
     */
    async deleteHojaTecnica(id) {
        try {
            // Get hoja to delete associated image
            const hoja = await this.getHojaTecnicaById(id);

            // Delete from database (cascade will delete ingredients and allergens)
            const { error } = await supabase
                .from(this.tableName)
                .delete()
                .eq('id', id);

            if (error) {
                console.error('❌ Error deleting hoja técnica:', error);
                throw error;
            }

            // Delete image from storage
            if (hoja.imagen_url) {
                await this.deleteDishImage(hoja.imagen_url);
            }

            return true;
        } catch (error) {
            console.error('💥 Error in deleteHojaTecnica:', error);
            throw new Error('Error al eliminar la hoja técnica');
        }
    }

    /**
     * Update ingredients for a hoja técnica
     * @param {string} hojaId - The hoja técnica ID
     * @param {Array} ingredientes - Array of ingredients
     * @returns {Promise<void>}
     */
    async updateIngredientes(hojaId, ingredientes) {
        try {
            // Delete existing ingredients
            await supabase
                .from(this.ingredientesTable)
                .delete()
                .eq('hoja_tecnica_id', hojaId);

            // Insert new ingredients
            if (ingredientes.length > 0) {
                const ingredientesData = ingredientes.map((ing, index) => ({
                    hoja_tecnica_id: hojaId,
                    nombre_ingrediente: ing.nombre_ingrediente.trim(),
                    peso_gramos: parseFloat(ing.peso_gramos) || 0,
                    coste_euros: parseFloat(ing.coste_euros) || 0,
                    gastos_euros: parseFloat(ing.gastos_euros) || 0,
                    orden: index
                }));

                const { error } = await supabase
                    .from(this.ingredientesTable)
                    .insert(ingredientesData);

                if (error) {
                    console.error('❌ Error updating ingredients:', error);
                    throw error;
                }
            }
        } catch (error) {
            console.error('💥 Error in updateIngredientes:', error);
            throw error;
        }
    }

    /**
     * Update allergens for a hoja técnica
     * @param {string} hojaId - The hoja técnica ID
     * @param {Array} alergenos - Array of allergen types
     * @returns {Promise<void>}
     */
    async updateAlergenos(hojaId, alergenos) {
        try {
            // Delete existing allergens
            await supabase
                .from(this.allergenosTable)
                .delete()
                .eq('hoja_tecnica_id', hojaId);

            // Insert new allergens
            if (alergenos.length > 0) {
                const allergenosData = alergenos
                    .filter(alg => alg.tipo_alergeno && alg.tipo_alergeno.trim())
                    .map(alg => ({
                        hoja_tecnica_id: hojaId,
                        tipo_alergeno: alg.tipo_alergeno.trim()
                    }));

                if (allergenosData.length > 0) {
                    const { error } = await supabase
                        .from(this.allergenosTable)
                        .insert(allergenosData);

                    if (error) {
                        console.error('❌ Error updating allergens:', error);
                        throw error;
                    }
                }
            }
        } catch (error) {
            console.error('💥 Error in updateAlergenos:', error);
            throw error;
        }
    }

    /**
     * Upload and compress a dish image
     * @param {File} file - The image file
     * @returns {Promise<string>} Public URL of uploaded image
     */
    async uploadDishImage(file) {
        try {
            // Validate file
            const validation = validateImageFile(file);
            if (!validation.valid) {
                throw new Error(validation.error);
            }

            // Compress image
            const compressedBlob = await compressImage(file);

            // Generate unique filename
            const fileExt = 'jpg'; // Always use jpg after compression
            const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
            const filePath = `${fileName}`;

            // Upload to Supabase Storage
            const { data, error } = await supabase.storage
                .from(this.storageBucket)
                .upload(filePath, compressedBlob, {
                    contentType: 'image/jpeg',
                    cacheControl: '3600',
                    upsert: false
                });

            if (error) {
                console.error('❌ Error uploading image:', error);
                throw error;
            }

            // Get public URL
            const { data: { publicUrl } } = supabase.storage
                .from(this.storageBucket)
                .getPublicUrl(filePath);

            return publicUrl;
        } catch (error) {
            console.error('💥 Error in uploadDishImage:', error);
            throw new Error('Error al subir la imagen: ' + error.message);
        }
    }

    /**
     * Delete a dish image from storage
     * @param {string} imageUrl - The image URL to delete
     * @returns {Promise<void>}
     */
    async deleteDishImage(imageUrl) {
        try {
            if (!imageUrl) return;

            // Extract file path from URL
            const urlParts = imageUrl.split('/');
            const fileName = urlParts[urlParts.length - 1];

            const { error } = await supabase.storage
                .from(this.storageBucket)
                .remove([fileName]);

            if (error) {
                console.error('⚠️ Warning: Could not delete image:', error);
                // Don't throw error, just log warning
            }
        } catch (error) {
            console.error('⚠️ Warning in deleteDishImage:', error);
            // Don't throw error, just log warning
        }
    }

    /**
     * Calculate cost summary from ingredients
     * @param {Array} ingredientes - Array of ingredients
     * @returns {Object} Cost summary
     */
    calculateCostSummary(ingredientes) {
        const summary = {
            total_peso: 0,
            total_coste: 0,
            total_gastos: 0,
            coste_total: 0
        };

        if (!ingredientes || ingredientes.length === 0) {
            return summary;
        }

        ingredientes.forEach(ing => {
            summary.total_peso += parseFloat(ing.peso_gramos) || 0;
            summary.total_coste += parseFloat(ing.coste_euros) || 0;
            summary.total_gastos += parseFloat(ing.gastos_euros) || 0;
        });

        summary.coste_total = summary.total_coste + summary.total_gastos;

        // Round to 2 decimal places
        Object.keys(summary).forEach(key => {
            summary[key] = Math.round(summary[key] * 100) / 100;
        });

        return summary;
    }

    /**
     * Search hojas técnicas by name
     * @param {string} searchTerm - Search term
     * @returns {Promise<Array>} Filtered hojas técnicas
     */
    async searchHojasTecnicas(searchTerm) {
        try {
            if (!searchTerm || searchTerm.trim() === '') {
                return await this.getHojasTecnicas();
            }

            const { data, error } = await supabase
                .from(this.tableName)
                .select(`
          *,
          ingredientes:hoja_tecnica_ingredientes(
            id,
            nombre_ingrediente,
            peso_gramos,
            coste_euros,
            gastos_euros,
            orden
          ),
          alergenos:hoja_tecnica_alergenos(
            id,
            tipo_alergeno
          )
        `)
                .ilike('nombre_plato', `%${searchTerm}%`)
                .order('created_at', { ascending: false });

            if (error) {
                console.error('❌ Error searching hojas técnicas:', error);
                throw error;
            }

            return (data || []).map(hoja => ({
                ...hoja,
                resumen_costes: this.calculateCostSummary(hoja.ingredientes || [])
            }));
        } catch (error) {
            console.error('💥 Error in searchHojasTecnicas:', error);
            throw new Error('Error al buscar hojas técnicas');
        }
    }
}

export default new HojasTecnicasService();
