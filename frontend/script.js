// IMPORTANT: This URL is the Application Gateway's public DNS name (not a VM's IP)
const API_BASE_URL = "";

const form = document.getElementById("loginForm");
const messageEl = document.getElementById("message");
const submitBtn = document.getElementById("submitBtn");

form.addEventListener("submit", async (e) => {
  e.preventDefault();

  const username = document.getElementById("username").value.trim();
  const password = document.getElementById("password").value;

  if (!username || !password) {
    showMessage("Username and password are both required.", false);
    return;
  }

  setLoading(true);
  showMessage("", false);

  try {
    const res = await fetch(`${API_BASE_URL}/api/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password }),
    });

    const data = await res.json();

    if (!res.ok) {
      showMessage(data.message || "Login failed.", false);
      return;
    }

    localStorage.setItem("token", data.token);
    localStorage.setItem("apiBaseUrl", API_BASE_URL);

    showMessage("Login successful! Loading videos...", true);
    window.location.href = "videos.html";
  } catch (err) {
    showMessage("Could not connect to the server.", false);
  } finally {
    setLoading(false);
  }
});

function showMessage(text, success) {
  messageEl.textContent = text;
  messageEl.classList.toggle("success", success);
}

function setLoading(isLoading) {
  submitBtn.disabled = isLoading;
  submitBtn.textContent = isLoading ? "Signing in..." : "Sign in";
}
