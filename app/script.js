function login() {
  const role = document.getElementById("roleSelect").value;

  // Hide login card
  document.querySelector(".login-card").classList.add("hidden");

  // Show app
  document.getElementById("appContent").classList.remove("hidden");

  // Set welcome text
  document.getElementById("welcomeText").innerText =
    "Logged in as: " + role.toUpperCase();

  // Reset visibility
  document.getElementById("dashboard").classList.remove("hidden");
  document.getElementById("engineering").classList.add("hidden");
  document.getElementById("admin").classList.add("hidden");

  // Role-based access
  if (role === "engineer") {
    document.getElementById("engineering").classList.remove("hidden");
  }

  if (role === "admin") {
    document.getElementById("engineering").classList.remove("hidden");
    document.getElementById("admin").classList.remove("hidden");
  }
}

function logout() {
  // Reset UI
  document.querySelector(".login-card").classList.remove("hidden");
  document.getElementById("appContent").classList.add("hidden");
}
