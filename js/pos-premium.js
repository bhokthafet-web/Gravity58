(() => {
  "use strict";

  const $ = (id) => document.getElementById(id);
  const KEYS = {
    accounts: "g58RestaurantAccounts",
    session: "g58RestaurantSession",
    premium: "g58LocalPremium",
    menu: "g58PremiumMenu",
    inventory: "g58InventoryEnabled",
    subscription: "g58SubscriptionRequest",
  };
  const read = (key, fallback) => {
    try { return JSON.parse(localStorage.getItem(key) || "null") ?? fallback; }
    catch { return fallback; }
  };
  const write = (key, value) => localStorage.setItem(key, JSON.stringify(value));
  const esc = (value) => String(value ?? "").replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  })[c]);
  const money = (value) => new Intl.NumberFormat("en-IN", {
    style: "currency", currency: "INR", maximumFractionDigits: 2,
  }).format(Number(value || 0));
  const id = () => `MENU-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  let session = read(KEYS.session, null);
  let menu = read(KEYS.menu, []);
  let premium = read(KEYS.premium, null);
  let dashboardFilter = { period: "month", from: "", to: "" };

  const isPremium = () => Boolean(premium?.active && (!premium.expiresAt || new Date(premium.expiresAt) > new Date()));
  const inventoryEnabled = () => localStorage.getItem(KEYS.inventory) === "1";

  async function digest(value) {
    const bytes = new TextEncoder().encode(value);
    const hash = await crypto.subtle.digest("SHA-256", bytes);
    return [...new Uint8Array(hash)].map((x) => x.toString(16).padStart(2, "0")).join("");
  }

  function toast(message) {
    const target = $("toast");
    if (!target) return alert(message);
    target.textContent = message;
    target.classList.add("show");
    clearTimeout(toast.timer);
    toast.timer = setTimeout(() => target.classList.remove("show"), 2400);
  }

  function renderGate() {
    let gate = $("posAccountGate");
    if (session) { gate?.remove(); return; }
    if (gate) return;
    gate = document.createElement("div");
    gate.id = "posAccountGate";
    gate.className = "local-account-gate";
    gate.innerHTML = `<section class="card local-account-card">
      <div class="local-account-brand"><span class="logo">G</span><div><h2>Restaurant workspace</h2><p>Sign in on this browser to open G58 POS. Bills, menu, inventory and settings remain on this device.</p></div></div>
      <div class="field"><label>Email</label><input id="gateEmail" type="email" autocomplete="email" placeholder="owner@restaurant.com"></div>
      <div class="field"><label>Password</label><input id="gatePassword" type="password" autocomplete="current-password" placeholder="Minimum 6 characters"></div>
      <div class="gate-actions"><button class="btn btn-primary" id="gateLogin">Login</button><button class="btn btn-outline" id="gateSignup">Create account</button><button class="btn btn-dark" id="gateForgot">Forgot password</button></div>
      <p class="local-account-message" id="gateMessage"></p>
      <small class="local-storage-note">Private browser workspace: removing browser data removes this local account and its restaurant records.</small>
    </section>`;
    document.body.appendChild(gate);
    $("gateLogin").onclick = login;
    $("gateSignup").onclick = signup;
    $("gateForgot").onclick = resetPassword;
  }

  async function login() {
    const email = $("gateEmail").value.trim().toLowerCase();
    const password = $("gatePassword").value;
    const account = read(KEYS.accounts, []).find((row) => row.email === email);
    if (!account || account.passwordHash !== await digest(password)) {
      $("gateMessage").textContent = "Email or password is incorrect on this browser.";
      return;
    }
    session = { id: account.id, email: account.email, name: account.name || account.email.split("@")[0] };
    write(KEYS.session, session);
    renderGate();
    renderShell();
    toast("Restaurant workspace opened");
  }

  async function signup() {
    const email = $("gateEmail").value.trim().toLowerCase();
    const password = $("gatePassword").value;
    if (!/^\S+@\S+\.\S+$/.test(email) || password.length < 6) {
      $("gateMessage").textContent = "Enter a valid email and a password of at least 6 characters.";
      return;
    }
    const accounts = read(KEYS.accounts, []);
    if (accounts.some((row) => row.email === email)) {
      $("gateMessage").textContent = "This account already exists on this browser. Select Login.";
      return;
    }
    const account = { id: crypto.randomUUID(), email, name: email.split("@")[0], passwordHash: await digest(password), createdAt: new Date().toISOString() };
    accounts.push(account);
    write(KEYS.accounts, accounts);
    session = { id: account.id, email: account.email, name: account.name };
    write(KEYS.session, session);
    renderGate();
    renderShell();
    toast("Local restaurant account created");
  }

  async function resetPassword() {
    const email = $("gateEmail").value.trim().toLowerCase();
    const password = $("gatePassword").value;
    const accounts = read(KEYS.accounts, []);
    const account = accounts.find((row) => row.email === email);
    if (!account) return void ($("gateMessage").textContent = "No local account exists for this email on this browser.");
    if (password.length < 6) return void ($("gateMessage").textContent = "Enter the new password above (minimum 6 characters), then select Forgot password again.");
    account.passwordHash = await digest(password);
    write(KEYS.accounts, accounts);
    $("gateMessage").textContent = "Password updated on this browser. You can now log in.";
  }

  function renderShell() {
    const shell = $("premiumShell");
    if (!shell) return;
    shell.style.setProperty("display", "block", "important");
    shell.innerHTML = `<div class="premium-bar">
      <div class="premium-title"><span class="logo">G</span><div><strong>G58 Restaurant POS</strong><small>${esc(session?.email || "Local workspace")} · private browser storage</small></div></div>
      <span class="premium-badge ${isPremium() ? "active" : ""}">${isPremium() ? "PREMIUM ACTIVE" : "FREE POS"}</span>
    </div>
    <div class="premium-tabs">
      <button class="premium-tab active" data-p="account">Account</button>
      <button class="premium-tab" data-p="license">Premium</button>
      <button class="premium-tab" data-p="menu">Menu & Inventory</button>
      <button class="premium-tab" data-p="dashboard">Dashboard</button>
      <a class="premium-tab digital-menu-tab" href="/digital-menu/">Digital Menu ↗</a>
    </div><div id="pp"></div>`;
    shell.querySelectorAll("[data-p]").forEach((button) => {
      button.onclick = () => {
        shell.querySelectorAll("[data-p]").forEach((item) => item.classList.remove("active"));
        button.classList.add("active");
        renderTab(button.dataset.p);
      };
    });
    renderTab("account");
    refreshMenuPicker();
  }

  const box = (html) => { $("pp").innerHTML = `<div class="premium-panel active">${html}</div>`; };

  function renderTab(tab) {
    if (tab === "account") {
      const request = read(KEYS.subscription, null);
      box(`<div class="premium-grid"><article class="premium-box"><h3>Signed in on this device</h3><p><strong>${esc(session?.email)}</strong></p><p style="margin-top:10px">Your POS bills, restaurant menu, inventory and digital-menu orders remain in this browser.</p><button class="btn btn-outline" id="localLogout" style="margin-top:14px">Sign out</button></article><article class="premium-box"><h3>Storage privacy</h3><p>No restaurant transaction or order is uploaded to Appwrite. Export reports regularly if this browser is your only copy.</p>${request ? `<div class="locked-note" style="margin-top:12px">Premium request: ${esc(request.plan)} · ${esc(request.status)}</div>` : ""}</article></div>`);
      $("localLogout").onclick = () => { localStorage.removeItem(KEYS.session); session = null; renderShell(); renderGate(); };
    }

    if (tab === "license") {
      box(`<div class="premium-grid"><article class="premium-box"><h3>Activate Premium</h3><p>Enter the activation key supplied by the G58 team.</p><div class="field" style="margin-top:14px"><label>Activation key</label><input id="localPremiumKey" placeholder="G58-POS-XXXX-XXXX"></div><button class="btn btn-primary" id="activateLocalPremium">Activate on this browser</button><p id="premiumMessage" style="margin-top:12px">${isPremium() ? `Active until ${new Date(premium.expiresAt).toLocaleDateString("en-IN")}` : "Premium is not active."}</p></article><article class="premium-box"><h3>Premium includes</h3><p>Reusable menu, CSV import, item removal, availability control, optional inventory, item performance and browser-local restaurant dashboard.</p></article></div>`);
      $("activateLocalPremium").onclick = () => {
        const key = $("localPremiumKey").value.trim().toUpperCase();
        if (!/^G58-POS-[A-Z0-9-]{4,}$/.test(key)) return void ($("premiumMessage").textContent = "Enter a valid G58-POS activation key.");
        const expires = new Date(); expires.setFullYear(expires.getFullYear() + 1);
        premium = { active: true, key, activatedAt: new Date().toISOString(), expiresAt: expires.toISOString() };
        write(KEYS.premium, premium);
        renderShell();
        toast("Premium activated on this browser");
      };
    }

    if (tab === "menu") {
      if (!isPremium()) return box('<div class="locked-note">Activate Premium to use menu import and optional inventory.</div>');
      box(`<div class="premium-grid"><article class="premium-box"><h3>Add or import menu</h3>
        <div class="field"><label>Item name</label><input id="mn" placeholder="Chicken marination"></div>
        <div class="two-col"><div class="field"><label>Category</label><input id="mc" placeholder="Marinations"></div><div class="field"><label>Price</label><input id="mp" type="number" min="0.01" step="0.01"></div></div>
        <div class="two-col"><div class="field"><label>GST %</label><input id="mg" type="number" min="0" step="0.01" value="0"></div><div class="field inventory-field ${inventoryEnabled() ? "" : "hide"}"><label>Opening stock</label><input id="msq" type="number" min="0" step="1" value="0"></div></div>
        <button class="btn btn-primary" id="saveLocalMenu">Save item</button>
        <hr style="border-color:var(--line);margin:20px 0"><p>Import CSV columns: <b>name, category, price, gst, available, stock</b>.</p>
        <input id="menuImportFile" type="file" accept=".csv,text/csv"><div class="gate-actions"><button class="btn btn-outline" id="importMenu">Import CSV</button><button class="btn btn-dark" id="sampleMenu">Download sample</button></div><p id="importStatus"></p>
        <label class="option-card" style="margin-top:18px"><input id="inventoryToggle" type="checkbox" ${inventoryEnabled() ? "checked" : ""}><span><strong>Enable inventory</strong><small>Optional. Stock is reduced only after a bill is marked Payment Received.</small></span></label>
      </article><article class="premium-box"><h3>Configured menu</h3><div class="menu-list" id="localMenuList"></div></article></div>`);
      $("saveLocalMenu").onclick = saveMenuItem;
      $("sampleMenu").onclick = downloadMenuSample;
      $("importMenu").onclick = importMenuFile;
      $("inventoryToggle").onchange = () => { localStorage.setItem(KEYS.inventory, $("inventoryToggle").checked ? "1" : "0"); renderTab("menu"); };
      renderMenuList();
    }

    if (tab === "dashboard") {
      if (!isPremium()) return box('<div class="locked-note">The sales dashboard is a Premium feature. Free POS billing remains available.</div>');
      renderDashboardPanel();
    }
  }

  function billTime(bill) {
    const value = new Date(bill.settledAt || bill.date || bill.createdAt || 0).getTime();
    return Number.isFinite(value) ? value : 0;
  }

  function startOfDay(value = new Date()) {
    const date = new Date(value); date.setHours(0, 0, 0, 0); return date;
  }

  function dashboardRanges() {
    const now = new Date();
    let start; let end; let previousStart; let previousEnd;
    if (dashboardFilter.period === "today") {
      start = startOfDay(now); end = new Date(start); end.setDate(end.getDate() + 1);
    } else if (dashboardFilter.period === "week") {
      start = startOfDay(now); start.setDate(start.getDate() - ((start.getDay() + 6) % 7)); end = new Date(start); end.setDate(end.getDate() + 7);
    } else if (dashboardFilter.period === "custom" && dashboardFilter.from && dashboardFilter.to) {
      start = startOfDay(`${dashboardFilter.from}T00:00:00`); end = startOfDay(`${dashboardFilter.to}T00:00:00`); end.setDate(end.getDate() + 1);
    } else {
      start = new Date(now.getFullYear(), now.getMonth(), 1); end = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    }
    const duration = Math.max(86400000, end - start);
    previousEnd = new Date(start); previousStart = new Date(start.getTime() - duration);
    return { start: start.getTime(), end: end.getTime(), previousStart: previousStart.getTime(), previousEnd: previousEnd.getTime() };
  }

  function dashboardSummary(rows) {
    const sales = rows.reduce((sum, bill) => sum + Number(bill.total || 0), 0);
    const quantity = rows.reduce((sum, bill) => sum + (bill.items || []).reduce((count, item) => count + Number(item.quantity || 1), 0), 0);
    return { sales, bills: rows.length, quantity, average: rows.length ? sales / rows.length : 0 };
  }

  function renderDashboardPanel() {
    const range = dashboardRanges();
    const allBills = read("g58Bills", []);
    const allCancelled = read("g58CancelledBills", []);
    const currentBills = allBills.filter((bill) => billTime(bill) >= range.start && billTime(bill) < range.end);
    const previousBills = allBills.filter((bill) => billTime(bill) >= range.previousStart && billTime(bill) < range.previousEnd);
    const cancelled = allCancelled.filter((bill) => billTime(bill) >= range.start && billTime(bill) < range.end);
    const current = dashboardSummary(currentBills); const previous = dashboardSummary(previousBills);
    const change = previous.sales ? ((current.sales - previous.sales) / previous.sales) * 100 : current.sales ? 100 : 0;
    const ranked = {};
    currentBills.forEach((bill) => (bill.items || []).forEach((item) => { const name = item.note || "Custom item"; ranked[name] = (ranked[name] || 0) + Number(item.quantity || 1); }));
    const trend = [];
    for (let index = 6; index >= 0; index -= 1) {
      const day = startOfDay(new Date()); day.setDate(day.getDate() - index); const next = new Date(day); next.setDate(next.getDate() + 1);
      trend.push({ label: day.toLocaleDateString("en-IN", { weekday: "short" }), value: allBills.filter((bill) => billTime(bill) >= day.getTime() && billTime(bill) < next.getTime()).reduce((sum, bill) => sum + Number(bill.total || 0), 0) });
    }
    const maxTrend = Math.max(1, ...trend.map((row) => row.value));
    box(`<article class="premium-box dashboard-filter"><div><h3>Business dashboard</h3><p>Compare received sales with the immediately previous period. Cancelled bills stay separate.</p></div><div class="dashboard-filter-controls"><select id="dashboardPeriod"><option value="today" ${dashboardFilter.period === "today" ? "selected" : ""}>Today vs yesterday</option><option value="week" ${dashboardFilter.period === "week" ? "selected" : ""}>This week vs last week</option><option value="month" ${dashboardFilter.period === "month" ? "selected" : ""}>This month vs last month</option><option value="custom" ${dashboardFilter.period === "custom" ? "selected" : ""}>Custom dates</option></select><input id="dashboardFrom" type="date" value="${dashboardFilter.from}" ${dashboardFilter.period === "custom" ? "" : "disabled"}><input id="dashboardTo" type="date" value="${dashboardFilter.to}" ${dashboardFilter.period === "custom" ? "" : "disabled"}></div></article>
    <div class="premium-grid three dashboard-metrics"><div class="insight-card"><small>Received sales</small><strong>${money(current.sales)}</strong><em class="${change >= 0 ? "positive" : "negative"}">${change >= 0 ? "+" : ""}${change.toFixed(1)}% vs previous</em></div><div class="insight-card"><small>Previous-period sales</small><strong>${money(previous.sales)}</strong></div><div class="insight-card"><small>Received bills</small><strong>${current.bills}</strong></div><div class="insight-card"><small>Cancelled bills</small><strong>${cancelled.length}</strong></div><div class="insight-card"><small>Items sold</small><strong>${current.quantity}</strong></div><div class="insight-card"><small>Average bill</small><strong>${money(current.average)}</strong></div></div>
    <div class="premium-grid dashboard-detail-grid"><article class="premium-box"><h3>Last 7 days</h3><div class="dashboard-bars">${trend.map((row) => `<div class="dashboard-bar"><strong>${row.value ? money(row.value) : "₹0"}</strong><span style="height:${Math.max(5, Math.round((row.value / maxTrend) * 100))}%"></span><small>${row.label}</small></div>`).join("")}</div></article><article class="premium-box"><h3>Item performance</h3>${Object.entries(ranked).sort((a,b)=>b[1]-a[1]).slice(0, 8).map(([name, qty]) => `<div class="menu-row"><span><strong>${esc(name)}</strong><small>Quantity sold</small></span><strong>${qty}</strong></div>`).join("") || "<p>No received bills in this period.</p>"}</article></div>`);
    $("dashboardPeriod").onchange = () => { dashboardFilter.period = $("dashboardPeriod").value; renderDashboardPanel(); };
    $("dashboardFrom").onchange = () => { dashboardFilter.from = $("dashboardFrom").value; if (dashboardFilter.to) renderDashboardPanel(); };
    $("dashboardTo").onchange = () => { dashboardFilter.to = $("dashboardTo").value; if (dashboardFilter.from) renderDashboardPanel(); };
  }

  function saveMenuItem() {
    const name = $("mn").value.trim();
    const category = $("mc").value.trim() || "General";
    const price = Number($("mp").value);
    if (!name || !Number.isFinite(price) || price <= 0) return toast("Enter a valid item name and price");
    menu.push({ id: id(), name, category, price: Number(price.toFixed(2)), gst: Number($("mg").value || 0), available: true, stock: Number($("msq")?.value || 0) });
    persistMenu();
    renderTab("menu");
  }

  function renderMenuList() {
    const target = $("localMenuList");
    if (!target) return;
    target.innerHTML = menu.map((item) => `<div class="menu-row menu-admin-row"><span><strong>${esc(item.name)}</strong><small>${esc(item.category)} · ${money(item.price)}${inventoryEnabled() ? ` · Stock ${Number(item.stock || 0)}` : ""}</small></span><button class="mini-btn" data-toggle-menu="${item.id}">${item.available ? "Available" : "Unavailable"}</button><button class="mini-btn danger-mini" data-remove-menu="${item.id}">Remove</button></div>`).join("") || '<div class="empty">No menu items configured.</div>';
    target.querySelectorAll("[data-toggle-menu]").forEach((button) => button.onclick = () => {
      const item = menu.find((row) => row.id === button.dataset.toggleMenu);
      if (item) item.available = !item.available;
      persistMenu(); renderMenuList();
    });
    target.querySelectorAll("[data-remove-menu]").forEach((button) => button.onclick = () => {
      const item = menu.find((row) => row.id === button.dataset.removeMenu);
      if (!item || !confirm(`Remove ${item.name} from this menu?`)) return;
      menu = menu.filter((row) => row.id !== item.id);
      persistMenu(); renderMenuList();
    });
  }

  function persistMenu() { write(KEYS.menu, menu); window.G58Premium.menu = menu; refreshMenuPicker(); }

  function downloadMenuSample() {
    const csv = "name,category,price,gst,available,stock\nChicken Biryani,Rice,249,5,true,30\nFish Marination,Marinations,299,5,true,12\nPrawns Marination,Marinations,349,5,false,0\n";
    const link = document.createElement("a");
    link.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    link.download = "g58-menu-import-sample.csv";
    link.click();
    URL.revokeObjectURL(link.href);
  }

  async function importMenuFile() {
    const file = $("menuImportFile").files[0];
    if (!file) return void ($("importStatus").textContent = "Choose a CSV file first.");
    const lines = (await file.text()).split(/\r?\n/).filter(Boolean);
    const headers = (lines.shift() || "").split(",").map((x) => x.trim().toLowerCase());
    if (["name", "category", "price"].some((field) => !headers.includes(field))) return void ($("importStatus").textContent = "Required columns: name, category, price.");
    const imported = lines.map(parseCsvLine).map((cells) => Object.fromEntries(headers.map((header, index) => [header, cells[index] ?? ""]))).map((row) => ({
      id: id(), name: row.name.trim(), category: row.category.trim() || "General", price: Number(row.price), gst: Number(row.gst || 0), available: !["false", "no", "0"].includes(String(row.available).toLowerCase()), stock: Number(row.stock || 0),
    })).filter((row) => row.name && Number.isFinite(row.price) && row.price > 0);
    menu.push(...imported);
    persistMenu();
    $("importStatus").textContent = `${imported.length} menu item(s) imported. Every row can now be removed individually.`;
    renderMenuList();
  }

  function parseCsvLine(line) {
    const cells = []; let cell = ""; let quoted = false;
    for (let index = 0; index < line.length; index += 1) {
      const char = line[index];
      if (char === '"' && line[index + 1] === '"') { cell += '"'; index += 1; }
      else if (char === '"') quoted = !quoted;
      else if (char === "," && !quoted) { cells.push(cell.trim()); cell = ""; }
      else cell += char;
    }
    cells.push(cell.trim()); return cells;
  }

  function refreshMenuPicker() {
    let strip = $("premiumMenuQuickAdd");
    const entry = $("valueEntry");
    if (!entry || !isPremium()) { strip?.remove(); return; }
    if (!strip) {
      strip = document.createElement("div");
      strip.id = "premiumMenuQuickAdd";
      strip.className = "premium-menu-quick-add";
      entry.parentElement.insertBefore(strip, entry);
    }
    strip.innerHTML = `<label>Premium menu item</label><div><select id="premiumItemPicker"><option value="">Choose an available item</option>${menu.filter((item) => item.available && (!inventoryEnabled() || Number(item.stock || 0) > 0)).map((item) => `<option value="${item.id}">${esc(item.category)} · ${esc(item.name)} · ${money(item.price)}</option>`).join("")}</select><input id="premiumItemQty" type="number" min="1" step="1" value="1" aria-label="Menu quantity"><button class="btn btn-outline" id="premiumAddItem">Add item</button></div>`;
    $("premiumAddItem").onclick = () => {
      const item = menu.find((row) => row.id === $("premiumItemPicker").value);
      const quantity = Math.max(1, Math.floor(Number($("premiumItemQty").value || 1)));
      if (!item) return toast("Choose a menu item");
      if (inventoryEnabled() && quantity > Number(item.stock || 0)) return toast(`Only ${Number(item.stock || 0)} in stock`);
      window.G58AddLineItem?.({ name: item.name, price: item.price, quantity });
    };
  }

  function deductInventory(bill) {
    if (!inventoryEnabled()) return;
    (bill.items || []).forEach((line) => {
      const item = menu.find((row) => row.name.toLowerCase() === String(line.note || "").toLowerCase());
      if (item) item.stock = Math.max(0, Number(item.stock || 0) - Number(line.quantity || 1));
    });
    persistMenu();
  }

  window.G58Premium = {
    menu,
    requestPlan: async (plan, amount) => {
      if (!session) { renderGate(); return false; }
      const request = { plan, amount: Number(amount), status: "requested", requestedAt: new Date().toISOString(), email: session.email };
      write(KEYS.subscription, request);
      toast("Premium request saved. The G58 team can issue your activation key.");
      renderShell();
      return true;
    },
    syncSettings: async () => true,
    syncBill: async (bill) => { deductInventory(bill); return true; },
    syncCancelledBill: async () => true,
  };

  const openPlans = () => { const modal = $("premiumPlansModal"); if (modal) { modal.classList.add("open"); modal.setAttribute("aria-hidden", "false"); document.body.style.overflow = "hidden"; } };
  const closePlans = () => { const modal = $("premiumPlansModal"); if (modal) { modal.classList.remove("open"); modal.setAttribute("aria-hidden", "true"); document.body.style.overflow = ""; } };
  document.addEventListener("click", async (event) => {
    const button = event.target.closest("button");
    if (!button) return;
    if (button.id === "openPremiumPlansBtn") { event.preventDefault(); openPlans(); }
    if (button.id === "closePremiumPlansBtn" || button.classList.contains("continue-free-trigger")) { event.preventDefault(); closePlans(); }
    if (button.classList.contains("buy-plan")) {
      event.preventDefault();
      const plan = button.dataset.plan === "Monthly" ? "monthly" : button.dataset.plan === "6 Months" ? "half_yearly" : "yearly";
      if (await window.G58Premium.requestPlan(plan, button.dataset.amount)) closePlans();
    }
    if (button.id === "alreadyPremiumBtn") { event.preventDefault(); closePlans(); $("premiumShell")?.scrollIntoView({ behavior: "smooth" }); }
  });

  const extraStyle = document.createElement("style");
  extraStyle.textContent = `.local-account-gate{position:fixed;inset:0;z-index:20000;background:radial-gradient(circle at 15% 10%,rgba(249,115,22,.2),transparent 35%),rgba(3,9,17,.97);display:grid;place-items:center;padding:18px}.local-account-card{width:min(580px,100%);padding:28px}.local-account-brand{display:flex;gap:16px;align-items:center;margin-bottom:22px}.local-account-brand h2{margin:0 0 7px}.local-account-brand p,.local-storage-note{color:var(--muted);line-height:1.6}.gate-actions{display:flex;gap:10px;flex-wrap:wrap}.gate-actions .btn-primary{width:auto}.local-account-message{min-height:24px;color:#ffd0ae}.premium-menu-quick-add{padding:15px;border:1px solid rgba(249,115,22,.25);border-radius:16px;background:rgba(249,115,22,.06);margin-bottom:12px}.premium-menu-quick-add>div{display:grid;grid-template-columns:1fr 88px auto;gap:9px}.premium-menu-quick-add select,.premium-menu-quick-add input{min-height:45px}.menu-admin-row{grid-template-columns:minmax(0,1fr) auto auto}.danger-mini{color:#ffaaaa!important;border-color:rgba(239,68,68,.35)!important}.digital-menu-tab{color:#fff!important;background:linear-gradient(135deg,#ef2b2b,#9d1010)!important;box-shadow:0 0 20px rgba(239,43,43,.28)}.dashboard-filter{display:flex;justify-content:space-between;align-items:end;gap:18px;margin-bottom:14px}.dashboard-filter p{margin:6px 0 0;color:var(--muted)}.dashboard-filter-controls{display:grid;grid-template-columns:1.25fr 1fr 1fr;gap:8px;min-width:min(520px,100%)}.dashboard-filter-controls>*{min-height:44px}.dashboard-metrics{margin-bottom:14px}.dashboard-metrics em{display:block;margin-top:7px;font-size:11px;font-style:normal}.dashboard-metrics .positive{color:#86efac}.dashboard-metrics .negative{color:#fca5a5}.dashboard-detail-grid{grid-template-columns:1.2fr .8fr}.dashboard-bars{height:210px;display:grid;grid-template-columns:repeat(7,1fr);gap:9px;align-items:end;padding-top:25px}.dashboard-bar{height:100%;display:grid;grid-template-rows:24px 1fr 20px;align-items:end;text-align:center;gap:5px}.dashboard-bar strong{font-size:10px;color:var(--muted);white-space:nowrap}.dashboard-bar span{display:block;min-height:5px;border-radius:8px 8px 3px 3px;background:linear-gradient(180deg,#fb923c,#c2410c);box-shadow:0 0 16px rgba(249,115,22,.22)}.dashboard-bar small{font-size:10px;color:var(--muted)}@media(max-width:760px){.dashboard-filter{display:block}.dashboard-filter-controls{grid-template-columns:1fr;margin-top:14px;min-width:0}.dashboard-detail-grid{grid-template-columns:1fr}.dashboard-bar strong{font-size:8px}}@media(max-width:600px){.local-account-card{padding:20px}.gate-actions>*{width:100%!important}.premium-menu-quick-add>div{grid-template-columns:1fr 78px}.premium-menu-quick-add button{grid-column:1/-1}.menu-admin-row{grid-template-columns:1fr auto}.menu-admin-row [data-remove-menu]{grid-column:1/-1}}`;
  document.head.appendChild(extraStyle);

  renderGate();
  renderShell();
})();
