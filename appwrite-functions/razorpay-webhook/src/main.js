import { createHmac, timingSafeEqual } from 'crypto';

const DATABASE_ID = 'gravity58';
const TABLE_ID = 'g58_records';
const DIGIT58_ENTITLEMENT_KIND = 'digit58_entitlements';
const DIGIT58_REFERRAL_CODE_KIND = 'digit58_referral_codes';
const DIGIT58_REFERRAL_KIND = 'digit58_referrals';
const DIGIT58_REFERRAL_REWARD = 399;
const ADMIN_TEAM_ID = '6a776960001ca2fb66bf';

const finite = (value, fallback = 0) => (Number.isFinite(Number(value)) ? Number(value) : fallback);
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
      throw error;
    }
    return data;
  };
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

async function updateRow(call, rowId, payload) {
  const clean = { ...payload };
  ['$id', '$createdAt', '$updatedAt', '$permissions', '$databaseId', '$tableId', 'kind'].forEach(key => delete clean[key]);
  return call(`/tablesdb/${DATABASE_ID}/tables/${TABLE_ID}/rows/${encodeURIComponent(rowId)}`, {
    method: 'PATCH', body: JSON.stringify({ data: { payload: JSON.stringify(clean) } }),
  });
}

async function createRow(call, rowId, kind, payload, permissions) {
  return call(`/tablesdb/${DATABASE_ID}/tables/${TABLE_ID}/rows`, {
    method: 'POST', body: JSON.stringify({ rowId, data: { kind, payload: JSON.stringify(payload) }, permissions }),
  });
}

// Records a referral reward once the referred owner's subscription has
// successfully charged at least once — any paid plan qualifies, since every
// Refills plan (6mo/1yr/3yr) already covers 6+ months. Idempotent: guarded by
// entitlement.referralRecorded and a deterministic row id.
async function recordDigit58ReferralIfNeeded(call, entitlement) {
  if (!entitlement.referredByCode || entitlement.referralRecorded) return false;
  const codeRow = await call(`/tablesdb/${DATABASE_ID}/tables/${TABLE_ID}/rows/${encodeURIComponent(`ref-${entitlement.referredByCode}`)}`).catch(() => null);
  if (!codeRow || codeRow.kind !== DIGIT58_REFERRAL_CODE_KIND) return true;
  const codeData = cleanRow(codeRow);
  if (!codeData.referrerUserId || codeData.referrerUserId === entitlement.ownerId) return true;
  const referralId = `refr-${String(entitlement.ownerId).slice(0, 30)}`;
  await createRow(call, referralId, DIGIT58_REFERRAL_KIND, {
    referrerUserId: codeData.referrerUserId,
    referredOwnerId: entitlement.ownerId,
    referredEmail: entitlement.ownerEmail || '',
    plan: entitlement.pendingPlan || entitlement.plan || '',
    rewardAmount: DIGIT58_REFERRAL_REWARD,
    status: 'Eligible',
    createdAt: new Date().toISOString(),
  }, [`read("user:${codeData.referrerUserId}")`, `read("team:${ADMIN_TEAM_ID}")`, `update("team:${ADMIN_TEAM_ID}")`]).catch(caughtError => {
    if (caughtError?.code !== 409) throw caughtError;
  });
  return true;
}

function verifySignature(rawBody, signature, secret) {
  if (!signature || !secret || !rawBody) return false;
  const expected = createHmac('sha256', secret).update(rawBody).digest('hex');
  const expectedBuf = Buffer.from(expected);
  const givenBuf = Buffer.from(String(signature));
  return expectedBuf.length === givenBuf.length && timingSafeEqual(expectedBuf, givenBuf);
}

function appendBillingEvent(entitlement, event, note) {
  const events = Array.isArray(entitlement.billingEvents) ? entitlement.billingEvents.slice(-19) : [];
  events.push({ event, note, at: new Date().toISOString() });
  return events;
}

