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
  const integrationParams = new URLSearchParams(location.search);
  const linkedOwnerId = integrationParams.get("owner") || "";
  const linkedRestaurantId = integrationParams.get("restaurant") || "";
  const restaurantIntegrationRequested = integrationParams.get("source") === "digital-menu" && Boolean(linkedOwnerId && linkedRestaurantId);
  let session = read(KEYS.session, null);
  let menu = read(KEYS.menu, []);
  let premium = read(KEYS.premium, null);
  let linkedMenuEntitlement = read("g58DigitalMenuEntitlement", null);
  let linkedDigit58Entitlement = read("g58RefillsEntitlement", null);
  let linkedMenuRecord = null;
  let linkedRestaurant = null;
  let linkedDigitalOrders = [];
  let dashboardFilter = { period: "month", from: "", to: "" };
  let workspaceRecordId = "";
  let syncTimer = null;
  let digitalMenuSyncTimer = null;
  let digitalOrderUnsubscribe = null;
  let digitalMenuUnsubscribe = null;
  let activePremiumTab = "account";

  const entitlementPremium = () => Boolean(linkedMenuEntitlement?.ownerId === session?.id && linkedMenuEntitlement?.plan === "premium" && (linkedMenuEntitlement.lifetime || !linkedMenuEntitlement.expiresAt || new Date(linkedMenuEntitlement.expiresAt) > new Date()));
  const digit58Premium = () => Boolean(linkedDigit58Entitlement?.ownerId === session?.id && linkedDigit58Entitlement?.active && !linkedDigit58Entitlement?.paused && (linkedDigit58Entitlement.lifetime || !linkedDigit58Entitlement.expiresAt || new Date(linkedDigit58Entitlement.expiresAt) > new Date()));
  const isPremium = () => entitlementPremium() || digit58Premium() || Boolean(premium?.active && (!premium.expiresAt || new Date(premium.expiresAt) > new Date()));
  const inventoryEnabled = () => localStorage.getItem(KEYS.inventory) === "1";

  const safeId = (value, length) => String(value || "account").replace(/[^a-zA-Z0-9._-]/g, "-").slice(0, length);
  const workspaceKind = () => `pos_workspace_${safeId(session?.id, 45)}`;
  const workspaceId = () => restaurantIntegrationRequested ? `pos-${safeId(session?.id, 13)}-${safeId(linkedRestaurantId, 16)}` : `pos-${safeId(session?.id, 30)}`;
  const digitalMenuKind = () => `digital_menu_${safeId(session?.id, 48)}`;
  const digitalOrderKind = () => `digital_order_${safeId(session?.id, 47)}`;
  const workspacePayload = () => ({
    ownerId: session?.id, updatedAt: new Date().toISOString(),
    restaurantId: linkedRestaurant?.id || linkedRestaurantId || "",
    restaurantName: linkedRestaurant?.name || "",
    settings: read("g58Settings", {}), bills: read("g58Bills", []), cancelledBills: read("g58CancelledBills", []),
    billCounter: Number(localStorage.getItem("g58BillCounter") || 0), menu, premium,
    inventoryEnabled: inventoryEnabled(), subscription: read(KEYS.subscription, null), digitalMenuLinked: Boolean(linkedRestaurant),
  });
  async function loadWorkspace() {
    if (!session || !window.Gravity58Ads?.configured) return;
    const [entitlements, digit58Entitlements] = await Promise.all([
      Gravity58Ads.list("digital_menu_entitlements").catch(() => []),
      Gravity58Ads.list("digit58_entitlements").catch(() => []),
    ]);
    linkedMenuEntitlement = entitlements.find((row) => row.ownerId === session.id) || null;
    write("g58DigitalMenuEntitlement", linkedMenuEntitlement);
    linkedDigit58Entitlement = digit58Entitlements.find((row) => row.ownerId === session.id) || null;
    write("g58RefillsEntitlement", linkedDigit58Entitlement);
    if (restaurantIntegrationRequested && session.id !== linkedOwnerId) throw new Error("Sign in with the restaurant owner account that opened this POS link.");
    const records = await Gravity58Ads.list(workspaceKind());
    const record = records.find((row) => row.ownerId === session.id && (restaurantIntegrationRequested ? row.restaurantId === linkedRestaurantId : !row.restaurantId))
      || (!restaurantIntegrationRequested ? records.find((row) => row.ownerId === session.id) : null);
    if (record) {
      workspaceRecordId = record.id || record.$id;
      write("g58Settings", record.settings || {}); write("g58Bills", record.bills || []); write("g58CancelledBills", record.cancelledBills || []);
      localStorage.setItem("g58BillCounter", String(record.billCounter || 0));
      menu = Array.isArray(record.menu) ? record.menu : []; premium = record.premium || null;
      write(KEYS.menu, menu); write(KEYS.premium, premium); write(KEYS.subscription, record.subscription || null);
      localStorage.setItem(KEYS.inventory, record.inventoryEnabled ? "1" : "0");
    } else if (restaurantIntegrationRequested) {
      workspaceRecordId = "";
      write("g58Settings", {}); write("g58Bills", []); write("g58CancelledBills", []);
      localStorage.setItem("g58BillCounter", "0");
      menu = []; premium = null;
      write(KEYS.menu, []); write(KEYS.premium, null); write(KEYS.subscription, null);
      localStorage.setItem(KEYS.inventory, "0");
    }
    await loadDigitalRestaurant();
  }

  function mapDigitalMenuItems(record, currentMenu = menu) {
    const categories = new Map((record?.categories || []).map((row) => [row.id, row.name || "General"]));
    return (record?.items || []).map((item) => {
      const existing = currentMenu.find((row) => row.digitalMenuItemId === item.id || row.id === item.id || (row.name || "").toLowerCase() === (item.name || "").toLowerCase());
      return {
        id: existing?.id || item.id || id(), digitalMenuItemId: item.id || existing?.digitalMenuItemId || "",
        name: item.name || "Menu item", category: categories.get(item.categoryId) || "General",
        price: Number(item.price || 0), gst: Number(existing?.gst ?? record?.restaurant?.tax ?? 0),
        available: item.available !== false, stock: Number(existing?.stock || 0),
      };
    });
  }

  function seedRestaurantSettings() {
    if (!linkedRestaurant) return;
    const current = read("g58Settings", {});
    if (Object.keys(current).length) return;
    write("g58Settings", {
      upiId: linkedRestaurant.upiId || "", gstEnabled: Number(linkedRestaurant.tax || 0) > 0,
      gstPercent: Number(linkedRestaurant.tax || 0), notesEnabled: true, posEnabled: true,
      brandName: linkedRestaurant.name || "GRAVITY58", contactNumber: linkedRestaurant.phone || "",
      cashierName: "", customerName: "",
    });
  }

  async function loadDigitalRestaurant() {
    linkedMenuRecord = null; linkedRestaurant = null; linkedDigitalOrders = [];
    if (!restaurantIntegrationRequested) return;
    if (!entitlementPremium()) throw new Error("Premium Digital Menu access is required for restaurant-synced POS.");
    const records = await Gravity58Ads.list(digitalMenuKind());
    const record = records.find((row) => (row.id || row.$id || row.restaurant?.id) === linkedRestaurantId && row.ownerId === session.id);
    if (!record?.restaurant) throw new Error("This restaurant could not be found in your Digital Menu account.");
    linkedMenuRecord = record; linkedRestaurant = record.restaurant;
    menu = mapDigitalMenuItems(record, menu);
    write(KEYS.menu, menu);
    seedRestaurantSettings();
    await syncDigitalOrders();
    startDigitalOrderSync();
  }

  async function syncDigitalOrders() {
    if (!linkedRestaurant || !session) return;
    linkedDigitalOrders = (await Gravity58Ads.list(digitalOrderKind()).catch(() => []))
      .filter((row) => row.ownerId === session.id && row.restaurantId === linkedRestaurant.id && !row.tokenReservation)
      .sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
  }

  function startDigitalOrderSync() {
    digitalOrderUnsubscribe?.(); digitalMenuUnsubscribe?.();
    digitalOrderUnsubscribe = digitalMenuUnsubscribe = null;
    if (!linkedRestaurant || !Gravity58Ads.subscribeKind) return;
    digitalOrderUnsubscribe = Gravity58Ads.subscribeKind(digitalOrderKind(), async () => {
      await syncDigitalOrders();
      if (activePremiumTab === "dashboard") renderDashboardPanel();
      if (activePremiumTab === "orders") renderDigitalOrdersPanel();
    });
    digitalMenuUnsubscribe = Gravity58Ads.subscribeKind(digitalMenuKind(), (row) => {
      if (!row?.restaurant || (row.id || row.$id || row.restaurant.id) !== linkedRestaurant.id) return;
      linkedMenuRecord = row; linkedRestaurant = row.restaurant; menu = mapDigitalMenuItems(row, menu);
      write(KEYS.menu, menu); window.G58Premium.menu = menu; refreshMenuPicker();
      if (activePremiumTab === "menu") renderTab("menu");
    });
  }
  async function syncWorkspace() {
    if (!session || !window.Gravity58Ads?.configured) return;
    const data = workspacePayload(), permissions = Gravity58Ads.permissionSet(workspaceKind(), session.id);
    try {
      const record = workspaceRecordId
        ? await Gravity58Ads.update(workspaceKind(), workspaceRecordId, data)
        : await Gravity58Ads.create(workspaceKind(), data, workspaceId(), permissions);
      workspaceRecordId = record.id || record.$id || workspaceId();
    } catch (error) {
      if (error?.code === 409 || /already exists/i.test(error?.message || "")) {
        workspaceRecordId = workspaceId(); await Gravity58Ads.update(workspaceKind(), workspaceRecordId, data); return;
      }
      throw error;
    }
  }
  function scheduleWorkspaceSync() { clearTimeout(syncTimer); syncTimer = setTimeout(() => syncWorkspace().catch((error) => toast(error.message || "Cloud sync failed")), 250); }

  async function syncDigitalMenuFromPos() {
    if (!linkedMenuRecord || !linkedRestaurant || !entitlementPremium()) return;
    const previousItems = new Map((linkedMenuRecord.items || []).map((item) => [item.id, item]));
    const previousCategories = new Map((linkedMenuRecord.categories || []).map((category) => [String(category.name || "").trim().toLowerCase(), category]));
    const categories = [];
    const categoryByName = new Map();
    menu.forEach((item) => {
      const name = String(item.category || "General").trim() || "General";
      const key = name.toLowerCase();
      if (categoryByName.has(key)) return;
      const previous = previousCategories.get(key);
      const category = previous || { id: `poscat-${safeId(name.toLowerCase(), 25)}-${categories.length + 1}`, name };
      categories.push({ id: category.id, name }); categoryByName.set(key, category.id);
    });
    const items = menu.map((item) => {
      const previous = previousItems.get(item.digitalMenuItemId || item.id) || {};
      const itemId = previous.id || item.digitalMenuItemId || item.id;
      item.digitalMenuItemId = itemId;
      return {
        ...previous, id: itemId, categoryId: categoryByName.get(String(item.category || "General").trim().toLowerCase()),
        name: item.name, description: item.description || previous.description || "", price: Number(item.price || 0),
        type: item.type || previous.type || "Veg", available: item.available !== false, prep: Number(item.prep ?? previous.prep ?? 0),
        prepareInstructionsEnabled: Boolean(previous.prepareInstructionsEnabled),
      };
    });
    const recordId = linkedMenuRecord.id || linkedMenuRecord.$id || linkedRestaurant.id;
    linkedMenuRecord = await Gravity58Ads.update(digitalMenuKind(), recordId, { categories, items, updatedAt: new Date().toISOString() });
  }

  function scheduleDigitalMenuSync() {
    clearTimeout(digitalMenuSyncTimer);
    if (!linkedMenuRecord) return;
    digitalMenuSyncTimer = setTimeout(() => syncDigitalMenuFromPos().catch((error) => toast(error.message || "Digital Menu sync failed")), 350);
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
      <div class="local-account-brand"><a href="/" aria-label="G58 home"><svg class="logo" viewBox="0 0 120 120" fill="none" stroke="#F97316" stroke-width="8"><circle cx="60" cy="26" r="15"/><circle cx="28" cy="82" r="15"/><circle cx="92" cy="82" r="15"/></svg></a><div><h2>${restaurantIntegrationRequested ? "Premium Restaurant POS" : "Restaurant workspace"}</h2><p>${restaurantIntegrationRequested ? "Sign in with the same restaurant-owner account used for Digital Menu." : "Sign in to open your account-synced G58 POS workspace."}</p></div></div>
      <div class="field"><label>Email</label><input id="gateEmail" type="email" autocomplete="email" placeholder="owner@restaurant.com"></div>
      <div class="field"><label>Password</label><input id="gatePassword" type="password" autocomplete="current-password" placeholder="Minimum 6 characters"></div>
      <div class="gate-actions"><button class="btn btn-primary" id="gateLogin">Login</button>${restaurantIntegrationRequested ? "" : '<button class="btn btn-outline" id="gateSignup">Create account</button>'}<button class="btn btn-dark" id="gateForgot">Forgot password</button></div>
      <p class="local-account-message" id="gateMessage"></p>
      <small class="local-storage-note">Your settings, bills, menu and inventory are stored in your G58 account.</small>
    </section>`;
    document.body.appendChild(gate);
    $("gateLogin").onclick = login;
    if ($("gateSignup")) $("gateSignup").onclick = signup;
    $("gateForgot").onclick = resetPassword;
  }

  async function login() {
    const email = $("gateEmail").value.trim().toLowerCase();
    const password = $("gatePassword").value;
    if (!email || !password) return void ($("gateMessage").textContent = "Enter your email and password.");
    try {
      await Gravity58Ads.login(email, password); const account = await Gravity58Ads.currentUser();
      session = { id: account.$id, email: account.email, name: account.name || account.email.split("@")[0] };
      write(KEYS.session, session); await loadWorkspace(); window.G58ApplyCloudWorkspace?.(); renderGate(); renderShell(); toast("Restaurant workspace opened");
    } catch (error) { session = null; localStorage.removeItem(KEYS.session); $("gateMessage").textContent = error.message || "Email or password is incorrect."; }
  }

  async function signup() {
    const email = $("gateEmail").value.trim().toLowerCase();
    const password = $("gatePassword").value;
    if (!/^\S+@\S+\.\S+$/.test(email) || password.length < 6) {
      $("gateMessage").textContent = "Enter a valid email and a password of at least 6 characters.";
      return;
    }
    try {
      const account = await Gravity58Ads.register(email, password, email.split("@")[0]);
      session = { id: account.$id, email: account.email, name: account.name || email.split("@")[0] };
      write(KEYS.session, session); await syncWorkspace(); renderGate(); renderShell(); toast("G58 restaurant account created");
    } catch (error) { $("gateMessage").textContent = error.message || "Could not create account."; }
  }

  async function resetPassword() {
    const email = $("gateEmail").value.trim().toLowerCase();
    if (!/^\S+@\S+\.\S+$/.test(email)) return void ($("gateMessage").textContent = "Enter your account email first.");
    try { await Gravity58Ads.forgotPassword(email, `${location.origin}/reset-password/`); $("gateMessage").textContent = "Password reset email sent. Open the secure link in your email."; }
    catch (error) { $("gateMessage").textContent = error.message || "Could not send reset email."; }
  }

  function renderShell() {
    const shell = $("premiumShell");
    if (!shell) return;
    const restaurantName = linkedRestaurant?.name || "G58 Restaurant";
    const linkedOrderTab = linkedRestaurant ? '<button class="premium-tab" data-p="orders">Digital Menu Orders</button>' : '';
    shell.style.setProperty("display", "block", "important");
    shell.innerHTML = `<div class="premium-bar">
      <div class="premium-title"><a href="/" aria-label="G58 home"><svg class="logo" viewBox="0 0 120 120" fill="none" stroke="#F97316" stroke-width="8"><circle cx="60" cy="26" r="15"/><circle cx="28" cy="82" r="15"/><circle cx="92" cy="82" r="15"/></svg></a><div><strong>${esc(linkedRestaurant ? `${restaurantName} POS` : "G58 Restaurant POS")}</strong><small>${esc(session?.email || "G58 account")} · ${linkedRestaurant ? "restaurant-synced workspace" : "cloud workspace"}</small></div></div>
      <span class="premium-badge ${isPremium() ? "active" : ""}">${isPremium() ? "PREMIUM ACTIVE" : "FREE POS"}</span>
    </div>
    ${linkedRestaurant ? `<div class="restaurant-sync-banner"><div><span class="restaurant-sync-dot"></span><strong>Live sync: ${esc(restaurantName)}</strong><small>Menu, availability, counter bills and online orders use this restaurant workspace only.</small></div><a href="/digital-menu/">Back to Restaurant Dashboard</a></div>` : ""}
    <div class="premium-tabs">
      <button class="premium-tab active" data-p="account">Account</button>
      <button class="premium-tab" data-p="license">Premium</button>
      <button class="premium-tab" data-p="menu">Menu & Inventory</button>
      <button class="premium-tab" data-p="dashboard">Dashboard</button>
      ${linkedOrderTab}
      <a class="premium-tab digital-menu-tab" href="/digital-menu/">Digital Menu ↗</a>
    </div><div id="pp"></div><footer class="g58-site-footer"><p class="g58-site-footer-note">© ${new Date().getFullYear()} Gravity58 · POS</p></footer>`;
    let supportBtn = document.getElementById("g58SupportBtn");
    if (!supportBtn) {
      document.body.insertAdjacentHTML("beforeend", `<a id="g58SupportBtn" class="g58-floating-support" href="/support/?from=pos" title="Support">🛟<span>Support</span></a>`);
      supportBtn = document.getElementById("g58SupportBtn");
    }
    supportBtn.style.display = isPremium() ? "flex" : "none";
    shell.querySelectorAll("[data-p]").forEach((button) => {
      button.onclick = () => {
        shell.querySelectorAll("[data-p]").forEach((item) => item.classList.remove("active"));
        button.classList.add("active");
        activePremiumTab = button.dataset.p;
        renderTab(button.dataset.p);
      };
    });
    activePremiumTab = "account";
    renderTab("account");
    refreshMenuPicker();
  }

  const box = (html) => { $("pp").innerHTML = `<div class="premium-panel active">${html}</div>`; };
  const premiumExpiryLabel = () => {
    if (linkedMenuEntitlement?.lifetime) return "Lifetime Premium access";
    const expiry = linkedMenuEntitlement?.expiresAt || premium?.expiresAt;
    return expiry ? `Active until ${new Date(expiry).toLocaleDateString("en-IN")}` : isPremium() ? "Premium active" : "Premium is not active.";
  };

  function renderTab(tab) {
    if (tab === "account") {
      const request = read(KEYS.subscription, null);
      box(`<div class="premium-grid"><article class="premium-box"><h3>Signed in securely</h3><p><strong>${esc(session?.email)}</strong></p><p style="margin-top:10px">${linkedRestaurant ? `${esc(linkedRestaurant.name)} has its own POS settings, received bills, cancelled bills and inventory. Digital Menu items and orders are synced live.` : "Your POS settings, received bills, cancelled bills, menu and inventory sync to this account."}</p><button class="btn btn-outline" id="localLogout" style="margin-top:14px">Sign out</button></article><article class="premium-box"><h3>${linkedRestaurant ? "Restaurant sync" : "Account status"}</h3><p>${linkedRestaurant ? `Connected to ${esc(linkedRestaurant.name)} · ${esc(linkedRestaurant.city || "")}. Switching restaurants in Digital Menu opens a different POS workspace.` : "Changes sync automatically. Restaurant and menu images have a 100 KB file limit."}</p>${request ? `<div class="locked-note" style="margin-top:12px">Premium request: ${esc(request.plan)} · ${esc(request.status)}</div>` : ""}</article></div>`);
      $("localLogout").onclick = async () => { try { await syncWorkspace(); await Gravity58Ads.logout(); } catch {} digitalOrderUnsubscribe?.(); digitalMenuUnsubscribe?.(); localStorage.removeItem(KEYS.session); session = null; renderShell(); renderGate(); };
    }

    if (tab === "license") {
      const linkedPremium = entitlementPremium() || digit58Premium();
      const linkedPremiumSource = entitlementPremium() ? "Digital Menu Premium" : digit58Premium() ? "your Refills store subscription" : "";
      box(`<div class="premium-grid"><article class="premium-box"><h3>${linkedPremium ? "Premium Included" : "Get Premium"}</h3><p>${linkedPremium ? `Premium POS is included with ${linkedPremiumSource}.` : "Premium POS is included automatically with a Refills store subscription or Digital Menu Premium — there is no separate POS purchase."}</p>${linkedPremium ? "" : '<div class="pos-license-links" style="display:flex;gap:10px;flex-wrap:wrap;margin-top:14px"><a class="btn btn-outline" href="/digit58/">Explore Refills</a><a class="btn btn-outline" href="/digital-menu/">Explore Digital Menu</a></div>'}<p id="premiumMessage" style="margin-top:12px">${premiumExpiryLabel()}</p></article><article class="premium-box"><h3>Premium includes</h3><p>Reusable menu, CSV import, item removal, availability control, optional inventory, item performance and an account-synced restaurant dashboard.</p></article></div>`);
    }

    if (tab === "menu") {
      if (!isPremium()) return box('<div class="locked-note">Activate Premium to use menu import and optional inventory.</div>');
      box(`<div class="premium-grid"><article class="premium-box"><h3>Import menu CSV</h3>
        <p>${linkedRestaurant ? `Items and availability sync in both directions with <b>${esc(linkedRestaurant.name)}</b>. ` : ""}CSV is the only menu-item input. Required columns: <b>name, category, price</b>. Optional columns: <b>gst, available, stock</b>.</p>
        <div class="field" style="margin-top:14px"><label>Import method</label><select id="posMenuImportMode"><option value="merge">Add or update existing menu</option><option value="replace">Overwrite entire menu</option></select></div>
        <input id="menuImportFile" type="file" accept=".csv,text/csv"><div class="gate-actions"><button class="btn btn-outline" id="importMenu">Import CSV</button><button class="btn btn-dark" id="sampleMenu">Download sample</button></div><p id="importStatus">Add/update keeps current items. Overwrite replaces the complete Premium POS menu after confirmation.</p>
        <label class="option-card" style="margin-top:18px"><input id="inventoryToggle" type="checkbox" ${inventoryEnabled() ? "checked" : ""}><span><strong>Enable inventory</strong><small>Optional. Stock is reduced only after a bill is marked Payment Received.</small></span></label>
      </article><article class="premium-box"><div style="display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap"><h3>${linkedRestaurant ? "Synced restaurant menu" : "Configured menu"}</h3><button class="btn btn-outline" id="openAddMenuItem" type="button">+ Add item</button></div>${linkedRestaurant ? '<div class="menu-sync-state"><span></span> Digital Menu + POS</div>' : ""}<div class="menu-list" id="localMenuList"></div></article></div>`);
      $("sampleMenu").onclick = downloadMenuSample;
      $("importMenu").onclick = importMenuFile;
      $("inventoryToggle").onchange = () => { localStorage.setItem(KEYS.inventory, $("inventoryToggle").checked ? "1" : "0"); scheduleWorkspaceSync(); renderTab("menu"); };
      $("openAddMenuItem").onclick = openAddMenuItemModal;
      renderMenuList();
    }

    if (tab === "dashboard") {
      if (!isPremium()) return box('<div class="locked-note">The sales dashboard is a Premium feature. Free POS billing remains available.</div>');
      renderDashboardPanel();
    }

    if (tab === "orders") {
      if (!linkedRestaurant || !isPremium()) return box('<div class="locked-note">Open POS from a Premium Digital Menu restaurant to view synced orders.</div>');
      renderDigitalOrdersPanel();
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
    const quantity = rows.reduce((sum, bill) => sum + (bill.items || []).reduce((count, item) => count + Number(item.quantity || item.qty || 1), 0), 0);
    return { sales, bills: rows.length, quantity, average: rows.length ? sales / rows.length : 0 };
  }

  function digitalOrderAsBill(order) {
    return {
      ...order, billNumber: order.id || order.$id, source: "Digital Menu",
      date: order.completedAt || order.updatedAt || order.createdAt,
      settledAt: order.completedAt || order.updatedAt || order.createdAt,
      items: (order.items || []).map((item) => ({ ...item, note: item.name, quantity: Number(item.qty || item.quantity || 1) })),
    };
  }

  function renderDashboardPanel() {
    const range = dashboardRanges();
    const counterBills = read("g58Bills", []).map((bill) => ({ ...bill, source: "Counter POS" }));
    const onlineBills = linkedDigitalOrders.filter((order) => ["Completed", "Delivered"].includes(order.status)).map(digitalOrderAsBill);
    const allBills = [...counterBills, ...onlineBills];
    const allCancelled = [...read("g58CancelledBills", []), ...linkedDigitalOrders.filter((order) => ["Rejected", "Payment Rejected", "Cancelled"].includes(order.status)).map(digitalOrderAsBill)];
    const currentBills = allBills.filter((bill) => billTime(bill) >= range.start && billTime(bill) < range.end);
    const previousBills = allBills.filter((bill) => billTime(bill) >= range.previousStart && billTime(bill) < range.previousEnd);
    const cancelled = allCancelled.filter((bill) => billTime(bill) >= range.start && billTime(bill) < range.end);
    const currentCounter = currentBills.filter((bill) => bill.source === "Counter POS");
    const currentOnline = currentBills.filter((bill) => bill.source === "Digital Menu");
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
    box(`<article class="premium-box dashboard-filter"><div><h3>${linkedRestaurant ? `${esc(linkedRestaurant.name)} business dashboard` : "Business dashboard"}</h3><p>${linkedRestaurant ? "Counter POS bills and completed Digital Menu orders are combined for this restaurant." : "Compare received sales with the immediately previous period."} Cancelled bills stay separate.</p></div><div class="dashboard-filter-controls"><select id="dashboardPeriod"><option value="today" ${dashboardFilter.period === "today" ? "selected" : ""}>Today vs yesterday</option><option value="week" ${dashboardFilter.period === "week" ? "selected" : ""}>This week vs last week</option><option value="month" ${dashboardFilter.period === "month" ? "selected" : ""}>This month vs last month</option><option value="custom" ${dashboardFilter.period === "custom" ? "selected" : ""}>Custom dates</option></select><input id="dashboardFrom" type="date" value="${dashboardFilter.from}" ${dashboardFilter.period === "custom" ? "" : "disabled"}><input id="dashboardTo" type="date" value="${dashboardFilter.to}" ${dashboardFilter.period === "custom" ? "" : "disabled"}></div></article>
    <div class="premium-grid three dashboard-metrics"><div class="insight-card"><small>Total received sales</small><strong>${money(current.sales)}</strong><em class="${change >= 0 ? "positive" : "negative"}">${change >= 0 ? "+" : ""}${change.toFixed(1)}% vs previous</em></div><div class="insight-card"><small>Counter POS sales</small><strong>${money(dashboardSummary(currentCounter).sales)}</strong></div><div class="insight-card"><small>Digital Menu sales</small><strong>${money(dashboardSummary(currentOnline).sales)}</strong></div><div class="insight-card"><small>Previous-period sales</small><strong>${money(previous.sales)}</strong></div><div class="insight-card"><small>Received bills / orders</small><strong>${current.bills}</strong></div><div class="insight-card"><small>Cancelled bills / orders</small><strong>${cancelled.length}</strong></div><div class="insight-card"><small>Items sold</small><strong>${current.quantity}</strong></div><div class="insight-card"><small>Average bill</small><strong>${money(current.average)}</strong></div></div>
    <div class="premium-grid dashboard-detail-grid"><article class="premium-box"><h3>Last 7 days</h3><div class="dashboard-bars">${trend.map((row) => `<div class="dashboard-bar"><strong>${row.value ? money(row.value) : "₹0"}</strong><span style="height:${Math.max(5, Math.round((row.value / maxTrend) * 100))}%"></span><small>${row.label}</small></div>`).join("")}</div></article><article class="premium-box"><h3>Item performance</h3>${Object.entries(ranked).sort((a,b)=>b[1]-a[1]).slice(0, 8).map(([name, qty]) => `<div class="menu-row"><span><strong>${esc(name)}</strong><small>Quantity sold</small></span><strong>${qty}</strong></div>`).join("") || "<p>No received bills in this period.</p>"}</article></div>`);
    $("dashboardPeriod").onchange = () => { dashboardFilter.period = $("dashboardPeriod").value; renderDashboardPanel(); };
    $("dashboardFrom").onchange = () => { dashboardFilter.from = $("dashboardFrom").value; if (dashboardFilter.to) renderDashboardPanel(); };
    $("dashboardTo").onchange = () => { dashboardFilter.to = $("dashboardTo").value; if (dashboardFilter.from) renderDashboardPanel(); };
  }

  function renderDigitalOrdersPanel() {
    const rows = linkedDigitalOrders;
    box(`<article class="premium-box digital-orders-head"><div><span class="restaurant-sync-dot"></span><h3>${esc(linkedRestaurant?.name || "Restaurant")} Digital Menu Orders</h3><p>Live restaurant orders appear here automatically. Accept, reject, prepare and message customers from the Digital Menu order board.</p></div><a class="btn btn-outline" href="/digital-menu/">Manage Orders in Digital Menu →</a></article><div class="digital-order-table-wrap"><table class="digital-order-table"><thead><tr><th>Token / Order</th><th>Customer</th><th>Items</th><th>Total</th><th>Status</th><th>Received</th></tr></thead><tbody>${rows.map((order) => `<tr><td><strong>${order.tokenNumber ? `#${String(order.tokenNumber).padStart(4, "0")}` : esc(order.id || order.$id)}</strong><small>${esc(order.id || order.$id)}</small></td><td>${esc(order.customer || order.customerName || "Guest")}</td><td>${(order.items || []).map((item) => `${Number(item.qty || item.quantity || 1)} × ${esc(item.name || "Item")}`).join("<br>")}</td><td><strong>${money(order.total)}</strong></td><td><span class="order-status-chip status-${safeId(String(order.status || "Pending").toLowerCase(), 24)}">${esc(order.status || "Pending")}</span></td><td>${new Date(order.createdAt || Date.now()).toLocaleString("en-IN")}</td></tr>`).join("") || '<tr><td colspan="6" class="report-empty">No Digital Menu orders for this restaurant yet.</td></tr>'}</tbody></table></div>`);
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
      if (!item || !confirm(`Remove ${item.name}${linkedRestaurant ? " from POS and Digital Menu" : " from this menu"}?`)) return;
      menu = menu.filter((row) => row.id !== item.id);
      persistMenu(); renderMenuList();
    });
  }

  function persistMenu() { write(KEYS.menu, menu); window.G58Premium.menu = menu; refreshMenuPicker(); scheduleWorkspaceSync(); scheduleDigitalMenuSync(); }

  function ensureAddMenuItemModal() {
    if ($("addMenuItemModal")) return;
    document.body.insertAdjacentHTML("beforeend", `
      <div class="modal" id="addMenuItemModal" role="dialog" aria-modal="true" aria-labelledby="addMenuItemTitle">
        <div class="modal-card" style="text-align:left">
          <div style="display:flex;align-items:center;justify-content:space-between;gap:10px">
            <h2 class="modal-title" id="addMenuItemTitle" style="margin:0">Add Menu Item</h2>
            <button type="button" class="mini-btn" id="closeAddMenuItem" aria-label="Close">✕</button>
          </div>
          <form id="addMenuItemForm" style="margin-top:14px">
            <div class="field"><label>Item name</label><input id="newItemName" required></div>
            <div class="field"><label>Category</label><input id="newItemCategory" placeholder="Example: Starters"></div>
            <div class="field"><label>Price (₹)</label><input id="newItemPrice" type="number" min="0" step="0.01" required></div>
            <div class="field"><label>Food type</label><select id="newItemType"><option value="Veg">Veg</option><option value="Non-Veg">Non-Veg</option></select></div>
            <div class="field"><label>Preparation time (minutes)</label><input id="newItemPrep" type="number" min="0" step="1" value="0"></div>
            <div class="field"><label>Description</label><textarea id="newItemDescription" placeholder="Describe the dish"></textarea></div>
            <button class="btn btn-primary" type="submit" style="width:100%">Add item</button>
          </form>
        </div>
      </div>`);
    $("closeAddMenuItem").onclick = () => $("addMenuItemModal").classList.remove("show");
    $("addMenuItemForm").onsubmit = (event) => {
      event.preventDefault();
      const name = $("newItemName").value.trim();
      const price = Number($("newItemPrice").value);
      if (!name) return void toast("Enter an item name");
      if (!Number.isFinite(price) || price <= 0) return void toast("Enter a valid price");
      menu.push({
        id: id(), digitalMenuItemId: "", name, category: $("newItemCategory").value.trim() || "General",
        price, gst: Number(linkedRestaurant?.tax || 0), available: true, stock: 0,
        type: $("newItemType").value === "Non-Veg" ? "Non-Veg" : "Veg",
        prep: Math.max(0, Number($("newItemPrep").value) || 0),
        description: $("newItemDescription").value.trim(),
      });
      persistMenu();
      renderMenuList();
      $("addMenuItemModal").classList.remove("show");
      toast(`${name} added to the menu`);
    };
  }

  function openAddMenuItemModal() {
    ensureAddMenuItemModal();
    $("addMenuItemForm").reset();
    $("addMenuItemModal").classList.add("show");
  }

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
    const mode = $("posMenuImportMode")?.value || "merge";
    if (mode === "replace" && menu.length && !confirm("Overwrite every current Premium POS menu item?")) return;
    const lines = (await file.text()).split(/\r?\n/).filter(Boolean);
    const headers = (lines.shift() || "").split(",").map((x) => x.trim().toLowerCase());
    if (["name", "category", "price"].some((field) => !headers.includes(field))) return void ($("importStatus").textContent = "Required columns: name, category, price.");
    const imported = lines.map(parseCsvLine).map((cells) => Object.fromEntries(headers.map((header, index) => [header, cells[index] ?? ""]))).map((row) => ({
      id: id(), name: row.name.trim(), category: row.category.trim() || "General", price: Number(row.price), gst: Number(row.gst || 0), available: !["false", "no", "0"].includes(String(row.available).toLowerCase()), stock: Number(row.stock || 0),
    })).filter((row) => row.name && Number.isFinite(row.price) && row.price > 0);
    if (!imported.length) return void ($("importStatus").textContent = "No valid menu items were found in this CSV.");
    if (mode === "replace") menu = imported;
    else imported.forEach((row) => {
      const current = menu.find((item) => item.name.trim().toLowerCase() === row.name.toLowerCase() && item.category.trim().toLowerCase() === row.category.toLowerCase());
      if (current) Object.assign(current, row, { id: current.id });
      else menu.push(row);
    });
    persistMenu();
    $("importStatus").textContent = mode === "replace" ? `${imported.length} menu item(s) replaced the previous menu.` : `${imported.length} menu item(s) added or updated.`;
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
    syncSettings: async () => { scheduleWorkspaceSync(); return true; },
    syncBill: async (bill) => {
      if (linkedRestaurant) Object.assign(bill, { restaurantId: linkedRestaurant.id, restaurantName: linkedRestaurant.name, source: "Counter POS" });
      const bills = read("g58Bills", []), stored = bills.find((row) => row.billNumber === bill.billNumber);
      if (stored) Object.assign(stored, bill);
      write("g58Bills", bills);
      deductInventory(bill); await syncWorkspace(); return true;
    },
    syncCancelledBill: async (bill) => {
      if (linkedRestaurant) Object.assign(bill, { restaurantId: linkedRestaurant.id, restaurantName: linkedRestaurant.name, source: "Counter POS" });
      const bills = read("g58CancelledBills", []), stored = bills.find((row) => row.billNumber === bill.billNumber);
      if (stored) Object.assign(stored, bill);
      write("g58CancelledBills", bills);
      await syncWorkspace(); return true;
    },
  };

  const extraStyle = document.createElement("style");
  extraStyle.textContent = `.local-account-gate{position:fixed;inset:0;z-index:20000;background:radial-gradient(circle at 15% 10%,rgba(249,115,22,.2),transparent 35%),rgba(3,9,17,.97);display:grid;place-items:center;padding:18px}.local-account-card{width:min(580px,100%);padding:28px}.local-account-brand{display:flex;gap:16px;align-items:center;margin-bottom:22px}.local-account-brand h2{margin:0 0 7px}.local-account-brand p,.local-storage-note{color:var(--muted);line-height:1.6}.gate-actions{display:flex;gap:10px;flex-wrap:wrap}.gate-actions .btn-primary{width:auto}.local-account-message{min-height:24px;color:#ffd0ae}.premium-menu-quick-add{padding:15px;border:1px solid rgba(249,115,22,.25);border-radius:16px;background:rgba(249,115,22,.06);margin-bottom:12px}.premium-menu-quick-add>div{display:grid;grid-template-columns:1fr 88px auto;gap:9px}.premium-menu-quick-add select,.premium-menu-quick-add input{min-height:45px}.menu-admin-row{grid-template-columns:minmax(0,1fr) auto auto}.danger-mini{color:#ffaaaa!important;border-color:rgba(239,68,68,.35)!important}.digital-menu-tab{color:#fff!important;background:linear-gradient(135deg,#ef2b2b,#9d1010)!important;box-shadow:0 0 20px rgba(239,43,43,.28)}.dashboard-filter{display:flex;justify-content:space-between;align-items:end;gap:18px;margin-bottom:14px}.dashboard-filter p{margin:6px 0 0;color:var(--muted)}.dashboard-filter-controls{display:grid;grid-template-columns:1.25fr 1fr 1fr;gap:8px;min-width:min(520px,100%)}.dashboard-filter-controls>*{min-height:44px}.dashboard-metrics{margin-bottom:14px}.dashboard-metrics em{display:block;margin-top:7px;font-size:11px;font-style:normal}.dashboard-metrics .positive{color:#86efac}.dashboard-metrics .negative{color:#fca5a5}.dashboard-detail-grid{grid-template-columns:1.2fr .8fr}.dashboard-bars{height:210px;display:grid;grid-template-columns:repeat(7,1fr);gap:9px;align-items:end;padding-top:25px}.dashboard-bar{height:100%;display:grid;grid-template-rows:24px 1fr 20px;align-items:end;text-align:center;gap:5px}.dashboard-bar strong{font-size:10px;color:var(--muted);white-space:nowrap}.dashboard-bar span{display:block;min-height:5px;border-radius:8px 8px 3px 3px;background:linear-gradient(180deg,#fb923c,#c2410c);box-shadow:0 0 16px rgba(249,115,22,.22)}.dashboard-bar small{font-size:10px;color:var(--muted)}@media(max-width:760px){.dashboard-filter{display:block}.dashboard-filter-controls{grid-template-columns:1fr;margin-top:14px;min-width:0}.dashboard-detail-grid{grid-template-columns:1fr}.dashboard-bar strong{font-size:8px}}@media(max-width:600px){.local-account-card{padding:20px}.gate-actions>*{width:100%!important}.premium-menu-quick-add>div{grid-template-columns:1fr 78px}.premium-menu-quick-add button{grid-column:1/-1}.menu-admin-row{grid-template-columns:1fr auto}.menu-admin-row [data-remove-menu]{grid-column:1/-1}}`;
  document.head.appendChild(extraStyle);

  async function resumeCloudSession() {
    if (!window.Gravity58Ads?.configured) { session = null; localStorage.removeItem(KEYS.session); renderGate(); return; }
    const account = await Gravity58Ads.currentUser();
    if (!account) { session = null; localStorage.removeItem(KEYS.session); renderGate(); return; }
    session = { id: account.$id, email: account.email, name: account.name || account.email.split("@")[0] };
    write(KEYS.session, session);
    try { await loadWorkspace(); window.G58ApplyCloudWorkspace?.(); renderGate(); renderShell(); }
    catch (error) { digitalOrderUnsubscribe?.(); digitalMenuUnsubscribe?.(); session = null; localStorage.removeItem(KEYS.session); renderGate(); throw error; }
  }

  renderGate();
  renderShell();
  resumeCloudSession().catch((error) => toast(error.message || "Could not open your POS workspace"));
})();
