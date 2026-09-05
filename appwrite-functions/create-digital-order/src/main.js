import webpush from 'web-push';
import { initializeApp as initializeFirebaseApp, getApps as getFirebaseApps, cert as firebaseCert } from 'firebase-admin/app';
import { getMessaging } from 'firebase-admin/messaging';
import { createHash } from 'crypto';

const DATABASE_ID = 'gravity58';
const TABLE_ID = 'g58_records';
const MEDIA_BUCKET_ID = 'ad-media';
const MENU_KIND_PREFIX = 'digital_menu_';
const ORDER_KIND_PREFIX = 'digital_order_';
const TOKEN_KIND_PREFIX = 'digital_token_';
const SUBSCRIPTION_KIND_PREFIX = 'digital_subscription_';
const DIGIT58_CUSTOMER_KIND_PREFIX = 'digit58_customer_';
const DIGIT58_CARD_KIND_PREFIX = 'digit58_card_';
const DIGIT58_ORDER_KIND_PREFIX = 'digit58_order_';
const DIGIT58_STORE_KIND_PREFIX = 'digit58_store_';
const DIGIT58_PROMOTION_KIND_PREFIX = 'digit58_promo_';
const DIGIT58_COURSE_KIND_PREFIX = 'digit58_course_';
const DIGIT58_PUSH_KIND_PREFIX = 'digit58_push_';
const DIGIT58_FCM_KIND_PREFIX = 'digit58_fcm_';
const VAPID_PUBLIC_KEY = 'BBWHhjt1keQag3HnZIooxS1pJvelQ8CuQ6eWBxFp9AStQLDpTzZqwKHmwj_gomaCpNBykqJRo6AsmfbC0roZoEY';
const DIGIT58_OWNER_KIND = 'digit58_owners';
const DIGIT58_ENTITLEMENT_KIND = 'digit58_entitlements';
const ADMIN_TEAM_ID = '6a776960001ca2fb66bf';
const SUPPORT_KIND = 'support_tickets';
const PUBLIC_POSTS_KIND = 'posts';
const BUSINESS_CARD_RETENTION_MS = 30 * 24 * 60 * 60 * 1000;
const HISTORY_RETENTION_MS = 365 * 24 * 60 * 60 * 1000;
const CUSTOMER_GRACE_MS = 30 * 24 * 60 * 60 * 1000;

const text = (value, max = 250) => String(value ?? '').trim().slice(0, max);
const finite = (value, fallback = 0) => Number.isFinite(Number(value)) ? Number(value) : fallback;
const normalisePhone = value => String(value || '').replace(/\D/g, '');
const indiaDay = (value = new Date()) => new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit',
}).format(new Date(value));
const safeKindId = (prefix, ownerId, maxOwnerLength) => `${prefix}${String(ownerId).replace(/[^a-zA-Z0-9._-]/g, '-').slice(0, maxOwnerLength)}`;
// Row IDs are capped at 36 chars by Appwrite, so pairing two full IDs (usually 20 chars each)
// needs a hash rather than truncated concatenation to stay under the limit without collisions.
const pairRowId = (prefix, a, b) => `${prefix}${createHash('sha1').update(`${a}:${b}`).digest('hex').slice(0, 32 - prefix.length)}`;
const orderKind = ownerId => safeKindId(ORDER_KIND_PREFIX, ownerId, 47);
const tokenKind = ownerId => safeKindId(TOKEN_KIND_PREFIX, ownerId, 47);
const menuKind = ownerId => safeKindId(MENU_KIND_PREFIX, ownerId, 48);
const subscriptionKind = ownerId => safeKindId(SUBSCRIPTION_KIND_PREFIX, ownerId, 43);
const digit58CustomerKind = ownerId => safeKindId(DIGIT58_CUSTOMER_KIND_PREFIX, ownerId, 36);
const digit58CardKind = ownerId => safeKindId(DIGIT58_CARD_KIND_PREFIX, ownerId, 40);
const digit58OrderKind = ownerId => safeKindId(DIGIT58_ORDER_KIND_PREFIX, ownerId, 40);
const digit58StoreKind = ownerId => safeKindId(DIGIT58_STORE_KIND_PREFIX, ownerId, 40);
const digit58PromotionKind = ownerId => safeKindId(DIGIT58_PROMOTION_KIND_PREFIX, ownerId, 40);
const digit58CourseKind = ownerId => safeKindId(DIGIT58_COURSE_KIND_PREFIX, ownerId, 39);
const digit58PushKind = ownerId => safeKindId(DIGIT58_PUSH_KIND_PREFIX, ownerId, 40);
const digit58FcmKind = ownerId => safeKindId(DIGIT58_FCM_KIND_PREFIX, ownerId, 40);
const DIGIT58_SERVICE_KIND_PREFIX = 'digit58_service_';
const DIGIT58_EXPERT_KIND_PREFIX = 'digit58_expert_';
const DIGIT58_BOOKING_KIND_PREFIX = 'digit58_booking_';
const digit58ServiceKind = ownerId => safeKindId(DIGIT58_SERVICE_KIND_PREFIX, ownerId, 38);
const digit58ExpertKind = ownerId => safeKindId(DIGIT58_EXPERT_KIND_PREFIX, ownerId, 38);
const digit58BookingKind = ownerId => safeKindId(DIGIT58_BOOKING_KIND_PREFIX, ownerId, 38);
const digit58EntitlementRowId = ownerId => `d58-${String(ownerId).slice(0, 30)}`;
const DIGIT58_PLAN_MONTHS = { '6m': 6, '1y': 12, '3y': 36 };
const DIGIT58_PLAN_DISCOUNT = { '6m': 0, '1y': 5, '3y': 10 };
const DIGIT58_PLAN_LABELS = { '6m': '6 Months', '1y': '1 Year', '3y': '3 Years' };
// Razorpay subscriptions require a finite total_count; these approximate
// "renews until cancelled" with a very long cycle horizon (10–20 renewals).
const DIGIT58_PLAN_TOTAL_COUNT = { '6m': 20, '1y': 10, '3y': 10 };
async function isDigit58Admin(call, userId) {
  try {
    const query = encodeURIComponent(JSON.stringify({ method: 'equal', attribute: 'userId', values: [userId] }));
    const result = await call(`/teams/${ADMIN_TEAM_ID}/memberships?queries[]=${query}`);
    return (result.memberships || result.teams || []).length > 0;
  } catch { return false; }
}
const formatToken = number => String(number).padStart(3, '0');
const cleanRow = row => {
  let payload = {};
  try { payload = JSON.parse(row?.payload || '{}') || {}; } catch {}
  return { ...row, ...payload, id: payload.id || row?.$id };
};

function appwriteClient(req) {
  const endpoint = process.env.APPWRITE_FUNCTION_API_ENDPOINT || 'https://server.g58.in/v1';
  const project = process.env.APPWRITE_FUNCTION_PROJECT_ID;
  const key = req.headers['x-appwrite-key'];
  if (!project || !key) throw new Error('Function service credentials are unavailable.');
  return async (path, options = {}) => {
    const response = await fetch(`${endpoint}${path}`, {
      ...options,
      headers: {
        'content-type': 'application/json',
        'x-appwrite-project': project,
        'x-appwrite-key': key,
        ...(options.headers || {}),
      },
    });
    const body = await response.text();
    let data = {};
    try { data = body ? JSON.parse(body) : {}; } catch { data = { message: body }; }
    if (!response.ok) {
      const error = new Error(data.message || `Appwrite request failed (${response.status})`);
      error.code = response.status;
      error.type = data.type;
      throw error;
    }
    return data;
  };
}

function parseMenu(row, ownerId, restaurantId, requireAccepting = true) {
  if (row?.kind !== menuKind(ownerId)) throw new Error('This restaurant menu is not owned by the selected restaurant account.');
  let payload;
  try { payload = JSON.parse(row.payload || '{}'); } catch { throw new Error('The restaurant menu data is invalid.'); }
  const restaurant = payload.restaurant?.id === restaurantId
    ? payload.restaurant
    : (payload.restaurants || []).find(item => item.id === restaurantId);
  if (!restaurant) throw new Error('This restaurant is no longer available.');
  if (requireAccepting && (restaurant.open === false || restaurant.accepting === false)) throw new Error('This restaurant is not accepting orders right now.');
  return { payload, restaurant };
}

function buildOrder(input, menu, userId, tokenNumber, tokenReservationId) {
  const restaurant = menu.restaurant;
  const availableItems = new Map((menu.payload.items || [])
    .filter(item => (!item.restaurantId || item.restaurantId === restaurant.id) && item.available !== false)
    .map(item => [String(item.id), item]));
  if (!Array.isArray(input.items) || input.items.length < 1 || input.items.length > 50) throw new Error('Add between 1 and 50 available items to the order.');
  const items = input.items.map(requested => {
    const configured = availableItems.get(String(requested.id));
    if (!configured) throw new Error(`${text(requested.name, 80) || 'A menu item'} is no longer available.`);
    const qty = Math.max(1, Math.min(99, Math.floor(finite(requested.qty, 1))));
    const price = Math.max(0, finite(configured.price));
    return {
      id: text(configured.id, 80), name: text(configured.name, 120), qty, price,
      prepareInstruction: text(requested.prepareInstruction, 250),
      prepareOptions: Array.isArray(requested.prepareOptions) ? requested.prepareOptions.map(option => text(option, 50)).filter(Boolean).slice(0, 5) : [],
      customPrepareNote: text(requested.customPrepareNote, 250),
    };
  });
  const subtotal = items.reduce((sum, item) => sum + item.price * item.qty, 0);
  const tax = Math.round(subtotal * Math.max(0, finite(restaurant.tax)) / 100 * 100) / 100;
  const serviceCharge = Math.round(subtotal * Math.max(0, finite(restaurant.service)) / 100 * 100) / 100;
  const total = Math.round((subtotal + tax + serviceCharge) * 100) / 100;
  const paymentMethod = input.paymentMethod === 'online' ? 'online' : 'counter';
  const phone = normalisePhone(input.phone);
  if (phone.length < 10 || phone.length > 15) throw new Error('Enter a valid customer phone number with 10 to 15 digits.');
  if (paymentMethod === 'online' && !restaurant.paymentEnabled) throw new Error('Online payment is not enabled for this restaurant.');
  if (paymentMethod === 'online' && !text(input.paymentReceiptFileId, 80)) throw new Error('Payment receipt image is required.');
  const scheduledFor = text(input.scheduledFor, 40);
  if (scheduledFor && (!Number.isFinite(new Date(scheduledFor).getTime()) || new Date(scheduledFor).getTime() < Date.now() + 4 * 60 * 1000)) throw new Error('Choose a valid schedule time at least 5 minutes from now.');
  const id = /^GR58-[a-zA-Z0-9._-]{4,30}$/.test(String(input.id || '')) ? String(input.id) : `GR58-${Date.now().toString(36).toUpperCase()}`.slice(0, 36);
  const createdAt = new Date().toISOString();
  return {
    id, restaurantId: restaurant.id, customer: text(input.customer, 160) || 'Guest',
    ownerId: text(input.cloudOwnerId || input.ownerId, 64), cloudOwnerId: text(input.cloudOwnerId || input.ownerId, 64),
    tokenNumber, tokenReservationId, orderDay: indiaDay(createdAt), messages: [],
    customerName: text(input.customerName, 120), serviceMode: input.serviceMode === 'table' ? 'table' : 'takeaway',
    tableNumber: text(input.tableNumber, 50), phone, items,
    subtotal, tax, serviceCharge, total, paymentMethod,
    upiId: paymentMethod === 'online' ? text(restaurant.upiId, 120) : '',
    paymentLink: paymentMethod === 'online' ? text(restaurant.paymentLink, 500) : '',
    transactionId: paymentMethod === 'online' ? text(input.transactionId, 100) : '',
    paymentStatus: paymentMethod === 'online' ? 'Awaiting confirmation' : 'Not required',
    paymentReceiptUrl: paymentMethod === 'online' ? text(input.paymentReceiptUrl, 1000) : '',
    paymentReceiptFileId: paymentMethod === 'online' ? text(input.paymentReceiptFileId, 80) : '',
    paymentReceiptName: paymentMethod === 'online' ? text(input.paymentReceiptName, 200) : '',
    paymentReceiptType: paymentMethod === 'online' ? text(input.paymentReceiptType, 100) : '',
    scheduledFor, customerAccountId: userId,
    customerEmail: text(input.customerEmail, 250),
    menuHash: text(input.menuHash, 500), menuRecordId: text(input.menuRecordId || restaurant.id, 64),
    status: paymentMethod === 'online' ? 'Payment Verification' : 'Pending', createdAt,
  };
}

function combineOrderItems(existingItems = [], incomingItems = []) {
  const merged = [];
  [...existingItems, ...incomingItems].forEach(item => {
    const key = [item.id || item.name, item.prepareInstruction || '', ...(item.prepareOptions || []), item.customPrepareNote || ''].join('|');
    const found = merged.find(row => row.key === key);
    if (found) found.item.qty = Math.min(99, found.item.qty + Math.max(1, Math.floor(finite(item.qty, 1))));
    else merged.push({ key, item: { ...item, qty: Math.max(1, Math.floor(finite(item.qty, 1))) } });
  });
  return merged.map(row => row.item).slice(0, 50);
}

