import test from 'node:test';
import assert from 'node:assert/strict';
import createDigitalOrder from '../../appwrite-functions/create-digital-order/src/main.js';

const ownerId = 'owner_123';
const customerId = 'customer_456';
const restaurantId = 'restaurant_1';
const indiaTestDay = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
const menuPayload = {
  restaurant: { id: restaurantId, name: 'Test Kitchen', open: true, accepting: true, tax: 5, service: 2, paymentEnabled: true, upiId: 'test@upi' },
  items: [{ id: 'item_1', restaurantId, name: 'Chicken Fry', price: 120, available: true }],
};
const menuRow = { $id: restaurantId, kind: `digital_menu_${ownerId}`, payload: JSON.stringify(menuPayload) };
const inputOrder = {
  id: 'GR58-UAT-1001', restaurantId, ownerId, cloudOwnerId: ownerId, customer: 'Table 1',
  customerName: 'UAT Customer', serviceMode: 'table', tableNumber: '1', phone: '9999999999',
  items: [{ id: 'item_1', name: 'Changed by browser', qty: 2, price: 1 }], paymentMethod: 'counter',
};

function functionContext(order = inputOrder, headers = { 'x-appwrite-key': 'dynamic-key', 'x-appwrite-user-id': customerId }) {
  return {
    req: { method: 'POST', headers, bodyJson: { order } },
    res: { json: (body, status = 200) => ({ body, status }) },
    error: () => {},
  };
}

test('secure order function creates owner/customer-private order with server totals', async () => {
  const previousFetch = globalThis.fetch;
  const requests = [];
  globalThis.fetch = async (url, options = {}) => {
    const body = options.body ? JSON.parse(options.body) : null;
    requests.push({ url: String(url), method: options.method || 'GET', body });
    if ((options.method || 'GET') === 'GET') return new Response(JSON.stringify(menuRow), { status: 200 });
    if (body?.data?.kind?.startsWith('digital_token_')) return new Response(JSON.stringify({ $id: body.rowId, ...body.data }), { status: 201 });
    if (body?.data?.kind?.startsWith('digital_order_')) return new Response(JSON.stringify({ $id: body.rowId, ...body.data }), { status: 201 });
    throw new Error(`Unexpected request ${url}`);
  };
  process.env.APPWRITE_FUNCTION_PROJECT_ID = 'project_1';
  try {
    const response = await createDigitalOrder(functionContext());
    assert.equal(response.status, 201);
    assert.equal(response.body.ok, true);
    assert.equal(response.body.order.subtotal, 240);
    assert.equal(response.body.order.tax, 12);
    assert.equal(response.body.order.serviceCharge, 4.8);
    assert.equal(response.body.order.total, 256.8);
    assert.equal(response.body.order.items[0].name, 'Chicken Fry');
    assert.equal(response.body.order.customerAccountId, customerId);
    assert.equal(response.body.order.tokenNumber, 1);
    const orderRequest = requests.find(request => request.body?.data?.kind?.startsWith('digital_order_'));
    assert.ok(orderRequest.body.permissions.includes(`read(\"user:${customerId}\")`));
    assert.ok(orderRequest.body.permissions.includes(`read(\"user:${ownerId}\")`));
    assert.ok(orderRequest.body.permissions.some(permission => permission.startsWith('read("team:')));
    assert.ok(!orderRequest.body.permissions.some(permission => permission.includes('users')));
  } finally {
    globalThis.fetch = previousFetch;
  }
});

test('secure order function requires an authenticated or anonymous Appwrite customer session', async () => {
  const response = await createDigitalOrder(functionContext(inputOrder, { 'x-appwrite-key': 'dynamic-key' }));
  assert.equal(response.status, 401);
  assert.match(response.body.error, /secure customer session/i);
});

