// ============================================================
// server.js - File principale del server
// IMPORTANTE: ora aspetta che il database sia pronto prima
// di accettare connessioni (necessario con sql.js)
// ============================================================

require('dotenv').config();

const express = require('express');
const path = require('path');
const db = require('./database');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

app.use('/api/auth',      require('./routes/auth'));
app.use('/api/documents', require('./routes/documents'));
app.use('/api/admin',     require('./routes/admin'));

// Gestione errori upload (file troppo grande, formato sbagliato ecc.)
app.use((err, req, res, next) => {
  if (err.code === 'LIMIT_FILE_SIZE') return res.status(400).json({ error: 'File troppo grande (massimo 20MB)' });
  if (err.message) return res.status(400).json({ error: err.message });
  next(err);
});

app.use((req, res) => { res.redirect('/'); });

// ---- AVVIO: prima inizializza il db, poi avvia il server ----
db.init().then(() => {
  app.listen(PORT, () => {
    console.log('');
    console.log('Server avviato!');
    console.log('Apri il browser su: http://localhost:' + PORT);
    console.log('');
    console.log('   Se e\' la prima volta, vai su:');
    console.log('   http://localhost:' + PORT + '/setup.html');
    console.log('');
  });
}).catch(err => {
  console.error('Errore avvio database:', err);
  process.exit(1);
});
