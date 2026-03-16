// ============================================================
// utils/email.js - Funzioni per l'invio delle email
// Usa Nodemailer con Gmail per inviare:
//  1. Il link di approvazione all'approvatore
//  2. Il PDF firmato al destinatario
//  3. La notifica di rifiuto al destinatario
// ============================================================

const nodemailer = require('nodemailer');

// Crea il "trasportatore" di email configurato con Gmail
// Le credenziali vengono lette dal file .env
function createTransporter() {
  return nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS, // Deve essere una "Password per le app" Google
    },
  });
}

// ---- EMAIL 1: Link di approvazione ----
// Inviata all'approvatore quando il mittente carica un PDF
async function sendApprovalRequest({ approverEmail, senderEmail, filename, approvalToken }) {
  const transporter = createTransporter();

  // Costruisce il link che l'approvatore dovrà cliccare
  const approvalLink = `${process.env.APP_URL}/approve.html?token=${approvalToken}`;

  await transporter.sendMail({
    from: `"${process.env.EMAIL_FROM}" <${process.env.EMAIL_USER}>`,
    to: approverEmail,
    subject: 'Richiesta di approvazione documento',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #333;">Documento in attesa di approvazione</h2>
        <p>Hai ricevuto una richiesta di approvazione per il documento:</p>
        <p style="background: #f5f5f5; padding: 12px; border-radius: 6px;">
          <strong>${filename}</strong>
        </p>
        <p>Inviato da: <strong>${senderEmail}</strong></p>
        <p>Clicca il bottone qui sotto per visualizzare e approvare (o rifiutare) il documento:</p>
        <a href="${approvalLink}"
           style="display: inline-block; background: #4F46E5; color: white;
                  padding: 12px 24px; text-decoration: none; border-radius: 6px;
                  margin: 16px 0;">
          Apri documento
        </a>
        <p style="color: #888; font-size: 12px;">
          Oppure copia questo link nel browser:<br>${approvalLink}
        </p>
      </div>
    `,
  });
}

// ---- EMAIL 2: PDF approvato con firma ----
// Inviata al destinatario dopo l'approvazione
async function sendApprovedDocument({ recipientEmail, filename, approvedFilePath }) {
  const transporter = createTransporter();

  await transporter.sendMail({
    from: `"${process.env.EMAIL_FROM}" <${process.env.EMAIL_USER}>`,
    to: recipientEmail,
    subject: 'Documento approvato',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #16a34a;">Documento approvato</h2>
        <p>Il documento <strong>${filename}</strong> è stato approvato.</p>
        <p>In allegato trovi il documento con la firma di approvazione.</p>
      </div>
    `,
    attachments: [
      {
        filename: `APPROVATO_${filename}`,
        path: approvedFilePath,
        contentType: 'application/pdf',
      },
    ],
  });
}

// ---- EMAIL 3: Documento non approvato ----
// Inviata al destinatario quando il documento viene rifiutato
async function sendRejectedDocument({ recipientEmail, filename, originalFilePath }) {
  const transporter = createTransporter();

  await transporter.sendMail({
    from: `"${process.env.EMAIL_FROM}" <${process.env.EMAIL_USER}>`,
    to: recipientEmail,
    subject: 'documento non approvato',  // Oggetto esatto come richiesto
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #dc2626;">Documento non approvato</h2>
        <p>Il documento <strong>${filename}</strong> non è stato approvato.</p>
        <p>In allegato trovi il documento originale non firmato.</p>
      </div>
    `,
    attachments: [
      {
        filename: filename,
        path: originalFilePath,
        contentType: 'application/pdf',
      },
    ],
  });
}

module.exports = { sendApprovalRequest, sendApprovedDocument, sendRejectedDocument };
