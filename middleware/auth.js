// ============================================================
// middleware/auth.js - Controllo autenticazione
// Questo "middleware" viene eseguito PRIMA di ogni route
// protetta: controlla che il token JWT sia valido
// ============================================================

const jwt = require('jsonwebtoken');

// Verifica che l'utente abbia effettuato il login
function requireAuth(req, res, next) {
  // Il token viene inviato nell'header "Authorization: Bearer <token>"
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Accesso negato: devi effettuare il login' });
  }

  try {
    // Verifica e decodifica il token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded; // Aggiunge i dati utente alla richiesta
    next(); // Passa alla route successiva
  } catch (err) {
    return res.status(403).json({ error: 'Token non valido o scaduto' });
  }
}

// Verifica che l'utente sia un amministratore
function requireAdmin(req, res, next) {
  requireAuth(req, res, () => {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Accesso riservato agli amministratori' });
    }
    next();
  });
}

module.exports = { requireAuth, requireAdmin };
