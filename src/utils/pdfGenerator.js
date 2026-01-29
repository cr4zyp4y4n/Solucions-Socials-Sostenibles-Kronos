import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import CompanyLogo from '../assets/Logo Minimalist SSS High Opacity.PNG';

/**
 * Generates a PDF for a specific Hoja Técnica.
 * @param {Object} hoja - The technical sheet data object.
 */
export const generateHojaTecnicaPDF = async (hoja) => {
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    const margin = 15;
    let yPos = 20;

    // --- Header (Company Details) ---
    try {
        const logoData = await getBase64ImageFromURL(CompanyLogo);
        if (logoData) {
            // Logo size
            const logoWidth = 25;
            const logoHeight = 25;
            doc.addImage(logoData, 'PNG', margin, 10, logoWidth, logoHeight);

            // Text Details next to logo
            doc.setFontSize(10);
            doc.setTextColor(80, 80, 80);

            const textX = margin + logoWidth + 5;
            let textY = 18; // Start aligning with top-mid of logo

            doc.text("Av. de Mistral, 20 bis,", textX, textY);
            textY += 5;
            doc.text("Eixample, 08015 Barcelona", textX, textY);
            textY += 5;
            doc.text("Tel: 625 53 47 55", textX, textY);

            // Move yPos down for Title
            yPos = 45;
        }
    } catch (error) {
        console.error('Error adding company logo to PDF:', error);
        // Fallback: just text or nothing
        yPos = 30; // Reset if logo fails
    }

    // --- Title ---
    doc.setFontSize(22);
    doc.setTextColor(40, 40, 40);
    // Center title text
    doc.text(hoja.nombre_plato || 'Hoja Técnica', pageWidth / 2, yPos, { align: 'center' });
    yPos += 15;

    // --- Image ---
    if (hoja.imagen_url) {
        try {
            const imgData = await getBase64ImageFromURL(hoja.imagen_url);
            if (imgData) {
                // Determine image dimensions to fit within a box while maintaining aspect ratio
                // Lets simpler approach: fixed width, auto height or similar
                const imgWidth = 100;
                const imgHeight = 75;
                // X position centered
                const imgX = (pageWidth - imgWidth) / 2;

                doc.addImage(imgData, 'JPEG', imgX, yPos, imgWidth, imgHeight);
                yPos += imgHeight + 15;
            }
        } catch (error) {
            console.error('Error adding image to PDF:', error);
            // Continue without image or add placeholder text
            doc.setFontSize(10);
            doc.setTextColor(150);
            doc.text('(Imagen no disponible en el PDF)', pageWidth / 2, yPos, { align: 'center' });
            yPos += 10;
        }
    } else {
        yPos += 5;
    }

    doc.setTextColor(0); // Reset color

    // --- Ingredients ---
    doc.setFontSize(16);
    doc.text('Ingredientes', margin, yPos);
    yPos += 5; // Spacing before table

    const ingredientsData = (hoja.ingredientes || []).map(ing => [
        ing.nombre_ingrediente || '-',
        `${ing.peso_gramos || 0} g`,
        // We could include cost but user asked for "Ingredientes del producto" specifically. 
        // Often specs include quantity. I will include Name and Quantity (Weight).
    ]);

    // If there are no ingredients, show a message? Or just empty table?
    // autoTable handles empty somewhat, but better to check.

    // Check if autoTable is attached to doc or needs to be called directly
    // With 'import autoTable from ...', we usually call autoTable(doc, options)

    autoTable(doc, {
        startY: yPos,
        head: [['Ingrediente', 'Cantidad (g)']],
        body: ingredientsData,
        theme: 'striped',
        headStyles: { fillColor: [74, 144, 226] }, // Example blueish color
        margin: { top: 10, left: margin, right: margin },
    });

    // Update yPos based on table end
    yPos = doc.lastAutoTable.finalY + 15;

    // --- Allergens ---
    // Check if we have enough space, otherwise add page? autoTable handles page breaks mostly, 
    // but the header 'Alérgenos' might be stranded. 
    // Simple check: if yPos > 250 (approx), add page. A4 height is ~297mm.
    if (yPos > 270) {
        doc.addPage();
        yPos = 20;
    }

    doc.setFontSize(16);
    doc.text('Alérgenos', margin, yPos);
    yPos += 5;

    const allergensData = (hoja.alergenos || []).map(al => [
        al.tipo_alergeno || '-'
    ]);

    if (allergensData.length === 0) {
        doc.setFontSize(12);
        doc.setFont(undefined, 'italic');
        doc.text('No contiene alérgenos registrados.', margin, yPos + 10);
    } else {
        autoTable(doc, {
            startY: yPos,
            head: [['Tipo de Alérgeno']],
            body: allergensData,
            theme: 'grid',
            headStyles: { fillColor: [245, 158, 11] }, // Orange/Amber for allergens warning
            margin: { top: 10, left: margin, right: margin },
        });
    }

    // --- Save ---
    const filename = `${(hoja.nombre_plato || 'Hoja_Tecnica').replace(/[^a-z0-9]/gi, '_').toLowerCase()}.pdf`;
    doc.save(filename);
};

/**
 * Loads an image from a URL and converts it to a base64 string.
 * @param {string} url - The URL of the image.
 * @returns {Promise<string>} Base64 representation of the image.
 */
const getBase64ImageFromURL = (url) => {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.crossOrigin = 'Anonymous';
        img.src = url;
        img.onload = () => {
            const canvas = document.createElement('canvas');
            canvas.width = img.width;
            canvas.height = img.height;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0);
            try {
                // Determine type from URL or just try common format
                const dataURL = canvas.toDataURL('image/png');
                resolve(dataURL);
            } catch (error) {
                // Tainted canvas mostly
                reject(error);
            }
        };
        img.onerror = (error) => {
            reject(error);
        };
    });
};
