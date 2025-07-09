require('dotenv').config();
console.log('Mongo URI:', process.env.MONGODB_URI);
console.log('📦 Server script started');

const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const OpenAI = require('openai');
const mongoose = require('mongoose');

const app = express();
app.use(cors());
app.use(bodyParser.json());

// 🔌 Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true
})
  .then(() => console.log('✅ MongoDB connected'))
  .catch(error => {
    console.error('❌ MongoDB Error:', error.message);
  });

// 💬 Chat Schema and Model
const ChatSchema = new mongoose.Schema({
  user: String,
  bot: String,
  timestamp: { type: Date, default: Date.now }
});
const Chat = mongoose.model('Chat', ChatSchema);

// 🔐 Initialize OpenAI SDK
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

// 📩 Chat Endpoint
app.post('/chat', async (req, res) => {
  const userMessage = req.body.message;
  console.log('📩 Received message:', userMessage);

  try {
    const completion = await openai.chat.completions.create({
      model: 'gpt-3.5-turbo',
      messages: [
        { role: 'system', content: 'You are a helpful student tutor.' },
        { role: 'user', content: userMessage }
      ]
    });

    const reply = completion.choices[0].message.content;
    console.log('🤖 OpenAI reply:', reply);

    // Save to DB
    await Chat.create({ user: userMessage, bot: reply });
    console.log('✅ Chat saved to MongoDB');

    res.json({ reply });
  } catch (error) {
    console.error('❌ OpenAI Error:', error.response?.data || error.message);
    res.status(500).send({ error: 'OpenAI API error.' });
  }
});

// 📜 Chat History Endpoint
app.get('/history', async (req, res) => {
  try {
    const chats = await Chat.find().sort({ timestamp: -1 }).limit(20);
    res.json(chats);
  } catch (error) {
    console.error('❌ History fetch error:', error.message);
    res.status(500).send({ error: 'Failed to fetch history' });
  }
});

// 🚀 Start the Server
app.listen(3000, () => {
  console.log('✅ Server running on http://localhost:3000');
});