test('receipt image alone is sufficient and is verified against the customer session', async () => {
  const previousFetch = globalThis.fetch;
  globalThis.fetch = async (url, options = {}) => {
    const body = options.body ? JSON.parse(options.body) : null;
    if ((options.method || 'GET') === 'GET' && String(url).includes('/storage/')) return new Response(JSON.stringify({ $id: 'receipt_1', name: 'receipt.png', mimeType: 'image/png', $permissions: [`delete(\"user:${customerId}\")`] }), { status: 200 });
    if ((options.method || 'GET') === 'GET') return new Response(JSON.stringify(menuRow), { status: 200 });
    if (body?.data?.kind?.startsWith('digital_token_')) return new Response(JSON.stringify({ $id: body.rowId, ...body.data }), { status: 201 });
    if (body?.data?.kind?.startsWith('digital_order_')) return new Response(JSON.stringify({ $id: body.rowId, ...body.data }), { status: 201 });
    throw new Error(`Unexpected request ${url}`);
  };
  process.env.APPWRITE_FUNCTION_PROJECT_ID = 'project_1';
  try {
    const response = await createDigitalOrder(functionContext({ ...inputOrder, paymentMethod: 'online', paymentReceiptFileId: 'receipt_1', transactionId: '' }));
    assert.equal(response.status, 201);
    assert.equal(response.body.order.status, 'Payment Verification');
    assert.equal(response.body.order.transactionId, '');
    assert.equal(response.body.order.paymentReceiptName, 'receipt.png');
  } finally {
    globalThis.fetch = previousFetch;
  }
});

test('secure order function removes its token reservation when order creation fails', async () => {
  const previousFetch = globalThis.fetch;
  const requests = [];
  globalThis.fetch = async (url, options = {}) => {
    const body = options.body ? JSON.parse(options.body) : null;
    requests.push({ url: String(url), method: options.method || 'GET', body });
    if ((options.method || 'GET') === 'GET') return new Response(JSON.stringify(menuRow), { status: 200 });
    if (options.method === 'DELETE') return new Response(null, { status: 204 });
    if (body?.data?.kind?.startsWith('digital_token_')) return new Response(JSON.stringify({ $id: body.rowId }), { status: 201 });
    return new Response(JSON.stringify({ message: 'Injected order failure' }), { status: 500 });
  };
  process.env.APPWRITE_FUNCTION_PROJECT_ID = 'project_1';
  try {
    const response = await createDigitalOrder(functionContext());
    assert.equal(response.status, 400);
    assert.match(response.body.error, /Injected order failure/);
    assert.ok(requests.some(request => request.method === 'DELETE' && request.url.includes('/rows/tok-')));
  } finally {
    globalThis.fetch = previousFetch;
  }
});

test('secure order function continues the durable restaurant token sequence', async () => {
  const previousFetch = globalThis.fetch;
  const requests = [];
  const previousOrder = { ...inputOrder, id: 'GR58-OLD-1001', tokenNumber: 7, orderDay: new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date()) };
  globalThis.fetch = async (url, options = {}) => {
    const body = options.body ? JSON.parse(options.body) : null;
    requests.push({ url: String(url), method: options.method || 'GET', body });
    if ((options.method || 'GET') === 'GET' && String(url).includes('/rows?')) return new Response(JSON.stringify({ rows: [{ $id: previousOrder.id, kind: `digital_order_${ownerId}`, payload: JSON.stringify(previousOrder) }] }), { status: 200 });
    if ((options.method || 'GET') === 'GET') return new Response(JSON.stringify(menuRow), { status: 200 });
    if (body?.data?.kind?.startsWith('digital_token_')) return new Response(JSON.stringify({ $id: body.rowId, ...body.data }), { status: 201 });
    if (body?.data?.kind?.startsWith('digital_order_')) return new Response(JSON.stringify({ $id: body.rowId, ...body.data }), { status: 201 });
    throw new Error(`Unexpected request ${url}`);
  };
  process.env.APPWRITE_FUNCTION_PROJECT_ID = 'project_1';
  try {
    const response = await createDigitalOrder(functionContext());
    assert.equal(response.status, 201);
    assert.equal(response.body.order.tokenNumber, 8);
    assert.ok(requests.some(request => request.body?.rowId?.endsWith('-008')));
  } finally {
    globalThis.fetch = previousFetch;
  }
});

