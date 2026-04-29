const oktaDomain = "https://integrator-1985580.okta.com";
const clientId = "0oa12fnbbyuAYNWB9698";
const redirectUri =
  window.location.origin + "/okta-iam-architecture-lab/app/index.html";

const apiBaseUrl = "http://localhost:3000";

// ===== PKCE =====
function base64UrlEncode(buffer) {
  return btoa(String.fromCharCode(...new Uint8Array(buffer)))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

async function sha256(plain) {
  const encoder = new TextEncoder();
  return await crypto.subtle.digest("SHA-256", encoder.encode(plain));
}

function generateRandomString(length = 64) {
  const chars =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~";
  let result = "";
  const randomValues = new Uint8Array(length);
  crypto.getRandomValues(randomValues);
  randomValues.forEach((v) => (result += chars[v % chars.length]));
  return result;
}

async function login() {
  const codeVerifier = generateRandomString();
  sessionStorage.setItem("pkce_code_verifier", codeVerifier);

  const codeChallenge = base64UrlEncode(await sha256(codeVerifier));

  const authUrl =
    `${oktaDomain}/oauth2/default/v1/authorize?` +
    `client_id=${clientId}` +
    `&response_type=code` +
    `&scope=openid profile email` +
    `&redirect_uri=${encodeURIComponent(redirectUri)}` +
    `&state=1234` +
    `&nonce=5678` +
    `&code_challenge=${codeChallenge}` +
    `&code_challenge_method=S256`;

  window.location.href = authUrl;
}

// ===== JWT =====
function decodeJwt(token) {
  const payload = token.split(".")[1];
  return JSON.parse(atob(payload.replace(/-/g, "+").replace(/_/g, "/")));
}

function validateIdToken(payload) {
  const expectedIssuer = `${oktaDomain}/oauth2/default`;
  if (payload.iss !== expectedIssuer) return false;
  if (payload.aud !== clientId) return false;
  if (Date.now() / 1000 > payload.exp) return false;
  return true;
}

// ===== UI =====
function renderRoleBasedUI(payload) {
  const groups = payload.groups || [];

  document.querySelector(".login-card").style.display = "none";
  document.getElementById("appContent").classList.remove("hidden");

  let role = "User";

  if (groups.includes("App-Admin")) {
    role = "Admin";
    document.getElementById("engineering").classList.remove("hidden");
    document.getElementById("admin").classList.remove("hidden");
  } else if (groups.includes("App-Engineer")) {
    role = "Engineer";
    document.getElementById("engineering").classList.remove("hidden");
  } else if (groups.includes("App-Sales")) {
    role = "Sales";
  }

  // ROLE BADGE
  const badge = document.getElementById("roleBadge");
  badge.innerText = role;
  badge.className = `role-badge ${role.toLowerCase()}`;

  document.getElementById("welcomeText").innerText =
    `Logged in as ${role}`;

  document.getElementById("userInfo").innerText =
    `${payload.name} (${payload.email})`;

  document.getElementById("groupInfo").innerText =
    `Groups: ${groups.join(", ")}`;

  document.getElementById("apiAccessText").innerText =
    `Frontend RBAC applied based on token groups`;
}

// ===== REDIRECT =====
async function handleRedirect() {
  const params = new URLSearchParams(window.location.search);
  const code = params.get("code");
  if (!code) return;

  const verifier = sessionStorage.getItem("pkce_code_verifier");

  const res = await fetch(`${oktaDomain}/oauth2/default/v1/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body:
      `grant_type=authorization_code` +
      `&client_id=${clientId}` +
      `&redirect_uri=${encodeURIComponent(redirectUri)}` +
      `&code=${code}` +
      `&code_verifier=${verifier}`,
  });

  const tokens = await res.json();

  const payload = decodeJwt(tokens.id_token);
  if (!validateIdToken(payload)) return;

  sessionStorage.setItem("access_token", tokens.access_token);
  sessionStorage.setItem("id_token", tokens.id_token);

  renderRoleBasedUI(payload);

  window.history.replaceState({}, document.title, redirectUri);
}

// ===== API CORE =====
async function callApi(endpoint) {
  const token = sessionStorage.getItem("access_token");
  const box = document.getElementById("apiResponseBox");

  box.innerText = "Loading...";

  try {
    const res = await fetch(`${apiBaseUrl}${endpoint}`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    const data = await res.json();

    if (!res.ok) {
      box.innerText = `❌ ${res.status}\n${JSON.stringify(data, null, 2)}`;
      box.style.background = "#7f1d1d";
      return;
    }

    box.innerText = `✅ SUCCESS\n${JSON.stringify(data, null, 2)}`;
    box.style.background = "#064e3b";

  } catch {
    box.innerText = "❌ Backend not running";
  }
}

// ===== API BUTTONS =====
function callVerify() { callApi("/verify"); }
function callSales() { callApi("/sales-data"); }
function callEngineering() { callApi("/engineering-data"); }
function callAdminData() { callApi("/admin-data"); }
function callAdminAPI() { callApi("/admin"); }

// ===== LOGOUT =====
function logout() {
  sessionStorage.clear();
  window.location.href =
    `${oktaDomain}/oauth2/default/v1/logout?post_logout_redirect_uri=${encodeURIComponent(redirectUri)}`;
}

// ===== INIT =====
handleRedirect();
