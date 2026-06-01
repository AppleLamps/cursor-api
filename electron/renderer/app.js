const api = window.apiForCursor;

const $ = (id) => document.getElementById(id);

function render(state) {
  const { settings, server, integrations, integrationError } = state;
  const base = server.baseUrl || `http://127.0.0.1:${settings.publicPort}/v1`;

  $("base-url").textContent = base;
  $("chat-url").textContent = `${base}/chat/completions`;
  $("models-url").textContent = `${base}/models`;

  const badge = $("status-badge");
  if (server.ready) {
    badge.textContent = "Ready";
    badge.className = "badge ready";
  } else if (server.running) {
    badge.textContent = "Starting…";
    badge.className = "badge running";
  } else if (server.error) {
    badge.textContent = "Error";
    badge.className = "badge";
  } else {
    badge.textContent = "Stopped";
    badge.className = "badge";
  }

  const errorBanner = $("error-banner");
  const errorMessage = server.error || integrationError || "";
  if (errorMessage) {
    errorBanner.textContent = errorMessage;
    errorBanner.classList.remove("hidden");
  } else {
    errorBanner.textContent = "";
    errorBanner.classList.add("hidden");
  }

  const keyBanner = $("key-banner");
  if (!server.apiKeyUnlocked) {
    keyBanner.textContent = "Save your Cursor API key before starting the server.";
    keyBanner.classList.remove("hidden");
  } else if (server.apiKeyStorage === "plaintext") {
    keyBanner.textContent =
      "API key is stored in settings.json without OS encryption (DPAPI unavailable). Restrict file permissions on your user profile.";
    keyBanner.classList.remove("hidden");
  } else if (server.running && !server.ready && !server.error) {
    keyBanner.textContent = "Server is starting…";
    keyBanner.classList.remove("hidden");
  } else {
    keyBanner.classList.add("hidden");
  }

  $("btn-start").disabled = server.running || !server.apiKeyUnlocked;
  $("btn-stop").disabled = !server.running;
  // The real key is never sent to the renderer. Show whether one is saved via the
  // placeholder, and avoid clobbering whatever the user is currently typing.
  const keyField = $("api-key");
  if (document.activeElement !== keyField) {
    keyField.value = "";
    keyField.placeholder = server.apiKeyConfigured ? "•••••••• (saved — type to replace)" : "cr_…";
  }

  const list = $("integrations");
  list.innerHTML = "";
  for (const item of integrations) {
    const li = document.createElement("li");
    li.innerHTML = `
      <span class="name">${labelFor(item.id)}</span>
      <span class="detail">${item.detail}</span>
      ${item.installed ? '<span class="installed">Installed</span>' : ""}
    `;
    if (item.canInstall && !item.installed) {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.textContent = "Install";
      btn.disabled = !server.ready;
      btn.title = server.ready ? "" : "Start the server first so install uses the correct base URL";
      btn.addEventListener("click", () => api.installIntegration(item.id));
      li.appendChild(btn);
    }
    list.appendChild(li);
  }

  $("logs").textContent = (server.logs || []).join("\n") || "(no logs yet)";
  $("logs").scrollTop = $("logs").scrollHeight;
}

function labelFor(id) {
  const labels = {
    opencode: "OpenCode",
    codex: "Codex",
    vscode: "VS Code",
    cline: "Cline",
    kilo: "Kilo Code",
    pi: "pi"
  };
  return labels[id] || id;
}

document.querySelectorAll("[data-copy]").forEach((btn) => {
  btn.addEventListener("click", () => {
    const id = btn.getAttribute("data-copy");
    const text = $(id)?.textContent;
    if (text) navigator.clipboard.writeText(text);
  });
});

$("btn-start").addEventListener("click", async () => {
  $("btn-start").disabled = true;
  try {
    await api.startServer();
  } finally {
    // state refresh via broadcast
  }
});
$("btn-stop").addEventListener("click", () => api.stopServer());
$("btn-save-key").addEventListener("click", () => {
  const value = $("api-key").value.trim();
  if (!value) return; // empty field means "leave the saved key unchanged"
  api.saveSettings({ cursorApiKey: value });
  $("api-key").value = "";
});

api.getState().then(render);
api.onState(render);
