function escapeHtml(s) {
  return (s ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
function zhNumToInt(zh) {
  // 支援：十、十一、二十、二十一、一百零一、三百二十…（夠用版）
  if (!zh) return null;
  zh = zh.replace(/\s+/g, "");

  const map = {
    零: 0,
    〇: 0,
    一: 1,
    二: 2,
    兩: 2,
    三: 3,
    四: 4,
    五: 5,
    六: 6,
    七: 7,
    八: 8,
    九: 9,
  };
  let total = 0;
  let section = 0; // 個十百千的累積
  let number = 0;

  const pushNumber = () => {
    section += number;
    number = 0;
  };

  for (let i = 0; i < zh.length; i++) {
    const ch = zh[i];
    if (ch in map) {
      number = map[ch];
      continue;
    }
    if (ch === "十") {
      section += (number || 1) * 10;
      number = 0;
      continue;
    }
    if (ch === "百") {
      section += (number || 1) * 100;
      number = 0;
      continue;
    }
    if (ch === "千") {
      section += (number || 1) * 1000;
      number = 0;
      continue;
    }
    // 先不處理 萬/億（法條幾乎用不到）
  }
  pushNumber();
  total += section;
  return total || null;
}
function pickSection(text, startKey, endKeys = []) {
  const s = (text || "").replace(/\r\n/g, "\n");
  const start = s.indexOf(startKey);
  if (start === -1) return null;
  const from = start + startKey.length;
  let to = s.length;
  for (const k of endKeys) {
    const i = s.indexOf(k, from);
    if (i !== -1 && i < to) to = i;
  }
  return s.slice(from, to).trim();
}
function parseItemLine(line) {
  const mNum = line.match(/^\s*(\d+)\.\s*(.*)$/);
  const content = (mNum ? mNum[2] : line).trim();
  const mSrc = content.match(/\{src:\s*\[([^\]]*)\]\s*\}+\s*$/);
  if (!mSrc) return { text: content, src: [] };
  const src = mSrc[1]
    .trim()
    .split(",")
    .map((x) => x.trim())
    .filter(Boolean);
  return {
    text: content.replace(/\{src:\s*\[[^\]]*\]\s*\}+\s*$/, "").trim(),
    src,
  };
}
function parseNumberedItems(block) {
  if (!block) return [];
  return block
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean)
    .map(parseItemLine);
}
function parseSourceMap(block) {
  const map = new Map();
  if (!block) return map;
  for (const ln of block
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean)) {
    const m = ln.match(/^\[(S\d+)\]\s*(.+)$/);
    if (m) map.set(m[1], m[2]);
  }
  return map;
}
function parseSourceIds(raw) {
  const ids = new Set();
  const tagMatch = raw.match(/\{src:\[([^\]]+)\]\}/);

  if (tagMatch) {
    tagMatch[1]
      .split(",")
      .map((id) => id.trim())
      .filter(Boolean)
      .forEach((id) => ids.add(id));
  }

  for (const match of raw.matchAll(/^\s*\[(S\d+)\]\s+(.+)$/gm)) {
    ids.add(match[1]);
  }

  return [...ids];
}
function stripPlainSources(raw) {
  return raw
    .replace(/\n*\s*參考來源\s*\{src:\[[^\]]+\]\}\s*/g, "")
    .replace(/\n*\s*參考來源[:：]?\s*(?:\n\s*\[S\d+\]\s+.*)+\s*$/g, "")
    .replace(/\n*\s*(?:\[S\d+\]\s+.*\n?)+\s*$/g, "")
    .replace(/\n*\s*參考來源\s*$/g, "")
    .trim();
}
// Build sid → display index (1-based) from ordered source map
function buildSidIndexMap(sourceMap) {
  const m = new Map();
  let i = 1;
  for (const [sid] of sourceMap) {
    m.set(sid, i++);
  }
  return m;
}
// Circled numbers for superscript chips (①②… fallback to plain number)
const CIRCLED = [
  "①",
  "②",
  "③",
  "④",
  "⑤",
  "⑥",
  "⑦",
  "⑧",
  "⑨",
  "⑩",
  "⑪",
  "⑫",
  "⑬",
  "⑭",
  "⑮",
];
function circled(n) {
  return n >= 1 && n <= CIRCLED.length ? CIRCLED[n - 1] : String(n);
}

