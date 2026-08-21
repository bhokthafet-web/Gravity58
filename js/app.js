const DAY = 86400000;
const BUSINESS_POPUP_RETENTION_DAYS = 30;
const BUSINESS_POPUP_RETENTION = BUSINESS_POPUP_RETENTION_DAYS * DAY;
const whatsappBrandIcon =
  '<svg class="biz-brand-logo" viewBox="0 0 32 32" aria-hidden="true"><path fill="currentColor" d="M16 3C9.1 3 3.5 8.4 3.5 15.1c0 2.4.7 4.7 2.1 6.6L4 29l7.6-2c1.8 1 3.8 1.5 5.9 1.5 6.9 0 12.5-5.4 12.5-12.1C30 8.4 24.4 3 17.5 3H16zm1.5 22.9c-1.9 0-3.8-.5-5.4-1.5l-.4-.2-4.5 1.2 1.2-4.2-.3-.4c-1.2-1.7-1.8-3.7-1.8-5.7 0-5.3 4.5-9.6 10.1-9.6 5.6 0 10.1 4.3 10.1 9.6s-4.5 9.6-10 9.6zm5.6-7.2c-.3-.1-1.8-.9-2.1-1-.3-.1-.5-.1-.7.2-.2.3-.8 1-1 1.2-.2.2-.4.2-.7.1-1.9-.9-3.1-1.7-4.4-3.8-.3-.5.3-.5.9-1.7.1-.2.1-.4 0-.6-.1-.2-.7-1.7-1-2.3-.3-.6-.5-.6-.7-.6h-.6c-.2 0-.6.1-.9.4-.3.3-1.2 1.1-1.2 2.8 0 1.6 1.2 3.2 1.4 3.4.2.2 2.4 3.5 5.8 4.9 2.2.9 3.1 1 4.2.8.7-.1 1.8-.7 2.1-1.4.3-.7.3-1.3.2-1.4-.1-.2-.3-.3-.6-.4z"/></svg>';