test('secure order function accumulates active counter items for the same customer phone', async () => {
  const previousFetch = globalThis.fetch;
  const requests = [];
  const existing = {
    ...inputOrder, id: 'GR58-OPEN-1001', tokenNumber: 3, tokenReservationId: 'tok-003',
    customerAccountId: customerId, paymentMethod: 'counter', status: 'Accepted', orderDay: indiaTestDay(),
    phone: '9999999999', items: [{ id: 'item_1', name: 'Chicken Fry', qty: 1, price: 120 }],
    subtotal: 120, tax: 6, serviceCharge: 2.4, total: 128.4,
  };
  globalThis.fetch = async (url, options = {}) => {
    const method = options.method || 'GET', body = options.body ? JSON.parse(options.body) : null, target = String(url);
    requests.push({ url: target, method, body });
    if (method === 'GET' && target.includes('/rows?')) return new Response(JSON.stringify({ rows: [{ $id: existing.id, kind: `digital_order_${ownerId}`, payload: JSON.stringify(existing) }] }), { status: 200 });
    if (method === 'GET') return new Response(JSON.stringify(menuRow), { status: 200 });
    if (method === 'PATCH') return new Response(JSON.stringify({ $id: existing.id, kind: `digital_order_${ownerId}`, payload: body.data.payload }), { status: 200 });
    throw new Error(`Unexpected request ${url}`);
  };
  process.env.APPWRITE_FUNCTION_PROJECT_ID = 'project_1';
  try {
    const response = await createDigitalOrder(functionContext());
    assert.equal(response.status, 200);
    assert.equal(response.body.accumulated, true);
    assert.equal(response.body.order.id, existing.id);
    assert.equal(response.body.order.tokenNumber, 3);
    assert.equal(response.body.order.status, 'Pending');
    assert.equal(response.body.order.items[0].qty, 3);
    assert.equal(response.body.order.total, 385.2);
    assert.ok(!requests.some(request => request.body?.data?.kind?.startsWith('digital_token_')));
  } finally {
    globalThis.fetch = previousFetch;
  }
});

test('secure order function accumulates active table+phone orders across different anonymous customer sessions', async () => {
  const previousFetch = globalThis.fetch;
  const requests = [];
  const firstSessionId = 'customer_first_session';
  const secondSessionId = 'customer_second_session';
  const existing = {
    ...inputOrder, id: 'GR58-OPEN-2001', tokenNumber: 5, tokenReservationId: 'tok-005',
    customerAccountId: firstSessionId, paymentMethod: 'counter', status: 'Accepted', orderDay: indiaTestDay(),
    serviceMode: 'table', tableNumber: '1', phone: '9999999999',
    items: [{ id: 'item_1', name: 'Chicken Fry', qty: 1, price: 120 }],
    subtotal: 120, tax: 6, serviceCharge: 2.4, total: 128.4,
  };
  globalThis.fetch = async (url, options = {}) => {
    const method = options.method || 'GET', body = options.body ? JSON.parse(options.body) : null, target = String(url);
    requests.push({ url: target, method, body });
    if (method === 'GET' && target.includes('/rows?')) return new Response(JSON.stringify({ rows: [{ $id: existing.id, kind: `digital_order_${ownerId}`, payload: JSON.stringify(existing) }] }), { status: 200 });
    if (method === 'GET') return new Response(JSON.stringify(menuRow), { status: 200 });
    if (method === 'PATCH') return new Response(JSON.stringify({ $id: existing.id, kind: `digital_order_${ownerId}`, payload: body.data.payload }), { status: 200 });
    throw new Error(`Unexpected request ${url}`);
  };
  process.env.APPWRITE_FUNCTION_PROJECT_ID = 'project_1';
  try {
    const response = await createDigitalOrder(functionContext(inputOrder, { 'x-appwrite-key': 'dynamic-key', 'x-appwrite-user-id': secondSessionId }));
    assert.equal(response.status, 200);
    assert.equal(response.body.accumulated, true);
    assert.equal(response.body.order.id, existing.id);
    assert.equal(response.body.order.tokenNumber, 5);
    assert.equal(response.body.order.status, 'Pending');
    assert.equal(response.body.order.items[0].qty, 3);
    assert.equal(response.body.order.total, 385.2);
    assert.ok(!requests.some(request => request.body?.data?.kind?.startsWith('digital_token_')));
  } finally {
    globalThis.fetch = previousFetch;
  }
});

