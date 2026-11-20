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

// ---------- Email outreach ----------

let emailStatus = "draft";
let emailTimer = null;

async function loadEmailStatus() {
  const st = await api("email/status");
  const form = $("#find-form");
  if (!form.categories.value) form.categories.value = st.categories.join(", ");
  if (!form.area.value) form.area.value = st.city;
  $("#email-status").innerHTML = `<div class="status-line">
    <span>${st.smtp ? `Sending from <b>${esc(st.from)}</b>` : '<b class="bad">Email sending is not set up</b> (SMTP settings missing in .env)'}</span>
    ${st.reply_to ? `<span>Replies go to <b>${esc(st.reply_to)}</b></span>` : ""}
    <span>Drafts written by <b>${st.claude ? "Claude" : "templates"}</b></span>
    <span>Sent today <b>${st.sent_today}/${st.daily_limit}</b> · total ${st.sent_total}</span>
    <span>${st.leads_with_email} businesses with email · ${st.unsubscribed} unsubscribed</span>
  </div>
  ${st.jobs_running && st.activity ? `<p class="warn">Working: ${esc(st.activity.message)}</p>`
    : st.jobs_running ? '<p class="warn">Working… this page refreshes by itself.</p>'
    : st.activity ? `<p class="muted ${st.activity.level === "warn" || st.activity.level === "error" ? "warn" : ""}">Last: ${esc(st.activity.message)} (${when(st.activity.created_at)})</p>` : ""}
  <div>
  </div>`;
  const badge = $("#draft-count");
  badge.hidden = !st.drafts;
  badge.textContent = st.drafts;
  emailJobsRunning = st.jobs_running > 0;
  clearTimeout(emailTimer);
  if (st.jobs_running) emailTimer = setTimeout(() => loadEmail().catch(() => {}), 8000);
}

let visitResult = null;
let waitingForVisitList = false;
let emailJobsRunning = false;

// Columns the map has no data for (common for small shops) are left out.
function visitTable(rows) {
  const columns = [
    ["Business", () => true, (r) => `<b>${esc(r.name)}</b>${r.email ? `<br><span class="muted">${esc(r.email)}</span>` : ""}`],
    ["Map", (r) => r.map, (r) => (r.map ? `<a href="${esc(r.map)}" target="_blank" rel="noopener">Open map</a>` : "")],
    ["Phone", (r) => r.phone, (r) => (r.phone ? `<a href="tel:${esc(r.phone.replace(/\s/g, ""))}">${esc(r.phone)}</a>` : "")],
    ["Type", (r) => r.category, (r) => esc(r.category)],
    ["Locality", (r) => r.locality, (r) => esc(r.locality)],
    ["Address", (r) => r.address, (r) => esc(r.address)],
  ].filter(([, has]) => rows.some(has));
  return `<tr>${columns.map(([title]) => `<th>${title}</th>`).join("")}</tr>`
    + rows.map((r) => `<tr>${columns.map(([, , cell]) => `<td>${cell(r)}</td>`).join("")}</tr>`).join("");
}