function mergeOrder(existing, incoming, restaurant) {
  const items = combineOrderItems(existing.items, incoming.items);
  const subtotal = items.reduce((sum, item) => sum + finite(item.price) * finite(item.qty, 1), 0);
  const tax = Math.round(subtotal * Math.max(0, finite(restaurant.tax)) / 100 * 100) / 100;
  const serviceCharge = Math.round(subtotal * Math.max(0, finite(restaurant.service)) / 100 * 100) / 100;
  const onlineTopUp = incoming.paymentMethod === 'online';
  return {
    ...existing, items, subtotal, tax, serviceCharge,
    total: Math.round((subtotal + tax + serviceCharge) * 100) / 100,
    customer: incoming.customer, customerName: incoming.customerName, serviceMode: incoming.serviceMode,
    tableNumber: incoming.tableNumber, phone: incoming.phone, paymentMethod: incoming.paymentMethod,
    status: onlineTopUp ? 'Payment Verification' : 'Pending',
    paymentStatus: onlineTopUp ? 'Awaiting confirmation' : 'Not required',
    transactionId: onlineTopUp ? incoming.transactionId : existing.transactionId,
    upiId: onlineTopUp ? incoming.upiId : existing.upiId,
    paymentLink: onlineTopUp ? incoming.paymentLink : existing.paymentLink,
    paymentReceiptUrl: onlineTopUp ? incoming.paymentReceiptUrl : existing.paymentReceiptUrl,
    paymentReceiptFileId: onlineTopUp ? incoming.paymentReceiptFileId : existing.paymentReceiptFileId,
    paymentReceiptName: onlineTopUp ? incoming.paymentReceiptName : existing.paymentReceiptName,
    paymentReceiptType: onlineTopUp ? incoming.paymentReceiptType : existing.paymentReceiptType,
    menuHash: incoming.menuHash || existing.menuHash || '', menuRecordId: incoming.menuRecordId || existing.menuRecordId || incoming.restaurantId,
    lastItemsAddedAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
  };
}

function rowPermissionsFor(userIds) {
  return [...new Set([
    ...userIds.filter(Boolean).flatMap(id => [
      `read(\"user:${id}\")`, `update(\"user:${id}\")`, `delete(\"user:${id}\")`,
    ]),
    `read(\"team:${ADMIN_TEAM_ID}\")`,
  ])];
}
function rowPermissions(userId, ownerId) {
  return rowPermissionsFor([userId, ownerId]);
}

async function validateReceipt(call, input, userId) {
  if (input.paymentMethod !== 'online') return;
  const fileId = text(input.paymentReceiptFileId, 80);
  if (!fileId) throw new Error('Payment receipt image is required.');
  const file = await call(`/storage/buckets/${MEDIA_BUCKET_ID}/files/${encodeURIComponent(fileId)}`);
  const ownsFile = (file.$permissions || []).some(permission => permission.includes(`user:${userId}`));
  if (!ownsFile) throw new Error('The uploaded payment receipt does not belong to this customer session.');
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.mimeType)) throw new Error('Payment receipt must be a JPG, PNG or WebP image.');
  input.paymentReceiptName = text(file.name, 200);
  input.paymentReceiptType = file.mimeType;
  input.paymentReceiptUrl = `${process.env.APPWRITE_FUNCTION_API_ENDPOINT || 'https://server.g58.in/v1'}/storage/buckets/${MEDIA_BUCKET_ID}/files/${encodeURIComponent(fileId)}/view?project=${encodeURIComponent(process.env.APPWRITE_FUNCTION_PROJECT_ID)}`;
}

async function createRow(call, rowId, kind, payload, permissions) {
  return call(`/tablesdb/${DATABASE_ID}/tables/${TABLE_ID}/rows`, {
    method: 'POST', body: JSON.stringify({ rowId, data: { kind, payload: JSON.stringify(payload) }, permissions }),
  });
}

async function removeRow(call, rowId) {
  try { await call(`/tablesdb/${DATABASE_ID}/tables/${TABLE_ID}/rows/${encodeURIComponent(rowId)}`, { method: 'DELETE' }); }
  catch (error) { if (error.code !== 404) throw error; }
}

async function updateRow(call, rowId, payload) {
  const clean = { ...payload };
  ['$id', '$createdAt', '$updatedAt', '$permissions', '$databaseId', '$tableId', 'kind'].forEach(key => delete clean[key]);
  const saved = await call(`/tablesdb/${DATABASE_ID}/tables/${TABLE_ID}/rows/${encodeURIComponent(rowId)}`, {
    method: 'PATCH', body: JSON.stringify({ data: { payload: JSON.stringify(clean) } }),
  });
  return cleanRow(saved);
}

async function listRowsByKind(call, kind, limit = 500) {
  const queries = [
    JSON.stringify({ method: 'equal', attribute: 'kind', values: [kind] }),
    JSON.stringify({ method: 'limit', values: [limit] }),
  ];
  const queryString = queries.map(query => `queries[]=${encodeURIComponent(query)}`).join('&');
  const result = await call(`/tablesdb/${DATABASE_ID}/tables/${TABLE_ID}/rows?${queryString}`);
  return result.rows || result.documents || [];
}

async function listAllRows(call, pageSize = 100) {
  const rows = [];
  for (let offset = 0; offset < 10000; offset += pageSize) {
    const queries = [
      JSON.stringify({ method: 'limit', values: [pageSize] }),
      JSON.stringify({ method: 'offset', values: [offset] }),
    ];
    const queryString = queries.map(query => `queries[]=${encodeURIComponent(query)}`).join('&');
    const result = await call(`/tablesdb/${DATABASE_ID}/tables/${TABLE_ID}/rows?${queryString}`);
    const page = result.rows || result.documents || [];
    rows.push(...page);
    if (page.length < pageSize) break;
  }
  return rows;
}

function recordTime(record) {
  const value = record.deliveredAt || record.completedAt || record.cancelledAt || record.rejectedAt || record.expiredAt || record.updatedAt || record.createdAt || record.$updatedAt || record.$createdAt;
  const time = new Date(value || 0).getTime();
  return Number.isFinite(time) ? time : 0;
}

function closedHistoryRecord(kind, record) {
  const status = String(record.status || '').toLowerCase();
  if (kind.startsWith(ORDER_KIND_PREFIX)) return ['completed', 'rejected', 'payment rejected', 'cancelled'].includes(status);
  if (kind.startsWith(DIGIT58_ORDER_KIND_PREFIX)) return ['delivered', 'rejected', 'cancelled'].includes(status);
  if (kind.startsWith(DIGIT58_BOOKING_KIND_PREFIX)) return ['completed', 'cancelled', 'rejected'].includes(status);
  if (kind === 'bookings') return ['expired', 'rejected', 'cancelled', 'completed'].includes(status) || (record.expiresAt && new Date(record.expiresAt).getTime() <= Date.now());
  return false;
}

async function verifyCurrentPassword(req, call, userId, password) {
  const email = text(req.headers['x-appwrite-user-email'], 250).toLowerCase();
  if (!email || !password || String(password).length > 256) throw new Error('Enter the password for your signed-in G58 account.');
  const endpoint = process.env.APPWRITE_FUNCTION_API_ENDPOINT || 'https://server.g58.in/v1';
  const project = process.env.APPWRITE_FUNCTION_PROJECT_ID;
  const response = await fetch(`${endpoint}/account/sessions/email`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-appwrite-project': project },
    body: JSON.stringify({ email, password: String(password) }),
  });
  let session = {};
  try { session = JSON.parse(await response.text()); } catch {}
  if (!response.ok || session.userId !== userId) throw new Error('Password is incorrect. No data was deleted.');
  if (session.secret) {
    await fetch(`${endpoint}/account/sessions/current`, {
      method: 'DELETE',
      headers: { 'x-appwrite-project': project, 'x-appwrite-session': session.secret },
    }).catch(() => {});
  }
  return true;
}

async function deleteOwnerHistory(call, product, userId) {
  let deleted = 0;
  if (product === 'digital-menu') {
    const rows = await listRowsByKind(call, orderKind(userId));
    for (const row of rows) if (closedHistoryRecord(row.kind, cleanRow(row))) { await removeRow(call, row.$id); deleted += 1; }
  } else if (product === 'refills') {
    const kinds = [digit58OrderKind(userId), digit58BookingKind(userId)];
    for (const kind of kinds) for (const row of await listRowsByKind(call, kind)) {
      if (closedHistoryRecord(row.kind, cleanRow(row))) { await removeRow(call, row.$id); deleted += 1; }
    }
  } else if (product === 'service') {
    const rows = await listRowsByKind(call, 'bookings');
    for (const row of rows) {
      const record = cleanRow(row);
      if (record.customerId === userId && closedHistoryRecord(row.kind, record)) { await removeRow(call, row.$id); deleted += 1; }
    }
  } else if (product === 'pos') {
    const rows = await listRowsByKind(call, safeKindId('pos_workspace_', userId, 45));
    for (const row of rows) {
      const record = cleanRow(row);
      if (record.ownerId !== userId) continue;
      deleted += (record.bills || []).length + (record.cancelledBills || []).length;
      await updateRow(call, row.$id, { ...record, bills: [], cancelledBills: [], historyDeletedAt: new Date().toISOString() });
    }
  } else throw new Error('Choose a valid G58 product history.');
  return deleted;
}

async function collectOwnerHistory(call, product, userId) {
  const history = [];
  if (product === 'digital-menu') {
    for (const row of await listRowsByKind(call, orderKind(userId))) {
      const record = cleanRow(row);
      if (closedHistoryRecord(row.kind, record)) history.push({ product: 'Digital Menu', ...record });
    }
  } else if (product === 'refills') {
    for (const [kind, recordType] of [[digit58OrderKind(userId), 'Order'], [digit58BookingKind(userId), 'Booking']]) {
      for (const row of await listRowsByKind(call, kind)) {
        const record = cleanRow(row);
        if (closedHistoryRecord(row.kind, record)) history.push({ product: 'Store / Refills', recordType, ...record });
      }
    }
  } else if (product === 'service') {
    for (const row of await listRowsByKind(call, 'bookings')) {
      const record = cleanRow(row);
      if (record.customerId === userId && closedHistoryRecord(row.kind, record)) history.push({ product: 'Service / Advertising', ...record });
    }
  } else if (product === 'pos') {
    for (const row of await listRowsByKind(call, safeKindId('pos_workspace_', userId, 45))) {
      const record = cleanRow(row);
      if (record.ownerId !== userId) continue;
      (record.bills || []).forEach(bill => history.push({ product: 'POS', recordType: 'Received bill', ...bill }));
      (record.cancelledBills || []).forEach(bill => history.push({ product: 'POS', recordType: 'Cancelled bill', ...bill }));
    }
  } else throw new Error('Choose a valid G58 product history.');
  return history;
}

async function verifyOrDeleteOwnerHistory(req, call, input, userId, shouldDelete = false) {
  const confirmation = text(input.confirmation, 30);
  if (shouldDelete && confirmation !== 'DELETE') throw new Error('Type DELETE to confirm permanent deletion.');
  await verifyCurrentPassword(req, call, userId, input.password);
  if (!shouldDelete) {
    const backupRecords = await collectOwnerHistory(call, text(input.product, 40), userId);
    return { verified: true, backupRecords, recordCount: backupRecords.length };
  }
  return { verified: true, deleted: await deleteOwnerHistory(call, text(input.product, 40), userId) };
}

async function purgeExpiredOwnerData(call) {
  const rows = await listAllRows(call);
  const now = Date.now(), historyCutoff = now - HISTORY_RETENTION_MS, customerCutoff = now - CUSTOMER_GRACE_MS;
  const expiredOwners = new Set();
  for (const row of rows) {
    if (!['digit58_entitlements', 'digital_menu_entitlements'].includes(row.kind)) continue;
    const record = cleanRow(row), expiry = new Date(record.expiresAt || 0).getTime();
    if (!record.lifetime && expiry && expiry <= customerCutoff) expiredOwners.add(text(record.ownerId, 64));
  }
  let histories = 0, customerLinks = 0, posEntries = 0;
  for (const row of rows) {
    const record = cleanRow(row), rowId = row.$id || row.id;
    if (closedHistoryRecord(row.kind, record) && recordTime(record) && recordTime(record) <= historyCutoff) {
      await removeRow(call, rowId); histories += 1; continue;
    }
    if ((row.kind.startsWith(DIGIT58_CUSTOMER_KIND_PREFIX) || row.kind.startsWith(SUBSCRIPTION_KIND_PREFIX)) && expiredOwners.has(text(record.ownerId, 64))) {
      await removeRow(call, rowId); customerLinks += 1; continue;
    }
    if (row.kind.startsWith('pos_workspace_') && record.ownerId) {
      const bills = (record.bills || []).filter(item => !recordTime(item) || recordTime(item) > historyCutoff);
      const cancelledBills = (record.cancelledBills || []).filter(item => !recordTime(item) || recordTime(item) > historyCutoff);
      const removed = (record.bills || []).length - bills.length + (record.cancelledBills || []).length - cancelledBills.length;
      if (removed > 0) { await updateRow(call, rowId, { ...record, bills, cancelledBills }); posEntries += removed; }
    }
  }
  return { histories, customerLinks, posEntries };
}

function parsePublicPostRow(row) {
  const envelope = cleanRow(row);
  let post = {};
  try { post = JSON.parse(envelope.payload || '{}') || {}; } catch {}
  return { envelope, post };
}

async function updatePublicPostRow(call, row, envelope, post) {
  const rowId = row.$id || row.id || envelope.recordKey || post.id;
  const savedEnvelope = {
    recordKey: envelope.recordKey || post.id || rowId,
    postType: envelope.postType || post.type || '',
    userId: envelope.userId || post.userId || '',
    payload: JSON.stringify(post),
    updatedAt: new Date().toISOString(),
  };
  return call(`/tablesdb/${DATABASE_ID}/tables/${TABLE_ID}/rows/${encodeURIComponent(rowId)}`, {
    method: 'PATCH', body: JSON.stringify({ data: { payload: JSON.stringify(savedEnvelope) } }),
  });
}

function isBusinessPost(envelope, post) {
  return envelope.postType === 'business' || post.type === 'business';
}

