let allChats = [], chatHistory = [], currentChatId = null;
let controller = null;
let isBotReplying = false;
let uploadedImages = [];

const sessionId = localStorage.getItem('sessionId') || Date.now().toString();
localStorage.setItem('sessionId', sessionId);

const chatForm = document.getElementById("chat-form");
const inputBox = document.getElementById("user-input");
const sendButton = document.getElementById("send-button");
const sendIcon = document.getElementById("send-icon");
const micIcon = document.getElementById("mic-icon");
const form = document.querySelector('form');
const input = document.querySelector('#user-input');
const chatBox = document.querySelector('#chat-box');

window.onload = () => {
  const storedChats = localStorage.getItem("allChats");
  const storedChatId = localStorage.getItem("currentChatId");

  if (storedChats) {
    allChats = JSON.parse(storedChats);
    currentChatId = storedChatId || allChats[0]?.id || null;
  }

  renderChatList();

  const currentChat = allChats.find(c => c.id === currentChatId);
  if (currentChat) {
    chatHistory = currentChat.history;
    renderChatMessages(chatHistory);
  } else startNewChat();

  fetch('/history?sessionId=' + sessionId)
    .then(r => r.json())
    .then(history => {
      chatHistory = history.map(h => ({
        sender: h.sender === 'user' ? 'user' : 'bot',
        text: h.text,
        timestamp: new Date(h.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      }));
      renderChatMessages(chatHistory);
    })
    .catch(err => console.error("❌ Error loading history:", err));
};

function startNewChat() {
  currentChatId = Date.now().toString();
  chatHistory = [];
  allChats.unshift({ id: currentChatId, title: "New Chat", history: [] });
  renderChatList();
  renderChatMessages([]);
}

function renderChatList() {
  const chatList = document.getElementById("chat-list");
  chatList.innerHTML = '';
  allChats.filter(chat => !chat.archived).forEach(chat => {
    const li = document.createElement("li");
    li.className = "chat-item";
    li.onclick = () => openChat(chat.id);
    li.style.position = "relative";

    // Chat name in a span
    const titleSpan = document.createElement("span");
    titleSpan.className = "chat-item-title";
    titleSpan.textContent = chat.title;
    li.appendChild(titleSpan);

    // Three-dots menu
    const menuBtn = document.createElement("button");
    menuBtn.className = "chat-menu-btn";
    menuBtn.innerHTML = "...";
    menuBtn.onclick = (e) => {
      e.stopPropagation();
      showChatMenu(li, chat.id);
    };
    li.appendChild(menuBtn);

    // Show menu on hover
    li.addEventListener("mouseenter", () => {
      menuBtn.style.display = "inline-block";
    });
    li.addEventListener("mouseleave", () => {
      menuBtn.style.display = "none";
      hideChatMenu(li);
    });
    menuBtn.style.display = "none";

    chatList.appendChild(li);
  });
}

function showChatMenu(li, chatId) {
  hideChatMenu(li); // Remove any existing menu
  const menu = document.createElement("div");
  menu.className = "chat-dropdown-menu";
  menu.style.position = "absolute";
  menu.style.right = "32px";
  menu.style.top = "50%";
  menu.style.transform = "translateY(-50%)";
  menu.style.background = "#fff";
  menu.style.border = "1px solid #ccc";
  menu.style.borderRadius = "6px";
  menu.style.boxShadow = "0 2px 8px rgba(0,0,0,0.08)";
  menu.style.zIndex = "100";
  menu.style.minWidth = "120px";

  const options = [
    { label: "Share Chat", action: () => shareChat(chatId) },
    { label: "Delete Chat", action: () => deleteChat(chatId) },
    { label: "Rename Chat", action: () => renameChat(chatId) },
    { label: "Archive", action: () => archiveChat(chatId) }
  ];

  options.forEach(opt => {
    const btn = document.createElement("button");
    btn.textContent = opt.label;
    btn.className = "chat-menu-option";
    btn.style.display = "block";
    btn.style.width = "100%";
    btn.style.padding = "8px";
    btn.style.border = "none";
    btn.style.background = "none";
    btn.style.textAlign = "left";
    btn.style.cursor = "pointer";
    btn.onmousedown = (e) => { e.preventDefault(); }; // Prevent focus loss
    btn.onclick = (e) => {
      e.stopPropagation();
      opt.action();
      hideChatMenu(li);
    };
    menu.appendChild(btn);
  });

  li.appendChild(menu);
}

function hideChatMenu(li) {
  const menu = li.querySelector('.chat-dropdown-menu');
  if (menu) menu.remove();
}

function deleteChat(chatId) {
  const idx = allChats.findIndex(c => c.id === chatId);
  if (idx !== -1) {
    allChats.splice(idx, 1);
    if (currentChatId === chatId) {
      currentChatId = allChats[0]?.id || null;
      chatHistory = allChats[0]?.history || [];
      renderChatMessages(chatHistory);
    }
    renderChatList();
    localStorage.setItem("allChats", JSON.stringify(allChats));
    localStorage.setItem("currentChatId", currentChatId);
  }
}

function renameChat(chatId) {
  const chat = allChats.find(c => c.id === chatId);
  if (chat) {
    const newTitle = prompt("Enter new chat name:", chat.title);
    if (newTitle && newTitle.trim()) {
      chat.title = newTitle.trim();
      renderChatList();
      localStorage.setItem("allChats", JSON.stringify(allChats));
    }
  }
}

function shareChat(chatId) {
  const url = `${window.location.origin}/?chat=${chatId}`;
  navigator.clipboard.writeText(url).then(() => {
    alert("✅ Chat link copied to clipboard!\n" + url);
  });
}

function archiveChat(chatId) {
  const chat = allChats.find(c => c.id === chatId);
  if (chat) {
    chat.archived = true;
    renderChatList();
    localStorage.setItem("allChats", JSON.stringify(allChats));
  }
}

function openChat(chatId) {
  console.log(`Opening chat: ${chatId}`);
  const chat = allChats.find(c => c.id === chatId);
  if (!chat) return;
  currentChatId = chatId;
  chatHistory = chat.history;
  renderChatMessages(chatHistory);
  scrollToBottom(); // Always scroll to bottom when opening a chat
}

function renderChatMessages(messages) {
  const chatBox = document.getElementById("chat-messages");
  chatBox.innerHTML = '';
  messages.forEach(({ sender, text, timestamp }) => appendMessage(sender, text, timestamp, false));
}

chatForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  if (isBotReplying) {
    if (controller) controller.abort();
    isBotReplying = false;
    resetSendButton();
    return;
  }

  const input = inputBox.value.trim();
  if (!input) return;

  const timestamp = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  appendMessage("user", input, timestamp);
  inputBox.value = '';

  const botTyping = document.createElement("div");
  botTyping.className = "chat-message bot typing";
  botTyping.innerHTML = `<div class="bubble"><span class="typing-dots">Typing...</span></div>`;
  document.getElementById("chat-messages").appendChild(botTyping);

  isBotReplying = true;
  controller = new AbortController();
  sendButton.textContent = "⏹️";

  try {
    if (input.toLowerCase().includes("convert") && input.toLowerCase().includes("pdf")) {
      if (uploadedImages.length === 0) {
        appendMessage("bot", "⚠️ No uploaded images to convert.");
        return;
      }

      const form = new FormData();
      form.append("image", uploadedImages[0]); // Only sending first image for now
      const res = await fetch('/ocr', { method: 'POST', body: form });

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      botTyping.remove();
      appendMessage("bot", `📝 Here's your converted PDF: <a href="${url}" target="_blank">Download PDF</a>`, timestamp);
      uploadedImages = [];
    } else {
      // Send correct history format for Cohere
      const response = await fetch("http://localhost:3000/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: input,
          sessionId,
          history: chatHistory.map(item => ({ sender: item.sender, text: item.text }))
        }),
        signal: controller.signal
      });

      let data;
      try {
        data = await response.json();
      } catch (jsonErr) {
        botTyping.remove();
        appendMessage("bot", "❌ Server returned invalid response.", timestamp);
        return;
      }
      botTyping.remove();
      appendMessage("bot", data.reply || "⚠️ No response from server", timestamp);
    }
  } catch (err) {
    botTyping.remove();
    appendMessage("bot", err.name === 'AbortError' ? "⏹️ Bot response stopped." : err.message, timestamp);
  } finally {
    isBotReplying = false;
    resetSendButton();
  }
});

