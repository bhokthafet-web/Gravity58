(() => {
  "use strict";

  const runtimeConfig = window.GRAVITY58_CONFIG || window.GRAVITY58_AD_BOOKING_CONFIG || window.GRAVITY58_AD_ADMIN_CONFIG || {};
  const configuredEndpoint = runtimeConfig.g58?.endpoint || runtimeConfig.api?.endpoint || "";
  const local = /^(localhost|127\.0\.0\.1)$/i.test(location.hostname);
  const endpoint = String(configuredEndpoint || (local ? "http://localhost:8088/api/v1" : "https://server.g58.in/api/v1")).replace(/\/$/, "");
  const config = Object.freeze({
    endpoint,
    digitalOrderFunctionId: "g58-secure-actions",
    provider: "G58 Core",
  });
  const configured = runtimeConfig.testMode === true && !configuredEndpoint ? false : Boolean(endpoint);
  const collections = Object.freeze({
    advertisements: "advertisements",
    bookings: "bookings",
    profiles: "profiles",
    slots: "slots",
    posts: "posts",
  });

  const normalizeUser = (user) => user ? { ...user, $id: user.$id || user.id } : null;
  const normalizeRow = (row) => row ? { ...row, id: row.id || row.$id, $id: row.$id || row.id } : row;

  async function request(path, options = {}) {
    const headers = new Headers(options.headers || {});
    const init = { ...options, headers, credentials: "include" };
    if (options.body && !(options.body instanceof FormData) && typeof options.body !== "string") {
      headers.set("content-type", "application/json");
      init.body = JSON.stringify(options.body);
    }
    const response = await fetch(`${endpoint}${path}`, init);
    const type = response.headers.get("content-type") || "";
    const data = type.includes("application/json") ? await response.json().catch(() => ({})) : await response.text();
    if (!response.ok) {
      const error = new Error(data?.error || data?.message || (typeof data === "string" && data) || `Request failed (${response.status})`);
      error.code = response.status;
      error.details = data?.details;
      throw error;
    }
    return data;
  }

  const permissionSet = (_kind, userId) => ({ participantIds: userId ? [userId] : [] });
  const userPermissionSet = (userIds = []) => ({ participantIds: [...new Set(userIds.filter(Boolean))] });
  const collaborativePermissionSet = (userId) => ({ participantIds: userId ? [userId] : [] });
  const managedPermissionSet = () => ({ participantIds: [] });

  async function list(kind, filters = {}) {
    const query = new URLSearchParams({ filters: JSON.stringify(filters || {}), limit: "1000" });
    const result = await request(`/records/${encodeURIComponent(kind)}?${query}`);
    return (result.rows || []).map(normalizeRow);
  }

  async function get(kind, id) {
    const result = await request(`/records/${encodeURIComponent(kind)}/${encodeURIComponent(id)}`);
    return normalizeRow(result.row);
  }

  async function create(kind, data, documentId, permissions) {
    const result = await request(`/records/${encodeURIComponent(kind)}`, {
      method: "POST",
      body: {
        id: documentId || undefined,
        data: data || {},
        participantIds: permissions?.participantIds || [],
      },
    });
    return normalizeRow(result.row);
  }

  async function update(kind, id, data, permissions) {
    const result = await request(`/records/${encodeURIComponent(kind)}/${encodeURIComponent(id)}`, {
      method: "PATCH",
      body: {
        data: data || {},
        participantIds: permissions?.participantIds,
      },
    });
    return normalizeRow(result.row);
  }

  async function remove(kind, id) {
    await request(`/records/${encodeURIComponent(kind)}/${encodeURIComponent(id)}`, { method: "DELETE" });
    return true;
  }

  async function upsertSlot(slot) {
    const slotId = String(slot.id || slot.restaurantKey || "slot").replace(/[^a-zA-Z0-9._-]/g, "-").slice(0, 80);
    const payload = { restaurantKey: slot.restaurantKey, name: slot.name, city: slot.city, active: slot.active !== false };
    try { return await create("slots", payload, slotId); }
    catch (error) { if (error.code === 409) return update("slots", slotId, payload); throw error; }
  }

  async function register(email, password, name, phone = "") {
    const result = await request("/auth/register", { method: "POST", body: { email, password, name, phone } });
    return normalizeUser(result.user);
  }

  async function login(email, password) {
    const result = await request("/auth/login", { method: "POST", body: { email, password } });
    return normalizeUser(result.user);
  }

  async function logout() {
    await request("/auth/logout", { method: "POST" });
    return true;
  }

  async function currentUser() {
    try {
      const result = await request("/auth/me");
      return normalizeUser(result.user);
    } catch (error) {
      if (error.code === 401) return null;
      throw error;
    }
  }

  async function ensureUser() {
    const existing = await currentUser();
    if (existing) return existing;
    const result = await request("/auth/guest", { method: "POST" });
    return normalizeUser(result.user);
  }

  function recoveryUrl() {
    return "https://g58.in/reset-password/";
  }

  async function forgotPassword(email) {
    return request("/auth/forgot-password", { method: "POST", body: { email, url: recoveryUrl() } });
  }

  async function completeRecovery(_userId, secret, password) {
    const params = new URLSearchParams(location.search);
    const token = params.get("token") || secret;
    return request("/auth/reset-password", { method: "POST", body: { token, password } });
  }

  async function createJWT() {
    const user = await currentUser();
    if (!user) throw new Error("Sign in required");
    return "g58-first-party-session";
  }

  function validateMediaFile(file, purpose = "advertisement") {
    if (!file?.size) throw new Error(`Select a ${purpose} file first.`);
    const allowed = ["image/jpeg", "image/png", "image/webp", "image/gif", "video/mp4", "video/webm"];
    if (!allowed.includes(file.type)) throw new Error("Use JPG, PNG, WebP, GIF, MP4 or WebM media.");
    if (file.size > 15 * 1024 * 1024) throw new Error("Media must be below 15 MB.");
  }

  function validateMenuImage(file) {
    if (!file?.size) throw new Error("Select a restaurant or menu image first.");
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) throw new Error("Use a JPG, PNG or WebP image.");
    if (file.size > 100 * 1024) throw new Error("Restaurant and menu images must be 100 KB or smaller. Use the Menu Image Compressor first.");
  }

  async function uploadMedia(file, purpose) {
    const form = new FormData();
    form.append("purpose", purpose);
    form.append("file", file, file.name);
    const result = await request("/media", { method: "POST", body: form });
    const saved = result.file || {};
    return {
      fileId: saved.fileId || saved.id,
      path: saved.fileId || saved.id,
      mediaUrl: saved.mediaUrl,
      mediaType: saved.mediaType || file.type,
      mediaName: saved.mediaName || file.name,
    };
  }

  function localMedia(file, purpose) {
    return {
      fileId: `local-${purpose}-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
      path: "",
      mediaUrl: URL.createObjectURL(file),
      mediaType: file.type,
      mediaName: file.name,
    };
  }

  async function uploadAdMedia(file) {
    validateMediaFile(file);
    if (!configured) return localMedia(file, "advertisement");
    if (!await currentUser()) throw new Error("Login before uploading advertisement media.");
    return uploadMedia(file, "advertisement");
  }

  async function uploadPaymentReceipt(file) {
    validateMediaFile(file, "payment receipt");
    if (!configured) return localMedia(file, "payment-receipt");
    await ensureUser();
    return uploadMedia(file, "payment-receipt");
  }

  async function uploadStayIdentity(file) {
    if (!file?.size) throw new Error("Choose a guest identity image first.");
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) throw new Error("Use a JPG, PNG or WebP identity image.");
    if (file.size > 5 * 1024 * 1024) throw new Error("Guest identity image must be below 5 MB.");
    if (!configured) return localMedia(file, "stay-identity");
    await ensureUser();
    return uploadMedia(file, "stay-identity");
  }

  async function uploadMenuMedia(file) {
    validateMenuImage(file);
    if (!configured) return localMedia(file, "menu");
    if (!await currentUser()) throw new Error("Login before uploading restaurant or menu images.");
    return uploadMedia(file, "menu");
  }

  async function removeAdMedia(fileId) {
    if (!fileId) return true;
    if (!configured || String(fileId).startsWith("local-")) return true;
    await request(`/media/${encodeURIComponent(fileId)}`, { method: "DELETE" });
    return true;
  }
  const removeMenuMedia = removeAdMedia;

  async function executeFunction(_functionId, data) {
    return request("/actions", { method: "POST", body: data || {} });
  }

  async function isTeamAdmin() {
    const user = await currentUser();
    return ["admin", "super_admin"].includes(user?.role);
  }

  function subscribeKind(kind, onChange) {
    const source = new EventSource(`${endpoint}/events?kinds=${encodeURIComponent(kind)}`, { withCredentials: true });
    const handler = (event) => {
      try {
        const payload = JSON.parse(event.data || "{}");
        onChange?.(normalizeRow(payload.row), payload);
      } catch (error) {
        console.warn("G58 live update could not be read", error);
      }
    };
    source.addEventListener("record", handler);
    source.onerror = () => {};
    return () => source.close();
  }

  const subscribeAdvertisements = (onChange) => subscribeKind("advertisements", onChange);

  window.Gravity58Ads = Object.freeze({
    configured, config, collections,
    client: null, account: null, databases: null, tables: null, storage: null, functions: null, mediaBucketId: "g58-media",
    list, get, create, update, remove, upsertSlot,
    permissionSet, userPermissionSet, collaborativePermissionSet, managedPermissionSet,
    register, login, logout, currentUser, ensureUser, forgotPassword, completeRecovery, createJWT, isTeamAdmin,
    validateMediaFile, uploadAdMedia, uploadPaymentReceipt, uploadStayIdentity, removeAdMedia,
    validateMenuImage, uploadMenuMedia, removeMenuMedia, executeFunction,
    subscribeAdvertisements, subscribeKind,
  });
})();
