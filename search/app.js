(() => {
  "use strict";
  const filterAll = document.getElementById("filterAll");
  const filterMenu = document.getElementById("filterMenu");
  const filterRefills = document.getElementById("filterRefills");
  const searchForm = document.getElementById("searchForm");
  const searchInput = document.getElementById("searchInput");
  const resultsEl = document.getElementById("searchResults");
  const statusEl = document.getElementById("searchStatus");

  let listings = [];
  let loaded = false;

  function normalize(v) {
    return String(v || "").toLowerCase().trim();
  }

  function escapeHtml(value) {
    return String(value ?? "").replace(/[&<>"']/g, (ch) => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;",
    }[ch]));
  }

  function badgeLabel(source) {
    return source === "menu" ? "Digital Menu" : "Refills";
  }

  function cardHtml(row) {
    return `<a class="g58-search-card" href="${escapeHtml(row.url)}">
<span class="g58-search-card-badge ${row.source === "menu" ? "menu" : "refills"}">${badgeLabel(row.source)}</span>
<h3>${escapeHtml(row.name)}</h3>
<p>${escapeHtml(row.category)}${row.city ? " · " + escapeHtml(row.city) : ""}</p>
<span class="g58-search-card-open">Open store →</span>
</a>`;
  }

  function render() {
    if (!loaded) {
      statusEl.textContent = "Loading stores…";
      resultsEl.innerHTML = "";
      return;
    }
    const q = normalize(searchInput.value);
    const wantAll = filterAll.checked;
    const wantMenu = wantAll || filterMenu.checked;
    const wantRefills = wantAll || filterRefills.checked;
    const filtered = listings.filter((row) => {
      if (row.source === "menu" && !wantMenu) return false;
      if (row.source === "refills" && !wantRefills) return false;
      if (!q) return true;
      return normalize(`${row.name} ${row.category} ${row.city}`).includes(q);
    });
    statusEl.textContent = filtered.length
      ? `${filtered.length} store${filtered.length === 1 ? "" : "s"} found`
      : "";
    resultsEl.innerHTML = filtered.length
      ? filtered.map(cardHtml).join("")
      : `<div class="g58-search-empty">${
          listings.length
            ? "No stores match your search."
            : 'No stores are listed yet. Store owners can enable "List my store in G58 Search" from their Digital Menu or Refills settings.'
        }</div>`;
  }

  async function loadListings() {
    try {
      const rows = await window.Gravity58Ads.list("directory");
      listings = rows.filter((row) => row && row.url && row.name);
    } catch (error) {
      console.error("[G58 Search] Could not load store directory", error);
      listings = [];
    }
    loaded = true;
    render();
  }

  filterAll.addEventListener("change", () => {
    if (filterAll.checked) {
      filterMenu.checked = false;
      filterRefills.checked = false;
    }
    render();
  });
  [filterMenu, filterRefills].forEach((el) =>
    el.addEventListener("change", () => {
      if (el.checked) filterAll.checked = false;
      if (!filterMenu.checked && !filterRefills.checked) filterAll.checked = true;
      render();
    }),
  );
  searchForm.addEventListener("submit", (event) => {
    event.preventDefault();
    render();
  });
  searchInput.addEventListener("input", () => render());

  loadListings();
})();