function resetSendButton() {
  sendButton.innerHTML = `<span class="send-arrow">⬆</span>`;
}

function appendMessage(sender, text, timestamp = '', save = true) {
  const chat = document.getElementById("chat-messages");
  const msg = document.createElement("div");
  msg.className = `chat-message ${sender}`;
  const bubble = document.createElement("div");
  bubble.className = "bubble";
  bubble.innerHTML = `${formatMessage(text)}
    <div style="display: flex; justify-content: flex-end; gap: 4px;">
      ${sender === "bot" ? `<button class="icon-symbol-btn" onclick="speakText(\`${text.replace(/`/g, "\\`")}\`)">🗣️</button>` : ""}
      ${timestamp ? `<span class="timestamp">${timestamp}</span>` : ""}
    </div>`;
  msg.appendChild(bubble);
  chat.appendChild(msg);

  if (save) {
    const current = allChats.find(c => c.id === currentChatId);
    if (current) {
      current.history.push({ sender, text, timestamp });
      if (sender === "user" && current.title === "New Chat") {
        current.title = getSummaryTitle(text);
        renderChatList();
      }
    }
    localStorage.setItem("allChats", JSON.stringify(allChats));
    localStorage.setItem("currentChatId", currentChatId);
  }

  chat.scrollTop = chat.scrollHeight;
  Prism.highlightAll();
}

function formatMessage(text) {
  const escaped = text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  return escaped.replace(/```(\w*)\n([\s\S]*?)```/g, (_, lang, code) => {
    const id = Math.random().toString(36).substring(2, 8);
    return `<div class="code-container">
      <button class="copy-btn" onclick="copyCode('${id}')">📋</button>
      <pre><code id="${id}" class="language-${lang || 'plaintext'}">${code.trim()}</code></pre>
    </div>`;
  }).replace(/`([^`\n]+)`/g, (_, inline) => `<code class="inline-code">${inline}</code>`).replace(/\n/g, "<br>");
}

