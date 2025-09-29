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
let userHasToggledSidebar = false; // Track user interaction

// Responsive sidebar: always open on desktop, closed by default on mobile
function handleResize() {
  const sidebar = document.querySelector('.sidebar');
  if (!sidebar) return;

  // If user has manually toggled, respect their choice
  if (userHasToggledSidebar) {
    return;
  }

  if (window.innerWidth > 768) {
    sidebar.classList.remove('collapsed');
  } else {
    sidebar.classList.add('collapsed');
  }
}
window.addEventListener('resize', handleResize);

// Consolidated DOMContentLoaded listener
window.addEventListener('DOMContentLoaded', () => {
    initialize();
});

function initialize() {
    // Load theme
    const savedTheme = localStorage.getItem("theme");
    if (savedTheme === "dark") {
        document.body.classList.add("dark-mode");
    }

    // Setup sidebar
    handleResize();
    const sidebarToggleBtn = document.getElementById('sidebarToggle');
    if (sidebarToggleBtn) sidebarToggleBtn.addEventListener('click', toggleSidebar);

    // Load chats
    allChats = JSON.parse(localStorage.getItem("allChats")) || [];
    currentChatId = localStorage.getItem("currentChatId");

    if (!allChats.length) startNewChat();
    else openChat(currentChatId || allChats[0].id);
}

function startNewChat() {
  currentChatId = Date.now().toString();
  chatHistory = [];
  uploadedImages = []; // Clear uploaded images for the new chat
  allChats.unshift({ id: currentChatId, title: "New Chat", history: [] });
  renderChatList();
  renderChatMessages([]);
}

function renderChatList() {
  renderFilteredChatList(allChats.filter(chat => !chat.archived));
}

