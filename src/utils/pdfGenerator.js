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
    const pageHeight = doc.internal.pageSize.getHeight();
    const margin = 15;
    let yPos = 20;

    // Brand Level Colors
    // Brand Level Colors
    const brandColor = [255, 36, 102]; // #ff2466
    const darkText = [60, 60, 60];
    const lightText = [100, 100, 100];

    // Helper to add Footer
    const addFooter = (docPageNumber) => {
        const totalPages = doc.internal.getNumberOfPages();
        // Go to specific page if needed, but usually we add footer to current page before moving or at end
        // Easier: Loop through all pages at the end or add to current page if we control breaks.
        // For autoTable, we can use hooks. For manual adding, we do it here.

        doc.setPage(docPageNumber);
        doc.setFontSize(8);
        doc.setTextColor(...lightText);

        const footerY = pageHeight - 10;

        // Separator line
        doc.setDrawColor(...brandColor);
        doc.setLineWidth(0.5);
        doc.line(margin, footerY - 5, pageWidth - margin, footerY - 5);

        // Footer Text
        const today = new Date().toLocaleDateString();
        doc.text(`Idoni Boncor - Generado el ${today}`, margin, footerY);
        doc.text(`Página ${docPageNumber}`, pageWidth - margin, footerY, { align: 'right' });
    };

    // --- Header (Company Details) ---
    try {
        const logoData = await getBase64ImageFromURL(CompanyLogo);
        if (logoData) {
            // Logo size
            const logoWidth = 25;
            const logoHeight = 25;
            doc.addImage(logoData, 'PNG', margin, 10, logoWidth, logoHeight);

            // Text Details next to logo
            doc.setFontSize(9);
            doc.setTextColor(...lightText);

            const textX = margin + logoWidth + 5;
            let textY = 18;

            doc.text("Av. de Mistral, 20 bis,", textX, textY);
            textY += 5;
            doc.text("Eixample, 08015 Barcelona", textX, textY);
            textY += 5;
            doc.text("Tel: 625 53 47 55", textX, textY);

            yPos = 40;
        }
    } catch (error) {
        console.error('Error adding company logo to PDF:', error);
        yPos = 30; // Reset if logo fails
    }

    // Separator line below header
    doc.setDrawColor(...brandColor);
    doc.setLineWidth(0.5);
    doc.line(margin, yPos, pageWidth - margin, yPos);
    yPos += 15;

    // --- Title ---
    doc.setFontSize(24);
    doc.setTextColor(...brandColor);
    doc.setFont(undefined, 'bold');
    doc.text(hoja.nombre_plato || 'Hoja Técnica', pageWidth / 2, yPos, { align: 'center' });
    yPos += 10;

    // Reset Font
    doc.setFont(undefined, 'normal');

    // --- Image ---
    if (hoja.imagen_url) {
        try {
            const imgData = await getBase64ImageFromURL(hoja.imagen_url);
            if (imgData) {
                const imgWidth = 100;
                const imgHeight = 75;
                const imgX = (pageWidth - imgWidth) / 2;

                // Add a subtle border around image
                doc.setDrawColor(230, 230, 230);
                doc.rect(imgX - 1, yPos - 1, imgWidth + 2, imgHeight + 2);

                doc.addImage(imgData, 'JPEG', imgX, yPos, imgWidth, imgHeight);
                yPos += imgHeight + 15;
            }
        } catch (error) {
            console.error('Error adding image to PDF:', error);
            yPos += 10;
        }
    } else {
        yPos += 5;
    }

    doc.setTextColor(...darkText);

    // --- Split Layout: Ingredients (Left) and Allergens (Right) ---
    const startY = yPos;
    const colWidth = (pageWidth - (margin * 2) - 10) / 2;

    const headerTextColor = [50, 50, 50];

    // --- Ingredients (Left Column) ---
    doc.setFontSize(14);
    doc.setTextColor(...brandColor);
    doc.setFont(undefined, 'bold');
    doc.text('Ingredientes', margin, startY);

    const ingredientsData = (hoja.ingredientes || []).map(ing => [
        ing.nombre_ingrediente || '-'
    ]);

    autoTable(doc, {
        startY: startY + 5,
        head: [['Nombre']],
        body: ingredientsData,
        theme: 'striped',
        headStyles: {
            fillColor: brandColor,
            textColor: headerTextColor,
            fontStyle: 'bold'
        },
        styles: {
            textColor: darkText,
            fontSize: 10
        },
        alternateRowStyles: {
            fillColor: [248, 250, 240]
        },
        margin: { left: margin },
        tableWidth: colWidth,
    });

    const ingredientsFinalY = doc.lastAutoTable.finalY;

    // --- Allergens (Right Column) ---
    const allergensX = margin + colWidth + 10;

    doc.text('Alérgenos', allergensX, startY);

    const allergensData = (hoja.alergenos || []).map(al => [
        al.tipo_alergeno || '-'
    ]);

    if (allergensData.length === 0) {
        doc.setFontSize(11);
        doc.setFont(undefined, 'italic');
        doc.setTextColor(150);
        doc.text('No contiene alérgenos.', allergensX, startY + 15);
    } else {
        autoTable(doc, {
            startY: startY + 5,
            head: [['Tipo']],
            body: allergensData,
            theme: 'striped',
            headStyles: {
                fillColor: brandColor,
                textColor: headerTextColor,
                fontStyle: 'bold'
            },
            styles: {
                textColor: darkText,
                fontSize: 10
            },
            alternateRowStyles: {
                fillColor: [248, 250, 240]
            },
            margin: { left: allergensX },
            tableWidth: colWidth,
        });
    }

    // Add Loop for Footer on all pages
    const pageCount = doc.internal.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
        addFooter(i);
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
                const dataURL = canvas.toDataURL('image/png');
                resolve(dataURL);
            } catch (error) {
                reject(error);
            }
        };
        img.onerror = (error) => {
            reject(error);
        };
    });
};
