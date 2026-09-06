const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => [...document.querySelectorAll(selector)];
const api = async (path, options = {}) => {
  const headers = { ...(options.headers || {}) };
  if (options.body) headers["Content-Type"] = "application/json";
  const response = await fetch(`/api/v1${path}`, {
    credentials: "include",
    headers,
    ...options,
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.error || "Request failed");
  return body;
};
const escapeHtml = (value) => String(value ?? "").replace(/[&<>'"]/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[character]);
const number = (value) => new Intl.NumberFormat("en-IN").format(Number(value) || 0);
const date = (value) => value ? new Date(value).toLocaleString("en-IN") : "—";
let currentView = "overview";

async function health() {
  try { await fetch("/api/v1/health").then((response) => { if (!response.ok) throw new Error(); }); $("#serverStatus").textContent = "G58 Core online"; }
  catch { $("#serverStatus").textContent = "Server unavailable"; }
}

async function session() {
  try {
    const { user } = await api("/auth/me");
    if (!["admin", "super_admin"].includes(user.role)) throw new Error("Administrator access required");
    openConsole();
  } catch { showLogin(); }
}

function showLogin() { $("#loginView").classList.remove("hidden"); $("#consoleView").classList.add("hidden"); $("#logoutButton").classList.add("hidden"); }
function openConsole() { $("#loginView").classList.add("hidden"); $("#consoleView").classList.remove("hidden"); $("#logoutButton").classList.remove("hidden"); render(); }

$("#loginForm").addEventListener("submit", async (event) => {
  event.preventDefault();
  const button = event.submitter;
  button.disabled = true;
  $("#loginMessage").textContent = "";
  try {
    const values = Object.fromEntries(new FormData(event.currentTarget));
    const { user } = await api("/auth/login", { method: "POST", body: JSON.stringify(values) });
    if (!["admin", "super_admin"].includes(user.role)) { await api("/auth/logout", { method: "POST" }); throw new Error("Administrator access required"); }
    openConsole();
  } catch (error) { $("#loginMessage").textContent = error.message; }
  finally { button.disabled = false; }
});

$("#forgotButton").onclick = async () => {
  const button = $("#forgotButton");
  const email = new FormData($("#loginForm")).get("email")?.trim();
  if (!email) {
    $("#loginMessage").textContent = "Enter the administrator email address first.";
    return;
  }
  button.disabled = true;
  $("#loginMessage").textContent = "";
  try {
    const result = await api("/auth/forgot-password", { method: "POST", body: JSON.stringify({ email }) });
    $("#loginMessage").textContent = result.message || "If the account exists, reset instructions will arrive shortly.";
  } catch (error) {
    $("#loginMessage").textContent = error.message;
  } finally { button.disabled = false; }
};

$("#logoutButton").onclick = async () => { await api("/auth/logout", { method: "POST" }).catch(() => {}); showLogin(); };
$("#refreshButton").onclick = () => render();
$$('.nav').forEach((button) => button.onclick = () => {
  currentView = button.dataset.view;
  $$('.nav').forEach((item) => item.classList.toggle("active", item === button));
  render();
});

async function render() {
  const content = $("#content");
  content.innerHTML = '<div class="panel empty">Loading secure data…</div>';
  try {
    if (currentView === "overview") await overview(content);
    if (currentView === "users") await users(content);
    if (currentView === "records") await records(content);
    if (currentView === "audit") await audit(content);
  } catch (error) { content.innerHTML = `<div class="panel empty">${escapeHtml(error.message)}</div>`; }
}

async function overview(content) {
  $("#viewTitle").textContent = "Infrastructure overview";
  const { stats } = await api("/admin/stats");
  const cards = [
    ["Registered accounts", stats.users], ["Active sessions", stats.active_sessions],
    ["Application records", stats.records], ["Media files", stats.files],
  ];
  content.innerHTML = `<div class="stats">${cards.map(([label,value]) => `<article class="panel stat"><small>${escapeHtml(label)}</small><strong>${number(value)}</strong></article>`).join("")}</div><article class="panel table-card"><table><tbody><tr><th>Backend</th><td>G58 Core</td><td><span class="status">Operational</span></td></tr><tr><th>Database</th><td>Self-hosted PostgreSQL</td><td><span class="status">Connected</span></td></tr><tr><th>Storage used</th><td>${formatBytes(stats.media_bytes)}</td><td>Local encrypted server volume</td></tr><tr><th>Data types</th><td>${number(stats.kinds)}</td><td>Active record collections</td></tr></tbody></table></article>`;
}

async function users(content) {
  $("#viewTitle").textContent = "Accounts and access";
  const { users } = await api("/admin/users");
  content.innerHTML = `<article class="panel table-card"><table><thead><tr><th>Name</th><th>Email</th><th>Role</th><th>Status</th><th>Created</th></tr></thead><tbody>${users.map((user) => `<tr><td>${escapeHtml(user.name || (user.isGuest ? "Guest" : "—"))}</td><td>${escapeHtml(user.email || "—")}</td><td>${escapeHtml(user.role)}</td><td><span class="status">${escapeHtml(user.status)}</span></td><td>${date(user.$createdAt)}</td></tr>`).join("")}</tbody></table></article>`;
}

async function records(content) {
  $("#viewTitle").textContent = "Application data";
  const { kinds } = await api("/admin/kinds");
  content.innerHTML = `<article class="panel table-card"><table><thead><tr><th>Collection</th><th>Records</th><th>Last change</th></tr></thead><tbody>${kinds.map((kind) => `<tr><td><strong>${escapeHtml(kind.kind)}</strong></td><td>${number(kind.count)}</td><td>${date(kind.updated_at)}</td></tr>`).join("") || '<tr><td colspan="3" class="empty">No application records yet.</td></tr>'}</tbody></table></article>`;
}

async function audit(content) {
  $("#viewTitle").textContent = "Security audit trail";
  const { events } = await api("/admin/audit");
  content.innerHTML = `<article class="panel table-card"><table><thead><tr><th>Action</th><th>Resource</th><th>Actor</th><th>Time</th></tr></thead><tbody>${events.map((event) => `<tr><td>${escapeHtml(event.action)}</td><td>${escapeHtml(event.resource_type)} · ${escapeHtml(event.resource_id || "—")}</td><td>${escapeHtml(event.actor_id || "System")}</td><td>${date(event.created_at)}</td></tr>`).join("") || '<tr><td colspan="4" class="empty">No audit events yet.</td></tr>'}</tbody></table></article>`;
}

function formatBytes(value) {
  const bytes = Number(value) || 0;
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 ** 2) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 ** 3) return `${(bytes / 1024 ** 2).toFixed(1)} MB`;
  return `${(bytes / 1024 ** 3).toFixed(2)} GB`;
}

health();
session();