function renderFilteredChatList(chats, searchTerm = '') {
  const chatList = document.getElementById("chat-list");
  chatList.innerHTML = '';
  
  chats.forEach(chat => {
    const li = document.createElement("li");
    li.className = "chat-item";
    li.onclick = () => openChat(chat.id);
    li.style.position = "relative";

    // Chat name in a span with highlighting if searching
    const titleSpan = document.createElement("span");
    titleSpan.className = "chat-item-title";
    
    if (searchTerm) {
      // Highlight search term in chat title
      const title = chat.title;
      const lowerTitle = title.toLowerCase();
      const lowerSearchTerm = searchTerm.toLowerCase();
      const index = lowerTitle.indexOf(lowerSearchTerm);
      
      if (index !== -1) {
        const beforeMatch = title.substring(0, index);
        const match = title.substring(index, index + searchTerm.length);
        const afterMatch = title.substring(index + searchTerm.length);
        
        titleSpan.innerHTML = `${beforeMatch}<span class="search-highlight">${match}</span>${afterMatch}`;
      } else {
        titleSpan.textContent = title;
      }
    } else {
      titleSpan.textContent = chat.title;
    }
    
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
    { label: "Archive", action: () => archiveChat(chatId) },
    { label: "Clear Chat", action: () => clearSpecificChat(chatId) } // Added as 5th option
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

function clearSpecificChat(chatId) {
  if (!chatId) {
    alert("No chat specified to clear.");
    return;
  }

  if (confirm("Are you sure you want to clear all messages in this chat? This cannot be undone.")) {
    const chat = allChats.find(c => c.id === chatId);
    if (chat) {
      chat.history = [];
      localStorage.setItem("allChats", JSON.stringify(allChats));
      // If the cleared chat is the currently open one, update the view
      if (chatId === currentChatId) {
        chatHistory = [];
        renderChatMessages([]);
      }
    }
  }
}

function deleteChat(chatId) {
  const modal = document.getElementById('confirmation-modal');
  const confirmBtn = document.getElementById('modal-confirm-btn');
  const cancelBtn = document.getElementById('modal-cancel-btn');

  const handleConfirm = () => {
    try {
      const idx = allChats.findIndex(c => c.id === chatId);
      if (idx !== -1) {
        allChats.splice(idx, 1);
        if (currentChatId === chatId) {
          if (allChats.length > 0) {
            openChat(allChats[0].id);
          } else {
            startNewChat();
          }
        }
        renderChatList();
        localStorage.setItem("allChats", JSON.stringify(allChats));
        localStorage.setItem("currentChatId", currentChatId);
      }
    } finally {
      closeModal();
    }
  };

  const closeModal = () => {
    modal.style.display = 'none';
    confirmBtn.removeEventListener('click', handleConfirm);
    cancelBtn.removeEventListener('click', closeModal);
  };

  modal.style.display = 'flex';
  confirmBtn.addEventListener('click', handleConfirm);
  cancelBtn.addEventListener('click', closeModal);
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

function toggleSearchSection() {
  const searchSection = document.getElementById('search-section');
  if (searchSection.style.display === 'none') {
    searchSection.style.display = 'flex';
    document.getElementById('search-input').focus();
  } else {
    searchSection.style.display = 'none';
    document.getElementById('search-input').value = ''; // Clear input on close
    renderChatList(); // Restore the full chat list
  }
}

// Enhanced search functionality
let searchResults = [];
let currentSearchIndex = -1;
let currentSearchTerm = '';

function searchChats() {
  const searchTerm = document.getElementById('search-input').value.toLowerCase().trim();
  
  if (!searchTerm) {
    // If search is cleared, show all chats
    renderChatList();
    return;
  }
  
  // Filter chats by title/name
  const filteredChats = allChats.filter(chat => 
    !chat.archived && chat.title.toLowerCase().includes(searchTerm)
  );
  
  // Render filtered chat list
  renderFilteredChatList(filteredChats, searchTerm);
}



function highlightSearchResults() {
  searchResults.forEach((result, index) => {
    const element = result.element;
    let html = element.innerHTML;
    
    // Create a temporary div to work with text content
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = html;
    const textContent = tempDiv.textContent || tempDiv.innerText;
    
    // Find and replace the search term
    const regex = new RegExp(`(${escapeRegex(currentSearchTerm)})`, 'gi');
    const newTextContent = textContent.replace(regex, (match, term) => {
      const highlightClass = index === currentSearchIndex ? 'search-highlight current' : 'search-highlight';
      return `<span class="${highlightClass}" data-search-index="${index}">${term}</span>`;
    });
    
    // Replace the text content while preserving other HTML elements
    element.innerHTML = element.innerHTML.replace(textContent, newTextContent);
  });
}

function clearHighlights() {
  const highlights = document.querySelectorAll('.search-highlight');
  highlights.forEach(highlight => {
    const parent = highlight.parentNode;
    parent.replaceChild(document.createTextNode(highlight.textContent), highlight);
    parent.normalize();
  });
}

function searchNext() {
  if (searchResults.length === 0) return;
  
  currentSearchIndex = (currentSearchIndex + 1) % searchResults.length;
  scrollToSearchResult(currentSearchIndex);
  updateHighlightClasses();
}

function searchPrevious() {
  if (searchResults.length === 0) return;
  
  currentSearchIndex = currentSearchIndex <= 0 ? searchResults.length - 1 : currentSearchIndex - 1;
  scrollToSearchResult(currentSearchIndex);
  updateHighlightClasses();
}

function scrollToSearchResult(index) {
  if (index < 0 || index >= searchResults.length) return;
  
  const result = searchResults[index];
  const element = result.element;
  
  // Scroll the element into view
  element.scrollIntoView({
    behavior: 'smooth',
    block: 'center',
    inline: 'nearest'
  });
  
  updateSearchCounter();
}

function updateHighlightClasses() {
  // Remove current class from all highlights
  document.querySelectorAll('.search-highlight.current').forEach(el => {
    el.classList.remove('current');
  });
  
  // Add current class to the active highlight
  const highlights = document.querySelectorAll('.search-highlight');
  if (highlights[currentSearchIndex]) {
    highlights[currentSearchIndex].classList.add('current');
  }
}

function updateSearchCounter() {
  const counter = document.getElementById('search-counter');
  if (searchResults.length === 0) {
    counter.textContent = currentSearchTerm ? 'No matches' : '0 of 0';
  } else {
    counter.textContent = `${currentSearchIndex + 1} of ${searchResults.length}`;
  }
}

function updateNavigationButtons() {
  const prevBtn = document.getElementById('search-prev');
  const nextBtn = document.getElementById('search-next');
  
  const hasResults = searchResults.length > 0;
  prevBtn.disabled = !hasResults;
  nextBtn.disabled = !hasResults;
}

function clearSearch() {
  const searchInput = document.getElementById('search-input');
  const searchSection = document.getElementById('search-section');
  
  if (searchInput) {
    searchInput.value = '';
  }
  
  // Hide search bar and show all chats again
  if (searchSection) {
    searchSection.style.display = 'none';
  }
  
  renderChatList();
}

function escapeRegex(string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// Add real-time search as user types for chat names
document.addEventListener('DOMContentLoaded', () => {
  const searchInput = document.getElementById('search-input');
  if (searchInput) {
    let searchTimeout;
    searchInput.addEventListener('input', () => {
      clearTimeout(searchTimeout);
      searchTimeout = setTimeout(() => {
        searchChats();
      }, 200); // Debounce search for chat names
    });
    
    // Handle Escape key to close search
    searchInput.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        clearSearch();
      }
    });
  }
  
  // Close search bar when clicking outside of it
  document.addEventListener('click', (e) => {
    const searchSection = document.getElementById('search-section');
    const searchButton = document.querySelector('.sidebar-btn[onclick*="toggleSearchSection"]');
    
    // Check if search bar is visible
    if (searchSection && searchSection.style.display !== 'none') {
      // Check if click is outside search bar and not on search button
      if (!searchSection.contains(e.target) && !searchButton?.contains(e.target)) {
        clearSearch();
      }
    }
  });
});

function scrollToBottom() {
  const chat = document.getElementById("chat-messages");
  if (chat) {
    chat.scrollTop = chat.scrollHeight;
  }
}

function scrollToBottom() {
  const chat = document.getElementById("chat-messages");
  if (chat) {
    chat.scrollTop = chat.scrollHeight;
  }
}

function openChat(chatId) {
  console.log(`Opening chat: ${chatId}`);
  const chat = allChats.find(c => c.id === chatId);
  if (!chat) return;
  currentChatId = chatId;
  chatHistory = chat.history;
  renderChatMessages(chatHistory);
  renderChatList(); // Re-render to highlight the active chat
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

  // --- Smart title generation logic ---
  const currentChat = allChats.find(c => c.id === currentChatId);
  
  // Check if message is just a greeting
  const greetingWords = ['hi', 'hello', 'hey', 'greetings', 'good morning', 'good afternoon', 'good evening', 'hola', 'hallo', 'bonjour', 'ciao'];
  const isGreeting = greetingWords.some(greeting => 
    input.toLowerCase().trim() === greeting || 
    input.toLowerCase().trim().startsWith(greeting + ' ') ||
    input.toLowerCase().trim().startsWith(greeting + ',') ||
    input.toLowerCase().trim().startsWith(greeting + '!')
  );
  
  // Check if current title is generic (should be replaced)
  const genericTitles = ['new chat', 'hi', 'hello', 'hey', 'greetings', 'hi, how are you', 'hello there', 'hey there', 'initial greeting exchange'];
  const hasGenericTitle = !currentChat || currentChat.title === "New Chat" || 
    genericTitles.some(generic => currentChat.title.toLowerCase().includes(generic.toLowerCase()));
  
  // Simple logic: Generate title if it's a "New Chat" and the message isn't just a greeting
  // OR if it has a generic title and this message has more content
  const shouldGenerateTitle = currentChat && (
    (currentChat.title === "New Chat" && !isGreeting && input.length > 3) ||
    (hasGenericTitle && !isGreeting && input.length > 5)
  );
  

  // ---

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
      const res = await fetch('http://localhost:3000/ocr', { method: 'POST', body: form });

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      botTyping.remove();
      appendMessage("bot", `📝 Here's your converted PDF: <a href="${url}" target="_blank">Download PDF</a>`, timestamp);
      uploadedImages = [];
    } else {

      // Convert uploaded images to base64 for sending to chat
      const imageData = uploadedImages.length > 0 ? 
        await Promise.all(uploadedImages.map(file => {
          return new Promise((resolve) => {
            const reader = new FileReader();
            reader.onload = () => resolve({
              data: reader.result,
              type: file.type,
              name: file.name
            });
            reader.readAsDataURL(file);
          });
        })) : [];

      const response = await fetch("http://localhost:3000/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: input,
          sessionId,
          history: chatHistory.map(item => ({ sender: item.sender, text: item.text })),
          generateTitle: shouldGenerateTitle,
          images: imageData
        }),
        signal: controller.signal
      });

      let data;
      try {
        data = await response.json(); // data can contain { reply, title }
      } catch (jsonErr) {
        botTyping.remove();
        appendMessage("bot", "❌ Server returned invalid response.", timestamp);
        return;
      }
      botTyping.remove();
      appendMessage("bot", data.reply || "⚠️ No response from server", timestamp, true, data.title);
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

