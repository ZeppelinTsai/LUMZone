// ── Sidebar toggle ────────────────────────────────────────────────────────────
const sidebar = document.getElementById("sidebar");
const overlay = document.getElementById("sidebarOverlay");
let sidebarCollapsed = localStorage.getItem(LS_SIDEBAR_KEY) === "collapsed";

function isMobile() {
  return window.innerWidth <= 640;
}

function applyInitialSidebarState() {
  if (isMobile()) {
    // On mobile, always start closed
    sidebar.classList.add("collapsed");
  } else {
    if (sidebarCollapsed) sidebar.classList.add("collapsed");
  }
}

function toggleSidebar() {
  if (isMobile()) {
    const isOpen = !sidebar.classList.contains("collapsed");
    if (isOpen) {
      sidebar.classList.add("collapsed");
      overlay.classList.remove("visible");
    } else {
      sidebar.classList.remove("collapsed");
      overlay.classList.add("visible");
    }
  } else {
    sidebarCollapsed = !sidebarCollapsed;
    sidebar.classList.toggle("collapsed", sidebarCollapsed);
    localStorage.setItem(
      LS_SIDEBAR_KEY,
      sidebarCollapsed ? "collapsed" : "open",
    );
  }
}

function closeSidebar() {
  if (!isMobile()) return;

  sidebar.classList.add("collapsed");
  overlay.classList.remove("visible");
}

// ── Render history sidebar ────────────────────────────────────────────────────
function renderHistoryList() {
  const list = document.getElementById("historyList");
  list.innerHTML = "";
  const sorted = [...sessions].sort((a, b) => b.ts - a.ts);
  sorted.forEach((sess) => {
    const item = document.createElement("div");
    item.className =
      "history-item" + (sess.id === currentSessionId ? " active" : "");

    const textEl = document.createElement("span");
    textEl.className = "history-item-text";
    textEl.textContent = sess.title || "Untitled research";
    textEl.title = sess.title || "";
    textEl.onclick = () => {
      loadSessionUI(sess.id);
      closeSidebar();
    };

    const delBtn = document.createElement("button");
    delBtn.className = "history-del";
    delBtn.innerHTML = "✕";
    delBtn.title = "Delete this thread";
    delBtn.onclick = (e) => {
      e.stopPropagation();
      showConfirm(`Delete "${sess.title}"?`, () => {
        deleteSession(sess.id);
        if (currentSessionId === sess.id) {
          currentSessionId = null;
          lastSourceBySid = new Map();
          showWelcome();
        }
        renderHistoryList();
      });
    };

    item.appendChild(textEl);
    item.appendChild(delBtn);
    list.appendChild(item);
  });
}

// ── Load session into UI ──────────────────────────────────────────────────────
function loadSessionUI(id) {
  const sess = getSession(id);
  if (!sess) return;
  currentSessionId = id;
  lastSourceBySid = new Map(Object.entries(sess.sources || {}));
  const msgs = document.getElementById("messages");
  msgs.innerHTML = "";
  const lastAssistantIndex = sess.messages
    .map((m, index) => ({ role: m.role, index }))
    .filter((m) => m.role === "assistant")
    .at(-1)?.index;

  sess.messages.forEach((m, index) =>
    addMessage(m.role === "assistant" ? "ai" : m.role, m.content, false, "", {
      showReportOffer: index === lastAssistantIndex,
    }),
  );
  renderHistoryList();
}

