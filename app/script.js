const oktaDomain = "https://integrator-1985580.okta.com";
const clientId = "0oa12fmpdobnNarSF698";
const redirectUri = window.location.origin + "/okta-iam-architecture-lab/app/index.html";

let accessToken = null;

// LOGIN
function login() {
  const authUrl = `${oktaDomain}/oauth2/default/v1/authorize?` +
    `client_id=${clientId}` +
    `&response_type=code` +
    `&scope=openid profile email` +
    `&redirect_uri=${redirectUri}` +
    `&state=1234` +
    `&nonce=5678`;

  window.location.href = authUrl;
}

// HANDLE REDIRECT
function handleRedirect() {
  const hash = window.location.hash;

  if (hash.includes("access_token")) {
    const params = new URLSearchParams(hash.substring(1));
    accessToken = params.get("access_token");

    document.querySelector(".login-card").style.display = "none";
    document.getElementById("appContent").classList.remove("hidden");

    document.getElementById("welcomeText").innerText = "Logged in with Okta 🎉";
  }
}

// LOGOUT
function logout() {
  window.location.href = `${oktaDomain}/oauth2/default/v1/logout?post_logout_redirect_uri=${redirectUri}`;
}

// RUN ON LOAD
handleRedirect();
