// ── Voice recognition ─────────────────────────────────────────────────────────
let voiceRecognition = null;
let voiceIsListening = false;
let voiceShouldKeepListening = false;
let voiceBaseText = "";
let voiceFinalText = "";
let activeSpeechButton = null;
let activeSpeechUtterance = null;

const originalRenderChatShell = window.renderChatShell;
if (typeof originalRenderChatShell === "function") {
  window.renderChatShell = function patchedRenderChatShell(...args) {
    const result = originalRenderChatShell.apply(this, args);
    setupVoiceInput();
    return result;
  };
}

function getSpeechRecognition() {
  return window.SpeechRecognition || window.webkitSpeechRecognition || null;
}

function cleanSpeechText(text) {
  return String(text || "")
    .replace(/\{src:\[[^\]]+\]\}/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function pickChineseVoice() {
  const voices = window.speechSynthesis?.getVoices?.() || [];
  return (
    voices.find((voice) => voice.lang === "zh-TW") ||
    voices.find((voice) => voice.lang?.startsWith("zh")) ||
    null
  );
}

function setSpeechButtonState(button, isSpeaking) {
  if (!button) return;

  button.classList.toggle("speaking", isSpeaking);
  button.innerHTML = isSpeaking
    ? `<i class="bi bi-stop-fill" aria-hidden="true"></i><span>停止朗讀</span>`
    : `<i class="bi bi-volume-up-fill" aria-hidden="true"></i><span>朗讀</span>`;
  button.title = isSpeaking ? "停止朗讀" : "朗讀 AI 回答";
  button.setAttribute("aria-label", button.title);
}

function stopAiSpeech() {
  window.speechSynthesis?.cancel();
  setSpeechButtonState(activeSpeechButton, false);
  activeSpeechButton = null;
  activeSpeechUtterance = null;
}

function createAiSpeechButton(content) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "speech-btn";
  setSpeechButtonState(button, false);

  if (!("speechSynthesis" in window) || !("SpeechSynthesisUtterance" in window)) {
    button.disabled = true;
    button.title = "此瀏覽器不支援語音朗讀";
    return button;
  }

  button.addEventListener("click", () => {
    if (activeSpeechButton === button) {
      stopAiSpeech();
      return;
    }

    const speechText = cleanSpeechText(content);
    if (!speechText) return;

    stopAiSpeech();

    const utterance = new SpeechSynthesisUtterance(speechText);
    utterance.lang = "zh-TW";
    utterance.rate = 1;
    utterance.pitch = 1;
    utterance.voice = pickChineseVoice();
    utterance.onend = () => {
      if (activeSpeechUtterance === utterance) stopAiSpeech();
    };
    utterance.onerror = () => {
      if (activeSpeechUtterance === utterance) stopAiSpeech();
    };

    activeSpeechButton = button;
    activeSpeechUtterance = utterance;
    setSpeechButtonState(button, true);
    window.speechSynthesis.speak(utterance);
  });

  return button;
}

function setupVoiceInput() {
  const input = document.getElementById("userInput");
  const sendBtn = document.getElementById("sendBtn");
  const wrapper = input?.closest(".input-wrapper");
  if (!input || !sendBtn || !wrapper || document.getElementById("voiceBtn")) {
    return;
  }

  const voiceBtn = document.createElement("button");
  voiceBtn.type = "button";
  voiceBtn.id = "voiceBtn";
  voiceBtn.className = "voice-btn";
  voiceBtn.title = "語音輸入";
  voiceBtn.setAttribute("aria-label", "語音輸入");
  voiceBtn.innerHTML = `<i class="bi bi-mic-fill" aria-hidden="true"></i>`;

  if (!getSpeechRecognition()) {
    voiceBtn.disabled = true;
    voiceBtn.title = "此瀏覽器不支援語音辨識";
  } else {
    voiceBtn.addEventListener("click", toggleVoiceRecognition);
  }

  wrapper.insertBefore(voiceBtn, sendBtn);
}

function setVoiceListeningState(isListening) {
  voiceIsListening = isListening;

  const voiceBtn = document.getElementById("voiceBtn");
  const wrapper = document.getElementById("userInput")?.closest(".input-wrapper");
  if (!voiceBtn || !wrapper) return;

  voiceBtn.classList.toggle("listening", isListening);
  wrapper.classList.toggle("listening", isListening);
  voiceBtn.innerHTML = isListening
    ? `<i class="bi bi-stop-fill" aria-hidden="true"></i>`
    : `<i class="bi bi-mic-fill" aria-hidden="true"></i>`;
  voiceBtn.title = isListening ? "停止語音輸入" : "語音輸入";
  voiceBtn.setAttribute(
    "aria-label",
    isListening ? "停止語音輸入" : "語音輸入",
  );
}

function toggleVoiceRecognition() {
  const SpeechRecognition = getSpeechRecognition();
  const input = document.getElementById("userInput");
  if (!SpeechRecognition || !input) return;

  if (voiceIsListening) {
    voiceShouldKeepListening = false;
    voiceRecognition?.stop();
    return;
  }

  voiceShouldKeepListening = true;
  voiceBaseText = input.value.trim();
  voiceFinalText = "";
  startVoiceRecognition(SpeechRecognition, input);
}

