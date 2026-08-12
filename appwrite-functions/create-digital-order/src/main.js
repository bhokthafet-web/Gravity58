const DATABASE_ID = 'gravity58';
const TABLE_ID = 'g58_records';
const MEDIA_BUCKET_ID = 'ad-media';
const MENU_KIND_PREFIX = 'digital_menu_';
const ORDER_KIND_PREFIX = 'digital_order_';
const TOKEN_KIND_PREFIX = 'digital_token_';

const text = (value, max = 250) => String(value ?? '').trim().slice(0, max);
const finite = (value, fallback = 0) => Number.isFinite(Number(value)) ? Number(value) : fallback;
const indiaDay = (value = new Date()) => new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit',
}).format(new Date(value));
const safeKindId = (prefix, ownerId, maxOwnerLength) => `${prefix}${String(ownerId).replace(/[^a-zA-Z0-9._-]/g, '-').slice(0, maxOwnerLength)}`;
const orderKind = ownerId => safeKindId(ORDER_KIND_PREFIX, ownerId, 47);
const tokenKind = ownerId => safeKindId(TOKEN_KIND_PREFIX, ownerId, 47);
const menuKind = ownerId => safeKindId(MENU_KIND_PREFIX, ownerId, 48);
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

function parseMenu(row, ownerId, restaurantId) {
  if (row?.kind !== menuKind(ownerId)) throw new Error('This restaurant menu is not owned by the selected restaurant account.');
  let payload;
  try { payload = JSON.parse(row.payload || '{}'); } catch { throw new Error('The restaurant menu data is invalid.'); }
  const restaurant = payload.restaurant?.id === restaurantId
    ? payload.restaurant
    : (payload.restaurants || []).find(item => item.id === restaurantId);
  if (!restaurant) throw new Error('This restaurant is no longer available.');
  if (restaurant.open === false || restaurant.accepting === false) throw new Error('This restaurant is not accepting orders right now.');
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
    tableNumber: text(input.tableNumber, 50), phone: text(input.phone, 30), items,
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
    status: paymentMethod === 'online' ? 'Payment Verification' : 'Pending', createdAt,
  };
}

function rowPermissions(userId, ownerId) {
  return [...new Set([userId, ownerId].filter(Boolean).flatMap(id => [
    `read(\"user:${id}\")`, `update(\"user:${id}\")`, `delete(\"user:${id}\")`,
  ]))];
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
  for (let number = 1; number <= 9999; number += 1) {
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
    const input = requestBody?.order || requestBody || {};
    const ownerId = text(input.cloudOwnerId || input.ownerId, 64);
    const restaurantId = text(input.restaurantId, 64);
    if (!ownerId || !restaurantId) throw new Error('Restaurant details are missing. Reload the menu and try again.');
    const call = appwriteClient(req);
    const menuRow = await call(`/tablesdb/${DATABASE_ID}/tables/${TABLE_ID}/rows/${encodeURIComponent(restaurantId)}`);
    const menu = parseMenu(menuRow, ownerId, restaurantId);
    await validateReceipt(call, input, userId);
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