test('secure subscription request validates the published plan and grants owner/customer access', async () => {
  const previousFetch = globalThis.fetch;
  const requests = [];
  const subscriptionMenu = { ...menuRow, payload: JSON.stringify({ ...menuPayload, restaurant: { ...menuPayload.restaurant, subscriptionPlans: [{ id: 'plan_1', name: 'Protein Monthly', planType: 'Fitness', meals: 30, price: 2999, deliveryDays: [1, 3, 5], deliveryTime: '13:15', active: true }] } }) };
  globalThis.fetch = async (url, options = {}) => {
    const body = options.body ? JSON.parse(options.body) : null;
    requests.push({ url: String(url), method: options.method || 'GET', body });
    if ((options.method || 'GET') === 'GET' && String(url).includes('/rows?')) return new Response(JSON.stringify({ rows: [] }), { status: 200 });
    if ((options.method || 'GET') === 'GET') return new Response(JSON.stringify(subscriptionMenu), { status: 200 });
    if (body?.data?.kind?.startsWith('digital_subscription_')) return new Response(JSON.stringify({ $id: body.rowId, ...body.data }), { status: 201 });
    throw new Error(`Unexpected request ${url}`);
  };
  process.env.APPWRITE_FUNCTION_PROJECT_ID = 'project_1';
  try {
    const response = await createDigitalOrder({
      req: { method: 'POST', headers: { 'x-appwrite-key': 'dynamic-key', 'x-appwrite-user-id': customerId, 'x-appwrite-user-email': 'customer@example.test' }, bodyJson: { action: 'create-subscription', subscription: { ownerId, restaurantId, planId: 'plan_1', customerName: 'Customer' } } },
      res: { json: (body, status = 200) => ({ body, status }) }, error: () => {},
    });
    assert.equal(response.status, 201);
    assert.equal(response.body.subscription.planType, 'Fitness');
    assert.equal(response.body.subscription.customerEmail, 'customer@example.test');
    assert.deepEqual(response.body.subscription.deliveryDays, [1, 3, 5]);
    assert.equal(response.body.subscription.deliveryTime, '13:15');
    assert.equal(response.body.subscription.status, 'Requested');
    const request = requests.find(entry => entry.body?.data?.kind?.startsWith('digital_subscription_'));
    assert.ok(request.body.permissions.includes(`read(\"user:${customerId}\")`));
    assert.ok(request.body.permissions.includes(`read(\"user:${ownerId}\")`));
  } finally {
    globalThis.fetch = previousFetch;
  }
});