function appendMessage(sender, text, timestamp = '', save = true, newTitle = null) {
  const chat = document.getElementById("chat-messages");
  const msg = document.createElement("div");
  msg.className = `chat-message ${sender}`;
  const bubble = document.createElement("div");
  bubble.className = "bubble";
  bubble.innerHTML = `${formatMessage(text)}
    <div style="display: flex; justify-content: flex-end; gap: 4px;">
      ${sender === "bot" ? `<button class="icon-symbol-btn" onclick="speakText(\`${text.replace(/`/g, "\\`")}\`, this)" title="Click to speak / Click again to stop">🗣️</button>` : ""}
      ${timestamp ? `<span class="timestamp">${timestamp}</span>` : ""}
    </div>`;
  msg.appendChild(bubble);
  chat.appendChild(msg);

  if (save) {
    const current = allChats.find(c => c.id === currentChatId);
    if (current) {
      current.history.push({ sender, text, timestamp });
      if (newTitle) {
        current.title = newTitle;
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
  // Detect if it's an image tag or data:image
  if (text.startsWith("<img") || text.startsWith("data:image")) {
    return text; // return raw image HTML (no escaping)
  }

  // Escape HTML for text messages
  const escaped = text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

  // Extract code blocks and replace with placeholders
  let codeBlocks = [];
  let replaced = escaped.replace(/```(\w*)\n([\s\S]*?)```/g, (_, lang, code) => {
    const id = Math.random().toString(36).substring(2, 8);
    codeBlocks.push({ id, lang, code });
    return `__CODEBLOCK_${id}__`;
  });

  // Replace inline code
  replaced = replaced.replace(/`([^`\n]+)`/g, (_, inline) => `<code class="inline-code">${inline}</code>`);

  // Replace newlines with <br> (for non-code)
  replaced = replaced.replace(/\n/g, "<br>");

  // Restore code blocks (multi-line, no <br>)
  codeBlocks.forEach(({ id, lang, code }) => {
    replaced = replaced.replace(
      `__CODEBLOCK_${id}__`,
      `<div class="code-container">
        <button class="copy-btn" onclick="copyCode('${id}')">📋</button>
        <pre><code id="${id}" class="language-${lang || "plaintext"}">${code.trim()}</code></pre>
      </div>`
    );
  });

  return replaced;
}

