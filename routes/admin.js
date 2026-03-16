// ============================================================
// routes/admin.js - Gestione utenti e documenti (solo admin)
// ============================================================

const express = require('express');
const bcrypt  = require('bcryptjs');
const path    = require('path');
const fs      = require('fs');
const router  = express.Router();

const db = require('../database');
const { requireAdmin } = require('../middleware/auth');

const UPLOADS_DIR = path.join(__dirname, '..', 'uploads');

router.use(requireAdmin);

// ---- LISTA UTENTI ----
router.get('/users', async (req, res) => {
  try {
    res.json(await db.getAllUsers());
  } catch (err) {
    res.status(500).json({ error: 'Errore nel recupero utenti' });
  }
});

// ---- CREA NUOVO UTENTE ----
router.post('/users', async (req, res) => {
  const { username, password, email, role } = req.body;
  if (!username || !password || !email || !role) {
    return res.status(400).json({ error: 'Tutti i campi sono obbligatori' });
  }
  const validRoles = ['admin', 'sender', 'approver'];
  if (!validRoles.includes(role)) {
    return res.status(400).json({ error: 'Ruolo non valido. Usa: admin, sender o approver' });
  }
  try {
    if (await db.getUserByUsername(username)) return res.status(409).json({ error: 'Username già in uso' });
    if (await db.getUserByEmail(email))    return res.status(409).json({ error: 'Email già in uso' });
    const hashed = await bcrypt.hash(password, 10);
    const result = await db.createUser({ username, password: hashed, email, role });
    res.status(201).json({ message: 'Utente creato con successo', user: { id: result.lastInsertRowid, username, email, role } });
  } catch (err) {
    console.error('Errore creazione utente:', err);
    res.status(500).json({ error: 'Errore interno del server' });
  }
});

// ---- ELIMINA UTENTE ----
router.delete('/users/:id', async (req, res) => {
  const id = parseInt(req.params.id);
  if (id === req.user.id) return res.status(400).json({ error: 'Non puoi eliminare il tuo stesso account' });
  try {
    if (!await db.getUserById(id)) return res.status(404).json({ error: 'Utente non trovato' });
    await db.deleteUser(id);
    res.json({ message: 'Utente eliminato con successo' });
  } catch (err) {
    res.status(500).json({ error: 'Errore interno del server' });
  }
});

// ---- LISTA TUTTI I DOCUMENTI ----
router.get('/documents', async (req, res) => {
  try {
    res.json(await db.getAllDocuments());
  } catch (err) {
    res.status(500).json({ error: 'Errore nel recupero documenti' });
  }
});

// ---- ELIMINA DOCUMENTO ----
router.delete('/documents/:id', async (req, res) => {
  try {
    const id  = parseInt(req.params.id);
    const doc = await db.getDocumentById(id);
    if (!doc) return res.status(404).json({ error: 'Documento non trovato' });

    // Elimina i file fisici dal disco (se esistono)
    const originalPath = path.join(UPLOADS_DIR, doc.filename_stored);
    if (fs.existsSync(originalPath)) fs.unlinkSync(originalPath);

    if (doc.approved_filename) {
      const signedPath = path.join(UPLOADS_DIR, doc.approved_filename);
      if (fs.existsSync(signedPath)) fs.unlinkSync(signedPath);
    }

    await db.deleteDocument(id);
    res.json({ message: 'Documento eliminato con successo' });
  } catch (err) {
    console.error('Errore eliminazione documento:', err);
    res.status(500).json({ error: 'Errore durante l\'eliminazione: ' + err.message });
  }
});

module.exports = router;