async function purgeInactiveBusinessCards(call) {
  const rows = await listRowsByKind(call, PUBLIC_POSTS_KIND);
  const now = Date.now();
  const removedIds = [];
  const migratedIds = [];
  for (const row of rows) {
    const { envelope, post } = parsePublicPostRow(row);
    if (!isBusinessPost(envelope, post)) continue;
    const rowId = row.$id || row.id || envelope.recordKey || post.id;
    const expiry = finite(post.popupExpiresAt, 0);
    if (!expiry) {
      post.popupExpiresAt = now + BUSINESS_CARD_RETENTION_MS;
      post.lastPopupOpenedAt = finite(post.lastPopupOpenedAt, 0);
      post.popupRetentionStartedAt = now;
      await updatePublicPostRow(call, row, envelope, post);
      migratedIds.push(String(post.id || rowId));
      continue;
    }
    if (expiry <= now) {
      await removeRow(call, rowId);
      removedIds.push(String(post.id || rowId));
    }
  }
  return { removedIds, migratedIds };
}

async function purgeExpiredDigit58Promotions(call) {
  const ownerRows = await listRowsByKind(call, DIGIT58_OWNER_KIND);
  const ownerIds = [...new Set(ownerRows.map(row => text(cleanRow(row).ownerId, 64)).filter(Boolean))];
  const today = indiaDay();
  const removedIds = [];
  for (const ownerId of ownerIds) {
    const promotions = await listRowsByKind(call, digit58PromotionKind(ownerId));
    for (const row of promotions) {
      const promotion = cleanRow(row);
      if (!promotion.endsOn || String(promotion.endsOn) >= today) continue;
      const rowId = row.$id || row.id || promotion.id;
      await removeRow(call, rowId);
      removedIds.push(String(promotion.id || rowId));
    }
  }
  return { removedIds };
}

async function touchBusinessCard(call, input) {
  const cardId = text(input.cardId, 36);
  if (!cardId) throw new Error('Business card details are missing.');
  const row = await call(`/tablesdb/${DATABASE_ID}/tables/${TABLE_ID}/rows/${encodeURIComponent(cardId)}`);
  if (row.kind !== PUBLIC_POSTS_KIND) throw new Error('This is not a public business card.');
  const { envelope, post } = parsePublicPostRow(row);
  if (!isBusinessPost(envelope, post)) throw new Error('This is not a public business card.');
  const now = Date.now();
  const expiry = finite(post.popupExpiresAt, 0);
  if (expiry && expiry <= now) {
    await removeRow(call, row.$id || cardId);
    const expired = new Error('This business card expired after 30 days without a popup view.');
    expired.code = 410;
    throw expired;
  }
  post.lastPopupOpenedAt = now;
  post.popupExpiresAt = now + BUSINESS_CARD_RETENTION_MS;
  post.popupRetentionStartedAt ||= now;
  await updatePublicPostRow(call, row, envelope, post);
  return post;
}

function sanitiseBusinessReview(input, raterId, existing) {
  const requestedRating = finite(input.rating, 0);
  const rating = Math.max(1, Math.min(5, Math.round(requestedRating)));
  const name = text(input.name, 40).replace(/\s+/g, ' ');
  const comment = text(input.comment, 280).replace(/\s+/g, ' ');
  if (requestedRating < 1 || requestedRating > 5 || name.length < 2) {
    throw new Error('Choose 1 to 5 stars and enter your name.');
  }
  if (/(https?:\/\/|www\.|@\w+)/i.test(comment)) {
    throw new Error('Links and promotional contact details are not allowed in reviews.');
  }
  const now = Date.now();
  return {
    id: existing?.id || `review-${now.toString(36)}`,
    raterId,
    name,
    rating,
    comment,
    created: finite(existing?.created, now),
    ...(existing ? { updated: now } : {}),
  };
}

async function rateBusinessCard(call, input, userId) {
  const cardId = text(input.cardId, 36);
  if (!cardId) throw new Error('Business card details are missing.');
  const row = await call(`/tablesdb/${DATABASE_ID}/tables/${TABLE_ID}/rows/${encodeURIComponent(cardId)}`);
  if (row.kind !== PUBLIC_POSTS_KIND) throw new Error('This is not a public business card.');
  const { envelope, post } = parsePublicPostRow(row);
  if (!isBusinessPost(envelope, post)) throw new Error('This is not a public business card.');
  if ((envelope.userId || post.userId) === userId) {
    const denied = new Error('Business owners cannot rate their own card.');
    denied.code = 403;
    throw denied;
  }
  const reviews = Array.isArray(post.reviews) ? post.reviews.slice(0, 499) : [];
  const index = reviews.findIndex(review => review?.raterId === userId);
  const updated = index >= 0;
  const review = sanitiseBusinessReview(input, userId, updated ? reviews[index] : null);
  if (updated) reviews[index] = review;
  else reviews.push(review);
  post.reviews = reviews;
  await updatePublicPostRow(call, row, envelope, post);
  return { business: post, updated };
}

async function deleteBusinessRating(call, input, userId) {
  const cardId = text(input.cardId, 36);
  if (!cardId) throw new Error('Business card details are missing.');
  const row = await call(`/tablesdb/${DATABASE_ID}/tables/${TABLE_ID}/rows/${encodeURIComponent(cardId)}`);
  if (row.kind !== PUBLIC_POSTS_KIND) throw new Error('This is not a public business card.');
  const { envelope, post } = parsePublicPostRow(row);
  if (!isBusinessPost(envelope, post)) throw new Error('This is not a public business card.');
  const reviews = Array.isArray(post.reviews) ? post.reviews : [];
  post.reviews = reviews.filter(review => review?.raterId !== userId);
  if (post.reviews.length === reviews.length) throw new Error('Your rating was not found.');
  await updatePublicPostRow(call, row, envelope, post);
  return post;
}

async function confirmPayment(call, orderId, ownerId, userId) {
  const row = await call(`/tablesdb/${DATABASE_ID}/tables/${TABLE_ID}/rows/${encodeURIComponent(orderId)}`);
  const order = cleanRow(row);
  if (row.kind !== orderKind(ownerId)) throw new Error('This is not a restaurant order.');
  if (order.cloudOwnerId !== ownerId || userId !== ownerId) {
    const denied = new Error('Only this restaurant owner can approve the payment.');
    denied.code = 403;
    throw denied;
  }
  if (order.status !== 'Payment Verification') throw new Error(`This order is already ${order.status}.`);
  if (order.paymentReceiptFileId) {
    try {
      await call(`/storage/buckets/${MEDIA_BUCKET_ID}/files/${encodeURIComponent(order.paymentReceiptFileId)}`, { method: 'DELETE' });
    } catch (storageError) {
      if (storageError.code !== 404) throw storageError;
    }
  }
  const nextStatus = order.scheduledFor && new Date(order.scheduledFor).getTime() > Date.now() + 5 * 60 * 1000 ? 'Scheduled' : 'Pending';
  const updated = {
    ...order, status: nextStatus, paymentStatus: 'Confirmed',
    paymentReceiptUrl: '', paymentReceiptFileId: '', paymentReceiptName: '', paymentReceiptType: '',
    paymentReceiptDeletedAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
  };
  ['$id', '$createdAt', '$updatedAt', '$permissions', '$databaseId', '$tableId', 'kind'].forEach(key => delete updated[key]);
  const saved = await call(`/tablesdb/${DATABASE_ID}/tables/${TABLE_ID}/rows/${encodeURIComponent(orderId)}`, {
    method: 'PATCH', body: JSON.stringify({ data: { payload: JSON.stringify(updated) } }),
  });
  return cleanRow(saved);
}

async function reserveToken(call, ownerId, restaurantId, userId) {
  const day = indiaDay();
  const prefix = `tok-${String(restaurantId).replace(/[^a-zA-Z0-9._-]/g, '-').slice(0, 14)}-${day.slice(2)}-`;
  // Existing order rows are the durable source of sequence truth. Reservation
  // rows still protect concurrent customers from receiving the same number.
  let startingNumber = 1;
  try {
    const existingOrders = (await listRowsByKind(call, orderKind(ownerId))).map(cleanRow);
    const highest = Math.max(0, ...existingOrders
      .filter(order => order.restaurantId === restaurantId && order.orderDay === day)
      .map(order => Math.max(0, Math.floor(finite(order.tokenNumber)))));
    startingNumber = highest + 1;
  } catch {}
  for (let number = startingNumber; number <= 9999; number += 1) {
    const id = `${prefix}${formatToken(number)}`.slice(0, 36);
    const payload = { tokenReservation: true, ownerId, restaurantId, orderDay: day, tokenNumber: number, createdAt: new Date().toISOString() };
    try {
      await createRow(call, id, tokenKind(ownerId), payload, rowPermissions(userId, ownerId));
      return { number, id };
    } catch (error) {
      if (error.code !== 409) throw error;
    }
  }
  throw new Error('Today’s token queue is full. Please contact the restaurant.');
}

async function createSubscription(call, input, userId, userEmail) {
  const ownerId = text(input.ownerId, 64), restaurantId = text(input.restaurantId, 64), planId = text(input.planId, 80);
  if (!ownerId || !restaurantId || !planId) throw new Error('Subscription details are missing. Reload the restaurant menu and try again.');
  let verifiedUser = null;
  try { verifiedUser = await call(`/users/${encodeURIComponent(userId)}`); } catch {}
  const email = text(verifiedUser?.email || userEmail || input.customerEmail, 250);
  if (!email) throw new Error('Login with your customer account before requesting a subscription.');
  const menuRow = await call(`/tablesdb/${DATABASE_ID}/tables/${TABLE_ID}/rows/${encodeURIComponent(restaurantId)}`);
  const menu = parseMenu(menuRow, ownerId, restaurantId, false);
  const plan = (menu.restaurant.subscriptionPlans || []).find(row => String(row.id) === planId && row.active !== false);
  if (!plan) throw new Error('This subscription plan is no longer available.');
  const existing = (await listRowsByKind(call, subscriptionKind(ownerId))).map(cleanRow)
    .find(row => row.restaurantId === restaurantId && row.customerAccountId === userId && row.planId === planId && !['Cancelled', 'Rejected'].includes(row.status));
  if (existing) throw new Error('You already have this subscription request.');
  const createdAt = new Date().toISOString();
  const subscription = {
    id: `sub-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`.slice(0, 36),
    ownerId, restaurantId, restaurantName: text(menu.restaurant.name, 160), customerAccountId: userId,
    customerName: text(verifiedUser?.name || input.customerName, 120) || email.split('@')[0], customerEmail: email,
    planId, planName: text(plan.name, 120), planType: text(plan.planType || plan.name, 80),
    totalMeals: Math.max(0, Math.floor(finite(plan.meals))), mealsDelivered: 0,
    price: Math.max(0, finite(plan.price)), paymentLink: text(plan.paymentLink, 500),
    deliveryDays: Array.isArray(plan.deliveryDays) ? plan.deliveryDays.map(day => Math.floor(finite(day, -1))).filter(day => day >= 0 && day <= 6) : [],
    deliveryTime: /^\d{2}:\d{2}$/.test(String(plan.deliveryTime || '')) ? String(plan.deliveryTime) : '12:00',
    status: 'Requested', createdAt,
  };
  const created = await createRow(call, subscription.id, subscriptionKind(ownerId), subscription, rowPermissions(userId, ownerId));
  return cleanRow(created);
}

function nextDeliveryDate(deliveryDays, deliveryTime = '12:00', from = new Date()) {
  const days = [...new Set((Array.isArray(deliveryDays) ? deliveryDays : []).map(day => Math.floor(finite(day, -1))).filter(day => day >= 0 && day <= 6))];
  if (!days.length) return '';
  const shifted = new Date(from.getTime() + 330 * 60000);
  const [hour, minute] = /^\d{2}:\d{2}$/.test(deliveryTime) ? deliveryTime.split(':').map(Number) : [12, 0];
  for (let offset = 0; offset <= 7; offset += 1) {
    const indiaDayDate = new Date(Date.UTC(shifted.getUTCFullYear(), shifted.getUTCMonth(), shifted.getUTCDate() + offset));
    if (!days.includes(indiaDayDate.getUTCDay())) continue;
    const candidate = new Date(Date.UTC(indiaDayDate.getUTCFullYear(), indiaDayDate.getUTCMonth(), indiaDayDate.getUTCDate(), hour, minute) - 330 * 60000);
    if (candidate.getTime() > from.getTime()) return candidate.toISOString();
  }
  return '';
}

async function subscriptionRow(call, ownerId, subscriptionId) {
  const row = await call(`/tablesdb/${DATABASE_ID}/tables/${TABLE_ID}/rows/${encodeURIComponent(subscriptionId)}`);
  if (row.kind !== subscriptionKind(ownerId)) throw new Error('This is not a restaurant subscription.');
  return cleanRow(row);
}

async function sendSubscriptionLink(call, input, userId) {
  const ownerId = text(input.ownerId, 64), subscriptionId = text(input.subscriptionId, 36);
  const subscription = await subscriptionRow(call, ownerId, subscriptionId);
  if (userId !== ownerId || subscription.ownerId !== ownerId) {
    const denied = new Error('Only this restaurant owner can send the subscription payment link.'); denied.code = 403; throw denied;
  }
  let currentPlan = null;
  try {
    const menuRow = await call(`/tablesdb/${DATABASE_ID}/tables/${TABLE_ID}/rows/${encodeURIComponent(subscription.restaurantId)}`);
    const menu = parseMenu(menuRow, ownerId, subscription.restaurantId, false);
    currentPlan = (menu.restaurant.subscriptionPlans || []).find(plan => String(plan.id) === String(subscription.planId));
  } catch {}
  const paymentLink = text(input.paymentLink || currentPlan?.paymentLink || subscription.paymentLink, 500);
  if (!paymentLink) throw new Error('Enter the customer subscription payment link before sending it.');
  try {
    const parsed = new URL(paymentLink);
    if (parsed.protocol !== 'https:') throw new Error('not secure');
  } catch {
    throw new Error('Enter a valid secure HTTPS subscription payment link.');
  }
  if (!['Requested', 'Payment Link Sent'].includes(subscription.status)) throw new Error(`This subscription is already ${subscription.status}.`);
  const deliveryDays = currentPlan ? (Array.isArray(currentPlan.deliveryDays) ? currentPlan.deliveryDays : []) : subscription.deliveryDays;
  const deliveryTime = /^\d{2}:\d{2}$/.test(String(currentPlan?.deliveryTime || '')) ? currentPlan.deliveryTime : subscription.deliveryTime;
  return updateRow(call, subscriptionId, { ...subscription, paymentLink, deliveryDays, deliveryTime, status: 'Payment Link Sent', paymentLinkSentAt: new Date().toISOString(), updatedAt: new Date().toISOString() });
}

