document.getElementById("send").onclick = async () => {
  const userInput = document.getElementById("user-input").value;
  if (!userInput) return;

  addMessage("You", userInput);
  document.getElementById("user-input").value = "";

  const response = await fetch("http://localhost:3000/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message: userInput })
  });

  const data = await response.json();
  addMessage("Bot", data.reply);
};

function addMessage(sender, message) {
  const chatbox = document.getElementById("chatbox");
  chatbox.innerHTML += `<p><strong>${sender}:</strong> ${message}</p>`;
  chatbox.scrollTop = chatbox.scrollHeight;
}
