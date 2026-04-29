const oktaDomain = "https://integrator-1985580.okta.com";
const clientId = "0oa12fnbbyuAYNWB9698";
const redirectUri =
  window.location.origin + "/okta-iam-architecture-lab/app/index.html";

const apiBaseUrl = "https://okta-iam-backend.onrender.com";

let currentRole = "User";

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
  addLog("Login started — redirecting to Okta");
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

function formatUnixTime(unixTime) {
  if (!unixTime) return "N/A";
  return new Date(unixTime * 1000).toLocaleString();
}

// ===== LOGGING =====
function addLog(message) {
  const logList = document.getElementById("logList");
  if (!logList) return;

  const li = document.createElement("li");
  li.textContent = `${new Date().toLocaleTimeString()} — ${message}`;
  logList.prepend(li);
}

// ===== TOKEN INSPECTOR =====
function renderTokenInspector(payload) {
  document.getElementById("ti-sub").innerText = payload.sub || "N/A";
  document.getElementById("ti-iss").innerText = payload.iss || "N/A";
  document.getElementById("ti-aud").innerText = payload.aud || "N/A";
  document.getElementById("ti-exp").innerText = formatUnixTime(payload.exp);
  document.getElementById("ti-groups").innerText =
    payload.groups?.join(", ") || "No groups";
}

// ===== UI =====
function renderRoleBasedUI(payload) {
  const groups = payload.groups || [];

  document.querySelector(".login-card").style.display = "none";
  document.getElementById("appContent").classList.remove("hidden");

  document.getElementById("engineering").classList.add("hidden");
  document.getElementById("admin").classList.add("hidden");

  currentRole = "User";

  if (groups.includes("App-Admin")) {
    currentRole = "Admin";
    document.getElementById("engineering").classList.remove("hidden");
    document.getElementById("admin").classList.remove("hidden");
  } else if (groups.includes("App-Engineer")) {
    currentRole = "Engineer";
    document.getElementById("engineering").classList.remove("hidden");
  } else if (groups.includes("App-Sales")) {
    currentRole = "Sales";
  }

  const badge = document.getElementById("roleBadge");
  badge.innerText = currentRole;
  badge.className = `role-badge ${currentRole.toLowerCase()}`;

  document.getElementById("welcomeText").innerText =
    `Logged in as ${currentRole}`;

  document.getElementById("userInfo").innerText =
    `${payload.name || "Unknown"} (${payload.email || "No email claim"})`;

  document.getElementById("groupInfo").innerText =
    `Groups: ${groups.length ? groups.join(", ") : "No groups found"}`;

  document.getElementById("apiAccessText").innerText =
    "Frontend RBAC applied (UI) — Backend enforces real security via JWT + group claims.";

  renderTokenInspector(payload);
  addLog(`Login successful as ${currentRole}`);
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

  if (!tokens.id_token || !tokens.access_token) {
    alert("Login failed. Check console.");
    console.error(tokens);
    return;
  }

  const payload = decodeJwt(tokens.id_token);

  if (!validateIdToken(payload)) {
    alert("Invalid ID token.");
    return;
  }

  sessionStorage.setItem("access_token", tokens.access_token);
  sessionStorage.setItem("id_token", tokens.id_token);

  renderRoleBasedUI(payload);

  window.history.replaceState({}, document.title, redirectUri);
}

// ===== ACCESS DENIED UI =====
function showAccessDenied(endpoint, data) {
  const card = document.getElementById("accessDeniedCard");
  const text = document.getElementById("deniedText");

  card.classList.remove("hidden");
  text.innerText =
    `Your current role (${currentRole}) does not have permission to access ${endpoint}.\n` +
    `${data.message || "Access denied by backend RBAC policy."}`;

  addLog(`Access denied for ${endpoint}`);
}

function hideAccessDenied() {
  document.getElementById("accessDeniedCard").classList.add("hidden");
}

