// ============================================================
// Enterprise IAM Demo App — script.js
// Handles: PKCE generation, Okta OIDC login, JWT decoding,
// token validation, RBAC-based UI rendering, backend API calls,
// AWS simulation, audit logging, and logout.
// ============================================================

const oktaDomain = "https://integrator-1985580.okta.com";
const clientId = "0oa12fnbbyuAYNWB9698";

// Redirect URI must exactly match what is registered in Okta
const redirectUri =
  window.location.origin + "/okta-iam-architecture-lab/app/index.html";

// Backend API hosted on Render — validates JWTs and enforces RBAC
const apiBaseUrl = "https://okta-iam-backend.onrender.com";

// Tracks the current user's role for use in UI and audit messages
let currentRole = "User";


// ============================================================
// PKCE HELPERS
// PKCE (Proof Key for Code Exchange) prevents authorization code
// interception attacks in public clients (SPAs with no client secret).
// We generate a random code_verifier, hash it into a code_challenge,
// and send the challenge to Okta. When exchanging the code for tokens,
// we prove we hold the original verifier.
// ============================================================

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


// ============================================================
// LOGIN
// Initiates the Okta OIDC Authorization Code Flow with PKCE.
// 1. Generate PKCE verifier + challenge
// 2. Store verifier in sessionStorage (needed for token exchange)
// 3. Redirect browser to Okta's /authorize endpoint
// ============================================================

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


// ============================================================
// JWT HELPERS
// JWTs are base64url-encoded. We decode the payload (middle segment)
// to read identity claims like sub, iss, aud, exp, and groups.
// NOTE: This is client-side decoding for display purposes only.
// Signature verification happens server-side in the backend.
// ============================================================

function decodeJwt(token) {
  const payload = token.split(".")[1];
  return JSON.parse(atob(payload.replace(/-/g, "+").replace(/_/g, "/")));
}

// Basic client-side validation of the ID token claims.
// A production app would verify the JWT signature using Okta's JWKS endpoint.
function validateIdToken(payload) {
  const expectedIssuer = `${oktaDomain}/oauth2/default`;

  if (payload.iss !== expectedIssuer) {
    alert("Invalid issuer.");
    return false;
  }

  // The audience must match our client ID
  if (payload.aud !== clientId) {
    alert("Invalid audience.");
    return false;
  }

  // Check token expiration (exp is in seconds, Date.now() is in ms)
  if (Date.now() / 1000 > payload.exp) {
    alert("Token expired.");
    return false;
  }

  return true;
}

function formatUnixTime(unixTime) {
  if (!unixTime) return "N/A";
  return new Date(unixTime * 1000).toLocaleString();
}


// ============================================================
// AUDIT LOGGING
// Records all significant events: login, API calls, access
// decisions, and AWS federation activity. In a real enterprise
// app, these would be sent to a SIEM or log aggregation service.
// ============================================================

function addLog(message) {
  const logList = document.getElementById("logList");
  if (!logList) return;

  const li = document.createElement("li");
  li.className = "audit-log-item";

  // Determine the log type based on message keywords
  let type = "INFO";
  const lower = message.toLowerCase();

  if (lower.includes("denied")) type = "DENIED";
  if (lower.includes("granted") || lower.includes("successful")) type = "SUCCESS";
  // Only tag as FEDERATION for real federation events, not simulations
  if ((lower.includes("aws") || lower.includes("federation")) && !lower.includes("simul")) type = "FEDERATION";
  if (lower.includes("simul")) type = "SIM";

  li.innerHTML = `
    <span class="audit-time">${new Date().toLocaleTimeString()}</span>
    <span class="audit-type ${type.toLowerCase()}">${type}</span>
    <span class="audit-message">${message}</span>
  `;

  logList.prepend(li);
}


// ============================================================
// TOKEN INSPECTOR
// Displays key JWT claims in the UI so viewers can see what
// Okta actually returns inside the token.
// ============================================================

function renderTokenInspector(payload) {
  document.getElementById("ti-sub").innerText = payload.sub || "N/A";
  document.getElementById("ti-iss").innerText = payload.iss || "N/A";
  document.getElementById("ti-aud").innerText = payload.aud || "N/A";
  document.getElementById("ti-exp").innerText = formatUnixTime(payload.exp);
  document.getElementById("ti-groups").innerText =
    payload.groups?.join(", ") || "No groups";
}


// ============================================================
// RBAC — ROLE-BASED UI RENDERING
// After login, we read the Okta group claims from the JWT.
// The UI is shown or hidden based on group membership.
// Groups are named App-Admin, App-Engineer, App-Sales in Okta.
// IMPORTANT: This is frontend RBAC for UX purposes only.
// The backend independently enforces access — never trust
// the frontend alone to protect sensitive resources.
// ============================================================