test('subscription payment workflow requires owner link, customer proof and owner confirmation', async () => {
  const previousFetch = globalThis.fetch;
  const subscriptionId = 'sub_flow_1';
  let subscription = {
    id: subscriptionId, ownerId, restaurantId, customerAccountId: customerId,
    customerEmail: 'customer@example.test', planId: 'plan_1', planName: 'Weekday Protein',
    paymentLink: 'https://pay.example.test/weekday-protein', status: 'Requested', totalMeals: 20,
    mealsDelivered: 0, deliveryDays: [1, 3, 5], deliveryTime: '12:30',
  };
  const requests = [];
  globalThis.fetch = async (url, options = {}) => {
    const method = options.method || 'GET', body = options.body ? JSON.parse(options.body) : null, target = String(url);
    requests.push({ url: target, method, body });
    if (method === 'GET' && target.includes('/storage/')) return new Response(JSON.stringify({ $id: 'sub_receipt_1', name: 'subscription.png', mimeType: 'image/png', $permissions: [`delete(\"user:${customerId}\")`] }), { status: 200 });
    if (method === 'GET') return new Response(JSON.stringify({ $id: subscriptionId, kind: `digital_subscription_${ownerId}`, payload: JSON.stringify(subscription) }), { status: 200 });
    if (method === 'PATCH') {
      subscription = JSON.parse(body.data.payload);
      return new Response(JSON.stringify({ $id: subscriptionId, kind: `digital_subscription_${ownerId}`, payload: body.data.payload }), { status: 200 });
    }
    if (method === 'DELETE') return new Response(null, { status: 204 });
    throw new Error(`Unexpected request ${url}`);
  };
  process.env.APPWRITE_FUNCTION_PROJECT_ID = 'project_1';
  const invoke = (action, userId, extra = {}) => createDigitalOrder({
    req: { method: 'POST', headers: { 'x-appwrite-key': 'dynamic-key', 'x-appwrite-user-id': userId }, bodyJson: { action, subscription: { ownerId, subscriptionId, ...extra } } },
    res: { json: (body, status = 200) => ({ body, status }) }, error: () => {},
  });
  try {
    const sent = await invoke('send-subscription-link', ownerId, { paymentLink: 'https://payments.example.test/customer-activation' });
    assert.equal(sent.body.subscription.status, 'Payment Link Sent');
    assert.equal(sent.body.subscription.paymentLink, 'https://payments.example.test/customer-activation');
    const submitted = await invoke('submit-subscription-payment', customerId, { paymentReceiptFileId: 'sub_receipt_1' });
    assert.equal(submitted.body.subscription.status, 'Payment Proof Submitted');
    assert.equal(submitted.body.subscription.paymentReceiptName, 'subscription.png');
    const confirmed = await invoke('confirm-subscription-payment', ownerId);
    assert.equal(confirmed.body.subscription.status, 'Active');
    assert.ok(confirmed.body.subscription.nextScheduledMeal);
    assert.equal(confirmed.body.subscription.paymentReceiptFileId, '');
    assert.ok(requests.some(request => request.method === 'DELETE' && request.url.includes('sub_receipt_1')));
    assert.ok([1, 3, 5].includes(new Date(new Date(confirmed.body.subscription.nextScheduledMeal).getTime() + 330 * 60000).getUTCDay()));
  } finally {
    globalThis.fetch = previousFetch;
  }
});

test('restaurant payment approval permanently deletes the receipt before advancing the order', async () => {
  const previousFetch = globalThis.fetch;
  const requests = [];
  const order = {
    ...inputOrder, id: 'GR58-UAT-2001', cloudOwnerId: ownerId, ownerId,
    status: 'Payment Verification', paymentMethod: 'online', paymentStatus: 'Awaiting confirmation',
    paymentReceiptFileId: 'receipt_123', paymentReceiptUrl: 'https://example.test/receipt_123', createdAt: new Date().toISOString(),
  };
  globalThis.fetch = async (url, options = {}) => {
    const body = options.body ? JSON.parse(options.body) : null;
    requests.push({ url: String(url), method: options.method || 'GET', body });
    if ((options.method || 'GET') === 'GET') return new Response(JSON.stringify({ $id: order.id, kind: `digital_order_${ownerId}`, payload: JSON.stringify(order) }), { status: 200 });
    if (options.method === 'DELETE') return new Response(null, { status: 204 });
    if (options.method === 'PATCH') return new Response(JSON.stringify({ $id: order.id, kind: `digital_order_${ownerId}`, payload: body.data.payload }), { status: 200 });
    throw new Error(`Unexpected request ${url}`);
  };
  process.env.APPWRITE_FUNCTION_PROJECT_ID = 'project_1';
  try {
    const direct = await createDigitalOrder({
      req: { method: 'POST', headers: { 'x-appwrite-key': 'dynamic-key', 'x-appwrite-user-id': ownerId }, bodyJson: { action: 'confirm-payment', ownerId, orderId: order.id } },
      res: { json: (body, status = 200) => ({ body, status }) }, error: () => {},
    });
    assert.equal(direct.status, 200);
    assert.equal(direct.body.order.status, 'Pending');
    assert.equal(direct.body.order.paymentReceiptFileId, '');
    assert.equal(direct.body.order.paymentReceiptUrl, '');
    assert.ok(requests.some(request => request.method === 'DELETE' && request.url.includes('/storage/buckets/ad-media/files/receipt_123')));
    assert.ok(requests.some(request => request.method === 'PATCH'));
  } finally {
    globalThis.fetch = previousFetch;
  }
});

