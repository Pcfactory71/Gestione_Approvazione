// ============================================================
// routes/documents.js - Upload, visualizzazione e approvazione PDF
// ============================================================

const express = require('express');
const multer  = require('multer');
const path    = require('path');
const fs      = require('fs');
const { v4: uuidv4 } = require('uuid');
const router  = express.Router();

const db = require('../database');
const { requireAuth } = require('../middleware/auth');
const { sendApprovalRequest, sendApprovedDocument, sendRejectedDocument } = require('../utils/email');
const { addSignatureToPdf } = require('../utils/pdf');

const UPLOADS_DIR = path.join(__dirname, '..', 'uploads');
if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, { recursive: true });

const storage = multer.diskStorage({
  destination: UPLOADS_DIR,
  filename: (req, file, cb) => cb(null, `${uuidv4()}${path.extname(file.originalname)}`),
});
const upload = multer({
  storage,
  limits: { fileSize: 20 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'application/pdf') cb(null, true);
    else cb(new Error('Solo file PDF sono accettati'));
  },
});

// ---- CARICA NUOVO DOCUMENTO ----
router.post('/upload', requireAuth, upload.single('pdf'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'Nessun file caricato' });
    const { approverEmail } = req.body;
    if (!approverEmail) return res.status(400).json({ error: 'Email approvatore obbligatoria' });

    const approvalToken = uuidv4();
    await db.createDocument({
      senderId: req.user.id,
      filenameOriginal: req.file.originalname,
      filenameStored: req.file.filename,
      approverEmail,
      approvalToken,
    });

    try {
      await sendApprovalRequest({ approverEmail, senderEmail: req.user.email, filename: req.file.originalname, approvalToken });
    } catch (e) { console.error('Avviso email:', e.message); }

    res.status(201).json({ message: 'Documento inviato per approvazione!' });
  } catch (err) {
    console.error('Errore upload:', err);
    res.status(500).json({ error: 'Errore durante il caricamento: ' + err.message });
  }
});

// ---- DOCUMENTI INVIATI DAL MITTENTE ----
router.get('/mine', requireAuth, async (req, res) => {
  try {
    res.json(await db.getDocumentsBySender(req.user.id));
  } catch (err) {
    res.status(500).json({ error: 'Errore nel recupero documenti' });
  }
});

// ---- DOCUMENTI GESTITI DALL'APPROVATORE ----
router.get('/my-approvals', requireAuth, async (req, res) => {
  try {
    res.json(await db.getDocumentsByApproverEmail(req.user.email));
  } catch (err) {
    res.status(500).json({ error: 'Errore nel recupero documenti' });
  }
});

// ---- VISUALIZZA PDF ORIGINALE (utente loggato) ----
router.get('/view/:id', requireAuth, async (req, res) => {
  try {
    const doc = await db.getDocumentById(parseInt(req.params.id));
    if (!doc) return res.status(404).json({ error: 'Documento non trovato' });
    if (doc.sender_id !== req.user.id && req.user.role !== 'admin' && doc.approver_email !== req.user.email) {
      return res.status(403).json({ error: 'Accesso negato' });
    }
    const filePath = path.join(UPLOADS_DIR, doc.filename_stored);
    if (!fs.existsSync(filePath)) return res.status(404).json({ error: 'File non trovato sul server' });
    res.download(filePath, doc.filename_original);
  } catch (err) {
    res.status(500).json({ error: 'Errore nel download' });
  }
});

// ---- VISUALIZZA PDF FIRMATO (utente loggato) ----
router.get('/view/:id/signed', requireAuth, async (req, res) => {
  try {
    const doc = await db.getDocumentById(parseInt(req.params.id));
    if (!doc) return res.status(404).json({ error: 'Documento non trovato' });
    if (doc.sender_id !== req.user.id && req.user.role !== 'admin' && doc.approver_email !== req.user.email) {
      return res.status(403).json({ error: 'Accesso negato' });
    }
    if (!doc.approved_filename) return res.status(404).json({ error: 'Nessun file firmato disponibile' });
    const filePath = path.join(UPLOADS_DIR, doc.approved_filename);
    if (!fs.existsSync(filePath)) return res.status(404).json({ error: 'File firmato non trovato sul server' });
    res.download(filePath, `APPROVATO_${doc.filename_original}`);
  } catch (err) {
    res.status(500).json({ error: 'Errore nel download' });
  }
});