function renderItemWithChips(item, sourceMap, sidIndexMap) {
  const chips = (item.src || [])
    .filter((id) => sourceMap.has(id))
    .map((id) => {
      const idx = sidIndexMap.get(id) || "?";
      const label = circled(idx);
      const title = escapeHtml(sourceMap.get(id) || id);
      return `<span class="src-chip" data-sid="${escapeHtml(id)}" title="${title}" onclick="openLawSid(this)">${label}</span>`;
    })
    .join("");
  return `${escapeHtml(item.text)}${chips ? `<span class="src-chips">${chips}</span>` : ""}`;
}
function formatMessage(text, keyword, role = "ai") {
  const raw = (text || "").trim();
  if (!raw) return "";
  const ok =
    raw.includes("主題:") &&
    raw.includes("摘要:") &&
    raw.includes("詳細說明:") &&
    raw.includes("參考來源:");
  if (!ok) {
    const sourceIds = parseSourceIds(raw);
    const body = stripPlainSources(raw);

    let html = `
    <div class="plain-answer">
      ${escapeHtml(body).replace(/\n/g, "<br>")}
    </div>
  `;

    if (sourceIds.length) {
      html += `
      <div class="sources-block compact">
        <div class="sources-label">參考來源（點擊閱覽條文）</div>
        <div class="source-list">
          ${sourceIds
            .map((sid) => {
              const src = lastSourceBySid?.get(sid);

              const name =
                src?.loc_str ||
                src?.law_name ||
                src?.title ||
                src?.source_title ||
                src?.name ||
                sid;

              return `
              <div class="source-row" data-sid="${sid}" onclick="openLawSid(this)">
                <span class="source-num">${sid}</span>
                <span class="source-name">
                  ${escapeHtml(name)}
                <span class="source-preview">
                  ${highlight(
                    makeSourcePreview(lastSourceBySid?.get(sid)?.text),
                    keyword,
                  )}
                </span>
                </span>
                <span class="source-arrow">›</span>
              </div>
            `;
            })
            .join("")}
        </div>
      </div>
    `;
    }
    if (role === "ai") html += renderAnswerActions();
    return html;
  }
  const topic = (
    pickSection(raw, "主題:", ["摘要:", "詳細說明:", "參考來源:"]) || ""
  ).trim();
  const summaryBlock = pickSection(raw, "摘要:", ["詳細說明:", "參考來源:"]);
  const detailBlock = pickSection(raw, "詳細說明:", ["參考來源:"]);
  const refsBlock = pickSection(raw, "參考來源:", []);
  const summaryItems = parseNumberedItems(summaryBlock);
  const detailItems = parseNumberedItems(detailBlock);
  const sourceMap = parseSourceMap(refsBlock);

  // 用後端 provided_sources 覆蓋 AI 回答裡的 placeholder
  for (const [sid, ref] of sourceMap.entries()) {
    sourceMap.set(sid, getSourceDisplayName(sid, ref));
  }
  const sidIndexMap = buildSidIndexMap(sourceMap);
  let html = "";
  if (topic)
    html += `<div style="margin-bottom:10px;"><div style="font-family:'Noto Serif TC',serif;font-weight:800;font-size:16px;line-height:1.4;">${escapeHtml(topic)}</div></div>`;
  if (summaryItems.length)
    html += `<div class="summary-block"><strong>摘要</strong>${summaryItems.map((it, i) => `<div class="detail-item"><span class="detail-num">${i + 1}.</span><span>${renderItemWithChips(it, sourceMap, sidIndexMap)}</span></div>`).join("")}</div>`;
  if (detailItems.length)
    html += `<div><strong style="font-size:12px;color:var(--muted);text-transform:uppercase;letter-spacing:.08em;">詳細說明</strong><div style="margin-top:10px">${detailItems.map((it, i) => `<div class="detail-item"><span class="detail-num">${i + 1}.</span><span>${renderItemWithChips(it, sourceMap, sidIndexMap)}</span></div>`).join("")}</div></div>`;
  const refs = [...sourceMap.entries()];
  if (refs.length) {
    const rows = refs
      .map(
        ([sid, ref], i) =>
          `<div class="source-row" data-sid="${escapeHtml(sid)}" onclick="openLawSid(this)">
        <span class="source-num">${circled(i + 1)}</span>
        <span class="source-name">
          ${escapeHtml(ref)}
          <span class="source-preview">
            ${highlight(
              makeSourcePreview(lastSourceBySid?.get(sid)?.text),
              keyword,
            )}
          </span>
        </span>
        <span class="source-arrow">›</span>
      </div>`,
      )
      .join("");
    html += `<div class="sources-block"><div class="sources-label">參考來源（點擊閱覽條文）</div><div class="source-list">${rows}</div></div>`;
  }
  if (role === "ai") html += renderAnswerActions();
  return (
    html ||
    `<div style="line-height:1.8;">${escapeHtml(raw).replace(/\n/g, "<br>")}</div>`
  );
}
function renderAnswerActions() {
  return `
    <div class="answer-actions">
      <button class="action-btn" onclick="reportIssue(this)">問題回報</button>
      <button class="action-btn" onclick="retryAnswer(this)">重新回答</button>
      <button class="action-btn" onclick="copyAnswer(this)">複製答案</button>
    </div>
  `;
}
function reportIssue(btn) {
  const bubble = btn.closest(".bubble");
  const text = bubble.innerText;

  const mail = "luxandpei@gmail.com";
  const subject = encodeURIComponent("LUMArch 問題回報");
  const body = encodeURIComponent(`以下是系統回答：\n\n${text}`);

  window.location.href = `mailto:${mail}?subject=${subject}&body=${body}`;
}
function retryAnswer(btn) {
  const sess = getSession(currentSessionId);
  if (!sess) return;

  // 找最後一個 user 問題
  const lastUser = [...sess.messages].reverse().find((m) => m.role === "user");

  if (!lastUser) return;

  document.getElementById("userInput").value = lastUser.content;

  sendMessage();
}
function copyAnswer(btn) {
  const bubble = btn.closest(".bubble");
  const clone = bubble.cloneNode(true);

  // 移除 UI 垃圾
  clone.querySelector(".sources-block")?.remove();
  clone.querySelector(".answer-actions")?.remove();
  clone.querySelectorAll(".src-chip").forEach((el) => el.remove());

  // ⭐ 改這裡：用 innerHTML 保留結構
  let html = clone.innerHTML;

  // 轉成「可讀文字」
  html = html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/div>/gi, "\n")
    .replace(/<[^>]+>/g, "") // 移除剩餘標籤
    .replace(/①|②|③|④|⑤|⑥|⑦|⑧|⑨/g, "")
    .replace(/\n{2,}/g, "\n\n")
    .trim();

  navigator.clipboard.writeText(html);

  btn.innerText = "已複製 ✓";
  setTimeout(() => {
    btn.innerText = "複製答案";
  }, 1200);
}
function getSourceDisplayName(sid, fallback = "") {
  const src = lastSourceBySid?.get(sid);

  if (!src) return fallback || sid;

  const loc = src.loc || {};

  const parts = [
    loc.law_name || src.law_name || src.title || src.source_title || src.name,
    loc.chapter,
    loc.section,
    loc.article_no,
  ].filter(Boolean);

  const name = parts.length
    ? parts.join(" / ")
    : (src.loc_str || fallback || sid)
        .split(" / ")
        .filter((part) => !/^\[[^\]]+\]$/.test(part.trim()))
        .join(" / ");

  if (!name || name.includes("<來源定位字串>")) {
    return sid;
  }

  return name;
}
// ── Law modal ─────────────────────────────────────────────────────────────────
async function openLawSid(el) {
  const sid = el.getAttribute("data-sid");
  const s = lastSourceBySid.get(sid);

  const title = s?.loc_str || sid;
  const body = s?.text || "（此來源在本次檢索中未回傳內容）";
  const url = (s?.source_url || "").trim();

  showLawModal(title);

  // fallback_hint：也可以塞 s?.law_name 或你 sourceMap 的 ref 字串（如果你有存）
  renderLawModal({
    title,
    body,
    source_url: url,
    fallback_hint: title, // 暴力：先用 title 猜
  });
}
function showLawModal(title) {
  document.getElementById("lawModalTitle").textContent = title || "法條";
  document.getElementById("lawModalBody").textContent = "載入中…";
  document.getElementById("lawModalStatus").textContent = "查詢中…";
  const l = document.getElementById("lawModalLink");
  l.style.display = "none";
  l.href = "#";
  const modalEl = document.getElementById("lawModal");
  bootstrap.Modal.getOrCreateInstance(modalEl).show();
}
function guessLawFromText(text) {
  const t = (text || "").trim();
  if (!t) return null;

  const sorted = [...LAW_FALLBACKS].sort((a, b) => b.key.length - a.key.length);
  for (const item of sorted) {
    if (t.includes(item.key)) return item;
  }

  if (t.includes("建築技術規則")) {
    return LAW_FALLBACKS.find((x) => x.pcode === "D0070115") || null;
  }
  return null;
}
function extractArticleNo(text) {
  if (!text) return "";

  // 先抓阿拉伯數字：第 12-1 條
  let m = text.match(/第\s*(\d+(?:-\d+)?)\s*條/);
  if (m) return m[1];

  // 再抓中文數字：第十二條 / 第三百二十條
  let mZh = text.match(/第\s*([零〇一二兩三四五六七八九十百千]+)\s*條/);
  if (mZh) {
    const num = zhNumToInt(mZh[1]);
    return num ? String(num) : "";
  }

  // 抓「條之X」：第十二條之一
  let mExt = text.match(/第\s*(\d+)\s*條\s*之\s*(\d+)/);
  if (mExt) return `${mExt[1]}-${mExt[2]}`;

  return "";
}
function buildMojUrlFromHint(hintText) {
  const law = guessLawFromText(hintText);
  if (!law) return "";

  const flno = extractArticleNo(hintText);

  // 有條號 → LawSingle
  if (flno) {
    return `https://law.moj.gov.tw/LawClass/LawSingle.aspx?pcode=${encodeURIComponent(law.pcode)}&flno=${encodeURIComponent(flno)}`;
  }

  // 沒條號 → LawAll
  return law.url;
}
function renderLawModal({ title, body, source_url, fallback_hint }) {
  document.getElementById("lawModalTitle").textContent = title || "法條";
  document.getElementById("lawModalBody").textContent = body || "";
  document.getElementById("lawModalStatus").textContent = "";

  const l = document.getElementById("lawModalLink");

  // 1) 後端有給 source_url：直接用（最準）
  let url = (source_url || "").trim();

  // 2) 沒給：用 title / hint 去組 MOJ LawSingle / LawAll
  if (!url) {
    url = buildMojUrlFromHint(title) || buildMojUrlFromHint(fallback_hint);
  }

  // 3) 再不行：導到 MOJ 首頁
  if (!url) url = "https://law.moj.gov.tw/";

  l.style.display = "inline-block";
  l.href = url;
  l.textContent = "開啟來源";
}
function closeLawModal(e) {
  const modalEl = document.getElementById("lawModal");
  bootstrap.Modal.getInstance(modalEl)?.hide();
}

