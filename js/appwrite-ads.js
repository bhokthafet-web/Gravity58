(() => {
  "use strict";

  const rootConfig = window.GRAVITY58_CONFIG || window.GRAVITY58_AD_BOOKING_CONFIG || window.GRAVITY58_AD_ADMIN_CONFIG || {};
  const config = rootConfig.appwrite || {};
  const collections = config.collections || {
    advertisements: config.advertisementsCollectionId || "advertisements",
    bookings: config.bookingsCollectionId || "ad_bookings",
    profiles: config.profilesCollectionId || "ad_customer_profiles",
    slots: config.restaurantsCollectionId || "ad_slots",
    posts: config.postsCollectionId || "g58_posts",
  };
  const sharedTableId = config.sharedTableId || "";
  const tableIdFor = (kind) => sharedTableId || collections[kind];
  const configured = Boolean(window.Appwrite && config.endpoint && config.projectId && config.databaseId && !String(config.projectId).includes("YOUR_"));
  const fallbackKey = "gravity58AdvertisementData";
  const localRead = () => {
    try { return JSON.parse(localStorage.getItem(fallbackKey) || "{}") || {}; }
    catch { return {}; }
  };
  const localWrite = (data) => localStorage.setItem(fallbackKey, JSON.stringify(data));
  const clean = (row) => {
    if (!row) return row;
    let payload = {};
    if (typeof row.payload === "string") {
      try { payload = JSON.parse(row.payload) || {}; }
      catch { payload = {}; }
    } else if (row.payload && typeof row.payload === "object") payload = row.payload;
    const result = { ...row, ...payload };
    result.id ||= result.$id;
    return result;
  };
  const encodeData = (data) => Object.fromEntries(Object.entries(data).filter(([, value]) => value !== undefined));
  function permissionSet(kind, userId) {
    if (!configured || !Appwrite.Permission || !Appwrite.Role) return undefined;
    const permissions = [];
    const readAny = ["advertisements", "slots", "posts"].includes(kind);
    if (readAny) permissions.push(Appwrite.Permission.read(Appwrite.Role.any()));
    if (userId) {
      const role = Appwrite.Role.user(userId);
      permissions.push(Appwrite.Permission.read(role), Appwrite.Permission.update(role), Appwrite.Permission.delete(role));
    }
    if (config.adminTeamId && !String(config.adminTeamId).includes("YOUR_")) {
      const team = Appwrite.Role.team(config.adminTeamId);
      permissions.push(Appwrite.Permission.read(team), Appwrite.Permission.update(team), Appwrite.Permission.delete(team));
    }
    return [...new Set(permissions)];
  }

  let client = null;
  let account = null;
  let databases = null;
  let tables = null;
  let teams = null;
  if (configured) {
    client = new Appwrite.Client().setEndpoint(config.endpoint).setProject(config.projectId);
    account = new Appwrite.Account(client);
    if (Appwrite.TablesDB) tables = new Appwrite.TablesDB(client);
    if (Appwrite.Databases) databases = new Appwrite.Databases(client);
    teams = new Appwrite.Teams(client);
  }

  async function list(kind, filters = {}) {
    if (!configured) {
      let rows = localRead()[kind] || [];
      Object.entries(filters).forEach(([key, value]) => { if (value !== undefined && value !== "") rows = rows.filter((row) => row[key] === value); });
      return rows.map(clean);
    }
    const queries = [Appwrite.Query.limit(100), Appwrite.Query.orderDesc("$createdAt")];
    if (sharedTableId) queries.push(Appwrite.Query.equal("kind", kind));
    else Object.entries(filters).forEach(([key, value]) => { if (value !== undefined && value !== "") queries.push(Appwrite.Query.equal(key, value)); });
    let rows;
    if (tables) {
      const response = await tables.listRows({ databaseId: config.databaseId, tableId: tableIdFor(kind), queries });
      rows = response.rows.map(clean);
    } else {
      const response = await databases.listDocuments({ databaseId: config.databaseId, collectionId: tableIdFor(kind), queries });
      rows = response.documents.map(clean);
    }
    Object.entries(filters).forEach(([key, value]) => { if (value !== undefined && value !== "") rows = rows.filter((row) => row[key] === value); });
    return rows;
  }

  async function create(kind, data, documentId, permissions) {
    if (!configured) {
      const store = localRead();
      const row = { id: documentId || `${kind}_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`, ...encodeData(data), $createdAt: new Date().toISOString(), $updatedAt: new Date().toISOString() };
      store[kind] ||= [];
      store[kind].unshift(row);
      localWrite(store);
      window.dispatchEvent(new CustomEvent("g58-ad-data-changed", { detail: { kind, row } }));
      return row;
    }
    if (!permissions) permissions = permissionSet(kind, (await currentUser())?.$id);
    const rowData = sharedTableId ? { kind, payload: JSON.stringify(encodeData(data)) } : encodeData(data);
    if (tables) return clean(await tables.createRow({ databaseId: config.databaseId, tableId: tableIdFor(kind), rowId: documentId || Appwrite.ID.unique(), data: rowData, permissions }));
    return clean(await databases.createDocument({ databaseId: config.databaseId, collectionId: tableIdFor(kind), documentId: documentId || Appwrite.ID.unique(), data: rowData, permissions }));
  }

  async function update(kind, documentId, data) {
    if (!configured) {
      const store = localRead();
      const row = (store[kind] || []).find((item) => (item.id || item.$id) === documentId);
      if (!row) throw new Error("Record not found");
      Object.assign(row, encodeData(data), { $updatedAt: new Date().toISOString() });
      localWrite(store);
      window.dispatchEvent(new CustomEvent("g58-ad-data-changed", { detail: { kind, row } }));
      return row;
    }
    let rowData = encodeData(data);
    if (sharedTableId) {
      const previous = tables
        ? await tables.getRow({ databaseId: config.databaseId, tableId: tableIdFor(kind), rowId: documentId })
        : await databases.getDocument({ databaseId: config.databaseId, collectionId: tableIdFor(kind), documentId });
      let previousPayload = {};
      try { previousPayload = JSON.parse(previous.payload || "{}") || {}; } catch {}
      rowData = { payload: JSON.stringify({ ...previousPayload, ...rowData }) };
    }
    if (tables) return clean(await tables.updateRow({ databaseId: config.databaseId, tableId: tableIdFor(kind), rowId: documentId, data: rowData }));
    return clean(await databases.updateDocument({ databaseId: config.databaseId, collectionId: tableIdFor(kind), documentId, data: rowData }));
  }

  async function remove(kind, documentId) {
    if (!configured) {
      const store = localRead();
      store[kind] = (store[kind] || []).filter((item) => (item.id || item.$id) !== documentId);
      localWrite(store);
      window.dispatchEvent(new CustomEvent("g58-ad-data-changed", { detail: { kind, documentId } }));
      return true;
    }
    if (tables) await tables.deleteRow({ databaseId: config.databaseId, tableId: tableIdFor(kind), rowId: documentId });
    else await databases.deleteDocument({ databaseId: config.databaseId, collectionId: tableIdFor(kind), documentId });
    return true;
  }

  async function upsertSlot(slot) {
    const slotId = String(slot.id || slot.restaurantKey || "slot").replace(/[^a-zA-Z0-9._-]/g, "-").slice(0, 36);
    const payload = { restaurantKey: slot.restaurantKey, name: slot.name, city: slot.city, active: slot.active !== false };
    if (!configured) {
      const matches = await list("slots", { restaurantKey: slot.restaurantKey });
      return matches[0] ? update("slots", matches[0].id, payload) : create("slots", payload, slotId);
    }
    let current = await currentUser();
    if (!current) {
      try { await account.createAnonymousSession(); current = await currentUser(); }
      catch {}
    }
    try { return await create("slots", payload, slotId, permissionSet("slots", current?.$id)); }
    catch (error) { if (error?.code === 409) return update("slots", slotId, payload); throw error; }
  }

  async function register(email, password, name, phone = "") {
    if (!configured) throw new Error("Appwrite is not configured yet.");
    const user = await account.create({ userId: Appwrite.ID.unique(), email, password, name });
    await account.createEmailPasswordSession({ email, password });
    await create("profiles", { userId: user.$id, email, name, phone, accountType: "customer", state: "", district: "", blocked: false }, undefined, permissionSet("profiles", user.$id));
    return user;
  }
  const login = async (email, password) => configured ? account.createEmailPasswordSession({ email, password }) : Promise.reject(new Error("Appwrite is not configured yet."));
  const logout = async () => configured ? account.deleteSession({ sessionId: "current" }) : true;
  const currentUser = async () => { if (!configured) return null; try { return await account.get(); } catch { return null; } };
  const forgotPassword = async (email, url) => configured ? account.createRecovery({ email, url }) : Promise.reject(new Error("Appwrite is not configured yet."));
  const completeRecovery = async (userId, secret, password) => configured ? account.updateRecovery({ userId, secret, password }) : Promise.reject(new Error("Appwrite is not configured yet."));
  async function isTeamAdmin() {
    if (!configured || !config.adminTeamId) return false;
    try { await teams.get({ teamId: config.adminTeamId }); return true; }
    catch { return false; }
  }

  function subscribeAdvertisements(onChange) {
    if (!configured) {
      const handler = () => onChange?.();
      window.addEventListener("g58-ad-data-changed", handler);
      window.addEventListener("storage", handler);
      return () => { window.removeEventListener("g58-ad-data-changed", handler); window.removeEventListener("storage", handler); };
    }
    return client.subscribe(tables ? `databases.${config.databaseId}.tables.${tableIdFor("advertisements")}.rows` : `databases.${config.databaseId}.collections.${tableIdFor("advertisements")}.documents`, () => onChange?.());
  }

  window.Gravity58Ads = Object.freeze({
    configured, config, collections, client, account, databases, tables,
    list, create, update, remove, upsertSlot, permissionSet,
    register, login, logout, currentUser, forgotPassword, completeRecovery, isTeamAdmin,
    subscribeAdvertisements,
  });
})();