function renderRoleBasedUI(payload) {
  const groups = payload.groups || [];

  // Hide the login card, show the authenticated app content
  document.querySelector(".login-card").style.display = "none";
const howItWorks = document.getElementById("howItWorks");
if (howItWorks) howItWorks.style.display = "none";
  document.getElementById("appContent").classList.remove("hidden");

  // Reset cards to hidden before applying role-based visibility
  document.getElementById("engineering").classList.add("hidden");
  document.getElementById("admin").classList.add("hidden");

  currentRole = "User";

  // Apply visibility based on Okta group membership
  if (groups.includes("App-Admin")) {
    currentRole = "Admin";
    document.getElementById("engineering").classList.remove("hidden");
    document.getElementById("admin").classList.remove("hidden");
  } else if (groups.includes("App-Engineer")) {
    currentRole = "Engineer";
    document.getElementById("engineering").classList.remove("hidden");
  } else if (groups.includes("App-Sales")) {
    currentRole = "Sales";
    // Sales users see Dashboard only — no Engineering Tools or Admin Panel
  }

  // AWS Console card is only shown to Admin and Engineer roles
  const awsCard = document.getElementById("awsCard");
  if (awsCard) {
    awsCard.style.display =
      groups.includes("App-Engineer") || groups.includes("App-Admin")
        ? "block"
        : "none";
  }

  // Update role badge with the appropriate color class
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
    "Frontend RBAC applied based on Okta group claims. Backend APIs independently validate JWTs and enforce group-based access.";

  renderTokenInspector(payload);
  addLog(`Login successful as ${currentRole}`);
}


// ============================================================
// REDIRECT HANDLER
// After Okta redirects back with an authorization code,
// we exchange it for tokens using the PKCE code verifier.
// Tokens are stored in sessionStorage for the session duration.
// NOTE: sessionStorage is acceptable for demos. Production apps
// should use HTTP-only cookies to prevent XSS token theft.
// ============================================================

async function handleRedirect() {
  const params = new URLSearchParams(window.location.search);
  const code = params.get("code");
  if (!code) return; // Not a redirect — normal page load

  const verifier = sessionStorage.getItem("pkce_code_verifier");

  // Exchange the authorization code for ID + Access tokens
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

  // Decode and validate the ID token claims
  const payload = decodeJwt(tokens.id_token);
  if (!validateIdToken(payload)) return;

  // Store tokens for use in backend API calls
  sessionStorage.setItem("access_token", tokens.access_token);
  sessionStorage.setItem("id_token", tokens.id_token);

  // Apply role-based UI based on Okta group claims
  renderRoleBasedUI(payload);

  // Clean the authorization code from the URL
  window.history.replaceState({}, document.title, redirectUri);
}


// ============================================================
// ACCESS DENIED UI
// Displayed when the backend returns a 403 for an unauthorized
// API call. Shows the user's current role and which endpoint
// they were denied access to.
// ============================================================

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


// ============================================================
// BACKEND API — CORE CALL FUNCTION
// Sends the Okta access token in the Authorization header.
// The backend (Node.js on Render) validates the JWT signature
// using Okta's JWKS endpoint and checks group membership before
// returning data or a 403.
// ============================================================

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
      // Backend returned 403 — access denied by RBAC policy
      box.innerText = `❌ ${res.status} DENIED\n\n${JSON.stringify(data, null, 2)}`;
      box.style.background = "#7f1d1d";

      pill.innerText = "Denied";
      pill.className = "status-pill error";

      showAccessDenied(endpoint, data);
      return;
    }

    // Access granted — display the response
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
    console.error(err);
  }
}


// ============================================================
// API BUTTON HANDLERS
// Each button maps to a specific backend endpoint.
// The backend enforces RBAC independently of the frontend.
// ============================================================

function callVerify() {
  callApi("/verify");           // Any authenticated user
}

function callSales() {
  callApi("/sales-data");       // Requires App-Sales or App-Admin
}

function callEngineering() {
  callApi("/engineering-data"); // Requires App-Engineer or App-Admin
}

function callAdminData() {
  callApi("/admin-data");       // Requires App-Admin only
}

// Called from the Admin Panel card button — same endpoint as Admin API button
function callAdminAPI() {
  callApi("/admin-data");       // Fixed: was incorrectly calling /admin
}


// ============================================================
// AWS ACCESS SIMULATION
// S3 and RDS cards are simulated — they do not make real AWS API
// calls. They demonstrate what role-based cloud access would look
// like. The AWS Console button is a real Okta SAML federation link.
// ============================================================

function simulateAWS(service) {
  const box = document.getElementById("apiResponseBox");
  const pill = document.getElementById("apiStatusPill");

  hideAccessDenied();
  addLog(`AWS ${service} access simulation started`);

  const result = {
    service,
    type: "AWS Access Simulation (Not a real API call)",
    currentRole,
    explanation:
      service === "S3"
        ? "Simulates read-only access to Amazon S3 through role-based permissions."
        : "Simulates database access to Amazon RDS through role-based permissions.",
    decision:
      service === "S3"
        ? "Allowed for Sales/Admin-style access"
        : "Allowed for Engineer/Admin-style access",
  };

  box.innerText = `☁️ AWS ${service} ACCESS SIMULATION\n\n${JSON.stringify(result, null, 2)}`;
  box.style.background = "#064e3b";

  pill.innerText = "Simulated";
  pill.className = "status-pill success";

  addLog(`AWS ${service} simulated access displayed`);
}


// ============================================================
// LOGOUT
// Clears sessionStorage and redirects to Okta's logout endpoint.
// Passing id_token_hint lets Okta skip the "are you sure?" screen.
// ============================================================

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


// ============================================================
// INIT
// On page load, check if we're returning from Okta with a code.
// ============================================================
handleRedirect();
