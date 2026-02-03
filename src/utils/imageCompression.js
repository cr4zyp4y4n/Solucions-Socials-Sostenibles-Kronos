/**
 * Image Compression Utility
 * Compresses images before uploading to reduce storage costs
 * Targets max 1200px width/height and ~500KB file size
 */

/**
 * Compress an image file
 * @param {File} file - The image file to compress
 * @param {Object} options - Compression options
 * @param {number} options.maxWidth - Maximum width in pixels (default: 1200)
 * @param {number} options.maxHeight - Maximum height in pixels (default: 1200)
 * @param {number} options.quality - JPEG quality 0-1 (default: 0.8)
 * @returns {Promise<Blob>} - Compressed image as Blob
 */
export async function compressImage(file, options = {}) {
    const {
        maxWidth = 1200,
        maxHeight = 1200,
        quality = 0.8,
    } = options;

    return new Promise((resolve, reject) => {
        // Validate file type
        if (!file.type.startsWith('image/')) {
            reject(new Error('File must be an image'));
            return;
        }

        const reader = new FileReader();

        reader.onerror = () => reject(new Error('Failed to read file'));

        reader.onload = (e) => {
            const img = new Image();

            img.onerror = () => reject(new Error('Failed to load image'));

            img.onload = () => {
                try {
                    // Calculate new dimensions while maintaining aspect ratio
                    let { width, height } = img;

                    if (width > maxWidth || height > maxHeight) {
                        const aspectRatio = width / height;

                        if (width > height) {
                            width = maxWidth;
                            height = width / aspectRatio;
                        } else {
                            height = maxHeight;
                            width = height * aspectRatio;
                        }
                    }

                    // Create canvas and draw resized image
                    const canvas = document.createElement('canvas');
                    canvas.width = width;
                    canvas.height = height;

                    const ctx = canvas.getContext('2d');
                    ctx.drawImage(img, 0, 0, width, height);

                    // Convert to blob
                    canvas.toBlob(
                        (blob) => {
                            if (blob) {
                                console.log(`✅ Image compressed: ${(file.size / 1024).toFixed(2)}KB → ${(blob.size / 1024).toFixed(2)}KB`);
                                resolve(blob);
                            } else {
                                reject(new Error('Failed to compress image'));
                            }
                        },
                        'image/jpeg',
                        quality
                    );
                } catch (error) {
                    reject(error);
                }
            };

            img.src = e.target.result;
        };

        reader.readAsDataURL(file);
    });
}

/**
 * Create a preview URL for an image file
 * @param {File|Blob} file - The image file
 * @returns {string} - Object URL for preview
 */
export function createImagePreview(file) {
    return URL.createObjectURL(file);
}

/**
 * Revoke a preview URL to free memory
 * @param {string} url - The object URL to revoke
 */
export function revokeImagePreview(url) {
    URL.revokeObjectURL(url);
}

/**
 * Validate image file
 * @param {File} file - The file to validate
 * @param {Object} options - Validation options
 * @param {number} options.maxSizeMB - Maximum file size in MB (default: 10)
 * @param {string[]} options.allowedTypes - Allowed MIME types
 * @returns {Object} - { valid: boolean, error: string|null }
 */
export function validateImageFile(file, options = {}) {
    const {
        maxSizeMB = 10,
        allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'],
    } = options;

    if (!file) {
        return { valid: false, error: 'No file provided' };
    }

    if (!allowedTypes.includes(file.type)) {
        return {
            valid: false,
            error: `Tipo de archivo no permitido. Use: ${allowedTypes.join(', ')}`
        };
    }

    const maxSizeBytes = maxSizeMB * 1024 * 1024;
    if (file.size > maxSizeBytes) {
        return {
            valid: false,
            error: `El archivo es demasiado grande. Máximo: ${maxSizeMB}MB`
        };
    }

    return { valid: true, error: null };
}
