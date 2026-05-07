async function login(email) {
  const res = await fetch(`${API_BASE}/api/auth/email`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email }),
  });

  const data = await res.json();

  if (!res.ok) {
    alert("登入失敗");
    return;
  }

  localStorage.setItem(TOKEN_KEY, data.token);
  return data.user;
}

function getToken() {
  return localStorage.getItem(TOKEN_KEY);
}

function logout() {
  localStorage.removeItem(TOKEN_KEY);
  location.reload();
}

async function handleEmailLogin() {
  const input = document.getElementById("emailInput");
  const email = input.value.trim();

  if (!email) {
    alert("請輸入 Email");
    return;
  }

  const res = await fetch(`${API_BASE}/api/auth/email`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email }),
  });

  const data = await res.json();

  if (!res.ok) {
    alert(data.detail || "登入失敗");
    return;
  }

  localStorage.setItem(TOKEN_KEY, data.token);
  localStorage.setItem("lumarch_user", JSON.stringify(data.user));

  renderAuthState();
}

function getUser() {
  try {
    return JSON.parse(localStorage.getItem("lumarch_user") || "null");
  } catch {
    return null;
  }
}

function handleLogout() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem("lumarch_user");
  renderAuthState();
}

function renderAuthState() {
  const user = getUser();
  const guestEl = document.getElementById("authGuest");
  const userEl = document.getElementById("authUser");
  const planEl = document.getElementById("userPlan");

  if (!guestEl || !userEl) return;

  if (user) {
    guestEl.style.display = "none";
    userEl.style.display = "block";

    // ⭐ 更新 UI
    const userDropdown = document.getElementById("userDropdown");
    const avatar = document.getElementById("userAvatar");

    if (planEl) planEl.textContent = user.plan || "free";
    if (userDropdown) userDropdown.textContent = user.email;

    if (avatar && user.email) {
      avatar.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(
        user.email.charAt(0).toUpperCase(),
      )}&background=random`;
    }
    updateProVisibility(user);
  } else {
    guestEl.style.display = "block";
    userEl.style.display = "none";
  }
}
function openLoginModal() {
  const modal = new bootstrap.Modal(document.getElementById("loginModal"));
  modal.show();
}

async function handleEmailLoginModal() {
  const email = document.getElementById("loginEmail").value.trim();

  if (!email) {
    Swal.fire("請輸入 Email");
    return;
  }

  const res = await fetch(`${API_BASE}/api/auth/email`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email }),
  });

  const data = await res.json();

  if (!res.ok) {
    Swal.fire("登入失敗", data.detail || "", "error");
    return;
  }

  localStorage.setItem(TOKEN_KEY, data.token);
  localStorage.setItem("lumarch_user", JSON.stringify(data.user));

  Swal.fire("登入成功", data.user.email, "success");

  renderAuthState();

  bootstrap.Modal.getInstance(document.getElementById("loginModal")).hide();
}
async function requestCode() {
  const email = document.getElementById("loginEmail").value.trim();
  const btn = document.getElementById("requestCodeBtn");

  if (!email) {
    Swal.fire("請輸入 Email");
    return;
  }

  btn.disabled = true;
  btn.textContent = "發送中...";

  try {
    const res = await fetch(`${API_BASE}/api/auth/request-code`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    });

    const data = await res.json();

    if (!res.ok) {
      btn.disabled = false;
      btn.textContent = "發送驗證碼";

      Swal.fire("發送失敗", data.detail || "請稍後再試", "error");

      return;
    }

    document.getElementById("codeArea").style.display = "block";

    Swal.fire(
      "驗證碼已建立",
      data.dev_code ? `開發測試碼：${data.dev_code}` : "請查看信箱",
      "success",
    );

    let sec = 60;
    const timer = setInterval(() => {
      sec--;
      btn.textContent = `${sec} 秒後可重送`;

      if (sec <= 0) {
        clearInterval(timer);
        btn.disabled = false;
        btn.textContent = "重新發送驗證碼";
      }
    }, 1000);
  } catch (err) {
    Swal.fire("發送失敗", "網路連線異常，請稍後再試", "error");
    btn.disabled = false;
    btn.textContent = "發送驗證碼";
  }
}

async function verifyCode() {
  const email = document.getElementById("loginEmail").value.trim();
  const code = document.getElementById("loginCode").value.trim();
  const btn = document.getElementById("verifyCodeBtn");

  if (!email || !code) {
    Swal.fire("請輸入 Email 與驗證碼");
    return;
  }

  btn.disabled = true;
  btn.textContent = "驗證中...";

  try {
    const res = await fetch(`${API_BASE}/api/auth/verify-code`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, code }),
    });

    const data = await res.json();

    if (!res.ok) {
      Swal.fire("登入失敗", data.detail || "驗證碼錯誤", "error");
      btn.disabled = false;
      btn.textContent = "驗證並登入";
      return;
    }

    localStorage.setItem(TOKEN_KEY, data.token);
    localStorage.setItem("lumarch_user", JSON.stringify(data.user));

    renderAuthState();

    Swal.fire("登入成功", data.user.email, "success");

    const modalEl = document.getElementById("loginModal");
    bootstrap.Modal.getInstance(modalEl)?.hide();
  } catch (err) {
    Swal.fire("登入失敗", "網路連線異常，請稍後再試", "error");
    btn.disabled = false;
    btn.textContent = "驗證並登入";
  }
}
function openUpgradeModal() {
  const modal = new bootstrap.Modal(document.getElementById("upgradeModal"));
  modal.show();
}

const PAYMENT_ENABLED = false;

function startUpgrade() {
  if (!PAYMENT_ENABLED) {
    Swal.fire({
      title: "金流審核中",
      text: "預計 1~3 天內開通，敬請期待 🚀",
      icon: "info",
    });
    return;
  }

  const token = getToken();
  window.location.href = `${API_BASE}/api/payment/checkout?access_token=${encodeURIComponent(token)}`;
}
function updateProVisibility(user) {
  const isPro = user && user.plan === "pro";

  document.querySelectorAll(".pro-hidden").forEach((el) => {
    el.style.display = isPro ? "none" : "";
  });
}
async function refreshUser() {
  const token = getToken();
  if (!token) return null;

  const res = await fetch(`${API_BASE}/api/auth/me`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!res.ok) {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem("lumarch_user");
    renderAuthState();
    return null;
  }

  const data = await res.json();

  localStorage.setItem("lumarch_user", JSON.stringify(data.user));
  renderAuthState();

  return data.user;
}
async function handlePaymentReturn() {
  const params = new URLSearchParams(window.location.search);
  const payment = params.get("payment");

  if (!payment) return;

  if (payment === "success") {
    const user = await refreshUser();

    if (user && user.plan === "pro") {
      const modal = new bootstrap.Modal(
        document.getElementById("paymentSuccessModal"),
      );
      modal.show();
    } else {
      Swal.fire({
        icon: "info",
        title: "付款確認中",
        text: "付款狀態正在更新，請稍後重新整理頁面。",
      });
    }
  }

  if (payment === "back") {
    Swal.fire({
      icon: "info",
      title: "尚未完成付款",
      text: "您已返回 LUMArch，目前尚未完成升級。",
    });
  }

  window.history.replaceState({}, document.title, window.location.pathname);
}
