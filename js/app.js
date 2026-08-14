const DAY = 86400000;
const defaultCustomers = [
  {
    id: "C1001",
    type: "customer",
    title: "Need Modular Kitchen Installation",
    category: "Interior Design",
    description:
      "Looking for a modular kitchen supplier and installer for a new 3BHK apartment.",
    state: "Telangana",
    district: "Hyderabad",
    city: "Hyderabad",
    area: "Madhapur",
    fullAddress: "Madhapur, Hyderabad, Telangana",
    price: 150000,
    maxPrice: 200000,
    image:
      "https://images.unsplash.com/photo-1556911220-bff31c812dba?auto=format&fit=crop&w=900&q=85",
    name: "Private Customer",
    whatsapp: "919900000001",
    email: "",
    phone: "9000000001",
    status: "Open for Bids",
    created: Date.now() - 3 * DAY,
    expiresAt: Date.now() + 27 * DAY,
    bids: [
      {
        business: "DreamSpace Interiors",
        amount: 172000,
        time: "25 days",
        proposal: "Premium materials and full installation.",
        whatsapp: "919999999991",
      },
    ],
  },
  {
    id: "C1002",
    type: "customer",
    title: "Emergency Plumbing Repair",
    category: "Plumbing",
    description: "Kitchen pipeline is leaking and requires same-day repair.",
    state: "Telangana",
    district: "Hyderabad",
    city: "Hyderabad",
    area: "Kondapur",
    fullAddress: "Kondapur, Hyderabad, Telangana",
    price: 1500,
    maxPrice: 2500,
    image:
      "https://images.unsplash.com/photo-1585704032915-c3400ca199e7?auto=format&fit=crop&w=900&q=85",
    name: "Private Customer",
    whatsapp: "919900000002",
    email: "",
    phone: "9000000002",
    status: "Open for Bids",
    created: Date.now() - 2 * DAY,
    expiresAt: Date.now() + 28 * DAY,
    bids: [],
  },
];
const defaultBusinesses = [
  {
    id: "B2001",
    type: "business",
    title: "DreamSpace Interiors",
    category: "Interior Design",
    description:
      "Complete home interiors, modular kitchens, wardrobes and false ceilings.",
    state: "Telangana",
    district: "Hyderabad",
    city: "Hyderabad",
    area: "Gachibowli",
    fullAddress: "Gachibowli, Hyderabad, Telangana",
    price: 1200,
    experience: 8,
    projects: 120,
    image:
      "https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?auto=format&fit=crop&w=900&q=85",
    whatsapp: "919999999991",
    email: "hello@dreamspace.example",
    phone: "9000000011",
    altPhone: "9000000012",
    socialUrl: "https://instagram.com/dreamspace.interiors",
    created: Date.now() - 5 * DAY,
  },
  {
    id: "B2002",
    type: "business",
    title: "QuickFix Plumbing",
    category: "Plumbing",
    description:
      "Leak repair, fittings, pipelines and emergency plumbing services.",
    state: "Telangana",
    district: "Hyderabad",
    city: "Hyderabad",
    area: "Kukatpally",
    fullAddress: "Kukatpally, Hyderabad, Telangana",
    price: 500,
    experience: 6,
    projects: 430,
    image:
      "https://images.unsplash.com/photo-1607472586893-edb57bdc0e39?auto=format&fit=crop&w=900&q=85",
    whatsapp: "919999999992",
    email: "quickfix@example.com",
    phone: "9000000021",
    altPhone: "9000000022",
    socialUrl: "https://instagram.com/quickfix.plumbing",
    created: Date.now() - 4 * DAY,
  },
];
let customers = [];
let businesses = [];
let activeMode = "customer",
  adminMode = "customer";
let selectedState = (localStorage.getItem("g58SelectedState") || "").trim();
let selectedDistrict = (
  localStorage.getItem("g58SelectedDistrict") || ""
).trim();
let showNationalBusinessesOnly = false;
let gravity58Ready = false;
let lastPublishedPostId = "";
window.G58GetPostState = () => ({ customers, businesses, lastPublishedPostId });
let lastPublishedPostType = "customer";
let gravity58SaveTimer = null;
const blockedTerms = [
  "sex",
  "sexual",
  "nude",
  "naked",
  "porn",
  "xxx",
  "escort",
  "prostitute",
  "rape",
  "fuck",
  "bitch",
  "bastard",
  "asshole",
  "kill",
  "murder",
  "hate",
  "terrorist",
  "scam",
  "fraud",
  "drugs",
];

const categoryImages = {
  "Interior Design":
    "https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?auto=format&fit=crop&w=900&q=85",
  "Modular Kitchen":
    "https://images.unsplash.com/photo-1556911220-bff31c812dba?auto=format&fit=crop&w=900&q=85",
  Plumbing:
    "https://images.unsplash.com/photo-1585704032915-c3400ca199e7?auto=format&fit=crop&w=900&q=85",
  Electrical:
    "https://images.unsplash.com/photo-1621905252507-b35492cc74b4?auto=format&fit=crop&w=900&q=85",
  Painting:
    "https://images.unsplash.com/photo-1562259949-e8e7689d7828?auto=format&fit=crop&w=900&q=85",
  Carpentry:
    "https://images.unsplash.com/photo-1601058268499-e52658b8bb88?auto=format&fit=crop&w=900&q=85",
  Cleaning:
    "https://images.unsplash.com/photo-1581578731548-c64695cc6952?auto=format&fit=crop&w=900&q=85",
  Catering:
    "https://images.unsplash.com/photo-1555244162-803834f70033?auto=format&fit=crop&w=900&q=85",
  "Website Development":
    "https://images.unsplash.com/photo-1460925895917-afdab827c52f?auto=format&fit=crop&w=900&q=85",
  "Digital Marketing":
    "https://images.unsplash.com/photo-1533750516457-a7f992034fec?auto=format&fit=crop&w=900&q=85",
  "Graphic Design":
    "https://images.unsplash.com/photo-1626785774573-4b799315345d?auto=format&fit=crop&w=900&q=85",
  Photography:
    "https://images.unsplash.com/photo-1452780212940-6f5c0d14d848?auto=format&fit=crop&w=900&q=85",
  "Event Management":
    "https://images.unsplash.com/photo-1507501336603-6e31db2be093?auto=format&fit=crop&w=900&q=85",
  Other:
    "https://images.unsplash.com/photo-1521791136064-7986c2920216?auto=format&fit=crop&w=900&q=85",
};
function defaultImageByCategory(category, type) {
  return (
    categoryImages[category] ||
    (type === "business"
      ? "https://images.unsplash.com/photo-1521791136064-7986c2920216?auto=format&fit=crop&w=900&q=85"
      : "https://images.unsplash.com/photo-1503387762-592deb58ef4e?auto=format&fit=crop&w=900&q=85")
  );
}