// ── Brutal law list fallback (MOJ LawAll) ────────────────────────────────────
const LAW_FALLBACKS = [
  {
    key: "建築法",
    pcode: "D0070109",
    url: "https://law.moj.gov.tw/LawClass/LawAll.aspx?pcode=D0070109",
  },
  {
    key: "建築技術規則｜建築設計施工編",
    pcode: "D0070115",
    url: "https://law.moj.gov.tw/LawClass/LawAll.aspx?pcode=D0070115",
  },
  {
    key: "建築技術規則｜建築構造編",
    pcode: "D0070116",
    url: "https://law.moj.gov.tw/LawClass/LawAll.aspx?pcode=D0070116",
  },
  {
    key: "建築技術規則｜建築設備編",
    pcode: "D0070117",
    url: "https://law.moj.gov.tw/LawClass/LawAll.aspx?pcode=D0070117",
  },
  {
    key: "建築師法",
    pcode: "D0070112",
    url: "https://law.moj.gov.tw/LawClass/LawAll.aspx?PCode=D0070112",
  },
  {
    key: "公寓大廈管理條例",
    pcode: "D0070118",
    url: "https://law.moj.gov.tw/LawClass/LawAll.aspx?pcode=D0070118",
  },
  {
    key: "消防法",
    pcode: "D0120001",
    url: "https://law.moj.gov.tw/LawClass/LawAll.aspx?PCode=D0120001",
  },
];
// 用 loc_str / ref 文字去猜是哪部法（超暴力：包含關鍵字就算）
function guessLawUrlFromText(text) {
  const t = (text || "").trim();
  if (!t) return "";

  // 優先長的 key，避免「建築技術規則」被「建築法」先吃掉
  const sorted = [...LAW_FALLBACKS].sort((a, b) => b.key.length - a.key.length);

  for (const item of sorted) {
    if (t.includes(item.key)) return item.url;
  }

  // 更暴力的二階段：只要出現「建築技術規則」但沒分編，就先導到設計施工編
  if (t.includes("建築技術規則")) {
    return "https://law.moj.gov.tw/LawClass/LawAll.aspx?pcode=D0070115";
  }

  return "";
}
function makeSourcePreview(text, len = 72) {
  const clean = (text || "").replace(/\s+/g, " ").trim();

  if (!clean) return "";

  return clean.length > len ? clean.slice(0, len) + "…" : clean;
}
function highlight(text, keyword) {
  if (!text || !keyword) return text;

  // 1️⃣ escape，防 XSS
  const safeText = escapeHtml(text);
  const safeKeyword = escapeHtml(keyword);

  // 2️⃣ 多關鍵字切分（空白）
  const keywords = safeKeyword.split(/\s+/).filter(Boolean);

  let result = safeText;

  keywords.forEach((kw) => {
    const regex = new RegExp(`(${kw})`, "gi"); // 不分大小寫
    result = result.replace(regex, `<mark>$1</mark>`);
  });

  return result;
}
