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

# --- CONFIGURAZIONE GMAIL ---
GMAIL_USER = "tuo_account@gmail.com"  # La tua mail
GMAIL_PASS = "xxxx xxxx xxxx xxxx"    # La Password per le App di 16 cifre

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

def genera_pdf(file_originale, esito, note, timbro_path):
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

    # PAGINA 2: DOCUMENTO + FIRMA
    pdf.add_page()
    img = Image.open(file_originale)
    # Converti in RGB se necessario (per PNG con trasparenza)
    if img.mode in ("RGBA", "P"): img = img.convert("RGB")
    
    img_buffer = io.BytesIO()
    img.save(img_buffer, format="JPEG")
    img_buffer.seek(0)
    
    # Inserimento immagine a piena pagina
    pdf.image(img_buffer, x=5, y=5, w=200)

    if esito == "Approvato":
        # Posizionamento millimetrico del timbro (x, y, larghezza)
        pdf.image(timbro_path, x=145, y=245, w=50) 
        
    return pdf.output()

# --- INTERFACCIA STREAMLIT ---
st.set_page_config(page_title="Resistor Web App", layout="centered")
st.title("📝 Approvazione Documenti")

uploaded_file = st.file_uploader("Trascina qui il file", type=['jpg', 'jpeg', 'png', 'pdf'])

if uploaded_file:
    st.image(uploaded_file, caption="Anteprima", use_container_width=True)
    
    with st.form("form_approvazione"):
        dest_mail = st.text_input("Invia PDF finale a:", "resistorwelovediesel@gmail.com")
        note = st.text_area("Note aggiuntive")
        c1, c2 = st.columns(2)
        approvato = c1.form_submit_button("✅ APPROVA E FIRMA")
        rifiutato = c2.form_submit_button("❌ RIFIUTA")

        if approvato or rifiutato:
            esito = "Approvato" if approvato else "Non Approvato"
            
            with st.spinner("Elaborazione in corso..."):
                pdf_bytes = genera_pdf(uploaded_file, esito, note, "timbro.png")
                nome_doc = f"Revisione_{uploaded_file.name}.pdf"
                
                successo_mail = invia_email(dest_mail, f"Esito Revisione: {esito}", "In allegato il documento firmato.", pdf_bytes, nome_doc)
                
                if successo_mail:
                    st.success(f"PDF Generato e inviato correttamente a {dest_mail}!")
                    st.download_button("Scarica copia locale", pdf_bytes, nome_doc, "application/pdf")