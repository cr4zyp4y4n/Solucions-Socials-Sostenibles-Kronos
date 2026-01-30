import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, RotateCcw, RotateCw, Printer, Download } from 'lucide-react';
import { useTheme } from './ThemeContext';
import { formatDateOnlyLocal } from '../utils/timeUtils';

// Importar las imágenes del carnet
import CarnetFront from '../assets/CarnetFront.svg';
import CarnetBack from '../assets/CarnetBack.svg';

const CarnetSocioModal = ({ isOpen, onClose, socio }) => {
  const { colors, isDark } = useTheme();
  const [currentSide, setCurrentSide] = useState('front'); // 'front' o 'back'

  if (!isOpen || !socio) return null;

  const formatFecha = (fecha) => formatDateOnlyLocal(fecha);

  const flipCard = () => {
    setCurrentSide(currentSide === 'front' ? 'back' : 'front');
  };

  // Función para imprimir el carnet
  const handlePrint = () => {
    // Crear una ventana nueva para imprimir
    const printWindow = window.open('', '_blank');
    
    const printContent = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Carnet de Socio - ${socio.nombre} ${socio.apellido}</title>
          <style>
            @page {
              size: A4;
              margin: 0.5in;
            }
            body {
              font-family: Arial, sans-serif;
              margin: 0;
              padding: 20px;
            }
            .carnet-container {
              display: flex;
              flex-direction: column;
              gap: 20px;
            }
            .carnet-side {
              width: 400px;
              height: 250px;
              border-radius: 12px;
              overflow: hidden;
              box-shadow: 0 4px 12px rgba(0,0,0,0.3);
              position: relative;
              page-break-inside: avoid;
            }
            .carnet-front {
              background-image: url('${CarnetFront}');
              background-size: cover;
              background-position: center;
              background-repeat: no-repeat;
            }
            .carnet-back {
              background-image: url('${CarnetBack}');
              background-size: cover;
              background-position: center;
              background-repeat: no-repeat;
            }
            .carnet-text {
              position: absolute;
              color: #000;
              font-weight: bold;
              text-transform: uppercase;
            }
            .nombre {
              top: 111px;
              left: 160px;
              right: 30px;
              font-size: 18px;
              line-height: 1.4;
            }
            .numero {
              bottom: 20px;
              left: 155px;
              right: 30px;
              font-size: 20px;
            }
            .fecha {
              bottom: 15px;
              left: 20px;
              font-size: 11px;
              color: #666;
              font-weight: 500;
              text-transform: none;
            }
            .print-title {
              text-align: center;
              font-size: 24px;
              font-weight: bold;
              margin-bottom: 20px;
              color: #333;
            }
            @media print {
              .no-print { display: none; }
            }
          </style>
        </head>
        <body>
          <div class="print-title">Carnet de Socio - ${socio.nombre} ${socio.apellido}</div>
          <div class="carnet-container">
            <div class="carnet-side carnet-front">
              <div class="carnet-text nombre">
                <div>${socio.nombre}</div>
                <div>${socio.apellido}</div>
              </div>
              <div class="carnet-text numero">${socio.id_unico}</div>
            </div>
            <div class="carnet-side carnet-back">
              <div class="carnet-text fecha">Socio desde: ${formatFecha(socio.socio_desde)}</div>
            </div>
          </div>
        </body>
      </html>
    `;
    
    printWindow.document.write(printContent);
    printWindow.document.close();
    printWindow.focus();
    printWindow.print();
  };

  // Función para generar PDF
  const handleDownloadPDF = async () => {
    try {
      // Crear un canvas para capturar el carnet
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      
      // Configurar el canvas
      canvas.width = 800;
      canvas.height = 1000;
      
      // Crear imagen del frente
      const frontImg = new Image();
      frontImg.crossOrigin = 'anonymous';
      frontImg.onload = () => {
        // Dibujar el frente
        ctx.drawImage(frontImg, 0, 0, 400, 250);
        
        // Añadir texto del frente
        ctx.fillStyle = '#000';
        ctx.font = 'bold 18px Arial';
        ctx.textAlign = 'left';
        ctx.fillText(socio.nombre, 160, 130);
        ctx.fillText(socio.apellido, 160, 150);
        ctx.font = 'bold 20px Arial';
        ctx.fillText(socio.id_unico, 155, 230);
        
        // Crear imagen del reverso
        const backImg = new Image();
        backImg.crossOrigin = 'anonymous';
        backImg.onload = () => {
          // Dibujar el reverso
          ctx.drawImage(backImg, 0, 300, 400, 250);
          
          // Añadir texto del reverso
          ctx.fillStyle = '#666';
          ctx.font = '11px Arial';
          ctx.fillText(`Socio desde: ${formatFecha(socio.socio_desde)}`, 20, 535);
          
          // Descargar como imagen
          const link = document.createElement('a');
          link.download = `carnet-${socio.nombre}-${socio.apellido}.png`;
          link.href = canvas.toDataURL();
          link.click();
        };
        backImg.src = CarnetBack;
      };
      frontImg.src = CarnetFront;
      
    } catch (error) {
      console.error('Error generando PDF:', error);
      alert('Error al generar el PDF. Inténtalo de nuevo.');
    }
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.8)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
          padding: '20px'
        }}
        onClick={onClose}
      >
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.8, opacity: 0 }}
          transition={{ type: 'spring', duration: 0.5 }}
          style={{
            position: 'relative',
            width: '400px',
            height: '250px',
            perspective: '1000px'
          }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Controles */}
          <div style={{
            position: 'absolute',
            top: '-50px',
            left: '50%',
            transform: 'translateX(-50%)',
            display: 'flex',
            gap: '10px',
            zIndex: 10
          }}>
            <motion.button
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.9 }}
              onClick={flipCard}
              style={{
                backgroundColor: colors.primary,
                color: 'white',
                border: 'none',
                borderRadius: '50%',
                width: '40px',
                height: '40px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                boxShadow: '0 4px 12px rgba(0,0,0,0.3)'
              }}
            >
              {currentSide === 'front' ? <RotateCw size={20} /> : <RotateCcw size={20} />}
            </motion.button>
            
            <motion.button
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.9 }}
              onClick={handlePrint}
              style={{
                backgroundColor: colors.warning,
                color: 'white',
                border: 'none',
                borderRadius: '50%',
                width: '40px',
                height: '40px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                boxShadow: '0 4px 12px rgba(0,0,0,0.3)'
              }}
              title="Imprimir carnet"
            >
              <Printer size={20} />
            </motion.button>
            
            <motion.button
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.9 }}
              onClick={handleDownloadPDF}
              style={{
                backgroundColor: colors.success,
                color: 'white',
                border: 'none',
                borderRadius: '50%',
                width: '40px',
                height: '40px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                boxShadow: '0 4px 12px rgba(0,0,0,0.3)'
              }}
              title="Descargar PDF"
            >
              <Download size={20} />
            </motion.button>
            
            <motion.button
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.9 }}
              onClick={onClose}
              style={{
                backgroundColor: colors.error,
                color: 'white',
                border: 'none',
                borderRadius: '50%',
                width: '40px',
                height: '40px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                boxShadow: '0 4px 12px rgba(0,0,0,0.3)'
              }}
            >
              <X size={20} />
            </motion.button>
          </div>

          {/* Carnet Container */}
          <motion.div
            style={{
              width: '100%',
              height: '100%',
              position: 'relative',
              transformStyle: 'preserve-3d',
              transition: 'transform 0.6s'
            }}
            animate={{ 
              rotateY: currentSide === 'front' ? 0 : 180 
            }}
          >
            {/* Frente del Carnet */}
            <motion.div
              style={{
                position: 'absolute',
                width: '100%',
                height: '100%',
                backfaceVisibility: 'hidden',
                borderRadius: '12px',
                overflow: 'hidden',
                boxShadow: '0 8px 32px rgba(0,0,0,0.3)'
              }}
            >
              {/* Imagen de fondo del frente */}
              <div style={{
                width: '100%',
                height: '100%',
                backgroundImage: `url(${CarnetFront})`,
                backgroundSize: 'cover',
                backgroundPosition: 'center',
                backgroundRepeat: 'no-repeat',
                position: 'relative'
              }}>
                {/* Texto superpuesto - Nombre */}
                <div style={{
                  position: 'absolute',
                  top: '111px',
                  left: '160px',  // Movido más a la derecha
                  right: '30px',
                  fontSize: '18px',
                  color: '#000',
                  textAlign: 'left',
                  lineHeight: '1.4',  // Más espacio entre líneas
                  textTransform: 'uppercase'
                }}>
                  <div>{socio.nombre}</div>
                  <div>{socio.apellido}</div>
                </div>

                {/* Texto superpuesto - Número de socio */}
                <div style={{
                  position: 'absolute',
                  bottom: '20px',  // Movido más abajo
                  left: '155px',   // Movido más a la derecha
                  right: '30px',
                  fontSize: '20px',
                  color: '#000',
                  textAlign: 'left',
                  textTransform: 'uppercase'
                }}>
                  {socio.id_unico}
                </div>
              </div>
            </motion.div>

            {/* Reverso del Carnet */}
            <motion.div
              style={{
                position: 'absolute',
                width: '100%',
                height: '100%',
                backfaceVisibility: 'hidden',
                borderRadius: '12px',
                overflow: 'hidden',
                boxShadow: '0 8px 32px rgba(0,0,0,0.3)',
                transform: 'rotateY(180deg)'
              }}
            >
              {/* Imagen de fondo del reverso */}
              <div style={{
                width: '100%',
                height: '100%',
                backgroundImage: `url(${CarnetBack})`,
                backgroundSize: 'cover',
                backgroundPosition: 'center',
                backgroundRepeat: 'no-repeat',
                position: 'relative'
              }}>
                {/* Texto superpuesto - Fecha de socio */}
                <div style={{
                  position: 'absolute',
                  bottom: '7px',
                  left: '20px',
                  fontSize: '11px',
                  color: '#666',
                  fontWeight: '500'
                }}>
                  Socio desde: {formatFecha(socio.socio_desde)}
                </div>
              </div>
            </motion.div>
          </motion.div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};

export default CarnetSocioModal;