function handleImageFile(file) {
  if (!file || !file.type.startsWith("image")) {
    alert("Invalid file type. Please upload an image.");
    return;
  }
  if (uploadedImages.length >= 5) {
    alert("⚠️ Only 5 images allowed per chat.");
    return;
  }

  uploadedImages.push(file);

  // Create image preview using FileReader for better compatibility
  const reader = new FileReader();
  reader.onload = () => {
    const imgHTML = `<img src="${reader.result}" style="max-width: 100%; border-radius: 10px; display: block; margin: 5px 0;" alt="Uploaded Image" />`;
    appendMessage("user", imgHTML, new Date().toLocaleTimeString());

    // Run object detection
    const formData = new FormData();
    formData.append("image", file);
    
    fetch('http://localhost:3000/detect', { method: 'POST', body: formData })
      .then(res => {
        console.log('🔍 Detection response status:', res.status);
        if (!res.ok) {
          throw new Error(`HTTP ${res.status}`);
        }
        return res.json();
      })
      .then(data => {
        console.log('🔍 Detection response data:', data);
        if (Array.isArray(data) && data.length > 0) {
          const labels = data.map(d => `${d.label} (${(d.confidence * 100).toFixed(1)}%)`).join(', ');
          appendMessage("bot", `🔍 Image Analysis - Objects Detected: ${labels}`, new Date().toLocaleTimeString());
        } else {
          console.warn('🔍 Empty detection array received');
          appendMessage("bot", `🔍 Image Analysis - Object Detection: No specific objects identified`, new Date().toLocaleTimeString());
        }
      })
      .catch(err => {
        console.error("🔍 Object detection failed:", err);
        appendMessage("bot", `🔍 Object detection: Service unavailable - ${err.message}`, new Date().toLocaleTimeString());
      });

    // Run OCR
    const ocrFormData = new FormData();
    ocrFormData.append('image', file);
    
    fetch('http://localhost:3000/ocr-js', {
      method: 'POST',
      body: ocrFormData
    })
      .then(res => {
        if (!res.ok) {
          return res.json().then(errorData => {
            throw new Error(errorData.error || `HTTP ${res.status}`);
          });
        }
        return res.json();
      })
      .then(data => {
        const text = data.text || "No text found.";
        let displayText;
        
        if (text.length === 0 || text === "No text found.") {
          displayText = "No readable text detected in image";
        } else if (text.length < 5) {
          displayText = `Minimal text found: "${text}"`;
        } else if (text.length > 500) {
          displayText = text.substring(0, 500) + "...";
        } else {
          displayText = text;
        }
        
        appendMessage("bot", `📝 Image Analysis - Text Content: ${displayText}`, new Date().toLocaleTimeString());
      })
      .catch(err => {
        console.error("OCR failed:", err);
        appendMessage("bot", `📝 OCR Result: ❌ OCR failed - ${err.message}`, new Date().toLocaleTimeString());
      });
  };

  reader.onerror = () => {
    appendMessage("bot", "❌ Failed to load image preview.", new Date().toLocaleTimeString());
  };

  // Read the file as data URL (base64)
  reader.readAsDataURL(file);
}