async function submitSubscriptionPayment(call, input, userId) {
  const ownerId = text(input.ownerId, 64), subscriptionId = text(input.subscriptionId, 36);
  const subscription = await subscriptionRow(call, ownerId, subscriptionId);
  if (subscription.customerAccountId !== userId) {
    const denied = new Error('Only the customer who requested this plan can submit its receipt.'); denied.code = 403; throw denied;
  }
  if (subscription.status !== 'Payment Link Sent') throw new Error('Wait for the restaurant to send the subscription payment link.');
  const receipt = { paymentMethod: 'online', paymentReceiptFileId: input.paymentReceiptFileId };
  await validateReceipt(call, receipt, userId);
  return updateRow(call, subscriptionId, {
    ...subscription, status: 'Payment Proof Submitted', paymentSubmittedAt: new Date().toISOString(),
    paymentReceiptFileId: receipt.paymentReceiptFileId, paymentReceiptUrl: receipt.paymentReceiptUrl,
    paymentReceiptName: receipt.paymentReceiptName, paymentReceiptType: receipt.paymentReceiptType, updatedAt: new Date().toISOString(),
  });
}

async function confirmSubscriptionPayment(call, input, userId) {
  const ownerId = text(input.ownerId, 64), subscriptionId = text(input.subscriptionId, 36);
  const subscription = await subscriptionRow(call, ownerId, subscriptionId);
  if (userId !== ownerId || subscription.ownerId !== ownerId) {
    const denied = new Error('Only this restaurant owner can confirm the subscription payment.'); denied.code = 403; throw denied;
  }
  if (subscription.status !== 'Payment Proof Submitted') throw new Error(`This subscription is already ${subscription.status}.`);
  if (subscription.paymentReceiptFileId) {
    try { await call(`/storage/buckets/${MEDIA_BUCKET_ID}/files/${encodeURIComponent(subscription.paymentReceiptFileId)}`, { method: 'DELETE' }); }
    catch (storageError) { if (storageError.code !== 404) throw storageError; }
  }
  const activatedAt = new Date().toISOString();
  return updateRow(call, subscriptionId, {
    ...subscription, status: 'Active', activatedAt,
    nextScheduledMeal: nextDeliveryDate(subscription.deliveryDays, subscription.deliveryTime, new Date(activatedAt)),
    paymentReceiptFileId: '', paymentReceiptUrl: '', paymentReceiptName: '', paymentReceiptType: '',
    paymentReceiptDeletedAt: activatedAt, updatedAt: activatedAt,
  });
}

const digit58Id = prefix => `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;

async function linkDigit58Customer(call, input, userId) {
  const ownerId = text(input.ownerId, 64), storeId = text(input.storeId, 40);
  if (!ownerId || !storeId) throw new Error('Store details are missing.');
  const kind = digit58CustomerKind(ownerId);
  const existing = (await listRowsByKind(call, kind)).map(cleanRow)
    .find(row => row.storeId === storeId && row.customerAccountId === userId);
  if (existing) return updateRow(call, existing.id || existing.$id, { ...existing, lastLoginAt: new Date().toISOString() });
  const createdAt = new Date().toISOString();
  const record = {
    id: digit58Id('cust'), ownerId, storeId, customerAccountId: userId,
    customerName: text(input.customerName, 120), customerEmail: text(input.customerEmail, 250),
    phone: '', createdAt, lastLoginAt: createdAt,
  };
  const created = await createRow(call, record.id, kind, record, rowPermissionsFor([ownerId, userId]));
  return cleanRow(created);
}

async function listDigit58CustomerPortalStores(call, userId) {
  const [ownerRows, entitlementRows] = await Promise.all([
    listRowsByKind(call, DIGIT58_OWNER_KIND).catch(() => []),
    listRowsByKind(call, DIGIT58_ENTITLEMENT_KIND).catch(() => []),
  ]);
  const ownerIds = [...new Set([
    ...ownerRows.map(row => text(cleanRow(row).ownerId, 64)),
    ...entitlementRows.map(row => text(cleanRow(row).ownerId, 64)),
  ].filter(Boolean))];
  const customerRowsByOwner = await Promise.all(ownerIds.map(async ownerId => ({
    ownerId,
    rows: await listRowsByKind(call, digit58CustomerKind(ownerId)).catch(() => []),
  })));
  const linked = customerRowsByOwner.flatMap(({ ownerId, rows }) => rows.map(cleanRow)
    .filter(customer => customer.customerAccountId === userId && customer.storeId)
    .map(customer => ({ ownerId, storeId: customer.storeId, customer })));
  const unique = [...new Map(linked.map(link => [`${link.ownerId}:${link.storeId}`, link])).values()];
  const stores = await Promise.all(unique.map(async link => {
    const row = await call(`/tablesdb/${DATABASE_ID}/tables/${TABLE_ID}/rows/${encodeURIComponent(link.storeId)}`).catch(() => null);
    if (!row || row.kind !== digit58StoreKind(link.ownerId)) return null;
    const store = cleanRow(row);
    return {
      ownerId: link.ownerId, storeId: link.storeId, storeName: text(store.name, 160) || 'Store',
      category: text(store.category, 120), city: text(store.city, 120), suspended: !!store.suspended,
      customerId: link.customer.id, lastLoginAt: link.customer.lastLoginAt || '',
    };
  }));
  return stores.filter(Boolean).sort((a, b) => a.storeName.localeCompare(b.storeName));
}

function ticketPermissions(requesterId) {
  return [...new Set([
    `read("user:${requesterId}")`, `update("user:${requesterId}")`,
    `read("team:${ADMIN_TEAM_ID}")`, `update("team:${ADMIN_TEAM_ID}")`,
  ])];
}
async function raiseSupportTicket(call, input, userId) {
  const subject = text(input.subject, 160), message = text(input.message, 2000);
  if (!subject || !message) throw new Error('Enter a subject and a message.');
  const source = text(input.source, 40) || 'g58';
  const requesterName = text(input.requesterName, 120) || 'Customer';
  const createdAt = new Date().toISOString();
  const record = {
    id: digit58Id('ticket'), requesterId: userId,
    requesterEmail: text(input.requesterEmail, 250), requesterName, source, subject,
    status: 'Open', messages: [{ senderRole: 'requester', senderName: requesterName, text: message, createdAt }],
    createdAt, updatedAt: createdAt,
  };
  const created = await createRow(call, record.id, SUPPORT_KIND, record, ticketPermissions(userId));
  return cleanRow(created);
}

async function acceptDigit58Policy(call, input, userId) {
  const ownerId = text(input.ownerId, 64);
  if (!ownerId || ownerId !== userId) { const denied = new Error('Only the store owner can accept this policy.'); denied.code = 403; throw denied; }
  const rowId = digit58EntitlementRowId(ownerId);
  const row = await call(`/tablesdb/${DATABASE_ID}/tables/${TABLE_ID}/rows/${encodeURIComponent(rowId)}`).catch(() => null);
  if (!row) throw new Error('No active Refills subscription found for this account.');
  const entitlement = cleanRow(row);
  return updateRow(call, rowId, { ...entitlement, policyAcceptedAt: new Date().toISOString() });
}

async function razorpayApi(path, options = {}) {
  const keyId = process.env.RAZORPAY_KEY_ID, keySecret = process.env.RAZORPAY_KEY_SECRET;
  if (!keyId || !keySecret) throw new Error('Razorpay is not configured on the server yet.');
  const auth = Buffer.from(`${keyId}:${keySecret}`).toString('base64');
  const response = await fetch(`https://api.razorpay.com/v1${path}`, {
    ...options,
    headers: { 'content-type': 'application/json', authorization: `Basic ${auth}`, ...(options.headers || {}) },
  });
  const body = await response.text();
  let data = {};
  try { data = body ? JSON.parse(body) : {}; } catch { data = { error: { description: body } }; }
  if (!response.ok) throw new Error(data?.error?.description || `Razorpay request failed (${response.status})`);
  return data;
}

function digit58PlanAmount(monthly, periodId) {
  const months = DIGIT58_PLAN_MONTHS[periodId], discount = DIGIT58_PLAN_DISCOUNT[periodId];
  return Math.round(Number(monthly) * months * (1 - discount / 100));
}

async function digit58PricingDoc(call) {
  const row = await call(`/tablesdb/${DATABASE_ID}/tables/${TABLE_ID}/rows/default`).catch(() => null);
  const pricing = row && row.kind === 'digit58_pricing' ? cleanRow(row) : {};
  return { rowExists: !!row, monthly: Math.max(1, finite(pricing.monthly, 399)), razorpayPlanIds: pricing.razorpayPlanIds || {}, raw: pricing };
}

async function ensureDigit58RazorpayPlan(call, periodId, amount) {
  const { rowExists, razorpayPlanIds, raw } = await digit58PricingDoc(call);
  const cached = razorpayPlanIds[periodId];
  if (cached && cached.amount === amount && cached.planId) return cached.planId;
  const created = await razorpayApi('/plans', {
    method: 'POST',
    body: JSON.stringify({
      period: periodId === '6m' ? 'monthly' : 'yearly',
      interval: periodId === '6m' ? 6 : periodId === '1y' ? 1 : 3,
      item: { name: `Refills Store Access — ${DIGIT58_PLAN_LABELS[periodId]}`, amount: amount * 100, currency: 'INR' },
    }),
  });
  const nextPlanIds = { ...razorpayPlanIds, [periodId]: { planId: created.id, amount } };
  if (rowExists) await updateRow(call, 'default', { ...raw, razorpayPlanIds: nextPlanIds });
  else await createRow(call, 'default', 'digit58_pricing', { monthly: 399, paymentLink: '', razorpayPlanIds: nextPlanIds }, [`read("team:${ADMIN_TEAM_ID}")`, `update("team:${ADMIN_TEAM_ID}")`]);
  return created.id;
}

async function createDigit58SubscriptionCheckout(call, input, userId) {
  const ownerId = text(input.ownerId, 64), periodId = text(input.periodId, 10);
  if (!ownerId || ownerId !== userId) { const denied = new Error('Only the store owner can start a subscription.'); denied.code = 403; throw denied; }
  if (!DIGIT58_PLAN_MONTHS[periodId]) throw new Error('Choose a valid Refills plan.');
  let verifiedUser = null;
  try { verifiedUser = await call(`/users/${encodeURIComponent(userId)}`); } catch {}
  const email = text(verifiedUser?.email || input.ownerEmail, 250);
  const name = text(verifiedUser?.name || input.ownerName, 120) || (email ? email.split('@')[0] : 'Refills Store Owner');
  if (!email) throw new Error('Add an email to your account before subscribing.');
  const { monthly } = await digit58PricingDoc(call);
  const amount = digit58PlanAmount(monthly, periodId);
  const planId = await ensureDigit58RazorpayPlan(call, periodId, amount);
  const rowId = digit58EntitlementRowId(ownerId);
  const existingRow = await call(`/tablesdb/${DATABASE_ID}/tables/${TABLE_ID}/rows/${encodeURIComponent(rowId)}`).catch(() => null);
  const entitlement = existingRow ? cleanRow(existingRow) : null;
  let customerId = entitlement?.razorpayCustomerId;
  if (!customerId) {
    const customer = await razorpayApi('/customers', { method: 'POST', body: JSON.stringify({ name, email, fail_existing: 0 }) });
    customerId = customer.id;
  }
  const subscription = await razorpayApi('/subscriptions', {
    method: 'POST',
    body: JSON.stringify({ plan_id: planId, customer_id: customerId, customer_notify: 1, total_count: DIGIT58_PLAN_TOTAL_COUNT[periodId] }),
  });
  const changes = {
    ownerId, ownerEmail: email, razorpayCustomerId: customerId, razorpaySubscriptionId: subscription.id,
    pendingPlan: periodId, subscriptionStatus: 'created', cancelAtPeriodEnd: false, updatedAt: new Date().toISOString(),
  };
  if (entitlement) await updateRow(call, rowId, { ...entitlement, ...changes });
  else await createRow(call, rowId, DIGIT58_ENTITLEMENT_KIND, {
    ownerId, active: false, paused: false, lifetime: false, storeSlots: 1, freeTrial: false, activatedAt: '', expiresAt: '',
    referredByCode: text(input.referredByCode, 12), ...changes,
  }, rowPermissions(userId, ownerId));
  return { subscriptionId: subscription.id, razorpayKeyId: process.env.RAZORPAY_KEY_ID, amount, periodId };
}

async function cancelDigit58Subscription(call, input, userId) {
  const ownerId = text(input.ownerId, 64);
  if (!ownerId || ownerId !== userId) { const denied = new Error('Only the store owner can cancel this subscription.'); denied.code = 403; throw denied; }
  const rowId = digit58EntitlementRowId(ownerId);
  const row = await call(`/tablesdb/${DATABASE_ID}/tables/${TABLE_ID}/rows/${encodeURIComponent(rowId)}`).catch(() => null);
  if (!row) throw new Error('No Refills subscription found for this account.');
  const entitlement = cleanRow(row);
  if (!entitlement.razorpaySubscriptionId) throw new Error('There is no active paid subscription to cancel.');
  if (entitlement.cancelAtPeriodEnd) throw new Error('This subscription is already set to cancel at the end of the paid period.');
  await razorpayApi(`/subscriptions/${encodeURIComponent(entitlement.razorpaySubscriptionId)}/cancel`, { method: 'POST', body: JSON.stringify({ cancel_at_cycle_end: 1 }) });
  return updateRow(call, rowId, { ...entitlement, cancelAtPeriodEnd: true, subscriptionStatus: 'cancel_scheduled', updatedAt: new Date().toISOString() });
}

