const $ = (selector) => document.querySelector(selector);
const esc = (value) => String(value ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const inr = (rupees) => `₹${Number(rupees || 0).toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;
const when = (iso) => (iso ? new Date(iso).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" }) : "—");

async function api(path, options = {}) {
  const response = await fetch(`api/${path}`, {
    credentials: "include",
    headers: options.body ? { "Content-Type": "application/json" } : {},
    ...options,
    body: options.body ? JSON.stringify(options.body) : undefined,
  });
  const json = await response.json().catch(() => ({}));
  if (!response.ok) throw Object.assign(new Error(json.error || `Request failed (${response.status})`), { status: response.status });
  return json;
}

function toast(message) {
  const box = $("#toast");
  box.textContent = message;
  box.hidden = false;
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => { box.hidden = true; }, 3500);
}

// ---------- Overview ----------

async function loadOverview() {
  const data = await api("overview");
  const s = data.stages;
  const money = data.last30Days;
  const tiles = [
    ["Leads found", Object.values(s).reduce((a, b) => a + b, 0)],
    ["Ready to contact", s.qualified ?? 0],
    ["Messaged (7 days)", data.last7Days.outreach],
    ["Replies (7 days)", data.last7Days.replies],
    ["Interested", (s.interested ?? 0) + (s.negotiating ?? 0)],
    ["Won", s.won ?? 0],
    ["Revenue (30 days)", inr(money.revenue)],
    ["Costs (30 days)", inr(money.costs)],
    ["Profit (30 days)", inr(money.profit), money.profit >= 0 ? "good" : "bad"],
  ];
  $("#tiles").innerHTML = tiles.map(([label, value, tone]) => `<div class="tile"><b class="${tone || ""}">${esc(value)}</b><span>${esc(label)}</span></div>`).join("");

  const pause = $("#pause");
  pause.hidden = false;
  pause.textContent = data.paused ? "▶ Start agents" : "❚❚ Pause agents";
  pause.className = data.paused ? "btn" : "btn danger";
  pause.dataset.paused = data.paused;

  const badge = $("#approval-count");
  badge.hidden = !data.pendingApprovals;
  badge.textContent = data.pendingApprovals;

  if (data.plan) {
    $("#plan").innerHTML = `<p>${esc(data.plan.summary)}</p>
      <p class="muted">Focus today: ${data.plan.focus_categories.map((c) => `<span class="pill">${esc(c)}</span>`).join(" ")}</p>
      ${data.plan.recommendations.length ? `<ul>${data.plan.recommendations.map((r) => `<li>${esc(r)}</li>`).join("")}</ul>` : ""}`;
  }
}

$("#pause").addEventListener("click", async (event) => {
  const paused = event.currentTarget.dataset.paused === "true";
  await api("settings", { method: "PUT", body: { paused: !paused } });
  toast(paused ? "Agents started" : "Agents paused");
  loadOverview();
});

// ---------- Coordinator chat ----------

const CHANNEL_LABEL = { dashboard: "", whatsapp: " · WhatsApp", report: " · report" };

function renderChat(rows, pending) {
  const box = $("#chat-log");
  box.innerHTML = rows.map((m) => `<div class="bubble ${m.role === "owner" ? "in" : "out"}">${esc(m.text)}
    <small>${m.role === "owner" ? "You" : "Coordinator"}${CHANNEL_LABEL[m.channel] ?? ""} · ${when(m.created_at)}</small></div>`).join("")
    + (pending ? `<div class="bubble in">${esc(pending)}<small>You · sending…</small></div><div class="typing">Coordinator is working…</div>` : "")
    || '<p class="muted">No messages yet.</p>';
  box.scrollTop = box.scrollHeight;
}

async function loadChat() {
  renderChat(await api("chat"));
}

$("#chat-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  const form = event.currentTarget;
  const message = form.message.value.trim();
  if (!message) return;
  const button = form.querySelector("button");
  button.disabled = true;
  form.message.value = "";
  renderChat(await api("chat"), message);
  try {
    await api("chat", { method: "POST", body: { message } });
  } catch (error) {
    toast(error.message);
    form.message.value = message;
  }
  button.disabled = false;
  await loadChat();
  loadOverview();
});

$("#chat-form").message.addEventListener("keydown", (event) => {
  if (event.key === "Enter" && !event.shiftKey) {
    event.preventDefault();
    event.currentTarget.form.requestSubmit();
  }
});

// ---------- Leads ----------

async function loadLeads() {
  const stage = $("#stage-filter").value;
  const rows = await api(`leads${stage ? `?stage=${encodeURIComponent(stage)}` : ""}`);
  $("#leads").innerHTML = `<tr><th>Business</th><th>Category</th><th>Stage</th><th>Score</th><th>Best product</th><th>Last contact</th></tr>`
    + (rows.length ? rows.map((lead) => `<tr class="click" data-id="${lead.id}">
      <td><b>${esc(lead.name)}</b><br><span class="muted">${esc(lead.address)}</span></td>
      <td>${esc(lead.category)}</td><td><span class="pill">${esc(lead.stage)}</span></td>
      <td>${lead.score ?? "—"}</td><td>${esc(lead.product_fit || "—")}</td><td>${when(lead.last_contacted_at)}</td></tr>`).join("")
      : `<tr><td colspan="6" class="muted">No leads yet. Start the agents or click “Find businesses”.</td></tr>`);
}

$("#stage-filter").addEventListener("change", loadLeads);
$("#leads").addEventListener("click", (event) => {
  const row = event.target.closest("tr[data-id]");
  if (row) openLead(row.dataset.id);
});

async function openLead(id) {
  const { lead, messages, sites } = await api(`leads/${id}`);
  $("#lead-title").textContent = lead.name;
  const stages = ["new", "qualified", "skipped", "contacted", "replied", "interested", "negotiating", "won", "lost", "do_not_contact"];
  $("#lead-body").innerHTML = `
    <p class="muted">${[esc(lead.category), esc(lead.address), lead.phone ? `+${esc(lead.phone)}` : ""].filter(Boolean).join(" · ")}${lead.website ? ` · <a href="${esc(lead.website)}" target="_blank" rel="noopener">website</a>` : ""}</p>
    <p>${esc(lead.pitch || "")}</p>
    ${sites.map((site) => `<p>Website preview: <a href="sites/${esc(site.slug)}" target="_blank" rel="noopener">${esc(site.slug)}</a></p>`).join("")}
    <div class="chat">${messages.map((m) => `<div class="bubble ${m.direction}">${esc(m.body)}<small>${when(m.created_at)}${m.direction === "out" ? ` · ${esc(m.status)}` : ""}</small></div>`).join("") || '<p class="muted">No messages yet.</p>'}</div>
    <div class="row"><label>Stage <select id="lead-stage">${stages.map((s) => `<option ${s === lead.stage ? "selected" : ""}>${s}</option>`).join("")}</select></label></div>
    <label>Notes<textarea id="lead-notes" rows="4">${esc(lead.notes)}</textarea></label>
    <div class="row"><span class="spacer"></span><button class="btn small" id="lead-save">Save</button></div>`;
  $("#lead-save").onclick = async () => {
    await api(`leads/${id}`, { method: "PATCH", body: { stage: $("#lead-stage").value, notes: $("#lead-notes").value } });
    toast("Lead updated");
    $("#lead-dialog").close();
    loadLeads();
  };
  $("#lead-dialog").showModal();
}

// ---------- Approvals ----------

async function loadApprovals() {
  const rows = await api("approvals");
  $("#approvals").innerHTML = rows.map((a) => `<div class="item">
    <div class="row"><b>${esc(a.reason)}</b><span class="spacer"></span><span class="pill">${esc(a.status)}</span></div>
    <p>${esc(a.payload.description)} — <b>${inr(a.payload.amount_inr)}</b></p>
    ${a.result?.url ? `<p>Link: <a href="${esc(a.result.url)}" target="_blank" rel="noopener">${esc(a.result.url)}</a></p>` : ""}
    ${a.result?.error ? `<p class="bad">${esc(a.result.error)}</p>` : ""}
    ${a.status === "pending" ? `<div class="row"><button class="btn small" data-approve="${a.id}">Approve & create payment link</button>
      <button class="btn small ghost" data-reject="${a.id}">Reject</button></div>` : `<p class="muted">${esc(a.decided_by || "")} · ${when(a.decided_at)}</p>`}
  </div>`).join("") || '<p class="muted">Nothing waiting for approval.</p>';
}

$("#approvals").addEventListener("click", async (event) => {
  const approve = event.target.dataset.approve;
  const reject = event.target.dataset.reject;
  if (!approve && !reject) return;
  event.target.disabled = true;
  try {
    if (approve) {
      const result = await api(`approvals/${approve}/approve`, { method: "POST" });
      toast(result.delivered ? "Payment link created and sent on WhatsApp" : "Payment link created — send it to the customer yourself");
    } else {
      await api(`approvals/${reject}/reject`, { method: "POST" });
      toast("Rejected");
    }
  } catch (error) {
    toast(error.message);
  }
  loadApprovals();
  loadOverview();
});

// ---------- Posts ----------

async function loadPosts() {
  const rows = await api("posts");
  $("#posts").innerHTML = rows.map((p) => `<div class="item">
    <div class="row"><span class="pill">${esc(p.platform)}</span>${p.lead_name ? `<span class="muted">for ${esc(p.lead_name)}</span>` : ""}<span class="spacer"></span>
      <button class="btn small ghost" data-copy="${p.id}">Copy</button>
      <button class="btn small" data-posted="${p.id}">Mark posted</button>
      <button class="btn small ghost" data-discard="${p.id}">Discard</button></div>
    <div class="post" id="post-${p.id}">${esc(p.body)}</div></div>`).join("") || '<p class="muted">No drafts right now.</p>';
}

$("#posts").addEventListener("click", async (event) => {
  const { copy, posted, discard } = event.target.dataset;
  if (copy) {
    await navigator.clipboard.writeText($(`#post-${copy}`).textContent);
    toast("Copied");
  } else if (posted || discard) {
    await api(`posts/${posted || discard}`, { method: "PATCH", body: { status: posted ? "posted" : "discarded" } });
    loadPosts();
  }
});

