const oktaDomain = "https://integrator-1985580.okta.com";
const clientId = "0oa12fnbbyuAYNWB9698";
const redirectUri =
  window.location.origin + "/okta-iam-architecture-lab/app/index.html";

// Local backend API
const apiBaseUrl = "http://localhost:3000";

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

  randomValues.forEach((value) => {
    result += chars[value % chars.length];
  });

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

function decodeJwt(token) {
  const payload = token.split(".")[1];
  const decodedPayload = atob(payload.replace(/-/g, "+").replace(/_/g, "/"));
  return JSON.parse(decodedPayload);
}

function validateIdToken(payload) {
  const expectedIssuer = `${oktaDomain}/oauth2/default`;

  if (payload.iss !== expectedIssuer) {
    alert("Invalid issuer");
    return false;
  }

  if (payload.aud !== clientId) {
    alert("Invalid audience");
    return false;
  }

  if (Date.now() / 1000 > payload.exp) {
    alert("Token expired");
    return false;
  }

  return true;
}

function renderRoleBasedUI(payload) {
  const groups = payload.groups || [];

  document.querySelector(".login-card").style.display = "none";
  document.getElementById("appContent").classList.remove("hidden");

  document.getElementById("dashboard").classList.remove("hidden");
  document.getElementById("engineering").classList.add("hidden");
  document.getElementById("admin").classList.add("hidden");

  let roleText = "User";

  if (groups.includes("App-Admin")) {
    roleText = "Admin";
    document.getElementById("engineering").classList.remove("hidden");
    document.getElementById("admin").classList.remove("hidden");
    document.getElementById("apiAccessText").innerText =
      "Admin access granted: user has App-Admin group claim.";
  } else if (groups.includes("App-Engineer")) {
    roleText = "Engineer";
    document.getElementById("engineering").classList.remove("hidden");
    document.getElementById("apiAccessText").innerText =
      "Admin access denied: engineer role does not have App-Admin claim.";
  } else if (groups.includes("App-Sales")) {
    roleText = "Sales";
    document.getElementById("apiAccessText").innerText =
      "Admin access denied: sales role is limited to dashboard access.";
  } else {
    document.getElementById("apiAccessText").innerText =
      "No matching App-* group found. Defaulting to basic user access.";
  }

  document.getElementById("welcomeText").innerText =
    `Logged in as ${roleText} via Okta 🎉`;

  document.getElementById("userInfo").innerText =
    `User: ${payload.name || "Unknown"} (${payload.email || "No email claim"})`;

  document.getElementById("groupInfo").innerText =
    `Okta Groups: ${
      groups.length ? groups.join(", ") : "No App-* group claim found"
    }`;

  console.log("ID Token Payload:", payload);
  console.log("User groups:", groups);
}

async function handleRedirect() {
  const params = new URLSearchParams(window.location.search);
  const code = params.get("code");

  if (!code) return;

  const codeVerifier = sessionStorage.getItem("pkce_code_verifier");

  const tokenResponse = await fetch(`${oktaDomain}/oauth2/default/v1/token`, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body:
      `grant_type=authorization_code` +
      `&client_id=${clientId}` +
      `&redirect_uri=${encodeURIComponent(redirectUri)}` +
      `&code=${code}` +
      `&code_verifier=${codeVerifier}`,
  });

  const tokens = await tokenResponse.json();

  if (!tokens.id_token || !tokens.access_token) {
    console.error(tokens);
    alert("Login failed. Check console.");
    return;
  }

  const payload = decodeJwt(tokens.id_token);

  if (!validateIdToken(payload)) return;

  sessionStorage.setItem("id_token", tokens.id_token);
  sessionStorage.setItem("access_token", tokens.access_token);

  renderRoleBasedUI(payload);

  window.history.replaceState({}, document.title, redirectUri);
}

async function callAdminAPI() {
  callApi("/admin");
}

async function callApi(endpoint) {
  const accessToken = sessionStorage.getItem("access_token");

  if (!accessToken) {
    alert("Not authenticated");
    return;
  }

  const output = document.getElementById("apiResponseBox");

  if (output) {
    output.innerText = `Calling ${endpoint}...`;
  }

  try {
    const response = await fetch(`${apiBaseUrl}${endpoint}`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    const data = await response.json();

    if (!output) {
      alert(data.message || "API call complete");
      return;
    }

    if (!response.ok) {
      output.innerText = `❌ ${response.status} ERROR\n\n${JSON.stringify(
        data,
        null,
        2
      )}`;
      return;
    }

    output.innerText = `✅ SUCCESS\n\n${JSON.stringify(data, null, 2)}`;
  } catch (error) {
    if (output) {
      output.innerText =
        "❌ Backend not running. Start the Node.js server first.";
    }

    alert("Backend not running. Start the Node.js server first.");
    console.error(error);
  }
}

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

function restoreSession() {
  const idToken = sessionStorage.getItem("id_token");

  if (!idToken) return;

  const payload = decodeJwt(idToken);

  if (validateIdToken(payload)) {
    renderRoleBasedUI(payload);
  } else {
    sessionStorage.clear();
  }
}

handleRedirect();
restoreSession();
