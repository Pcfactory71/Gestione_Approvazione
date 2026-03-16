// ============================================================
// routes/auth.js - Route per login, setup e profilo
// ============================================================

const express = require('express');
const bcrypt  = require('bcryptjs');
const jwt     = require('jsonwebtoken');
const router  = express.Router();

const db = require('../database');
const { requireAuth } = require('../middleware/auth');

// ---- LOGIN ----
router.post('/login', async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ error: 'Username e password sono obbligatori' });
  }
  try {
    const user = await db.getUserByUsername(username);
    if (!user) return res.status(401).json({ error: 'Username o password non corretti' });

    const valid = await bcrypt.compare(password, user.password);
    if (!valid) return res.status(401).json({ error: 'Username o password non corretti' });

    const token = jwt.sign(
      { id: user.id, username: user.username, role: user.role, email: user.email },
      process.env.JWT_SECRET,
      { expiresIn: '8h' }
    );
    res.json({ token, user: { id: user.id, username: user.username, role: user.role, email: user.email } });
  } catch (err) {
    console.error('Errore login:', err);
    res.status(500).json({ error: 'Errore interno del server' });
  }
});

// ---- PROFILO UTENTE CORRENTE ----
router.get('/me', requireAuth, async (req, res) => {
  try {
    const user = await db.getUserById(req.user.id);
    if (!user) return res.status(404).json({ error: 'Utente non trovato' });
    res.json(user);
  } catch (err) {
    res.status(500).json({ error: 'Errore interno' });
  }
});

// ---- SETUP INIZIALE (solo se non ci sono utenti) ----
router.post('/setup', async (req, res) => {
  const { username, password, email } = req.body;
  try {
    const users = await db.getAllUsers();
    if (users.length > 0) {
      return res.status(403).json({ error: 'Setup già completato: esiste già almeno un utente' });
    }
    if (!username || !password || !email) {
      return res.status(400).json({ error: 'Username, password ed email sono obbligatori' });
    }
    const hashed = await bcrypt.hash(password, 10);
    await db.createUser({ username, password: hashed, email, role: 'admin' });
    res.json({ message: 'Amministratore creato con successo! Ora puoi fare il login.' });
  } catch (err) {
    console.error('Errore setup:', err);
    res.status(500).json({ error: 'Errore interno del server' });
  }
});

module.exports = router;