// ---- DATI DOCUMENTO PER APPROVAZIONE (via token email) ----
router.get('/approve/:token', async (req, res) => {
  try {
    const doc = await db.getDocumentByToken(req.params.token);
    if (!doc) return res.status(404).json({ error: 'Documento non trovato o link non valido' });
    if (doc.status !== 'pending') {
      return res.status(400).json({ error: `Documento già ${doc.status === 'approved' ? 'approvato' : 'rifiutato'}` });
    }
    res.json({ id: doc.id, filename: doc.filename_original, status: doc.status });
  } catch (err) {
    res.status(500).json({ error: 'Errore nel recupero documento' });
  }
});

// ---- SCARICA PDF ORIGINALE (via token email, senza login) ----
router.get('/file/:token', async (req, res) => {
  try {
    const doc = await db.getDocumentByToken(req.params.token);
    if (!doc) return res.status(404).json({ error: 'Documento non trovato' });
    const filePath = path.join(UPLOADS_DIR, doc.filename_stored);
    if (!fs.existsSync(filePath)) return res.status(404).json({ error: 'File non trovato sul server' });
    res.download(filePath, doc.filename_original);
  } catch (err) {
    res.status(500).json({ error: 'Errore nel download' });
  }
});

// ---- APPROVA O RIFIUTA ----
router.post('/approve/:token', async (req, res) => {
  try {
    const { action, recipientEmail } = req.body;
    if (!action || !['approve', 'reject'].includes(action)) {
      return res.status(400).json({ error: 'Azione non valida' });
    }
    if (!recipientEmail) return res.status(400).json({ error: 'Email destinatario obbligatoria' });

    const doc = await db.getDocumentByToken(req.params.token);
    if (!doc) return res.status(404).json({ error: 'Documento non trovato o link non valido' });
    if (doc.status !== 'pending') return res.status(400).json({ error: 'Documento già processato' });

    const originalPath = path.join(UPLOADS_DIR, doc.filename_stored);
    if (!fs.existsSync(originalPath)) return res.status(500).json({ error: 'File originale non trovato sul server' });

    if (action === 'approve') {
      const approvedFilename = `signed_${doc.filename_stored}`;
      const approvedPath = path.join(UPLOADS_DIR, approvedFilename);

      try {
        await addSignatureToPdf(originalPath, approvedPath);
      } catch (pdfErr) {
        console.error('Errore firma PDF:', pdfErr.message);
        if (pdfErr.message.includes('signature.png')) {
          return res.status(500).json({ error: 'File firma mancante: inserisci "signature.png" nella cartella del progetto.' });
        }
        return res.status(500).json({ error: 'Errore nella firma del PDF: ' + pdfErr.message });
      }

      await db.updateDocumentStatus({ id: doc.id, status: 'approved', recipientEmail, approvedFilename });

      try {
        await sendApprovedDocument({ recipientEmail, filename: doc.filename_original, approvedFilePath: approvedPath });
      } catch (e) {
        console.error('Avviso email:', e.message);
        return res.json({ message: 'Documento approvato! (Attenzione: invio email fallito — controlla il file .env)' });
      }
      res.json({ message: 'Documento approvato e inviato!' });

    } else {
      await db.updateDocumentStatus({ id: doc.id, status: 'rejected', recipientEmail, approvedFilename: null });
      try {
        await sendRejectedDocument({ recipientEmail, filename: doc.filename_original, originalFilePath: originalPath });
      } catch (e) {
        console.error('Avviso email:', e.message);
        return res.json({ message: 'Documento rifiutato. (Attenzione: invio email fallito — controlla il file .env)' });
      }
      res.json({ message: 'Documento rifiutato. Notifica inviata.' });
    }

  } catch (err) {
    console.error('Errore imprevisto in /approve:', err);
    res.status(500).json({ error: 'Errore interno: ' + err.message });
  }
});

module.exports = router;