const instagramBrandIcon =
  '<svg class="biz-brand-logo" viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="5" fill="none" stroke="currentColor" stroke-width="2.2"/><circle cx="12" cy="12" r="4.2" fill="none" stroke="currentColor" stroke-width="2.2"/><circle cx="17.4" cy="6.7" r="1.25" fill="currentColor"/></svg>';
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
  const customerCount = customers.length;
  const businessCount = businesses.length;
  let migratedBusiness = false;
  customers = customers.filter(
    (c) => !c.accepted && (c.expiresAt || c.created + 30 * DAY) > now,
  );
  businesses.forEach((business) => {
    if (!Number(business.popupExpiresAt)) {
      business.popupRetentionStartedAt = now;
      business.popupExpiresAt = now + BUSINESS_POPUP_RETENTION;
      business.lastPopupOpenedAt = Number(business.lastPopupOpenedAt) || 0;
      migratedBusiness = true;
    }
  });
  businesses = businesses.filter(
    (business) => Number(business.popupExpiresAt) > now,
  );
  if (
    customerCount !== customers.length ||
    businessCount !== businesses.length ||
    migratedBusiness
  )
    saveData();
}
function daysLeft(c) {
  return Math.max(
    0,
    Math.ceil(((c.expiresAt || c.created + 30 * DAY) - Date.now()) / DAY),
  );
}
function businessPopupDaysLeft(business) {
  return Math.max(
    0,
    Math.ceil((Number(business.popupExpiresAt || 0) - Date.now()) / DAY),
  );
}
function businessPopupRetentionLabel(business) {
  const remaining = businessPopupDaysLeft(business);
  const suffix = `${remaining} ${remaining === 1 ? "day" : "days"} left`;
  return Number(business.lastPopupOpenedAt)
    ? `Popup opened ${timeAgoLabel(Number(business.lastPopupOpenedAt)).toLowerCase()} · ${suffix}`
    : `Popup card not opened · ${suffix}`;
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
  populateAreaFilter();
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
    ?.classList.toggle("active", mode === "customer");
  document
    .getElementById("businessTab")
    ?.classList.toggle("active", mode === "business");
  document
    .getElementById("businessNationalToggle")
    ?.classList.toggle("hidden", mode !== "business");
  document
    .getElementById("contentArea")
    ?.classList.toggle("g58-mode-customer", mode === "customer");
  document
    .getElementById("contentArea")
    ?.classList.toggle("g58-mode-business", mode === "business");
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
  const sortEl = document.getElementById("sortFilter");
  if (sortEl) {
    const current = sortEl.value;
    sortEl.innerHTML =
      mode === "customer"
        ? '<option value="nearby">Newest</option><option value="latest">Latest posts</option><option value="low">Budget: Low to High</option><option value="high">Budget: High to Low</option><option value="few">Fewest Offers</option><option value="rated">Highest rated</option><option value="shuffle">Shuffle</option>'
        : '<option value="nearby">Most Relevant</option><option value="rated">Highest Rated</option><option value="experience">Most Experienced</option><option value="projects">Most Projects</option><option value="low">Price: Low to High</option><option value="latest">Newest</option>';
    if ([...sortEl.options].some((o) => o.value === current))
      sortEl.value = current;
  }
  const searchEl = document.getElementById("searchInput");
  if (searchEl && document.activeElement !== searchEl) {
    searchEl.placeholder =
      mode === "customer"
        ? "Search requirements, services or locations..."
        : "What service are you looking for?";
  }
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
  const area = document.getElementById("areaFilter")?.value || "";
  const minRating = Number(document.getElementById("ratingFilter")?.value || 0);
  const minExperience = Number(
    document.getElementById("experienceFilter")?.value || 0,
  );
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
  if (activeMode === "business" && area) {
    list = list.filter((i) => normalize(i.area) === normalize(area));
  }
  if (activeMode === "business" && minRating) {
    list = list.filter((i) => businessRatingStats(i).average >= minRating);
  }
  if (activeMode === "business" && minExperience) {
    list = list.filter((i) => Number(i.experience || 0) >= minExperience);
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
  if (sort === "experience" && activeMode === "business")
    list.sort((a, b) => Number(b.experience || 0) - Number(a.experience || 0));
  if (sort === "projects" && activeMode === "business")
    list.sort((a, b) => Number(b.projects || 0) - Number(a.projects || 0));
  if (sort === "shuffle") list.sort(() => Math.random() - 0.5);
  const wall = document.getElementById("wall");
  if (
    (activeMode === "customer" || activeMode === "business") &&
    !gravity58Ready
  ) {
    wall.innerHTML =
      activeMode === "customer" ? customerWallSkeleton() : businessWallSkeleton();
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
    wall.innerHTML = businessWallEmptyState();
  }
  if (typeof window.afterRenderWall === "function") window.afterRenderWall(list);
  updateBidBell();
}
function businessWallSkeleton() {
  return Array.from(
    { length: 6 },
    () =>
      `<article class="biz-card biz-skeleton"><div class="sk-line sk-w40 sk-h20"></div><div class="sk-line sk-w60"></div><div class="sk-line sk-w100"></div><div class="sk-line sk-w100"></div><div class="sk-row"><div class="sk-line sk-w30"></div><div class="sk-line sk-w30"></div><div class="sk-line sk-w30"></div></div></article>`,
  ).join("");
}
function businessWallEmptyState() {
  if (showNationalBusinessesOnly) {
    return `<div class="req-empty"><div class="req-empty-icon">🏢</div><h3>No national business cards found.</h3><p>Try clearing filters or browse businesses local to your selected area.</p><div class="req-empty-actions"><button class="btn" onclick="clearBusinessWallFilters()">Clear Filters</button></div></div>`;
  }
  return `<div class="req-empty"><div class="req-empty-icon">🏢</div><h3>No businesses found here yet.</h3><p>Try another category, district or expand your search.</p><div class="req-empty-actions"><button class="btn" onclick="clearBusinessWallFilters()">Clear Filters</button><button class="btn primary" onclick="g58ShowNationalBusinesses()">Show National Businesses</button></div></div>`;
}
function clearBusinessWallFilters() {
  document.getElementById("searchInput").value = "";
  document.getElementById("categoryFilter").value = "";
  const areaEl = document.getElementById("areaFilter");
  if (areaEl) areaEl.value = "";
  const ratingEl = document.getElementById("ratingFilter");
  if (ratingEl) ratingEl.value = "";
  const expEl = document.getElementById("experienceFilter");
  if (expEl) expEl.value = "";
  showNationalBusinessesOnly = false;
  const nationalCheckbox = document.getElementById("nationalBusinessOnly");
  if (nationalCheckbox) nationalCheckbox.checked = false;
  const districtEl = document.getElementById("districtFilter");
  if (districtEl) {
    districtEl.value = "";
    changeDistrictFilter();
    return;
  }
  renderWall();
}
function g58ShowNationalBusinesses() {
  showNationalBusinessesOnly = true;
  const cb = document.getElementById("nationalBusinessOnly");
  if (cb) cb.checked = true;
  renderWall();
}
function availableAreas() {
  const all = businesses
    .filter(
      (item) => normalize(itemState(item)) === normalize(selectedState),
    )
    .filter(
      (item) =>
        !selectedDistrict ||
        normalize(itemDistrict(item)) === normalize(selectedDistrict),
    )
    .map((item) => (item.area || "").trim())
    .filter(Boolean);
  return [...new Set(all)].sort((a, b) => a.localeCompare(b));
}
function populateAreaFilter() {
  const select = document.getElementById("areaFilter");
  if (!select) return;
  const current = select.value;
  const areas = availableAreas();
  select.innerHTML =
    '<option value="">All Areas</option>' +
    areas
      .map((a) => `<option value="${escapeHtml(a)}">${escapeHtml(a)}</option>`)
      .join("");
  if (areas.some((a) => normalize(a) === normalize(current)))
    select.value = current;
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
function currentAccountOwns(item) {
  const user = window.G58SiteUser;
  if (!user || !item) return false;
  if (item.userId && String(item.userId) === String(user.id)) return true;
  if (
    item.accountEmail &&
    user.email &&
    normalize(item.accountEmail) === normalize(user.email)
  )
    return true;
  const itemPhone = cleanNumber(item.accountPhone || "").slice(-10);
  const userPhone = cleanNumber(user.phone || "").slice(-10);
  return Boolean(itemPhone && userPhone && itemPhone === userPhone);
}
function isCustomerPostOwner(c) {
  const accountOwner = currentAccountOwns(c);
  if (accountOwner)
    sessionStorage.setItem(`g58OwnerUnlocked_${c.id}`, "true");
  return (
    accountOwner ||
    sessionStorage.getItem(`g58OwnerUnlocked_${c.id}`) === "true"
  );
}
function seenBidIds(postId) {
  try {
    const raw = JSON.parse(
      localStorage.getItem(`g58SeenBids_${postId}`) || "[]",
    );
    return Array.isArray(raw) ? raw : [];
  } catch {
    return [];
  }
}
function markBidsSeen(postId, bidIds) {
  localStorage.setItem(`g58SeenBids_${postId}`, JSON.stringify(bidIds));
}
function unreadBidCount(c) {
  const seen = new Set(seenBidIds(c.id));
  return (c.bids || []).filter((bid) => !seen.has(bid.id)).length;
}
function updateBidBell() {
  const button = document.getElementById("bidBellButton");
  const badge = document.getElementById("bidBellBadge");
  if (!button || !badge) return;
  const count = customers.reduce(
    (sum, c) => sum + (isCustomerPostOwner(c) ? unreadBidCount(c) : 0),
    0,
  );
  badge.textContent = count > 9 ? "9+" : String(count);
  button.classList.toggle("hidden", count === 0);
}
function openBidBellPanel() {
  customers.forEach((c) => {
    if (!isCustomerPostOwner(c)) return;
    markBidsSeen(c.id, (c.bids || []).map((bid) => bid.id));
  });
  updateBidBell();
  if (window.G58SiteUser) {
    openMyPostsPage();
  } else {
    alert(
      "You have new bids on a requirement you posted. Log in with the same account, or open the post you unlocked earlier, to view them.",
    );
  }
}
function isBusinessCardOwner(b) {
  const accountOwner = currentAccountOwns(b);
  if (accountOwner)
    sessionStorage.setItem(`g58BusinessOwner_${b.id}`, "true");
  return (
    accountOwner ||
    sessionStorage.getItem(`g58BusinessOwner_${b.id}`) === "true"
  );
}
function ownedBusinessForBid() {
  return businesses.find((business) => isBusinessCardOwner(business)) || null;
}
function unlockOwnedCustomerPost(id) {
  const post = customers.find((item) => item.id === id);
  if (!post || !window.G58SiteUser || !isCustomerPostOwner(post)) {
    alert("Only the signed-in account that created this post can unlock it.");
    return;
  }
  sessionStorage.setItem(`g58OwnerUnlocked_${id}`, "true");
  renderWall();
  openRequirementDetail(id);
}
function customerCard(c) {
  const bidCount = (c.bids || []).length;
  const isOwner = isCustomerPostOwner(c);
  const full = bidCount >= 5;
  const almost = bidCount >= 4 && !full;
  const statusClass = full ? "full" : almost ? "almost" : "open";
  const statusLabel = full
    ? "Offers Full"
    : almost
      ? `${bidCount} of 5 Offers`
      : "Accepting Offers";
  const ring = `<div class="req-ring" style="--pct:${(bidCount / 5) * 100}"><span>${bidCount}/5</span></div>`;
  const daysLeftVal = daysLeft(c);
  const expiryBadge = `<span class="req-expiry-badge${daysLeftVal <= 5 ? " urgent" : ""}">${daysLeftVal}d left</span>`;
  const ownerUnlockLink = window.G58SiteUser && isOwner
    ? `<button type="button" class="req-link-btn req-owner-unlock-link" onclick="unlockOwnedCustomerPost('${c.id}')">Unlock Post</button>`
    : "";
  const shareRow = `<div class="req-share-row"><button type="button" class="req-link-btn" onclick="copyCustomerLink('${c.id}',this)">Copy Link</button><button type="button" class="req-link-btn" onclick="shareCustomerOnWhatsApp('${c.id}')">Share</button>${ownerUnlockLink}</div><div class="share-status" id="customer-share-${c.id}"></div>`;

  if (isOwner) {
    return `<article class="req-card owner" data-post-id="${c.id}">
<div class="req-top"><span class="req-owner-badge">Your Requirement</span><span class="req-status-stack"><span class="req-status ${statusClass}"><i></i>${statusLabel}</span>${expiryBadge}</span></div>
<h3 class="req-title">${escapeHtml(c.title)}</h3>
<div class="req-meta-row"><span>📍 ${escapeHtml(c.area)}, ${escapeHtml(itemDistrict(c))}</span><span>${timeAgoLabel(c.created)}</span></div>
<div class="req-bottom-row"><div class="req-budget"><strong>${formatMoney(c.price)}–${formatMoney(c.maxPrice)}</strong><small>Budget</small></div><div class="req-bid-progress">${ring}<small>${bidCount} / 5 Offers</small></div></div>
<div class="req-actions">${full ? '<button type="button" class="btn" disabled>Bids Full</button>' : `<button type="button" class="btn primary req-bid-btn" onclick="openBidModal('${c.id}')">Bids (${bidCount}) <span class="req-arrow">→</span></button>`}</div>
${shareRow}
</article>`;
  }

  return `<article class="req-card" data-post-id="${c.id}">
<div class="req-top"><span class="req-category">${escapeHtml(c.category)}</span><span class="req-status-stack"><span class="req-status ${statusClass}"><i></i>${statusLabel}</span>${expiryBadge}</span></div>
<h3 class="req-title">${escapeHtml(c.title)}</h3>
<div class="req-meta-row"><span>📍 ${escapeHtml(c.area)}, ${escapeHtml(itemDistrict(c))}</span><span>${timeAgoLabel(c.created)}</span></div>
<p class="req-desc">${escapeHtml(c.description)}</p>
<div class="req-bottom-row"><div class="req-budget"><strong>${formatMoney(c.price)}–${formatMoney(c.maxPrice)}</strong><small>Budget</small></div><div class="req-bid-progress">${ring}<small>${bidCount} / 5 Offers</small></div></div>
${bidCount === 4 ? '<div class="req-scarcity">Only 1 offer slot remaining</div>' : ""}
<div class="req-actions">
<button type="button" class="btn ghost" onclick="openRequirementDetail('${c.id}')">View Requirement <span class="req-arrow">→</span></button>
${full ? '<button type="button" class="btn" disabled>Bids Full</button>' : `<button type="button" class="btn primary req-bid-btn" onclick="openBidModal('${c.id}')">Bids (${bidCount})</button>`}
</div>
${shareRow}
</article>`;
}

let activeRequirementDetailId = null;
function openRequirementDetail(id) {
  const c = customers.find((x) => x.id === id);
  if (!c) return;
  activeRequirementDetailId = id;
  const isOwner = isCustomerPostOwner(c);
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
  const ring = `<div class="req-ring" style="--pct:${(bidCount / 5) * 100}"><span>${bidCount}/5</span></div>`;
  return `
<span class="req-detail-category">${escapeHtml(c.category)}</span>
<h2 class="req-detail-title">${escapeHtml(c.title)}</h2>
<div class="req-detail-meta"><span>📍 ${escapeHtml(c.area)}, ${escapeHtml(itemDistrict(c))}</span><span>${timeAgoLabel(c.created)}</span><span>${daysLeft(c)} days left</span></div>
<span class="req-status ${statusClass}"><i></i>${statusLabel}</span>
<div class="req-detail-section"><h4>Requirement</h4><p>${escapeHtml(c.description)}</p></div>
<div class="req-detail-section"><h4>Budget</h4><div class="req-detail-budget">${formatMoney(c.price)} – ${formatMoney(c.maxPrice)}</div><small>Expected Budget</small></div>
<div class="req-detail-section"><h4>Location</h4><p>${escapeHtml(c.area)}<br>${escapeHtml(itemDistrict(c))}<br>${escapeHtml(itemState(c))}</p></div>
<div class="req-detail-section"><h4>Offer Activity</h4><div class="req-bid-progress">${ring}<small>${bidCount} / 5 Offers Received</small></div></div>
<div class="req-detail-sticky">${
    full
      ? '<button type="button" class="btn" style="width:100%" disabled>Offers Full</button><p class="req-detail-sticky-note">This requirement has received the maximum number of offers.</p>'
      : `<button type="button" class="btn primary" style="width:100%" onclick="openBidModal('${c.id}')">Bids (${bidCount}) <span class="cta-arrow">→</span></button>`
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
function businessServicesUrl(b) {
  const raw = String(
    b.websiteUrl || b.website || b.servicesUrl || b.demoUrl || "",
  ).trim();
  if (raw) {
    if (/^https?:\/\//i.test(raw)) return raw;
    return "https://" + raw.replace(/^\/+/, "");
  }
  if (normalize(b.title) === "arakodi") return "https://www.arakodi.com/";
  return businessDemoUrl(b);
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
const G58_CLOUD_RATER_ID_KEY = "g58CloudRaterIdV1";
let activeRatingBusinessId = "";
let selectedRatingValue = 0;

function anonymousRaterId() {
  let id =
    localStorage.getItem(G58_CLOUD_RATER_ID_KEY) ||
    localStorage.getItem(G58_RATER_ID_KEY);
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
function mergeBusinessFromSecureResponse(business, updated) {
  if (!business || !updated) return;
  Object.assign(business, updated);
  localStorage.setItem("g58BusinessesV3", JSON.stringify(businesses));
}
async function submitBusinessRating() {
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
  const submitButton = document.getElementById("submitBusinessRatingBtn");
  submitButton?.setAttribute("disabled", "disabled");
  status.className = "moderation-status";
  status.textContent = "Saving your rating…";
  try {
    const functionId = Gravity58Ads?.config?.digitalOrderFunctionId;
    if (Gravity58Ads?.configured && functionId) {
      const user = await Gravity58Ads.ensureUser();
      if (!user?.$id)
        throw new Error("A secure rating session could not be started.");
      localStorage.setItem(G58_CLOUD_RATER_ID_KEY, user.$id);
      const result = await Gravity58Ads.executeFunction(functionId, {
        action: "rate-business-card",
        cardId: business.id,
        rating: selectedRatingValue,
        name,
        comment,
      });
      mergeBusinessFromSecureResponse(business, result?.business);
      status.textContent = result?.updated
        ? "Your rating was updated."
        : "Thank you. Your rating was submitted.";
    } else {
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
      saveData();
      status.textContent = existing
        ? "Your rating was updated."
        : "Thank you. Your rating was submitted.";
    }
    localStorage.setItem("g58ReviewerName", name);
    status.className = "moderation-status success";
    document.getElementById("deleteMyRatingBtn").classList.remove("hidden");
    refreshRatingModal();
    renderWall();
  } catch (error) {
    status.className = "moderation-status error";
    status.textContent =
      error?.message || "Your rating could not be saved. Please try again.";
  } finally {
    submitButton?.removeAttribute("disabled");
  }
}
async function deleteMyBusinessRating() {
  const business = businesses.find(
    (item) => item.id === activeRatingBusinessId,
  );
  if (!business) return;
  const deleteButton = document.getElementById("deleteMyRatingBtn");
  const status = document.getElementById("ratingFormStatus");
  deleteButton?.setAttribute("disabled", "disabled");
  try {
    const functionId = Gravity58Ads?.config?.digitalOrderFunctionId;
    if (Gravity58Ads?.configured && functionId) {
      const user = await Gravity58Ads.ensureUser();
      if (!user?.$id)
        throw new Error("A secure rating session could not be started.");
      localStorage.setItem(G58_CLOUD_RATER_ID_KEY, user.$id);
      const result = await Gravity58Ads.executeFunction(functionId, {
        action: "delete-business-rating",
        cardId: business.id,
      });
      mergeBusinessFromSecureResponse(business, result?.business);
    } else {
      const raterId = anonymousRaterId();
      const before = businessReviews(business).length;
      business.reviews = businessReviews(business).filter(
        (r) => r.raterId !== raterId,
      );
      if (business.reviews.length === before) return;
      saveData();
    }
    selectedRatingValue = 0;
    document.getElementById("ratingName").value =
      localStorage.getItem("g58ReviewerName") || "";
    document.getElementById("ratingComment").value = "";
    deleteButton?.classList.add("hidden");
    status.className = "moderation-status success";
    status.textContent = "Your rating was deleted.";
    refreshRatingModal();
    renderWall();
  } catch (error) {
    status.className = "moderation-status error";
    status.textContent =
      error?.message || "Your rating could not be deleted. Please try again.";
  } finally {
    deleteButton?.removeAttribute("disabled");
  }
}

function businessInitial(b) {
  return escapeHtml((b.title || "G58").trim().charAt(0).toUpperCase() || "G");
}
function avatarHue(seed) {
  let hash = 0;
  const s = String(seed || "");
  for (let i = 0; i < s.length; i++) hash = (hash * 31 + s.charCodeAt(i)) >>> 0;
  return hash % 360;
}
function businessProfileCompleteness(b) {
  const fields = [
    b.title,
    b.category,
    b.description,
    b.area,
    b.experience,
    b.projects,
    b.phone,
    b.whatsapp,
    b.email,
    b.socialUrl,
    b.image,
  ];
  const filled = fields.filter(
    (v) => v !== undefined && v !== null && v !== 0 && String(v).trim() !== "",
  ).length;
  return Math.round((filled / fields.length) * 100);
}
function getFavoriteBusinesses() {
  try {
    return JSON.parse(localStorage.getItem("g58FavoriteBusinesses") || "[]");
  } catch {
    return [];
  }
}
function isFavoriteBusiness(id) {
  return getFavoriteBusinesses().includes(id);
}
function toggleFavoriteBusiness(id) {
  let favs = getFavoriteBusinesses();
  favs = favs.includes(id) ? favs.filter((x) => x !== id) : [...favs, id];
  localStorage.setItem("g58FavoriteBusinesses", JSON.stringify(favs));
  renderWall();
  refreshFloatingBusinessIfOpen(id);
}
function businessCard(b) {
  return `<div class="biz-card-wall-item" data-post-id="${b.id}">${digitalBusinessCardMarkup(b, `showFloatingBusiness('${b.id}')`)}</div>`;
}

let qrOpenedFromBusinessPopup = false;

function openBusinessQr(id) {
  const business = businesses.find((item) => item.id === id);
  if (!business) return;

  const floatingWrap = document.getElementById("floatingBusinessWrap");
  qrOpenedFromBusinessPopup = Boolean(floatingWrap?.classList.contains("show"));
  if (qrOpenedFromBusinessPopup) floatingWrap.classList.add("qr-behind-hidden");

  const link = businessShareUrl(id);
  document.getElementById("businessQrTitle").textContent = business.title;
  const categoryEl = document.getElementById("businessQrCategory");
  if (categoryEl) categoryEl.textContent = business.category || "";
  document.getElementById("businessQrLink").value = link;
  document.getElementById("businessQrImage").src =
    "https://api.qrserver.com/v1/create-qr-code/?size=280x280&data=" +
    encodeURIComponent(link);

  const avatarEl = document.getElementById("businessQrAvatar");
  if (avatarEl) {
    avatarEl.style.background = `hsl(${avatarHue(business.id || business.title)} 60% 45%)`;
    avatarEl.textContent = businessInitial(business);
  }

  const waBtn = document.getElementById("businessQrWhatsapp");
  if (waBtn) {
    const waNumber = cleanNumber(business.whatsapp || business.phone || "");
    if (waNumber) {
      waBtn.href = `https://wa.me/${waNumber}?text=${encodeURIComponent("Hi, I found your business on G58 and would like to know more about your services.")}`;
      waBtn.innerHTML = `${whatsappBrandIcon}<span>WhatsApp</span>`;
      waBtn.hidden = false;
    } else {
      waBtn.hidden = true;
    }
  }
  const profileBtn = document.getElementById("businessQrSocial");
  if (profileBtn) {
    const profileUrl = businessDemoUrl(business);
    if (profileUrl) {
      profileBtn.href = profileUrl;
      profileBtn.innerHTML = `${instagramBrandIcon}<span>${/instagram\.com/i.test(profileUrl) ? "Instagram" : "Profile"}</span>`;
      profileBtn.hidden = false;
    } else {
      profileBtn.hidden = true;
    }
  }

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
  return `${window.location.origin}/?business=${encodeURIComponent(id)}`;
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
  renderWall();
  refreshFloatingBusinessIfOpen(id);
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
  document.getElementById("editBusinessWebsite").value =
    business.websiteUrl || business.website || "";
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
    websiteUrl: document.getElementById("editBusinessWebsite").value.trim(),
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
  showBusinessEditSuccess(id);
}
let lastEditedBusinessId = null;
function showBusinessEditSuccess(id) {
  lastEditedBusinessId = id;
  document.getElementById("businessEditSuccessModal")?.classList.add("show");
}
function closeBusinessEditSuccess() {
  document.getElementById("businessEditSuccessModal")?.classList.remove("show");
}
function viewEditedBusinessCard() {
  closeBusinessEditSuccess();
  if (lastEditedBusinessId) showFloatingBusiness(lastEditedBusinessId);
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

function ratingDistribution(b) {
  const reviews = businessReviews(b).filter(
    (r) => Number(r.rating) >= 1 && Number(r.rating) <= 5,
  );
  const counts = [5, 4, 3, 2, 1].map(
    (star) => reviews.filter((r) => Math.round(Number(r.rating)) === star).length,
  );
  const max = Math.max(1, ...counts);
  return [5, 4, 3, 2, 1].map((star, i) => ({
    star,
    count: counts[i],
    pct: Math.round((counts[i] / max) * 100),
  }));
}
function contactBusinessOnWhatsApp(id) {
  const b = businesses.find((x) => x.id === id);
  if (!b) return;
  const number = cleanNumber(b.whatsapp || b.phone || "");
  if (!number) return alert("WhatsApp number is not available.");
  const text =
    "Hi, I found your business on G58 and would like to know more about your services.";
  window.open(
    `https://wa.me/${number}?text=${encodeURIComponent(text)}`,
    "_blank",
    "noopener",
  );
}
async function shareBusinessProfile(id) {
  const b = businesses.find((x) => x.id === id);
  if (!b) return;
  const link = businessShareUrl(id);
  if (navigator.share) {
    try {
      await navigator.share({
        title: b.title,
        text: `${b.title} — ${b.category} on GRAVITY58`,
        url: link,
      });
      return;
    } catch (error) {
      /* user cancelled the native share sheet */
      return;
    }
  }
  const status = document.getElementById(`share-${id}`);
  try {
    await navigator.clipboard.writeText(link);
    if (status) {
      status.textContent = "Link copied to clipboard.";
      setTimeout(() => (status.textContent = ""), 2500);
    }
  } catch {
    prompt("Copy this business-card link:", link);
  }
}
function downloadBusinessVCard(id) {
  const b = businesses.find((x) => x.id === id);
  if (!b) return;
  const phone = cleanNumber(b.phone || "");
  const whatsapp = cleanNumber(b.whatsapp || "");
  const address = [b.area, itemDistrict(b), itemState(b)]
    .filter(Boolean)
    .join(", ");
  const url = businessDemoUrl(b);
  const lines = [
    "BEGIN:VCARD",
    "VERSION:3.0",
    `FN:${b.title}`,
    `ORG:${b.title}`,
    b.category ? `TITLE:${b.category}` : "",
    phone ? `TEL;TYPE=WORK,VOICE:${phone}` : "",
    whatsapp && whatsapp !== phone ? `TEL;TYPE=CELL:${whatsapp}` : "",
    b.email ? `EMAIL:${b.email}` : "",
    address ? `ADR;TYPE=WORK:;;${address};;;;` : "",
    url ? `URL:${url}` : "",
    b.description ? `NOTE:${b.description.replace(/\r?\n/g, " ")}` : "",
    "END:VCARD",
  ]
    .filter(Boolean)
    .join("\r\n");
  const blob = new Blob([lines], { type: "text/vcard" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = `${b.title.replace(/[^a-z0-9]+/gi, "_")}.vcf`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  setTimeout(() => URL.revokeObjectURL(link.href), 2000);
}
function openBusinessLocation(id) {
  const b = businesses.find((x) => x.id === id);
  if (!b) return;
  const query = [b.title, b.area, itemDistrict(b), itemState(b)]
    .filter(Boolean)
    .join(", ");
  if (!query) return alert("Location details are not available.");
  window.open(
    "https://www.google.com/maps/search/?api=1&query=" +
      encodeURIComponent(query),
    "_blank",
    "noopener",
  );
}
function digitalBusinessCardMarkup(
  b,
  viewAction,
  viewLabel = "View",
  options = {},
) {
  const isOwner = isBusinessCardOwner(b);
  const stats = businessRatingStats(b);
  const favorited = isFavoriteBusiness(b.id);
  const websiteUrl = businessDemoUrl(b);
  const shareUrl = businessShareUrl(b.id);
  const shareQrSrc =
    "https://api.qrserver.com/v1/create-qr-code/?size=220x220&ecc=H&margin=8&data=" +
    encodeURIComponent(shareUrl);
  const waNumber = cleanNumber(b.whatsapp || b.phone || "");
  const waHref = waNumber
    ? `https://wa.me/${waNumber}?text=${encodeURIComponent("Hi, I found your business on G58 and would like to know more about your services.")}`
    : "";
  const locationQuery = [b.area, itemDistrict(b), itemState(b)]
    .filter(Boolean)
    .join(", ");
  const isInstagram = /instagram\.com/i.test(websiteUrl);
  const socialLabel = isInstagram ? "Instagram" : "Profile";
  const socialIcon = instagramBrandIcon;
  const retentionLabel = businessPopupRetentionLabel(b);

  const icPhone =
    '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.13.96.36 1.9.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.91.34 1.85.57 2.81.7A2 2 0 0 1 22 16.92Z"/></svg>';
  const icSave =
    '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 15V3"/><path d="m7 10 5 5 5-5"/><path d="M20 21H4"/></svg>';
  const icPin =
    '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/></svg>';
  const icShare =
    '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><path d="m8.6 13.5 6.8 3.9M15.4 6.6 8.6 10.5"/></svg>';

  const ratingRow = stats.count
    ? `<button type="button" class="biz-card-rating biz-card-rating-action" onclick="openBusinessRating('${b.id}')" aria-label="Rate ${escapeHtml(b.title)} or read ${stats.count} ${stats.count === 1 ? "review" : "reviews"}">${ratingStars(stats.average)}<strong>${stats.average.toFixed(1)}</strong><small>(${stats.count} ${stats.count === 1 ? "Review" : "Reviews"})</small></button>`
    : `<button type="button" class="biz-card-rating biz-card-rating-empty" onclick="openBusinessRating('${b.id}')">☆☆☆☆☆ <small>Be the first to review</small></button>`;

  return `<div class="biz-card-glass">
${isOwner ? '<span class="biz-owner-badge">Your Business</span>' : ""}
<div class="biz-card-glass-head">
<span class="biz-card-nfc-label"><svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M3 9a9 9 0 0 1 9-7"/><path d="M3 9a6 6 0 0 1 6-5"/><circle cx="5" cy="9" r="1.4" fill="currentColor" stroke="none"/></svg>Digital Business Card</span>
${
  options.popup
    ? '<button type="button" class="biz-popup-card-close" onclick="hideFloatingBusiness()" aria-label="Close business card">×</button>'
    : `<button type="button" class="biz-fav-btn biz-fav-btn-glass${favorited ? " active" : ""}" onclick="toggleFavoriteBusiness('${b.id}')" aria-label="${favorited ? "Remove from saved" : "Save business"}">${favorited ? "♥" : "♡"}</button>`
}
</div>

<button type="button" class="biz-card-view-pill" onclick="${viewAction}">${escapeHtml(viewLabel)}</button>

<div class="biz-card-profile">
<h2 class="biz-card-name">${escapeHtml(b.title)}</h2>
<p class="biz-card-category">${escapeHtml(b.category)}</p>
${b.tagline ? `<p class="biz-card-tagline-pill">— ${escapeHtml(b.tagline)} —</p>` : ""}
${ratingRow}
</div>

<div class="biz-card-qr-block">
<p class="biz-card-qr-label">Scan to Open</p>
<div class="biz-card-qr-wrap">
<img src="${shareQrSrc}" alt="QR code for ${escapeHtml(b.title)}" class="biz-card-qr-img" loading="lazy">
<span class="biz-card-qr-logo" aria-hidden="true"><svg viewBox="0 0 120 120" fill="none" stroke="#F97316" stroke-width="10"><circle cx="60" cy="26" r="15"/><circle cx="28" cy="82" r="15"/><circle cx="92" cy="82" r="15"/></svg></span>
</div>
<p class="biz-card-qr-caption">View our complete digital business card</p>
<p class="biz-card-popup-retention"><span aria-hidden="true"></span>${escapeHtml(retentionLabel)}<small>(will delete in 30d if not opened)</small></p>
</div>

<div class="biz-card-primary-actions">
${waNumber ? `<a class="biz-card-cta biz-card-cta-whatsapp" href="${waHref}" target="_blank" rel="noopener">${whatsappBrandIcon} WhatsApp</a>` : `<span class="biz-card-cta biz-card-cta-whatsapp biz-card-cta-disabled">${whatsappBrandIcon} WhatsApp</span>`}
${websiteUrl ? `<a class="biz-card-cta biz-card-cta-instagram" href="${websiteUrl}" target="_blank" rel="noopener">${socialIcon} ${socialLabel}</a>` : `<span class="biz-card-cta biz-card-cta-instagram biz-card-cta-disabled">${socialIcon} ${socialLabel}</span>`}
</div>

<div class="biz-card-quickrow">
<button type="button" class="biz-quick-ic biz-quick-ic-call" onclick="callBusinessPhone('${b.id}')" aria-label="Call"><span class="biz-quick-ic-ic">${icPhone}</span><span class="biz-quick-ic-label">Call</span></button>
<button type="button" class="biz-quick-ic biz-quick-ic-save" onclick="downloadBusinessVCard('${b.id}')" aria-label="Save Contact"><span class="biz-quick-ic-ic">${icSave}</span><span class="biz-quick-ic-label">Save Contact</span></button>
<button type="button" class="biz-quick-ic biz-quick-ic-loc"${locationQuery ? "" : " disabled"} onclick="openBusinessLocation('${b.id}')" aria-label="Location"><span class="biz-quick-ic-ic">${icPin}</span><span class="biz-quick-ic-label">Location</span></button>
<button type="button" class="biz-quick-ic biz-quick-ic-share" onclick="shareBusinessProfile('${b.id}')" aria-label="Share"><span class="biz-quick-ic-ic">${icShare}</span><span class="biz-quick-ic-label">Share</span></button>
</div>

<div class="biz-card-footer">
<svg viewBox="0 0 120 120" fill="none" stroke="#F97316" stroke-width="8" aria-hidden="true"><circle cx="60" cy="26" r="15"/><circle cx="28" cy="82" r="15"/><circle cx="92" cy="82" r="15"/></svg>
<span>g58.in</span>
</div>
<p class="biz-card-tagline">Your Business. Always One Scan Away.</p>
<div class="share-status" id="share-${b.id}"></div>
</div>`;
}
function floatingBusinessMarkup(b) {
  const isOwner = isBusinessCardOwner(b);
  const ownerAction = isOwner
    ? `openBusinessEdit('${b.id}')`
    : `requestBusinessCardUnlock('${b.id}')`;
  const ownerLabel = isOwner
    ? "Manage your business"
    : "Unlock if you're the owner";
  const phone = cleanNumber(b.phone || b.whatsapp || "");
  const websiteUrl = businessServicesUrl(b);
  const locationQuery = [b.title, b.area, itemDistrict(b), itemState(b)]
    .filter(Boolean)
    .join(", ");
  const mapsUrl = locationQuery
    ? "https://www.google.com/maps/search/?api=1&query=" +
      encodeURIComponent(locationQuery)
    : "";
  const phoneIcon =
    '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.13.96.36 1.9.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.91.34 1.85.57 2.81.7A2 2 0 0 1 22 16.92Z"/></svg>';
  const locationIcon =
    '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/></svg>';
  const servicesIcon =
    '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 21h14"/><path d="M7 21v-2a5 5 0 0 1 10 0v2"/><path d="M12 3v3"/><path d="M4.2 7.2l2.1 2.1"/><path d="M19.8 7.2l-2.1 2.1"/><path d="M3 14h18"/></svg>';
  const shareIcon =
    '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><path d="m8.6 13.5 6.8 3.9M15.4 6.6 8.6 10.5"/></svg>';

  const callAction = phone
    ? `<a class="biz-popup-side-action" href="tel:${phone}"><span>${phoneIcon}</span><strong>Call</strong></a>`
    : `<span class="biz-popup-side-action disabled" aria-disabled="true"><span>${phoneIcon}</span><strong>Call</strong></span>`;
  const locationAction = mapsUrl
    ? `<a class="biz-popup-side-action" href="${escapeHtml(mapsUrl)}" target="_blank" rel="noopener"><span>${locationIcon}</span><strong>Find Location</strong></a>`
    : `<span class="biz-popup-side-action disabled" aria-disabled="true"><span>${locationIcon}</span><strong>Find Location</strong></span>`;
  const servicesAction = websiteUrl
    ? `<a class="biz-popup-side-action biz-popup-view-services" href="${escapeHtml(websiteUrl)}" target="_blank" rel="noopener"><span>${servicesIcon}</span><strong>View Services</strong></a>`
    : `<span class="biz-popup-side-action biz-popup-view-services disabled" aria-disabled="true"><span>${servicesIcon}</span><strong>View Services</strong></span>`;

  return `<div class="biz-popup-layout">
<aside class="biz-popup-side-rail biz-popup-side-left" aria-label="Business contact actions">${callAction}${locationAction}</aside>
<article class="biz-profile">${digitalBusinessCardMarkup(b, ownerAction, ownerLabel, { popup: true })}</article>
<aside class="biz-popup-side-rail biz-popup-side-right" aria-label="Business profile actions">${servicesAction}<button type="button" class="biz-popup-side-action" onclick="shareBusinessProfile('${b.id}')"><span>${shareIcon}</span><strong>Share</strong></button></aside>
</div>`;
}
let activeFloatingBusinessId = null;
function setLocalBusinessPopupActivity(business, openedAt = Date.now()) {
  business.lastPopupOpenedAt = openedAt;
  business.popupRetentionStartedAt ||= openedAt;
  business.popupExpiresAt = openedAt + BUSINESS_POPUP_RETENTION;
  localStorage.setItem("g58BusinessesV3", JSON.stringify(businesses));
}
async function persistBusinessPopupActivity(id) {
  const business = businesses.find((item) => item.id === id);
  if (!business) return;
  const functionId = Gravity58Ads?.config?.digitalOrderFunctionId;
  if (!Gravity58Ads?.configured || !functionId) {
    saveData();
    return;
  }
  try {
    await Gravity58Ads.ensureUser();
    const result = await Gravity58Ads.executeFunction(functionId, {
      action: "touch-business-card",
      cardId: id,
    });
    if (result?.business) Object.assign(business, result.business);
    localStorage.setItem("g58BusinessesV3", JSON.stringify(businesses));
    renderWall();
    if (activeFloatingBusinessId === id) {
      document.getElementById("floatingBusinessCard").innerHTML =
        floatingBusinessMarkup(business);
    }
  } catch (error) {
    if (Number(error?.code) === 410) {
      businesses = businesses.filter((item) => item.id !== id);
      localStorage.setItem("g58BusinessesV3", JSON.stringify(businesses));
      hideFloatingBusiness();
      renderWall();
      alert("This business card expired after 30 days without a popup view.");
      return;
    }
    console.warn("Business-card popup activity could not be saved:", error);
  }
}
function showFloatingBusiness(id) {
  const b = businesses.find((x) => x.id === id);
  if (!b) return;
  if (Number(b.popupExpiresAt) && Number(b.popupExpiresAt) <= Date.now()) {
    businesses = businesses.filter((item) => item.id !== id);
    localStorage.setItem("g58BusinessesV3", JSON.stringify(businesses));
    renderWall();
    alert("This business card expired after 30 days without a popup view.");
    return;
  }
  setLocalBusinessPopupActivity(b);
  activeFloatingBusinessId = id;
  document.getElementById("floatingBusinessCard").innerHTML =
    floatingBusinessMarkup(b);
  document.getElementById("floatingBusinessWrap").classList.add("show");
  document.body.classList.add("req-detail-lock");
  renderWall();
  void persistBusinessPopupActivity(id);
}
function hideFloatingBusiness() {
  document.getElementById("floatingBusinessWrap").classList.remove("show");
  document.body.classList.remove("req-detail-lock");
  activeFloatingBusinessId = null;
}
function refreshFloatingBusinessIfOpen(id) {
  if (activeFloatingBusinessId === id) showFloatingBusiness(id);
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
  if (lastPublishedPostType === "business") {
    showFloatingBusiness(lastPublishedPostId);
    return;
  }
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
function posWorkspaceSafeId(value, length) {
  return String(value || "account")
    .replace(/[^a-zA-Z0-9._-]/g, "-")
    .slice(0, length);
}
async function hasBusinessCardAccess(user) {
  const api = window.Gravity58Ads;
  if (!api?.configured || !user) return false;
  const now = Date.now();
  const notExpired = (row) =>
    row.lifetime || !row.expiresAt || new Date(row.expiresAt).getTime() > now;
  const [digit58Entitlements, menuEntitlements, posWorkspace] =
    await Promise.all([
      api.list("digit58_entitlements").catch(() => []),
      api.list("digital_menu_entitlements").catch(() => []),
      api
        .list(`pos_workspace_${posWorkspaceSafeId(user.id, 45)}`)
        .catch(() => []),
    ]);
  const isRefillsOwner = digit58Entitlements.some(
    (row) =>
      row.ownerId === user.id && row.active && !row.paused && notExpired(row),
  );
  const isMenuPremium = menuEntitlements.some(
    (row) =>
      row.ownerId === user.id && row.plan === "premium" && notExpired(row),
  );
  const posRecord = posWorkspace.find((row) => row.ownerId === user.id);
  const isPosPremium = Boolean(
    posRecord?.premium?.active &&
      (!posRecord.premium.expiresAt ||
        new Date(posRecord.premium.expiresAt).getTime() > now),
  );
  return isRefillsOwner || isMenuPremium || isPosPremium;
}
async function refreshPosNavVisibility() {
  const user = window.G58SiteUser;
  const show = user ? await hasBusinessCardAccess(user) : false;
  document.getElementById("navProductsPos")?.classList.toggle("hidden", !show);
  document.getElementById("mobileNavPos")?.classList.toggle("hidden", !show);
}
window.addEventListener("g58-auth-changed", refreshPosNavVisibility);
document.addEventListener("DOMContentLoaded", () => {
  if (window.G58SiteUser) refreshPosNavVisibility();
});

function scheduleHeroFlowDots() {
  const heading = document.getElementById("heroHeading");
  if (!heading || window.matchMedia("(prefers-reduced-motion: reduce)").matches)
    return;
  const states = ["dots-active", "refer-active"];
  let index = 0;
  const run = () => {
    const activeClass = states[index % states.length];
    heading.classList.add(activeClass);
    setTimeout(() => heading.classList.remove(activeClass), 5000);
    index += 1;
    setTimeout(run, 6000 + Math.random() * 6000);
  };
  setTimeout(run, 1200 + Math.random() * 2000);
}
document.addEventListener("DOMContentLoaded", scheduleHeroFlowDots);
async function openReferAndEarn() {
  const user = window.G58SiteUser;
  if (!user) return window.G58RequestAuth?.("login");
  const button = document.getElementById("getReferralLinkBtn");
  const box = document.getElementById("referralLinkBox");
  const functionId = Gravity58Ads?.config?.digitalOrderFunctionId;
  if (!button || !box || !Gravity58Ads?.configured || !functionId) return;
  const originalText = button.textContent;
  button.disabled = true;
  button.textContent = "Loading…";
  try {
    const result = await Gravity58Ads.executeFunction(functionId, {
      action: "digit58-get-referral-code",
      userEmail: user.email,
      userName: user.displayName,
    });
    const link = `${location.origin}/digit58/?ref=${result.code}`;
    box.innerHTML = `<div class="refer-link-row"><input readonly value="${escapeHtml(link)}" id="referLinkInput"><button class="btn small" id="copyReferLinkBtn" type="button">Copy</button></div>`;
    box.classList.remove("hidden");
    button.classList.add("hidden");
    document.getElementById("copyReferLinkBtn").onclick = async () => {
      try {
        await navigator.clipboard.writeText(link);
      } catch {
        const input = document.getElementById("referLinkInput");
        input.select();
        document.execCommand("copy");
      }
    };
  } catch (error) {
    alert(error.message || "Could not load your referral link");
    button.disabled = false;
    button.textContent = originalText;
  }
}
async function openBusinessCardCreator() {
  const user = window.G58SiteUser;
  if (!user) return window.G58RequestAuth?.("business");
  const allowed = await hasBusinessCardAccess(user);
  if (!allowed) {
    alert(
      "A digital business card is available for Refills store owners, Digital Menu Premium accounts and POS Premium accounts. Upgrade one of these plans to create your card.",
    );
    return;
  }
  activeMode = "business";
  openCreateModal();
  const type = document.getElementById("postType");
  if (type) type.value = "business";
  updateFormType();
}

function openCreateModal() {
  if (!window.G58SiteUser && activeMode !== "business") {
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
let visitingCardOcrLoader = null;
let visitingCardPreviewUrl = "";
function ensureVisitingCardOcr() {
  if (window.Tesseract?.recognize) return Promise.resolve(window.Tesseract);
  if (visitingCardOcrLoader) return visitingCardOcrLoader;
  visitingCardOcrLoader = new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src =
      "https://cdn.jsdelivr.net/npm/tesseract.js@5.1.1/dist/tesseract.min.js";
    script.async = true;
    script.onload = () =>
      window.Tesseract?.recognize
        ? resolve(window.Tesseract)
        : reject(new Error("Text scanner did not initialise."));
    script.onerror = () => reject(new Error("Text scanner could not load."));
    document.head.appendChild(script);
  });
  return visitingCardOcrLoader;
}
function setVisitingCardScanStatus(title, message) {
  const result = document.getElementById("visitingCardScanResult");
  const heading = document.getElementById("visitingCardScanTitle");
  const status = document.getElementById("visitingCardScanStatus");
  result?.classList.remove("hidden");
  if (heading) heading.textContent = title;
  if (status) status.textContent = message;
}
function normaliseScannedUrl(value) {
  const url = String(value || "").trim().replace(/[),.;]+$/, "");
  if (!url) return "";
  return /^https?:\/\//i.test(url) ? url : "https://" + url;
}
function applyScannedBusinessCardText(rawText) {
  const lines = String(rawText || "")
    .split(/\r?\n/)
    .map((line) => line.replace(/\s+/g, " ").trim())
    .filter((line) => line.length > 1);
  const joined = lines.join("\n");
  const email = joined.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i)?.[0] || "";
  const phoneMatches = [
    ...new Set(
      (joined.match(/(?:\+?\d[\d\s().-]{8,}\d)/g) || [])
        .map((value) => value.trim())
        .filter((value) => cleanNumber(value).length >= 10),
    ),
  ];
  const urls = joined.match(/(?:https?:\/\/|www\.)[^\s]+/gi) || [];
  const socialLine =
    lines.find((line) => /instagram|facebook|linkedin/i.test(line)) || "";
  const instagramHandle = joined.match(/@[a-z0-9._]{3,}/i)?.[0] || "";
  const excluded = (line) =>
    /@|https?:|www\.|\+?\d[\d\s().-]{8,}\d|email|phone|mobile|website/i.test(
      line,
    );
  const identityLines = lines.filter(
    (line) => !excluded(line) && /[a-z]{3}/i.test(line) && line.length <= 70,
  );
  const businessLine =
    identityLines.find((line) =>
      /services|solutions|studio|store|cafe|restaurant|enterprises|associates|company|pvt|ltd|llp|traders|catering|interiors/i.test(
        line,
      ),
    ) || identityLines[0] || "";
  const personLine =
    identityLines.find(
      (line) =>
        line !== businessLine &&
        !/address|road|street|nagar|colony|india|telangana|hyderabad/i.test(
          line,
        ),
    ) || "";
  const addressLines = lines.filter((line) =>
    /road|street|lane|nagar|colony|sector|plot|floor|hyderabad|telangana|india|\b\d{6}\b/i.test(
      line,
    ),
  );
  const categoryRules = [
    ["Catering", /cater|food|restaurant|cafe/i],
    ["Interior Design", /interior|decor/i],
    ["Plumbing", /plumb|pipe/i],
    ["Electrical", /electric/i],
    ["Photography", /photo|studio/i],
    ["Digital Marketing", /marketing|advertis/i],
    ["Website Development", /web|software|technology|digital solution/i],
    ["Event Management", /event/i],
  ];
  const category = categoryRules.find(([, rule]) => rule.test(joined))?.[0];
  const website = urls.find((url) => !/instagram|facebook|linkedin/i.test(url));
  const socialUrl =
    urls.find((url) => /instagram|facebook|linkedin/i.test(url)) ||
    (/instagram/i.test(socialLine) && instagramHandle
      ? `https://instagram.com/${instagramHandle.slice(1)}`
      : "");
  const setValue = (id, value) => {
    const element = document.getElementById(id);
    if (element && value) element.value = value;
  };
  setValue("postTitle", businessLine);
  setValue("postName", personLine);
  setValue("postPhone", phoneMatches[0]);
  setValue("postWhatsapp", phoneMatches[0]);
  setValue("postAltPhone", phoneMatches[1]);
  setValue("postEmail", email);
  setValue("postWebsiteUrl", normaliseScannedUrl(website));
  setValue("postSocialUrl", normaliseScannedUrl(socialUrl));
  setValue("postFullAddress", addressLines.join(", "));
  setValue("postCategory", category || "Other");
  return [
    businessLine && "business name",
    phoneMatches[0] && "phone",
    email && "email",
    (website || socialUrl) && "web profile",
    addressLines.length && "address",
  ].filter(Boolean);
}
async function scanBusinessVisitingCard(file) {
  if (!file) return;
  if (!/^image\/(jpeg|png|webp)$/i.test(file.type || "")) {
    setVisitingCardScanStatus(
      "Unsupported photo",
      "Choose a JPG, PNG or WebP visiting-card image.",
    );
    return;
  }
  if (file.size > 12 * 1024 * 1024) {
    setVisitingCardScanStatus(
      "Photo is too large",
      "Choose an image smaller than 12 MB.",
    );
    return;
  }
  if (visitingCardPreviewUrl) URL.revokeObjectURL(visitingCardPreviewUrl);
  visitingCardPreviewUrl = URL.createObjectURL(file);
  const preview = document.getElementById("visitingCardPreview");
  if (preview) preview.src = visitingCardPreviewUrl;
  setVisitingCardScanStatus(
    "Reading visiting card…",
    "Loading private in-browser text recognition.",
  );
  try {
    const tesseract = await ensureVisitingCardOcr();
    const result = await tesseract.recognize(file, "eng", {
      logger: (event) => {
        if (event?.status === "recognizing text") {
          const percent = Math.round(Number(event.progress || 0) * 100);
          setVisitingCardScanStatus(
            "Reading visiting card…",
            `Recognising text ${percent}%`,
          );
        }
      },
    });
    const filled = applyScannedBusinessCardText(result?.data?.text || "");
    if (!filled.length)
      throw new Error("No clear business details were detected.");
    setVisitingCardScanStatus(
      "Business details filled",
      `Detected ${filled.join(", ")}. Review the fields, add any missing details and publish your card.`,
    );
  } catch (error) {
    setVisitingCardScanStatus(
      "Card could not be read",
      `${error?.message || "Text recognition failed."} You can still complete the fields manually.`,
    );
  }
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
    websiteUrl = document.getElementById("postWebsiteUrl")?.value.trim() || "",
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
  if (type === "business" && !fullAddress) missing.push("full address");
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
    fullAddress:
      fullAddress || [area, district, state].filter(Boolean).join(", "),
    price,
    image,
    name,
    whatsapp,
    email,
    phone,
    altPhone,
    websiteUrl,
    socialUrl,
    isNational,
    created: Date.now(),
    userId:
      window.G58SiteUser?.id || window.G58AnonymousPublisherId || "",
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
  else {
    const business = {
      ...base,
      experience: Number(document.getElementById("postExperience").value) || 0,
      projects: Number(document.getElementById("postProjects").value) || 0,
      lastPopupOpenedAt: 0,
      popupRetentionStartedAt: Date.now(),
      popupExpiresAt: Date.now() + BUSINESS_POPUP_RETENTION,
    };
    businesses.unshift(business);
    sessionStorage.setItem(`g58BusinessOwner_${id}`, "true");
  }
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
  document
    .getElementById("contentArea")
    ?.classList.toggle("g58-mode-business", activeMode === "business");
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
      if (el) {
        el.value = "";
        el.readOnly = false;
      }
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
  const ownedBusiness = ownedBusinessForBid();
  if (!ownedBusiness) {
    alert(
      "Create or unlock your GRAVITY58 Business Card before submitting a bid.",
    );
    openBusinessCardCreator();
    return;
  }

  hideFloatingCustomer();
  const floatingBusiness = document.getElementById("floatingBusinessWrap");
  if (floatingBusiness) floatingBusiness.classList.remove("show");
  closeRequirementDetail();

  resetBidForm();
  document.getElementById("bidPostId").value = id;
  const bidModal = document.getElementById("bidModal");
  if (bidModal) bidModal.dataset.businessId = ownedBusiness.id;
  const businessInput = document.getElementById("bidBusiness");
  if (businessInput) {
    businessInput.value = ownedBusiness.title || "";
    businessInput.readOnly = true;
  }
  const whatsappInput = document.getElementById("bidWhatsapp");
  if (whatsappInput) {
    whatsappInput.value = ownedBusiness.whatsapp || ownedBusiness.phone || "";
    whatsappInput.readOnly = true;
  }
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
  setTimeout(() => document.getElementById("bidAmount")?.focus(), 100);
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
    businessId: document.getElementById("bidModal")?.dataset.businessId || "",
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
function openMyBusinessCard() {
  const user = window.G58SiteUser;
  if (!user) return window.G58RequestAuth?.("business");
  const mine = businesses.filter(
    (x) =>
      x.userId === user.id ||
      normalize(x.accountEmail) === normalize(user.email),
  );
  if (mine.length) {
    showFloatingBusiness(mine[0].id);
  } else {
    openBusinessCardCreator();
  }
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
function openG58ContactModal() {
  document.getElementById("g58ContactModal")?.classList.add("open");
}
function closeG58ContactModal() {
  document.getElementById("g58ContactModal")?.classList.remove("open");
}
document.addEventListener("DOMContentLoaded", () => {
  document
    .getElementById("g58ContactCancel")
    ?.addEventListener("click", closeG58ContactModal);
  document
    .getElementById("g58ContactForm")
    ?.addEventListener("submit", async (event) => {
      event.preventDefault();
      const api = window.Gravity58Ads;
      const button = document.getElementById("g58ContactSubmit");
      const name = document.getElementById("g58ContactName").value.trim();
      const phone = document.getElementById("g58ContactPhone").value.trim();
      const interest = document.getElementById("g58ContactInterest").value;
      if (!name || !phone || !interest) return;
      if (!api?.configured) {
        alert("Contact service is temporarily unavailable. Please try again shortly.");
        return;
      }
      button.disabled = true;
      button.textContent = "Sending…";
      try {
        const user = await api.ensureUser();
        if (!user) throw new Error("Could not start a secure session.");
        const Role = window.Appwrite.Role, Permission = window.Appwrite.Permission;
        const permissions = [
          Permission.read(Role.users()),
          Permission.update(Role.users()),
          Permission.delete(Role.users()),
        ];
        await api.create(
          "g58_contact_requests",
          { name, phone, interest, createdAt: new Date().toISOString() },
          undefined,
          permissions,
        );
        closeG58ContactModal();
        document.getElementById("g58ContactForm").reset();
        alert("Thanks! Your message has been sent to the G58 team.");
      } catch (error) {
        alert(error.message || "Could not send your message. Please try again.");
      } finally {
        button.disabled = false;
        button.textContent = "Send";
      }
    });
});

let pendingCardUnlock = null;
function requestBusinessCardUnlock(id) {
  requestCardUnlock("business", id, { checked: true });
}
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