// ── Chat shell / welcome ──────────────────────────────────────────────────────
const CHAT_WELCOME_HTML = `
  <div class="welcome" id="welcome">

    <div class="welcome-icon">
      <img src="./img/LUMZone.png" alt="LUMZone Logo" />
    </div>

    <h1>California ADU & Zoning AI Assistant</h1>

    <p>
      Ask focused ADU and zoning questions, then review structured answers
      grounded in source citations.
    </p>

    <div class="welcome-section-title">
      Popular California ADU Questions
    </div>

    <div class="suggestions">

      <div class="suggestion-card" onclick="askSuggestion(this)">
        <span class="suggestion-icon">1</span>
        Can I build a detached ADU on a single-family lot in San Diego?
      </div>

      <div class="suggestion-card" onclick="askSuggestion(this)">
        <span class="suggestion-icon">2</span>
        What are the typical ADU setback rules in Los Angeles?
      </div>

      <div class="suggestion-card" onclick="askSuggestion(this)">
        <span class="suggestion-icon">3</span>
        Does an ADU need parking if the property is near transit?
      </div>

      <div class="suggestion-card" onclick="askSuggestion(this)">
        <span class="suggestion-icon">4</span>
        What height limits apply to a two-story ADU?
      </div>

      <div class="suggestion-card" onclick="askSuggestion(this)">
        <span class="suggestion-icon">5</span>
        How do lot coverage and floor area limits affect ADU feasibility?
      </div>

      <div class="suggestion-card" onclick="askSuggestion(this)">
        <span class="suggestion-icon">6</span>
        Which city rules should I check before submitting an ADU permit?
      </div>

    </div>

  </div>`;

const CHAT_INPUT_HTML = `
  <div class="input-area">
    <div class="input-wrapper">
      <textarea
        id="userInput"
        placeholder="Ask an ADU or zoning research question..."
        rows="1"
        onkeydown="handleKey(event)"
        oninput="autoResize(this)"
      ></textarea>
      <button class="send-btn" id="sendBtn" onclick="sendMessage()">
        <svg viewBox="0 0 24 24">
          <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" />
        </svg>
      </button>
    </div>
    <div class="disclaimer">Informational zoning research only. Not legal, architectural, or permit approval advice.</div>

    <div class="pricing-note pro-hidden" id="pricingNote">
      <span>Early Beta Access — free during testing</span>
      <button class="upgrade-link" onclick="openUpgradeModal()">
        Learn More
      </button>
    </div>
  </div>`;

function renderChatShell() {
  const mainContent = document.getElementById("mainContent");
  if (!mainContent) return;

  mainContent.innerHTML = `
    <div class="messages" id="messages">
      ${CHAT_WELCOME_HTML}
    </div>
    ${CHAT_INPUT_HTML}
  `;
}

function ensureChatUI(resetWelcome = false) {
  const mainContent = document.getElementById("mainContent");
  if (!mainContent) return;

  const hasChatShell =
    document.getElementById("messages") && document.getElementById("userInput");

  if (!hasChatShell) {
    renderChatShell();
  } else if (resetWelcome) {
    showWelcome();
  }

  if (resetWelcome) {
    const input = document.getElementById("userInput");
    if (input) {
      input.value = "";
      input.style.height = "auto";
    }
  }

  if (typeof renderAuthState === "function") renderAuthState();
}

// ── newChat / welcome ─────────────────────────────────────────────────────────
function newChat() {
  currentSessionId = null;
  lastSourceBySid = new Map();
  ensureChatUI(true);
  renderHistoryList();
  closeSidebar();
  document.getElementById("userInput")?.focus();
}
function showWelcome() {
  const messages = document.getElementById("messages");
  if (!messages) {
    renderChatShell();
    if (typeof renderAuthState === "function") renderAuthState();
    return;
  }

  messages.innerHTML = CHAT_WELCOME_HTML;
}