// ---------- Money ----------

async function loadLedger() {
  const rows = await api("ledger");
  $("#ledger").innerHTML = `<tr><th>Date</th><th>Type</th><th>Category</th><th>Amount</th><th>Note</th></tr>`
    + rows.map((r) => `<tr><td>${when(r.created_at)}</td><td class="${r.kind === "revenue" ? "good" : ""}">${esc(r.kind)}</td>
      <td>${esc(r.category)}</td><td>${inr(Number(r.amount_paise) / 100)}</td><td>${esc(r.note)}</td></tr>`).join("");
}

$("#ledger-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  const form = new FormData(event.currentTarget);
  await api("ledger", { method: "POST", body: { kind: form.get("kind"), category: form.get("category"), amount_inr: Number(form.get("amount_inr")), note: form.get("note") } });
  event.currentTarget.reset();
  toast("Entry added");
  loadLedger();
  loadOverview();
});

// ---------- Activity ----------

async function loadActivity() {
  const [log, tasks] = await Promise.all([api("log"), api("tasks")]);
  $("#log").innerHTML = log.map((l) => `<div class="log-line ${l.level === "error" ? "bad" : l.level === "warn" ? "warn" : ""}">
    <time>${when(l.created_at)}</time><b>${esc(l.agent)}</b> — ${esc(l.message)}</div>`).join("") || '<p class="muted">No activity yet.</p>';
  $("#tasks").innerHTML = `<tr><th>#</th><th>Job</th><th>Status</th><th>Tries</th><th>Error</th><th>Finished</th></tr>`
    + tasks.map((t) => `<tr><td>${t.id}</td><td>${esc(t.agent)}.${esc(t.kind)}</td><td>${esc(t.status)}</td><td>${t.attempts}</td>
      <td class="bad">${esc(t.error || "")}</td><td>${when(t.finished_at)}</td></tr>`).join("");
}

