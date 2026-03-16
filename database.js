// ============================================================
// database.js - Connessione e funzioni per PostgreSQL
// Su Railway, la variabile DATABASE_URL viene impostata
// automaticamente quando aggiungi il plugin PostgreSQL.
// In locale puoi usare ancora SQLite oppure un PostgreSQL locale.
//
// IMPORTANTE: tutte le funzioni sono ora ASINCRONE (async/await)
// ============================================================

const { Pool } = require('pg');

// Pool di connessioni a PostgreSQL
// Railway imposta DATABASE_URL automaticamente
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  // Su Railway il database usa SSL; in locale no
  ssl: process.env.DATABASE_URL && process.env.DATABASE_URL.includes('railway')
    ? { rejectUnauthorized: false }
    : false
});

// ---- INIZIALIZZAZIONE: crea le tabelle se non esistono ----
async function init() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id         SERIAL PRIMARY KEY,
      username   TEXT NOT NULL UNIQUE,
      password   TEXT NOT NULL,
      email      TEXT NOT NULL UNIQUE,
      role       TEXT NOT NULL DEFAULT 'sender',
      created_at TIMESTAMP NOT NULL DEFAULT NOW()
    );
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS documents (
      id                SERIAL PRIMARY KEY,
      sender_id         INTEGER NOT NULL REFERENCES users(id),
      filename_original TEXT NOT NULL,
      filename_stored   TEXT NOT NULL,
      approver_email    TEXT NOT NULL,
      recipient_email   TEXT,
      status            TEXT NOT NULL DEFAULT 'pending',
      approval_token    TEXT UNIQUE,
      approved_filename TEXT,
      created_at        TIMESTAMP NOT NULL DEFAULT NOW(),
      updated_at        TIMESTAMP NOT NULL DEFAULT NOW()
    );
  `);

  console.log('Database PostgreSQL pronto.');
}

// ---- FUNZIONI UTENTI ----

async function getUserByUsername(username) {
  const res = await pool.query('SELECT * FROM users WHERE username = $1', [username]);
  return res.rows[0] || null;
}

async function getUserById(id) {
  const res = await pool.query(
    'SELECT id, username, email, role, created_at FROM users WHERE id = $1', [id]
  );
  return res.rows[0] || null;
}

async function getUserByEmail(email) {
  const res = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
  return res.rows[0] || null;
}

async function createUser({ username, password, email, role }) {
  const res = await pool.query(
    'INSERT INTO users (username, password, email, role) VALUES ($1, $2, $3, $4) RETURNING id',
    [username, password, email, role]
  );
  return { lastInsertRowid: res.rows[0].id };
}

async function getAllUsers() {
  const res = await pool.query(
    'SELECT id, username, email, role, created_at FROM users ORDER BY created_at DESC'
  );
  return res.rows;
}

async function deleteUser(id) {
  await pool.query('DELETE FROM users WHERE id = $1', [id]);
}

// ---- FUNZIONI DOCUMENTI ----

async function createDocument({ senderId, filenameOriginal, filenameStored, approverEmail, approvalToken }) {
  const res = await pool.query(
    `INSERT INTO documents (sender_id, filename_original, filename_stored, approver_email, approval_token)
     VALUES ($1, $2, $3, $4, $5) RETURNING id`,
    [senderId, filenameOriginal, filenameStored, approverEmail, approvalToken]
  );
  return { lastInsertRowid: res.rows[0].id };
}

async function getDocumentByToken(token) {
  const res = await pool.query('SELECT * FROM documents WHERE approval_token = $1', [token]);
  return res.rows[0] || null;
}

async function getDocumentById(id) {
  const res = await pool.query('SELECT * FROM documents WHERE id = $1', [id]);
  return res.rows[0] || null;
}

async function getDocumentsBySender(senderId) {
  const res = await pool.query(
    'SELECT * FROM documents WHERE sender_id = $1 ORDER BY created_at DESC', [senderId]
  );
  return res.rows;
}

async function getDocumentsByApproverEmail(email) {
  const res = await pool.query(
    `SELECT d.*, u.username as sender_name
     FROM documents d
     JOIN users u ON d.sender_id = u.id
     WHERE d.approver_email = $1
     ORDER BY d.created_at DESC`,
    [email]
  );
  return res.rows;
}

async function getAllDocuments() {
  const res = await pool.query(
    `SELECT d.*, u.username as sender_name
     FROM documents d
     JOIN users u ON d.sender_id = u.id
     ORDER BY d.created_at DESC`
  );
  return res.rows;
}

async function updateDocumentStatus({ id, status, recipientEmail, approvedFilename }) {
  await pool.query(
    `UPDATE documents
     SET status = $1, recipient_email = $2, approved_filename = $3, updated_at = NOW()
     WHERE id = $4`,
    [status, recipientEmail, approvedFilename, id]
  );
}

async function deleteDocument(id) {
  await pool.query('DELETE FROM documents WHERE id = $1', [id]);
}

module.exports = {
  init,
  getUserByUsername, getUserById, getUserByEmail,
  createUser, getAllUsers, deleteUser,
  createDocument, getDocumentByToken, getDocumentById,
  getDocumentsBySender, getDocumentsByApproverEmail,
  getAllDocuments, updateDocumentStatus, deleteDocument
};