test('digit58: linking a customer to a store grants owner+customer permissions and is idempotent', async () => {
  const previousFetch = globalThis.fetch;
  const requests = [];
  const storeId = 'store_1';
  let existingRows = [];
  globalThis.fetch = async (url, options = {}) => {
    const method = options.method || 'GET', body = options.body ? JSON.parse(options.body) : null, target = String(url);
    requests.push({ url: target, method, body });
    if (method === 'GET' && target.includes('/rows?')) return new Response(JSON.stringify({ rows: existingRows }), { status: 200 });
    if (method === 'POST') { existingRows = [{ $id: body.rowId, kind: body.data.kind, payload: body.data.payload }]; return new Response(JSON.stringify({ $id: body.rowId, ...body.data }), { status: 201 }); }
    if (method === 'PATCH') { const row = existingRows.find(item => target.includes(encodeURIComponent(item.$id)) || target.includes(item.$id)); return new Response(JSON.stringify({ $id: row.$id, kind: row.kind, payload: body.data.payload }), { status: 200 }); }
    throw new Error(`Unexpected request ${url}`);
  };
  process.env.APPWRITE_FUNCTION_PROJECT_ID = 'project_1';
  try {
    const context = () => ({
      req: { method: 'POST', headers: { 'x-appwrite-key': 'dynamic-key', 'x-appwrite-user-id': customerId }, bodyJson: { action: 'digit58-link-customer', ownerId, storeId, customerName: 'Test Customer', customerEmail: 'customer@example.test' } },
      res: { json: (body, status = 200) => ({ body, status }) }, error: () => {},
    });
    const first = await createDigitalOrder(context());
    assert.equal(first.status, 200);
    assert.equal(first.body.customer.customerAccountId, customerId);
    const createRequest = requests.find(request => request.method === 'POST');
    assert.ok(createRequest.body.permissions.includes(`read(\"user:${ownerId}\")`));
    assert.ok(createRequest.body.permissions.includes(`read(\"user:${customerId}\")`));
    const beforeSecondCall = requests.length;
    const second = await createDigitalOrder(context());
    assert.equal(second.status, 200);
    assert.equal(second.body.customer.customerAccountId, customerId);
    assert.ok(!requests.slice(beforeSecondCall).some(request => request.method === 'POST'), 'second link request should not create a duplicate row');
  } finally {
    globalThis.fetch = previousFetch;
  }
});

test('digit58: only the store owner can create a reminder card for a customer', async () => {
  const response = await createDigitalOrder({
    req: { method: 'POST', headers: { 'x-appwrite-key': 'dynamic-key', 'x-appwrite-user-id': customerId }, bodyJson: { action: 'digit58-create-card', ownerId, storeId: 'store_1', customerAccountId: customerId, productName: 'Thyroid medicine', price: 199, reminderDays: 30 } },
    res: { json: (body, status = 200) => ({ body, status }) }, error: () => {},
  });
  assert.equal(response.status, 403);
});

test('digit58: the store owner can create a reminder card granting both owner and customer access', async () => {
  const previousFetch = globalThis.fetch;
  const requests = [];
  globalThis.fetch = async (url, options = {}) => {
    const method = options.method || 'GET', body = options.body ? JSON.parse(options.body) : null;
    requests.push({ url: String(url), method, body });
    if (method === 'POST') return new Response(JSON.stringify({ $id: body.rowId, ...body.data }), { status: 201 });
    throw new Error(`Unexpected request ${url}`);
  };
  process.env.APPWRITE_FUNCTION_PROJECT_ID = 'project_1';
  try {
    const response = await createDigitalOrder({
      req: { method: 'POST', headers: { 'x-appwrite-key': 'dynamic-key', 'x-appwrite-user-id': ownerId }, bodyJson: { action: 'digit58-create-card', ownerId, storeId: 'store_1', customerAccountId: customerId, productName: 'Thyroid medicine', price: 199, reminderDays: 30, upiId: 'store@upi', payeeName: 'Test Pharmacy' } },
      res: { json: (body, status = 200) => ({ body, status }) }, error: () => {},
    });
    assert.equal(response.status, 201);
    assert.equal(response.body.card.productName, 'Thyroid medicine');
    assert.equal(response.body.card.status, 'Active');
    assert.equal(response.body.card.upiId, 'store@upi');
    assert.match(response.body.card.upiUri, /^upi:\/\/pay\?/);
    assert.match(response.body.card.upiUri, /pa=store%40upi/);
    assert.match(response.body.card.upiUri, /am=199\.00/);
    const createRequest = requests.find(request => request.method === 'POST');
    assert.ok(createRequest.body.permissions.includes(`read(\"user:${ownerId}\")`));
    assert.ok(createRequest.body.permissions.includes(`read(\"user:${customerId}\")`));
  } finally {
    globalThis.fetch = previousFetch;
  }
});

