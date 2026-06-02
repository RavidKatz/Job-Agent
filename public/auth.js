export async function setupAuth({ onUserChange } = {}) {
  const authPanel = document.querySelector("#authPanel");
  const authForm = document.querySelector("#authForm");
  const mainWorkspace = document.querySelector("#mainWorkspace");
  const displayName = document.querySelector("#displayName");
  const username = document.querySelector("#username");
  const password = document.querySelector("#password");
  const registerButton = document.querySelector("#registerButton");
  const logoutButton = document.querySelector("#logoutButton");
  const authStatus = document.querySelector("#authStatus");
  let currentUser = null;

  async function requestJson(url, options = {}) {
    const response = await fetch(url, {
      headers: { "Content-Type": "application/json", ...(options.headers ?? {}) },
      ...options
    });
    const payload = await response.json();
    if (!response.ok) throw new Error(payload.error || "Request failed.");
    return payload;
  }

  function getAuthValues() {
    return {
      displayName: displayName?.value?.trim(),
      username: username?.value?.trim(),
      password: password?.value
    };
  }

  function setAuthStatus(text, isError = false) {
    if (!authStatus) return;
    authStatus.textContent = text;
    authStatus.classList.toggle("error", isError);
  }

  function updateUi(user) {
    currentUser = user;
    const requiresAuth = mainWorkspace?.dataset.authRequired === "true";
    document.body.classList.toggle("is-authenticated", Boolean(user));
    if (authPanel) authPanel.hidden = Boolean(user);
    if (mainWorkspace) mainWorkspace.hidden = requiresAuth ? !user : false;
    if (logoutButton) {
      logoutButton.hidden = !user;
      logoutButton.textContent = user ? `Logout ${user.displayName || user.username}` : "Logout";
    }
    onUserChange?.(user);
  }

  async function refreshUser() {
    const payload = await requestJson("/api/me");
    updateUi(payload.user);
    return payload.user;
  }

  async function submitAuth(mode) {
    const payload = await requestJson(mode === "register" ? "/api/register" : "/api/login", {
      method: "POST",
      body: JSON.stringify(getAuthValues())
    });
    setAuthStatus(`Logged in as ${payload.user.displayName || payload.user.username}`);
    updateUi(payload.user);
  }

  authForm?.addEventListener("submit", async (event) => {
    event.preventDefault();
    try {
      setAuthStatus("Checking your login details...");
      await submitAuth("login");
    } catch (error) {
      const message = /invalid username or password/i.test(error.message)
        ? "Login failed. Check the email and password, or create a new account with a different email."
        : error.message;
      setAuthStatus(message, true);
    }
  });

  registerButton?.addEventListener("click", async () => {
    try {
      setAuthStatus("Creating your account...");
      await submitAuth("register");
    } catch (error) {
      const message = /already exists/i.test(error.message)
        ? "This account already exists. Use Login with the original password, or use a different email."
        : error.message;
      setAuthStatus(message, true);
    }
  });

  logoutButton?.addEventListener("click", async () => {
    await requestJson("/api/logout", { method: "POST", body: "{}" });
    updateUi(null);
    setAuthStatus("Logged out.");
  });

  try {
    await refreshUser();
  } catch {
    updateUi(null);
  }

  return {
    get currentUser() {
      return currentUser;
    },
    refreshUser
  };
}
