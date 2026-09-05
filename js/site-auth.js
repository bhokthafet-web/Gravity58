(() => {
  "use strict";
  const api = window.Gravity58Ads;
  let user = null;
  let profile = null;
  let pending = null;
  let signupMode = false;
  const $ = (id) => document.getElementById(id);

  const wrap = document.createElement("div");
  wrap.className = "modal";
  wrap.id = "siteAuthModal";
  wrap.style.zIndex = "30000";
  wrap.innerHTML = `<div class="modal-card" style="max-width:620px"><div class="modal-head"><div><h3 id="authTitle">Login</h3><p id="authIntro">Enter your email and password to continue.</p></div><button type="button" class="close" id="authClose">×</button></div><div class="form-grid">
    <div class="field full signup-only hidden"><label>Full name</label><input id="authFullName" type="text" autocomplete="name"></div>
    <div class="field full"><label>Email</label><input id="authEmail" type="email" autocomplete="email"></div>
    <div class="field full"><label>Password</label><input id="authPassword" type="password" minlength="8" autocomplete="current-password"></div>
    <div class="field signup-only hidden"><label>Phone number</label><input id="authPhone" type="tel"></div>
    <div class="field signup-only hidden"><label>Account type</label><select id="authType"><option value="customer">Customer</option><option value="business">Business owner</option></select></div>
    <div class="field signup-only hidden"><label>State</label><input id="authState"></div>
    <div class="field signup-only hidden"><label>District / City</label><input id="authDistrict"></div>
    <div class="field full auth-button-row"><button type="button" class="btn primary" id="authLogin">Login</button><button type="button" class="btn orange" id="authSignup">Create account</button><button type="button" class="btn" id="authForgot">Forgot password</button></div>
    <div class="field full"><div class="notice info" id="authMessage">Login is required for customer requirements. Business cards can be created without an account.</div></div>
  </div></div>`;
  document.body.appendChild(wrap);

  const successWrap = document.createElement("div");
  successWrap.className = "modal auth-success-modal";
  successWrap.id = "authSuccessModal";
  successWrap.style.zIndex = "31000";
  successWrap.innerHTML = `<div class="modal-card auth-success-card"><div class="auth-success-icon">✓</div><h3 id="authSuccessTitle">Success</h3><p id="authSuccessText"></p><button type="button" class="btn primary" id="authSuccessClose">OK</button></div>`;
  document.body.appendChild(successWrap);

  function setSignupMode(enabled) {
    signupMode = enabled;
    document.querySelectorAll("#siteAuthModal .signup-only").forEach((field) => field.classList.toggle("hidden", !enabled));
    $("authLogin").classList.toggle("hidden", enabled);
    $("authForgot").classList.toggle("hidden", enabled);
    $("authSignup").textContent = enabled ? "Create account now" : "Create account";
    $("authTitle").textContent = enabled ? "Create account" : "Login";
    $("authIntro").textContent = enabled ? "Complete the details below to create your account." : "Enter your email and password to continue.";
  }
  function show(action) {
    pending = action;
    setSignupMode(false);
    wrap.classList.add("show");
    if (!api?.configured) $("authMessage").textContent = "Account services are temporarily unavailable. You can continue browsing and try again shortly.";
  }
  const close = () => wrap.classList.remove("show");
  const showSuccess = (title, message) => { $("authSuccessTitle").textContent = title; $("authSuccessText").textContent = message; successWrap.classList.add("show"); };
  $("authClose").onclick = close;
  $("authSuccessClose").onclick = () => successWrap.classList.remove("show");
  window.G58RequestAuth = show;

  async function loadProfile() {
    if (!user) return null;
    const profiles = await api.list("profiles", { userId: user.$id });
    return profiles[0] || null;
  }
  function updateHeader() {
    const active = Boolean(user);
    $("siteLoginButton")?.classList.toggle("hidden", active);
    $("siteLogoutButton")?.classList.toggle("hidden", !active);
    $("myPostsButton")?.classList.toggle("hidden", !active);
    $("myBusinessCardButton")?.classList.toggle("hidden", !active);
    if ($("siteUserName")) { $("siteUserName").textContent = user?.name || user?.email?.split("@")[0] || ""; $("siteUserName").classList.toggle("hidden", !active); }
  }
  async function finish() {
    if (!user) return;
    profile = await loadProfile();
    if (profile?.blocked) { await api.logout(); user = null; updateHeader(); return void ($("authMessage").textContent = "This account is blocked. Contact GRAVITY58 support."); }
    window.G58SiteUser = {
      id: user.$id, email: user.email, phone: profile?.phone || "", accountType: profile?.accountType || "customer",
      state: profile?.state || "", district: profile?.district || "", displayName: profile?.name || user.name || user.email?.split("@")[0] || "User",
    };
    updateHeader();
    close();
    window.dispatchEvent(new CustomEvent("g58-auth-changed"));
    if (pending === "customer") originalCustomer();
    if (pending === "business") originalBusiness();
    pending = null;
  }

  const originalCustomer = window.openCustomerPostCreator;
  const originalBusiness = window.openBusinessCardCreator;
  window.openCustomerPostCreator = () => { pending = "customer"; user ? finish() : show("customer"); };
  window.openBusinessCardCreator = originalBusiness;
  window.G58AccountAction = () => user ? logout() : show("login");
  window.G58LogoutAction = logout;

  async function logout() {
    try { await api.logout(); } catch {}
    user = null; profile = null; window.G58SiteUser = null; updateHeader();
    window.dispatchEvent(new CustomEvent("g58-auth-changed"));
  }

  $("authLogin").onclick = async () => {
    try {
      await api.login($("authEmail").value.trim(), $("authPassword").value);
      user = await api.currentUser();
      $("authMessage").textContent = "Signed in securely.";
      await finish();
    } catch (error) { $("authMessage").textContent = error.message || "Could not sign in."; }
  };
  $("authSignup").onclick = async () => {
    if (!signupMode) return setSignupMode(true);
    const name = $("authFullName").value.trim();
    const phone = $("authPhone").value.trim();
    if (name.length < 2 || phone.replace(/\D/g, "").length < 10) return void ($("authMessage").textContent = "Enter your full name and a valid phone number.");
    try {
      user = await api.register($("authEmail").value.trim(), $("authPassword").value, name, phone);
      const profiles = await api.list("profiles", { userId: user.$id });
      if (profiles[0]) await api.update("profiles", profiles[0].id, { accountType: $("authType").value, state: $("authState").value.trim(), district: $("authDistrict").value.trim() });
      close(); showSuccess("Account created", "Your GRAVITY58 account is ready and you are signed in.");
      await finish();
    } catch (error) { $("authMessage").textContent = error.message || "Could not create the account."; }
  };
  $("authForgot").onclick = async () => {
    try {
      await api.forgotPassword($("authEmail").value.trim(), location.origin + "/reset-password/");
      close(); showSuccess("Reset link sent", "Password reset instructions were sent to your email address.");
    } catch (error) { $("authMessage").textContent = error.message || "Could not send reset instructions."; }
  };

  const originalPublish = window.validateAndPublish;
  window.validateAndPublish = async () => {
    const postType = $("postType")?.value || "customer";
    if (!user && postType !== "business") return show(postType);
    if (!user && postType === "business") {
      try {
        const anonymousUser = await api.ensureUser();
        window.G58AnonymousPublisherId = anonymousUser?.$id || "";
      } catch (error) {
        const status = $("moderationStatus");
        if (status) {
          status.className = "moderation-status notice error";
          status.style.display = "block";
          status.textContent = error?.message || "The business card could not be saved securely. Please try again.";
        }
        return;
      }
    }
    const email = $("postEmail"), phone = $("postPhone");
    if (user && email && !email.value) email.value = user.email || "";
    if (user && phone && !phone.value) phone.value = profile?.phone || "";
    const result = originalPublish();
    if (user) setTimeout(() => {
      const state = window.G58GetPostState?.() || { customers: [], businesses: [], lastPublishedPostId: "" };
      const item = [...state.customers, ...state.businesses].find((row) => row.id === state.lastPublishedPostId);
      if (item) { item.userId = user.$id; item.accountEmail = user.email; item.accountPhone = profile?.phone || phone?.value || ""; window.saveData?.(); }
    }, 0);
    return result;
  };

  api?.currentUser()
    .then(async (activeUser) => {
      user = activeUser?.email ? activeUser : null;
      if (user) await finish();
      else updateHeader();
    })
    .catch(() => {
      user = null;
      updateHeader();
    });
})();
