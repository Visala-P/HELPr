require('dotenv').config();
const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const multer = require('multer');
const Tesseract = require('tesseract.js');
const axios = require('axios');
const FormData = require('form-data');
const { CohereClient } = require("cohere-ai");

const cohere = new CohereClient({
  token: process.env.COHERE_API_KEY,
});

const app = express();
// === Middleware
app.use(cors());
app.use(bodyParser.json({ limit: '50mb' }));
app.use(express.static('uploads'));
app.use(express.static('public')); // ✅ if your frontend is inside /public
app.use(express.json());
// === Constants
const UPLOAD_DIR = path.join(__dirname, 'uploads');
const FLASK_URL = 'http://localhost:5000';

// === Ensure uploads folder exists
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR);

// === MongoDB Connection
mongoose.connect(process.env.MONGODB_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true
})
.then(() => console.log('✅ MongoDB connected'))
.catch(err => console.error('❌ MongoDB error:', err));

// === Multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOAD_DIR),
  filename: (req, file, cb) => cb(null, Date.now() + '-' + file.originalname),
});
const upload = multer({ storage });

// === Mongoose Schemas
const ChatSchema = new mongoose.Schema({
  sessionId: String,
  sender: String, // "user" or "assistant"
  text: String,
  timestamp: { type: Date, default: Date.now }
});
const Chat = mongoose.model('Chat', ChatSchema);

const UserSchema = new mongoose.Schema({
  username: String,
  password: String
});
const User = mongoose.model('User', UserSchema);

// === Routes

// ✅ Basic
app.get('/', (req, res) => {
  res.send('HELPr API is running!');
});
// 📩 Chat endpoint
app.post('/chat', async (req, res) => {
  console.log('POST /chat called with body:', req.body); // Diagnostic log
  const { message, history = [], sessionId = Date.now().toString() } = req.body;

  if (!message) {
    return res.status(400).json({ reply: "❌ Error: Missing message" });
  }

  try {
    // Prepare chat history for Cohere
    const messages = history.map(h => ({
      role: h.sender === 'user' ? 'USER' : 'CHATBOT',
      message: h.text,
    }));
    messages.push({ role: 'USER', message });

    const response = await cohere.chat({
      model: 'command-r-plus',
      message,
      chatHistory: messages,
      temperature: 0.7,
    });

    const botReply = response?.text?.trim() || "🤖 Sorry, I didn’t get that.";
    await Chat.create({ sessionId, sender: 'user', text: message });
    await Chat.create({ sessionId, sender: 'assistant', text: botReply });

    res.json({ reply: botReply });
  } catch (err) {
    console.error('Cohere error:', err.message);
    res.status(500).json({ reply: "❌ Error: " + (err.message || 'Cohere API error') });
  }
});

async function sendMessage() {
  const userMessage = userInput.value.trim();
  if (!userMessage) return;

  chatBox.innerHTML += `<div class="user">🧑 ${userMessage}</div>`;
  userInput.value = "";

  try {
    const response = await fetch('/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: userMessage }),
    });

    if (!response.ok) {
      throw new Error(`HTTP error! Status: ${response.status}`);
    }

    const data = await response.json(); // ✅ Make sure backend sends { reply: ... }
    chatBox.innerHTML += `<div class="bot">🤖 ${data.reply}</div>`;

  } catch (err) {
    console.error('Fetch failed:', err);
    chatBox.innerHTML += `<div class="error">⚠️ Error: ${err.message}</div>`;
  }
}


app.post('/generate', async (req, res) => {
  console.log('POST /generate called with body:', req.body); // Diagnostic log
  // Accept both 'message' and 'prompt' for flexibility
  const userMessage = req.body.message || req.body.prompt;

  if (!userMessage) {
    return res.status(400).json({ reply: "❌ Error: Message or prompt is required" });
  }

  try {
    const response = await cohere.generate({
      model: 'command',
      prompt: userMessage,
      max_tokens: 100,
    });

    // Check if generations exist before accessing
    if (response.generations && response.generations.length > 0) {
      const reply = response.generations[0].text.trim();
      res.json({ reply });
    } else {
      res.status(500).json({ reply: "❌ Error: No generations returned from Cohere" });
    }
  } catch (error) {
    // Log full error object for debugging
    console.error("Error in /generate:", error);
    try {
      console.error("Stringified error:", JSON.stringify(error, null, 2));
    } catch {}
    // Always return a valid JSON object with a string error message
    res.status(500).json({ reply: "❌ Error: " + (error.message || String(error) || "Unknown error") });
  }
});

