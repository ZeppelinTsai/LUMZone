const API_BASE =
  location.hostname === "localhost" || location.hostname === "127.0.0.1"
    ? "http://127.0.0.1:13169"
    : "https://lumarch-back.onrender.com";

const LS_KEY = "arch_chat_sessions";
const LS_SIDEBAR_KEY = "arch_sidebar_state";
const TOKEN_KEY = "lumarch_token";
