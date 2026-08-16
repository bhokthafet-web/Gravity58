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
const DIGIT58_OWNER_KIND = 'digit58_owners';
const DIGIT58_ENTITLEMENT_KIND = 'digit58_entitlements';
const ADMIN_TEAM_ID = '6a776960001ca2fb66bf';
const SUPPORT_KIND = 'support_tickets';
const PUBLIC_POSTS_KIND = 'posts';
const BUSINESS_CARD_RETENTION_MS = 30 * 24 * 60 * 60 * 1000;

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
const digit58StoreKind = ownerId => safeKindId(DIGIT58_STORE_KIND_PREFIX, ownerId, 40);
const digit58PromotionKind = ownerId => safeKindId(DIGIT58_PROMOTION_KIND_PREFIX, ownerId, 40);
const digit58CourseKind = ownerId => safeKindId(DIGIT58_COURSE_KIND_PREFIX, ownerId, 39);
const digit58EntitlementRowId = ownerId => `d58-${String(ownerId).slice(0, 30)}`;
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
    phone: phone.slice(0, 15),
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

export default async ({ req, res, error }) => {
  if (req.headers['x-appwrite-trigger'] === 'schedule') {
    try {
      const call = appwriteClient(req);
      const businessCards = await purgeInactiveBusinessCards(call);
      const promotions = await purgeExpiredDigit58Promotions(call);
      return res.json({ ok: true, scheduled: true, ...businessCards, promotions });
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
    if (requestBody?.action === 'digit58-create-course') {
      const call = appwriteClient(req);
      return res.json({ ok: true, course: await createDigit58Course(call, requestBody, userId) }, 201);
    }
    if (requestBody?.action === 'digit58-add-medicine') {
      const call = appwriteClient(req);
      return res.json({ ok: true, course: await addDigit58Medicine(call, requestBody, userId) });
    }
    if (requestBody?.action === 'raise-support-ticket') {
      const call = appwriteClient(req);
      return res.json({ ok: true, ticket: await raiseSupportTicket(call, requestBody, userId) }, 201);
    }
    if (requestBody?.action === 'digit58-accept-policy') {
      const call = appwriteClient(req);
      return res.json({ ok: true, entitlement: await acceptDigit58Policy(call, requestBody, userId) });
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