const DIGIT58_REFERRAL_CODE_KIND = 'digit58_referral_codes';
const DIGIT58_REFERRER_PROFILE_KIND = 'digit58_referrer_profiles';
const REFERRAL_CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
function generateReferralCode() {
  let code = '';
  for (let i = 0; i < 6; i += 1) code += REFERRAL_CODE_CHARS[Math.floor(Math.random() * REFERRAL_CODE_CHARS.length)];
  return code;
}
function digit58ReferrerProfileRowId(userId) {
  return `refp-${String(userId).slice(0, 30)}`;
}
// Any signed-in G58 account can become a referrer — this is intentionally
// not tied to owning a Refills store, so it looks up/creates a lightweight
// per-user profile row instead of a digit58_entitlements row.
async function getOrCreateDigit58ReferralCode(call, userId, email, name) {
  const profileRowId = digit58ReferrerProfileRowId(userId);
  const existingRow = await call(`/tablesdb/${DATABASE_ID}/tables/${TABLE_ID}/rows/${encodeURIComponent(profileRowId)}`).catch(() => null);
  const profile = existingRow ? cleanRow(existingRow) : null;
  if (profile?.referralCode) return profile.referralCode;
  let code = '';
  for (let attempt = 0; attempt < 8 && !code; attempt += 1) {
    const candidate = generateReferralCode();
    const existing = await call(`/tablesdb/${DATABASE_ID}/tables/${TABLE_ID}/rows/${encodeURIComponent(`ref-${candidate}`)}`).catch(() => null);
    if (!existing) code = candidate;
  }
  if (!code) throw new Error('Could not generate a referral code. Try again.');
  await createRow(call, `ref-${code}`, DIGIT58_REFERRAL_CODE_KIND, { code, referrerUserId: userId }, rowPermissions(userId, userId));
  if (profile) await updateRow(call, profileRowId, { ...profile, referralCode: code });
  else await createRow(call, profileRowId, DIGIT58_REFERRER_PROFILE_KIND, {
    userId, referralCode: code, email: text(email, 250), name: text(name, 120), createdAt: new Date().toISOString(),
  }, rowPermissions(userId, userId));
  return code;
}
async function getDigit58ReferralCode(call, input, userId) {
  if (!userId) { const denied = new Error('Sign in to get your referral link.'); denied.code = 401; throw denied; }
  let verifiedUser = null;
  try { verifiedUser = await call(`/users/${encodeURIComponent(userId)}`); } catch {}
  const email = verifiedUser?.email || input.ownerEmail || input.userEmail;
  const name = verifiedUser?.name || input.ownerName || input.userName;
  return { code: await getOrCreateDigit58ReferralCode(call, userId, email, name) };
}

async function deleteDigit58Entitlement(call, input, userId) {
  if (!(await isDigit58Admin(call, userId))) { const denied = new Error('Only G58 administrators can delete a Refills subscription.'); denied.code = 403; throw denied; }
  const ownerId = text(input.ownerId, 64);
  if (!ownerId) throw new Error('Owner details are missing.');
  const rowId = digit58EntitlementRowId(ownerId);
  const row = await call(`/tablesdb/${DATABASE_ID}/tables/${TABLE_ID}/rows/${encodeURIComponent(rowId)}`).catch(() => null);
  if (!row) throw new Error('No Refills subscription found for this owner.');
  const entitlement = cleanRow(row);
  if (entitlement.razorpaySubscriptionId) {
    await razorpayApi(`/subscriptions/${encodeURIComponent(entitlement.razorpaySubscriptionId)}/cancel`, { method: 'POST', body: JSON.stringify({ cancel_at_cycle_end: 0 }) }).catch(() => {});
  }
  await removeRow(call, rowId);
  return { ok: true };
}

async function setDigit58StoreSuspended(call, input, userId) {
  if (!(await isDigit58Admin(call, userId))) { const denied = new Error('Only G58 administrators can manage store status.'); denied.code = 403; throw denied; }
  const ownerId = text(input.ownerId, 64), storeId = text(input.storeId, 40);
  if (!ownerId || !storeId) throw new Error('Store details are missing.');
  const row = await call(`/tablesdb/${DATABASE_ID}/tables/${TABLE_ID}/rows/${encodeURIComponent(storeId)}`);
  if (row.kind !== digit58StoreKind(ownerId)) throw new Error('This store does not belong to the selected owner.');
  const store = cleanRow(row);
  const suspended = !!input.suspended;
  const updated = await updateRow(call, storeId, { ...store, suspended, suspendedAt: suspended ? new Date().toISOString() : '' });
  const summaryId = `owner-${storeId}`;
  const summary = await call(`/tablesdb/${DATABASE_ID}/tables/${TABLE_ID}/rows/${encodeURIComponent(summaryId)}`).catch(() => null);
  if (summary) await updateRow(call, summaryId, { ...cleanRow(summary), suspended }).catch(() => {});
  return updated;
}

function buildDigit58UpiUri(upiId, payeeName, amount, refId) {
  if (!upiId) return '';
  const reference = `58${String(refId || Date.now()).replace(/\D/g, '').slice(-30)}`.slice(0, 35);
  const params = new URLSearchParams({ pa: upiId, pn: payeeName || upiId, tr: reference, tn: `Refills order ${refId}`, am: Number(amount || 0).toFixed(2), cu: 'INR' });
  return `upi://pay?${params.toString()}`;
}
async function createDigit58Card(call, input, userId) {
  const ownerId = text(input.ownerId, 64), storeId = text(input.storeId, 40), customerAccountId = text(input.customerAccountId, 64);
  if (userId !== ownerId) { const denied = new Error('Only the store owner can add a reminder card.'); denied.code = 403; throw denied; }
  if (!storeId || !customerAccountId) throw new Error('Customer details are missing.');
  const productName = text(input.productName, 160);
  if (!productName) throw new Error('Enter an item or medicine name.');
  const price = Math.max(0, finite(input.price));
  const reminderDays = Math.max(1, Math.floor(finite(input.reminderDays, 30)));
  const upiId = text(input.upiId, 120);
  const cardId = digit58Id('card');
  const createdAt = new Date().toISOString();
  const record = {
    id: cardId, ownerId, storeId, customerAccountId, productName, price, reminderDays,
    upiId, upiUri: buildDigit58UpiUri(upiId, text(input.payeeName, 120), price, cardId),
    purchasedAt: createdAt, dueAt: new Date(Date.now() + reminderDays * 86400000).toISOString(),
    status: 'Active', timesDelivered: 0, buyRequestedAt: '', createdAt,
  };
  const created = await createRow(call, record.id, digit58CardKind(ownerId), record, rowPermissionsFor([ownerId, customerAccountId]));
  return cleanRow(created);
}

function hhmmToMinutes(value) {
  const [h, m] = text(value, 5).split(':').map(Number);
  return (Number.isFinite(h) ? h : 0) * 60 + (Number.isFinite(m) ? m : 0);
}
function rangesOverlap(startA, endA, startB, endB) { return startA < endB && endA > startB; }
function digit58ServiceDurationMinutes(store, service) {
  return Math.max(5, finite(service?.durationMinutes) || finite(store?.slotDurationMinutes) || 30);
}
function digit58LunchBreakRange(store) {
  if (!store?.lunchBreakEnabled) return null;
  const start = hhmmToMinutes(store.lunchBreakStart || '13:00');
  return { start, end: start + 60 };
}

async function createDigit58Booking(call, input, userId, options = {}) {
  const ownerId = text(input.ownerId, 64), storeId = text(input.storeId, 40), serviceId = text(input.serviceId, 40), expertId = text(input.expertId, 40);
  if (!ownerId || !storeId || !serviceId) throw new Error('Booking details are missing.');
  const date = text(input.date, 10), startTime = text(input.startTime, 5);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^\d{2}:\d{2}$/.test(startTime)) throw new Error('Choose a valid booking date and time.');

  const storeRow = await call(`/tablesdb/${DATABASE_ID}/tables/${TABLE_ID}/rows/${encodeURIComponent(storeId)}`).catch(() => null);
  if (!storeRow || storeRow.kind !== digit58StoreKind(ownerId)) throw new Error('This store could not be found.');
  const store = cleanRow(storeRow);
  if (!['services', 'game_zones'].includes(store.businessType)) throw new Error('This store does not accept bookings.');
  if (store.emergencyMode) throw new Error('This store is not accepting new bookings right now. Please check back shortly.');

  const availableDays = Array.isArray(store.availableDays) ? store.availableDays.map(Number) : [];
  const slotStartTime = text(store.slotStartTime, 5) || '00:00', slotEndTime = text(store.slotEndTime, 5) || '23:59';
  const preBookingWindowDays = Math.max(1, finite(store.preBookingWindowDays, 30));

  const serviceRow = await call(`/tablesdb/${DATABASE_ID}/tables/${TABLE_ID}/rows/${encodeURIComponent(serviceId)}`).catch(() => null);
  if (!serviceRow || serviceRow.kind !== digit58ServiceKind(ownerId)) throw new Error('This service could not be found.');
  const service = cleanRow(serviceRow);
  if (service.storeId !== storeId) throw new Error('This service does not belong to the selected store.');
  const doorstepServiceEnabled = service.doorstepServiceEnabled === true;
  const locationLat = Number(input.locationLat), locationLng = Number(input.locationLng);
  const hasLocation = Number.isFinite(locationLat) && Number.isFinite(locationLng) &&
    locationLat >= -90 && locationLat <= 90 && locationLng >= -180 && locationLng <= 180;
  if (doorstepServiceEnabled && !hasLocation && !options.allowMissingDoorstepLocation) {
    throw new Error('Share the service location before booking this doorstep service.');
  }

  const slotStartMs = new Date(`${date}T${startTime}:00+05:30`).getTime();
  if (!Number.isFinite(slotStartMs)) throw new Error('Choose a valid booking date and time.');
  const nowMs = Date.now();
  if (slotStartMs < nowMs + 5 * 60000) throw new Error('Choose a time at least 5 minutes from now.');
  const bookingFromDate = text(service.bookingFromDate, 10), bookingUntilDate = text(service.bookingUntilDate, 10);
  if (bookingFromDate && bookingUntilDate) {
    if (date < bookingFromDate || date > bookingUntilDate) throw new Error(`This service can only be booked between ${bookingFromDate} and ${bookingUntilDate}.`);
  } else if (slotStartMs > nowMs + preBookingWindowDays * 86400000) {
    throw new Error(`Bookings can only be made up to ${preBookingWindowDays} days ahead.`);
  }
  const weekday = new Date(slotStartMs + 330 * 60000).getUTCDay();
  if (availableDays.length && !availableDays.includes(weekday)) throw new Error('This store is closed on the selected day.');

  const durationMinutes = digit58ServiceDurationMinutes(store, service);
  const startMinutes = hhmmToMinutes(startTime), endMinutes = startMinutes + durationMinutes;
  if (startMinutes < hhmmToMinutes(slotStartTime) || endMinutes > hhmmToMinutes(slotEndTime)) throw new Error("Choose a time within the store's open hours that fits the service duration.");
  const lunch = digit58LunchBreakRange(store);
  if (lunch && rangesOverlap(startMinutes, endMinutes, lunch.start, lunch.end)) throw new Error('This time falls in the store\'s lunch break. Choose another slot.');

  let expertName = '', expertPhone = '';
  if (expertId) {
    const expertRow = await call(`/tablesdb/${DATABASE_ID}/tables/${TABLE_ID}/rows/${encodeURIComponent(expertId)}`).catch(() => null);
    if (!expertRow || expertRow.kind !== digit58ExpertKind(ownerId)) throw new Error('This expert could not be found.');
    const expert = cleanRow(expertRow);
    if (expert.storeId !== storeId) throw new Error('This expert does not belong to the selected store.');
    expertName = expert.name || '';
    expertPhone = text(expert.phone, 20);
  }

  const existingBookings = (await listRowsByKind(call, digit58BookingKind(ownerId))).map(cleanRow);
  const unpaidCancellationBookings = existingBookings.filter(row =>
    row.storeId === storeId && row.customerAccountId === userId && row.status === 'Cancelled' &&
    Math.max(0, finite(row.cancellationDueAmount)) > 0 &&
    ['Due', 'Verification'].includes(row.cancellationPaymentStatus));
  if (unpaidCancellationBookings.length) {
    const pendingAmount = Math.round(unpaidCancellationBookings.reduce((sum, row) => sum + Math.max(0, finite(row.cancellationDueAmount)), 0) * 100) / 100;
    throw new Error(`Pay the pending cancellation charge of ₹${pendingAmount.toLocaleString('en-IN')} before booking again at this store.`);
  }
  const conflict = existingBookings.find(row => {
    if (row.storeId !== storeId || row.date !== date || row.status === 'Cancelled') return false;
    if ((row.expertId || '') !== (expertId || '')) return false;
    const rowStart = hhmmToMinutes(row.startTime), rowEnd = rowStart + Math.max(5, finite(row.durationMinutes, 30));
    return rangesOverlap(startMinutes, endMinutes, rowStart, rowEnd);
  });
  if (conflict) throw new Error('This slot has just been booked by someone else. Choose another time.');

  const price = Math.max(0, finite(service.price));
  const prepaymentPercent = Math.min(100, Math.max(0, Math.round(finite(service.prepaymentPercent, 100))));
  const prepaymentAmount = Math.round(price * prepaymentPercent) / 100;
  const cancellationChargeAmount = service.cancellationChargeEnabled ? Math.max(0, finite(service.cancellationChargeAmount)) : 0;
  const upfrontAmount = Math.round(prepaymentAmount * 100) / 100;
  const balanceAmount = Math.round((price * 100 - prepaymentAmount * 100)) / 100;
  const bookingId = digit58Id('booking');
  const upiId = text(store.upiId, 120);
  const createdAt = new Date().toISOString();
  const record = {
    id: bookingId, ownerId, storeId, serviceId, serviceName: service.name, expertId, expertName, expertPhone,
    customerAccountId: userId, customerName: text(input.customerName, 120), customerEmail: text(input.customerEmail, 250),
    phone: normalisePhone(input.phone).slice(0, 15),
    doorstepServiceEnabled,
    locationLat: hasLocation ? locationLat : '', locationLng: hasLocation ? locationLng : '',
    locationUrl: hasLocation ? `https://www.google.com/maps?q=${locationLat},${locationLng}` : '',
    date, startTime, durationMinutes, price, prepaymentPercent, prepaymentAmount, cancellationChargeAmount, cancellationChargeMode: 'post-cancel', upfrontAmount, balanceAmount,
    upiId: upfrontAmount > 0 ? upiId : '', upiUri: upfrontAmount > 0 ? buildDigit58UpiUri(upiId, store.name, upfrontAmount, bookingId) : '',
    status: options.initialStatus || (upfrontAmount > 0 ? 'Pending Payment' : 'Requested'), paymentMarkedAt: '', balancePaid: false, balancePaidAt: '',
    cancellationDueAmount: 0, cancellationPaymentStatus: 'Not Required', cancellationPaymentMarkedAt: '', cancellationPaymentConfirmedAt: '', cancellationPaymentUpiUri: '',
    createdAt, updatedAt: createdAt,
  };
  const created = await createRow(call, bookingId, digit58BookingKind(ownerId), record, rowPermissionsFor([ownerId, userId]));
  return cleanRow(created);
}

