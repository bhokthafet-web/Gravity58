(() => {
  "use strict";
  const api = window.Gravity58Ads;
  const byId = (id) => document.getElementById(id);
  let referralLink = "";
  let pendingGenerate = false;

  function currentUser() {
    return window.G58SiteUser || null;
  }

  function setStatus(message, isError = false) {
    const status = byId("referralStatus");
    if (!status) return;
    status.textContent = message || "";
    status.style.color = isError ? "#c92a2a" : "#14804a";
  }

  function setSignedInState() {
    const user = currentUser();
    const button = byId("generateReferralButton");
    if (button) button.textContent = user ? "Get My Referral Link" : "Sign In & Get My Link";
    byId("referralPanelTitle").textContent = user ? `Welcome, ${user.displayName || "Referrer"}` : "Ready to refer?";
    byId("referralPanelCopy").textContent = user
      ? "Generate or reopen the permanent referral link connected to your account."
      : "Sign in once to create a permanent referral link tied securely to your G58 account.";
    if (!user) {
      byId("referralLinkResult").classList.add("hidden");
      referralLink = "";
      renderHistory([]);
    }
  }

  async function generateReferralLink() {
    const user = currentUser();
    if (!user) {
      pendingGenerate = true;
      window.G58RequestAuth?.("login");
      return;
    }
    const functionId = api?.config?.digitalOrderFunctionId;
    if (!api?.configured || !functionId) {
      setStatus("Referral service is temporarily unavailable. Please try again shortly.", true);
      return;
    }
    const buttons = [byId("heroReferralButton"), byId("generateReferralButton"), byId("footerReferralButton")].filter(Boolean);
    buttons.forEach((button) => { button.disabled = true; });
    byId("generateReferralButton").textContent = "Preparing your link…";
    try {
      const result = await api.executeFunction(functionId, {
        action: "digit58-get-referral-code",
        userEmail: user.email,
        userName: user.displayName,
      });
      referralLink = `${location.origin}/digit58/?ref=${encodeURIComponent(result.code)}`;
      byId("referralLinkInput").value = referralLink;
      byId("referralLinkResult").classList.remove("hidden");
      byId("generateReferralButton").textContent = "Referral Link Ready";
      setStatus("Your personal link is ready to copy or share.");
      await loadHistory();
      byId("my-referrals").scrollIntoView({ behavior: "smooth", block: "center" });
    } catch (error) {
      setStatus(error?.message || "Your referral link could not be created.", true);
      byId("generateReferralButton").textContent = "Try Again";
    } finally {
      buttons.forEach((button) => { button.disabled = false; });
    }
  }

  async function copyReferralLink() {
    if (!referralLink) return;
    try {
      await navigator.clipboard.writeText(referralLink);
    } catch {
      const input = byId("referralLinkInput");
      input.select();
      document.execCommand("copy");
    }
    setStatus("Referral link copied.");
  }

  async function shareReferralLink() {
    if (!referralLink) return;
    const data = {
      title: "Start Refills with GRAVITY58",
      text: "Use my link to take your store online with G58 Refills.",
      url: referralLink,
    };
    if (navigator.share) {
      try { await navigator.share(data); return; } catch (error) { if (error?.name === "AbortError") return; }
    }
    window.open(`https://wa.me/?text=${encodeURIComponent(`${data.text} ${data.url}`)}`, "_blank", "noopener,noreferrer");
  }

  function planLabel(plan) {
    return ({ "6months": "6 Months", "6mo": "6 Months", "1year": "1 Year", "1yr": "1 Year", "3years": "3 Years", "3yr": "3 Years" })[plan] || plan || "Paid Refills plan";
  }

  function renderHistory(rows) {
    const user = currentUser();
    byId("referralCount").textContent = user ? String(rows.length) : "—";
    const eligible = rows.filter((row) => ["Eligible", "Paid", "Credited"].includes(row.status || "Eligible"));
    byId("eligibleRewards").textContent = user ? String(eligible.length) : "—";
    byId("recordedValue").textContent = user ? `₹${eligible.reduce((sum, row) => sum + (Number(row.rewardAmount) || 399), 0).toLocaleString("en-IN")}` : "—";
    const list = byId("referralHistory");
    list.replaceChildren();
    if (!user) {
      const empty = document.createElement("p"); empty.textContent = "Sign in to view your referral history."; list.appendChild(empty); return;
    }
    if (!rows.length) {
      const empty = document.createElement("p"); empty.textContent = "No referrals yet. Share your personal link to get started."; list.appendChild(empty); return;
    }
    rows.forEach((row) => {
      const article = document.createElement("article"); article.className = "refer-history-row";
      const copy = document.createElement("div");
      const title = document.createElement("strong"); title.textContent = row.referredEmail || "Referred business owner";
      const detail = document.createElement("small");
      const date = row.createdAt ? new Date(row.createdAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) : "Date pending";
      detail.textContent = `${planLabel(row.plan)} · ${date}`;
      const status = document.createElement("span"); status.textContent = row.status || "Eligible";
      copy.append(title, detail); article.append(copy, status); list.appendChild(article);
    });
  }

  async function loadHistory() {
    const user = currentUser();
    if (!user || !api?.configured) return renderHistory([]);
    try {
      const rows = (await api.list("digit58_referrals"))
        .filter((row) => row.referrerUserId === user.id)
        .sort((a, b) => new Date(b.createdAt || b.$createdAt || 0) - new Date(a.createdAt || a.$createdAt || 0));
      renderHistory(rows);
    } catch {
      renderHistory([]);
      const list = byId("referralHistory");
      list.replaceChildren();
      const error = document.createElement("p"); error.textContent = "Referral history could not be loaded. Try again from your Refills dashboard."; list.appendChild(error);
    }
  }

  ["heroReferralButton", "generateReferralButton", "footerReferralButton"].forEach((id) => byId(id)?.addEventListener("click", generateReferralLink));
  byId("copyReferralButton")?.addEventListener("click", copyReferralLink);
  byId("shareReferralButton")?.addEventListener("click", shareReferralLink);
  window.addEventListener("g58-auth-changed", async () => {
    setSignedInState();
    await loadHistory();
    if (pendingGenerate && currentUser()) { pendingGenerate = false; await generateReferralLink(); }
  });
  setSignedInState();
  setTimeout(loadHistory, 400);
})();
