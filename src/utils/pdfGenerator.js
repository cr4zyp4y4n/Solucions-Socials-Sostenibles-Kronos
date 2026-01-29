import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import CompanyLogo from '../assets/Logo IDONI (1).png';

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

    // --- Split Layout: Ingredients (Left) and Allergens (Right) ---
    const startY = yPos;
    const colWidth = (pageWidth - (margin * 2) - 10) / 2; // Split width into two cols with 10 spacing

    // --- Ingredients (Left Column) ---
    doc.setFontSize(14);
    doc.text('Ingredientes', margin, startY);

    const ingredientsData = (hoja.ingredientes || []).map(ing => [
        ing.nombre_ingrediente || '-'
    ]);

    autoTable(doc, {
        startY: startY + 5,
        head: [['Nombre']],
        body: ingredientsData,
        theme: 'striped',
        headStyles: { fillColor: [74, 144, 226] },
        margin: { left: margin },
        tableWidth: colWidth,
    });

    const ingredientsFinalY = doc.lastAutoTable.finalY;

    // --- Allergens (Right Column) ---
    const allergensX = margin + colWidth + 10;

    doc.setFontSize(14);
    doc.text('Alérgenos', allergensX, startY);

    const allergensData = (hoja.alergenos || []).map(al => [
        al.tipo_alergeno || '-'
    ]);

    if (allergensData.length === 0) {
        doc.setFontSize(11);
        doc.setFont(undefined, 'italic');
        doc.text('No contiene alérgenos.', allergensX, startY + 10);
        // Mock finalY for comparison
        // We need doc.lastAutoTable to be defined to access finalY, but since we didn't call autoTable here
        // we should just rely on manual Y for comparison if we want.
        // Or create a dummy object.
        const headerY = startY + 15;
        // ingredientsFinalY will be likely larger, so this is fine.
    } else {
        autoTable(doc, {
            startY: startY + 5,
            head: [['Tipo']],
            body: allergensData,
            theme: 'grid',
            headStyles: { fillColor: [245, 158, 11] },
            margin: { left: allergensX },
            tableWidth: colWidth,
        });
    }

    const allergensFinalY = doc.lastAutoTable.finalY + 10;

    // Update yPos to below the tallest column
    yPos = Math.max(ingredientsFinalY, allergensFinalY) + 15;

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
