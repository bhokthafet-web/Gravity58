import test from 'node:test';
import assert from 'node:assert/strict';
import createDigitalOrder from '../../appwrite-functions/create-digital-order/src/main.js';

const ownerId = 'owner_123';
const customerId = 'customer_456';
const restaurantId = 'restaurant_1';
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
    const sent = await invoke('send-subscription-link', ownerId);
    assert.equal(sent.body.subscription.status, 'Payment Link Sent');
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
