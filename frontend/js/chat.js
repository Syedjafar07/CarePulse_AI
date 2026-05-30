let chatHistory = [];
let isRecording = false;
let recognition = null;

document.addEventListener("DOMContentLoaded", () => {
  requireAuth();
  setupSpeechRecognition();
});

async function sendMessage() {
  const input = document.getElementById("chat-input");
  const message = input.value.trim();
  if (!message) return;
  input.value = "";
  appendMessage("user", message);
  chatHistory.push({ role: "user", content: message });
  showTyping();
  const { ok, data } = await apiCall("/ai/chat", "POST", {
    message,
    history: chatHistory.slice(-6)
  });
  hideTyping();
  if (ok) {
    appendMessage("ai", data.response);
    chatHistory.push({ role: "model", content: data.response });
  } else {
    appendMessage("ai", "Sorry, I'm having trouble connecting. Please try again.");
  }
}

function sendQuickPrompt(text) {
  document.getElementById("chat-input").value = text;
  sendMessage();
}

function appendMessage(role, text) {
  const container = document.getElementById("chat-messages");
  const now = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  const isUser = role === "user";
  const div = document.createElement("div");
  div.className = `chat-msg ${role}`;
  div.innerHTML = `
    <div class="msg-avatar">${isUser ? "U" : "AI"}</div>
    <div>
      <div class="msg-bubble">${text.replace(/\n/g, "<br>")}</div>
      <div class="msg-time">${now}</div>
    </div>
  `;
  container.appendChild(div);
  container.scrollTop = container.scrollHeight;
}

function showTyping() {
  const container = document.getElementById("chat-messages");
  const div = document.createElement("div");
  div.className = "chat-msg ai"; div.id = "typing-indicator";
  div.innerHTML = `
    <div class="msg-avatar">🤖</div>
    <div class="msg-bubble" style="background:var(--white);">
      <div class="typing-dots">
        <div class="dot"></div><div class="dot"></div><div class="dot"></div>
      </div>
    </div>`;
  container.appendChild(div);
  container.scrollTop = container.scrollHeight;
}

function hideTyping() {
  document.getElementById("typing-indicator")?.remove();
}

function clearChat() {
  chatHistory = [];
  const container = document.getElementById("chat-messages");
  container.innerHTML = `
    <div class="chat-msg ai">
      <div class="msg-avatar">🤖</div>
      <div>
        <div class="msg-bubble">
          Chat cleared! How can I help you today? Describe your symptoms or ask a health question.
        </div>
        <div class="msg-time">Just now</div>
      </div>
    </div>`;
}

function setupSpeechRecognition() {
  if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) return;
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  recognition = new SR();
  recognition.continuous = false;
  recognition.interimResults = false;
  recognition.lang = "en-IN";
  recognition.onresult = (e) => {
    const text = e.results[0][0].transcript;
    document.getElementById("chat-input").value = text;
    stopVoice();
    sendMessage();
  };
  recognition.onerror = () => { stopVoice(); showToast("Voice input failed", "error"); };
  recognition.onend = () => stopVoice();
}

function toggleVoice() {
  if (isRecording) { stopVoice(); return; }
  if (!recognition) { showToast("Voice not supported in this browser", "error"); return; }
  isRecording = true;
  document.getElementById("voice-btn").classList.add("recording");
  document.getElementById("voice-btn").textContent = "🔴";
  recognition.start();
  showToast("Listening... Speak now", "info");
}

function stopVoice() {
  isRecording = false;
  const btn = document.getElementById("voice-btn");
  btn.classList.remove("recording");
  btn.textContent = "🎙️";
  try { recognition?.stop(); } catch {}
}