// ---------- Settings ----------

async function loadSettings() {
  const s = await api("settings");
  const form = $("#settings-form");
  form.city.value = s.city;
  form.categories.value = s.categories.join(", ");
  form.daily_outreach_limit.value = s.daily_outreach_limit;
  form.start.value = s.send_window.start;
  form.end.value = s.send_window.end;
  form.followup_days.value = s.followup_days.join(", ");
  form.max_sites_per_day.value = s.max_sites_per_day;
  form.products.value = JSON.stringify(s.products, null, 2);
}

$("#settings-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  const form = event.currentTarget;
  const list = (value) => value.split(",").map((v) => v.trim()).filter(Boolean);
  try {
    await api("settings", {
      method: "PUT",
      body: {
        city: form.city.value.trim(),
        categories: list(form.categories.value),
        daily_outreach_limit: Number(form.daily_outreach_limit.value),
        send_window: { start: Number(form.start.value), end: Number(form.end.value) },
        followup_days: list(form.followup_days.value).map(Number),
        max_sites_per_day: Number(form.max_sites_per_day.value),
        products: JSON.parse(form.products.value),
      },
    });
    toast("Settings saved");
  } catch (error) {
    toast(error.message);
  }
});

// ---------- Tabs, manual runs, boot ----------

const loaders = { leads: loadLeads, approvals: loadApprovals, posts: loadPosts, money: loadLedger, activity: loadActivity, settings: loadSettings };

document.querySelector(".tabs").addEventListener("click", (event) => {
  const tab = event.target.closest("button")?.dataset.tab;
  if (!tab) return;
  document.querySelectorAll(".tabs button").forEach((b) => b.classList.toggle("active", b.dataset.tab === tab));
  document.querySelectorAll(".tab").forEach((section) => { section.hidden = section.id !== `tab-${tab}`; });
  loaders[tab]().catch((error) => toast(error.message));
});

document.addEventListener("click", async (event) => {
  const run = event.target.dataset?.run;
  if (!run) return;
  await api(`run/${run}`, { method: "POST" });
  toast("Job queued — see the Activity tab");
});

(async () => {
  try {
    const me = await api("me");
    $("#who").textContent = `Signed in as ${me.email}`;
    $("#app").hidden = false;
    await Promise.all([loadOverview(), loadLeads(), loadChat()]);
    setInterval(() => {
      loadOverview().catch(() => {});
      if (!$("#chat-form button").disabled) loadChat().catch(() => {});
    }, 30_000);
  } catch (error) {
    $("#who").innerHTML = error.status === 401
      ? 'Please <a href="https://server.g58.in/console/">sign in to the G58 console</a> with an admin account, then reload.'
      : esc(error.message);
  }
})();