test('digit58: only the card\'s own customer can request a buy-again reorder', async () => {
  const previousFetch = globalThis.fetch;
  const card = { $id: 'card_1', kind: `digit58_card_${ownerId}`, payload: JSON.stringify({ id: 'card_1', ownerId, storeId: 'store_1', customerAccountId: customerId, productName: 'Thyroid medicine', price: 199, reminderDays: 30, status: 'Active' }) };
  globalThis.fetch = async (url, options = {}) => {
    const method = options.method || 'GET';
    if (method === 'GET') return new Response(JSON.stringify(card), { status: 200 });
    throw new Error(`Unexpected request ${url}`);
  };
  process.env.APPWRITE_FUNCTION_PROJECT_ID = 'project_1';
  try {
    const response = await createDigitalOrder({
      req: { method: 'POST', headers: { 'x-appwrite-key': 'dynamic-key', 'x-appwrite-user-id': 'someone_else' }, bodyJson: { action: 'digit58-request-buy-again', ownerId, cardId: 'card_1' } },
      res: { json: (body, status = 200) => ({ body, status }) }, error: () => {},
    });
    assert.equal(response.status, 403);
  } finally {
    globalThis.fetch = previousFetch;
  }
});

test('digit58: a customer can create an order with an item list, granting owner+customer permissions', async () => {
  const previousFetch = globalThis.fetch;
  const requests = [];
  globalThis.fetch = async (url, options = {}) => {
    const method = options.method || 'GET', body = options.body ? JSON.parse(options.body) : null;
    requests.push({ url: String(url), method, body });
    if (method === 'POST') return new Response(JSON.stringify({ $id: body.rowId, ...body.data }), { status: 201 });
    throw new Error(`Unexpected request ${url}`);
  };
  process.env.APPWRITE_FUNCTION_PROJECT_ID = 'project_1';
  try {
    const response = await createDigitalOrder({
      req: { method: 'POST', headers: { 'x-appwrite-key': 'dynamic-key', 'x-appwrite-user-id': customerId }, bodyJson: { action: 'digit58-create-order', ownerId, storeId: 'store_1', customerName: 'Test Customer', customerEmail: 'customer@example.test', items: [{ name: 'Paracetamol 500mg', qty: 2 }, { name: '  ', qty: 1 }] } },
      res: { json: (body, status = 200) => ({ body, status }) }, error: () => {},
    });
    assert.equal(response.status, 201);
    assert.equal(response.body.order.status, 'Requested');
    assert.equal(response.body.order.items.length, 1);
    assert.equal(response.body.order.items[0].name, 'Paracetamol 500mg');
    assert.equal(response.body.order.amount, 0);
    const createRequest = requests.find(request => request.method === 'POST');
    assert.ok(createRequest.body.permissions.includes(`read(\"user:${ownerId}\")`));
    assert.ok(createRequest.body.permissions.includes(`read(\"user:${customerId}\")`));
  } finally {
    globalThis.fetch = previousFetch;
  }
});

test('digit58: an order requires at least one named item', async () => {
  const response = await createDigitalOrder({
    req: { method: 'POST', headers: { 'x-appwrite-key': 'dynamic-key', 'x-appwrite-user-id': customerId }, bodyJson: { action: 'digit58-create-order', ownerId, storeId: 'store_1', items: [] } },
    res: { json: (body, status = 200) => ({ body, status }) }, error: () => {},
  });
  assert.equal(response.status, 400);
});

