const oktaDomain = "https://integrator-1985580.okta.com";
const clientId = "0oa12fnbbyuAYNWB9698";
const redirectUri = window.location.origin + "/okta-iam-architecture-lab/app/index.html";

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
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~";
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

  if (tokens.id_token) {
  sessionStorage.setItem("id_token", tokens.id_token);
}

  if (tokens.id_token || tokens.access_token) {
    document.querySelector(".login-card").style.display = "none";
    document.getElementById("appContent").classList.remove("hidden");
    document.getElementById("welcomeText").innerText = "Logged in with Okta 🎉";

    window.history.replaceState({}, document.title, redirectUri);
  } else {
    console.error(tokens);
    alert("Login failed. Check console.");
  }
}

function logout() {
  sessionStorage.clear();

  window.location.href =
    `${oktaDomain}/oauth2/default/v1/logout?` +
    `client_id=${clientId}` +
    `&post_logout_redirect_uri=${encodeURIComponent(redirectUri)}`;
}

handleRedirect();