function copyCode(id) {
  const code = document.getElementById(id);
  navigator.clipboard
    .writeText(code.innerText)
    .then(() => alert("✅ Code copied!"));
}

// Global variable to track current speaking state
let currentSpeakingButton = null;
let isSpeaking = false;

function speakText(text, buttonElement) {
  // If already speaking, stop the speech
  if (isSpeaking && speechSynthesis.speaking) {
    speechSynthesis.cancel();
    isSpeaking = false;
    
    // Reset all speak buttons to normal state
    document.querySelectorAll('.icon-symbol-btn').forEach(btn => {
      btn.innerHTML = '🗣️';
      btn.style.backgroundColor = '';
      btn.style.color = '';
    });
    
    currentSpeakingButton = null;
    return;
  }
  
  // Clean the text for better speech synthesis
  const cleanText = text
    .replace(/[*_`]/g, '') // Remove markdown
    .replace(/```[\s\S]*?```/g, '') // Remove code blocks
    .replace(/`[^`]*`/g, '') // Remove inline code
    .replace(/<[^>]*>/g, '') // Remove HTML tags
    .replace(/\n+/g, '. ') // Replace newlines with pauses
    .replace(/\s+/g, ' ') // Normalize whitespace
    .trim();
  
  if (!cleanText) {
    alert('No text to speak');
    return;
  }
  
  // Start speaking
  const utterance = new SpeechSynthesisUtterance(cleanText);
  utterance.lang = 'en-US';
  utterance.rate = 0.9;
  utterance.pitch = 1;
  utterance.volume = 0.8;
  
  // Update button state to show it's speaking
  if (buttonElement) {
    // Reset all other buttons first
    document.querySelectorAll('.icon-symbol-btn').forEach(btn => {
      btn.innerHTML = '🗣️';
      btn.style.backgroundColor = '';
      btn.style.color = '';
    });
    
    // Set current button as active
    buttonElement.innerHTML = '⏸️'; // Pause icon
    buttonElement.style.backgroundColor = '#e74c3c';
    buttonElement.style.color = 'white';
    currentSpeakingButton = buttonElement;
  }
  
  isSpeaking = true;
  
  // Handle speech end
  utterance.onend = () => {
    isSpeaking = false;
    if (currentSpeakingButton) {
      currentSpeakingButton.innerHTML = '🗣️';
      currentSpeakingButton.style.backgroundColor = '';
      currentSpeakingButton.style.color = '';
      currentSpeakingButton = null;
    }
  };
  
  // Handle speech error
  utterance.onerror = () => {
    isSpeaking = false;
    if (currentSpeakingButton) {
      currentSpeakingButton.innerHTML = '🗣️';
      currentSpeakingButton.style.backgroundColor = '';
      currentSpeakingButton.style.color = '';
      currentSpeakingButton = null;
    }
  };
  
  speechSynthesis.speak(utterance);
}

// === 🖼️ IMAGE UPLOAD FROM CLIPBOARD ===
document.getElementById("user-input").addEventListener("paste", e => {
  const items = e.clipboardData.items;
  let count = 0;

  for (const item of items) {
    if (item.type.startsWith("image")) {
      const file = item.getAsFile();
      handleImageFile(file);
    }
  }
});

// === 🎤 SPEECH TO TEXT ===
const recognition = new (window.SpeechRecognition || window.webkitSpeechRecognition)();
const micButton = document.getElementById("mic-button");
if (recognition) {
    recognition.lang = 'en-US';
    recognition.interimResults = false;
}

micButton?.addEventListener("click", () => {
  recognition.start();
});

recognition.onresult = (event) => {
  inputBox.value = event.results[0][0].transcript;
  micIcon.src = "assets/mic-icon.png";
};

recognition.onend = () => {
};
document.getElementById("dark-toggle").addEventListener("click", () => {
  document.body.classList.toggle("dark-mode");
  localStorage.setItem("theme", document.body.classList.contains("dark-mode") ? "dark" : "light");
});

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

// === 🖼️ IMAGE UPLOAD FROM BUTTON ===
document.getElementById("upload-btn").addEventListener("click", () => {
  document.getElementById("file-input").click();
});

document.getElementById("file-input").addEventListener("change", (e) => {
  const files = Array.from(e.target.files);
  files.forEach(file => {
    handleImageFile(file);
  });
  e.target.value = ""; // reset input
});

// === ChatGPT-style Image Upload Zone ===
const uploadZone = document.getElementById('uploadZone');
const imageInput = document.getElementById('imageInput');
const imagePreview = document.getElementById('imagePreview');

// Handle file selection (only if imageInput exists)
if (imageInput) {
  imageInput.addEventListener('change', handleImageUpload);
}

// Drag-and-drop events (only if uploadZone exists)
if (uploadZone) {
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
}

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

// Sidebar toggle for button
function toggleSidebar() {
  const sidebar = document.querySelector('.sidebar');
  userHasToggledSidebar = true; // User has taken control
  if (sidebar) {
    sidebar.classList.toggle('collapsed');
    // Update the toggle button icon rotation
    const toggleBtn = document.getElementById('sidebarToggle');
    if (toggleBtn) {
      toggleBtn.classList.toggle('rotate');
    }
  } else {
    console.error('Sidebar not found!');
  }
}

// Make function available globally
window.toggleSidebar = toggleSidebar;

// Close sidebar function (for overlay clicks)
window.closeSidebar = function() {
  const sidebar = document.querySelector('.sidebar');
  sidebar.classList.add('collapsed');
  
  // Remove rotation from toggle button
  const toggleBtn = document.getElementById('sidebarToggle');
  if (toggleBtn) {
    toggleBtn.classList.remove('rotate');
  }
};