async function renderVisitList() {
  const lists = await api("email/visit-lists");
  // After "Make call/visit list", switch to the newest list once the job has finished.
  if (waitingForVisitList && !emailJobsRunning) {
    waitingForVisitList = false;
    visitResult = null;
  }
  if (!visitResult || !lists.some((l) => l.id === visitResult.id)) {
    visitResult = lists.length ? await api(`email/visit-lists/${lists[0].id}`) : null;
  }
  const picker = lists.length > 1 ? `<select id="visit-pick">${lists.map((l) => `<option value="${l.id}" ${l.id === visitResult?.id ? "selected" : ""}>
    ${esc(l.area.split(",").slice(0, 2).join(","))} · ${esc(l.types.join(", "))} · ${l.count} · ${when(l.created_at)}</option>`).join("")}</select>` : "";
  if (!visitResult) {
    $("#drafts").innerHTML = '<p class="muted">Enter an area and business types above, then click “Make call/visit list”. It lists every business of those types on the map, with address, phone (when known) and a map link — useful for shops that have no email, like medicals and kirana stores.</p>';
    return;
  }
  const { area, types, rows } = visitResult;
  const withPhone = rows.filter((r) => r.phone).length;
  $("#drafts").innerHTML = `${picker}<div class="row wrap"><b>${rows.length} businesses</b><span class="muted">${esc(types.join(", "))} · ${withPhone} with phone · ${esc(area.split(",").slice(0, 2).join(","))}</span>
      <span class="spacer"></span><button class="btn small" id="visit-csv">Download CSV</button></div>
    <div class="table-wrap"><table id="visit-table">${visitTable(rows)}</table></div>`;
  if ($("#visit-pick")) {
    $("#visit-pick").onchange = async (event) => {
      visitResult = await api(`email/visit-lists/${event.target.value}`);
      renderVisitList();
    };
  }
  $("#visit-csv").onclick = () => {
    const cols = ["name", "category", "locality", "address", "phone", "email", "website", "map"];
    const cell = (v) => `"${String(v ?? "").replace(/"/g, '""')}"`;
    const csv = [cols.join(","), ...rows.map((r) => cols.map((c) => cell(r[c])).join(","))].join("\r\n");
    const link = document.createElement("a");
    link.href = URL.createObjectURL(new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8" }));
    link.download = `g58-visit-list-${area.split(",")[0].trim().toLowerCase().replace(/\W+/g, "-")}.csv`;
    link.click();
    URL.revokeObjectURL(link.href);
  };
}

$("#visit-btn").addEventListener("click", async () => {
  const form = $("#find-form");
  const area = form.area.value.trim();
  const categories = form.categories.value.split(",").map((c) => c.trim()).filter(Boolean);
  if (area.length < 2 || !categories.length) return toast("Enter an area and business types first");
  try {
    await api("email/visit-list", { method: "POST", body: { area, categories } });
    waitingForVisitList = true;
    emailStatus = "visit";
    document.querySelectorAll("#email-filter button").forEach((b) => b.classList.toggle("active", b.dataset.status === "visit"));
    toast("Making the list… usually 1–3 minutes. It will appear here.");
    await loadEmail();
  } catch (error) {
    toast(error.message);
  }
});

async function loadEmail() {
  if (emailStatus === "visit") {
    $("#draft-all").hidden = true;
    await loadEmailStatus();
    return renderVisitList();
  }
  const [, rows] = await Promise.all([loadEmailStatus(), api(`email/drafts?status=${emailStatus}`)]);
  $("#draft-all").hidden = emailStatus !== "draft";
  if (!rows.length) {
    $("#drafts").innerHTML = `<p class="muted">${emailStatus === "draft"
      ? "No drafts to review. Find emails in an area, then click “Draft emails for new businesses”."
      : "Nothing here yet."}</p>`;
    return;
  }
  $("#drafts").innerHTML = rows.map((d) => {
    const head = `<div class="row wrap"><b>${esc(d.lead_name)}</b><span class="pill">${esc(d.category)}</span>
      <span class="muted">${esc(d.city)}</span>${d.website ? `<a href="${esc(d.website)}" target="_blank" rel="noopener">website</a>` : ""}
      <span class="spacer"></span><span class="muted">${d.drafted_by === "claude" ? "Drafted by Claude" : "Template"}</span></div>`;
    if (d.status !== "draft") {
      return `<div class="draft">${head}<p class="muted">To ${esc(d.to_email)}${d.sent_at ? ` · sent ${when(d.sent_at)} by ${esc(d.sent_by)}` : ""}</p>
        <div class="sent-body"><b>${esc(d.subject)}</b>\n\n${esc(d.body)}</div></div>`;
    }
    return `<div class="draft" data-id="${d.id}">${head}
      ${d.error ? `<p class="bad">Last send failed: ${esc(d.error)}</p>` : ""}
      <div class="fields">
        <label class="muted">To <input name="to" type="email" value="${esc(d.to_email)}"></label>
        <label class="muted">Subject <input name="subject" value="${esc(d.subject)}" maxlength="200"></label>
        <textarea name="body" maxlength="5000">${esc(d.body)}</textarea>
        <span class="muted small-note">A Gravity58 footer with an unsubscribe link is added automatically.</span>
      </div>
      <div class="row"><button class="btn small" data-act="send">Send</button>
        <button class="btn small ghost" data-act="save">Save changes</button>
        <span class="spacer"></span><button class="btn small ghost" data-act="discard">Discard</button></div>
    </div>`;
  }).join("");
}

$("#email-filter").addEventListener("click", (event) => {
  const status = event.target.closest("button")?.dataset.status;
  if (!status) return;
  emailStatus = status;
  document.querySelectorAll("#email-filter button").forEach((b) => b.classList.toggle("active", b.dataset.status === status));
  loadEmail().catch((error) => toast(error.message));
});

$("#find-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  const form = event.currentTarget;
  const categories = form.categories.value.split(",").map((c) => c.trim()).filter(Boolean);
  try {
    await api("email/find", { method: "POST", body: { area: form.area.value.trim(), categories } });
    toast("Searching… usually 1–3 minutes. Drafts will appear below automatically.");
    loadEmailStatus();
  } catch (error) {
    toast(error.message);
  }
});

$("#draft-all").addEventListener("click", async () => {
  await api("email/draft", { method: "POST", body: {} });
  toast("Drafting emails…");
  loadEmailStatus();
});

$("#drafts").addEventListener("click", async (event) => {
  const act = event.target.dataset.act;
  const card = event.target.closest(".draft[data-id]");
  if (!act || !card) return;
  const id = card.dataset.id;
  const edits = { to: card.querySelector("[name=to]").value.trim(), subject: card.querySelector("[name=subject]").value.trim(), body: card.querySelector("[name=body]").value.trim() };
  event.target.disabled = true;
  try {
    if (act === "send") {
      event.target.textContent = "Sending…";
      await api(`email/drafts/${id}/send`, { method: "POST", body: edits });
      toast(`Sent to ${edits.to}`);
    } else if (act === "save") {
      await api(`email/drafts/${id}`, { method: "PATCH", body: edits });
      toast("Saved");
      event.target.disabled = false;
      return;
    } else {
      await api(`email/drafts/${id}/discard`, { method: "POST" });
      toast("Discarded");
    }
  } catch (error) {
    toast(error.message);
  }
  loadEmail().catch(() => {});
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

const loaders = { email: loadEmail, leads: loadLeads, approvals: loadApprovals, posts: loadPosts, money: loadLedger, activity: loadActivity, settings: loadSettings };

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
    await Promise.all([loadOverview(), loadEmail(), loadChat()]);
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
