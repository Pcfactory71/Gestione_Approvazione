// ============================================================
// utils/pdf.js - Aggiunge la firma all'ultima pagina del PDF
// Usa la libreria pdf-lib per inserire l'immagine della firma
// nell'angolo in basso a destra dell'ultima pagina
// ============================================================

const { PDFDocument } = require('pdf-lib');
const fs = require('fs');
const path = require('path');

// Percorso dell'immagine della firma (deve stare nella cartella del progetto)
const SIGNATURE_PATH = path.join(__dirname, '..', 'signature.png');

// ---- AGGIUNGE LA FIRMA AL PDF ----
// inputPath: percorso del PDF originale
// outputPath: percorso dove salvare il PDF firmato
async function addSignatureToPdf(inputPath, outputPath) {
  // Leggi il PDF originale
  const pdfBytes = fs.readFileSync(inputPath);
  const pdfDoc = await PDFDocument.load(pdfBytes);

  // Verifica che esista il file della firma
  if (!fs.existsSync(SIGNATURE_PATH)) {
    throw new Error(
      'File signature.png non trovato! Inserisci un file "signature.png" nella cartella del progetto.'
    );
  }

  // Leggi l'immagine della firma (PNG)
  const signatureBytes = fs.readFileSync(SIGNATURE_PATH);
  const signatureImage = await pdfDoc.embedPng(signatureBytes);

  // Prendi l'ULTIMA pagina del documento
  const pages = pdfDoc.getPages();
  const lastPage = pages[pages.length - 1];

  // Dimensioni dell'ultima pagina
  const { width, height } = lastPage.getSize();

  // Dimensioni della firma da inserire (adattabili)
  const sigWidth = 160;   // larghezza in punti
  const sigHeight = 60;   // altezza in punti

  // Posizione: angolo in basso a destra con 30 punti di margine
  const sigX = width - sigWidth - 30;
  const sigY = 30; // pdf-lib conta dal basso verso l'alto

  // Inserisce l'immagine nella pagina
  lastPage.drawImage(signatureImage, {
    x: sigX,
    y: sigY,
    width: sigWidth,
    height: sigHeight,
    opacity: 1,
  });

  // Aggiunge anche una piccola scritta "Approvato" sotto la firma
  // (opzionale, decommentare se serve)
  // const { rgb } = require('pdf-lib');
  // lastPage.drawText('Approvato il ' + new Date().toLocaleDateString('it-IT'), {
  //   x: sigX,
  //   y: sigY - 15,
  //   size: 8,
  //   color: rgb(0.3, 0.3, 0.3),
  // });

  // Salva il PDF modificato
  const modifiedPdfBytes = await pdfDoc.save();
  fs.writeFileSync(outputPath, modifiedPdfBytes);

  return outputPath;
}

module.exports = { addSignatureToPdf };
