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