async function getDigit58SlotStatus(call, input) {
  const ownerId = text(input.ownerId, 64), storeId = text(input.storeId, 40), date = text(input.date, 10);
  if (!ownerId || !storeId || !/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new Error('Availability details are missing.');
  const bookings = (await listRowsByKind(call, digit58BookingKind(ownerId))).map(cleanRow);
  const occupied = bookings
    .filter(row => row.storeId === storeId && row.date === date && row.status !== 'Cancelled')
    .map(row => ({ startTime: row.startTime, durationMinutes: Math.max(5, finite(row.durationMinutes, 30)), expertId: row.expertId || '' }));
  return { occupied };
}

async function createDigit58OwnerBooking(call, input, userId) {
  const ownerId = text(input.ownerId, 64), storeId = text(input.storeId, 40), customerAccountId = text(input.customerAccountId, 64);
  if (userId !== ownerId) { const denied = new Error('Only the store owner can create this booking.'); denied.code = 403; throw denied; }
  if (!storeId || !customerAccountId) throw new Error('Customer details are missing.');
  const customerRows = await listRowsByKind(call, digit58CustomerKind(ownerId));
  const customer = customerRows.map(cleanRow).find(row => row.storeId === storeId && row.customerAccountId === customerAccountId);
  if (!customer) throw new Error('This customer is not linked to the selected store.');
  return createDigit58Booking(call, {
    ownerId, storeId, serviceId: input.serviceId, expertId: input.expertId, date: input.date, startTime: input.startTime,
    customerName: customer.customerName, customerEmail: customer.customerEmail, phone: customer.phone,
  }, customerAccountId, { initialStatus: 'Pending Customer Acceptance', allowMissingDoorstepLocation: true });
}

async function acceptDigit58OwnerBooking(call, input, userId) {
  const ownerId = text(input.ownerId, 64), bookingId = text(input.bookingId, 40);
  if (!ownerId || !bookingId) throw new Error('Booking details are missing.');
  const row = await call(`/tablesdb/${DATABASE_ID}/tables/${TABLE_ID}/rows/${encodeURIComponent(bookingId)}`);
  if (row.kind !== digit58BookingKind(ownerId)) throw new Error('This is not a booking.');
  const booking = cleanRow(row);
  if (booking.customerAccountId !== userId) { const denied = new Error("Only this booking's customer can accept it."); denied.code = 403; throw denied; }
  if (booking.status !== 'Pending Customer Acceptance') throw new Error('This booking has already been handled.');
  const updatedAt = new Date().toISOString();
  const changes = { status: Number(booking.upfrontAmount) > 0 ? 'Pending Payment' : 'Requested', acceptedByCustomerAt: updatedAt, updatedAt };
  return updateRow(call, bookingId, { ...booking, ...changes });
}

async function rejectDigit58OwnerBooking(call, input, userId) {
  const ownerId = text(input.ownerId, 64), bookingId = text(input.bookingId, 40);
  if (!ownerId || !bookingId) throw new Error('Booking details are missing.');
  const row = await call(`/tablesdb/${DATABASE_ID}/tables/${TABLE_ID}/rows/${encodeURIComponent(bookingId)}`);
  if (row.kind !== digit58BookingKind(ownerId)) throw new Error('This is not a booking.');
  const booking = cleanRow(row);
  if (booking.customerAccountId !== userId) { const denied = new Error("Only this booking's customer can reject it."); denied.code = 403; throw denied; }
  if (booking.status !== 'Pending Customer Acceptance') throw new Error('This booking has already been handled.');
  const updatedAt = new Date().toISOString();
  const changes = { status: 'Cancelled', cancelledAt: updatedAt, updatedAt };
  return updateRow(call, bookingId, { ...booking, ...changes });
}

async function cancelDigit58CustomerBooking(call, input, userId) {
  const ownerId = text(input.ownerId, 64), bookingId = text(input.bookingId, 40);
  if (!ownerId || !bookingId) throw new Error('Booking details are missing.');
  const row = await call(`/tablesdb/${DATABASE_ID}/tables/${TABLE_ID}/rows/${encodeURIComponent(bookingId)}`);
  if (row.kind !== digit58BookingKind(ownerId)) throw new Error('This is not a booking.');
  const booking = cleanRow(row);
  if (booking.customerAccountId !== userId) { const denied = new Error("Only this booking's customer can cancel it."); denied.code = 403; throw denied; }
  if (!['Requested', 'Pending Payment', 'Confirmed'].includes(booking.status)) throw new Error('This booking can no longer be cancelled.');
  // Legacy bookings included the old "guarantee" in their upfront amount. Only
  // post-cancel bookings may create a new debt, preventing a double charge.
  const cancellationDueAmount = booking.cancellationChargeMode === 'post-cancel' ? Math.max(0, finite(booking.cancellationChargeAmount)) : 0;
  const storeRow = await call(`/tablesdb/${DATABASE_ID}/tables/${TABLE_ID}/rows/${encodeURIComponent(booking.storeId)}`).catch(() => null);
  const store = storeRow && storeRow.kind === digit58StoreKind(ownerId) ? cleanRow(storeRow) : {};
  const updatedAt = new Date().toISOString();
  const changes = {
    status: 'Cancelled', cancelledAt: updatedAt, cancelledBy: 'customer', updatedAt,
    cancellationDueAmount,
    cancellationPaymentStatus: cancellationDueAmount > 0 ? 'Due' : 'Not Required',
    cancellationPaymentMarkedAt: '', cancellationPaymentConfirmedAt: '',
    cancellationPaymentUpiUri: cancellationDueAmount > 0 && text(store.upiId, 120)
      ? buildDigit58UpiUri(text(store.upiId, 120), store.name, cancellationDueAmount, `CAN-${bookingId}`)
      : '',
  };
  return updateRow(call, bookingId, { ...booking, ...changes });
}

async function markDigit58CancellationPayment(call, input, userId) {
  const ownerId = text(input.ownerId, 64), bookingId = text(input.bookingId, 40);
  if (!ownerId || !bookingId) throw new Error('Cancellation payment details are missing.');
  const row = await call(`/tablesdb/${DATABASE_ID}/tables/${TABLE_ID}/rows/${encodeURIComponent(bookingId)}`);
  if (row.kind !== digit58BookingKind(ownerId)) throw new Error('This is not a booking.');
  const booking = cleanRow(row);
  if (booking.customerAccountId !== userId) { const denied = new Error("Only this booking's customer can submit its cancellation payment."); denied.code = 403; throw denied; }
  if (booking.status !== 'Cancelled' || Math.max(0, finite(booking.cancellationDueAmount)) <= 0) throw new Error('No cancellation payment is due for this booking.');
  if (booking.cancellationPaymentStatus === 'Paid') return booking;
  const updatedAt = new Date().toISOString();
  return updateRow(call, bookingId, { ...booking, cancellationPaymentStatus: 'Verification', cancellationPaymentMarkedAt: updatedAt, updatedAt });
}

async function confirmDigit58CancellationPayment(call, input, userId, paid) {
  const ownerId = text(input.ownerId, 64), bookingId = text(input.bookingId, 40);
  if (!ownerId || !bookingId) throw new Error('Cancellation payment details are missing.');
  if (ownerId !== userId) { const denied = new Error('Only the store owner can verify this cancellation payment.'); denied.code = 403; throw denied; }
  const row = await call(`/tablesdb/${DATABASE_ID}/tables/${TABLE_ID}/rows/${encodeURIComponent(bookingId)}`);
  if (row.kind !== digit58BookingKind(ownerId)) throw new Error('This is not a booking.');
  const booking = cleanRow(row);
  if (booking.status !== 'Cancelled' || Math.max(0, finite(booking.cancellationDueAmount)) <= 0) throw new Error('No cancellation payment is due for this booking.');
  const updatedAt = new Date().toISOString();
  const changes = paid
    ? { cancellationPaymentStatus: 'Paid', cancellationPaymentConfirmedAt: updatedAt, updatedAt }
    : { cancellationPaymentStatus: 'Due', cancellationPaymentMarkedAt: '', cancellationPaymentConfirmedAt: '', updatedAt };
  return updateRow(call, bookingId, { ...booking, ...changes });
}

async function requestDigit58BuyAgain(call, input, userId) {
  const ownerId = text(input.ownerId, 64), cardId = text(input.cardId, 40);
  if (!ownerId || !cardId) throw new Error('Card details are missing.');
  const row = await call(`/tablesdb/${DATABASE_ID}/tables/${TABLE_ID}/rows/${encodeURIComponent(cardId)}`);
  const card = cleanRow(row);
  if (row.kind !== digit58CardKind(ownerId)) throw new Error('This is not a Refills reminder card.');
  if (card.customerAccountId !== userId) { const denied = new Error("Only this card's customer can request a reorder."); denied.code = 403; throw denied; }
  const changes = { status: 'Buy Requested', buyRequestedAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
  const phone = normalisePhone(input.phone);
  if (phone) changes.phone = phone.slice(0, 15);
  const lat = Number(input.locationLat), lng = Number(input.locationLng);
  if (Number.isFinite(lat) && Number.isFinite(lng)) {
    changes.locationLat = lat; changes.locationLng = lng;
    changes.locationUrl = `https://www.google.com/maps?q=${lat},${lng}`;
  }
  return updateRow(call, cardId, { ...card, ...changes });
}

async function createDigit58Order(call, input, userId, options = {}) {
  const ownerId = text(input.ownerId, 64), storeId = text(input.storeId, 40);
  if (!ownerId || !storeId) throw new Error('Store details are missing.');
  const items = Array.isArray(input.items) ? input.items : [];
  if (!items.length || items.length > 40) throw new Error('Add between 1 and 40 items to your order.');
  const cleanItems = items.map(item => ({
    name: text(item.name, 160), qty: Math.max(1, Math.min(99, Math.floor(finite(item.qty, 1)))),
  })).filter(item => item.name);
  if (!cleanItems.length) throw new Error('Enter at least one item name.');
  const enforceMinimum = options.enforceMinimum !== false;
  const customerOrderValue = Math.max(0, finite(input.customerOrderValue));
  let minimumOrderValueAtOrder = 0, status = 'Requested', minimumApprovalStatus = '';
  if (enforceMinimum) {
    const storeRow = await call(`/tablesdb/${DATABASE_ID}/tables/${TABLE_ID}/rows/${encodeURIComponent(storeId)}`);
    if (storeRow.kind !== digit58StoreKind(ownerId)) throw new Error('This order does not belong to the selected Refills store.');
    const store = cleanRow(storeRow);
    const minimumEnabled = store.minimumOrderEnabled !== false && finite(store.minimumOrderValue) > 0;
    minimumOrderValueAtOrder = minimumEnabled ? Math.max(0, finite(store.minimumOrderValue)) : 0;
    if (minimumOrderValueAtOrder && customerOrderValue < minimumOrderValueAtOrder) {
      if (!input.requestMinimumApproval) {
        throw new Error(`Minimum new order value is ₹${minimumOrderValueAtOrder.toLocaleString('en-IN')}. Ask the store owner for approval if needed.`);
      }
      status = 'Minimum Approval Requested';
      minimumApprovalStatus = 'Requested';
    }
  }
  if (options.initialStatus) { status = options.initialStatus; minimumApprovalStatus = ''; }
  const phone = normalisePhone(input.phone);
  const lat = Number(input.locationLat), lng = Number(input.locationLng), hasLocation = Number.isFinite(lat) && Number.isFinite(lng);
  const createdAt = new Date().toISOString();
  const record = {
    id: digit58Id('order'), ownerId, storeId, customerAccountId: userId,
    customerName: text(input.customerName, 120), customerEmail: text(input.customerEmail, 250),
    phone: phone.slice(0, 15), address: text(input.address, 300),
    locationLat: hasLocation ? lat : '', locationLng: hasLocation ? lng : '',
    locationUrl: hasLocation ? `https://www.google.com/maps?q=${lat},${lng}` : '',
    items: cleanItems, amount: 0, upiUri: '', customerOrderValue,
    minimumOrderValueAtOrder, minimumApprovalStatus,
    previousAmount: Math.max(0, finite(options.previousAmount)),
    reorderedFrom: text(input.reorderedFrom, 36),
    refillCardId: text(options.refillCardId, 40),
    prescriptionUrl: text(input.prescriptionUrl, 1000), prescriptionFileId: text(input.prescriptionFileId, 80),
    prescriptionName: text(input.prescriptionName, 200), prescriptionType: text(input.prescriptionType, 100),
    status, messages: [], createdAt, updatedAt: createdAt,
  };
  const created = await createRow(call, record.id, digit58OrderKind(ownerId), record, rowPermissionsFor([ownerId, userId]));
  return cleanRow(created);
}

async function createDigit58RefillOrder(call, input, userId) {
  const ownerId = text(input.ownerId, 64), cardId = text(input.cardId, 40);
  if (!ownerId || !cardId) throw new Error('Refill card details are missing.');
  const row = await call(`/tablesdb/${DATABASE_ID}/tables/${TABLE_ID}/rows/${encodeURIComponent(cardId)}`);
  const card = cleanRow(row);
  if (row.kind !== digit58CardKind(ownerId)) throw new Error('This is not a Refills reminder card.');
  if (card.customerAccountId !== userId) { const denied = new Error("Only this card's customer can request its refill."); denied.code = 403; throw denied; }
  const existingRows = await listRowsByKind(call, digit58OrderKind(ownerId));
  const existing = existingRows.map(cleanRow).find(order => order.refillCardId === cardId && !['Delivered', 'Rejected'].includes(order.status));
  if (existing) return existing;
  const phone = normalisePhone(input.phone || card.phone);
  const order = await createDigit58Order(call, {
    ownerId, storeId: card.storeId, customerName: text(input.customerName, 120), customerEmail: text(input.customerEmail, 250),
    phone, locationLat: input.locationLat, locationLng: input.locationLng,
    items: [{ name: card.productName, qty: 1 }],
  }, userId, { previousAmount: card.price, refillCardId: cardId, enforceMinimum: false });
  await updateRow(call, cardId, {
    ...card, status: 'Refill Requested', refillRequestedAt: new Date().toISOString(), activeOrderId: order.id,
    phone: phone.slice(0, 15), updatedAt: new Date().toISOString(),
  });
  return order;
}

async function createDigit58Reorder(call, input, userId) {
  const ownerId = text(input.ownerId, 64), sourceOrderId = text(input.orderId, 36);
  if (!ownerId || !sourceOrderId) throw new Error('Previous order details are missing.');
  const row = await call(`/tablesdb/${DATABASE_ID}/tables/${TABLE_ID}/rows/${encodeURIComponent(sourceOrderId)}`);
  if (row.kind !== digit58OrderKind(ownerId)) throw new Error('This is not a Refills order.');
  const previous = cleanRow(row);
  if (previous.customerAccountId !== userId) {
    const denied = new Error('Only this order customer can reorder these items.');
    denied.code = 403;
    throw denied;
  }
  if (!['Delivered', 'Rejected'].includes(previous.status)) {
    throw new Error('Only an order from your history can be reordered.');
  }
  return createDigit58Order(call, {
    ownerId,
    storeId: previous.storeId,
    customerName: previous.customerName,
    customerEmail: previous.customerEmail,
    phone: text(input.phone, 20) || previous.phone,
    locationLat: input.locationLat,
    locationLng: input.locationLng,
    items: previous.items,
    reorderedFrom: previous.id || sourceOrderId,
  }, userId, { previousAmount: previous.amount, enforceMinimum: false });
}

async function createDigit58OwnerOrder(call, input, userId) {
  const ownerId = text(input.ownerId, 64), storeId = text(input.storeId, 40), customerAccountId = text(input.customerAccountId, 64);
  if (userId !== ownerId) { const denied = new Error('Only the store owner can create this order.'); denied.code = 403; throw denied; }
  if (!storeId || !customerAccountId) throw new Error('Customer details are missing.');
  const customerRows = await listRowsByKind(call, digit58CustomerKind(ownerId));
  const customer = customerRows.map(cleanRow).find(row => row.storeId === storeId && row.customerAccountId === customerAccountId);
  if (!customer) throw new Error('This customer is not linked to the selected store.');
  return createDigit58Order(call, {
    ownerId, storeId, items: input.items,
    customerName: customer.customerName, customerEmail: customer.customerEmail,
    phone: customer.phone,
  }, customerAccountId, { enforceMinimum: false, initialStatus: 'Pending Customer Acceptance' });
}

async function acceptDigit58OwnerOrder(call, input, userId) {
  const ownerId = text(input.ownerId, 64), orderId = text(input.orderId, 36);
  if (!ownerId || !orderId) throw new Error('Order details are missing.');
  const row = await call(`/tablesdb/${DATABASE_ID}/tables/${TABLE_ID}/rows/${encodeURIComponent(orderId)}`);
  if (row.kind !== digit58OrderKind(ownerId)) throw new Error('This is not a Refills order.');
  const order = cleanRow(row);
  if (order.customerAccountId !== userId) { const denied = new Error("Only this order's customer can accept it."); denied.code = 403; throw denied; }
  if (order.status !== 'Pending Customer Acceptance') throw new Error('This order has already been handled.');
  const changes = { status: 'Requested', acceptedByCustomerAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
  return updateRow(call, orderId, { ...order, ...changes });
}
async function rejectDigit58OwnerOrder(call, input, userId) {
  const ownerId = text(input.ownerId, 64), orderId = text(input.orderId, 36);
  if (!ownerId || !orderId) throw new Error('Order details are missing.');
  const row = await call(`/tablesdb/${DATABASE_ID}/tables/${TABLE_ID}/rows/${encodeURIComponent(orderId)}`);
  if (row.kind !== digit58OrderKind(ownerId)) throw new Error('This is not a Refills order.');
  const order = cleanRow(row);
  if (order.customerAccountId !== userId) { const denied = new Error("Only this order's customer can reject it."); denied.code = 403; throw denied; }
  if (order.status !== 'Pending Customer Acceptance') throw new Error('This order has already been handled.');
  const rejectedAt = new Date().toISOString();
  const changes = { status: 'Rejected', rejectionReason: 'Declined by customer.', rejectedAt, updatedAt: rejectedAt, pushNotifiedStatus: 'Rejected' };
  return updateRow(call, orderId, { ...order, ...changes });
}

function cleanMedicineInput(input) {
  const name = text(input?.name, 160);
  if (!name) throw new Error('Enter a medicine name.');
  const time = /^([01]\d|2[0-3]):[0-5]\d$/.test(input?.time) ? input.time : '';
  if (!time) throw new Error('Enter a valid medicine time.');
  const days = Math.max(1, Math.min(365, Math.floor(finite(input?.days, 0))));
  if (!days) throw new Error('Enter how many days this medicine should run for.');
  return { id: digit58Id('med'), name, time, days, startedAt: new Date().toISOString() };
}

async function createDigit58Course(call, input, userId) {
  const ownerId = text(input.ownerId, 64), storeId = text(input.storeId, 40), patientName = text(input.patientName, 120);
  if (!ownerId || !storeId) throw new Error('Store details are missing.');
  if (!patientName) throw new Error('Enter the patient name.');
  const medicine = cleanMedicineInput(input.medicine);
  const createdAt = new Date().toISOString();
  const record = {
    id: digit58Id('course'), ownerId, storeId, customerAccountId: userId,
    patientName, medicines: [medicine], createdAt, updatedAt: createdAt,
  };
  const created = await createRow(call, record.id, digit58CourseKind(ownerId), record, rowPermissionsFor([ownerId, userId]));
  return cleanRow(created);
}

async function addDigit58Medicine(call, input, userId) {
  const ownerId = text(input.ownerId, 64), courseId = text(input.courseId, 40);
  if (!ownerId || !courseId) throw new Error('Course details are missing.');
  const row = await call(`/tablesdb/${DATABASE_ID}/tables/${TABLE_ID}/rows/${encodeURIComponent(courseId)}`);
  if (row.kind !== digit58CourseKind(ownerId)) throw new Error('This is not a Refills medicine course.');
  const course = cleanRow(row);
  if (course.customerAccountId !== userId) { const denied = new Error("Only this course's customer can add medicines to it."); denied.code = 403; throw denied; }
  const medicine = cleanMedicineInput(input.medicine);
  const medicines = [...(Array.isArray(course.medicines) ? course.medicines : []), medicine];
  return updateRow(call, courseId, { ...course, medicines, updatedAt: new Date().toISOString() });
}

async function saveDigit58PushSubscription(call, input, userId) {
  const ownerId = text(input.ownerId, 64), storeId = text(input.storeId, 40);
  const subscription = input.subscription || {};
  const endpoint = text(subscription.endpoint, 500);
  const p256dh = text(subscription.keys?.p256dh, 200), auth = text(subscription.keys?.auth, 100);
  if (!ownerId || !storeId) throw new Error('Store details are missing.');
  if (!endpoint || !p256dh || !auth) throw new Error('This push subscription is incomplete.');
  const rowId = pairRowId('push-', ownerId, userId);
  const now = new Date().toISOString();
  const record = {
    id: rowId, ownerId, storeId, customerAccountId: userId,
    endpoint, keys: { p256dh, auth }, createdAt: now, updatedAt: now,
  };
  const existing = await call(`/tablesdb/${DATABASE_ID}/tables/${TABLE_ID}/rows/${encodeURIComponent(rowId)}`).catch(() => null);
  if (existing) return updateRow(call, rowId, record);
  const created = await createRow(call, rowId, digit58PushKind(ownerId), record, rowPermissionsFor([ownerId, userId]));
  return cleanRow(created);
}
async function saveDigit58FcmToken(call, input, userId) {
  const ownerId = text(input.ownerId, 64), storeId = text(input.storeId, 40);
  const token = text(input.token, 300);
  if (!ownerId || !storeId) throw new Error('Store details are missing.');
  if (!token) throw new Error('This device token is incomplete.');
  const rowId = pairRowId('fcm-', ownerId, userId);
  const now = new Date().toISOString();
  const record = { id: rowId, ownerId, storeId, customerAccountId: userId, token, createdAt: now, updatedAt: now };
  const existing = await call(`/tablesdb/${DATABASE_ID}/tables/${TABLE_ID}/rows/${encodeURIComponent(rowId)}`).catch(() => null);
  if (existing) return updateRow(call, rowId, record);
  const created = await createRow(call, rowId, digit58FcmKind(ownerId), record, rowPermissionsFor([ownerId, userId]));
  return cleanRow(created);
}

const DIGIT58_PUSH_STATUSES = ['Priced', 'Rejected', 'Delivered', 'Pending Customer Acceptance'];
function digit58PushMessageForOrder(order) {
  const shortId = text(order.id, 40).slice(-6).toUpperCase();
  const byStatus = {
    Priced: { title: 'Payment ready', body: `Order #${shortId} is priced — open the app to pay.` },
    Rejected: { title: 'Order rejected', body: `Order #${shortId} was rejected by the store.` },
    Delivered: { title: 'Order delivered', body: `Order #${shortId} has been delivered. Enjoy!` },
    'Pending Customer Acceptance': { title: 'New order from the store', body: `Review and accept order #${shortId}.` },
  };
  const message = byStatus[order.status] || { title: 'Order update', body: `Order #${shortId}: ${order.status}` };
  return { ...message, url: `/digit58/#store&owner=${order.ownerId}&store=${order.storeId}` };
}
let fcmAppInitialized = false;
function ensureFcmApp() {
  if (fcmAppInitialized) return getFirebaseApps().length > 0;
  fcmAppInitialized = true;
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  if (!raw) return false;
  try {
    const serviceAccount = JSON.parse(raw);
    initializeFirebaseApp({ credential: firebaseCert(serviceAccount) });
    return true;
  } catch {
    return false;
  }
}

async function sendDigit58PushNotifications(call, error) {
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  const webPushReady = Boolean(privateKey);
  if (webPushReady) webpush.setVapidDetails('mailto:support@g58.in', VAPID_PUBLIC_KEY, privateKey);
  const fcmReady = ensureFcmApp();
  if (!webPushReady && !fcmReady) return { skipped: true, reason: 'Neither VAPID_PRIVATE_KEY nor FIREBASE_SERVICE_ACCOUNT_JSON is set.' };
  const [ownerRows, entitlementRows] = await Promise.all([
    listRowsByKind(call, DIGIT58_OWNER_KIND).catch(() => []),
    listRowsByKind(call, DIGIT58_ENTITLEMENT_KIND).catch(() => []),
  ]);
  const ownerIds = [...new Set([
    ...ownerRows.map(row => text(cleanRow(row).ownerId, 64)),
    ...entitlementRows.map(row => text(cleanRow(row).ownerId, 64)),
  ].filter(Boolean))];
  let sent = 0, expired = 0, failed = 0;
  for (const ownerId of ownerIds) {
    const [orderRows, pushRows, fcmRows] = await Promise.all([
      listRowsByKind(call, digit58OrderKind(ownerId)).catch(() => []),
      listRowsByKind(call, digit58PushKind(ownerId)).catch(() => []),
      listRowsByKind(call, digit58FcmKind(ownerId)).catch(() => []),
    ]);
    const subscriptionsByCustomer = new Map(pushRows.map(cleanRow).map(row => [row.customerAccountId, row]));
    const fcmTokensByCustomer = new Map(fcmRows.map(cleanRow).map(row => [row.customerAccountId, row]));
    for (const raw of orderRows) {
      const order = cleanRow(raw);
      if (!DIGIT58_PUSH_STATUSES.includes(order.status) || order.pushNotifiedStatus === order.status) continue;
      const subscriptionRow = subscriptionsByCustomer.get(order.customerAccountId);
      const fcmTokenRow = fcmTokensByCustomer.get(order.customerAccountId);
      if (!subscriptionRow && !fcmTokenRow) continue;
      const message = digit58PushMessageForOrder(order);
      if (webPushReady && subscriptionRow) {
        try {
          await webpush.sendNotification(
            { endpoint: subscriptionRow.endpoint, keys: subscriptionRow.keys },
            JSON.stringify(message)
          );
          sent += 1;
        } catch (caught) {
          if (caught?.statusCode === 404 || caught?.statusCode === 410) {
            expired += 1;
            await removeRow(call, subscriptionRow.id || subscriptionRow.$id).catch(() => {});
            subscriptionsByCustomer.delete(order.customerAccountId);
          } else {
            failed += 1;
            error(`Push send failed for order ${order.id}: ${caught?.message || caught}`);
          }
        }
      }
      if (fcmReady && fcmTokenRow) {
        try {
          await getMessaging().send({
            token: fcmTokenRow.token,
            notification: { title: message.title, body: message.body },
            data: { url: message.url },
            android: { priority: 'high', notification: { sound: 'default' } },
          });
          sent += 1;
        } catch (caught) {
          if (caught?.code === 'messaging/registration-token-not-registered' || caught?.code === 'messaging/invalid-registration-token') {
            expired += 1;
            await removeRow(call, fcmTokenRow.id || fcmTokenRow.$id).catch(() => {});
            fcmTokensByCustomer.delete(order.customerAccountId);
          } else {
            failed += 1;
            error(`FCM send failed for order ${order.id}: ${caught?.message || caught}`);
          }
        }
      }
      await updateRow(call, order.id, { ...order, pushNotifiedStatus: order.status }).catch(() => {});
    }
  }
  return { sent, expired, failed };
}

export default async ({ req, res, error }) => {
  if (req.headers['x-appwrite-trigger'] === 'schedule') {
    try {
      const call = appwriteClient(req);
      const businessCards = await purgeInactiveBusinessCards(call);
      const promotions = await purgeExpiredDigit58Promotions(call);
      const dataRetention = await purgeExpiredOwnerData(call);
      const pushNotifications = await sendDigit58PushNotifications(call, error).catch(caught => ({ error: caught?.message || String(caught) }));
      return res.json({ ok: true, scheduled: true, ...businessCards, promotions, dataRetention, pushNotifications });
    } catch (caught) {
      error(`Scheduled business-card cleanup failed: ${caught?.message || caught}`);
      return res.json({ ok: false, error: caught?.message || 'Scheduled business-card cleanup failed.' }, 500);
    }
  }
  if (req.method === 'GET') return res.json({ ok: true, service: 'Gravity58 secure digital orders' });
  if (req.method !== 'POST') return res.json({ ok: false, error: 'Method not allowed.' }, 405);
  const userId = text(req.headers['x-appwrite-user-id'], 64);
  if (!userId) return res.json({ ok: false, error: 'A secure customer session is required. Reload the menu and try again.' }, 401);
  try {
    const requestBody = req.bodyJson || JSON.parse(req.bodyText || '{}');
    if (requestBody?.action === 'owner-verify-history-delete') {
      const call = appwriteClient(req);
      return res.json({ ok: true, ...(await verifyOrDeleteOwnerHistory(req, call, requestBody, userId, false)) });
    }
    if (requestBody?.action === 'owner-backup-delete-history') {
      const call = appwriteClient(req);
      return res.json({ ok: true, ...(await verifyOrDeleteOwnerHistory(req, call, requestBody, userId, true)) });
    }
    if (requestBody?.action === 'confirm-payment') {
      const call = appwriteClient(req);
      const ownerId = text(requestBody.ownerId, 64), orderId = text(requestBody.orderId, 36);
      if (!ownerId || !orderId) throw new Error('Order approval details are missing.');
      return res.json({ ok: true, order: await confirmPayment(call, orderId, ownerId, userId) });
    }
    if (requestBody?.action === 'create-subscription') {
      const call = appwriteClient(req);
      const subscription = await createSubscription(call, requestBody.subscription || {}, userId, req.headers['x-appwrite-user-email']);
      return res.json({ ok: true, subscription }, 201);
    }
    if (requestBody?.action === 'send-subscription-link') {
      const call = appwriteClient(req);
      return res.json({ ok: true, subscription: await sendSubscriptionLink(call, requestBody.subscription || {}, userId) });
    }
    if (requestBody?.action === 'submit-subscription-payment') {
      const call = appwriteClient(req);
      return res.json({ ok: true, subscription: await submitSubscriptionPayment(call, requestBody.subscription || {}, userId) });
    }
    if (requestBody?.action === 'confirm-subscription-payment') {
      const call = appwriteClient(req);
      return res.json({ ok: true, subscription: await confirmSubscriptionPayment(call, requestBody.subscription || {}, userId) });
    }
    if (requestBody?.action === 'digit58-link-customer') {
      const call = appwriteClient(req);
      const customer = await linkDigit58Customer(call, requestBody, userId);
      return res.json({ ok: true, customer, stores: await listDigit58CustomerPortalStores(call, userId) });
    }
    if (requestBody?.action === 'digit58-list-customer-stores') {
      const call = appwriteClient(req);
      return res.json({ ok: true, stores: await listDigit58CustomerPortalStores(call, userId) });
    }
    if (requestBody?.action === 'digit58-create-card') {
      const call = appwriteClient(req);
      return res.json({ ok: true, card: await createDigit58Card(call, requestBody, userId) }, 201);
    }
    if (requestBody?.action === 'digit58-request-buy-again') {
      const call = appwriteClient(req);
      return res.json({ ok: true, card: await requestDigit58BuyAgain(call, requestBody, userId) });
    }
    if (requestBody?.action === 'digit58-create-order') {
      const call = appwriteClient(req);
      return res.json({ ok: true, order: await createDigit58Order(call, requestBody, userId) }, 201);
    }
    if (requestBody?.action === 'digit58-create-booking') {
      const call = appwriteClient(req);
      return res.json({ ok: true, booking: await createDigit58Booking(call, requestBody, userId) }, 201);
    }
    if (requestBody?.action === 'digit58-get-slot-status') {
      const call = appwriteClient(req);
      return res.json({ ok: true, ...(await getDigit58SlotStatus(call, requestBody)) });
    }
    if (requestBody?.action === 'digit58-owner-create-booking') {
      const call = appwriteClient(req);
      return res.json({ ok: true, booking: await createDigit58OwnerBooking(call, requestBody, userId) }, 201);
    }
    if (requestBody?.action === 'digit58-accept-owner-booking') {
      const call = appwriteClient(req);
      return res.json({ ok: true, booking: await acceptDigit58OwnerBooking(call, requestBody, userId) });
    }
    if (requestBody?.action === 'digit58-reject-owner-booking') {
      const call = appwriteClient(req);
      return res.json({ ok: true, booking: await rejectDigit58OwnerBooking(call, requestBody, userId) });
    }
    if (requestBody?.action === 'digit58-cancel-customer-booking') {
      const call = appwriteClient(req);
      return res.json({ ok: true, booking: await cancelDigit58CustomerBooking(call, requestBody, userId) });
    }
    if (requestBody?.action === 'digit58-mark-cancellation-payment') {
      const call = appwriteClient(req);
      return res.json({ ok: true, booking: await markDigit58CancellationPayment(call, requestBody, userId) });
    }
    if (requestBody?.action === 'digit58-confirm-cancellation-payment') {
      const call = appwriteClient(req);
      return res.json({ ok: true, booking: await confirmDigit58CancellationPayment(call, requestBody, userId, true) });
    }
    if (requestBody?.action === 'digit58-reopen-cancellation-payment') {
      const call = appwriteClient(req);
      return res.json({ ok: true, booking: await confirmDigit58CancellationPayment(call, requestBody, userId, false) });
    }
    if (requestBody?.action === 'digit58-create-refill-order') {
      const call = appwriteClient(req);
      return res.json({ ok: true, order: await createDigit58RefillOrder(call, requestBody, userId) }, 201);
    }
    if (requestBody?.action === 'digit58-reorder') {
      const call = appwriteClient(req);
      return res.json({ ok: true, order: await createDigit58Reorder(call, requestBody, userId) }, 201);
    }
    if (requestBody?.action === 'digit58-owner-create-order') {
      const call = appwriteClient(req);
      return res.json({ ok: true, order: await createDigit58OwnerOrder(call, requestBody, userId) }, 201);
    }
    if (requestBody?.action === 'digit58-accept-owner-order') {
      const call = appwriteClient(req);
      return res.json({ ok: true, order: await acceptDigit58OwnerOrder(call, requestBody, userId) });
    }
    if (requestBody?.action === 'digit58-reject-owner-order') {
      const call = appwriteClient(req);
      return res.json({ ok: true, order: await rejectDigit58OwnerOrder(call, requestBody, userId) });
    }
    if (requestBody?.action === 'digit58-create-course') {
      const call = appwriteClient(req);
      return res.json({ ok: true, course: await createDigit58Course(call, requestBody, userId) }, 201);
    }
    if (requestBody?.action === 'digit58-add-medicine') {
      const call = appwriteClient(req);
      return res.json({ ok: true, course: await addDigit58Medicine(call, requestBody, userId) });
    }
    if (requestBody?.action === 'digit58-save-push-subscription') {
      const call = appwriteClient(req);
      return res.json({ ok: true, subscription: await saveDigit58PushSubscription(call, requestBody, userId) }, 201);
    }
    if (requestBody?.action === 'digit58-save-fcm-token') {
      const call = appwriteClient(req);
      return res.json({ ok: true, token: await saveDigit58FcmToken(call, requestBody, userId) }, 201);
    }
    if (requestBody?.action === 'raise-support-ticket') {
      const call = appwriteClient(req);
      return res.json({ ok: true, ticket: await raiseSupportTicket(call, requestBody, userId) }, 201);
    }
    if (requestBody?.action === 'digit58-accept-policy') {
      const call = appwriteClient(req);
      return res.json({ ok: true, entitlement: await acceptDigit58Policy(call, requestBody, userId) });
    }
    if (requestBody?.action === 'digit58-create-subscription-checkout') {
      const call = appwriteClient(req);
      const checkout = await createDigit58SubscriptionCheckout(call, requestBody, userId);
      return res.json({ ok: true, ...checkout }, 201);
    }
    if (requestBody?.action === 'digit58-cancel-subscription') {
      const call = appwriteClient(req);
      return res.json({ ok: true, entitlement: await cancelDigit58Subscription(call, requestBody, userId) });
    }
    if (requestBody?.action === 'digit58-get-referral-code') {
      const call = appwriteClient(req);
      return res.json({ ok: true, ...(await getDigit58ReferralCode(call, requestBody, userId)) });
    }
    if (requestBody?.action === 'digit58-admin-delete-entitlement') {
      const call = appwriteClient(req);
      return res.json({ ok: true, ...(await deleteDigit58Entitlement(call, requestBody, userId)) });
    }
    if (requestBody?.action === 'digit58-set-store-suspended') {
      const call = appwriteClient(req);
      return res.json({ ok: true, store: await setDigit58StoreSuspended(call, requestBody, userId) });
    }
    if (requestBody?.action === 'touch-business-card') {
      const call = appwriteClient(req);
      return res.json({ ok: true, business: await touchBusinessCard(call, requestBody) });
    }
    if (requestBody?.action === 'rate-business-card') {
      const call = appwriteClient(req);
      const result = await rateBusinessCard(call, requestBody, userId);
      return res.json({ ok: true, ...result });
    }
    if (requestBody?.action === 'delete-business-rating') {
      const call = appwriteClient(req);
      return res.json({ ok: true, business: await deleteBusinessRating(call, requestBody, userId) });
    }
    const input = requestBody?.order || requestBody || {};
    const ownerId = text(input.cloudOwnerId || input.ownerId, 64);
    const restaurantId = text(input.restaurantId, 64);
    if (!ownerId || !restaurantId) throw new Error('Restaurant details are missing. Reload the menu and try again.');
    const call = appwriteClient(req);
    const menuRow = await call(`/tablesdb/${DATABASE_ID}/tables/${TABLE_ID}/rows/${encodeURIComponent(restaurantId)}`);
    const menu = parseMenu(menuRow, ownerId, restaurantId);
    await validateReceipt(call, input, userId);
    {
      const phone = normalisePhone(input.phone);
      if (phone.length < 10 || phone.length > 15) throw new Error('Enter a valid customer phone number with 10 to 15 digits.');
      const serviceMode = input.serviceMode === 'table' ? 'table' : 'takeaway';
      const tableNumber = text(input.tableNumber, 50);
      const existing = (await listRowsByKind(call, orderKind(ownerId))).map(cleanRow).find(order =>
        !order.tokenReservation && order.restaurantId === restaurantId &&
        normalisePhone(order.phone) === phone && order.serviceMode === serviceMode &&
        (serviceMode !== 'table' || order.tableNumber === tableNumber) && order.orderDay === indiaDay() &&
        ['Pending', 'Accepted', 'Preparing', 'Ready'].includes(order.status));
      if (existing) {
        const incoming = buildOrder({ ...input, phone }, menu, userId, existing.tokenNumber, existing.tokenReservationId);
        const merged = await updateRow(call, existing.id || existing.$id, mergeOrder(existing, incoming, menu.restaurant));
        return res.json({ ok: true, order: merged, accumulated: true });
      }
    }
    const reservation = await reserveToken(call, ownerId, restaurantId, userId);
    try {
      const order = buildOrder(input, menu, userId, reservation.number, reservation.id);
      const created = await createRow(call, order.id, orderKind(ownerId), order, rowPermissions(userId, ownerId));
      return res.json({ ok: true, order: cleanRow(created) }, 201);
    } catch (orderError) {
      await removeRow(call, reservation.id);
      throw orderError;
    }
  } catch (caught) {
    error(`Secure order failed: ${caught?.message || caught}`);
    const status = caught?.code === 403 ? 403 : caught?.code === 409 ? 409 : caught?.code === 404 ? 404 : caught?.code === 410 ? 410 : 400;
    return res.json({ ok: false, error: caught?.message || 'Order could not be placed.' }, status);
  }
};
