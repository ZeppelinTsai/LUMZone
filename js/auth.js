async function login(email) {
  const res = await fetch(`${API_BASE}/api/auth/email`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email }),
  });

  const data = await res.json();

  if (!res.ok) {
    alert("Sign-in failed");
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
    alert("Please enter your email");
    return;
  }

  const res = await fetch(`${API_BASE}/api/auth/email`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email }),
  });

  const data = await res.json();

  if (!res.ok) {
    alert(data.detail || "Sign-in failed");
    return;
  }

  localStorage.setItem(TOKEN_KEY, data.token);
  localStorage.setItem("lumzone_user", JSON.stringify(data.user));

  renderAuthState();
}

function getUser() {
  try {
    return JSON.parse(localStorage.getItem("lumzone_user") || "null");
  } catch {
    return null;
  }
}

function handleLogout() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem("lumzone_user");
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

    // Update auth UI.
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

function prefillLoginEmailFromQuery() {
  const params = new URLSearchParams(window.location.search);
  const email = (params.get("email") || "").trim();
  const emailInput = document.getElementById("loginEmail");

  if (!email || !emailInput) return;

  emailInput.value = email;

  if (!getToken()) {
    openLoginModal();
  }

  params.delete("email");
  const query = params.toString();
  const cleanUrl = `${window.location.pathname}${query ? `?${query}` : ""}${window.location.hash}`;
  window.history.replaceState({}, document.title, cleanUrl);
}

async function handleEmailLoginModal() {
  const email = document.getElementById("loginEmail").value.trim();

  if (!email) {
    Swal.fire("Please enter your email");
    return;
  }

  const res = await fetch(`${API_BASE}/api/auth/email`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email }),
  });

  const data = await res.json();

  if (!res.ok) {
    Swal.fire("Sign-in failed", data.detail || "", "error");
    return;
  }

  localStorage.setItem(TOKEN_KEY, data.token);
  localStorage.setItem("lumzone_user", JSON.stringify(data.user));

  Swal.fire("Signed in", data.user.email, "success");

  renderAuthState();

  bootstrap.Modal.getInstance(document.getElementById("loginModal")).hide();
}
async function requestCode() {
  const email = document.getElementById("loginEmail").value.trim();
  const btn = document.getElementById("requestCodeBtn");

  if (!email) {
    Swal.fire("Please enter your email");
    return;
  }

  btn.disabled = true;
  btn.textContent = "Sending...";

  try {
    const res = await fetch(`${API_BASE}/api/auth/request-code`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    });

    const data = await res.json();

    if (!res.ok) {
      btn.disabled = false;
      btn.textContent = "Send sign-in code";

      Swal.fire("Could not send code", data.detail || "Please try again later", "error");

      return;
    }

    document.getElementById("codeArea").style.display = "block";

    Swal.fire(
      "Code sent",
      "Please check your inbox",
      "success",
    );

    let sec = 60;
    const timer = setInterval(() => {
      sec--;
      btn.textContent = `Resend in ${sec}s`;

      if (sec <= 0) {
        clearInterval(timer);
        btn.disabled = false;
        btn.textContent = "Resend code";
      }
    }, 1000);
  } catch (err) {
    Swal.fire("Could not send code", "Network error. Please try again later.", "error");
    btn.disabled = false;
    btn.textContent = "Send sign-in code";
  }
}

async function verifyCode() {
  const email = document.getElementById("loginEmail").value.trim();
  const code = document.getElementById("loginCode").value.trim();
  const btn = document.getElementById("verifyCodeBtn");

  if (!email || !code) {
    Swal.fire("Please enter your email and verification code");
    return;
  }

  btn.disabled = true;
  btn.textContent = "Verifying...";

  try {
    const res = await fetch(`${API_BASE}/api/auth/verify-code`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, code }),
    });

    const data = await res.json();

    if (!res.ok) {
      Swal.fire("Sign-in failed", data.detail || "Invalid verification code", "error");
      btn.disabled = false;
      btn.textContent = "Verify and sign in";
      return;
    }

    localStorage.setItem(TOKEN_KEY, data.token);
    localStorage.setItem("lumzone_user", JSON.stringify(data.user));

    renderAuthState();

    Swal.fire("Signed in", data.user.email, "success");

    const modalEl = document.getElementById("loginModal");
    bootstrap.Modal.getInstance(modalEl)?.hide();
  } catch (err) {
    Swal.fire("Sign-in failed", "Network error. Please try again later.", "error");
    btn.disabled = false;
    btn.textContent = "Verify and sign in";
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
      title: "Billing is in beta",
      text: "Online checkout is being prepared. Please contact us for early access.",
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

  let res;
  try {
    res = await fetch(`${API_BASE}/api/auth/me`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
  } catch (err) {
    console.warn("User refresh failed", err);
    renderAuthState();
    return getUser();
  }

  if (res.status === 401 || res.status === 403) {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem("lumzone_user");
    renderAuthState();
    return null;
  }

  if (!res.ok) {
    console.warn("User refresh failed", res.status);
    renderAuthState();
    return getUser();
  }

  const data = await res.json();

  localStorage.setItem("lumzone_user", JSON.stringify(data.user));
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
        title: "Payment pending",
        text: "Your payment status is updating. Please refresh again shortly.",
      });
    }
  }

  if (payment === "back") {
    Swal.fire({
      icon: "info",
      title: "Payment not completed",
      text: "You returned to LUMZone before completing the upgrade.",
    });
  }

  window.history.replaceState({}, document.title, window.location.pathname);
}
