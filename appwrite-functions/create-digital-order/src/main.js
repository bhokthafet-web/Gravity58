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
const ADMIN_TEAM_ID = '6a776960001ca2fb66bf';

const text = (value, max = 250) => String(value ?? '').trim().slice(0, max);
const finite = (value, fallback = 0) => Number.isFinite(Number(value)) ? Number(value) : fallback;
const normalisePhone = value => String(value || '').replace(/\D/g, '');
const indiaDay = (value = new Date()) => new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit',
}).format(new Date(value));
const safeKindId = (prefix, ownerId, maxOwnerLength) => `${prefix}${String(ownerId).replace(/[^a-zA-Z0-9._-]/g, '-').slice(0, maxOwnerLength)}`;
const orderKind = ownerId => safeKindId(ORDER_KIND_PREFIX, ownerId, 47);
const tokenKind = ownerId => safeKindId(TOKEN_KIND_PREFIX, ownerId, 47);
const menuKind = ownerId => safeKindId(MENU_KIND_PREFIX, ownerId, 48);
const subscriptionKind = ownerId => safeKindId(SUBSCRIPTION_KIND_PREFIX, ownerId, 43);
const digit58CustomerKind = ownerId => safeKindId(DIGIT58_CUSTOMER_KIND_PREFIX, ownerId, 36);
const digit58CardKind = ownerId => safeKindId(DIGIT58_CARD_KIND_PREFIX, ownerId, 40);
const digit58OrderKind = ownerId => safeKindId(DIGIT58_ORDER_KIND_PREFIX, ownerId, 40);
const formatToken = number => String(number).padStart(3, '0');
const cleanRow = row => {
  let payload = {};
  try { payload = JSON.parse(row?.payload || '{}') || {}; } catch {}
  return { ...row, ...payload, id: payload.id || row?.$id };
};

function appwriteClient(req) {
  const endpoint = process.env.APPWRITE_FUNCTION_API_ENDPOINT || 'https://sgp.cloud.appwrite.io/v1';
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
  input.paymentReceiptUrl = `${process.env.APPWRITE_FUNCTION_API_ENDPOINT || 'https://sgp.cloud.appwrite.io/v1'}/storage/buckets/${MEDIA_BUCKET_ID}/files/${encodeURIComponent(fileId)}/view?project=${encodeURIComponent(process.env.APPWRITE_FUNCTION_PROJECT_ID)}`;
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

function buildDigit58UpiUri(upiId, payeeName, amount, refId) {
  if (!upiId) return '';
  const reference = `58${String(refId || Date.now()).replace(/\D/g, '').slice(-30)}`.slice(0, 35);
  const params = new URLSearchParams({ pa: upiId, pn: payeeName || upiId, tr: reference, tn: `Digit58 order ${refId}`, am: Number(amount || 0).toFixed(2), cu: 'INR' });
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

async function requestDigit58BuyAgain(call, input, userId) {
  const ownerId = text(input.ownerId, 64), cardId = text(input.cardId, 40);
  if (!ownerId || !cardId) throw new Error('Card details are missing.');
  const row = await call(`/tablesdb/${DATABASE_ID}/tables/${TABLE_ID}/rows/${encodeURIComponent(cardId)}`);
  const card = cleanRow(row);
  if (row.kind !== digit58CardKind(ownerId)) throw new Error('This is not a Digit58 reminder card.');
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

async function createDigit58Order(call, input, userId) {
  const ownerId = text(input.ownerId, 64), storeId = text(input.storeId, 40);
  if (!ownerId || !storeId) throw new Error('Store details are missing.');
  const items = Array.isArray(input.items) ? input.items : [];
  if (!items.length || items.length > 40) throw new Error('Add between 1 and 40 items to your order.');
  const cleanItems = items.map(item => ({
    name: text(item.name, 160), qty: Math.max(1, Math.min(99, Math.floor(finite(item.qty, 1)))),
  })).filter(item => item.name);
  if (!cleanItems.length) throw new Error('Enter at least one item name.');
  const phone = normalisePhone(input.phone);
  const lat = Number(input.locationLat), lng = Number(input.locationLng), hasLocation = Number.isFinite(lat) && Number.isFinite(lng);
  const createdAt = new Date().toISOString();
  const record = {
    id: digit58Id('order'), ownerId, storeId, customerAccountId: userId,
    customerName: text(input.customerName, 120), customerEmail: text(input.customerEmail, 250),
    phone: phone.slice(0, 15),
    locationLat: hasLocation ? lat : '', locationLng: hasLocation ? lng : '',
    locationUrl: hasLocation ? `https://www.google.com/maps?q=${lat},${lng}` : '',
    items: cleanItems, amount: 0, upiUri: '',
    prescriptionUrl: text(input.prescriptionUrl, 1000), prescriptionFileId: text(input.prescriptionFileId, 80),
    prescriptionName: text(input.prescriptionName, 200), prescriptionType: text(input.prescriptionType, 100),
    status: 'Requested', messages: [], createdAt, updatedAt: createdAt,
  };
  const created = await createRow(call, record.id, digit58OrderKind(ownerId), record, rowPermissionsFor([ownerId, userId]));
  return cleanRow(created);
}

export default async ({ req, res, error }) => {
  if (req.method === 'GET') return res.json({ ok: true, service: 'Gravity58 secure digital orders' });
  if (req.method !== 'POST') return res.json({ ok: false, error: 'Method not allowed.' }, 405);
  const userId = text(req.headers['x-appwrite-user-id'], 64);
  if (!userId) return res.json({ ok: false, error: 'A secure customer session is required. Reload the menu and try again.' }, 401);
  try {
    const requestBody = req.bodyJson || JSON.parse(req.bodyText || '{}');
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
      return res.json({ ok: true, customer: await linkDigit58Customer(call, requestBody, userId) });
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
    const status = caught?.code === 403 ? 403 : caught?.code === 409 ? 409 : caught?.code === 404 ? 404 : 400;
    return res.json({ ok: false, error: caught?.message || 'Order could not be placed.' }, status);
  }
};
