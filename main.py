import streamlit as st
from fpdf import FPDF
from PIL import Image
import datetime
import io
import smtplib
from email.mime.multipart import MIMEMultipart
from email.mime.base import MIMEBase
from email.mime.text import MIMEText
from email import encoders
import fitz  # PyMuPDF: molto più veloce e leggero per i PDF

# --- CONFIGURAZIONE GMAIL ---
GMAIL_USER = "tuo_account@gmail.com" 
GMAIL_PASS = "xxxx xxxx xxxx xxxx" # La tua Password per le App

def invia_email(destinatario, oggetto, corpo, allegato_bytes, nome_file):
    msg = MIMEMultipart()
    msg['From'] = GMAIL_USER
    msg['To'] = destinatario
    msg['Subject'] = oggetto
    msg.attach(MIMEText(corpo, 'plain'))
    part = MIMEBase('application', 'octet-stream')
    part.set_payload(allegato_bytes)
    encoders.encode_base64(part)
    part.add_header('Content-Disposition', f"attachment; filename= {nome_file}")
    msg.attach(part)
    try:
        server = smtplib.SMTP('smtp.gmail.com', 587)
        server.starttls()
        server.login(GMAIL_USER, GMAIL_PASS)
        server.send_message(msg)
        server.quit()
        return True
    except Exception as e:
        st.error(f"Errore invio mail: {e}")
        return False

def genera_pdf(file_uploaded, esito, note, timbro_path):
    pdf = FPDF()
    # PAGINA 1: VERBALE
    pdf.add_page()
    pdf.set_font("Helvetica", 'B', 16)
    pdf.cell(0, 10, "VERBALE DI REVISIONE", ln=True, align='C')
    pdf.ln(10)
    pdf.set_font("Helvetica", size=12)
    pdf.cell(0, 10, f"Data: {datetime.datetime.now().strftime('%d/%m/%Y %H:%M')}", ln=True)
    pdf.cell(0, 10, f"Stato: {esito.upper()}", ln=True)
    pdf.multi_cell(0, 10, f"Note: {note}")

    # PAGINA 2: DOCUMENTO (Gestione Immagine o PDF)
    pdf.add_page()
    
    try:
        if file_uploaded.type == "application/pdf":
            # Convertiamo la prima pagina del PDF in immagine
            doc_pdf = fitz.open(stream=file_uploaded.read(), filetype="pdf")
            page = doc_pdf.load_page(0)
            pix = page.get_pixmap(matrix=fitz.Matrix(2, 2)) # Alta qualità
            img = Image.frombytes("RGB", [pix.width, pix.height], pix.samples)
        else:
            # È già un'immagine
            img = Image.open(file_uploaded)
            if img.mode in ("RGBA", "P"): img = img.convert("RGB")
        
        img_buffer = io.BytesIO()
        img.save(img_buffer, format="JPEG")
        img_buffer.seek(0)
        pdf.image(img_buffer, x=5, y=5, w=200)

        if esito == "Approvato":
            pdf.image(timbro_path, x=145, y=245, w=50) 
            
    except Exception as e:
        st.error(f"Errore nel processare il file: {e}")
        
    return pdf.output()

# --- INTERFACCIA STREAMLIT ---
st.set_page_config(page_title="Resistor Web App")
st.title("📝 Approvazione Documenti")

# Sblocchiamo ufficialmente i PDF
uploaded_file = st.file_uploader("Carica File (JPG, PNG o PDF)", type=['jpg', 'jpeg', 'png', 'pdf'])

if uploaded_file:
    # Mostriamo l'anteprima solo se è un'immagine, per i PDF mettiamo un'icona
    if uploaded_file.type == "application/pdf":
        st.info("📄 File PDF caricato correttamente.")
    else:
        st.image(uploaded_file, caption="Anteprima", use_container_width=True)
    
    with st.form("form_approvazione"):
        dest_mail = st.text_input("Invia a:", "resistorwelovediesel@gmail.com")
        note = st.text_area("Note")
        c1, c2 = st.columns(2)
        approvato = c1.form_submit_button("✅ APPROVA")
        rifiutato = c2.form_submit_button("❌ RIFIUTA")

        if approvato or rifiutato:
            esito = "Approvato" if approvato else "Non Approvato"
            pdf_bytes = genera_pdf(uploaded_file, esito, note, "timbro.png")
            nome_doc = f"Revisione_{uploaded_file.name}.pdf"
            if invia_email(dest_mail, f"Esito: {esito}", "In allegato doc firmato.", pdf_bytes, nome_doc):
                st.success("Inviato!")