// ✅ must return a valid JSON object
// ✅ Register
app.post("/register", async (req, res) => {
  const { username, password } = req.body;
  const hashed = await bcrypt.hash(password, 10);
  await User.create({ username, password: hashed });
  res.json({ message: "User registered" });
});


// ✅ Login
app.post("/login", async (req, res) => {
  const { username, password } = req.body;
  const user = await User.findOne({ username });
  if (!user || !(await bcrypt.compare(password, user.password)))
    return res.status(401).json({ error: "Invalid" });
  
  const token = jwt.sign({ id: user._id }, "secretkey");
  res.json({ token });
});

// ✅ Upload (Base64)
app.post("/upload", async (req, res) => {
  const { filename, type, data } = req.body;
  if (!filename || !data) return res.status(400).json({ error: "Missing file data" });

  try {
    const buffer = Buffer.from(data, 'base64');
    const uploadDir = path.join(__dirname, 'uploads');
    if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir);

    const filePath = path.join(uploadDir, filename);
    fs.writeFileSync(filePath, buffer);

    console.log(`📁 File saved: ${filePath}`);
    res.json({ success: true, message: "File uploaded", path: `/uploads/${filename}` });
  } catch (err) {
    console.error("❌ Upload error:", err);
    res.status(500).json({ error: "Upload failed" });
  }
});

// ✅ OCR using Tesseract
app.post('/ocr-js', upload.array('images', 5), async (req, res) => {
  const results = [];

  for (const file of req.files) {
    try {
      const result = await Tesseract.recognize(path.join(__dirname, file.path), 'eng');
      results.push({ filename: file.originalname, text: result.data.text.trim() });
    } catch {
      results.push({ filename: file.originalname, text: '❌ OCR failed' });
    }
  }

  res.json(results);
});

// ✅ OCR via Flask
app.post('/ocr', upload.single('image'), async (req, res) => {
  const form = new FormData();
  form.append('image', fs.createReadStream(req.file.path));

  try {
    const response = await axios.post(`${FLASK_URL}/ocr`, form, {
      headers: form.getHeaders(),
      responseType: 'stream',
    });

    res.setHeader('Content-Disposition', 'attachment; filename=ocr_result.pdf');
    response.data.pipe(res);
  } catch (err) {
    res.status(500).json({ error: 'OCR via Python failed' });
  }
});

// ✅ YOLO Detection
app.post('/detect', upload.single('image'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No image uploaded' });

  const form = new FormData();
  form.append('image', fs.createReadStream(req.file.path));

  try {
    const response = await axios.post(`${FLASK_URL}/detect`, form, {
      headers: form.getHeaders()
    });

    res.json(response.data);
  } catch (err) {
    console.error('Detection error:', err.message);
    res.status(500).json({ error: 'Object detection failed' });
  }
});

// ✅ Audio Transcription
app.post('/transcribe', upload.single('audio'), async (req, res) => {
  const form = new FormData();
  form.append('audio', fs.createReadStream(req.file.path));

  try {
    const response = await axios.post(`${FLASK_URL}/transcribe`, form, {
      headers: form.getHeaders(),
    });

    res.json(response.data);
  } catch (err) {
    res.status(500).json({ error: 'Transcription failed' });
  }
});

// ✅ Chat History
app.get('/history', async (req, res) => {
  const { sessionId } = req.query;
  if (!sessionId) return res.status(400).json({ error: "Missing sessionId" });

  try {
    const history = await Chat.find({ sessionId }).sort({ timestamp: 1 });
    res.json(history);
  } catch (err) {
    console.error('❌ Error fetching history:', err.message);
    res.status(500).json({ error: 'Failed to fetch chat history' });
  }
});
// ✅ Clear History
app.delete('/clear', async (req, res) => {
  try {
    await Chat.deleteMany({});
    res.json({ success: true, message: 'All chats cleared' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to clear chats' });
  }
});
// ✅ Available Models
app.get('/models', (req, res) => {
  res.json({ available: ["command-r-plus"] });
});

// ✅ Image upload endpoint for chat UI
app.post('/upload-image', upload.single('image'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No image uploaded' });
  }
  res.json({
    success: true,
    filename: req.file.filename,
    url: `/uploads/${req.file.filename}`
  });
});

// Catch-all error handler (always returns JSON)
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ reply: '❌ Error: Internal server error' });
});

// === Start Server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`✅ Server running on http://localhost:${PORT}`);
});