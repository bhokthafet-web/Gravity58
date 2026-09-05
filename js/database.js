(() => {
  "use strict";
  const ads = window.Gravity58Ads;
  const localKey = "g58PublicAdvertisementState";
  let remoteRows = new Map();
  const parse = (value, fallback = []) => {
    try { return Array.isArray(value) ? value : JSON.parse(value || "[]"); }
    catch { return fallback; }
  };
  const parsePost = (row) => {
    try { return typeof row.payload === "string" ? JSON.parse(row.payload) : row.payload; }
    catch { return null; }
  };
  const localLoad = () => {
    try { return JSON.parse(localStorage.getItem(localKey) || "null"); }
    catch { return null; }
  };
  async function loadState() {
    if (!ads?.configured) return localLoad();
    try {
      const rows = await ads.list("posts");
      const legacy = rows.find((row) => row.recordKey === "global" && (row.customers || row.businesses));
      if (legacy) return { customers: parse(legacy.customers), businesses: parse(legacy.businesses) };
      remoteRows = new Map(rows.map((row) => [String(row.recordKey || row.id), row]));
      const customers = []; const businesses = [];
      rows.forEach((row) => {
        const post = parsePost(row); if (!post) return;
        post.userId ||= row.userId || "";
        (row.postType === "business" ? businesses : customers).push(post);
      });
      return { customers, businesses };
    } catch (error) {
      console.error("[G58 Core] Could not load posts", error);
      return localLoad();
    }
  }
  async function saveState(state) {
    const customers = Array.isArray(state.customers) ? state.customers : [];
    const businesses = Array.isArray(state.businesses) ? state.businesses : [];
    localStorage.setItem(localKey, JSON.stringify({ customers, businesses }));
    if (!ads?.configured) return;
    const user = await ads.currentUser();
    if (!user) return;
    if (!remoteRows.size) await loadState();
    const desired = [...customers.map((post) => ({ post, postType: "customer" })), ...businesses.map((post) => ({ post, postType: "business" }))];
    for (const { post, postType } of desired) {
      const recordKey = String(post.id); const existing = remoteRows.get(recordKey);
      const ownerId = post.userId || existing?.userId || user.$id;
      const payload = { recordKey, postType, userId: ownerId, payload: JSON.stringify({ ...post, userId: ownerId }), updatedAt: new Date().toISOString() };
      if (!existing) {
        if (ownerId !== user.$id) continue;
        const rowId = recordKey.replace(/[^a-zA-Z0-9._-]/g, "-").slice(0, 36);
        const created = await ads.create("posts", payload, rowId);
        remoteRows.set(recordKey, created);
      } else if (existing.userId === user.$id && existing.payload !== payload.payload) {
        const updated = await ads.update("posts", existing.id, payload);
        remoteRows.set(recordKey, updated);
      }
    }
    const desiredIds = new Set(desired.map(({ post }) => String(post.id)));
    for (const [recordKey, row] of [...remoteRows]) {
      if (row.userId === user.$id && !desiredIds.has(recordKey)) {
        await ads.remove("posts", row.id); remoteRows.delete(recordKey);
      }
    }
  }
  function subscribe(onChange) {
    const handler = async (event) => {
      if (event?.detail?.kind && event.detail.kind !== "posts") return;
      const state = await loadState(); if (state) onChange?.(state);
    };
    window.addEventListener("g58-ad-data-changed", handler);
    window.addEventListener("storage", handler);
    return () => { window.removeEventListener("g58-ad-data-changed", handler); window.removeEventListener("storage", handler); };
  }
  window.Gravity58DB = Object.freeze({ client: ads, loadState, saveState, subscribe, setStatus: () => {} });
})();