function gotoLawSearch() {
  const mainContent = document.getElementById("mainContent");
  mainContent.innerHTML = `
    <iframe
      src="https://lumzone-back.onrender.com/law/"
      style="width: 100%; height: 100%; border: none;"
    ></iframe>
  `;
}
async function loadPage(path) {
  const mainContent = document.getElementById("mainContent");
  closeSidebar();

  try {
    const res = await fetch(path);

    if (!res.ok) {
      throw new Error(`HTTP ${res.status}`);
    }

    const html = await res.text();

    const parser = new DOMParser();
    const doc = parser.parseFromString(html, "text/html");
    const pageRoot = path.includes("/")
      ? path.slice(0, path.lastIndexOf("/") + 1)
      : "./";
    const scripts = [...doc.body.querySelectorAll("script")];

    scripts.forEach((script) => script.remove());

    mainContent.innerHTML = doc.body.innerHTML;

    const pageRootTarget = mainContent.querySelector(
      "[data-page-root], .blog-page",
    );
    if (pageRootTarget) {
      pageRootTarget.dataset.pageRoot = pageRoot;
    }

    scripts.forEach((script) => {
      const runnableScript = document.createElement("script");

      [...script.attributes].forEach((attr) => {
        if (attr.name === "src") {
          runnableScript.src = new URL(
            attr.value,
            new URL(pageRoot, window.location.href),
          ).toString();
        } else {
          runnableScript.setAttribute(attr.name, attr.value);
        }
      });

      runnableScript.textContent = script.textContent;
      mainContent.appendChild(runnableScript);
    });

    // 捲到頂部
    window.scrollTo({
      top: 0,
      behavior: "smooth",
    });
  } catch (err) {
    console.error(err);

    mainContent.innerHTML = `
      <div style="padding:40px;">
        <h2>Page failed to load</h2>
        <p>${err.message}</p>
      </div>
    `;
  }
}
function hideWelcome() {
  const w = document.getElementById("welcome");
  if (w) w.remove();
}

// ── Confirm dialog ────────────────────────────────────────────────────────────
let _cb = null;
function showConfirm(msg, cb) {
  document.getElementById("confirmMsg").textContent = msg;
  _cb = cb;
  const modalEl = document.getElementById("confirmModal");
  bootstrap.Modal.getOrCreateInstance(modalEl).show();
}
function confirmOk() {
  const modalEl = document.getElementById("confirmModal");
  bootstrap.Modal.getInstance(modalEl)?.hide();
  _cb?.();
  _cb = null;
}
function confirmCancel() {
  _cb = null;
}

// ── addMessage ────────────────────────────────────────────────────────────────
let pendingInterestProduct = "Professional Report";
let pendingInterestSource = "ai_answer";

function trackInterestEvent(eventName, payload = {}) {
  const eventPayload = {
    currency: "USD",
    ...payload,
  };

  try {
    const stored = JSON.parse(
      localStorage.getItem("lumzone_interest_events") || "[]",
    );
    stored.push({
      event: eventName,
      ...eventPayload,
      ts: new Date().toISOString(),
    });
    localStorage.setItem(
      "lumzone_interest_events",
      JSON.stringify(stored.slice(-50)),
    );
  } catch (err) {
    console.warn("Interest event local log failed", err);
  }

  if (typeof window.gtag === "function") {
    window.gtag("event", eventName, eventPayload);
  } else {
    console.info("GA event queued locally:", eventName, eventPayload);
  }
}

function trackFakePayment(productName, source = "ai_answer") {
  pendingInterestProduct = productName;
  pendingInterestSource = source;

  trackInterestEvent("fake_payment_interest", {
    product_name: productName,
    source,
    value: productName === "Pro Plan" ? 19 : 29,
  });

  const modalTitle = document.getElementById("fakePaymentTitle");
  const bodyTitle = document.getElementById("fakePaymentBodyTitle");
  const bodyText = document.getElementById("fakePaymentBodyText");

  if (modalTitle) modalTitle.textContent = `${productName} Interest Captured`;
  if (bodyTitle) {
    bodyTitle.textContent =
      productName === "Pro Plan"
        ? "Pro access is currently being prepared for beta testers."
        : "Our automated reporting tool is currently undergoing a final regulatory update.";
  }
  if (bodyText) {
    bodyText.textContent =
      productName === "Pro Plan"
        ? "Would you like us to notify you when Pro launches and give you a 50% early-user discount?"
        : "Would you like us to notify you when it is ready and give you a 50% launch discount?";
  }

  const upgradeModalEl = document.getElementById("upgradeModal");
  if (upgradeModalEl) bootstrap.Modal.getInstance(upgradeModalEl)?.hide();

  const modalEl = document.getElementById("fakePaymentModal");
  if (modalEl) bootstrap.Modal.getOrCreateInstance(modalEl).show();
}

