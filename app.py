from flask import Flask, request, jsonify
from flask_cors import CORS
import pytesseract
from PIL import Image
import requests
from io import BytesIO

app = Flask(__name__)
CORS(app)  # ✅ Enable CORS

@app.route("/ocr", methods=["POST"])
def ocr():
    data = request.get_json()
    image_url = data.get("imageUrl")
    if not image_url:
        return jsonify({"error": "No image URL provided"}), 400

    try:
        # Download image from URL
        response = requests.get(image_url)
        img = Image.open(BytesIO(response.content))

        # Extract text
        text = pytesseract.image_to_string(img)

        return jsonify({"text": text})
    except Exception as e:
        return jsonify({"error": str(e)}), 500

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000)
