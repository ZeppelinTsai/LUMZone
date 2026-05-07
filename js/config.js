const API_BASE =
  location.hostname === "localhost" || location.hostname === "127.0.0.1"
    ? "http://127.0.0.1:13169"
    : "https://lumzone-back.onrender.com";

const LS_KEY = "lumzone_chat_sessions";
const LS_SIDEBAR_KEY = "lumzone_sidebar_state";
const TOKEN_KEY = "lumzone_token";
