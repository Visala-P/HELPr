from flask import Flask, request, jsonify, send_file
from PIL import Image
import pytesseract
from fpdf import FPDF
import speech_recognition as sr
from ultralytics import YOLO
import os

app = Flask(__name__)

# ----------- CONFIG -------------
UPLOAD_FOLDER = 'uploads'
os.makedirs(UPLOAD_FOLDER, exist_ok=True)

# Tesseract path (ensure this is correct for your system)
pytesseract.pytesseract.tesseract_cmd = r'C:\Program Files\Tesseract-OCR'

# Load YOLOv8 model (make sure yolov8n.pt is available)
try:
    model = YOLO('yolov8n.pt')
except Exception as e:
    print("⚠️ YOLO model load failed:", e)
    model = None

# ----------- ROUTES -------------

@app.route('/')
def home():
    return "✅ Flask backend is running with Object Detection, OCR & Transcription."

# ----- YOLO Object Detection -----
@app.route('/detect', methods=['POST'])
def detect():
    if 'image' not in request.files:
        return jsonify({'error': 'No image uploaded'}), 400

    if model is None:
        return jsonify({'error': 'YOLO model not loaded'}), 500

    file = request.files['image']
    if not file.filename.lower().endswith(('.png', '.jpg', '.jpeg')):
        return jsonify({'error': 'Invalid image format'}), 400

    filepath = os.path.join(UPLOAD_FOLDER, file.filename)
    file.save(filepath)

    try:
        results = model(filepath)
        detections = []
        for r in results:
            for box in r.boxes:
                cls = int(box.cls[0])
                label = model.names[cls]
                detections.append({
                    'label': label,
                    'confidence': float(box.conf[0]),
                    'bbox': list(map(float, box.xyxy[0].tolist()))
                })
        return jsonify(detections)
    except Exception as e:
        return jsonify({'error': f'Detection failed: {str(e)}'}), 500

# ----- OCR + PDF Export -----
@app.route('/ocr', methods=['POST'])
def ocr():
    if 'image' not in request.files:
        return jsonify({'error': 'No image uploaded'}), 400

    file = request.files['image']
    if not file.filename.lower().endswith(('.png', '.jpg', '.jpeg')):
        return jsonify({'error': 'Invalid image format'}), 400

    filepath = os.path.join(UPLOAD_FOLDER, file.filename)
    file.save(filepath)

    try:
        text = pytesseract.image_to_string(Image.open(filepath))
        pdf = FPDF()
        pdf.add_page()
        pdf.set_font("Arial", size=12)
        for line in text.split('\n'):
            if line.strip():
                pdf.cell(200, 10, txt=line, ln=True)

        pdf_filename = os.path.splitext(file.filename)[0] + '.pdf'
        pdf_path = os.path.join(UPLOAD_FOLDER, pdf_filename)
        pdf.output(pdf_path)

        return send_file(pdf_path, as_attachment=True)
    except Exception as e:
        return jsonify({'error': f'OCR failed: {str(e)}'}), 500

# ----- Audio Transcription -----
@app.route('/transcribe', methods=['POST'])
def transcribe():
    if 'audio' not in request.files:
        return jsonify({'error': 'No audio uploaded'}), 400

    file = request.files['audio']
    if not file.filename.lower().endswith(('.wav', '.mp3')):
        return jsonify({'error': 'Invalid audio format'}), 400

    filepath = os.path.join(UPLOAD_FOLDER, file.filename)
    file.save(filepath)

    recognizer = sr.Recognizer()
    try:
        with sr.AudioFile(filepath) as source:
            audio_data = recognizer.record(source)
            transcript = recognizer.recognize_google(audio_data)
            return jsonify({'transcript': transcript})
    except sr.UnknownValueError:
        return jsonify({'error': 'Speech not recognized'}), 500
    except Exception as e:
        return jsonify({'error': f'Transcription failed: {str(e)}'}), 500

# ---------- RUN SERVER ----------
if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000, debug=True)