function normalize(v) {
  return String(v || "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ");
}
function escapeHtml(v) {
  return String(v || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
function cleanNumber(v) {
  return String(v || "").replace(/\D/g, "");
}
function formatMoney(v) {
  return "₹" + Number(v || 0).toLocaleString("en-IN");
}
function saveData() {
  localStorage.setItem("g58CustomersV3", JSON.stringify(customers));
  localStorage.setItem("g58BusinessesV3", JSON.stringify(businesses));
  if (!gravity58Ready) return;
  clearTimeout(gravity58SaveTimer);
  gravity58SaveTimer = setTimeout(() => {
    Gravity58DB.saveState({ customers, businesses }).catch((error) => {
      console.error("GRAVITY58 cloud save failed:", error);
      Gravity58DB.setStatus("error", "Database save failed");
    });
  }, 180);
}
function purgeExpired() {
  const now = Date.now();
  const before = customers.length;
  customers = customers.filter(
    (c) => !c.accepted && (c.expiresAt || c.created + 30 * DAY) > now,
  );
  if (before !== customers.length) saveData();
}
function daysLeft(c) {
  return Math.max(
    0,
    Math.ceil(((c.expiresAt || c.created + 30 * DAY) - Date.now()) / DAY),
  );
}

const INDIA_STATES = [
  "Andaman and Nicobar Islands",
  "Andhra Pradesh",
  "Arunachal Pradesh",
  "Assam",
  "Bihar",
  "Chandigarh",
  "Chhattisgarh",
  "Dadra and Nagar Haveli and Daman and Diu",
  "Delhi",
  "Goa",
  "Gujarat",
  "Haryana",
  "Himachal Pradesh",
  "Jammu and Kashmir",
  "Jharkhand",
  "Karnataka",
  "Kerala",
  "Ladakh",
  "Lakshadweep",
  "Madhya Pradesh",
  "Maharashtra",
  "Manipur",
  "Meghalaya",
  "Mizoram",
  "Nagaland",
  "Odisha",
  "Puducherry",
  "Punjab",
  "Rajasthan",
  "Sikkim",
  "Tamil Nadu",
  "Telangana",
  "Tripura",
  "Uttar Pradesh",
  "Uttarakhand",
  "West Bengal",
];
function itemState(item) {
  if (item.state) return item.state;
  const legacy = normalize(`${item.city || ""} ${item.area || ""}`);
  if (
    legacy.includes("hyderabad") ||
    legacy.includes("madhapur") ||
    legacy.includes("kondapur") ||
    legacy.includes("gachibowli") ||
    legacy.includes("kukatpally") ||
    legacy.includes("manikonda")
  )
    return "Telangana";
  return "";
}
function itemDistrict(item) {
  return item.district || item.city || "";
}
function matchesSelectedLocation(item) {
  if (!selectedState) return false;
  if (normalize(itemState(item)) !== normalize(selectedState)) return false;
  if (
    selectedDistrict &&
    normalize(itemDistrict(item)) !== normalize(selectedDistrict)
  )
    return false;
  return true;
}
function populateStateSelects() {
  const options =
    '<option value="">Select State / UT</option>' +
    INDIA_STATES.map(
      (state) =>
        `<option value="${escapeHtml(state)}">${escapeHtml(state)}</option>`,
    ).join("");
  ["firstStateSelect", "postState"].forEach((id) => {
    const el = document.getElementById(id);
    if (el) {
      el.innerHTML = options;
      if (selectedState) el.value = selectedState;
    }
  });
}
function availableDistricts() {
  const all = [...customers, ...businesses]
    .filter((item) => normalize(itemState(item)) === normalize(selectedState))
    .map((item) => itemDistrict(item).trim())
    .filter(Boolean);
  return [...new Set(all)].sort((a, b) => a.localeCompare(b));
}
function populateDistrictFilter() {
  const select = document.getElementById("districtFilter");
  if (!select) return;
  const districts = availableDistricts();
  select.innerHTML =
    '<option value="">All Districts</option>' +
    districts
      .map((d) => `<option value="${escapeHtml(d)}">${escapeHtml(d)}</option>`)
      .join("");
  if (
    selectedDistrict &&
    districts.some((d) => normalize(d) === normalize(selectedDistrict))
  ) {
    const exact = districts.find(
      (d) => normalize(d) === normalize(selectedDistrict),
    );
    select.value = exact;
  } else {
    selectedDistrict = "";
    localStorage.removeItem("g58SelectedDistrict");
  }
}
function updateStateUI() {
  const stateText = selectedState || "Select State";
  const districtText = selectedDistrict ? ` • ${selectedDistrict}` : "";
  const homeChip = document.getElementById("locationChip");
  const activeChip = document.getElementById("activeLocationChip");
  const notice = document.getElementById("locationNotice");
  if (homeChip) homeChip.textContent = `📍 ${stateText}${districtText}`;
  if (activeChip) activeChip.textContent = `📍 ${stateText}${districtText}`;
  if (notice) {
    notice.className = selectedState
      ? "location-notice ready"
      : "location-notice warning";
    notice.textContent = selectedState
      ? `Showing ${selectedDistrict || "all district"} posts in ${selectedState}.`
      : "Select your State / UT to view posts.";
  }
  populateDistrictFilter();
}
function openStateSelection(force = false) {
  populateStateSelects();
  const modal = document.getElementById("stateSelectionModal");
  if (!modal) return;
  modal.classList.add("show");
  modal.dataset.required = force || !selectedState ? "true" : "false";
  const close = document.getElementById("stateModalClose");
  if (close)
    close.style.display = modal.dataset.required === "true" ? "none" : "";
}
function saveSelectedState() {
  const state = document.getElementById("firstStateSelect")?.value || "";
  if (!state) {
    const error = document.getElementById("stateSelectionError");
    if (error) error.textContent = "Please select your State / UT.";
    return;
  }
  selectedState = state;
  selectedDistrict = "";
  localStorage.setItem("g58SelectedState", selectedState);
  localStorage.removeItem("g58SelectedDistrict");
  const error = document.getElementById("stateSelectionError");
  if (error) error.textContent = "";
  closeModal("stateSelectionModal");
  updateStateUI();
  renderRecentJobs();
  renderWall();
  if (sessionStorage.getItem("g58OpenBusinessCreatorAfterState") === "true") {
    sessionStorage.removeItem("g58OpenBusinessCreatorAfterState");
    selectMode("business");
    openCreateModal();
    document.getElementById("postType").value = "business";
    updateFormType();
  }
}
function changeDistrictFilter() {
  selectedDistrict = document.getElementById("districtFilter")?.value || "";
  if (selectedDistrict)
    localStorage.setItem("g58SelectedDistrict", selectedDistrict);
  else localStorage.removeItem("g58SelectedDistrict");
  updateStateUI();
  renderRecentJobs();
  renderWall();
}

function renderRecentJobs() {
  const panel = document.getElementById("recentJobsPanel");
  const label = document.getElementById("recentCityLabel");
  if (!panel) return;
  const list = [...customers]
    .filter(matchesSelectedLocation)
    .sort((a, b) => b.created - a.created)
    .slice(0, 6);
  if (label)
    label.textContent = selectedDistrict || selectedState || "Select State";
  panel.innerHTML = list.length
    ? list
        .map(
          (c, i) => `
    <button class="recent-job" onclick="openRecentJob('${c.id}')">
      <span class="recent-count">${i + 1}</span>
      <span class="recent-category">${escapeHtml(c.category)}</span>
      <strong>${escapeHtml(c.title)}</strong>
      <span>📍 ${escapeHtml(c.area)}, ${escapeHtml(itemDistrict(c))}</span>
      <span>💰 ${formatMoney(c.price)}–${formatMoney(c.maxPrice)}</span>
    </button>`,
        )
        .join("")
    : '<div class="recent-empty">No posts are available for the selected location.</div>';
}
function openRecentJob(id) {
  const c = customers.find((x) => x.id === id);
  selectMode("customer");
  if (c) {
    document.getElementById("searchInput").value = c.title;
    renderWall();
    setTimeout(
      () =>
        document
          .getElementById("wall")
          ?.scrollIntoView({ behavior: "smooth", block: "start" }),
      120,
    );
  }
}

function showLanding() {
  document.getElementById("home").style.display = "";
  document.getElementById("contentArea").style.display = "";
  document.getElementById("contentArea").classList.remove("show");
  window.scrollTo({ top: 0, behavior: "smooth" });
}
function selectMode(mode) {
  activeMode = mode;
  document.getElementById("home").style.display = "none";
  document.getElementById("contentArea").style.display = "";
  document.getElementById("contentArea").classList.add("show");
  document
    .getElementById("customerTab")
    .classList.toggle("active", mode === "customer");
  document
    .getElementById("businessTab")
    .classList.toggle("active", mode === "business");
  document
    .getElementById("businessNationalToggle")
    ?.classList.toggle("hidden", mode !== "business");
  document
    .getElementById("contentArea")
    ?.classList.toggle("g58-mode-customer", mode === "customer");
  if (mode !== "business") {
    showNationalBusinessesOnly = false;
    const nationalCheckbox = document.getElementById("nationalBusinessOnly");
    if (nationalCheckbox) nationalCheckbox.checked = false;
  }
  document.getElementById("wallTitle").textContent =
    mode === "customer" ? "Customer Requirements" : "Business Owners";
  document.getElementById("wallSubtitle").textContent =
    mode === "customer"
      ? "Posts from your selected State and District."
      : "Business cards from your selected State and District.";
  const guideButton = document.getElementById("browseGuideButton");
  if (guideButton)
    guideButton.textContent =
      mode === "customer"
        ? "? How Browse Jobs Works"
        : "? How Browse Business Works";
  renderWall();
  window.scrollTo({ top: 0, behavior: "smooth" });
}
function renderWall() {
  purgeExpired();
  renderRecentJobs();
  const q = normalize(document.getElementById("searchInput").value);
  const cat = document.getElementById("categoryFilter").value;
  const sort = document.getElementById("sortFilter").value;
  const budget = document.getElementById("budgetFilter")?.value || "";
  let list = (
    activeMode === "customer" ? [...customers] : [...businesses]
  ).filter((item) => item.moderationStatus !== "blocked");
  list = list.filter(matchesSelectedLocation);
  if (activeMode === "business" && showNationalBusinessesOnly) {
    list = list.filter((item) => item.isNational === true);
  }
  list = list.filter(
    (i) =>
      (!q ||
        normalize(
          `${i.title} ${i.description} ${itemState(i)} ${itemDistrict(i)} ${i.area} ${i.fullAddress || ""}`,
        ).includes(q)) &&
      (!cat || i.category === cat),
  );
  if (activeMode === "customer" && budget) {
    const [minB, maxB] = budget.split("-").map(Number);
    list = list.filter((i) => {
      const lo = Number(i.price || 0);
      const hi = Number(i.maxPrice || i.price || 0);
      return hi >= minB && lo <= maxB;
    });
  }
  if (sort === "nearby") list.sort((a, b) => b.created - a.created);
  if (sort === "latest") list.sort((a, b) => b.created - a.created);
  if (sort === "low") list.sort((a, b) => a.price - b.price);
  if (sort === "high") list.sort((a, b) => b.price - a.price);
  if (sort === "few")
    list.sort((a, b) => (a.bids || []).length - (b.bids || []).length);
  if (sort === "rated" && activeMode === "business")
    list.sort(
      (a, b) =>
        businessRatingStats(b).average - businessRatingStats(a).average ||
        businessRatingStats(b).count - businessRatingStats(a).count,
    );
  if (sort === "shuffle") list.sort(() => Math.random() - 0.5);
  const wall = document.getElementById("wall");
  if (activeMode === "customer" && !gravity58Ready) {
    wall.innerHTML = customerWallSkeleton();
  } else if (list.length) {
    wall.innerHTML = list
      .map(activeMode === "customer" ? customerCard : businessCard)
      .join("");
  } else if (activeMode === "customer") {
    const rawQuery = document.getElementById("searchInput").value.trim();
    wall.innerHTML = rawQuery
      ? `<div class="req-empty"><div class="req-empty-icon">🔍</div><h3>No results for "${escapeHtml(rawQuery)}"</h3><p>Try another keyword or browse nearby requirements.</p><button class="btn" onclick="document.getElementById('searchInput').value='';renderWall()">Clear Search</button></div>`
      : `<div class="req-empty"><div class="req-empty-icon">📭</div><h3>No requirements found here yet.</h3><p>Try another district, category or broaden your filters.</p><div class="req-empty-actions"><button class="btn" onclick="clearCustomerWallFilters()">Clear Filters</button><button class="btn primary" onclick="openStateSelection(true)">Change Location</button></div></div>`;
  } else {
    wall.innerHTML = `<div class="empty">${activeMode === "business" && showNationalBusinessesOnly ? "No National Business Cards are available in the selected location." : selectedState ? `No posts are available in ${escapeHtml(selectedDistrict || selectedState)} yet.` : "Select your State / UT to view posts."}</div>`;
  }
  if (typeof window.afterRenderWall === "function") window.afterRenderWall(list);
}
function customerWallSkeleton() {
  return Array.from(
    { length: 4 },
    () =>
      `<article class="req-card req-skeleton"><div class="sk-line sk-w40"></div><div class="sk-line sk-w80 sk-h20"></div><div class="sk-line sk-w60"></div><div class="sk-line sk-w100"></div><div class="sk-line sk-w100"></div><div class="sk-row"><div class="sk-line sk-w30"></div><div class="sk-line sk-w30"></div></div></article>`,
  ).join("");
}
function clearCustomerWallFilters() {
  document.getElementById("searchInput").value = "";
  document.getElementById("categoryFilter").value = "";
  const budgetEl = document.getElementById("budgetFilter");
  if (budgetEl) budgetEl.value = "";
  const districtEl = document.getElementById("districtFilter");
  if (districtEl) {
    districtEl.value = "";
    changeDistrictFilter();
  }
  renderWall();
}
function timeAgoLabel(ts) {
  const diff = Date.now() - Number(ts || 0);
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return mins + (mins === 1 ? " minute ago" : " minutes ago");
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return hrs + (hrs === 1 ? " hour ago" : " hours ago");
  const days = Math.floor(hrs / 24);
  return days + (days === 1 ? " day ago" : " days ago");
}
function customerCard(c) {
  const bidCount = (c.bids || []).length;
  const isOwner = sessionStorage.getItem(`g58OwnerUnlocked_${c.id}`) === "true";
  const full = bidCount >= 5;
  const almost = bidCount >= 4 && !full;
  const statusClass = full ? "full" : almost ? "almost" : "open";
  const statusLabel = full
    ? "Offers Full"
    : almost
      ? `${bidCount} of 5 Offers`
      : "Accepting Offers";
  const dots = Array.from(
    { length: 5 },
    (_, i) => `<span class="req-dot${i < bidCount ? " filled" : ""}"></span>`,
  ).join("");
  const shareRow = `<div class="req-share-row"><button type="button" class="req-link-btn" onclick="copyCustomerLink('${c.id}',this)">Copy Link</button><button type="button" class="req-link-btn" onclick="shareCustomerOnWhatsApp('${c.id}')">Share</button></div><div class="share-status" id="customer-share-${c.id}"></div>`;

  if (isOwner) {
    return `<article class="req-card owner" data-post-id="${c.id}">
<div class="req-top"><span class="req-owner-badge">Your Requirement</span><span class="req-status ${statusClass}"><i></i>${statusLabel}</span></div>
<h3 class="req-title">${escapeHtml(c.title)}</h3>
<div class="req-meta-row"><span>📍 ${escapeHtml(c.area)}, ${escapeHtml(itemDistrict(c))}</span><span>${timeAgoLabel(c.created)}</span></div>
<div class="req-bottom-row"><div class="req-budget"><strong>${formatMoney(c.price)}–${formatMoney(c.maxPrice)}</strong><small>Budget</small></div><div class="req-bid-progress"><div class="req-dots">${dots}</div><small>${bidCount} / 5 Offers</small></div></div>
<div class="req-actions"><button type="button" class="btn primary" onclick="openRequirementDetail('${c.id}')">View Offers (${bidCount}) <span class="req-arrow">→</span></button></div>
${shareRow}
</article>`;
  }

  return `<article class="req-card" data-post-id="${c.id}">
<div class="req-top"><span class="req-category">${escapeHtml(c.category)}</span><span class="req-status ${statusClass}"><i></i>${statusLabel}</span></div>
<h3 class="req-title">${escapeHtml(c.title)}</h3>
<div class="req-meta-row"><span>📍 ${escapeHtml(c.area)}, ${escapeHtml(itemDistrict(c))}</span><span>${timeAgoLabel(c.created)}</span></div>
<p class="req-desc">${escapeHtml(c.description)}</p>
<div class="req-bottom-row"><div class="req-budget"><strong>${formatMoney(c.price)}–${formatMoney(c.maxPrice)}</strong><small>Budget</small></div><div class="req-bid-progress"><div class="req-dots">${dots}</div><small>${bidCount} / 5 Offers</small></div></div>
${bidCount === 4 ? '<div class="req-scarcity">Only 1 offer slot remaining</div>' : ""}
<div class="req-actions">
<button type="button" class="btn ghost" onclick="openRequirementDetail('${c.id}')">View Requirement <span class="req-arrow">→</span></button>
${full ? '<button type="button" class="btn" disabled>Offers Full</button>' : `<button type="button" class="btn primary" onclick="openBidModal('${c.id}')">Submit Bid</button>`}
</div>
<label class="req-unlock-row"><input type="checkbox" onchange="requestCardUnlock('customer','${c.id}',this)"><span>Is this your post? Unlock</span></label>
${shareRow}
</article>`;
}

let activeRequirementDetailId = null;
function openRequirementDetail(id) {
  const c = customers.find((x) => x.id === id);
  if (!c) return;
  activeRequirementDetailId = id;
  const isOwner = sessionStorage.getItem(`g58OwnerUnlocked_${id}`) === "true";
  const body = document.getElementById("reqDetailBody");
  if (body)
    body.innerHTML = isOwner
      ? renderOfferComparisonContent(c)
      : renderRequirementDetailContent(c);
  document.getElementById("reqDetailPanel")?.classList.add("open");
  document.getElementById("reqDetailOverlay")?.classList.add("open");
  document.body.classList.add("req-detail-lock");
}
function closeRequirementDetail() {
  document.getElementById("reqDetailPanel")?.classList.remove("open");
  document.getElementById("reqDetailOverlay")?.classList.remove("open");
  document.body.classList.remove("req-detail-lock");
  activeRequirementDetailId = null;
}
function refreshRequirementDetailIfOpen(id) {
  if (activeRequirementDetailId === id) openRequirementDetail(id);
}
function renderRequirementDetailContent(c) {
  const bidCount = (c.bids || []).length;
  const full = bidCount >= 5;
  const almost = bidCount >= 4 && !full;
  const statusClass = full ? "full" : almost ? "almost" : "open";
  const statusLabel = full
    ? "Offers Full"
    : almost
      ? `${bidCount} of 5 Offers`
      : "Accepting Offers";
  const dots = Array.from(
    { length: 5 },
    (_, i) => `<span class="req-dot${i < bidCount ? " filled" : ""}"></span>`,
  ).join("");
  return `
<span class="req-detail-category">${escapeHtml(c.category)}</span>
<h2 class="req-detail-title">${escapeHtml(c.title)}</h2>
<div class="req-detail-meta"><span>📍 ${escapeHtml(c.area)}, ${escapeHtml(itemDistrict(c))}</span><span>${timeAgoLabel(c.created)}</span></div>
<span class="req-status ${statusClass}"><i></i>${statusLabel}</span>
<div class="req-detail-section"><h4>Requirement</h4><p>${escapeHtml(c.description)}</p></div>
<div class="req-detail-section"><h4>Budget</h4><div class="req-detail-budget">${formatMoney(c.price)} – ${formatMoney(c.maxPrice)}</div><small>Expected Budget</small></div>
<div class="req-detail-section"><h4>Location</h4><p>${escapeHtml(c.area)}<br>${escapeHtml(itemDistrict(c))}<br>${escapeHtml(itemState(c))}</p></div>
<div class="req-detail-section"><h4>Offer Activity</h4><div class="req-bid-progress"><div class="req-dots">${dots}</div><small>${bidCount} / 5 Offers Received</small></div></div>
<div class="req-detail-sticky">${
    full
      ? '<button type="button" class="btn" style="width:100%" disabled>Offers Full</button><p class="req-detail-sticky-note">This requirement has received the maximum number of offers.</p>'
      : `<button type="button" class="btn primary" style="width:100%" onclick="openBidModal('${c.id}')">Submit Your Offer <span class="cta-arrow">→</span></button>`
  }</div>`;
}
function renderOfferComparisonContent(c) {
  const bids = c.bids || [];
  return `
<span class="req-owner-badge">Your Requirement</span>
<h2 class="req-detail-title">${escapeHtml(c.title)}</h2>
<div class="req-detail-meta"><span>📍 ${escapeHtml(c.area)}, ${escapeHtml(itemDistrict(c))}</span><span>${timeAgoLabel(c.created)}</span></div>
<h3 class="req-compare-heading">Compare Offers</h3>
<p class="req-compare-sub">Review each business before making your choice.</p>
${
  bids.length
    ? `<div class="req-offer-list">${bids
        .map(
          (b, i) => `
<article class="req-offer-card">
<div class="req-offer-top"><span class="req-offer-num">OFFER ${String(i + 1).padStart(2, "0")}</span></div>
<h4>${escapeHtml(b.business)}</h4>
<div class="req-offer-price">${formatMoney(b.amount)}</div>
<div class="req-offer-time">${escapeHtml(b.time)}</div>
<p class="req-offer-proposal">${escapeHtml(b.proposal)}</p>
<div class="req-offer-contact">🔒 Available after acceptance</div>
<div class="req-offer-actions">
<button type="button" class="btn primary" onclick="acceptBid('${c.id}',${i})">Accept Offer</button>
<button type="button" class="btn danger" onclick="deleteCustomerBid('${c.id}','${escapeHtml(b.id || String(i))}')">Delete</button>
</div>
</article>`,
        )
        .join("")}</div>${bids.length >= 2 ? renderOfferComparisonTable(bids) : ""}`
    : '<div class="req-offer-empty">No active offers yet. Available slots: 5.</div>'
}`;
}
function renderOfferComparisonTable(bids) {
  return `<div class="req-compare-table-wrap"><table class="req-compare-table">
<tr><th></th>${bids.map((_, i) => `<th>Offer ${i + 1}</th>`).join("")}</tr>
<tr><td>Price</td>${bids.map((b) => `<td>${formatMoney(b.amount)}</td>`).join("")}</tr>
<tr><td>Time</td>${bids.map((b) => `<td>${escapeHtml(b.time)}</td>`).join("")}</tr>
<tr><td>Business</td>${bids.map((b) => `<td>${escapeHtml(b.business)}</td>`).join("")}</tr>
</table></div>`;
}
function businessDemoUrl(b) {
  const raw = String(b.socialUrl || b.demoUrl || b.instagram || "").trim();
  if (!raw) return "";
  if (/^https?:\/\//i.test(raw)) return raw;
  if (raw.startsWith("@")) return "https://instagram.com/" + raw.slice(1);
  if (/^[a-zA-Z0-9._]+$/.test(raw)) return "https://instagram.com/" + raw;
  return "https://" + raw;
}
function callBusinessPhone(id) {
  const b = businesses.find((x) => x.id === id);
  if (!b) return;
  const number = cleanNumber(b.phone || b.whatsapp || "");
  if (!number) return alert("Contact number is not available.");
  window.location.href = "tel:" + number;
}
async function copyBusinessPhone(id, button) {
  const b = businesses.find((x) => x.id === id);
  if (!b) return;
  const number = b.phone || b.whatsapp || "";
  if (!number) return alert("Contact number is not available.");
  try {
    await navigator.clipboard.writeText(number);
    if (button) {
      const old = button.textContent;
      button.textContent = "Number Copied";
      setTimeout(() => (button.textContent = old), 1800);
    }
  } catch {
    prompt("Copy contact number:", number);
  }
}
function openBusinessDemo(id) {
  const b = businesses.find((x) => x.id === id);
  if (!b) return;
  const url = businessDemoUrl(b);
  if (!url)
    return alert("Website or social-media link is not added for this business.");
  window.open(url, "_blank", "noopener");
}

const G58_RATER_ID_KEY = "g58AnonymousRaterIdV1";
let activeRatingBusinessId = "";
let selectedRatingValue = 0;

function anonymousRaterId() {
  let id = localStorage.getItem(G58_RATER_ID_KEY);
  if (!id) {
    id =
      "rater-" +
      Date.now().toString(36) +
      "-" +
      Math.random().toString(36).slice(2, 10);
    localStorage.setItem(G58_RATER_ID_KEY, id);
  }
  return id;
}
function businessReviews(b) {
  return Array.isArray(b.reviews) ? b.reviews : [];
}
function businessRatingStats(b) {
  const reviews = businessReviews(b).filter(
    (r) => Number(r.rating) >= 1 && Number(r.rating) <= 5,
  );
  const count = reviews.length;
  const average = count
    ? reviews.reduce((sum, r) => sum + Number(r.rating), 0) / count
    : 0;
  return { count, average };
}
function ratingStars(value) {
  const rounded = Math.round(Number(value) || 0);
  return (
    '<span class="rating-stars" aria-label="' +
    Number(value || 0).toFixed(1) +
    ' out of 5">' +
    [1, 2, 3, 4, 5]
      .map(
        (n) => '<span class="' + (n <= rounded ? "filled" : "") + '">★</span>',
      )
      .join("") +
    "</span>"
  );
}
function ratingSummaryHtml(b) {
  const stats = businessRatingStats(b);
  if (!stats.count)
    return `${ratingStars(0)}<strong>New</strong><small>No ratings yet</small>`;
  return `${ratingStars(stats.average)}<strong>${stats.average.toFixed(1)}</strong><small>${stats.count} ${stats.count === 1 ? "rating" : "ratings"}</small>`;
}
function sanitiseReviewText(value) {
  return String(value || "")
    .trim()
    .replace(/\s+/g, " ")
    .slice(0, 280);
}
function safeReviewerName(value) {
  return String(value || "")
    .trim()
    .replace(/\s+/g, " ")
    .slice(0, 40);
}
function openBusinessRating(id) {
  const business = businesses.find((item) => item.id === id);
  if (!business) return;
  activeRatingBusinessId = id;
  const myReview = businessReviews(business).find(
    (r) => r.raterId === anonymousRaterId(),
  );
  selectedRatingValue = Number(myReview?.rating || 0);
  document.getElementById("ratingBusinessTitle").textContent =
    "Rate " + business.title;
  document.getElementById("ratingName").value =
    myReview?.name || localStorage.getItem("g58ReviewerName") || "";
  document.getElementById("ratingComment").value = myReview?.comment || "";
  document
    .getElementById("deleteMyRatingBtn")
    .classList.toggle("hidden", !myReview);
  document.getElementById("ratingFormStatus").textContent = "";
  refreshRatingModal();
  document.getElementById("businessRatingModal").classList.add("show");
}
function closeBusinessRating() {
  document.getElementById("businessRatingModal")?.classList.remove("show");
  activeRatingBusinessId = "";
  selectedRatingValue = 0;
}
function closeRatingOnBackdrop(event) {
  if (event.target.id === "businessRatingModal") closeBusinessRating();
}
function selectBusinessRating(value) {
  selectedRatingValue = Math.max(1, Math.min(5, Number(value) || 0));
  updateRatingInputStars();
}
function updateRatingInputStars() {
  document.querySelectorAll("#ratingInputStars button").forEach((button) => {
    button.classList.toggle(
      "selected",
      Number(button.dataset.rating) <= selectedRatingValue,
    );
  });
}
function refreshRatingModal() {
  const business = businesses.find(
    (item) => item.id === activeRatingBusinessId,
  );
  if (!business) return;
  document.getElementById("ratingModalSummary").innerHTML =
    ratingSummaryHtml(business);
  updateRatingInputStars();
  const reviews = [...businessReviews(business)].sort(
    (a, b) => (b.created || 0) - (a.created || 0),
  );
  document.getElementById("ratingReviewList").innerHTML = reviews.length
    ? reviews
        .slice(0, 20)
        .map(
          (review) => `
    <article class="customer-review">
      <div class="customer-review-head">
        <div><strong>${escapeHtml(review.name || "GRAVITY58 User")}</strong><small>${new Date(review.created || Date.now()).toLocaleDateString("en-IN")}</small></div>
        ${ratingStars(review.rating)}
      </div>
      ${review.comment ? `<p>${escapeHtml(review.comment)}</p>` : ""}
    </article>`,
        )
        .join("")
    : '<div class="empty rating-empty">No reviews yet. Be the first customer to rate this business.</div>';
}
function submitBusinessRating() {
  const business = businesses.find(
    (item) => item.id === activeRatingBusinessId,
  );
  const status = document.getElementById("ratingFormStatus");
  if (!business) return;
  const name = safeReviewerName(document.getElementById("ratingName").value);
  const comment = sanitiseReviewText(
    document.getElementById("ratingComment").value,
  );
  if (!selectedRatingValue) {
    status.className = "moderation-status error";
    status.textContent = "Please select between 1 and 5 stars.";
    return;
  }
  if (name.length < 2) {
    status.className = "moderation-status error";
    status.textContent = "Please enter your name.";
    return;
  }
  const prohibited = /(https?:\/\/|www\.|@\w+|[\r\n]{3,})/i;
  if (prohibited.test(comment)) {
    status.className = "moderation-status error";
    status.textContent =
      "Links and promotional contact details are not allowed in reviews.";
    return;
  }
  business.reviews = businessReviews(business);
  const raterId = anonymousRaterId();
  const existing = business.reviews.find((r) => r.raterId === raterId);
  if (existing) {
    existing.rating = selectedRatingValue;
    existing.name = name;
    existing.comment = comment;
    existing.updated = Date.now();
  } else {
    business.reviews.push({
      id: "review-" + Date.now().toString(36),
      raterId,
      name,
      rating: selectedRatingValue,
      comment,
      created: Date.now(),
    });
  }
  localStorage.setItem("g58ReviewerName", name);
  saveData();
  status.className = "moderation-status success";
  status.textContent = existing
    ? "Your rating was updated."
    : "Thank you. Your rating was submitted.";
  document.getElementById("deleteMyRatingBtn").classList.remove("hidden");
  refreshRatingModal();
  renderWall();
}
function deleteMyBusinessRating() {
  const business = businesses.find(
    (item) => item.id === activeRatingBusinessId,
  );
  if (!business) return;
  const raterId = anonymousRaterId();
  const before = businessReviews(business).length;
  business.reviews = businessReviews(business).filter(
    (r) => r.raterId !== raterId,
  );
  if (business.reviews.length === before) return;
  saveData();
  selectedRatingValue = 0;
  document.getElementById("ratingName").value =
    localStorage.getItem("g58ReviewerName") || "";
  document.getElementById("ratingComment").value = "";
  document.getElementById("deleteMyRatingBtn").classList.add("hidden");
  document.getElementById("ratingFormStatus").className =
    "moderation-status success";
  document.getElementById("ratingFormStatus").textContent =
    "Your rating was deleted.";
  refreshRatingModal();
  renderWall();
}

function businessCard(b) {
  const initials = escapeHtml(
    (b.title || "G58")
      .split(/\s+/)
      .slice(0, 2)
      .map((x) => x[0] || "")
      .join("")
      .toUpperCase(),
  );
  return `<article class="business-card" data-post-id="${b.id}">
    <div class="business-card-top">
      <div class="business-avatar">${initials}</div>
      <div class="business-identity"><h3>${escapeHtml(b.title)}</h3><span>${escapeHtml(b.category)}</span></div>
      <div class="verified-dot">● Available</div>
    </div>
    <div class="business-rating-bar">
      <button type="button" onclick="openBusinessRating('${b.id}')" aria-label="View or add customer rating">${ratingSummaryHtml(b)}<span class="rate-now-label">Rate business</span></button>
    </div>
    <div class="business-card-body">
      <p>${escapeHtml(b.description)}</p>
      <div class="business-card-actions" style="margin-bottom:14px">
        <button class="btn orange" onclick="callBusinessPhone('${b.id}')">Call Now</button>
        <button class="btn" onclick="openBusinessDemo('${b.id}')">Visit Website / Profile</button>
      </div>
      <div class="business-details">
        <span>📍 ${escapeHtml(b.area)}, ${escapeHtml(itemDistrict(b))}</span>
        <span>💰 From ${formatMoney(b.price)}</span>
        <span class="copyable-number" onclick="callBusinessPhone('${b.id}')" title="Click to call">📞 ${escapeHtml(b.phone || "Not added")}</span>
        <span>☎ ${escapeHtml(b.altPhone || "No alternative")}</span>
        <span>⭐ ${b.experience || 0} Years</span>
        <span>✅ ${b.projects || 0}+ Projects</span>
      </div>
      <div class="business-card-actions">
        <button class="btn rating-btn" onclick="openBusinessRating('${b.id}')">★ Ratings</button>
        <button class="btn" onclick="openBusinessQr('${b.id}')">QR Code</button>
        <button class="btn share-btn" onclick="copyBusinessLink('${b.id}',this)">Copy Link</button>
        <button class="btn green" onclick="shareBusinessOnWhatsApp('${b.id}')">Share WhatsApp</button>
      </div>
      <div class="share-status" id="share-${b.id}"></div>
      <div class="business-owner-box">
        <label class="unlock-check-row"><input type="checkbox" onchange="requestCardUnlock('business','${b.id}',this)"><span>Unlock</span></label>
        <div class="business-owner-actions hidden" id="business-owner-actions-${b.id}">
          <button class="btn green" type="button" onclick="openBusinessEdit('${b.id}')">Edit Card</button>
          <button class="btn danger" type="button" onclick="deleteOwnedBusiness('${b.id}')">Delete Card</button>
        </div>
      </div>
    </div>
  </article>`;
}

let qrOpenedFromBusinessPopup = false;

function openBusinessQr(id) {
  const business = businesses.find((item) => item.id === id);
  if (!business) return;

  const floatingWrap = document.getElementById("floatingBusinessWrap");
  qrOpenedFromBusinessPopup = Boolean(floatingWrap?.classList.contains("show"));
  if (qrOpenedFromBusinessPopup) floatingWrap.classList.add("qr-behind-hidden");

  const link = businessShareUrl(id);
  document.getElementById("businessQrTitle").textContent =
    business.title + " QR Code";
  document.getElementById("businessQrLink").value = link;
  document.getElementById("businessQrImage").src =
    "https://api.qrserver.com/v1/create-qr-code/?size=280x280&data=" +
    encodeURIComponent(link);
  document.getElementById("businessQrModal").classList.add("show");
  document.body.classList.add("qr-modal-open");
}
function closeBusinessQr() {
  document.getElementById("businessQrModal")?.classList.remove("show");
  document.body.classList.remove("qr-modal-open");
  const floatingWrap = document.getElementById("floatingBusinessWrap");
  if (qrOpenedFromBusinessPopup && floatingWrap) {
    floatingWrap.classList.remove("qr-behind-hidden");
    floatingWrap.classList.add("show");
  }
  qrOpenedFromBusinessPopup = false;
}
function closeBusinessQrOnBackdrop(event) {
  if (event.target.id === "businessQrModal") closeBusinessQr();
}
function openBusinessQrLink() {
  const link = document.getElementById("businessQrLink")?.value || "";
  if (!link) return;
  closeBusinessQr();
  window.open(link, "_blank", "noopener");
}
async function copyBusinessQrLink() {
  const link = document.getElementById("businessQrLink")?.value || "";
  if (!link) return;
  try {
    await navigator.clipboard.writeText(link);
    alert("Business-card link copied.");
  } catch (error) {
    const input = document.getElementById("businessQrLink");
    input?.select();
    document.execCommand("copy");
    alert("Business-card link copied.");
  }
}
function toggleNationalBusinessFilter() {
  showNationalBusinessesOnly = Boolean(
    document.getElementById("nationalBusinessOnly")?.checked,
  );
  renderWall();
}

function businessShareUrl(id) {
  const business = businesses.find((item) => item.id === id);
  return business
    ? businessSeoUrl(business)
    : `${window.location.origin}/business/${encodeURIComponent(id)}/`;
}
async function copyBusinessLink(id, button) {
  const link = businessShareUrl(id);
  try {
    await navigator.clipboard.writeText(link);
    button.textContent = "Copied";
    document.getElementById("share-" + id).textContent =
      "Shareable business-card link copied.";
    setTimeout(() => (button.textContent = "Copy Link"), 1800);
  } catch {
    prompt("Copy this business-card link:", link);
  }
}
function customerShareUrl(id) {
  const customer = customers.find((item) => item.id === id);
  return customer
    ? jobSeoUrl(customer)
    : `${window.location.origin}/jobs/${encodeURIComponent(id)}/`;
}
async function copyCustomerLink(id, button) {
  const link = customerShareUrl(id);
  try {
    await navigator.clipboard.writeText(link);
    button.textContent = "Copied";
    const s = document.getElementById("customer-share-" + id);
    if (s) s.textContent = "Shareable requirement link copied.";
    setTimeout(() => (button.textContent = "Copy Link"), 1800);
  } catch {
    prompt("Copy this requirement link:", link);
  }
}
function shareCustomerOnWhatsApp(id) {
  const c = customers.find((x) => x.id === id);
  if (!c) return;
  const text = `Check this requirement on GRAVITY58: ${c.title}\n${customerShareUrl(id)}`;
  window.open(
    `https://wa.me/?text=${encodeURIComponent(text)}`,
    "_blank",
    "noopener",
  );
}
function shareBusinessOnWhatsApp(id) {
  const b = businesses.find((x) => x.id === id);
  if (!b) return;
  const link = businessShareUrl(id);
  const text = `${b.title} — GRAVITY58 Digital Business Card

Open this link to view the dedicated business card:
${link}

Save this WhatsApp message or link for permanent access to this digital business card.`;
  window.open(
    `https://wa.me/?text=${encodeURIComponent(text)}`,
    "_blank",
    "noopener",
  );
}
function publishedShareUrl() {
  return lastPublishedPostType === "customer"
    ? customerShareUrl(lastPublishedPostId)
    : businessShareUrl(lastPublishedPostId);
}
async function copyPublishedLink(button) {
  const link = publishedShareUrl();
  try {
    await navigator.clipboard.writeText(link);
    button.textContent = "Copied";
    setTimeout(() => (button.textContent = "Copy Link"), 1800);
  } catch {
    prompt("Copy this post link:", link);
  }
}
function sharePublishedOnWhatsApp() {
  const item =
    lastPublishedPostType === "customer"
      ? customers.find((x) => x.id === lastPublishedPostId)
      : businesses.find((x) => x.id === lastPublishedPostId);
  if (!item) return;

  if (lastPublishedPostType === "business") {
    const text = `${item.title} — GRAVITY58 Digital Business Card

Open this link to view the dedicated business card:
${publishedShareUrl()}

Save this WhatsApp message or link for permanent access to this digital business card.`;
    window.open(
      `https://wa.me/?text=${encodeURIComponent(text)}`,
      "_blank",
      "noopener",
    );
    return;
  }

  window.open(
    `https://wa.me/?text=${encodeURIComponent(`Check my requirement on GRAVITY58: ${item.title}\n${publishedShareUrl()}`)}`,
    "_blank",
    "noopener",
  );
}

function unlockBusinessCard(id, isFloating = false, providedPhone = "") {
  const business = businesses.find((item) => item.id === id);
  if (!business) return;

  const inputId = isFloating
    ? `business-unlock-floating-${id}`
    : `business-unlock-${id}`;
  const actionsId = isFloating
    ? `business-owner-actions-floating-${id}`
    : `business-owner-actions-${id}`;
  const entered = cleanNumber(
    providedPhone || document.getElementById(inputId)?.value || "",
  );
  const validNumbers = [business.phone, business.whatsapp, business.altPhone]
    .map(cleanNumber)
    .filter(Boolean);

  if (!entered || !validNumbers.includes(entered)) {
    alert("Phone number does not match this business card.");
    return;
  }

  sessionStorage.setItem(`g58BusinessOwner_${id}`, "true");
  document.getElementById(actionsId)?.classList.remove("hidden");

  // Reveal owner controls on both normal and floating copies when available.
  document
    .getElementById(`business-owner-actions-${id}`)
    ?.classList.remove("hidden");
  document
    .getElementById(`business-owner-actions-floating-${id}`)
    ?.classList.remove("hidden");
  return true;
}
function requireBusinessOwner(id) {
  if (sessionStorage.getItem(`g58BusinessOwner_${id}`) === "true") return true;
  alert(
    "Unlock this business card using the owner phone or WhatsApp number first.",
  );
  return false;
}
function openBusinessEdit(id) {
  if (!requireBusinessOwner(id)) return;
  const business = businesses.find((item) => item.id === id);
  if (!business) return;

  document.getElementById("editBusinessId").value = business.id;
  document.getElementById("editBusinessTitle").value = business.title || "";
  document.getElementById("editBusinessCategory").value =
    business.category || "";
  document.getElementById("editBusinessDescription").value =
    business.description || "";
  document.getElementById("editBusinessState").value =
    business.state || itemState(business) || "";
  document.getElementById("editBusinessDistrict").value =
    business.district || itemDistrict(business) || "";
  document.getElementById("editBusinessArea").value = business.area || "";
  document.getElementById("editBusinessAddress").value =
    business.fullAddress || "";
  document.getElementById("editBusinessPrice").value = business.price || "";
  document.getElementById("editBusinessExperience").value =
    business.experience || 0;
  document.getElementById("editBusinessProjects").value =
    business.projects || 0;
  document.getElementById("editBusinessName").value = business.name || "";
  document.getElementById("editBusinessWhatsapp").value =
    business.whatsapp || "";
  document.getElementById("editBusinessPhone").value = business.phone || "";
  document.getElementById("editBusinessAltPhone").value =
    business.altPhone || "";
  document.getElementById("editBusinessEmail").value = business.email || "";
  document.getElementById("editBusinessSocial").value =
    business.socialUrl || "";
  const editNational = document.getElementById("editBusinessNational");
  if (editNational) editNational.checked = business.isNational === true;
  const status = document.getElementById("editBusinessStatus");
  if (status) {
    status.style.display = "none";
    status.textContent = "";
  }
  document.getElementById("businessEditModal").classList.add("show");
}
function saveBusinessEdit() {
  const id = document.getElementById("editBusinessId").value;
  if (!requireBusinessOwner(id)) return;
  const business = businesses.find((item) => item.id === id);
  if (!business) return;

  const status = document.getElementById("editBusinessStatus");
  const values = {
    title: document.getElementById("editBusinessTitle").value.trim(),
    category: document.getElementById("editBusinessCategory").value,
    description: document
      .getElementById("editBusinessDescription")
      .value.trim(),
    state: document.getElementById("editBusinessState").value.trim(),
    district: document.getElementById("editBusinessDistrict").value.trim(),
    area: document.getElementById("editBusinessArea").value.trim(),
    fullAddress: document.getElementById("editBusinessAddress").value.trim(),
    price: Number(document.getElementById("editBusinessPrice").value),
    experience:
      Number(document.getElementById("editBusinessExperience").value) || 0,
    projects:
      Number(document.getElementById("editBusinessProjects").value) || 0,
    name: document.getElementById("editBusinessName").value.trim(),
    whatsapp: document.getElementById("editBusinessWhatsapp").value.trim(),
    phone: document.getElementById("editBusinessPhone").value.trim(),
    altPhone: document.getElementById("editBusinessAltPhone").value.trim(),
    email: document.getElementById("editBusinessEmail").value.trim(),
    socialUrl: document.getElementById("editBusinessSocial").value.trim(),
    isNational: Boolean(
      document.getElementById("editBusinessNational")?.checked,
    ),
  };

  const missing = [];
  [
    "title",
    "category",
    "description",
    "state",
    "district",
    "area",
    "fullAddress",
    "name",
    "whatsapp",
    "phone",
  ].forEach((key) => {
    if (!values[key]) missing.push(key);
  });
  if (!values.price || values.price <= 0) missing.push("price");

  if (missing.length) {
    status.style.display = "block";
    status.className = "moderation-status notice error";
    status.textContent = "Please complete: " + missing.join(", ") + ".";
    return;
  }
  if (
    cleanNumber(values.phone).length < 10 ||
    cleanNumber(values.whatsapp).length < 10
  ) {
    status.style.display = "block";
    status.className = "moderation-status notice error";
    status.textContent = "Enter valid phone and WhatsApp numbers.";
    return;
  }
  if (values.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.email)) {
    status.style.display = "block";
    status.className = "moderation-status notice error";
    status.textContent = "Enter a valid email address.";
    return;
  }

  Object.assign(business, values, {
    city: values.district,
    updatedAt: Date.now(),
  });
  saveData();
  selectedState = values.state;
  localStorage.setItem("g58SelectedState", selectedState);
  updateStateUI();
  renderRecentJobs();
  renderWall();
  closeModal("businessEditModal");
  hideFloatingBusiness();
  alert("Business card updated successfully.");
}
function deleteOwnedBusiness(id) {
  if (!requireBusinessOwner(id)) return;
  const business = businesses.find((item) => item.id === id);
  if (!business) return;

  const confirmation = prompt(
    `Type DELETE to permanently remove "${business.title}".`,
  );
  if (confirmation !== "DELETE") {
    if (confirmation !== null) alert("Business card was not deleted.");
    return;
  }

  businesses = businesses.filter((item) => item.id !== id);
  sessionStorage.removeItem(`g58BusinessOwner_${id}`);
  saveData();
  hideFloatingBusiness();
  renderWall();
  renderRecentJobs();

  try {
    const params = new URLSearchParams(window.location.search);
    if (params.get("business") === id) {
      window.history.replaceState(
        {},
        "",
        window.location.origin + window.location.pathname,
      );
    }
  } catch (error) {
    console.warn("Could not clean deleted business link:", error);
  }

  alert("Business card deleted permanently.");
}

function floatingBusinessMarkup(b) {
  const initials = escapeHtml(
    (b.title || "G58")
      .split(/\s+/)
      .slice(0, 2)
      .map((x) => x[0] || "")
      .join("")
      .toUpperCase(),
  );
  return `<article class="business-card floating-card">
    <div class="business-card-top"><div class="business-avatar">${initials}</div><div class="business-identity"><h3>${escapeHtml(b.title)}</h3><span>${escapeHtml(b.category)}</span></div><div class="verified-dot">● Available</div></div>
    <div class="business-card-body"><p>${escapeHtml(b.description)}</p>
      <div class="business-card-actions" style="margin-bottom:14px"><button class="btn orange" onclick="callBusinessPhone('${b.id}')">Call Now</button><button class="btn" onclick="openBusinessDemo('${b.id}')">Visit Website / Profile</button></div>
      <div class="business-details"><span>📍 ${escapeHtml(b.area)}, ${escapeHtml(itemDistrict(b))}</span><span>💰 From ${formatMoney(b.price)}</span><span class="copyable-number" onclick="callBusinessPhone('${b.id}')" title="Click to call">📞 ${escapeHtml(b.phone || "Not added")}</span><span>☎ ${escapeHtml(b.altPhone || "No alternative")}</span><span>⭐ ${b.experience || 0} Years</span><span>✅ ${b.projects || 0}+ Projects</span></div>
      <div class="business-card-actions"><button class="btn" onclick="openBusinessQr('${b.id}')">QR Code</button><button class="btn share-btn" onclick="copyBusinessLink('${b.id}',this)">Copy Link</button><button class="btn green" onclick="shareBusinessOnWhatsApp('${b.id}')">Share WhatsApp</button></div>
      <div class="business-owner-box">
        <div class="business-owner-title">🔒 Business Owner Access</div>
        <input id="business-unlock-floating-${b.id}" type="tel" placeholder="Enter business phone or WhatsApp number">
        <button class="btn orange" type="button" style="width:100%" onclick="unlockBusinessCard('${b.id}',true)">Unlock Card</button>
        <div class="business-owner-actions hidden" id="business-owner-actions-floating-${b.id}">
          <button class="btn green" type="button" onclick="openBusinessEdit('${b.id}')">Edit Card</button>
          <button class="btn danger" type="button" onclick="deleteOwnedBusiness('${b.id}')">Delete Card</button>
        </div>
      </div>
    </div></article>`;
}
function showFloatingBusiness(id) {
  const b = businesses.find((x) => x.id === id);
  if (!b) return;
  document.getElementById("floatingBusinessCard").innerHTML =
    floatingBusinessMarkup(b);
  document.getElementById("floatingBusinessWrap").classList.add("show");
}
function hideFloatingBusiness() {
  document.getElementById("floatingBusinessWrap").classList.remove("show");
}
function closeFloatingBusiness(e) {
  if (e.target.id === "floatingBusinessWrap") hideFloatingBusiness();
}
function floatingCustomerMarkup(c) {
  return `<div class="floating-customer-card">${customerCard(c)}</div>`;
}
function showFloatingCustomer(id) {
  const c = customers.find((x) => x.id === id);
  if (!c) {
    document.getElementById("floatingCustomerCard").innerHTML =
      '<div class="notice error">This customer requirement is no longer available. It may have expired, been accepted, or removed.</div>';
    document.getElementById("floatingCustomerWrap").classList.add("show");
    return;
  }
  document.getElementById("floatingCustomerCard").innerHTML =
    floatingCustomerMarkup(c);
  document.getElementById("floatingCustomerWrap").classList.add("show");
}
function hideFloatingCustomer() {
  document.getElementById("floatingCustomerWrap").classList.remove("show");
}
function closeFloatingCustomer(e) {
  if (e.target.id === "floatingCustomerWrap") hideFloatingCustomer();
}

function seoSlug(value) {
  return String(value || "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}
function setSeoMeta({
  title,
  description,
  url,
  image,
  type = "website",
  schema,
}) {
  document.title = title;
  const setMeta = (selector, attribute, value) => {
    let element = document.querySelector(selector);
    if (!element) {
      element = document.createElement(
        attribute === "property" ? "meta" : "meta",
      );
      const key = selector.match(/\[(?:name|property)="([^"]+)"\]/)?.[1];
      if (selector.includes("property=")) element.setAttribute("property", key);
      else element.setAttribute("name", key);
      document.head.appendChild(element);
    }
    element.setAttribute("content", value);
  };
  const canonical =
    document.querySelector('link[rel="canonical"]') ||
    document.head.appendChild(
      Object.assign(document.createElement("link"), { rel: "canonical" }),
    );
  canonical.href = url;
  setMeta('meta[name="description"]', "name", description);
  setMeta('meta[property="og:title"]', "property", title);
  setMeta('meta[property="og:description"]', "property", description);
  setMeta('meta[property="og:url"]', "property", url);
  setMeta('meta[property="og:type"]', "property", type);
  setMeta(
    'meta[property="og:image"]',
    "property",
    image || "https://g58.in/assets/og-gravity58.svg",
  );
  setMeta('meta[name="twitter:title"]', "name", title);
  setMeta('meta[name="twitter:description"]', "name", description);
  setMeta(
    'meta[name="twitter:image"]',
    "name",
    image || "https://g58.in/assets/og-gravity58.svg",
  );
  if (schema) {
    let structured = document.getElementById("dynamicStructuredData");
    if (!structured) {
      structured = document.createElement("script");
      structured.id = "dynamicStructuredData";
      structured.type = "application/ld+json";
      document.head.appendChild(structured);
    }
    structured.textContent = JSON.stringify(schema);
  }
}
function businessSeoUrl(b) {
  return `${window.location.origin}/business/${seoSlug(b.title)}-${seoSlug(b.area)}-${seoSlug(itemDistrict(b))}/`;
}
function jobSeoUrl(c) {
  return `${window.location.origin}/jobs/${seoSlug(c.title)}-${seoSlug(c.area)}-${seoSlug(itemDistrict(c))}/`;
}
function applyBusinessSeo(b) {
  const url = businessSeoUrl(b);
  const description = `${b.title} provides ${b.category} services in ${b.area}, ${itemDistrict(b)}, ${itemState(b)}. View contact details and digital business card on GRAVITY58.`;
  setSeoMeta({
    title: `${b.title} | ${b.category} in ${b.area}, ${itemDistrict(b)} | GRAVITY58`,
    description,
    url,
    image: b.image,
    type: "business.business",
    schema: {
      "@context": "https://schema.org",
      "@type": "LocalBusiness",
      name: b.title,
      description: b.description,
      image: b.image,
      telephone: b.phone || b.whatsapp || "",
      url,
      address: {
        "@type": "PostalAddress",
        streetAddress: b.fullAddress || b.area || "",
        addressLocality: b.area || "",
        addressRegion: b.state || "",
        addressCountry: "IN",
      },
      areaServed: [b.district, b.state].filter(Boolean),
    },
  });
}
function applyJobSeo(c) {
  const url = jobSeoUrl(c);
  const description = `${c.title} in ${c.area}, ${itemDistrict(c)}, ${itemState(c)}. Local businesses can view the requirement and submit a bid on GRAVITY58.`;
  setSeoMeta({
    title: `${c.title} in ${c.area}, ${itemDistrict(c)} | GRAVITY58 Jobs`,
    description,
    url,
    image: c.image,
    type: "article",
    schema: {
      "@context": "https://schema.org",
      "@type": "Service",
      name: c.title,
      description: c.description,
      areaServed: {
        "@type": "AdministrativeArea",
        name: `${c.area}, ${itemDistrict(c)}, ${itemState(c)}`,
      },
      provider: {
        "@type": "Organization",
        name: "GRAVITY58",
        url: "https://g58.in/",
      },
    },
  });
}
function matchSeoRoute() {
  const path =
    decodeURIComponent(window.location.pathname).replace(/\/+$/, "") || "/";

  if (path === "/business") {
    setSeoMeta({
      title: "Browse Local Business Cards Across India | GRAVITY58",
      description:
        "Discover local business cards by State, District, category and area on GRAVITY58.",
      url: window.location.origin + "/business/",
      schema: {
        "@context": "https://schema.org",
        "@type": "CollectionPage",
        name: "GRAVITY58 Business Wall",
        url: window.location.origin + "/business/",
      },
    });
    setTimeout(() => selectMode("business"), 120);
    return true;
  }

  if (path === "/jobs") {
    setSeoMeta({
      title: "Browse Local Customer Jobs and Requirements | GRAVITY58",
      description:
        "Browse customer service requirements and submit local business bids on GRAVITY58.",
      url: window.location.origin + "/jobs/",
      schema: {
        "@context": "https://schema.org",
        "@type": "CollectionPage",
        name: "GRAVITY58 Customer Jobs",
        url: window.location.origin + "/jobs/",
      },
    });
    setTimeout(() => selectMode("customer"), 120);
    return true;
  }

  const businessMatch = path.match(/^\/business\/([^/]+)$/);
  if (businessMatch) {
    const slug = businessMatch[1];
    const business = businesses.find((item) => {
      const full = `${seoSlug(item.title)}-${seoSlug(item.area)}-${seoSlug(itemDistrict(item))}`;
      return (
        full === slug ||
        seoSlug(item.title) === slug ||
        item.id.toLowerCase() === slug.toLowerCase()
      );
    });
    if (business) {
      applyBusinessSeo(business);
      setTimeout(() => {
        selectMode("business");
        showFloatingBusiness(business.id);
      }, 180);
      return true;
    }
  }

  const jobMatch = path.match(/^\/jobs\/([^/]+)$/);
  if (jobMatch) {
    const slug = jobMatch[1];
    const job = customers.find((item) => {
      const full = `${seoSlug(item.title)}-${seoSlug(item.area)}-${seoSlug(itemDistrict(item))}`;
      return (
        full === slug ||
        seoSlug(item.title) === slug ||
        item.id.toLowerCase() === slug.toLowerCase()
      );
    });
    if (job) {
      applyJobSeo(job);
      setTimeout(() => {
        selectMode("customer");
        showFloatingCustomer(job.id);
      }, 180);
      return true;
    }
  }

  const locationMatch = path.match(/^\/business\/([^/]+)\/([^/]+)$/);
  if (locationMatch) {
    const stateSlug = locationMatch[1],
      districtSlug = locationMatch[2];
    const state =
      INDIA_STATES.find((s) => seoSlug(s) === stateSlug) ||
      stateSlug.replace(/-/g, " ");
    const available = [
      ...new Set(
        businesses
          .filter((b) => seoSlug(itemState(b)) === stateSlug)
          .map(itemDistrict),
      ),
    ];
    const district =
      available.find((d) => seoSlug(d) === districtSlug) ||
      districtSlug.replace(/-/g, " ");
    selectedState = state;
    selectedDistrict = district;
    localStorage.setItem("g58SelectedState", state);
    localStorage.setItem("g58SelectedDistrict", district);
    setSeoMeta({
      title: `Businesses in ${district}, ${state} | GRAVITY58`,
      description: `Find local businesses, contact details and digital business cards in ${district}, ${state}.`,
      url: window.location.origin + path + "/",
      schema: {
        "@context": "https://schema.org",
        "@type": "CollectionPage",
        name: `Businesses in ${district}, ${state}`,
        url: window.location.origin + path + "/",
      },
    });
    setTimeout(() => {
      updateStateUI();
      selectMode("business");
    }, 160);
    return true;
  }

  const categoryMatch = path.match(/^\/category\/([^/]+)$/);
  if (categoryMatch) {
    const categorySlug = categoryMatch[1];
    const category =
      Object.keys(categoryImages).find((c) => seoSlug(c) === categorySlug) ||
      categorySlug.replace(/-/g, " ");
    setSeoMeta({
      title: `${category} Services Near You | GRAVITY58`,
      description: `Find ${category} businesses and customer requirements by State and District on GRAVITY58.`,
      url: window.location.origin + path + "/",
      schema: {
        "@context": "https://schema.org",
        "@type": "CollectionPage",
        name: `${category} Services`,
        url: window.location.origin + path + "/",
      },
    });
    setTimeout(() => {
      selectMode("business");
      const filter = document.getElementById("categoryFilter");
      if (filter) {
        const option = [...filter.options].find(
          (o) => seoSlug(o.value) === categorySlug,
        );
        if (option) filter.value = option.value;
      }
      renderWall();
    }, 170);
    return true;
  }
  return false;
}

function checkDeepLinks() {
  const params = new URLSearchParams(window.location.search);
  if (params.get("view") === "customer")
    setTimeout(() => selectMode("customer"), 220);
  if (params.get("view") === "business")
    setTimeout(() => selectMode("business"), 220);
  const businessId = params.get("business");
  const postId = params.get("post");
  if (businessId)
    setTimeout(() => {
      selectMode("business");
      showFloatingBusiness(businessId);
    }, 250);
  if (postId)
    setTimeout(() => {
      selectMode("customer");
      showFloatingCustomer(postId);
    }, 350);
  if (params.get("admin") === "1") setTimeout(openAdminLogin, 250);
}
document.addEventListener("keydown", (e) => {
  if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === "a") {
    e.preventDefault();
    openAdminLogin();
  }
});

function unlockCustomerCard(id, providedPhone = "") {
  const c = customers.find((x) => x.id === id);
  if (!c) return false;
  const input = document.getElementById("unlock-" + id);
  const entered = cleanNumber(providedPhone || input?.value || "");

  if (entered === cleanNumber(c.phone) || entered === cleanNumber(c.whatsapp)) {
    sessionStorage.setItem(`g58OwnerUnlocked_${id}`, "true");
    renderWall();
    return true;
  }
  alert("Phone number does not match this customer post.");
  return false;
}
function openBrowseGuide() {
  const customer = activeMode === "customer";
  document
    .getElementById("jobsBrowseGuide")
    .classList.toggle("active", customer);
  document
    .getElementById("businessBrowseGuide")
    .classList.toggle("active", !customer);
  document.getElementById("guidePopupKicker").textContent = customer
    ? "Customer Guide"
    : "Business Owner Guide";
  document.getElementById("guidePopupTitle").textContent = customer
    ? "How Browse Jobs Works"
    : "How Browse Business Works";
  document.getElementById("browseGuideModal").classList.add("show");
}
function showPublishSuccess(type, id) {
  lastPublishedPostId = id;
  lastPublishedPostType = type;
  document.getElementById("publishSuccessTitle").textContent =
    type === "customer"
      ? "Thanks! Your requirement is live now."
      : "Thanks! Your business ad is live now.";
  document.getElementById("publishSuccessText").textContent =
    type === "customer"
      ? "Nearby business owners can now view your requirement and submit up to five bids."
      : "Nearby customers can now discover your business card on the Business Wall.";
  document.getElementById("publishSuccessId").textContent = "Post ID: " + id;
  closeModal("createModal");
  document.getElementById("publishSuccessModal").classList.add("show");
}
function closePublishSuccess() {
  closeModal("publishSuccessModal");
  showLanding();
}
function viewPublishedPost() {
  closeModal("publishSuccessModal");
  selectMode(lastPublishedPostType);
  setTimeout(() => {
    const card = document.querySelector(
      `[data-post-id="${lastPublishedPostId}"]`,
    );
    if (card) {
      card.scrollIntoView({ behavior: "smooth", block: "center" });
      card.classList.add("published-highlight");
      setTimeout(() => card.classList.remove("published-highlight"), 2600);
    }
  }, 180);
}

function openCustomerPostCreator() {
  selectMode("customer");
  openCreateModal();
  const type = document.getElementById("postType");
  if (type) type.value = "customer";
  updateFormType();
}
function openBusinessCardCreator() {
  selectMode("business");
  openCreateModal();
  const type = document.getElementById("postType");
  if (type) type.value = "business";
  updateFormType();
}

function openCreateModal() {
  if (!window.G58SiteUser) {
    window.G58RequestAuth?.(activeMode);
    return;
  }
  if (!selectedState) {
    openStateSelection(true);
    return;
  }
  document.getElementById("createModal").classList.add("show");
  document.getElementById("postType").value = activeMode;
  updateFormType();
  const state = document.getElementById("postState");
  if (state) state.value = selectedState;
  const district = document.getElementById("postDistrict");
  if (district && !district.value && selectedDistrict)
    district.value = selectedDistrict;
  const national = document.getElementById("postNationalBusiness");
  if (national) national.checked = false;
  const status = document.getElementById("moderationStatus");
  if (status) {
    status.style.display = "none";
    status.textContent = "";
  }
}
function updateFormType() {
  const b = document.getElementById("postType").value === "business";
  document.getElementById("titleLabel").textContent = b
    ? "Business Name"
    : "Requirement Title";
  document.getElementById("priceLabel").textContent = b
    ? "Starting Price"
    : "Expected Minimum Price";
  document.getElementById("nameLabel").textContent = b
    ? "Contact Person"
    : "Customer Name";
  document
    .querySelectorAll(".business-only")
    .forEach((e) => e.classList.toggle("hidden", !b));
  document
    .querySelectorAll(".customer-only")
    .forEach((e) => e.classList.toggle("hidden", b));
}
function readFile(f) {
  return new Promise((r, j) => {
    const x = new FileReader();
    x.onload = () => r(x.result);
    x.onerror = j;
    x.readAsDataURL(f);
  });
}
function validateAndPublish() {
  const type = document.getElementById("postType").value,
    title = document.getElementById("postTitle").value.trim(),
    category = document.getElementById("postCategory").value,
    description = document.getElementById("postDescription").value.trim(),
    state = document.getElementById("postState").value.trim(),
    district = document.getElementById("postDistrict").value.trim(),
    area = document.getElementById("postArea").value.trim(),
    fullAddress = document.getElementById("postFullAddress").value.trim(),
    price = Number(document.getElementById("postPrice").value),
    name = document.getElementById("postName").value.trim(),
    whatsapp = document.getElementById("postWhatsapp").value.trim(),
    email = document.getElementById("postEmail").value.trim(),
    phone = document.getElementById("postPhone").value.trim(),
    altPhone = document.getElementById("postAltPhone")?.value.trim() || "",
    socialUrl = document.getElementById("postSocialUrl")?.value.trim() || "",
    status = document.getElementById("moderationStatus");

  status.style.display = "block";
  const missing = [];
  if (!title) missing.push("title");
  if (!category) missing.push("category");
  if (!description) missing.push("description");
  if (!state) missing.push("state");
  if (!district) missing.push("district");
  if (!area) missing.push("area");
  if (!fullAddress) missing.push("full address");
  if (!price || price <= 0) missing.push("price");
  if (!name) missing.push("name");
  if (!whatsapp) missing.push("WhatsApp number");
  if (!phone) missing.push("phone number");
  if (missing.length) {
    status.className = "moderation-status notice error";
    status.textContent = "Please complete: " + missing.join(", ") + ".";
    return;
  }
  const bad = blockedTerms.find((t) =>
    normalize(`${title} ${description} ${name}`).includes(t),
  );
  if (bad) {
    status.className = "moderation-status notice error";
    status.textContent = "Post rejected due to prohibited content.";
    return;
  }
  const image = defaultImageByCategory(category, type);
  const id =
    (type === "customer" ? "C" : "B") +
    Math.floor(100000 + Math.random() * 900000);
  const isNational =
    type === "business" &&
    Boolean(document.getElementById("postNationalBusiness")?.checked);
  const base = {
    id,
    type,
    title,
    category,
    description,
    state,
    district,
    city: district,
    area,
    fullAddress,
    price,
    image,
    name,
    whatsapp,
    email,
    phone,
    altPhone,
    socialUrl,
    isNational,
    created: Date.now(),
    userId: window.G58SiteUser?.id || "",
    accountEmail: window.G58SiteUser?.email || email,
    accountPhone: window.G58SiteUser?.phone || phone,
    moderationStatus: "active",
  };
  if (type === "customer")
    customers.unshift({
      ...base,
      maxPrice: Number(document.getElementById("postMaxPrice").value) || price,
      status: "Open for Bids",
      expiresAt: Date.now() + 30 * DAY,
      bids: [],
    });
  else
    businesses.unshift({
      ...base,
      experience: Number(document.getElementById("postExperience").value) || 0,
      projects: Number(document.getElementById("postProjects").value) || 0,
    });
  saveData();
  selectedState = state;
  selectedDistrict = district;
  localStorage.setItem("g58SelectedState", selectedState);
  localStorage.setItem("g58SelectedDistrict", selectedDistrict);
  status.className = "moderation-status notice success";
  status.innerHTML = `Your post is live now.<br>Post ID: <strong>${id}</strong>`;
  activeMode = type;
  document
    .getElementById("contentArea")
    ?.classList.toggle("g58-mode-customer", activeMode === "customer");
  updateStateUI();
  renderRecentJobs();
  renderWall();
  showPublishSuccess(type, id);
}
function normalizeBidWhatsApp(value) {
  let digits = cleanNumber(value);
  if (digits.length === 10) digits = "91" + digits;
  return digits;
}
function isValidBidWhatsApp(value) {
  const digits = normalizeBidWhatsApp(value);
  return digits.length >= 11 && digits.length <= 15 && !/^0+$/.test(digits);
}
function resetBidForm() {
  ["bidBusiness", "bidAmount", "bidTime", "bidWhatsapp", "bidProposal"].forEach(
    (id) => {
      const el = document.getElementById(id);
      if (el) el.value = "";
    },
  );
}
function openBidModal(id) {
  const p = customers.find((c) => c.id === id);
  if (!p) return;
  if ((p.bids || []).length >= 5) {
    alert("This post already received the maximum 5 active bids.");
    return;
  }

  hideFloatingCustomer();
  const floatingBusiness = document.getElementById("floatingBusinessWrap");
  if (floatingBusiness) floatingBusiness.classList.remove("show");

  resetBidForm();
  document.getElementById("bidPostId").value = id;
  const summaryTitle = document.getElementById("bidSummaryTitle");
  if (summaryTitle) summaryTitle.textContent = p.title;
  const summaryLoc = document.getElementById("bidSummaryLocation");
  if (summaryLoc) summaryLoc.textContent = `${p.area}, ${itemDistrict(p)}`;
  const summaryBudget = document.getElementById("bidSummaryBudget");
  if (summaryBudget)
    summaryBudget.textContent = `${formatMoney(p.price)} – ${formatMoney(p.maxPrice)}`;
  const summaryOffers = document.getElementById("bidSummaryOffers");
  if (summaryOffers) summaryOffers.textContent = `${(p.bids || []).length} / 5`;
  const submitBtn = document.getElementById("bidSubmitBtn");
  if (submitBtn) {
    submitBtn.disabled = false;
    submitBtn.textContent = "Submit Offer";
  }
  const proposalInput = document.getElementById("bidProposal");
  const proposalCount = document.getElementById("bidProposalCount");
  if (proposalInput && proposalCount) proposalCount.textContent = "0 / 400";
  document.getElementById("bidModal").classList.add("show");
  setTimeout(() => document.getElementById("bidBusiness")?.focus(), 100);
}
function handleSubmitBidClick() {
  const btn = document.getElementById("bidSubmitBtn");
  if (btn && btn.disabled) return;
  if (btn) {
    btn.disabled = true;
    btn.textContent = "Submitting Offer...";
  }
  submitBid();
  if (btn && document.getElementById("bidModal")?.classList.contains("show")) {
    btn.disabled = false;
    btn.textContent = "Submit Offer";
  }
}
function submitBid() {
  const p = customers.find(
    (c) => c.id === document.getElementById("bidPostId").value,
  );
  const business = document.getElementById("bidBusiness").value.trim();
  const amount = Number(document.getElementById("bidAmount").value);
  const time = document.getElementById("bidTime").value.trim();
  const whatsappInput = document.getElementById("bidWhatsapp").value.trim();
  const proposal = document.getElementById("bidProposal").value.trim();

  if (
    !p ||
    !business ||
    !amount ||
    amount <= 0 ||
    !time ||
    !whatsappInput ||
    !proposal
  ) {
    alert("Complete all bid details before submitting.");
    return;
  }
  if (!isValidBidWhatsApp(whatsappInput)) {
    alert(
      "Enter a valid active WhatsApp number with country code, for example +91 98765 43210.",
    );
    document.getElementById("bidWhatsapp").focus();
    return;
  }
  if ((p.bids || []).length >= 5) {
    closeModal("bidModal");
    alert("Bidding is locked because 5 active bids were already received.");
    renderWall();
    return;
  }

  const whatsapp = normalizeBidWhatsApp(whatsappInput);
  const mobileKey = cleanNumber(whatsapp);

  p.bids = p.bids || [];
  p.bidHistory = Array.isArray(p.bidHistory) ? p.bidHistory : [];

  // Migrate existing bids into permanent per-post mobile history.
  p.bids.forEach((existing) => {
    const existingMobile = cleanNumber(existing.whatsapp);
    if (existingMobile && !p.bidHistory.includes(existingMobile))
      p.bidHistory.push(existingMobile);
  });

  if (p.bidHistory.includes(mobileKey)) {
    closeModal("bidModal");
    alert(
      "This mobile number has already used its one bid for this requirement. It cannot bid again on this same post, even if the earlier bid was deleted.",
    );
    return;
  }

  const bid = {
    id: "BID" + Date.now() + Math.floor(Math.random() * 1000),
    business,
    amount,
    time,
    whatsapp,
    proposal,
    created: Date.now(),
    locked: true,
  };

  p.bids.push(bid);
  p.bidHistory.push(mobileKey);
  saveData();
  closeModal("bidModal");
  renderWall();
  refreshRequirementDetailIfOpen(p.id);

  const count = p.bids.length;
  document.getElementById("bidSuccessCount").textContent =
    `This requirement now has ${count} of 5 active bids. Your mobile number cannot submit another bid on this post, but you can bid on other posts.`;
  const successAmount = document.getElementById("bidSuccessAmount");
  if (successAmount) successAmount.textContent = formatMoney(amount);
  const successTime = document.getElementById("bidSuccessTime");
  if (successTime) successTime.textContent = time;
  const successOffers = document.getElementById("bidSuccessOffers");
  if (successOffers) successOffers.textContent = `${count} / 5`;
  document.getElementById("bidSuccessModal").classList.add("show");
}

function deleteCustomerBid(postId, bidId) {
  const post = customers.find((item) => item.id === postId);
  if (!post) return;

  if (sessionStorage.getItem(`g58OwnerUnlocked_${postId}`) !== "true") {
    alert(
      "Unlock this customer post with the owner phone number before deleting bids.",
    );
    return;
  }

  post.bids = post.bids || [];
  const index = post.bids.findIndex(
    (bid, i) => String(bid.id || i) === String(bidId),
  );
  if (index < 0) {
    alert("This bid is no longer available.");
    return;
  }

  const bid = post.bids[index];
  if (
    !confirm(
      `Delete the bid from ${bid.business} for ${formatMoney(bid.amount)}? One bid slot will become available, but this mobile number cannot bid again on this post.`,
    )
  ) {
    return;
  }

  // The bid is removed only from active bids. bidHistory is intentionally retained.
  post.bids.splice(index, 1);
  saveData();
  renderWall();
  refreshRequirementDetailIfOpen(postId);
}

let pendingAccept = null;
function acceptBid(postId, bidIndex) {
  const c = customers.find((x) => x.id === postId);
  const b = c?.bids?.[bidIndex];
  if (!c || !b) return;

  if (sessionStorage.getItem(`g58OwnerUnlocked_${postId}`) !== "true") {
    alert(
      "Unlock this customer post with the owner phone number before accepting a bid.",
    );
    return;
  }

  pendingAccept = { postId, bidIndex };
  const nameEl = document.getElementById("acceptConfirmBusiness");
  const amountEl = document.getElementById("acceptConfirmAmount");
  const timeEl = document.getElementById("acceptConfirmTime");
  if (nameEl) nameEl.textContent = b.business;
  if (amountEl) amountEl.textContent = formatMoney(b.amount);
  if (timeEl) timeEl.textContent = b.time;
  document.getElementById("acceptConfirmModal")?.classList.add("show");
}
function closeAcceptConfirm() {
  document.getElementById("acceptConfirmModal")?.classList.remove("show");
  pendingAccept = null;
}
function confirmAcceptOffer() {
  if (!pendingAccept) return;
  const { postId, bidIndex } = pendingAccept;
  const c = customers.find((x) => x.id === postId);
  const b = c?.bids?.[bidIndex];
  if (!c || !b) {
    closeAcceptConfirm();
    return;
  }

  const message = `Hello ${b.business}, I accepted your GRAVITY58 bid for ${c.title}. Location: ${c.area}, ${itemDistrict(c)}. Bid: ${formatMoney(b.amount)}. Customer: ${c.name}. Phone: ${c.phone}. Email: ${c.email}.`;
  const waNumber = cleanNumber(b.whatsapp);
  const waUrl = `https://wa.me/${waNumber}?text=${encodeURIComponent(message)}`;

  document.getElementById("acceptConfirmModal")?.classList.remove("show");
  pendingAccept = null;
  closeRequirementDetail();

  const busEl = document.getElementById("acceptedBusiness");
  const amtEl = document.getElementById("acceptedAmount");
  const timeEl2 = document.getElementById("acceptedTime");
  const waLink = document.getElementById("acceptedWaLink");
  const callLink = document.getElementById("acceptedCallLink");
  if (busEl) busEl.textContent = b.business;
  if (amtEl) amtEl.textContent = formatMoney(b.amount);
  if (timeEl2) timeEl2.textContent = b.time;
  if (waLink) waLink.href = waUrl;
  if (callLink) callLink.href = "tel:" + waNumber;
  document.getElementById("acceptedAnimationModal")?.classList.add("show");

  customers = customers.filter((x) => x.id !== postId);
  sessionStorage.removeItem(`g58OwnerUnlocked_${postId}`);
  saveData();
  renderWall();
}
function closeAcceptedAnimation() {
  document.getElementById("acceptedAnimationModal")?.classList.remove("show");
}

function whatsappBusiness(id) {
  const b = businesses.find((x) => x.id === id);
  if (b)
    window.open(
      `https://wa.me/${cleanNumber(b.whatsapp)}?text=${encodeURIComponent("Hello " + b.title + ", I found your business on GRAVITY58.")}`,
      "_blank",
    );
}

const DIGIT58_TAGLINES = [
  "Turn your store digital.",
  "Let customers order online.",
  "Never miss a refill reminder.",
];
let digit58TaglineIndex = 0;
let digit58TaglineTimer = null;
function startDigit58TaglineRotation() {
  const el = document.getElementById("digit58Tagline");
  if (!el || digit58TaglineTimer) return;
  digit58TaglineTimer = setInterval(() => {
    digit58TaglineIndex = (digit58TaglineIndex + 1) % DIGIT58_TAGLINES.length;
    el.textContent = DIGIT58_TAGLINES[digit58TaglineIndex];
  }, 2600);
}
document.addEventListener("DOMContentLoaded", startDigit58TaglineRotation);

function openAdminLogin() {
  window.location.href = "/admin/";
}
function openMyPostsPage() {
  const user = window.G58SiteUser;
  if (!user) return window.G58RequestAuth?.("login");
  const mine = (items) =>
    items.filter(
      (x) =>
        x.userId === user.id ||
        normalize(x.accountEmail) === normalize(user.email),
    );
  const customerItems = mine(customers),
    businessItems = mine(businesses);
  let modal = document.getElementById("myPostsModal");
  if (!modal) {
    modal = document.createElement("div");
    modal.id = "myPostsModal";
    modal.className = "modal";
    document.body.appendChild(modal);
  }
  const rows = (items, type) =>
    items
      .map(
        (x) =>
          `<div class="admin-row"><strong>${escapeHtml(x.title)}</strong><span>${escapeHtml(x.category)}</span><span>${escapeHtml(itemDistrict(x))}</span><button class="btn" type="button" data-my-post-type="${type}" data-my-post-id="${escapeHtml(x.id)}">View</button></div>`,
      )
      .join("") || '<div class="empty">No posts yet.</div>';
  modal.innerHTML = `<div class="modal-card"><div class="modal-head"><div><h3>My Posts & Business Cards</h3><p>${escapeHtml(user.email)}</p></div><button class="close" onclick="closeModal('myPostsModal')">×</button></div><h4>Customer posts</h4><div class="admin-grid">${rows(customerItems, "customer")}</div><h4>Business cards</h4><div class="admin-grid">${rows(businessItems, "business")}</div></div>`;
  modal.querySelectorAll("[data-my-post-id]").forEach((button) => {
    button.addEventListener("click", () => {
      const type = button.dataset.myPostType;
      const id = button.dataset.myPostId;
      const item = (type === "customer" ? customers : businesses).find(
        (entry) => String(entry.id) === id,
      );
      if (!item) return;
      selectedState = itemState(item);
      selectedDistrict = itemDistrict(item);
      localStorage.setItem("g58SelectedState", selectedState);
      localStorage.setItem("g58SelectedDistrict", selectedDistrict);
      updateStateUI();
      closeModal("myPostsModal");
      selectMode(type);
      renderWall();
      window.setTimeout(() => {
        const post = document.querySelector(`[data-post-id="${id}"]`);
        post?.scrollIntoView({ behavior: "smooth", block: "center" });
        post?.classList.add("post-focus-pulse");
        window.setTimeout(() => post?.classList.remove("post-focus-pulse"), 1800);
      }, 180);
    });
  });
  modal.classList.add("show");
}
function adminLogin() {
  window.location.href = "/admin/";
}
function renderAdmin(mode) {
  adminMode = mode;
  const data = mode === "customer" ? customers : businesses;
  document.getElementById("adminList").innerHTML =
    data
      .map(
        (i) =>
          `<div class="admin-row"><input type="checkbox" class="admin-check" value="${i.id}"><strong>${escapeHtml(i.title)}</strong><span>${escapeHtml(i.category)}</span><span>${escapeHtml(itemDistrict(i))}</span><button class="btn danger" onclick="deleteAdminItem('${i.id}')">Delete</button></div>`,
      )
      .join("") || '<div class="empty">No posts.</div>';
}
function deleteAdminItem(id) {
  if (!confirm("Delete this post permanently?")) return;
  if (adminMode === "customer")
    customers = customers.filter((x) => x.id !== id);
  else businesses = businesses.filter((x) => x.id !== id);
  saveData();
  renderAdmin(adminMode);
  renderWall();
}
function deleteSelectedAdmin() {
  const ids = [...document.querySelectorAll(".admin-check:checked")].map(
    (x) => x.value,
  );
  if (!ids.length) {
    alert("Select at least one post.");
    return;
  }
  if (!confirm("Delete selected posts permanently?")) return;
  if (adminMode === "customer")
    customers = customers.filter((x) => !ids.includes(x.id));
  else businesses = businesses.filter((x) => !ids.includes(x.id));
  saveData();
  renderAdmin(adminMode);
  renderWall();
}
function closeModal(id) {
  const modal = document.getElementById(id);
  if (!modal) return;
  if (
    id === "stateSelectionModal" &&
    modal.dataset.required === "true" &&
    !selectedState
  )
    return;
  modal.classList.remove("show");
}
function closeOnBackdrop(e, id) {
  if (e.target.id === id) closeModal(id);
}
window.addEventListener("scroll", () =>
  document
    .getElementById("topbar")
    .classList.toggle("scrolled", window.scrollY > 25),
);
window.addEventListener("g58-auth-changed", () => {
  if (window.G58SiteUser?.accountType === "business") {
    selectedState = window.G58SiteUser.state || selectedState;
    selectedDistrict = window.G58SiteUser.district || selectedDistrict;
    updateStateUI();
  }
  renderWall();
});
async function initialiseGravity58() {
  try {
    const cloudState = await Gravity58DB.loadState();
    if (cloudState) {
      customers = Array.isArray(cloudState.customers)
        ? cloudState.customers
        : [];
      businesses = Array.isArray(cloudState.businesses)
        ? cloudState.businesses
        : [];
    } else {
      const localCustomers = JSON.parse(
        localStorage.getItem("g58CustomersV3") || "null",
      );
      const localBusinesses = JSON.parse(
        localStorage.getItem("g58BusinessesV3") || "null",
      );
      customers = Array.isArray(localCustomers)
        ? localCustomers
        : defaultCustomers;
      businesses = Array.isArray(localBusinesses)
        ? localBusinesses
        : defaultBusinesses;
      await Gravity58DB.saveState({ customers, businesses });
    }
    gravity58Ready = true;
  } catch (error) {
    console.error("GRAVITY58 database startup failed:", error);
    const localCustomers = JSON.parse(
      localStorage.getItem("g58CustomersV3") || "null",
    );
    const localBusinesses = JSON.parse(
      localStorage.getItem("g58BusinessesV3") || "null",
    );
    customers = Array.isArray(localCustomers)
      ? localCustomers
      : defaultCustomers;
    businesses = Array.isArray(localBusinesses)
      ? localBusinesses
      : defaultBusinesses;
    Gravity58DB.setStatus("error", "Database connection failed");
  }

  purgeExpired();
  populateStateSelects();
  updateStateUI();
  renderRecentJobs();
  renderWall();
  if (!selectedState) setTimeout(() => openStateSelection(true), 150);
  if (!matchSeoRoute()) checkDeepLinks();

  Gravity58DB.subscribe((state) => {
    if (!state) return;
    customers = Array.isArray(state.customers) ? state.customers : [];
    businesses = Array.isArray(state.businesses) ? state.businesses : [];
    localStorage.setItem("g58CustomersV3", JSON.stringify(customers));
    localStorage.setItem("g58BusinessesV3", JSON.stringify(businesses));
    renderRecentJobs();
    renderWall();
  });
}

initialiseGravity58();
async function shareG58CardToWhatsApp() {
  const shareText = `GRAVITY58 — India's Local Business Platform

✅ Free Ad Post
✅ Free Digital Business Card
✅ Free POS

Visit: https://g58.in`;
  const imageUrl = window.location.origin + "/assets/g58-whatsapp-card.png";

  try {
    const response = await fetch(imageUrl, { cache: "no-store" });
    if (!response.ok) throw new Error("Image could not be loaded");
    const blob = await response.blob();
    const imageFile = new File([blob], "GRAVITY58-Digital-Card.png", {
      type: blob.type || "image/png",
    });

    if (navigator.canShare && navigator.canShare({ files: [imageFile] })) {
      await navigator.share({
        title: "GRAVITY58",
        text: shareText,
        files: [imageFile],
      });
      return;
    }
  } catch (error) {
    if (error && error.name === "AbortError") return;
    console.warn("Direct image sharing is unavailable:", error);
  }

  const fallbackText = shareText + "\n\nCard image: " + imageUrl;
  window.open(
    "https://wa.me/?text=" + encodeURIComponent(fallbackText),
    "_blank",
    "noopener",
  );
}

let pendingCardUnlock = null;
function requestCardUnlock(type, id, checkbox) {
  if (!checkbox.checked) return;
  pendingCardUnlock = { type, id, checkbox };
  const modal = document.getElementById("cardUnlockModal");
  const title = document.getElementById("unlockModalTitle");
  const input = document.getElementById("unlockModalPhone");
  if (title)
    title.textContent =
      type === "customer" ? "Unlock Customer Card" : "Unlock Business Card";
  if (input) {
    input.value = "";
    setTimeout(() => input.focus(), 80);
  }
  modal?.classList.add("open");
}
function closeCardUnlockModal(reset = true) {
  document.getElementById("cardUnlockModal")?.classList.remove("open");
  if (reset && pendingCardUnlock?.checkbox)
    pendingCardUnlock.checkbox.checked = false;
  pendingCardUnlock = null;
}
document.addEventListener("DOMContentLoaded", () => {
  document
    .getElementById("cancelUnlockModal")
    ?.addEventListener("click", () => closeCardUnlockModal(true));
  document
    .getElementById("confirmUnlockModal")
    ?.addEventListener("click", () => {
      if (!pendingCardUnlock) return;
      const phone = document.getElementById("unlockModalPhone")?.value || "";
      if (!phone.trim())
        return alert("Enter the phone number used while publishing.");
      const { type, id, checkbox } = pendingCardUnlock;
      let ok = false;
      if (type === "customer") ok = unlockCustomerCard(id, phone) === true;
      else {
        const b = businesses.find((x) => x.id === id);
        ok =
          !!b &&
          [b.phone, b.whatsapp].some(
            (v) => cleanNumber(v) === cleanNumber(phone),
          );
        if (ok) unlockBusinessCard(id, false, phone);
        else alert("Phone number does not match this business card.");
      }
      if (ok) {
        document.getElementById("cardUnlockModal")?.classList.remove("open");
        pendingCardUnlock = null;
      } else if (checkbox) checkbox.checked = false;
    });
  document
    .getElementById("unlockModalPhone")
    ?.addEventListener("keydown", (e) => {
      if (e.key === "Enter")
        document.getElementById("confirmUnlockModal")?.click();
    });
});