// Razorpay does not carry an Appwrite user session, so this function must be
// reachable with public "Execute Access: Any" in the Appwrite console — kept
// as its own function (not folded into create-digital-order) so that opening
// it up to unauthenticated calls can't affect any user-authenticated action.
export default async ({ req, res, error }) => {
  if (req.method === 'GET') return res.json({ ok: true, service: 'Gravity58 Razorpay webhook' });
  if (req.method !== 'POST') return res.json({ ok: false, error: 'Method not allowed.' }, 405);

  const rawBody = req.bodyText || '';
  const signature = req.headers['x-razorpay-signature'];
  if (!verifySignature(rawBody, signature, process.env.RAZORPAY_WEBHOOK_SECRET)) {
    error('Razorpay webhook signature verification failed.');
    return res.json({ ok: false, error: 'Invalid signature.' }, 401);
  }

  let body = {};
  try { body = JSON.parse(rawBody || '{}'); } catch { return res.json({ ok: false, error: 'Invalid payload.' }, 400); }

  const event = String(body.event || '');
  const subscriptionEntity = body.payload?.subscription?.entity;
  const paymentEntity = body.payload?.payment?.entity;
  if (!subscriptionEntity?.id) return res.json({ ok: true, skipped: true });

  try {
    const call = appwriteClient(req);
    const rows = await listRowsByKind(call, DIGIT58_ENTITLEMENT_KIND);
    const row = rows.find(item => {
      let payload = {};
      try { payload = JSON.parse(item?.payload || '{}') || {}; } catch {}
      return payload.razorpaySubscriptionId === subscriptionEntity.id;
    });
    if (!row) {
      error(`No Refills entitlement found for Razorpay subscription ${subscriptionEntity.id}`);
      return res.json({ ok: true, unmatched: true });
    }
    const entitlement = cleanRow(row);
    const rowId = row.$id || row.id || entitlement.id;
    const currentEndMs = finite(subscriptionEntity.current_end, 0) * 1000;

    let changes = null;
    if (event === 'subscription.activated') {
      const referralRecorded = await recordDigit58ReferralIfNeeded(call, entitlement);
      changes = {
        active: true, subscriptionStatus: 'active', lifetime: false,
        plan: entitlement.pendingPlan || entitlement.plan || '',
        expiresAt: currentEndMs ? new Date(currentEndMs).toISOString() : entitlement.expiresAt,
        freeTrial: false,
        ...(referralRecorded ? { referralRecorded: true } : {}),
        billingEvents: appendBillingEvent(entitlement, event, 'Subscription authorized'),
      };
    } else if (event === 'subscription.charged') {
      const referralRecorded = await recordDigit58ReferralIfNeeded(call, entitlement);
      changes = {
        active: true, subscriptionStatus: 'active', lifetime: false,
        plan: entitlement.pendingPlan || entitlement.plan || '',
        expiresAt: currentEndMs ? new Date(currentEndMs).toISOString() : entitlement.expiresAt,
        freeTrial: false,
        ...(referralRecorded ? { referralRecorded: true } : {}),
        billingEvents: appendBillingEvent(entitlement, event, paymentEntity ? `Charged ₹${(finite(paymentEntity.amount) / 100).toFixed(0)}` : 'Charged'),
      };
    } else if (event === 'subscription.cancelled' || event === 'subscription.completed') {
      changes = {
        subscriptionStatus: event === 'subscription.completed' ? 'completed' : 'cancelled',
        cancelAtPeriodEnd: true,
        billingEvents: appendBillingEvent(entitlement, event, 'Auto-renewal stopped'),
      };
    } else if (event === 'subscription.halted') {
      changes = {
        active: false, subscriptionStatus: 'halted',
        billingEvents: appendBillingEvent(entitlement, event, 'Payment retries exhausted — access paused'),
      };
    } else if (event === 'payment.failed') {
      changes = { billingEvents: appendBillingEvent(entitlement, event, 'A renewal payment attempt failed — Razorpay will retry') };
    } else {
      return res.json({ ok: true, ignored: event });
    }

    await updateRow(call, rowId, { ...entitlement, ...changes });
    return res.json({ ok: true, event });
  } catch (caught) {
    error(`Razorpay webhook handling failed: ${caught?.message || caught}`);
    return res.json({ ok: false, error: caught?.message || 'Webhook handling failed.' }, 500);
  }
};