function startVoiceRecognition(SpeechRecognition, input) {
  voiceRecognition = new SpeechRecognition();
  voiceRecognition.lang = "zh-TW";
  voiceRecognition.interimResults = true;
  voiceRecognition.continuous = true;

  voiceRecognition.onstart = () => setVoiceListeningState(true);

  voiceRecognition.onresult = (event) => {
    let interimTranscript = "";

    for (let i = event.resultIndex; i < event.results.length; i += 1) {
      const transcript = event.results[i][0].transcript.trim();
      if (event.results[i].isFinal) {
        voiceFinalText = [voiceFinalText, transcript].filter(Boolean).join(" ");
      } else {
        interimTranscript = [interimTranscript, transcript]
          .filter(Boolean)
          .join(" ");
      }
    }

    input.value = [voiceBaseText, voiceFinalText, interimTranscript]
      .filter(Boolean)
      .join(" ");
    autoResize(input);
  };

  voiceRecognition.onerror = (event) => {
    if (event.error === "not-allowed" || event.error === "service-not-allowed") {
      voiceShouldKeepListening = false;
      setVoiceListeningState(false);
      addMessage("ai", "⚠️ 請允許瀏覽器使用麥克風後，再試一次語音輸入。");
    }
  };

  voiceRecognition.onend = () => {
    if (voiceShouldKeepListening) {
      startVoiceRecognition(SpeechRecognition, input);
      return;
    }

    setVoiceListeningState(false);
    input.focus();
  };

  try {
    voiceRecognition.start();
  } catch (err) {
    voiceShouldKeepListening = false;
    setVoiceListeningState(false);
    addMessage("ai", "⚠️ 目前無法啟動語音輸入，請確認瀏覽器與麥克風權限。");
  }
}

// ── sendMessage ───────────────────────────────────────────────────────────────
async function sendMessage() {
  ensureChatUI();
  setupVoiceInput();

  if (!getToken()) {
    addMessage("ai", "請先登入後再開始查詢。");
    return;
  }
  const input = document.getElementById("userInput");
  const sendBtn = document.getElementById("sendBtn");
  const text = input.value.trim();
  if (!text) return;
  hideWelcome();
  input.value = "";
  input.style.height = "auto";
  sendBtn.disabled = true;

  if (!currentSessionId) {
    const id = "sess_" + Date.now();
    sessions.push({
      id,
      title: text.length > 22 ? text.slice(0, 22) + "…" : text,
      messages: [],
      sources: {},
      ts: Date.now(),
    });
    currentSessionId = id;
    saveSessions();
    renderHistoryList();
  }

  const sess = getSession(currentSessionId);
  sess.messages.push({ role: "user", content: text });
  sess.ts = Date.now();
  saveSessions();
  addMessage("user", text);

  const history = sess.messages
    .filter((m) => m.role === "user")
    .slice(-4)
    .map((m) => ({
      role: "user",
      content: m.content.slice(0, 300),
    }));

  const typingEl = addMessage("ai", "", true);

  try {
    const res = await fetch(`${API_BASE}/api/chat`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${getToken()}`,
      },
      body: JSON.stringify({
        query: text,
        cand_topk: 10,
        max_src_tokens: 1800,
        max_each_tokens: 500,
      }),
    });
    const data = await res.json();
    typingEl.remove();
    if (!res.ok) {
      if (res.status === 403) {
        Swal.fire({
          icon: "warning",
          title: "試用次數已用完",
          html: `
        <div style="line-height:1.8">
          請升級 Pro 繼續使用<br>
          <strong>Pro 方案：NT$199 / 月</strong><br>
          <small>每月 150 次 AI 法規查詢 / 附條文來源 / 節省手動翻法規時間</small>
        </div>
      `,
          showCancelButton: true,
          confirmButtonText: "升級 Pro",
          cancelButtonText: "稍後再說",
          confirmButtonColor: "#d6522c",
          heightAuto: false, // ⭐ 重點
        }).then((result) => {
          if (result.isConfirmed) {
            openUpgradeModal();
          }
        });
        return;
      }

      addMessage("ai", `⚠️ ${data.detail || "伺服器錯誤"}`);
      return;
    }

    let aiText = data.answer || "抱歉，無法取得回應。";

    const hasSources = (data.provided_sources || []).length > 0;
    const hasSrcTag = /\{src:\[[^\]]+\]\}/.test(aiText);

    if (hasSources && !hasSrcTag) {
      const fallbackSrcTags = data.provided_sources
        .slice(0, 5)
        .map((s) => s.sid)
        .join(",");

      aiText += `\n\n參考來源 {src:[${fallbackSrcTags}]}`;
    }

    const srcMap = {};
    (data.provided_sources || []).forEach((s) => {
      srcMap[s.sid] = s;
    });
    Object.assign(sess.sources, srcMap);
    lastSourceBySid = new Map(Object.entries(sess.sources));
    sess.messages.push({ role: "assistant", content: aiText });
    sess.ts = Date.now();
    saveSessions();
    addMessage("ai", aiText, false, text);
    renderHistoryList();
  } catch (err) {
    typingEl.remove();
    addMessage("ai", "⚠️ 連線錯誤，請確認伺服器是否已啟動。");
  } finally {
    sendBtn.disabled = false;
  }
}
window.addEventListener("resize", () => {
  if (!isMobile()) {
    overlay.classList.remove("visible");
    sidebar.classList.toggle("collapsed", sidebarCollapsed);
  } else {
    sidebar.classList.add("collapsed");
    overlay.classList.remove("visible");
  }
});
document.addEventListener("DOMContentLoaded", async () => {
  applyInitialSidebarState();

  loadSessions();

  renderChatShell();
  setupVoiceInput();

  renderHistoryList();

  await refreshUser();

  renderAuthState();

  handlePaymentReturn();
});