function copyCode(id) {
  const code = document.getElementById(id);
  navigator.clipboard.writeText(code.innerText).then(() => alert("✅ Code copied!"));
}

function speakText(text) {
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = 'en-US';
  speechSynthesis.speak(utterance);
}

// === 🖼️ IMAGE UPLOAD FROM CLIPBOARD ===
document.getElementById("user-input").addEventListener("paste", e => {
  const items = e.clipboardData.items;
  let count = 0;

  for (const item of items) {
    if (item.type.startsWith("image")) {
      if (uploadedImages.length >= 5) {
        alert("⚠️ Only 5 images allowed per chat.");
        return;
      }

      const file = item.getAsFile();
      uploadedImages.push(file);
      const reader = new FileReader();
      reader.onload = () => {
        const imgHTML = `<img src="${reader.result}" style="max-width: 100%; border-radius: 10px;" />`;
        appendMessage("user", imgHTML, new Date().toLocaleTimeString());

        // Run object detection
        const form = new FormData();
        form.append("image", file);
        fetch('/detect', { method: 'POST', body: form })
          .then(res => res.json())
          .then(data => {
            const labels = data.map(d => `${d.label} (${(d.confidence * 100).toFixed(1)}%)`).join(', ');
            appendMessage("bot", `🔍 Detected: ${labels}`, new Date().toLocaleTimeString());
          });

        // Run OCR
        fetch('/ocr-js', {
          method: 'POST',
          body: (() => {
            const f = new FormData();
            f.append('images', file);
            return f;
          })()
        })
          .then(res => res.json())
          .then(data => {
            const text = data[0]?.text || "No text found.";
            appendMessage("bot", `📝 OCR Result: ${text}`, new Date().toLocaleTimeString());
          });
      };
      reader.readAsDataURL(file);
      count++;
    }
  }
});

// === 🎤 SPEECH TO TEXT ===
const recognition = new (window.SpeechRecognition || window.webkitSpeechRecognition)();
recognition.lang = 'en-US';
recognition.interimResults = false;

document.getElementById("mic-button").addEventListener("click", () => {
  recognition.start();
  micIcon.src = "assets/mic-active.gif";
});

recognition.onresult = (event) => {
  inputBox.value = event.results[0][0].transcript;
  micIcon.src = "assets/mic-icon.png";
};

recognition.onend = () => {
  micIcon.src = "assets/mic-icon.png";
};
document.getElementById("dark-toggle").addEventListener("click", () => {
  document.body.classList.toggle("dark-mode");
  localStorage.setItem("theme", document.body.classList.contains("dark-mode") ? "dark" : "light");
});

// On load: apply saved theme
window.addEventListener("DOMContentLoaded", () => {
  const savedTheme = localStorage.getItem("theme");
  if (savedTheme === "dark") {
    document.body.classList.add("dark-mode");
  }
  // Wire clear history button
  const clearBtn = document.getElementById("clear-history-btn");
  if (clearBtn) {
    clearBtn.onclick = function() {
      console.log("Clear history button clicked");
      clearCurrentChatHistory();
    };
  }
});

function clearCurrentChat() {
  if (!selectedChatId) {
    alert("Please select a chat first using the pen icon.");
    return;
  }

  const chatList = document.getElementById("chat-list");
  const chatItems = chatList.querySelectorAll(".chat-item");

  // Find and remove selected chat
  for (let i = 0; i < chatItems.length; i++) {
    if (chatItems[i].dataset.id === selectedChatId) {
      chatItems[i].remove();

      // Automatically select the next chat (if any)
      if (chatItems[i + 1]) {
        const nextChatId = chatItems[i + 1].dataset.id;
        openChat(nextChatId);
      } else if (chatItems[0]) {
        const firstChatId = chatItems[0].dataset.id;
        openChat(firstChatId);
      } else {
        console.log("No chats left.");
      }

      selectedChatId = null;
      break;
    }
  }
}