// ===== API CORE =====
async function callApi(endpoint) {
  const token = sessionStorage.getItem("access_token");
  const box = document.getElementById("apiResponseBox");
  const pill = document.getElementById("apiStatusPill");

  hideAccessDenied();

  box.innerText = `Calling ${endpoint}...`;
  box.style.background = "#1e293b";

  pill.innerText = "Loading";
  pill.className = "status-pill loading";

  addLog(`API call started: ${endpoint}`);

  try {
    const res = await fetch(`${apiBaseUrl}${endpoint}`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    const data = await res.json();

    if (!res.ok) {
      box.innerText = `❌ ${res.status} DENIED\n\n${JSON.stringify(data, null, 2)}`;
      box.style.background = "#7f1d1d";

      pill.innerText = "Denied";
      pill.className = "status-pill error";

      showAccessDenied(endpoint, data);
      return;
    }

    box.innerText = `✅ SUCCESS\n\n${JSON.stringify(data, null, 2)}`;
    box.style.background = "#064e3b";

    pill.innerText = "Success";
    pill.className = "status-pill success";

    addLog(`Access granted for ${endpoint}`);
  } catch (err) {
    box.innerText = "❌ Backend not reachable";
    box.style.background = "#7f1d1d";

    pill.innerText = "Error";
    pill.className = "status-pill error";

    addLog("Backend not reachable");
  }
}

// ===== API BUTTONS =====
function callVerify() {
  callApi("/verify");
}

function callSales() {
  callApi("/sales-data");
}

function callEngineering() {
  callApi("/engineering-data");
}

function callAdminData() {
  callApi("/admin-data");
}

function callAdminAPI() {
  callApi("/admin");
}

function simulateAWS(service) {
  addLog(`AWS access attempt: ${service}`);

  if (!accessToken) {
    updateAPIStatus("error");
    showAPIResponse("❌ Not authenticated");
    return;
  }

  const payload = parseJwt(accessToken);
  const groups = payload.groups || [];

  let allowed = false;

  if (service === "S3") {
    allowed = groups.includes("App-Sales") || groups.includes("App-Admin");
  }

  if (service === "RDS") {
    allowed = groups.includes("App-Engineer") || groups.includes("App-Admin");
  }

  if (service === "Console") {
    allowed = groups.includes("App-Admin");
  }

function simulateAWS(service) {
  const token = sessionStorage.getItem("access_token");
  const box = document.getElementById("apiResponseBox");
  const pill = document.getElementById("apiStatusPill");

  hideAccessDenied();
  addLog(`AWS access attempt: ${service}`);

  if (!token) {
    box.innerText = "❌ Not authenticated";
    box.style.background = "#7f1d1d";
    pill.innerText = "Error";
    pill.className = "status-pill error";
    return;
  }

  const payload = decodeJwt(token);
  const groups = payload.groups || [];

  let allowed = false;

  if (service === "S3") {
    allowed = groups.includes("App-Sales") || groups.includes("App-Admin");
  }

  if (service === "RDS") {
    allowed = groups.includes("App-Engineer") || groups.includes("App-Admin");
  }

  if (service === "Console") {
    allowed = groups.includes("App-Admin");
  }

  const result = {
    service,
    type: "AWS Federated Access Simulation",
    currentRole,
    userGroups: groups,
    decision: allowed ? "Access granted" : "Access denied",
  };

  if (allowed) {
    box.innerText = `✅ AWS ${service} ACCESS GRANTED\n\n${JSON.stringify(result, null, 2)}`;
    box.style.background = "#064e3b";

    pill.innerText = "Success";
    pill.className = "status-pill success";

    addLog(`AWS ${service} access granted`);
  } else {
    box.innerText = `❌ AWS ${service} ACCESS DENIED\n\n${JSON.stringify(result, null, 2)}`;
    box.style.background = "#7f1d1d";

    pill.innerText = "Denied";
    pill.className = "status-pill error";

    showAccessDenied(`AWS ${service}`, {
      message: `Required AWS permission not mapped to ${currentRole} role.`,
    });

    addLog(`AWS ${service} access denied`);
  }
}

// ===== LOGOUT =====
function logout() {
  const idToken = sessionStorage.getItem("id_token");
  sessionStorage.clear();

  let logoutUrl =
    `${oktaDomain}/oauth2/default/v1/logout?` +
    `post_logout_redirect_uri=${encodeURIComponent(redirectUri)}`;

  if (idToken) {
    logoutUrl += `&id_token_hint=${idToken}`;
  }

  window.location.href = logoutUrl;
}

// ===== INIT =====
handleRedirect();