function trackReportNotifyInterest() {
  trackInterestEvent("report_notify_interest", {
    product_name: pendingInterestProduct,
    source: `${pendingInterestSource}_notify`,
  });

  const modalEl = document.getElementById("fakePaymentModal");
  bootstrap.Modal.getInstance(modalEl)?.hide();

  Swal.fire({
    icon: "success",
    title: "You're on the list",
    text:
      pendingInterestProduct === "Pro Plan"
        ? "We'll notify you when Pro access is ready."
        : "We'll notify you when professional reports are ready.",
    confirmButtonColor: "#c8522a",
  });
}

function shouldShowProfessionalReportOffer(role, content, isTyping) {
  if (role !== "ai" || isTyping) return false;

  const text = String(content || "").trim();
  if (text.length < 140) return false;

  return !/connection error|server error|microphone access|beta limit/i.test(
    text,
  );
}

function createProfessionalReportCard() {
  const card = document.createElement("div");
  card.className = "professional-report-card";
  card.innerHTML = `
    <div class="professional-report-kicker">Human-Verified Add-On</div>
    <h6>Need a Professional Feasibility Report?</h6>
    <p>
      Get a human-verified PDF report for this property including exact
      setbacks, density limits, parking notes, and AB 1033 eligibility within
      24 hours.
    </p>
    <button
      type="button"
      class="professional-report-btn"
      onclick="trackFakePayment('Professional Report', 'ai_answer_card')"
    >
      Get Report - $29.00
    </button>
  `;
  return card;
}

function addMessage(
  role,
  content,
  isTyping = false,
  keyword = "",
  options = {},
) {
  const msgs = document.getElementById("messages");
  const div = document.createElement("div");
  div.className = `message ${role}`;

  const av = document.createElement("div");
  av.className = `avatar ${role === "ai" ? "ai" : "user-av"}`;
  if (role === "ai") {
    av.innerHTML = `<img src="./img/LUMZone_36.png" class="avatar-icon" />`;
  } else {
    av.textContent = "You";
  }

  const bbl = document.createElement("div");
  bbl.className = "bubble";

  if (isTyping) {
    bbl.innerHTML = `
    <div class="typing-wrap">
      <div class="typing">
        <span></span><span></span><span></span>
      </div>

      <div class="typing-text" id="typingText">
        Searching ADU and zoning sources...
      </div>
    </div>
  `;

    div.id = "typing-indicator";

    // 階段式文字
    setTimeout(() => {
      const el = document.getElementById("typingText");
      if (el) {
        el.textContent = "Reviewing relevant source text...";
      }
    }, 4000);

    setTimeout(() => {
      const el = document.getElementById("typingText");
      if (el) {
        el.textContent = "Organizing zoning findings...";
      }
    }, 9000);

    setTimeout(() => {
      const el = document.getElementById("typingText");
      if (el) {
        el.textContent = "Preparing a citation-grounded answer...";
      }
    }, 14000);
  } else {
    bbl.innerHTML = formatMessage(content, keyword, role);
  }

  div.appendChild(av);
  div.appendChild(bbl);

  const showReportOffer = options.showReportOffer !== false;
  if (
    showReportOffer &&
    shouldShowProfessionalReportOffer(role, content, isTyping)
  ) {
    bbl.appendChild(createProfessionalReportCard());
  }

  if (
    role === "ai" &&
    !isTyping &&
    typeof createAiSpeechButton === "function"
  ) {
    const actions = document.createElement("div");
    actions.className = "message-actions";
    actions.appendChild(createAiSpeechButton(content));
    bbl.appendChild(actions);
  }

  msgs.appendChild(div);
  msgs.scrollTop = msgs.scrollHeight;
  return div;
}
// ── Helpers ───────────────────────────────────────────────────────────────────
function askSuggestion(el) {
  document.getElementById("userInput").value = el.innerText.trim();
  sendMessage();
}
function autoResize(el) {
  el.style.height = "auto";
  el.style.height = Math.min(el.scrollHeight, 120) + "px";
}
function handleKey(e) {
  if (e.key === "Enter" && !e.shiftKey) {
    e.preventDefault();
    sendMessage();
  }
}