function openChat(chatId) {
  console.log(`Opening chat: ${chatId}`);
  const chat = allChats.find(c => c.id === chatId);
  if (!chat) return;
  currentChatId = chatId;
  chatHistory = chat.history;
  renderChatMessages(chatHistory);
  scrollToBottom(); // Always scroll to bottom when opening a chat
}

function selectChatForDeletion(chatId) {
  selectedChatId = chatId;
  document.querySelectorAll('.chat-item').forEach(item => item.classList.remove('selected'));
  document.querySelector(`[data-id="${chatId}"]`).classList.add('selected');
}

function clearCurrentChatHistory() {
  if (!allChats.length) {
    alert("No chats to delete.");
    return;
  }
  if (!confirm("Are you sure you want to delete ALL chats and history? This cannot be undone.")) return;
  allChats = [];
  chatHistory = [];
  currentChatId = null;
  renderChatList();
  renderChatMessages([]);
  localStorage.removeItem("allChats");
  localStorage.removeItem("currentChatId");
}

function getSummaryTitle(text) {
  // Lowercase and remove punctuation
  let clean = text.toLowerCase().replace(/[.,!?]/g, "");
  // Common patterns for AI/chatbot requests
  if (clean.includes("ai chatbot")) return "Own AI Chatbot";
  if (clean.includes("ai") && clean.includes("create")) return "Create AI Project";
  if (clean.includes("chatbot")) return "Chatbot Help";
  if (clean.includes("python")) return "Python Help";
  if (clean.includes("quiz")) return "Quiz";
  // Use first 3-5 words as fallback
  let words = clean.split(" ").filter(Boolean);
  let title = words.slice(0, 5).join(" ");
  // Capitalize first letter
  return title.charAt(0).toUpperCase() + title.slice(1);
}

// === 🖼️ IMAGE UPLOAD FROM BUTTON ===
document.getElementById("upload-btn").addEventListener("click", () => {
  document.getElementById("file-input").click();
});

document.getElementById("file-input").addEventListener("change", (e) => {
  const files = Array.from(e.target.files);
  files.forEach(file => {
    if (!file.type.startsWith("image")) return;
    if (uploadedImages.length >= 5) {
      alert("⚠️ Only 5 images allowed per chat.");
      return;
    }
    uploadedImages.push(file);
    const reader = new FileReader();
    reader.onload = () => {
      const imgHTML = `<img src="${reader.result}" style="max-width: 100%; border-radius: 10px;" />`;
      appendMessage("user", imgHTML, new Date().toLocaleTimeString());
      // Run object detection
      const form = new FormData();
      form.append("image", file);
      fetch('/detect', { method: 'POST', body: form })
        .then(res => res.json())
        .then(data => {
          const labels = data.map(d => `${d.label} (${(d.confidence * 100).toFixed(1)}%)`).join(', ');
          appendMessage("bot", `🔍 Detected: ${labels}`, new Date().toLocaleTimeString());
        });
      // Run OCR
      fetch('/ocr-js', {
        method: 'POST',
        body: (() => {
          const f = new FormData();
          f.append('images', file);
          return f;
        })()
      })
        .then(res => res.json())
        .then(data => {
          const text = data[0]?.text || "No text found.";
          appendMessage("bot", `📝 OCR Result: ${text}`, new Date().toLocaleTimeString());
        });
    };
    reader.readAsDataURL(file);
  });
  e.target.value = ""; // reset input
});

// === ChatGPT-style Image Upload Zone ===
const uploadZone = document.getElementById('uploadZone');
const imageInput = document.getElementById('imageInput');
const imagePreview = document.getElementById('imagePreview');

// Handle file selection
imageInput.addEventListener('change', handleImageUpload);

// Drag-and-drop events
uploadZone.addEventListener('dragover', (e) => {
  e.preventDefault();
  uploadZone.classList.add('dragover');
});

uploadZone.addEventListener('dragleave', () => {
  uploadZone.classList.remove('dragover');
});

uploadZone.addEventListener('drop', (e) => {
  e.preventDefault();
  uploadZone.classList.remove('dragover');
  const file = e.dataTransfer.files[0];
  if (file && file.type.startsWith('image/')) {
    previewImage(file);
  } else {
    alert('Only image files are allowed.');
  }
});

// Preview selected image
function handleImageUpload(event) {
  const file = event.target.files[0];
  if (file && file.type.startsWith('image/')) {
    previewImage(file);
  } else {
    alert('Only image files are allowed.');
  }
}

function previewImage(file) {
  const reader = new FileReader();
  reader.onload = () => {
    imagePreview.innerHTML = `<img src="${reader.result}" alt="Uploaded Image" />`;
  };
  reader.readAsDataURL(file);
}