test('digit58: the store owner can accept the one-time policy on their own entitlement', async () => {
  const previousFetch = globalThis.fetch;
  const entitlement = { $id: `d58-${ownerId}`, ownerId, active: true, paused: false };
  globalThis.fetch = async (url, options = {}) => {
    const method = options.method || 'GET';
    if (method === 'GET') return new Response(JSON.stringify(entitlement), { status: 200 });
    if (method === 'PATCH') return new Response(JSON.stringify({ $id: entitlement.$id, ...JSON.parse(options.body).data }), { status: 200 });
    throw new Error(`Unexpected request ${url}`);
  };
  process.env.APPWRITE_FUNCTION_PROJECT_ID = 'project_1';
  try {
    const response = await createDigitalOrder({
      req: { method: 'POST', headers: { 'x-appwrite-key': 'dynamic-key', 'x-appwrite-user-id': ownerId }, bodyJson: { action: 'digit58-accept-policy', ownerId } },
      res: { json: (body, status = 200) => ({ body, status }) }, error: () => {},
    });
    assert.equal(response.status, 200);
    assert.ok(response.body.entitlement.policyAcceptedAt);
  } finally {
    globalThis.fetch = previousFetch;
  }
});

test('digit58: only the owner themselves can accept their policy', async () => {
  const response = await createDigitalOrder({
    req: { method: 'POST', headers: { 'x-appwrite-key': 'dynamic-key', 'x-appwrite-user-id': 'someone_else' }, bodyJson: { action: 'digit58-accept-policy', ownerId } },
    res: { json: (body, status = 200) => ({ body, status }) }, error: () => {},
  });
  assert.equal(response.status, 403);
});

test('digit58: a G58 admin team member can suspend an individual store', async () => {
  const previousFetch = globalThis.fetch;
  const adminId = 'admin_1';
  const store = { $id: 'store_1', kind: `digit58_store_${ownerId}`, payload: JSON.stringify({ id: 'store_1', ownerId, name: 'Test Pharmacy' }) };
  globalThis.fetch = async (url, options = {}) => {
    const method = options.method || 'GET';
    if (String(url).includes('/teams/')) return new Response(JSON.stringify({ memberships: [{ userId: adminId }] }), { status: 200 });
    if (method === 'GET') return new Response(JSON.stringify(store), { status: 200 });
    if (method === 'PATCH') return new Response(JSON.stringify({ $id: store.$id, ...JSON.parse(options.body).data }), { status: 200 });
    throw new Error(`Unexpected request ${url}`);
  };
  process.env.APPWRITE_FUNCTION_PROJECT_ID = 'project_1';
  try {
    const response = await createDigitalOrder({
      req: { method: 'POST', headers: { 'x-appwrite-key': 'dynamic-key', 'x-appwrite-user-id': adminId }, bodyJson: { action: 'digit58-set-store-suspended', ownerId, storeId: 'store_1', suspended: true } },
      res: { json: (body, status = 200) => ({ body, status }) }, error: () => {},
    });
    assert.equal(response.status, 200);
    assert.equal(response.body.store.suspended, true);
  } finally {
    globalThis.fetch = previousFetch;
  }
});

test('digit58: a non-admin cannot suspend a store', async () => {
  const previousFetch = globalThis.fetch;
  globalThis.fetch = async (url) => {
    if (String(url).includes('/teams/')) return new Response(JSON.stringify({ memberships: [] }), { status: 200 });
    throw new Error(`Unexpected request ${url}`);
  };
  process.env.APPWRITE_FUNCTION_PROJECT_ID = 'project_1';
  try {
    const response = await createDigitalOrder({
      req: { method: 'POST', headers: { 'x-appwrite-key': 'dynamic-key', 'x-appwrite-user-id': customerId }, bodyJson: { action: 'digit58-set-store-suspended', ownerId, storeId: 'store_1', suspended: true } },
      res: { json: (body, status = 200) => ({ body, status }) }, error: () => {},
    });
    assert.equal(response.status, 403);
  } finally {
    globalThis.fetch = previousFetch;
  }
});
