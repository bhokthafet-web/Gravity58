const $=(selector,root=document)=>root.querySelector(selector),$$=(selector,root=document)=>[...root.querySelectorAll(selector)];
const app=$('#app'),api=window.Gravity58Ads;
const now=()=>new Date().toISOString();
const id=(prefix='d58')=>`${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2,7)}`;
const html=value=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const money=value=>`₹${Number(value||0).toLocaleString('en-IN')}`;
const offerPrice=value=>`${money(value)}/- only`;
const configuredStoreMinimum=value=>Math.max(0,Number(value?.minimumOrderValue)||0);
const storeMinimum=value=>value?.minimumOrderEnabled===false?0:configuredStoreMinimum(value);
function indiaDateValue(value=new Date()){
  const date=value instanceof Date?value:new Date(value);
  if(Number.isNaN(date.getTime()))return '';
  const parts=Object.fromEntries(new Intl.DateTimeFormat('en-IN',{timeZone:'Asia/Kolkata',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(date).filter(part=>part.type!=='literal').map(part=>[part.type,part.value]));
  return `${parts.year}-${parts.month}-${parts.day}`;
}
function orderHistoryTimestamp(order){return order.deliveredAt||order.rejectedAt||order.updatedAt||order.createdAt}
function filterOrdersByIndiaDate(orders,fromDate,toDate){
  return orders.filter(order=>{
    const day=indiaDateValue(orderHistoryTimestamp(order));
    return (!fromDate||day>=fromDate)&&(!toDate||day<=toDate);
  });
}
function csvCell(value){const text=String(value??'');return /[",\r\n]/.test(text)?`"${text.replace(/"/g,'""')}"`:text}
function downloadOrderHistoryCsv(orders,{filePrefix='order-history',includeCustomer=false,storeName='' }={}){
  const headers=['Order ID',...(includeCustomer?['Customer','Phone']:['Store']),'Items','Amount (INR)','Status','Order Date'];
  const rows=orders.map(order=>[
    order.id,
    ...(includeCustomer?[customerNameFor(order),order.phone||'']:[storeName||'']),
    order.items.map(item=>`${Number(item.qty)||1} x ${item.name}`).join(' | '),
    Number(order.amount)||0,
    order.status||'',
    new Date(orderHistoryTimestamp(order)).toLocaleString('en-IN',{timeZone:'Asia/Kolkata',dateStyle:'medium',timeStyle:'short'}),
  ]);
  const csv='\ufeff'+[headers,...rows].map(row=>row.map(csvCell).join(',')).join('\r\n');
  const url=URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8'})),link=document.createElement('a');
  link.href=url;link.download=`${filePrefix}-${indiaDateValue()}.csv`;document.body.appendChild(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);
}
const safeId=(prefix,ownerId,max)=>`${prefix}${String(ownerId||'public').replace(/[^a-zA-Z0-9._-]/g,'-').slice(0,max)}`;
const storeKind=(ownerId)=>safeId('digit58_store_',ownerId,40);
const customerKind=(ownerId)=>safeId('digit58_customer_',ownerId,36);
const cardKind=(ownerId)=>safeId('digit58_card_',ownerId,40);
const orderKind=(ownerId)=>safeId('digit58_order_',ownerId,40);
const promotionKind=(ownerId)=>safeId('digit58_promo_',ownerId,40);
const REQUEST_KIND='digit58_requests',ENTITLEMENT_KIND='digit58_entitlements',SUBSCRIPTION_AMOUNT=399;
const ORDER_STEPS=[
  {key:'Requested',icon:'📝',label:'Requested'},
  {key:'Priced',icon:'💳',label:'Payment'},
  {key:'Accepted',icon:'✅',label:'Accepted'},
  {key:'Preparing',icon:'📦',label:'Preparing'},
  {key:'Out for Delivery',icon:'🚚',label:'Out for Delivery'},
  {key:'Delivered',icon:'🏠',label:'Delivered'},
];
function buildUpiUri(upiId,payeeName,amount,orderId){
  if(!upiId)return '';
  const reference=`58${String(orderId||Date.now()).replace(/\D/g,'').slice(-30)}`.slice(0,35);
  const params=new URLSearchParams({pa:upiId,pn:payeeName||upiId,tr:reference,tn:`Refills order ${orderId}`,am:Number(amount||0).toFixed(2),cu:'INR'});
  return `upi://pay?${params.toString()}`;
}
function normaliseRazorpayLink(value){
  const link=String(value||'').trim();
  if(!link)return '';
  return /^https?:\/\//i.test(link)?link:`https://${link}`;
}
function validRazorpayLink(value){
  try{
    const url=new URL(normaliseRazorpayLink(value));
    return url.protocol==='https:'&&['razorpay.me','www.razorpay.me','rzp.io','www.rzp.io'].includes(url.hostname.toLowerCase());
  }catch{return false}
}
let razorpaySuccessfulReturn=null;
function captureRazorpaySuccessfulReturn(){
  const params=new URLSearchParams(location.search);
  if(params.get('razorpay_return')!=='success')return;
  const ownerId=params.get('owner')||'',storeId=params.get('store')||'';if(!ownerId||!storeId)return;
  razorpaySuccessfulReturn={ownerId,storeId};
  history.replaceState(null,'',`${location.pathname}#store&owner=${encodeURIComponent(ownerId)}&store=${encodeURIComponent(storeId)}`);
}
function toast(message){const target=$('#toast');if(!target)return alert(message);target.textContent=message;target.classList.add('show');setTimeout(()=>target.classList.remove('show'),2400)}
function requestGeolocation(){
  return new Promise((resolve,reject)=>{
    if(!navigator.geolocation)return reject(new Error('Location is not supported on this device'));
    navigator.geolocation.getCurrentPosition(
      position=>resolve({lat:position.coords.latitude,lng:position.coords.longitude}),
      error=>reject(new Error(error.message||'Could not get your location')),
      {enableHighAccuracy:true,timeout:12000},
    );
  });
}
function bindShareLocationButton(button,statusEl,onCaptured){
  button.onclick=async()=>{
    button.disabled=true;const original=button.textContent;button.textContent='Getting location…';
    try{
      const point=await requestGeolocation();
      statusEl.textContent='📍 Location captured — it will be sent with your request.';
      statusEl.classList.add('location-captured');
      button.textContent='Update Location';
      onCaptured(point);
    }catch(error){toast(error.message||'Could not get your location');button.textContent=original}
    button.disabled=false;
  };
}
function deliveryContactMarkup(entity){
  if(!entity.phone&&!entity.locationUrl)return'';
  return `<div class="delivery-block"><div class="delivery-info">${entity.phone?`<span>📞 ${html(entity.phone)}</span>`:''}${entity.locationUrl?`<a href="${html(entity.locationUrl)}" target="_blank" rel="noopener">📍 View location</a>`:''}</div><button type="button" class="btn small secondary" data-share-delivery="${html(entity.id)}">Share with Delivery Boy</button></div>`;
}
function customerNameFor(entity){
  if(entity.customerName)return entity.customerName;
  const customer=state.customers.find(c=>c.customerAccountId===entity.customerAccountId&&c.storeId===entity.storeId);
  return customer?.customerName||'Customer';
}
function shareWithDeliveryBoy(entity){
  const lines=[`Delivery for ${customerNameFor(entity)}`,entity.phone?`Contact: ${entity.phone}`:'',entity.locationUrl?`Location: ${entity.locationUrl}`:''].filter(Boolean);
  if(lines.length<2)return toast('No contact or location shared yet for this order');
  window.open(`https://wa.me/?text=${encodeURIComponent(lines.join('\n'))}`,'_blank','noopener');
}
function bindDeliveryShareButtons(records){
  $$('[data-share-delivery]').forEach(button=>button.onclick=()=>{
    const entity=records.find(row=>row.id===button.dataset.shareDelivery);
    if(entity)shareWithDeliveryBoy(entity);
  });
}

let session=null,view='dashboard';
let refreshView=()=>renderShell();
let entitlement=null,myRequest=null,myStoreRequest=null;
function storeSlotsAllowed(){return Math.max(1,Number(entitlement?.storeSlots)||1)}
let state={activeStoreId:'',stores:[],customers:[],cards:[],orders:[],promotions:[]};
function save(){try{localStorage.setItem('gravity58Digit58',JSON.stringify(state))}catch{}}
function load(){try{return {...state,...JSON.parse(localStorage.getItem('gravity58Digit58')||'{}')}}catch{return state}}
state=load();

let orderAlertTimer=null,orderAlertContext=null;
const ringingIds=new Set();
let knownOrderIds=new Set(),knownBuyRequestIds=new Set();
let ownerOrdersUnsubscribe=null,ownerCardsUnsubscribe=null,ownerPromotionsUnsubscribe=null;
function orderAlertBeep(duration=.18,frequency=880){
  try{
    orderAlertContext||=new (window.AudioContext||window.webkitAudioContext)();
    if(orderAlertContext.state==='suspended')orderAlertContext.resume();
    const oscillator=orderAlertContext.createOscillator(),gain=orderAlertContext.createGain(),start=orderAlertContext.currentTime;
    oscillator.frequency.value=frequency;gain.gain.setValueAtTime(.0001,start);gain.gain.exponentialRampToValueAtTime(.16,start+.015);gain.gain.exponentialRampToValueAtTime(.0001,start+duration);
    oscillator.connect(gain);gain.connect(orderAlertContext.destination);oscillator.start(start);oscillator.stop(start+duration+.02);
  }catch(error){console.warn('Audio alert unavailable',error)}
}
function updateOrderAlertSound(){
  [...ringingIds].forEach(id=>{
    const stillRinging=state.orders.some(row=>row.id===id&&['Requested','Minimum Approval Requested'].includes(row.status))||state.cards.some(row=>row.id===id&&row.status==='Buy Requested');
    if(!stillRinging)ringingIds.delete(id);
  });
  if(!ringingIds.size){if(orderAlertTimer)clearInterval(orderAlertTimer);orderAlertTimer=null;return}
  if(!orderAlertTimer){orderAlertBeep();orderAlertTimer=setInterval(()=>orderAlertBeep(),2200)}
}
document.addEventListener('pointerdown',()=>{if(ringingIds.size)orderAlertBeep()},{passive:true});
const dueReminderRung=new Set();
let pendingDueBeep=false;
function ringDueReminders(cards){
  const dueIds=cards.filter(isCardDue).map(card=>card.id);
  const newlyDue=dueIds.filter(id=>!dueReminderRung.has(id));
  dueIds.forEach(id=>dueReminderRung.add(id));
  if(newlyDue.length){orderAlertBeep(.22,660);pendingDueBeep=true}
}
document.addEventListener('pointerdown',()=>{if(pendingDueBeep){orderAlertBeep(.22,660);pendingDueBeep=false}},{passive:true});
let incomingCallTimer=null;
function playIncomingCallRing(){orderAlertBeep(.16,700);setTimeout(()=>orderAlertBeep(.16,700),230)}
function stopIncomingCallRing(){if(incomingCallTimer){clearInterval(incomingCallTimer);incomingCallTimer=null}$('.incoming-call-overlay')?.remove()}
function showIncomingOrderCall(store,customer,message,{title='Order placed!',hint='Tap to view your order'}={}){
  stopIncomingCallRing();
  const wrap=document.createElement('div');
  wrap.className='incoming-call-overlay';
  wrap.innerHTML=`<div class="incoming-call-card"><div class="incoming-call-rings"><span></span><span></span><span></span><div class="incoming-call-avatar"><svg viewBox="0 0 120 120" fill="none" stroke="#7fffd4" stroke-width="8" aria-hidden="true"><circle cx="60" cy="26" r="15"/><circle cx="28" cy="82" r="15"/><circle cx="92" cy="82" r="15"/></svg></div></div><h2>${html(title)}</h2><p class="muted">${html(store.name)}</p><button type="button" class="incoming-call-accept-btn" aria-label="Accept"><svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M6.6 10.8c1.5 3 3.9 5.4 6.9 6.9l2.3-2.3c.3-.3.7-.4 1-.2 1.1.4 2.3.6 3.5.6.6 0 1 .4 1 1V20c0 .6-.4 1-1 1C10.6 21 3 13.4 3 4c0-.6.4-1 1-1h3.2c.6 0 1 .4 1 1 0 1.2.2 2.4.6 3.5.1.4 0 .8-.2 1L6.6 10.8z"/></svg></button><p class="incoming-call-hint">${html(hint)}</p></div>`;
  document.body.appendChild(wrap);
  playIncomingCallRing();
  incomingCallTimer=setInterval(playIncomingCallRing,1900);
  wrap.querySelector('.incoming-call-accept-btn').onclick=()=>{
    stopIncomingCallRing();
    if(message)toast(message);
    loadAndRenderCustomerView(store,customer);
  };
}
const pendingOwnerOrderRung=new Set();
function ringPendingOwnerOrders(store,customer,orders){
  const pending=orders.filter(row=>row.status==='Pending Customer Acceptance');
  const unrung=pending.filter(row=>!pendingOwnerOrderRung.has(row.id));
  pending.forEach(row=>pendingOwnerOrderRung.add(row.id));
  if(unrung.length)showIncomingOrderCall(store,customer,'New order from the store — review and accept it below',{title:'Incoming order!',hint:'Tap to review'});
}
async function acceptOwnerOrder(store,customer,orderId){
  try{
    await api.executeFunction(api.config.digitalOrderFunctionId,{action:'digit58-accept-owner-order',ownerId:store.ownerId,orderId});
    toast('Order accepted — the store will now review and set the amount');
    await loadAndRenderCustomerView(store,customer);
  }catch(error){toast(error.message||'Could not accept the order')}
}
let motionRequested=false;
function triggerVialShake(){$$('.vial-liquid').forEach(node=>{node.classList.remove('slosh');void node.offsetWidth;node.classList.add('slosh')})}
function attachShakeListener(){
  let lastX=null,lastY=null,lastZ=null,lastTime=0;
  window.addEventListener('devicemotion',event=>{
    const acc=event.accelerationIncludingGravity;if(!acc)return;
    const time=Date.now();if(time-lastTime<150)return;
    if(lastX!==null){
      const delta=Math.abs((acc.x||0)-lastX)+Math.abs((acc.y||0)-lastY)+Math.abs((acc.z||0)-lastZ);
      if(delta>26){lastTime=time;triggerVialShake()}
    }
    lastX=acc.x||0;lastY=acc.y||0;lastZ=acc.z||0;
  });
}
function initShakeDetection(){
  if(motionRequested||!$('.vial-liquid'))return;
  motionRequested=true;
  if(typeof DeviceMotionEvent!=='undefined'&&typeof DeviceMotionEvent.requestPermission==='function'){
    DeviceMotionEvent.requestPermission().then(state=>{if(state==='granted')attachShakeListener()}).catch(()=>{});
  }else if(typeof DeviceMotionEvent!=='undefined'){
    attachShakeListener();
  }
}
document.addEventListener('pointerdown',initShakeDetection,{passive:true});
function startOwnerRealtime(){
  const ownerId=cloudOwnerId();if(!ownerId||!api?.subscribeKind)return;
  knownOrderIds=new Set(state.orders.map(row=>row.id));
  knownBuyRequestIds=new Set(state.cards.filter(row=>row.status==='Buy Requested').map(row=>row.id));
  ownerOrdersUnsubscribe?.();
  ownerOrdersUnsubscribe=api.subscribeKind(orderKind(ownerId),()=>refreshOwnerOrdersRealtime());
  ownerCardsUnsubscribe?.();
  ownerCardsUnsubscribe=api.subscribeKind(cardKind(ownerId),()=>refreshOwnerCardsRealtime());
  ownerPromotionsUnsubscribe?.();
  ownerPromotionsUnsubscribe=api.subscribeKind(promotionKind(ownerId),()=>refreshOwnerPromotionsRealtime());
}
function stopOwnerRealtime(){ownerOrdersUnsubscribe?.();ownerCardsUnsubscribe?.();ownerPromotionsUnsubscribe?.();ownerOrdersUnsubscribe=ownerCardsUnsubscribe=ownerPromotionsUnsubscribe=null;ringingIds.clear();knownOrderIds.clear();knownBuyRequestIds.clear();updateOrderAlertSound()}
async function refreshOwnerOrdersRealtime(){
  const ownerId=cloudOwnerId();if(!ownerId)return;
  const orders=await api.list(orderKind(ownerId)).catch(()=>null);
  if(!orders)return;
  let isNew=false;
  orders.forEach(order=>{if(['Requested','Minimum Approval Requested'].includes(order.status)&&!knownOrderIds.has(order.id)){ringingIds.add(order.id);isNew=true}knownOrderIds.add(order.id)});
  state.orders=orders;save();
  updateOrderAlertSound();
  if(isNew)toast('🔔 New order or minimum approval request received');
  if(!$('.modal-backdrop'))refreshView();
}
async function refreshOwnerCardsRealtime(){
  const ownerId=cloudOwnerId();if(!ownerId)return;
  const cards=await api.list(cardKind(ownerId)).catch(()=>null);
  if(!cards)return;
  let isNew=false;
  cards.forEach(card=>{if(card.status==='Buy Requested'&&!knownBuyRequestIds.has(card.id)){ringingIds.add(card.id);isNew=true}knownBuyRequestIds.add(card.id)});
  state.cards=cards;save();
  updateOrderAlertSound();
  if(isNew)toast('🔔 Buy again request received');
  if(!$('.modal-backdrop'))refreshView();
}
async function refreshOwnerPromotionsRealtime(){
  const ownerId=cloudOwnerId();if(!ownerId)return;
  const promotions=await api.list(promotionKind(ownerId)).catch(()=>null);
  if(!promotions)return;
  state.promotions=await cleanupExpiredOwnerPromotions(ownerId,promotions);save();
  if(!$('.modal-backdrop'))refreshView();
}

function cloudOwnerId(){return session?.$id||''}
function activeStore(){return state.stores.find(row=>row.id===state.activeStoreId)||state.stores[0]||null}
function ownerCustomers(storeId=state.activeStoreId){return state.customers.filter(row=>row.storeId===storeId)}
function customerCards(customerAccountId,storeId=state.activeStoreId){return state.cards.filter(row=>row.storeId===storeId&&row.customerAccountId===customerAccountId)}
function cardDueTime(card){
  const explicit=new Date(card?.dueAt).getTime();
  if(Number.isFinite(explicit))return explicit;
  const anchor=new Date(card?.lastDeliveredAt||card?.purchasedAt||card?.createdAt||card?.$createdAt).getTime();
  return Number.isFinite(anchor)?anchor+Math.max(1,Number(card?.reminderDays)||30)*86400000:Date.now();
}
function isCardDue(card){return cardDueTime(card)<=Date.now()}
function daysRemaining(card){return Math.max(0,Math.ceil((cardDueTime(card)-Date.now())/86400000))}
function storeOrders(storeId=state.activeStoreId){return state.orders.filter(row=>row.storeId===storeId)}
function storePromotions(storeId=state.activeStoreId){return state.promotions.filter(row=>row.storeId===storeId)}
function customerOrders(customerAccountId,storeId=state.activeStoreId){return state.orders.filter(row=>row.storeId===storeId&&row.customerAccountId===customerAccountId)}
function activeOrders(orders){return orders.filter(row=>!['Delivered','Rejected'].includes(row.status))}
function orderHistoryOrders(orders){return orders.filter(row=>['Delivered','Rejected'].includes(row.status))}

function isRefillsCustomerApp(){return navigator.userAgent.includes('G58RefillsAndroidApp')}
function renderCustomerPortalLanding(){
  app.innerHTML=`<main class="screen"><section class="auth-card">
    <a class="brand" href="../"><svg class="brand-mark" viewBox="0 0 120 120" fill="none" stroke="#7fffd4" stroke-width="8" aria-hidden="true"><circle cx="60" cy="26" r="15"/><circle cx="28" cy="82" r="15"/><circle cx="92" cy="82" r="15"/></svg><div><h2>G58 Refills</h2><p class="tagline">Your orders and reminder cards, from the stores you shop with.</p></div></a>
    <div class="card"><p class="muted">Open the link your store shared with you — by WhatsApp message or QR code — to sign in and see your orders and reminders here.</p></div>
  </section></main>${siteFooter(true)}`;
}
async function boot(){
  if(!api?.configured)return renderConfigError();
  captureRazorpaySuccessfulReturn();
  const hash=new URLSearchParams(location.hash.replace(/^#store&?/,''));
  if(location.hash.startsWith('#store&'))return renderPublicStore(hash);
  if(isRefillsCustomerApp())return renderCustomerPortalLanding();
  session=await api.currentUser().catch(()=>null);
  if(!session)return renderOwnerAuth();
  await loadEntitlement();
  if(!hasActiveEntitlement())return renderAccessGate();
  await proceedAfterEntitlement();
}
const DIGIT58_POLICY_TEXT='Refills generates a payment QR code from the UPI ID you provide, to help you collect payment from your customers. G58 only facilitates this QR generation — we are not a party to any payment and are not responsible for any fraud, dispute or disagreement between you and your customer. Please verify payments independently before fulfilling any order.';
async function proceedAfterEntitlement(){
  if(!entitlement?.policyAcceptedAt)return renderPolicyGate();
  await loadOwnerData();
  startOwnerRealtime();
  renderShell();
}
function renderPolicyGate(){
  app.innerHTML=`<main class="screen"><section class="auth-card"><a class="brand" href="../"><svg class="brand-mark" viewBox="0 0 120 120" fill="none" stroke="#7fffd4" stroke-width="8" aria-hidden="true"><circle cx="60" cy="26" r="15"/><circle cx="28" cy="82" r="15"/><circle cx="92" cy="82" r="15"/></svg><div><h2>Before you continue</h2><p class="tagline">Please review and accept the Refills policy</p></div></a><div class="card"><p class="muted">${html(DIGIT58_POLICY_TEXT)}</p></div><div class="actions" style="margin-top:16px"><button class="btn full" id="acceptPolicyBtn">I Accept</button><button class="btn secondary full" id="policyLogout">Sign out</button></div></section></main>${siteFooter()}`;
  (typeof bindAndroidAppFooter==='function'&&bindAndroidAppFooter());
  $('#acceptPolicyBtn').onclick=async()=>{
    const button=$('#acceptPolicyBtn');button.disabled=true;
    try{
      const result=await api.executeFunction(api.config.digitalOrderFunctionId,{action:'digit58-accept-policy',ownerId:cloudOwnerId()});
      entitlement=result.entitlement||{...entitlement,policyAcceptedAt:now()};
      await loadOwnerData();
      startOwnerRealtime();
      renderShell();
    }catch(error){button.disabled=false;toast(error.message||'Could not save your acceptance')}
  };
  $('#policyLogout').onclick=async()=>{await api.logout();session=null;renderOwnerAuth()};
}
async function loadEntitlement(){
  const ownerId=cloudOwnerId();if(!ownerId)return;
  const [entitlements,requests]=await Promise.all([
    api.list(ENTITLEMENT_KIND).catch(()=>[]),
    api.list(REQUEST_KIND).catch(()=>[]),
  ]);
  entitlement=entitlements.find(row=>row.ownerId===ownerId)||null;
  const ownerRequests=requests.filter(row=>row.ownerId===ownerId).sort((a,b)=>new Date(b.createdAt)-new Date(a.createdAt));
  myRequest=ownerRequests.find(row=>row.type!=='additional-store')||null;
  myStoreRequest=ownerRequests.find(row=>row.type==='additional-store')||null;
}
function hasActiveEntitlement(){
  if(!entitlement||!entitlement.active||entitlement.paused)return false;
  if(entitlement.expiresAt&&new Date(entitlement.expiresAt).getTime()<Date.now())return false;
  return true;
}
function renderAccessGate(){
  const status=myRequest?.status||'';
  let body='';
  if(entitlement?.paused){
    body=`<div class="card"><p class="muted">Your store subscription is currently paused by the G58 team. Contact G58 support to resume access.</p></div>`;
  }else if(entitlement&&entitlement.expiresAt&&new Date(entitlement.expiresAt).getTime()<Date.now()){
    body=`<div class="card"><p class="muted">Your store subscription has expired. Request a new activation below to continue.</p></div>${accessRequestBlock(status)}`;
  }else if(status==='Requested'){
    body=`<div class="card"><p class="muted">Your activation request has been sent to the G58 team. You'll see a payment link here once they review it.</p></div>`;
  }else if(status==='Payment Link Sent'){
    body=`<div class="card"><p class="muted">Pay ${money(myRequest.amount||SUBSCRIPTION_AMOUNT)} using the secure link below, then wait for G58 to confirm and activate your store portal.</p><a class="btn full" href="${html(myRequest.paymentLink)}" target="_blank" rel="noopener" style="margin-top:12px;display:block;text-align:center;text-decoration:none">Pay ${money(myRequest.amount||SUBSCRIPTION_AMOUNT)}</a></div>`;
  }else if(status==='Rejected'){
    body=`<div class="card"><p class="muted">Your last activation request was not approved. You can send a new request below.</p></div>${accessRequestBlock(status)}`;
  }else{
    body=accessRequestBlock(status);
  }
  app.innerHTML=`<main class="screen"><section class="auth-card"><a class="brand" href="../"><svg class="brand-mark" viewBox="0 0 120 120" fill="none" stroke="#7fffd4" stroke-width="8" aria-hidden="true"><circle cx="60" cy="26" r="15"/><circle cx="28" cy="82" r="15"/><circle cx="92" cy="82" r="15"/></svg><div><h2>Refills</h2><p class="tagline">Store portal access is ${money(SUBSCRIPTION_AMOUNT)}/month.</p></div></a>${body}<div class="actions" style="margin-top:16px"><button class="btn secondary full" id="gateLogout">Sign out</button></div></section></main>${siteFooter()}`;
  (typeof bindAndroidAppFooter==='function'&&bindAndroidAppFooter());
  $('#requestAccessBtn')?.addEventListener('click',requestStoreAccess);
  $('#gateLogout').onclick=async()=>{stopOwnerRealtime();await api.logout();session=null;renderOwnerAuth()};
}
function accessRequestBlock(status){
  return `<div class="card"><p class="muted">Request store access for ${money(SUBSCRIPTION_AMOUNT)}/month. The G58 team will review your request and send a secure payment link.</p><button class="btn full" id="requestAccessBtn" style="margin-top:12px">${status==='Rejected'?'Send New Request':'Request Store Access'}</button></div>`;
}
async function requestStoreAccess(){
  const button=$('#requestAccessBtn');button.disabled=true;
  try{
    const record={id:id('req'),ownerId:cloudOwnerId(),ownerEmail:session.email,ownerName:session.name||session.email.split('@')[0],amount:SUBSCRIPTION_AMOUNT,status:'Requested',type:'initial',paymentLink:'',createdAt:now()};
    const created=await api.create(REQUEST_KIND,record,record.id,api.collaborativePermissionSet?.(record.ownerId));
    myRequest=created;
    renderAccessGate();
    toast('Activation request sent to the G58 team');
  }catch(error){button.disabled=false;toast(error.message||'Could not send activation request')}
}
async function requestAdditionalStore(){
  const button=$('#requestStoreSlot');if(button)button.disabled=true;
  try{
    const record={id:id('req'),ownerId:cloudOwnerId(),ownerEmail:session.email,ownerName:session.name||session.email.split('@')[0],amount:SUBSCRIPTION_AMOUNT,status:'Requested',type:'additional-store',paymentLink:'',createdAt:now()};
    const created=await api.create(REQUEST_KIND,record,record.id,api.collaborativePermissionSet?.(record.ownerId));
    myStoreRequest=created;
    storesView();
    toast('Additional store request sent to the G58 team');
  }catch(error){if(button)button.disabled=false;toast(error.message||'Could not send request')}
}
function renderConfigError(){app.innerHTML=`<main class="screen"><section class="auth-card"><a class="brand" href="../"><svg class="brand-mark" viewBox="0 0 120 120" fill="none" stroke="#7fffd4" stroke-width="8" aria-hidden="true"><circle cx="60" cy="26" r="15"/><circle cx="28" cy="82" r="15"/><circle cx="92" cy="82" r="15"/></svg><div><h2>Refills</h2><p class="tagline">Take any store online</p></div></a><p>Refills is temporarily unavailable. Please try again shortly.</p></section></main>${siteFooter()}`;(typeof bindAndroidAppFooter==='function'&&bindAndroidAppFooter())}

function renderOwnerAuth(){
  app.innerHTML=`<main class="screen"><section class="auth-card">
    <a class="brand" href="../"><svg class="brand-mark" viewBox="0 0 120 120" fill="none" stroke="#7fffd4" stroke-width="8" aria-hidden="true"><circle cx="60" cy="26" r="15"/><circle cx="28" cy="82" r="15"/><circle cx="92" cy="82" r="15"/></svg><div><h2>Refills</h2><p class="tagline">Turn your store digital — orders, customers and reminders in one place.</p></div></a>
    <div class="actions" style="margin-bottom:14px"><button class="btn small" id="tabLogin">Sign in</button><button class="btn small secondary" id="tabSignup">Create store account</button></div>
    <form id="ownerAuthForm">
      <div class="field full-name-field hidden"><label>Your name</label><input name="name"></div>
      <div class="field"><label>Email</label><input name="email" type="email" required></div>
      <div class="field"><label>Password</label><input name="password" type="password" minlength="8" required></div>
      <button class="btn full" id="ownerAuthSubmit" type="submit">Sign In</button>
    </form>
    <p class="muted" style="text-align:center;margin-top:14px">Are you a customer? Use the link your store shared with you.</p>
  </section></main>${siteFooter()}`;
  (typeof bindAndroidAppFooter==='function'&&bindAndroidAppFooter());
  let mode='login';
  const syncMode=()=>{$('.full-name-field').classList.toggle('hidden',mode!=='signup');$('#ownerAuthSubmit').textContent=mode==='signup'?'Create Account':'Sign In';$('#tabLogin').className=mode==='login'?'btn small':'btn small secondary';$('#tabSignup').className=mode==='signup'?'btn small':'btn small secondary'};
  $('#tabLogin').onclick=()=>{mode='login';syncMode()};
  $('#tabSignup').onclick=()=>{mode='signup';syncMode()};
  $('#ownerAuthForm').onsubmit=async event=>{
    event.preventDefault();
    const values=Object.fromEntries(new FormData(event.target)),button=$('#ownerAuthSubmit');
    button.disabled=true;
    try{
      if(mode==='signup')await api.register(values.email.trim(),values.password,values.name.trim()||values.email.split('@')[0]);
      else await api.login(values.email.trim(),values.password);
      session=await api.currentUser();
      await loadEntitlement();
      if(!hasActiveEntitlement())return renderAccessGate();
      await proceedAfterEntitlement();
    }catch(error){button.disabled=false;toast(error.message||'Could not sign in')}
  };
}

async function loadOwnerData(){
  const ownerId=cloudOwnerId();if(!ownerId)return;
  const [stores,customers,cards,orders,promotions]=await Promise.all([
    api.list(storeKind(ownerId)).catch(()=>[]),
    api.list(customerKind(ownerId)).catch(()=>[]),
    api.list(cardKind(ownerId)).catch(()=>[]),
    api.list(orderKind(ownerId)).catch(()=>[]),
    api.list(promotionKind(ownerId)).catch(()=>[]),
  ]);
  state.stores=stores;state.customers=customers;state.cards=cards;state.orders=orders;state.promotions=await cleanupExpiredOwnerPromotions(ownerId,promotions);
  if(!state.activeStoreId||!stores.some(row=>row.id===state.activeStoreId))state.activeStoreId=stores[0]?.id||'';
  save();
}

function floatingSupportButton(source){return `<button type="button" class="floating-support-btn" data-support-source="${html(source)}" title="Support">🛟<span>Support</span></button>`}
function bindFloatingSupportButton(){
  $('.floating-support-btn')?.addEventListener('click',event=>{
    const source=event.currentTarget.dataset.supportSource||'digit58';
    $('#supportPopup')?.remove();
    document.body.insertAdjacentHTML('beforeend',`<aside class="support-popup" id="supportPopup" role="dialog" aria-modal="false" aria-labelledby="supportPopupTitle"><button class="support-popup-close" id="supportPopupClose" type="button" aria-label="Close support">✕</button><span class="chip">G58 Support</span><h3 id="supportPopupTitle">How can we help?</h3><p>Open your secure support centre to raise a ticket or read replies from the G58 team.</p><a class="btn full" href="/support/?from=${encodeURIComponent(source)}">Open Support Centre</a></aside>`);
    $('#supportPopupClose').onclick=()=>$('#supportPopup')?.remove();
  });
}
function siteFooter(forCustomer){
  const badge=forCustomer
    ? `<a class="g58-app-badge" href="/downloads/GRAVITY58-Refills-Android-v1.2.apk" download aria-label="Download the G58 Refills Android app"><span class="g58-app-badge-icon">▶</span><span class="g58-app-badge-text"><small>Never miss a refill</small><strong>Get the G58 Refills App</strong></span></a>`
    : `<a class="g58-app-badge" href="/downloads/GRAVITY58-Android-v1.3.apk" download aria-label="Download the Gravity58 Android app"><span class="g58-app-badge-icon">▶</span><span class="g58-app-badge-text"><small>Download Android</small><strong>Get G58 App</strong></span></a>`;
  return `<footer class="g58-site-footer"><div class="g58-site-footer-badge">${badge}</div><p class="g58-site-footer-note">© ${new Date().getFullYear()} Gravity58 · Refills</p></footer>`;
}
function renderShell(){
  const store=activeStore();
  app.innerHTML=`<div class="shell"><aside class="sidebar"><a class="brand" href="../"><svg class="brand-mark" viewBox="0 0 120 120" fill="none" stroke="#7fffd4" stroke-width="8" aria-hidden="true"><circle cx="60" cy="26" r="15"/><circle cx="28" cy="82" r="15"/><circle cx="92" cy="82" r="15"/></svg><div><strong>Refills</strong><small class="muted">Store workspace</small></div></a><nav class="nav">${navButton('dashboard','◉','Dashboard')}${navButton('stores','◫','My Stores')}${navButton('promotions','✦','Promotions')}${navButton('wall','☰','Customer Wall')}${navButton('orders','🧾','Orders')}${navButton('orderHistory','🕘','Order History')}${navButton('subscription','♢','Subscription')}${navButton('settings','⚙','Settings')}<button id="logout">⇥ Logout</button></nav></aside><main class="main"><header class="topbar"><div>${state.stores.length?`<select id="storeSwitch">${state.stores.map(row=>`<option value="${html(row.id)}" ${row.id===state.activeStoreId?'selected':''}>${html(row.name)}</option>`).join('')}</select>`:'<strong>No store yet</strong>'}</div><a class="g58-topbar-home" href="https://www.g58.in/" aria-label="Open the Gravity58 home page">www.g58.in</a><span class="status-pill"><span class="dot"></span>${html(session?.email||'')}</span></header><section class="content" id="page"></section></main></div>${siteFooter()}${floatingSupportButton('digit58')}`;
  $$('[data-view]').forEach(button=>button.onclick=()=>{view=button.dataset.view;renderShell()});
  $('#logout').onclick=async()=>{stopOwnerRealtime();await api.logout();session=null;renderOwnerAuth()};
  $('#storeSwitch')?.addEventListener('change',event=>{state.activeStoreId=event.target.value;save();renderShell()});
  bindFloatingSupportButton();
  renderView();
}
function navButton(key,icon,label){return `<button data-view="${key}" class="${view===key?'active':''}"><span>${icon}</span>${label}</button>`}
function renderView(){if(!activeStore()&&view!=='stores'&&view!=='settings'&&view!=='subscription'){view='stores';return renderShell()}({dashboard:dashboardView,stores:storesView,promotions:promotionsView,wall:customerWallView,orders:ordersView,orderHistory:orderHistoryView,subscription:subscriptionView,settings:settingsView}[view]||dashboardView)()}
function ordersView(){
  refreshView=ordersView;
  const orders=activeOrders(state.orders).sort((a,b)=>new Date(b.createdAt)-new Date(a.createdAt));
  const approvalCount=orders.filter(order=>order.status==='Minimum Approval Requested').length;
  const multiStore=state.stores.length>1;
  $('#page').innerHTML=`<div class="section-head"><div><h1>Orders</h1><p class="muted">All active orders from every customer${multiStore?', across every store':''}.</p></div>${approvalCount?`<span class="chip due">${approvalCount} minimum approval request${approvalCount===1?'':'s'}</span>`:''}</div><div class="grid card-grid">${orders.map(order=>ownerOrderMarkup(order,true,multiStore)).join('')||'<div class="empty">No active orders right now.</div>'}</div>`;
  bindOwnerOrderActions();
  bindOrderChatForms(orders,'owner',refreshView);
  bindDeliveryShareButtons(orders);
}
function subscriptionView(){
  refreshView=subscriptionView;
  const expiry=entitlement?.lifetime?'Lifetime access':entitlement?.expiresAt?new Date(entitlement.expiresAt).toLocaleDateString('en-IN',{dateStyle:'medium'}):'—';
  const status=entitlement?.paused?'Paused':hasActiveEntitlement()?'Active':'Inactive';
  $('#page').innerHTML=`<div class="section-head"><div><h1>Subscription</h1><p class="muted">Your Refills store portal access.</p></div></div><div class="card" style="max-width:420px"><span class="chip">Refills Store Access</span><h2 style="margin:10px 0">${money(SUBSCRIPTION_AMOUNT)}<small class="muted" style="font-size:14px"> /month</small></h2><div class="chips"><span class="chip ${status==='Active'?'delivered':status==='Paused'?'due':''}">${status}</span></div><p class="muted" style="margin-top:12px">${entitlement?.lifetime?'Your subscription never expires.':`Renews / expires: ${expiry}`}</p>${status==='Paused'?'<p class="muted">Contact the G58 team to resume access.</p>':''}</div>`;
}

function metric(title,value){return `<article class="card metric"><span>${html(title)}</span><strong>${value}</strong></article>`}
function periodBounds(){
  const n=new Date();
  const startOfDay=d=>{const x=new Date(d);x.setHours(0,0,0,0);return x};
  const weekStart=startOfDay(n);weekStart.setDate(weekStart.getDate()-((weekStart.getDay()+6)%7));
  const lastWeekStart=new Date(weekStart);lastWeekStart.setDate(lastWeekStart.getDate()-7);
  const nextWeekStart=new Date(weekStart);nextWeekStart.setDate(nextWeekStart.getDate()+7);
  const monthStart=new Date(n.getFullYear(),n.getMonth(),1);
  const lastMonthStart=new Date(n.getFullYear(),n.getMonth()-1,1);
  const nextMonthStart=new Date(n.getFullYear(),n.getMonth()+1,1);
  const yearStart=new Date(n.getFullYear(),0,1);
  const lastYearStart=new Date(n.getFullYear()-1,0,1);
  const nextYearStart=new Date(n.getFullYear()+1,0,1);
  return {weekStart,lastWeekStart,nextWeekStart,monthStart,lastMonthStart,nextMonthStart,yearStart,lastYearStart,nextYearStart};
}
function dateRangeStats(orders,from,to){
  const filtered=orders.filter(order=>{
    if(order.status!=='Delivered')return false;
    const at=new Date(order.deliveredAt||order.updatedAt||order.createdAt);
    return at>=from&&at<to;
  });
  return {count:filtered.length,revenue:filtered.reduce((sum,order)=>sum+Number(order.amount||0),0)};
}
function deltaChip(current,previous){
  if(!current&&!previous)return '<span class="chip">No data yet</span>';
  const delta=previous?Math.round(((current-previous)/previous)*100):100;
  const up=delta>=0;
  return `<span class="chip ${up?'delivered':'due'}">${up?'▲':'▼'} ${Math.abs(delta)}%</span>`;
}
function compareBlock(label,current,previous){
  return `<article class="card metric"><span>${html(label)}</span><strong>${money(current.revenue)}</strong><small class="muted">${current.count} delivered order(s)</small><div style="margin-top:8px;display:flex;align-items:center;gap:6px;flex-wrap:wrap">${deltaChip(current.revenue,previous.revenue)}<small class="muted">vs ${money(previous.revenue)} previous</small></div></article>`;
}
function storeWiseTable(bounds){
  if(!state.stores.length)return '<div class="empty">No stores yet.</div>';
  const rows=state.stores.map(store=>{
    const orders=storeOrders(store.id);
    const allTime=dateRangeStats(orders,new Date(0),new Date(8640000000000000));
    const thisMonth=dateRangeStats(orders,bounds.monthStart,bounds.nextMonthStart);
    const lastMonth=dateRangeStats(orders,bounds.lastMonthStart,bounds.monthStart);
    const active=activeOrders(orders).length;
    return `<tr><td><strong>${html(store.name)}</strong></td><td>${active}</td><td>${allTime.count}</td><td>${money(allTime.revenue)}</td><td>${money(thisMonth.revenue)}</td><td>${deltaChip(thisMonth.revenue,lastMonth.revenue)}</td></tr>`;
  }).join('');
  return `<table><thead><tr><th>Store</th><th>Active Orders</th><th>Delivered Orders</th><th>Total Revenue</th><th>This Month</th><th>Month vs Last</th></tr></thead><tbody>${rows}</tbody></table>`;
}
function dashboardView(){
  refreshView=dashboardView;
  const store=activeStore();
  const cards=state.cards.filter(row=>row.storeId===store?.id);
  const orders=activeOrders(storeOrders(store?.id));
  const due=cards.filter(isCardDue).length;
  const needsAttention=orders.filter(row=>['Requested','Priced','Minimum Approval Requested'].includes(row.status));
  const bounds=periodBounds();
  const allOrders=state.orders;
  const thisWeek=dateRangeStats(allOrders,bounds.weekStart,bounds.nextWeekStart),lastWeek=dateRangeStats(allOrders,bounds.lastWeekStart,bounds.weekStart);
  const thisMonth=dateRangeStats(allOrders,bounds.monthStart,bounds.nextMonthStart),lastMonth=dateRangeStats(allOrders,bounds.lastMonthStart,bounds.monthStart);
  const thisYear=dateRangeStats(allOrders,bounds.yearStart,bounds.nextYearStart),lastYear=dateRangeStats(allOrders,bounds.lastYearStart,bounds.yearStart);
  $('#page').innerHTML=`<div class="section-head"><div><h1>${html(store?.name||'Dashboard')}</h1><p class="muted">${html(store?.category||'')}${store?.city?' · '+html(store.city):''}</p></div></div>
  <div class="grid stats">${metric('Customers',ownerCustomers(store?.id).length)}${metric('Active Orders',orders.length)}${metric('Due For Reminder',due)}${metric('Deliveries Made',cards.reduce((sum,row)=>sum+(Number(row.timesDelivered)||0),0))}</div>
  <div class="section-head"><h2>Revenue — all stores</h2></div>
  <div class="grid stats">${compareBlock('This Week',thisWeek,lastWeek)}${compareBlock('This Month',thisMonth,lastMonth)}${compareBlock('This Year',thisYear,lastYear)}</div>
  <div class="section-head"><h2>Store-wise performance</h2></div>
  <div class="card table-wrap">${storeWiseTable(bounds)}</div>
  <div class="section-head"><h2>Orders needing attention</h2></div><div class="card table-wrap">${ordersNeedingAttentionTable(needsAttention)}</div>
  <div class="section-head"><h2>Recent buy-again requests</h2></div><div class="card table-wrap">${buyRequestsTable(cards)}</div>`;
  bindBuyRequestActions();
  $$('[data-open-order-customer]').forEach(button=>button.onclick=()=>{view='wall';customerDetailView(button.dataset.openOrderCustomer)});
}
function ordersNeedingAttentionTable(orders){
  if(!orders.length)return `<div class="empty">No orders waiting on you right now.</div>`;
  return `<table><thead><tr><th>Customer</th><th>Items</th><th>Status</th><th>Action</th></tr></thead><tbody>${orders.map(order=>{const customer=state.customers.find(c=>c.customerAccountId===order.customerAccountId&&c.storeId===order.storeId);return `<tr><td>${html(customer?.customerName||order.customerName||'Customer')}</td><td>${order.items.map(item=>`${item.qty}×${html(item.name)}`).join(', ')}</td><td>${html(order.status)}</td><td>${customer?`<button class="btn small" data-open-order-customer="${html(customer.id)}">Open</button>`:''}</td></tr>`}).join('')}</tbody></table>`;
}
function buyRequestsTable(cards){
  const requested=cards.filter(row=>row.status==='Buy Requested');
  if(!requested.length)return `<div class="empty">No pending requests.</div>`;
  return `<table><thead><tr><th>Customer</th><th>Item</th><th>Requested</th><th>Action</th></tr></thead><tbody>${requested.map(row=>{const customer=state.customers.find(c=>c.customerAccountId===row.customerAccountId&&c.storeId===row.storeId);return `<tr><td>${html(customer?.customerName||'Customer')}</td><td>${html(row.productName)} · ${money(row.price)}</td><td>${row.buyRequestedAt?new Date(row.buyRequestedAt).toLocaleString('en-IN',{dateStyle:'medium',timeStyle:'short'}):''}</td><td><button class="btn small green" data-deliver="${html(row.id)}">Mark Delivered</button></td></tr>`}).join('')}</tbody></table>`;
}
function bindBuyRequestActions(){$$('[data-deliver]').forEach(button=>button.onclick=()=>deliverCard(button.dataset.deliver))}

function storesView(){
  refreshView=storesView;
  const allowed=storeSlotsAllowed(),canCreate=state.stores.length<allowed,pending=myStoreRequest;
  let requestBlock='';
  if(!canCreate){
    if(pending?.status==='Requested')requestBlock=`<div class="card" style="margin-bottom:16px"><p class="muted">Your request for an additional store (${money(SUBSCRIPTION_AMOUNT)}/month) is with the G58 team. A payment link will appear here once it's reviewed.</p></div>`;
    else if(pending?.status==='Payment Link Sent')requestBlock=`<div class="card" style="margin-bottom:16px"><p class="muted">Pay ${money(pending.amount||SUBSCRIPTION_AMOUNT)} to unlock your next store slot.</p><a class="btn full" href="${html(pending.paymentLink)}" target="_blank" rel="noopener" style="margin-top:10px;display:block;text-align:center;text-decoration:none">Pay ${money(pending.amount||SUBSCRIPTION_AMOUNT)}</a></div>`;
    else requestBlock=`<div class="card" style="margin-bottom:16px"><p class="muted">You're using all ${allowed} paid store slot(s). Every additional store is ${money(SUBSCRIPTION_AMOUNT)}/month — request one from the G58 team.</p><button class="btn full" id="requestStoreSlot" style="margin-top:10px">Request Additional Store (${money(SUBSCRIPTION_AMOUNT)}/month)</button></div>`;
  }
  $('#page').innerHTML=`<div class="section-head"><div><h1>My Stores</h1><p class="muted">${state.stores.length} of ${allowed} paid store slot(s) used. Create a store, then share its customer link so people can sign up.</p></div><button class="btn" id="addStore" ${canCreate?'':'disabled'}>+ New Store</button></div>${requestBlock}<div class="grid store-grid">${state.stores.map(storeCard).join('')||'<div class="empty">No stores yet — create your first one.</div>'}</div>`;
  $('#addStore').onclick=()=>{if(!canCreate)return toast('Request and pay for an additional store slot first');openStoreForm()};
  $('#requestStoreSlot')?.addEventListener('click',requestAdditionalStore);
  $$('[data-share-store]').forEach(button=>button.onclick=()=>shareStoreModal(button.dataset.shareStore));
  $$('[data-edit-store]').forEach(button=>button.onclick=()=>openStoreForm(button.dataset.editStore));
}
function storeCard(store){
  const link=publicStoreLink(store);
  return `<article class="card"><h3>${html(store.name)}</h3>${storeMinimum(store)?`<p class="store-minimum-order">Minimum new order ${money(storeMinimum(store))}</p>`:''}<p class="muted">${html(store.category)}${store.city?' · '+html(store.city):''}</p>${store.highlightText?`<p class="store-highlight-text">${html(store.highlightText)}</p>`:''}<p>${html(store.description||'')}</p><div class="chips"><span class="chip">${ownerCustomers(store.id).length} customers</span>${store.razorpayEnabled&&validRazorpayLink(store.razorpayLink)?'<span class="chip delivered">Razorpay enabled</span>':''}${store.suspended?'<span class="chip due">Paused by G58 admin</span>':''}</div><div class="actions"><button class="btn small" data-share-store="${html(store.id)}">Share Link / QR</button><button class="btn small secondary" data-edit-store="${html(store.id)}">Edit</button></div></article>`;
}
function publicStoreLink(store){return `${location.origin}${location.pathname.replace(/index\.html$/,'')}#store&owner=${encodeURIComponent(store.ownerId)}&store=${encodeURIComponent(store.id)}`}
function openStoreForm(storeId=''){
  const store=state.stores.find(row=>row.id===storeId)||{};
  const minimumEnabled=store.minimumOrderEnabled===true||(store.minimumOrderEnabled!==false&&configuredStoreMinimum(store)>0);
  modal(storeId?'Edit Store':'Create Store',`<form id="storeForm"><div class="field"><label>Store name</label><input name="name" value="${html(store.name||'')}" required></div><label class="option-toggle"><input id="minimumOrderEnabled" name="minimumOrderEnabled" type="checkbox" ${minimumEnabled?'checked':''}><span><strong>Enable minimum new order criteria</strong><small>Switch this off anytime. Refills and history Reorders never use this limit.</small></span></label><div class="field ${minimumEnabled?'':'hidden'}" id="minimumOrderValueField"><label>Minimum new order value (₹)</label><input name="minimumOrderValue" type="number" min="1" step="1" value="${configuredStoreMinimum(store)||''}" placeholder="Example: 500"><small class="muted">A customer below this value can request a one-order approval from you.</small></div><div class="form-grid"><div class="field"><label>Category</label><input name="category" value="${html(store.category||'')}" placeholder="Example: Pharmacy"></div><div class="field"><label>City</label><input name="city" value="${html(store.city||'')}"></div></div><div class="field"><label>Customer highlight text <small>(optional)</small></label><input name="highlightText" maxlength="40" value="${html(store.highlightText||'')}" placeholder="Example: 20% Off"><small class="muted">Shown as bold orange text on this store's customer page.</small></div><div class="field"><label>Phone</label><input name="phone" value="${html(store.phone||'')}"></div><div class="field"><label>UPI ID <small>(for order payment QR codes)</small></label><input name="upiId" value="${html(store.upiId||'')}" placeholder="yourstore@upi"></div><label class="option-toggle"><input id="razorpayEnabled" name="razorpayEnabled" type="checkbox" ${store.razorpayEnabled?'checked':''}><span><strong>Enable Razorpay payment link</strong><small>Optional — customers can open your Razorpay page after you set the order amount.</small></span></label><div class="field ${store.razorpayEnabled?'':'hidden'}" id="razorpayLinkField"><label>Razorpay payment link</label><input name="razorpayLink" type="text" inputmode="url" value="${html(store.razorpayLink||'')}" placeholder="razorpay.me/@yourstore"><small class="muted">Only razorpay.me or rzp.io secure links are accepted. https:// is added automatically.</small><div class="razorpay-link-note"><strong>How reusable Razorpay.me links work</strong><small>Razorpay.me has no return-URL setting. After paying, the customer returns to the G58 tab and taps Payment completed. Always verify the payment in Razorpay before accepting the order.</small></div></div><div class="field"><label>Description</label><textarea name="description">${html(store.description||'')}</textarea></div><button class="btn full">${storeId?'Save Store':'Create Store'}</button></form>`,()=>{
    const minimumToggle=$('#minimumOrderEnabled'),minimumField=$('#minimumOrderValueField'),razorpayToggle=$('#razorpayEnabled'),razorpayField=$('#razorpayLinkField');
    minimumToggle.onchange=()=>minimumField.classList.toggle('hidden',!minimumToggle.checked);
    razorpayToggle.onchange=()=>razorpayField.classList.toggle('hidden',!razorpayToggle.checked);
    $('#storeForm').onsubmit=async event=>{
      event.preventDefault();
      const raw=Object.fromEntries(new FormData(event.target)),ownerId=cloudOwnerId(),button=event.submitter;
      const razorpayEnabled=razorpayToggle.checked,razorpayLink=normaliseRazorpayLink(raw.razorpayLink);
      if(razorpayEnabled&&!validRazorpayLink(razorpayLink))return toast('Enter a valid razorpay.me or rzp.io payment link');
      const minimumOrderEnabled=minimumToggle.checked,minimumOrderValue=Math.max(0,Number(raw.minimumOrderValue)||0);
      if(minimumOrderEnabled&&!minimumOrderValue)return toast('Enter the minimum new order value or switch the criteria off');
      const values={name:raw.name.trim(),minimumOrderEnabled,minimumOrderValue,category:raw.category.trim()||'General store',city:raw.city.trim(),highlightText:raw.highlightText.trim(),phone:raw.phone.trim(),upiId:raw.upiId.trim(),razorpayEnabled,razorpayLink:razorpayEnabled?razorpayLink:'',description:raw.description.trim()};
      button.disabled=true;
      try{
        if(storeId){
          await api.update(storeKind(ownerId),storeId,values);
          Object.assign(store,values);
          const ownerSummary={ownerId,ownerEmail:session?.email||'',storeId,storeName:values.name,category:values.category,city:values.city,createdAt:store.createdAt||now()};
          try{await api.update('digit58_owners',`owner-${storeId}`,ownerSummary)}
          catch{try{await api.create('digit58_owners',ownerSummary,`owner-${storeId}`,api.permissionSet?.('digit58_owners',ownerId,true))}catch{}}
        }else{
          const record={id:id('store'),ownerId,...values,createdAt:now()};
          const permissions=api.permissionSet?.(storeKind(ownerId),ownerId);
          const created=await api.create(storeKind(ownerId),record,record.id,permissions);
          state.stores.push({...record,...created});
          state.activeStoreId=record.id;
          try{await api.create('digit58_owners',{ownerId,ownerEmail:session?.email||'',storeId:record.id,storeName:record.name,category:record.category,city:record.city,createdAt:record.createdAt},`owner-${record.id}`,api.permissionSet?.('digit58_owners',ownerId,true))}catch{}
        }
        save();closeModal();renderShell();toast(storeId?'Store updated':'Store created — share its link with customers');
      }catch(error){button.disabled=false;toast(error.message||'Could not save store')}
    };
  });
}
function promotionsView(){
  refreshView=promotionsView;
  const store=activeStore(),promotions=storePromotions(store?.id).sort((a,b)=>new Date(b.createdAt||0)-new Date(a.createdAt||0));
  $('#page').innerHTML=`<div class="section-head"><div><h1>Promotions</h1><p class="muted">Create compact offer tickets that scroll above customer orders for ${html(store?.name||'this store')}.</p></div><button class="btn" id="addPromotion">+ New Promotion</button></div><div class="promotion-owner-grid">${promotions.map(promotionOwnerCard).join('')||'<div class="empty">No promotions yet. Create your first offer ticket.</div>'}</div>`;
  $('#addPromotion').onclick=()=>openPromotionForm();
  $$('[data-edit-promotion]').forEach(button=>button.onclick=()=>openPromotionForm(button.dataset.editPromotion));
  $$('[data-toggle-promotion]').forEach(button=>button.onclick=()=>togglePromotion(button.dataset.togglePromotion));
  $$('[data-delete-promotion]').forEach(button=>button.onclick=()=>deletePromotion(button.dataset.deletePromotion));
}
function promotionIsExpired(promotion){
  if(!promotion?.endsOn)return false;
  return promotion.endsOn<indiaDateValue();
}
async function cleanupExpiredOwnerPromotions(ownerId,promotions){
  const expired=promotions.filter(promotionIsExpired);
  if(expired.length)await Promise.allSettled(expired.map(promotion=>api.remove(promotionKind(ownerId),promotion.id)));
  return promotions.filter(promotion=>!promotionIsExpired(promotion));
}
function formatPromotionEnd(value){
  const date=new Date(`${value}T00:00:00`);
  return Number.isFinite(date.getTime())?date.toLocaleDateString('en-IN',{day:'numeric',month:'short'}):value;
}
function promotionOwnerCard(promotion){
  const expired=promotionIsExpired(promotion);
  return `<article class="promotion-ticket owner-ticket ${promotion.active===false||expired?'promotion-disabled':''}"><span class="promotion-ticket-badge">Special Offer</span><h3>${html(promotion.name)}</h3><p>${html(promotion.offerText||'Limited-time store offer')}</p>${Number(promotion.price)>0?`<strong class="promotion-offer-price">${offerPrice(promotion.price)}</strong>`:''}${promotion.endsOn?`<small class="promotion-end-date">Offer ends ${html(formatPromotionEnd(promotion.endsOn))}</small>`:''}<div class="chips"><span class="chip ${promotion.active===false||expired?'due':'delivered'}">${expired?'Expired':promotion.active===false?'Paused':'Visible to customers'}</span></div><div class="actions"><button class="btn small" data-edit-promotion="${html(promotion.id)}">Edit</button><button class="btn small secondary" data-toggle-promotion="${html(promotion.id)}">${promotion.active===false?'Enable':'Pause'}</button><button class="btn small red" data-delete-promotion="${html(promotion.id)}">Delete</button></div></article>`;
}
function openPromotionForm(promotionId=''){
  const store=activeStore(),promotion=state.promotions.find(row=>row.id===promotionId)||{};if(!store)return;
  const defaultEnd=indiaDateValue(new Date(Date.now()+7*86400000)),today=indiaDateValue();
  modal(promotionId?'Edit Promotion':'Create Promotion',`<form id="promotionForm"><div class="field"><label>Product name</label><input name="name" value="${html(promotion.name||'')}" placeholder="Organic Honey" maxlength="80" required></div><div class="field"><label>Offer line</label><input name="offerText" value="${html(promotion.offerText||'')}" placeholder="Pure 500g jar · limited stock" maxlength="120"></div><div class="form-grid"><div class="field"><label>Offer price</label><input name="price" type="number" min="0" step="0.01" value="${Number(promotion.price)||''}" placeholder="299" required></div><div class="field"><label>Offer ends</label><input name="endsOn" type="date" min="${today}" value="${html(promotion.endsOn||defaultEnd)}" required></div></div><label class="option-toggle"><input name="active" type="checkbox" ${promotion.active===false?'':'checked'}><span><strong>Show to customers</strong><small>Paused promotions remain saved but disappear from the customer portal.</small></span></label><button class="btn full" style="margin-top:14px">${promotionId?'Save Promotion':'Publish Promotion'}</button></form>`,()=>{
    $('#promotionForm').onsubmit=async event=>{
      event.preventDefault();
      const raw=Object.fromEntries(new FormData(event.target)),button=event.submitter,ownerId=cloudOwnerId();
      const values={name:raw.name.trim(),offerText:raw.offerText.trim(),price:Math.max(0,Number(raw.price)||0),endsOn:raw.endsOn,badge:'Special Offer',active:$('input[name="active"]',event.target).checked,updatedAt:now()};
      if(!values.name)return toast('Enter a product name');
      if(!values.endsOn||values.endsOn<today)return toast('Choose today or a future offer end date');
      button.disabled=true;
      try{
        if(promotionId){await api.update(promotionKind(ownerId),promotionId,values);Object.assign(promotion,values)}
        else{
          const record={id:id('promo'),ownerId,storeId:store.id,...values,createdAt:now()};
          const created=await api.create(promotionKind(ownerId),record,record.id,api.permissionSet?.(promotionKind(ownerId),ownerId));
          state.promotions.unshift({...record,...created});
        }
        save();closeModal();promotionsView();toast(promotionId?'Promotion updated':'Promotion published to customers');
      }catch(error){button.disabled=false;toast(error.message||'Could not save promotion')}
    };
  });
}
async function togglePromotion(promotionId){
  const promotion=state.promotions.find(row=>row.id===promotionId);if(!promotion)return;
  const active=promotion.active===false;
  try{await api.update(promotionKind(promotion.ownerId),promotion.id,{active,updatedAt:now()});promotion.active=active;save();promotionsView();toast(active?'Promotion enabled':'Promotion paused')}
  catch(error){toast(error.message||'Could not update promotion')}
}
async function deletePromotion(promotionId){
  const promotion=state.promotions.find(row=>row.id===promotionId);if(!promotion||!confirm(`Delete the ${promotion.name} promotion?`))return;
  try{await api.remove(promotionKind(promotion.ownerId),promotion.id);state.promotions=state.promotions.filter(row=>row.id!==promotion.id);save();promotionsView();toast('Promotion deleted')}
  catch(error){toast(error.message||'Could not delete promotion')}
}
function shareStoreModal(storeId){
  const store=state.stores.find(row=>row.id===storeId);if(!store)return;
  const link=publicStoreLink(store);
  modal('Share With Customers',`<p class="muted">Customers open this link, sign up, and see their reminder cards.</p><div class="field"><label>Customer link</label><input id="storeLinkOutput" readonly value="${html(link)}"></div><div class="actions"><button class="btn small green" id="copyStoreLink">Copy Link</button></div><div class="qr-wrap" id="storeQr" style="margin-top:16px"></div>`,()=>{
    $('#copyStoreLink').onclick=async()=>{try{await navigator.clipboard.writeText(link);toast('Link copied')}catch{toast('Could not copy link')}};
    if(window.QRCode)new QRCode($('#storeQr'),{text:link,width:180,height:180});
  });
}

function customerWallView(){
  refreshView=customerWallView;
  const store=activeStore();
  const customers=ownerCustomers(store?.id);
  $('#page').innerHTML=`<div class="section-head"><div><h1>Customer Wall</h1><p class="muted">Customers who signed up under ${html(store?.name||'this store')}.</p></div></div><div class="grid customer-grid">${customers.map(customerCardMarkup).join('')||'<div class="empty">No customers yet. Share your store link to get started.</div>'}</div>`;
  $$('[data-open-customer]').forEach(button=>button.onclick=()=>customerDetailView(button.dataset.openCustomer));
  $$('[data-remove-customer]').forEach(button=>button.onclick=()=>removeCustomer(button.dataset.removeCustomer));
}
function customerCardMarkup(customer){
  const cards=customerCards(customer.customerAccountId,customer.storeId);
  const due=cards.filter(isCardDue).length;
  return `<article class="card"><h3>${html(customer.customerName||'Customer')}</h3><p class="muted">${html(customer.customerEmail||'')}${customer.phone?' · '+html(customer.phone):''}</p>${customer.lastLoginAt?`<p class="muted">Last seen ${new Date(customer.lastLoginAt).toLocaleString('en-IN',{dateStyle:'medium',timeStyle:'short'})}</p>`:''}<div class="chips"><span class="chip">${cards.length} card(s)</span>${due?`<span class="chip due">${due} due</span>`:''}</div><div class="actions"><button class="btn small" data-open-customer="${html(customer.id)}">Open Customer Wall →</button><button class="btn small red" data-remove-customer="${html(customer.id)}">Remove</button></div></article>`;
}
async function removeCustomer(customerId){
  const customer=state.customers.find(row=>row.id===customerId);if(!customer)return;
  if(!confirm(`Remove ${customer.customerName||'this customer'}'s access and all their reminder cards? This cannot be undone.`))return;
  const ownerId=cloudOwnerId();
  try{
    const cards=customerCards(customer.customerAccountId,customer.storeId);
    for(const card of cards)await api.remove(cardKind(ownerId),card.id).catch(()=>{});
    await api.remove(customerKind(ownerId),customerId);
    state.customers=state.customers.filter(row=>row.id!==customerId);
    state.cards=state.cards.filter(row=>!(row.storeId===customer.storeId&&row.customerAccountId===customer.customerAccountId));
    save();
    view='wall';renderShell();
    toast('Customer removed');
  }catch(error){toast(error.message||'Could not remove customer')}
}
function customerDetailView(customerId){
  refreshView=()=>customerDetailView(customerId);
  const customer=state.customers.find(row=>row.id===customerId);if(!customer)return;
  const cards=customerCards(customer.customerAccountId,customer.storeId);
  const orders=activeOrders(customerOrders(customer.customerAccountId,customer.storeId)).sort((a,b)=>new Date(b.createdAt)-new Date(a.createdAt));
  $('#page').innerHTML=`<div class="section-head"><div><h1>${html(customer.customerName||'Customer')}</h1><p class="muted">${html(customer.customerEmail||'')}</p></div><div class="actions"><button class="btn secondary" id="backToWall">← Back</button><button class="btn secondary" id="addOwnerOrder">+ Create Order</button><button class="btn" id="addCard">+ Add Reminder Card</button></div></div>
  <div class="section-head"><h2>Orders</h2></div>
  <div class="grid card-grid">${orders.map(order=>ownerOrderMarkup(order)).join('')||'<div class="empty">No active orders from this customer.</div>'}</div>
  <div class="section-head"><h2>Reminder Cards</h2></div>
  <div class="grid card-grid">${cards.map(ownerCardMarkup).join('')||'<div class="empty">No cards yet for this customer.</div>'}</div>`;
  $('#backToWall').onclick=()=>{view='wall';renderShell()};
  $('#addOwnerOrder').onclick=()=>openOwnerOrderForm(customer);
  $('#addCard').onclick=()=>openCardForm(customer);
  bindOwnerCardActions();
  bindOwnerOrderActions();
  bindOrderChatForms(orders,'owner',refreshView);
  bindCardChatForms(cards,'owner',refreshView);
  bindDeliveryShareButtons(orders);
  bindDeliveryShareButtons(cards);
}
const BIG_STATUS_SUB={
  'Pending Customer Acceptance':'The store started this order for you — accept it below to continue',
  'Minimum Approval Requested':'Waiting for the store to approve this below-minimum order',
  Requested:'Your order has been received by the store',
  Priced:'Review the amount below and pay to continue',
  'Payment Verification':'Payment submitted — waiting for the store to verify it',
  Accepted:'The store has accepted your order',
  Preparing:'Your order is being packed',
  'Out for Delivery':'On its way to you',
  Delivered:'Delivered successfully — enjoy!',
  Rejected:'This order was rejected by the store',
};
function bigStatusMarkup(status){
  const rejected=status==='Rejected';
  const step=ORDER_STEPS.find(s=>s.key===status);
  const icon=rejected?'🚫':(step?.icon||'📝');
  const label=rejected?'Order Rejected':(step?.label||status);
  const slug=String(status||'').toLowerCase().replace(/[^a-z]+/g,'-');
  return `<div class="big-status status-${slug} ${rejected?'rejected':''}"><span class="big-status-icon">${icon}</span><strong>${html(label)}</strong><small>${html(BIG_STATUS_SUB[status]||'')}</small></div>`;
}
function orderStepperMarkup(status){
  if(status==='Rejected')return `<div class="order-stepper"><div class="order-step current"><span class="order-step-icon">🚫</span><small>Rejected</small></div></div>`;
  if(status==='Minimum Approval Requested')return `<div class="order-stepper"><div class="order-step current"><span class="order-step-icon">⏳</span><small>Owner approval</small></div></div>`;
  if(status==='Pending Customer Acceptance')return `<div class="order-stepper"><div class="order-step current"><span class="order-step-icon">📞</span><small>Awaiting your acceptance</small></div></div>`;
  const currentIndex=ORDER_STEPS.findIndex(step=>step.key===status);
  return `<div class="order-stepper">${ORDER_STEPS.map((step,index)=>`<div class="order-step ${index<=currentIndex?'done':''} ${index===currentIndex?'current':''}"><span class="order-step-icon">${step.icon}</span><small>${step.label}</small></div>`).join('')}</div>`;
}
function orderChatMarkup(order,role){
  const messages=(order.messages||[]).slice(-8);
  return `<div class="order-chat"><div class="order-chat-log">${messages.map(message=>`<div class="order-message ${message.senderRole===role?'mine':''}"><strong>${html(message.senderRole==='owner'?'Store':message.senderName||'Customer')}</strong><span>${html(message.text)}</span></div>`).join('')||'<p class="muted no-messages">No messages yet.</p>'}</div><form class="order-chat-form" data-order-chat="${html(order.id)}"><input name="message" maxlength="240" placeholder="Message ${role==='owner'?'customer':'store'}"><button class="btn small" type="submit">Send</button></form></div>`;
}
async function sendOrderMessage(order,role,text,onSent){
  const message={senderRole:role,senderName:role==='owner'?(session?.name||'Store'):(order.customerName||'Customer'),text,createdAt:now()};
  const messages=[...(order.messages||[]),message];
  try{
    await api.update(orderKind(order.ownerId),order.id,{messages,updatedAt:now()});
    order.messages=messages;
    onSent?.();
  }catch(error){toast(error.message||'Could not send message')}
}
function bindOrderChatForms(orders,role,onSent){
  $$('[data-order-chat]').forEach(form=>{
    form.onsubmit=async event=>{
      event.preventDefault();
      const orderId=form.dataset.orderChat,order=orders.find(o=>o.id===orderId),input=form.querySelector('input[name="message"]'),text=input.value.trim();
      if(!text||!order)return;
      input.value='';
      await sendOrderMessage(order,role,text,onSent);
    };
  });
}
function cardChatMarkup(card,role){
  const messages=(card.messages||[]).slice(-8);
  return `<div class="order-chat"><div class="order-chat-log">${messages.map(message=>`<div class="order-message ${message.senderRole===role?'mine':''}"><strong>${html(message.senderRole==='owner'?'Store':message.senderName||'Customer')}</strong><span>${html(message.text)}</span></div>`).join('')||'<p class="muted no-messages">No messages yet.</p>'}</div><form class="order-chat-form" data-card-chat="${html(card.id)}"><input name="message" maxlength="240" placeholder="Message ${role==='owner'?'customer':'store'}"><button class="btn small" type="submit">Send</button></form></div>`;
}
async function sendCardMessage(card,role,text,onSent){
  const message={senderRole:role,senderName:role==='owner'?(session?.name||'Store'):(card.customerName||'Customer'),text,createdAt:now()};
  const messages=[...(card.messages||[]),message];
  try{
    await api.update(cardKind(card.ownerId),card.id,{messages,updatedAt:now()});
    card.messages=messages;
    onSent?.();
  }catch(error){toast(error.message||'Could not send message')}
}
function bindCardChatForms(cards,role,onSent){
  $$('[data-card-chat]').forEach(form=>{
    form.onsubmit=async event=>{
      event.preventDefault();
      const cardId=form.dataset.cardChat,card=cards.find(c=>c.id===cardId),input=form.querySelector('input[name="message"]'),text=input.value.trim();
      if(!text||!card)return;
      input.value='';
      await sendCardMessage(card,role,text,onSent);
    };
  });
}
function ownerOrderMarkup(order,showCustomer,showStore){
  const ringing=ringingIds.has(order.id);
  const customer=showCustomer?state.customers.find(c=>c.customerAccountId===order.customerAccountId&&c.storeId===order.storeId):null;
  const store=showStore?state.stores.find(s=>s.id===order.storeId):null;
  const paymentReview=order.paymentMarkedAt?`<div class="razorpay-owner-review"><span>Razorpay payment submitted</span><strong>Verify payment before accepting</strong><small>Customer marked this payment completed ${new Date(order.paymentMarkedAt).toLocaleString('en-IN',{dateStyle:'medium',timeStyle:'short'})}.</small></div>`:'';
  const visibleStatus=order.paymentMarkedAt&&order.status==='Priced'?'Payment Verification':order.status;
  return `<article class="card order-item-card ${ringing?'incoming-order':''} ${order.paymentMarkedAt?'payment-awaiting':''}">${ringing?'<span class="incoming-order-beacon" aria-label="New order" title="New order"></span>':''}<div class="section-head"><h3>Order #${html(order.id.slice(-6).toUpperCase())}</h3><span class="chip ${['Requested','Priced','Minimum Approval Requested'].includes(order.status)?'due':''}">${html(visibleStatus)}</span></div>${showStore?`<p class="muted" style="margin:-8px 0 0"><strong>${html(store?.name||'Store')}</strong></p>`:''}${showCustomer?`<p class="muted" style="margin:-4px 0 4px">${html(customer?.customerName||order.customerName||'Customer')}</p>`:''}${order.refillCardId?'<span class="chip delivered">Refill order</span>':''}${order.status==='Minimum Approval Requested'?`<div class="minimum-approval-owner"><strong>Below-minimum approval requested</strong><span>Customer estimate ${money(order.customerOrderValue)} · Store minimum ${money(order.minimumOrderValueAtOrder)}</span></div>`:''}${orderStepperMarkup(order.status)}<div class="order-items-list">${order.items.map(item=>`<div class="order-line-item"><span>${item.qty} ×</span><span>${html(item.name)}</span></div>`).join('')}</div>${Number(order.customerOrderValue)>0?`<div class="customer-order-value"><span>Customer estimated order value</span><strong>${money(order.customerOrderValue)}</strong></div>`:''}${(order.reorderedFrom||order.refillCardId)&&Number(order.previousAmount)>0?`<div class="previous-price-note"><span>${order.refillCardId?'Previous refill price':'Previous order amount'}</span><strong>${money(order.previousAmount)}</strong></div>`:''}${order.prescriptionUrl?`<a class="link-btn" href="${html(order.prescriptionUrl)}" target="_blank" rel="noopener">📄 View prescription</a>`:''}${order.amount?`<h3 style="margin:10px 0">${money(order.amount)}</h3>`:'<p class="muted">Amount not set yet.</p>'}${paymentReview}${deliveryContactMarkup(order)}<div class="actions">${orderOwnerActions(order)}</div>${orderChatMarkup(order,'owner')}</article>`;
}
function orderOwnerActions(order){
  const map={
    'Minimum Approval Requested':`<button class="btn small green" data-approve-minimum-order="${html(order.id)}">Approve Below-Minimum Order</button><button class="btn small red" data-reject-order="${html(order.id)}">Reject</button>`,
    Requested:`<button class="btn small" data-set-amount="${html(order.id)}">Set Amount</button><button class="btn small red" data-reject-order="${html(order.id)}">Reject</button>`,
    Priced:order.paymentMarkedAt?`<button class="btn small green" data-accept-order="${html(order.id)}">Payment Received — Accept</button><button class="btn small secondary" data-reopen-payment="${html(order.id)}">Payment Not Received</button>`:`<button class="btn small green" data-accept-order="${html(order.id)}">Accept Order</button><button class="btn small red" data-reject-order="${html(order.id)}">Reject</button>`,
    Accepted:`<button class="btn small green" data-advance-order="${html(order.id)}" data-next="Preparing">Start Preparing</button>`,
    Preparing:`<button class="btn small green" data-advance-order="${html(order.id)}" data-next="Out for Delivery">Out for Delivery</button>`,
    'Out for Delivery':`<button class="btn small green" data-advance-order="${html(order.id)}" data-next="Delivered">Mark Delivered</button>`,
  };
  return map[order.status]||'';
}
function bindOwnerOrderActions(){
  $$('[data-approve-minimum-order]').forEach(button=>button.onclick=()=>approveMinimumOrder(button.dataset.approveMinimumOrder));
  $$('[data-set-amount]').forEach(button=>button.onclick=()=>setOrderAmount(button.dataset.setAmount));
  $$('[data-accept-order]').forEach(button=>button.onclick=()=>advanceOrder(button.dataset.acceptOrder,'Accepted'));
  $$('[data-advance-order]').forEach(button=>button.onclick=()=>advanceOrder(button.dataset.advanceOrder,button.dataset.next));
  $$('[data-reject-order]').forEach(button=>button.onclick=()=>rejectOrder(button.dataset.rejectOrder));
  $$('[data-reopen-payment]').forEach(button=>button.onclick=()=>reopenRazorpayPayment(button.dataset.reopenPayment));
}
async function approveMinimumOrder(orderId){
  const order=state.orders.find(row=>row.id===orderId);if(!order||order.status!=='Minimum Approval Requested')return;
  const approvedAt=now(),changes={status:'Requested',minimumApprovalStatus:'Approved',minimumApprovedAt:approvedAt,updatedAt:approvedAt};
  try{await api.update(orderKind(order.ownerId),orderId,changes);Object.assign(order,changes);ringingIds.delete(orderId);refreshView();toast('Below-minimum order approved — continue with the normal order process')}
  catch(error){toast(error.message||'Could not approve this order')}
}
async function reopenRazorpayPayment(orderId){
  const order=state.orders.find(row=>row.id===orderId);if(!order)return;
  if(!confirm('Mark payment as not received and ask the customer to try again?'))return;
  const changes={paymentStatus:'Payment required',paymentMethod:'',paymentMarkedAt:'',updatedAt:now()};
  try{
    await api.update(orderKind(order.ownerId),orderId,changes);
    Object.assign(order,changes);refreshView();toast('Payment reopened for the customer');
  }catch(error){toast(error.message||'Could not reopen payment')}
}
function bindLiveQrPreview({amountInput,upiInput,previewEl,payeeName,refId}){
  const update=()=>{
    const amount=Number(amountInput.value)||0,upiId=upiInput.value.trim();
    previewEl.innerHTML='';
    if(amount>0&&upiId&&window.QRCode){
      new QRCode(previewEl,{text:buildUpiUri(upiId,payeeName,amount,refId),width:160,height:160});
    }else{
      previewEl.innerHTML='<p class="muted" style="margin:0;padding:12px;text-align:center">Enter an amount and UPI ID to preview the QR code.</p>';
    }
  };
  amountInput.addEventListener('input',update);
  upiInput.addEventListener('input',update);
  update();
}
function setOrderAmount(orderId){
  const order=state.orders.find(row=>row.id===orderId);if(!order)return;
  const store=state.stores.find(row=>row.id===order.storeId);
  const suggestedAmount=Number(order.amount)||Number(order.previousAmount)||0;
  modal('Review Order Amount',`<form id="setAmountForm">${(order.reorderedFrom||order.refillCardId)&&Number(order.previousAmount)>0?`<div class="previous-price-review"><span>${order.refillCardId?'Previous refill price':'Previous order price'}</span><strong>${money(order.previousAmount)}</strong><small>Approve this price as-is or enter the updated amount below.</small></div>`:''}<div class="form-grid"><div class="field"><label>Amount (₹)</label><input id="amountInput" name="amount" type="number" min="1" step="0.01" value="${suggestedAmount||''}" required></div><div class="field"><label>UPI ID</label><input id="upiIdInput" name="upiId" value="${html(order.upiId||store?.upiId||'')}" placeholder="yourstore@upi"></div></div><div class="qr-wrap" id="amountQrPreview"></div><button class="btn full" style="margin-top:14px">Approve Amount & Send Payment</button></form>`,()=>{
    bindLiveQrPreview({amountInput:$('#amountInput'),upiInput:$('#upiIdInput'),previewEl:$('#amountQrPreview'),payeeName:store?.name,refId:order.id});
    $('#setAmountForm').onsubmit=async event=>{
      event.preventDefault();
      const amount=Number($('#amountInput').value),upiId=$('#upiIdInput').value.trim(),button=event.submitter;
      if(!amount||amount<=0)return toast('Enter a valid amount');
      if(!/^[a-zA-Z0-9._-]{2,}@[a-zA-Z0-9.-]{2,}$/.test(upiId))return toast('Enter a valid UPI ID to generate the customer payment QR');
      button.disabled=true;
      const upiUri=buildUpiUri(upiId,store?.name,amount,order.id);
      try{
        const changes={amount,upiId,upiUri,status:'Priced',pricedAt:now(),paymentStatus:'Payment required',paymentMethod:'',paymentMarkedAt:''};
        await api.update(orderKind(order.ownerId),order.id,changes);
        Object.assign(order,changes);
        updateOrderAlertSound();
        closeModal();refreshView();toast('Amount approved — customer can now pay');
      }catch(error){button.disabled=false;toast(error.message||'Could not set amount')}
    };
  });
}
async function advanceOrder(orderId,next){
  const order=state.orders.find(row=>row.id===orderId);if(!order||!next)return;
  const changes={status:next,updatedAt:now()};
  if(next==='Accepted')changes.acceptedAt=now();
  if(next==='Accepted'&&order.paymentMarkedAt)changes.paymentStatus='Verified';
  if(next==='Delivered')changes.deliveredAt=now();
  try{
    await api.update(orderKind(order.ownerId),orderId,changes);
    Object.assign(order,changes);
    let reminderResetFailed=false;
    if(next==='Delivered'&&order.refillCardId){try{await resetRefillCardAfterOrder(order,true)}catch{reminderResetFailed=true}}
    ringingIds.delete(orderId);updateOrderAlertSound();
    refreshView();
    toast(reminderResetFailed?'Order delivered, but the reminder card could not be reset':next==='Delivered'?'Order delivered':`Order status: ${next}`);
  }catch(error){toast(error.message||'Could not update order')}
}
async function rejectOrder(orderId){
  const order=state.orders.find(row=>row.id===orderId);if(!order)return;
  modal('Reject Order',`<form id="rejectOrderForm"><p class="muted">The customer will immediately see your reason in a popup and in their order history.</p><div class="field"><label>Reason for rejection</label><textarea name="rejectionReason" maxlength="500" placeholder="Example: Requested item is currently unavailable" required></textarea></div><button class="btn full red" type="submit">Reject Order</button></form>`,()=>{
    $('#rejectOrderForm').onsubmit=async event=>{
      event.preventDefault();const reason=$('textarea[name="rejectionReason"]',event.target).value.trim(),button=event.submitter;if(!reason)return toast('Enter the rejection reason');button.disabled=true;
      const rejectedAt=now(),changes={status:'Rejected',rejectionReason:reason,rejectedAt,updatedAt:rejectedAt};
      try{
        await api.update(orderKind(order.ownerId),orderId,changes);Object.assign(order,changes);
        if(order.refillCardId){try{await resetRefillCardAfterOrder(order,false)}catch{}}
        ringingIds.delete(orderId);updateOrderAlertSound();closeModal();refreshView();toast('Order rejected — the customer has been notified');
      }catch(error){button.disabled=false;toast(error.message||'Could not reject order')}
    };
  });
}
async function resetRefillCardAfterOrder(order,delivered){
  const card=state.cards.find(row=>row.id===order.refillCardId);if(!card)return;
  const completedAt=now(),changes={status:'Active',activeOrderId:'',refillRequestedAt:'',updatedAt:completedAt};
  if(delivered){changes.purchasedAt=completedAt;changes.lastDeliveredAt=completedAt;changes.dueAt=new Date(Date.now()+Math.max(1,Number(card.reminderDays)||30)*86400000).toISOString();changes.timesDelivered=Number(card.timesDelivered||0)+1}
  await api.update(cardKind(order.ownerId),card.id,changes);Object.assign(card,changes);save();
}
function orderHistoryView(){
  refreshView=orderHistoryView;
  const store=activeStore();
  const today=indiaDateValue(),fromInput=$('#historyFrom')?.value||today,toInput=$('#historyTo')?.value||today;
  const all=orderHistoryOrders(storeOrders(store?.id));
  const filtered=filterOrdersByIndiaDate(all,fromInput,toInput).sort((a,b)=>new Date(orderHistoryTimestamp(b))-new Date(orderHistoryTimestamp(a)));
  $('#page').innerHTML=`<div class="section-head"><div><h1>Order History</h1><p class="muted">Today's completed and rejected orders are shown by default. Select a From and To date for another period.</p></div><button class="btn small secondary" id="exportOwnerHistory" ${filtered.length?'':'disabled'}>Export CSV</button></div><div class="date-filter-bar"><label>From<input id="historyFrom" type="date" value="${html(fromInput)}" max="${html(toInput)}"></label><label>To<input id="historyTo" type="date" value="${html(toInput)}" min="${html(fromInput)}"></label><button class="btn small secondary" id="ownerHistoryToday" type="button">Today</button></div><div class="grid stats">${metric('Orders',filtered.length)}${metric('Revenue',money(filtered.filter(o=>o.status==='Delivered').reduce((sum,o)=>sum+Number(o.amount||0),0)))}</div><div class="card table-wrap"><table><thead><tr><th>Customer</th><th>Items</th><th>Amount</th><th>Status</th><th>Date</th></tr></thead><tbody>${filtered.map(orderHistoryRow).join('')||'<tr><td colspan="5">No orders in this period.</td></tr>'}</tbody></table></div>`;
  $('#historyFrom').onchange=orderHistoryView;$('#historyTo').onchange=orderHistoryView;
  $('#ownerHistoryToday').onclick=()=>{$('#historyFrom').value=today;$('#historyTo').value=today;orderHistoryView()};
  $('#exportOwnerHistory').onclick=()=>downloadOrderHistoryCsv(filtered,{filePrefix:`${store?.name||'store'}-orders`.toLowerCase().replace(/[^a-z0-9]+/g,'-'),includeCustomer:true});
}
function orderHistoryRow(order){
  const customer=state.customers.find(c=>c.customerAccountId===order.customerAccountId&&c.storeId===order.storeId);
  return `<tr><td>${html(customer?.customerName||order.customerName||'Customer')}</td><td>${order.items.map(i=>`${i.qty}×${html(i.name)}`).join(', ')}</td><td>${money(order.amount)}</td><td>${html(order.status)}</td><td>${new Date(orderHistoryTimestamp(order)).toLocaleString('en-IN',{timeZone:'Asia/Kolkata',dateStyle:'medium',timeStyle:'short'})}</td></tr>`;
}
function ownerCardMarkup(card){
  const due=isCardDue(card),remaining=daysRemaining(card),pct=Math.min(100,Math.round((1-remaining/Math.max(1,Number(card.reminderDays)||1))*100)),ringing=ringingIds.has(card.id),regularRefill=card.status==='Refill Requested';
  return `<article class="card reminder-card ${due||['Buy Requested','Refill Requested'].includes(card.status)?'due':''} ${ringing?'incoming-order':''}">${ringing?'<span class="incoming-order-beacon" aria-label="Buy again request" title="Buy again request"></span>':''}<h3>${html(card.productName)}</h3><p class="muted">${money(card.price)} · every ${Number(card.reminderDays)} day(s)</p><div class="reminder-progress ${due?'due':''}"><span style="width:${pct}%"></span></div><div class="chips"><span class="chip ${due?'due':''}">${due?'Due now':`${remaining} day(s) left`}</span>${card.status==='Buy Requested'?'<span class="chip due">Buy requested</span>':''}${regularRefill?'<span class="chip due">Processing in Orders</span>':''}${Number(card.timesDelivered)?`<span class="chip delivered">${Number(card.timesDelivered)} delivered</span>`:''}</div>${deliveryContactMarkup(card)}<div class="actions">${card.status==='Buy Requested'?`<button class="btn small green" data-deliver="${html(card.id)}">Mark Delivered</button>`:''}<button class="btn small secondary" data-edit-card="${html(card.id)}">Edit</button><button class="btn small red" data-remove-card="${html(card.id)}">Remove</button></div>${cardChatMarkup(card,'owner')}</article>`;
}
function bindOwnerCardActions(){
  $$('[data-deliver]').forEach(button=>button.onclick=()=>deliverCard(button.dataset.deliver));
  $$('[data-edit-card]').forEach(button=>button.onclick=()=>openCardForm(null,button.dataset.editCard));
  $$('[data-remove-card]').forEach(button=>button.onclick=()=>removeCard(button.dataset.removeCard));
}
function openCardForm(customer,cardId=''){
  const card=cardId?state.cards.find(row=>row.id===cardId):null;
  const owner=customer||state.customers.find(row=>row.customerAccountId===card?.customerAccountId&&row.storeId===card?.storeId);
  const store=state.stores.find(row=>row.id===owner?.storeId);
  modal(cardId?'Edit Reminder Card':'Add Reminder Card',`<form id="cardForm"><div class="field"><label>Item / medicine name</label><input name="productName" value="${html(card?.productName||'')}" required></div><div class="form-grid"><div class="field"><label>Price (₹)</label><input id="cardPriceInput" name="price" type="number" min="0" step="0.01" value="${card?.price??''}" required></div><div class="field"><label>Remind every (days)</label><input name="reminderDays" type="number" min="1" step="1" value="${card?.reminderDays||30}" required></div></div><div class="field"><label>UPI ID</label><input id="cardUpiInput" name="upiId" value="${html(card?.upiId||store?.upiId||'')}" placeholder="yourstore@upi"></div><div class="qr-wrap" id="cardQrPreview"></div><button class="btn full" style="margin-top:14px">${cardId?'Save Card':'Add Card'}</button></form>`,()=>{
    bindLiveQrPreview({amountInput:$('#cardPriceInput'),upiInput:$('#cardUpiInput'),previewEl:$('#cardQrPreview'),payeeName:store?.name,refId:card?.id||'new'});
    $('#cardForm').onsubmit=async event=>{
      event.preventDefault();
      const values=Object.fromEntries(new FormData(event.target)),ownerId=cloudOwnerId(),button=event.submitter;
      button.disabled=true;
      try{
        if(cardId){
          const price=Number(values.price),upiId=values.upiId.trim(),reminderDays=Math.max(1,Number(values.reminderDays)||30);
          const changes={productName:values.productName.trim(),price,reminderDays,upiId,upiUri:buildUpiUri(upiId,store?.name,price,cardId)};
          if(reminderDays!==Number(card.reminderDays)){
            const anchor=card.purchasedAt||card.lastDeliveredAt||card.createdAt||now();
            changes.dueAt=new Date(new Date(anchor).getTime()+reminderDays*86400000).toISOString();
          }
          await api.update(cardKind(ownerId),cardId,changes);
          Object.assign(card,changes);
        }else{
          const reminderDays=Math.max(1,Number(values.reminderDays)||30);
          const result=await api.executeFunction(api.config.digitalOrderFunctionId,{action:'digit58-create-card',ownerId,storeId:owner.storeId,customerAccountId:owner.customerAccountId,productName:values.productName.trim(),price:Number(values.price),reminderDays,upiId:values.upiId.trim(),payeeName:store?.name});
          state.cards.push(result.card);
        }
        save();closeModal();customerDetailView(owner.id);toast(cardId?'Card updated':'Reminder card added');
      }catch(error){button.disabled=false;toast(error.message||'Could not save card')}
    };
  });
}
function openOwnerOrderForm(customer){
  modal('Create Order for Customer',`<form id="ownerOrderForm"><p class="muted">Creates a regular order for ${html(customer.customerName||'this customer')}. They'll get a call-style alert and must accept it before it enters your normal order queue.</p><div id="ownerOrderItemRows">${orderItemRowMarkup()}</div><button type="button" class="btn small secondary" id="addOwnerOrderItemRow" style="margin-top:8px">+ Add another item</button><button class="btn full" type="submit" style="margin-top:14px">Send to Customer</button></form>`,()=>{
    $('#addOwnerOrderItemRow').onclick=()=>$('#ownerOrderItemRows').insertAdjacentHTML('beforeend',orderItemRowMarkup());
    $('#ownerOrderItemRows').addEventListener('click',event=>{const row=event.target.closest('.remove-item-row');if(row&&$$('.order-item-row').length>1)row.closest('.order-item-row').remove()});
    $('#ownerOrderForm').onsubmit=async event=>{
      event.preventDefault();
      const names=$$('input[name="itemName[]"]').map(input=>input.value.trim());
      const qtys=$$('input[name="itemQty[]"]').map(input=>Math.max(1,Number(input.value)||1));
      const items=names.map((name,index)=>({name,qty:qtys[index]})).filter(item=>item.name);
      if(!items.length)return toast('Add at least one item');
      const ownerId=cloudOwnerId(),button=event.submitter;button.disabled=true;
      try{
        const result=await api.executeFunction(api.config.digitalOrderFunctionId,{action:'digit58-owner-create-order',ownerId,storeId:customer.storeId,customerAccountId:customer.customerAccountId,items});
        state.orders.push(result.order);save();
        closeModal();customerDetailView(customer.id);toast('Order sent — waiting for the customer to accept');
      }catch(error){button.disabled=false;toast(error.message||'Could not create order')}
    };
  });
}
async function deliverCard(cardId){
  const card=state.cards.find(row=>row.id===cardId);if(!card)return;
  const changes={status:'Active',purchasedAt:now(),dueAt:new Date(Date.now()+Number(card.reminderDays||30)*86400000).toISOString(),timesDelivered:Number(card.timesDelivered||0)+1,buyRequestedAt:'',lastDeliveredAt:now()};
  try{
    await api.update(cardKind(card.ownerId),card.id,changes);
    Object.assign(card,changes);save();
    ringingIds.delete(cardId);updateOrderAlertSound();
    refreshView();
    toast('Marked delivered — reminder reset for next cycle');
  }catch(error){toast(error.message||'Could not update card')}
}
async function removeCard(cardId){
  const card=state.cards.find(row=>row.id===cardId);if(!card||!confirm('Remove this reminder card?'))return;
  try{
    await api.remove(cardKind(card.ownerId),cardId);
    state.cards=state.cards.filter(row=>row.id!==cardId);save();
    ringingIds.delete(cardId);updateOrderAlertSound();
    refreshView();toast('Card removed');
  }catch(error){toast(error.message||'Could not remove card')}
}

function settingsView(){
  const acceptedAt=entitlement?.policyAcceptedAt?new Date(entitlement.policyAcceptedAt).toLocaleString('en-IN',{dateStyle:'medium',timeStyle:'short'}):'';
  $('#page').innerHTML=`<div class="section-head"><div><h1>Settings</h1><p class="muted">Signed in as ${html(session?.email||'')}</p></div></div><div class="card"><p class="muted">More store settings are coming soon. For now, manage your stores from the My Stores tab.</p></div><div class="section-head"><h2>Privacy & Payment Policy</h2></div><div class="card"><p class="muted">${html(DIGIT58_POLICY_TEXT)}</p>${acceptedAt?`<p class="muted" style="margin-top:10px">You accepted this policy on ${acceptedAt}.</p>`:''}</div>`;
}
function modal(title,body,ready){document.body.insertAdjacentHTML('beforeend',`<div class="modal-backdrop" id="modal"><section class="modal"><div class="section-head"><h2>${title}</h2><button class="btn small secondary" id="closeModal">✕</button></div>${body}</section></div>`);$('#closeModal').onclick=closeModal;ready?.()}
function closeModal(){
  $('#modal')?.remove();
  if(customerRenderPending&&activeCustomerContext){
    customerRenderPending=false;
    loadAndRenderCustomerView(activeCustomerContext.store,activeCustomerContext.customer);
  }
}

async function renderPublicStore(hashParams){
  const ownerId=hashParams.get('owner')||'',storeId=hashParams.get('store')||'';
  customerReminderView='swipe';
  if(!ownerId||!storeId){app.innerHTML=`<main class="public-store"><div class="empty">This store link is invalid.</div></main>${siteFooter(true)}`;(typeof bindAndroidAppFooter==='function'&&bindAndroidAppFooter());return}
  let store;
  try{store=await api.get(storeKind(ownerId),storeId)}
  catch{app.innerHTML=`<main class="public-store"><div class="empty">This store could not be found.</div></main>${siteFooter(true)}`;(typeof bindAndroidAppFooter==='function'&&bindAndroidAppFooter());return}
  if(store.suspended){app.innerHTML=`<main class="public-store"><section class="store-hero"><h1>${html(store.name)}</h1></section><div class="empty">This store is temporarily unavailable. Please check back later.</div></main>${siteFooter(true)}`;(typeof bindAndroidAppFooter==='function'&&bindAndroidAppFooter());return}
  const account=await api.currentUser().catch(()=>null);
  if(!account)return renderCustomerAuth(store,ownerId,storeId);
  const linked=await ensureCustomerLink(ownerId,storeId,account);
  customerStoreLinks=linked.stores?.length?linked.stores:[{ownerId,storeId,storeName:store.name,category:store.category,city:store.city}];
  await loadAndRenderCustomerView(store,linked.customer);
  startCustomerRealtime(store,linked.customer);
}
let activeCustomerContext=null,customerRenderPending=false;
async function loadAndRenderCustomerView(store,customer){
  activeCustomerContext={store,customer};
  const [cards,orders,promotions]=await Promise.all([
    api.list(cardKind(store.ownerId)).catch(()=>[]),
    api.list(orderKind(store.ownerId)).catch(()=>[]),
    api.list(promotionKind(store.ownerId)).catch(()=>[]),
  ]);
  const myCards=cards.filter(row=>row.storeId===store.id&&row.customerAccountId===customer.customerAccountId);
  const myOrders=orders.filter(row=>row.storeId===store.id&&row.customerAccountId===customer.customerAccountId);
  const myPromotions=promotions.filter(row=>row.storeId===store.id&&row.active!==false&&!promotionIsExpired(row));
  if($('.modal-backdrop')){customerRenderPending=true;return}
  customerRenderPending=false;
  renderCustomerCards(store,customer,myCards,myOrders,myPromotions);
}
let customerOrdersUnsubscribe=null,customerCardsUnsubscribe=null,customerPromotionsUnsubscribe=null;
function startCustomerRealtime(store,customer){
  activeCustomerContext={store,customer};
  if(!api?.subscribeKind)return;
  customerOrdersUnsubscribe?.();
  customerOrdersUnsubscribe=api.subscribeKind(orderKind(store.ownerId),()=>loadAndRenderCustomerView(store,customer));
  customerCardsUnsubscribe?.();
  customerCardsUnsubscribe=api.subscribeKind(cardKind(store.ownerId),()=>loadAndRenderCustomerView(store,customer));
  customerPromotionsUnsubscribe?.();
  customerPromotionsUnsubscribe=api.subscribeKind(promotionKind(store.ownerId),()=>loadAndRenderCustomerView(store,customer));
}
function stopCustomerRealtime(){customerOrdersUnsubscribe?.();customerCardsUnsubscribe?.();customerPromotionsUnsubscribe?.();customerOrdersUnsubscribe=customerCardsUnsubscribe=customerPromotionsUnsubscribe=null;stopPromotionAutoScroll();dueReminderRung.clear();pendingDueBeep=false;pendingOwnerOrderRung.clear();activeCustomerContext=null;customerRenderPending=false;stopIncomingCallRing()}
// The Appwrite realtime WebSocket doesn't auto-reconnect after the app is
// backgrounded (common on mobile/Android app resume) or the network drops.
// Re-arm the subscriptions and force a fresh fetch whenever we come back.
function resumeRealtimeConnections(){
  if(session&&ownerOrdersUnsubscribe){
    startOwnerRealtime();
    refreshOwnerOrdersRealtime();
    refreshOwnerCardsRealtime();
    refreshOwnerPromotionsRealtime();
  }
  if(activeCustomerContext){
    startCustomerRealtime(activeCustomerContext.store,activeCustomerContext.customer);
    loadAndRenderCustomerView(activeCustomerContext.store,activeCustomerContext.customer);
  }
}
window.addEventListener('online',resumeRealtimeConnections);
document.addEventListener('visibilitychange',()=>{if(!document.hidden)resumeRealtimeConnections()});
function renderCustomerAuth(store,ownerId,storeId){
  app.innerHTML=`<main class="public-store"><section class="store-hero"><span class="chip">${html(store.category||'Store')}</span>${store.highlightText?`<strong class="store-highlight-text">${html(store.highlightText)}</strong>`:''}<h1>${html(store.name)}</h1>${storeMinimum(store)?`<p class="store-minimum-order">Minimum new order ${money(storeMinimum(store))}</p>`:''}<p class="muted">${html(store.description||'')}${store.city?' · '+html(store.city):''}</p></section><div class="card"><div class="actions" style="margin-bottom:14px"><button class="btn small" id="custTabLogin">Sign in</button><button class="btn small secondary" id="custTabSignup">Sign up</button></div><form id="customerAuthForm"><div class="field full-name-field hidden"><label>Your name</label><input name="name"></div><div class="field"><label>Email</label><input name="email" type="email" required></div><div class="field"><label>Password</label><input name="password" type="password" minlength="8" required></div><button class="btn full" id="custAuthSubmit" type="submit">Sign In</button></form></div></main>${siteFooter(true)}`;
  (typeof bindAndroidAppFooter==='function'&&bindAndroidAppFooter());
  let mode='signup';
  const syncMode=()=>{$('.full-name-field').classList.toggle('hidden',mode!=='signup');$('#custAuthSubmit').textContent=mode==='signup'?'Create Account':'Sign In';$('#custTabLogin').className=mode==='login'?'btn small':'btn small secondary';$('#custTabSignup').className=mode==='signup'?'btn small':'btn small secondary'};
  $('#custTabLogin').onclick=()=>{mode='login';syncMode()};
  $('#custTabSignup').onclick=()=>{mode='signup';syncMode()};
  syncMode();
  $('#customerAuthForm').onsubmit=async event=>{
    event.preventDefault();
    const values=Object.fromEntries(new FormData(event.target)),button=$('#custAuthSubmit');
    button.disabled=true;
    try{
      if(mode==='signup')await api.register(values.email.trim(),values.password,values.name.trim()||values.email.split('@')[0]);
      else await api.login(values.email.trim(),values.password);
      renderPublicStore(new URLSearchParams(`owner=${encodeURIComponent(ownerId)}&store=${encodeURIComponent(storeId)}`));
    }catch(error){button.disabled=false;toast(error.message||'Could not sign in')}
  };
}
async function ensureCustomerLink(ownerId,storeId,account){
  return api.executeFunction(api.config.digitalOrderFunctionId,{action:'digit58-link-customer',ownerId,storeId,customerName:account.name||account.email.split('@')[0],customerEmail:account.email});
}
let customerPromotionQuantities=new Map(),activePromotionStoreId='',customerReminderView='swipe',customerStoreLinks=[];
const shownRejectedOrderIds=new Set();
function rejectedOrderSeenKey(order,customer){return `g58-rejected-order:${customer.customerAccountId}:${order.id}:${order.rejectedAt||order.updatedAt||''}`}
function rejectionWasSeen(order,customer){try{return localStorage.getItem(rejectedOrderSeenKey(order,customer))==='1'}catch{return false}}
function markRejectionSeen(order,customer){try{localStorage.setItem(rejectedOrderSeenKey(order,customer),'1')}catch{}}
function showNextRejectedOrder(orders,store,customer,promotions=[]){
  if($('.modal-backdrop'))return;
  const order=[...orders].filter(row=>row.status==='Rejected'&&!rejectionWasSeen(row,customer)&&!shownRejectedOrderIds.has(row.id)).sort((a,b)=>new Date(b.rejectedAt||b.updatedAt||0)-new Date(a.rejectedAt||a.updatedAt||0))[0];
  if(!order)return;shownRejectedOrderIds.add(order.id);
  const reason=order.rejectionReason||'The store could not process this order. Contact the store if you need more information.';
  const storePhone=String(store.phone||'').replace(/[^\d+]/g,'');
  modal('Order Rejected',`<div class="rejection-popup"><span class="rejection-popup-icon" aria-hidden="true">!</span><p>Your order from <strong>${html(store.name)}</strong> was rejected.</p><div class="rejection-reason"><small>Reason</small><strong>${html(reason)}</strong></div><p class="muted">Order #${html(order.id.slice(-6).toUpperCase())}</p><div class="rejection-next-actions"><button class="btn full" id="reviseRejectedOrder" type="button">Revise &amp; Resubmit</button><button class="btn full secondary" id="viewRejectedHistory" type="button">View Order History</button>${storePhone?`<a class="btn full secondary" id="callRejectedStore" href="tel:${html(storePhone)}">Call ${html(store.name)}</a>`:''}<button class="rejection-dismiss" id="dismissRejectedOrder" type="button">Close</button></div></div>`,()=>{
    const acknowledge=()=>{markRejectionSeen(order,customer);closeModal()};
    $('#reviseRejectedOrder').onclick=()=>{acknowledge();openPlaceOrderModal(store,customer,promotions,order)};
    $('#viewRejectedHistory').onclick=()=>{acknowledge();setTimeout(()=>$('#customerOrderHistory')?.scrollIntoView({behavior:'smooth',block:'start'}),0)};
    $('#callRejectedStore')?.addEventListener('click',()=>markRejectionSeen(order,customer));
    $('#dismissRejectedOrder').onclick=()=>{acknowledge();setTimeout(()=>showNextRejectedOrder(orders,store,customer,promotions),0)};
    $('#closeModal').onclick=$('#dismissRejectedOrder').onclick;
  });
}
function customerStoreHub(store){
  const links=customerStoreLinks.length?customerStoreLinks:[{ownerId:store.ownerId,storeId:store.id,storeName:store.name,city:store.city}];
  return `<nav class="customer-store-hub" aria-label="My linked stores"><div><span>My Stores</span><strong>${links.length} linked store${links.length===1?'':'s'}</strong></div><select id="customerStoreSwitch" aria-label="Switch store">${links.map(link=>`<option value="${html(`${link.ownerId}:${link.storeId}`)}" ${link.ownerId===store.ownerId&&link.storeId===store.id?'selected':''}>${html(link.storeName||'Store')}${link.city?` · ${html(link.city)}`:''}</option>`).join('')}</select></nav>`;
}
function bindCustomerStoreHub(store){
  $('#customerStoreSwitch')?.addEventListener('change',event=>{
    const selected=customerStoreLinks.find(link=>`${link.ownerId}:${link.storeId}`===event.target.value);if(!selected)return;
    stopCustomerRealtime();customerPromotionQuantities.clear();activePromotionStoreId='';
    location.hash=`store&owner=${encodeURIComponent(selected.ownerId)}&store=${encodeURIComponent(selected.storeId)}`;
    renderPublicStore(new URLSearchParams(`owner=${encodeURIComponent(selected.ownerId)}&store=${encodeURIComponent(selected.storeId)}`));
  });
}
function stopPromotionAutoScroll(){const rail=$('#promotionRail');rail?.classList.remove('is-auto-scrolling')}
function pausePromotionAutoScroll(){stopPromotionAutoScroll();$('#promotionRail')?.classList.add('is-paused')}
function startPromotionAutoScroll(){
  stopPromotionAutoScroll();
  const rail=$('#promotionRail');if(!rail||rail.scrollWidth<=rail.clientWidth)return;
  rail.classList.remove('is-paused');
  rail.onpointerdown=()=>pausePromotionAutoScroll();
  requestAnimationFrame(()=>rail.classList.add('is-auto-scrolling'));
}
function promotionQuantityControl(promotionId){
  const qty=customerPromotionQuantities.get(promotionId)||0;
  return qty>0?`<div class="promotion-stepper" aria-label="Selected quantity"><button type="button" data-promotion-minus="${html(promotionId)}" aria-label="Remove one">−</button><strong>${qty}</strong><button type="button" data-promotion-plus="${html(promotionId)}" aria-label="Add one">+</button></div>`:`<button type="button" class="promotion-add" data-promotion-add="${html(promotionId)}">Buy</button>`;
}
function customerPromotionTicket(promotion,decorative=false){
  return `<article class="promotion-ticket customer-ticket" ${decorative?'aria-hidden="true"':''}><span class="promotion-ticket-badge">Special Offer</span><h3>${html(promotion.name)}</h3><p>${html(promotion.offerText||'Limited-time store offer')}</p>${Number(promotion.price)>0?`<strong class="promotion-offer-price">${offerPrice(promotion.price)}</strong>`:''}${promotion.endsOn?`<small class="promotion-end-date">Offer ends ${html(formatPromotionEnd(promotion.endsOn))}</small>`:''}<div class="promotion-ticket-foot"><div class="promotion-control" data-promotion-control="${html(promotion.id)}">${promotionQuantityControl(promotion.id)}</div></div></article>`;
}
function bindCustomerPromotionActions(promotions){
  const update=(promotionId,delta)=>{
    if(!promotions.some(row=>row.id===promotionId))return;
    pausePromotionAutoScroll();
    const next=Math.max(0,Math.min(99,(customerPromotionQuantities.get(promotionId)||0)+delta));
    if(next)customerPromotionQuantities.set(promotionId,next);else customerPromotionQuantities.delete(promotionId);
    $$(`[data-promotion-control="${CSS.escape(promotionId)}"]`).forEach(control=>{control.innerHTML=promotionQuantityControl(promotionId)});
    bindCustomerPromotionActions(promotions);
  };
  $$('[data-promotion-add]').forEach(button=>button.onclick=()=>update(button.dataset.promotionAdd,1));
  $$('[data-promotion-plus]').forEach(button=>button.onclick=()=>update(button.dataset.promotionPlus,1));
  $$('[data-promotion-minus]').forEach(button=>button.onclick=()=>update(button.dataset.promotionMinus,-1));
}
function renderCustomerCards(store,customer,cards,orders=[],promotions=[]){
  if(activePromotionStoreId!==store.id){activePromotionStoreId=store.id;customerPromotionQuantities.clear()}
  ringDueReminders(cards);
  ringPendingOwnerOrders(store,customer,orders);
  const active=activeOrders(orders).sort((a,b)=>new Date(b.createdAt)-new Date(a.createdAt));
  const history=orderHistoryOrders(orders).sort((a,b)=>new Date(b.updatedAt||b.createdAt)-new Date(a.updatedAt||a.createdAt));
  const today=indiaDateValue(),historyFrom=$('#customerHistoryFrom')?.value||today,historyTo=$('#customerHistoryTo')?.value||today;
  const filteredHistory=filterOrdersByIndiaDate(history,historyFrom,historyTo).sort((a,b)=>new Date(orderHistoryTimestamp(b))-new Date(orderHistoryTimestamp(a)));
  const marqueePromotions=promotions.length?Array.from({length:Math.max(1,Math.ceil(6/promotions.length))},()=>promotions).flat():[];
  app.innerHTML=`<main class="public-store">${customerStoreHub(store)}<section class="store-hero"><span class="chip">${html(store.category||'Store')}</span>${store.highlightText?`<strong class="store-highlight-text">${html(store.highlightText)}</strong>`:''}<h1>${html(store.name)}</h1>${storeMinimum(store)?`<p class="store-minimum-order">Minimum new order ${money(storeMinimum(store))}</p>`:''}<p class="muted">${html(store.description||'')}${store.city?' · '+html(store.city):''}</p></section>
  ${promotions.length?`<section class="promotion-strip"><div class="promotion-strip-head"><div><span>Store offers</span><h2>Fresh deals for your next order</h2></div><small>Tap Buy to include an offer</small></div><div class="promotion-rail" id="promotionRail"><div class="promotion-track"><div class="promotion-sequence">${marqueePromotions.map((promotion,index)=>customerPromotionTicket(promotion,index>=promotions.length)).join('')}</div><div class="promotion-sequence" aria-hidden="true">${marqueePromotions.map(promotion=>customerPromotionTicket(promotion,true)).join('')}</div></div></div></section>`:''}
  <div class="section-head"><div><h2>Your orders</h2>${storeMinimum(store)?`<p class="muted">New orders must be at least ${money(storeMinimum(store))}. Refills and Reorders are exempt.</p>`:''}</div><button class="btn small" id="placeOrderBtn">+ Place New Order</button></div>
  <div class="grid card-grid">${active.map(order=>customerOrderMarkup(order,store)).join('')||'<div class="empty">No active orders. Place a new order to get started.</div>'}</div>
  ${cards.length&&!navigator.userAgent.includes('G58RefillsAndroidApp')?`<a class="g58-app-badge refills-app-promo" href="/downloads/GRAVITY58-Refills-Android-v1.2.apk" download aria-label="Download the G58 Refills Android app"><span class="g58-app-badge-icon">▶</span><span class="g58-app-badge-text"><small>Never miss a refill</small><strong>Get the G58 Refills App</strong></span></a>`:''}
  <div class="section-head reminder-section-head"><div><h2>Your reminder cards</h2>${cards.length>1?'<p class="muted">Swipe to see the next card or switch to list view.</p>':''}</div>${cards.length>1?`<div class="reminder-view-toggle" role="group" aria-label="Reminder card view"><button type="button" class="${customerReminderView==='swipe'?'active':''}" data-reminder-view="swipe" aria-pressed="${customerReminderView==='swipe'}">Swipe</button><button type="button" class="${customerReminderView==='list'?'active':''}" data-reminder-view="list" aria-pressed="${customerReminderView==='list'}">List</button></div>`:''}</div>
  <div class="customer-reminder-view reminder-view-${customerReminderView}" id="customerCardGrid">${cards.map(customerCardCardMarkup).join('')||'<div class="empty">Your store will add reminder cards here after your first purchase.</div>'}</div>
  ${history.length?`<section class="order-history-section" id="customerOrderHistory"><div class="section-head"><div><h2>Order History</h2><p class="muted">Today's history is shown by default. Select another date period when needed.</p></div><button class="btn small secondary" id="exportCustomerHistory" ${filteredHistory.length?'':'disabled'}>Export CSV</button></div><div class="date-filter-bar"><label>From<input id="customerHistoryFrom" type="date" value="${html(historyFrom)}" max="${html(historyTo)}"></label><label>To<input id="customerHistoryTo" type="date" value="${html(historyTo)}" min="${html(historyFrom)}"></label><button class="btn small secondary" id="customerHistoryToday" type="button">Today</button></div><div class="card table-wrap"><table><thead><tr><th>Items</th><th>Reorder</th><th>Amount</th><th>Status</th><th>Date</th></tr></thead><tbody>${filteredHistory.map(customerOrderHistoryRow).join('')||'<tr><td colspan="5">No orders in this period.</td></tr>'}</tbody></table></div></section>`:''}
  <div class="actions" style="margin-top:20px"><button class="btn secondary" id="custLogout">Sign out</button></div></main>${siteFooter(true)}`;
  active.filter(order=>order.status==='Priced'&&order.upiUri).forEach(order=>{
    const target=document.getElementById(`qr-${order.id}`);
    if(target&&window.QRCode)new QRCode(target,{text:order.upiUri,width:180,height:180});
  });
  bindCustomerPromotionActions(promotions);
  bindCustomerStoreHub(store);
  bindFloatingSupportButton();
  startPromotionAutoScroll();
  bindRazorpayPaymentActions(active,store,customer);
  $('#placeOrderBtn').onclick=()=>openPlaceOrderModal(store,customer,promotions);
  $$('[data-accept-owner-order]').forEach(button=>button.onclick=()=>acceptOwnerOrder(store,customer,button.dataset.acceptOwnerOrder));
  $$('[data-buy-again]').forEach(button=>button.onclick=()=>{
    const card=cards.find(row=>row.id===button.dataset.buyAgain);
    openBuyAgainModal(button.dataset.buyAgain,store,customer,card?.productName);
  });
  $$('[data-reminder-view]').forEach(button=>button.onclick=()=>{
    customerReminderView=button.dataset.reminderView==='list'?'list':'swipe';
    const grid=$('#customerCardGrid');
    grid.classList.toggle('reminder-view-swipe',customerReminderView==='swipe');
    grid.classList.toggle('reminder-view-list',customerReminderView==='list');
    $$('[data-reminder-view]').forEach(option=>{const active=option.dataset.reminderView===customerReminderView;option.classList.toggle('active',active);option.setAttribute('aria-pressed',String(active))});
  });
  $$('[data-reorder-order]').forEach(button=>button.onclick=()=>{
    const order=filteredHistory.find(row=>row.id===button.dataset.reorderOrder);
    if(order)openReorderOrderModal(order,store,customer);
  });
  $('#customerHistoryFrom')?.addEventListener('change',()=>renderCustomerCards(store,customer,cards,orders,promotions));
  $('#customerHistoryTo')?.addEventListener('change',()=>renderCustomerCards(store,customer,cards,orders,promotions));
  $('#customerHistoryToday')?.addEventListener('click',()=>{$('#customerHistoryFrom').value=today;$('#customerHistoryTo').value=today;renderCustomerCards(store,customer,cards,orders,promotions)});
  $('#exportCustomerHistory')?.addEventListener('click',()=>downloadOrderHistoryCsv(filteredHistory,{filePrefix:`${store.name||'store'}-my-orders`.toLowerCase().replace(/[^a-z0-9]+/g,'-'),storeName:store.name||'Store'}));
  bindOrderChatForms(active,'customer',()=>loadAndRenderCustomerView(store,customer));
  bindCardChatForms(cards,'customer',()=>loadAndRenderCustomerView(store,customer));
  initShakeDetection();
  (typeof bindAndroidAppFooter==='function'&&bindAndroidAppFooter());
  setTimeout(()=>showNextRejectedOrder(orders,store,customer,promotions),0);
  $('#custLogout').onclick=async()=>{stopCustomerRealtime();customerPromotionQuantities.clear();activePromotionStoreId='';customerStoreLinks=[];await api.logout();location.hash=`store&owner=${encodeURIComponent(store.ownerId)}&store=${encodeURIComponent(store.id)}`;boot()};
}
function vialMarkup(card){
  const remaining=daysRemaining(card),total=Math.max(1,Number(card.reminderDays)||1),due=isCardDue(card);
  const pct=Math.max(0,Math.min(100,Math.round((remaining/total)*100)));
  return `<div class="vial ${due?'vial-empty':''}"><div class="vial-cap"></div><div class="vial-glass"><div class="vial-liquid" style="height:${pct}%"></div></div><div class="vial-label"><strong>${due?'Due':`${remaining}d`}</strong><small>left</small></div></div>`;
}
function customerCardCardMarkup(card){
  const due=isCardDue(card),remaining=daysRemaining(card),refillPending=['Buy Requested','Refill Requested'].includes(card.status);
  let payBlock='';
  if(refillPending){
    payBlock='<button class="btn full secondary refill-card-action" type="button" disabled>Refill</button><p class="muted refill-card-note">Your refill order was sent. Follow it under Your orders while the store reviews the amount and processes it.</p>';
  }else{
    payBlock=`<button class="btn full green refill-card-action" data-buy-again="${html(card.id)}">Refill</button><p class="muted refill-card-note">Refill anytime — the store will review the request and start a new order.</p>`;
  }
  return `<article class="card reminder-card premium-card vial-card ${due?'due':''}">${due?'<span class="reminder-due-bell" aria-label="Reminder due" title="Reminder due"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/></svg></span>':''}<div class="vial-card-body"><div class="vial-card-info"><h3>${html(card.productName)}</h3><p class="muted">${money(card.price)} · every ${Number(card.reminderDays)} day(s)</p><div class="chips"><span class="chip ${due?'due':''}">${due?'Due now':`${remaining} day(s) left`}</span>${refillPending?'<span class="chip due">Refill order sent</span>':''}</div></div>${vialMarkup(card)}</div>${payBlock}${cardChatMarkup(card,'customer')}</article>`;
}
function openBuyAgainModal(cardId,store,customer,productName){
  let capturedLocation=null;
  modal('Request Refill',`<form id="buyAgainForm"><p class="muted">${productName?`Confirm your refill request for <strong>${html(productName)}</strong>.`:'Confirm your refill request.'}</p><div class="field"><label>Contact number</label><input name="phone" type="tel" value="${html(customer.phone||'')}" placeholder="10-digit mobile number" required></div><div class="field"><button type="button" class="btn small secondary" id="shareLocationBtn">📍 Share My Location</button><p class="muted" id="locationStatus" style="margin-top:6px">Optional — helps the store guide your delivery.</p></div><button class="btn full green" type="submit" style="margin-top:10px">Send Refill Request</button></form>`,()=>{
    bindShareLocationButton($('#shareLocationBtn'),$('#locationStatus'),point=>{capturedLocation=point});
    $('#buyAgainForm').onsubmit=async event=>{
      event.preventDefault();
      const phone=$('input[name="phone"]',event.target).value.trim();
      const button=event.submitter;button.disabled=true;
      try{
        await api.executeFunction(api.config.digitalOrderFunctionId,{action:'digit58-create-refill-order',ownerId:store.ownerId,cardId,customerName:customer.customerName,customerEmail:customer.customerEmail,phone,locationLat:capturedLocation?.lat,locationLng:capturedLocation?.lng});
        if(phone&&phone!==customer.phone){await api.update(customerKind(store.ownerId),customer.id,{phone}).catch(()=>{});customer.phone=phone}
        closeModal();showIncomingOrderCall(store,customer,'Refill order sent — the store can now review and process it');
      }catch(error){button.disabled=false;toast(error.message||'Could not send request')}
    };
  });
}
function customerOrderMarkup(order,store){
  const razorpayEnabled=store?.razorpayEnabled&&validRazorpayLink(store.razorpayLink);
  const razorpayReturnOpen=razorpayPaymentWasOpened(order.id);
  const paymentBlock=order.status==='Pending Customer Acceptance'
    ?`<div class="pending-acceptance-note"><p class="muted">The store started this order for you. Accept it to send it into the normal order queue.</p><button type="button" class="btn full green" data-accept-owner-order="${html(order.id)}">Accept Order</button></div>`
    :order.status==='Priced'
    ?order.paymentMarkedAt
      ?`<div class="razorpay-submitted"><span class="razorpay-submitted-icon">✓</span><div><strong>Payment submitted for verification</strong><p>The store has been notified. It will verify the Razorpay payment and accept your order.</p></div></div>`
      :`<div class="qr-wrap" id="qr-${html(order.id)}"></div><h3 style="margin:10px 0;text-align:center">${money(order.amount)}</h3><p class="muted" style="text-align:center">Scan to pay via UPI${razorpayEnabled?' or use the secure Razorpay option below':''}. The store will accept your order once payment is received.</p>${razorpayEnabled?`<a class="btn full razorpay-pay-btn" data-open-razorpay="${html(order.id)}" href="${html(normaliseRazorpayLink(store.razorpayLink))}" target="_blank" rel="noopener noreferrer">Open Razorpay & Pay ↗</a><p class="razorpay-window-note">Razorpay opens securely in another tab. Keep this G58 page open.</p><div class="razorpay-return-step ${razorpayReturnOpen?'':'is-hidden'}" data-razorpay-return="${html(order.id)}"><strong>Returned from Razorpay?</strong><p>Choose the correct option so your order can move to the next step.</p><div class="razorpay-return-actions"><button type="button" class="btn green" data-confirm-razorpay-payment="${html(order.id)}">Payment completed</button><button type="button" class="btn secondary" data-razorpay-not-paid="${html(order.id)}">Payment not completed</button></div></div>`:''}`
    :order.amount?`<h3 style="margin:10px 0">${money(order.amount)}</h3>`:'<p class="muted">Waiting for the store to review and set the amount.</p>';
  const visibleStatus=order.paymentMarkedAt&&order.status==='Priced'?'Payment Verification':order.status;
  return `<article class="card order-item-card premium-card"><div class="section-head"><h3>Order #${html(order.id.slice(-6).toUpperCase())}</h3><span class="chip">${html(visibleStatus)}</span></div>${bigStatusMarkup(visibleStatus)}${orderStepperMarkup(order.status)}<div class="order-items-list">${order.items.map(item=>`<div class="order-line-item"><span>${item.qty} ×</span><span>${html(item.name)}</span></div>`).join('')}</div>${Number(order.customerOrderValue)>0?`<div class="customer-order-value"><span>Your estimated order value</span><strong>${money(order.customerOrderValue)}</strong></div>`:''}${order.prescriptionUrl?`<a class="link-btn" href="${html(order.prescriptionUrl)}" target="_blank" rel="noopener">📄 View your prescription</a>`:''}${paymentBlock}${orderChatMarkup(order,'customer')}</article>`;
}
function razorpayPaymentKey(orderId){return `g58-razorpay-open-${orderId}`}
function razorpayPendingKey(ownerId,storeId){return `g58-razorpay-pending-${ownerId}-${storeId}`}
function razorpayPaymentWasOpened(orderId){try{return localStorage.getItem(razorpayPaymentKey(orderId))==='1'}catch{return false}}
function rememberRazorpayPayment(orderId,opened,store){
  try{
    if(opened){
      localStorage.setItem(razorpayPaymentKey(orderId),'1');
      if(store)localStorage.setItem(razorpayPendingKey(store.ownerId,store.id),JSON.stringify({orderId,openedAt:now()}));
    }else{
      localStorage.removeItem(razorpayPaymentKey(orderId));
      if(store)localStorage.removeItem(razorpayPendingKey(store.ownerId,store.id));
    }
  }catch{}
}
async function submitRazorpayPaymentForVerification(order,store,customer,button=null,returned=false){
  if(!order||order.paymentMarkedAt)return;
  if(button){button.disabled=true;button.textContent='Notifying store…'}
  const changes={paymentStatus:'Awaiting store verification',paymentMethod:'Razorpay link',paymentMarkedAt:now(),paymentLinkUsed:normaliseRazorpayLink(store.razorpayLink),updatedAt:now()};
  try{
    await api.update(orderKind(order.ownerId),order.id,changes);Object.assign(order,changes);rememberRazorpayPayment(order.id,false,store);
    toast(returned?'Payment successful — returned to your orders':'Payment submitted — waiting for store verification');await loadAndRenderCustomerView(store,customer);
  }catch(error){if(button){button.disabled=false;button.textContent='Payment completed'}toast(error.message||'Could not notify the store')}
}
function processSuccessfulRazorpayReturn(orders,store,customer){
  if(!razorpaySuccessfulReturn||razorpaySuccessfulReturn.ownerId!==store.ownerId||razorpaySuccessfulReturn.storeId!==store.id)return;
  razorpaySuccessfulReturn=null;
  let pending=null;try{pending=JSON.parse(localStorage.getItem(razorpayPendingKey(store.ownerId,store.id))||'null')}catch{}
  const order=orders.find(row=>row.id===pending?.orderId&&row.status==='Priced');
  if(!order)return toast('Returned to your orders. Select the order payment again if it is still pending.');
  submitRazorpayPaymentForVerification(order,store,customer,null,true);
}
function bindRazorpayPaymentActions(orders,store,customer){
  $$('[data-open-razorpay]').forEach(link=>link.onclick=()=>{
    const orderId=link.dataset.openRazorpay;rememberRazorpayPayment(orderId,true,store);
    const step=$(`[data-razorpay-return="${CSS.escape(orderId)}"]`);step?.classList.remove('is-hidden');
    setTimeout(()=>step?.scrollIntoView({behavior:'smooth',block:'center'}),180);
  });
  $$('[data-razorpay-not-paid]').forEach(button=>button.onclick=()=>{
    const orderId=button.dataset.razorpayNotPaid;rememberRazorpayPayment(orderId,false,store);
    $(`[data-razorpay-return="${CSS.escape(orderId)}"]`)?.classList.add('is-hidden');
    toast('Payment not submitted. You can reopen Razorpay when ready.');
  });
  $$('[data-confirm-razorpay-payment]').forEach(button=>button.onclick=async()=>{
    const orderId=button.dataset.confirmRazorpayPayment,order=orders.find(row=>row.id===orderId);if(!order)return;
    await submitRazorpayPaymentForVerification(order,store,customer,button,false);
  });
  processSuccessfulRazorpayReturn(orders,store,customer);
}
function customerOrderHistoryRow(order){
  return `<tr><td>${order.items.map(item=>`${item.qty}×${html(item.name)}`).join(', ')}</td><td><button type="button" class="btn small reorder-btn" data-reorder-order="${html(order.id)}">Reorder</button></td><td>${money(order.amount)}</td><td>${html(order.status)}${order.status==='Rejected'&&order.rejectionReason?`<small class="rejection-history-reason">${html(order.rejectionReason)}</small>`:''}</td><td>${new Date(orderHistoryTimestamp(order)).toLocaleString('en-IN',{timeZone:'Asia/Kolkata',dateStyle:'medium',timeStyle:'short'})}</td></tr>`;
}
function openReorderOrderModal(order,store,customer){
  let capturedLocation=null;
  const itemSummary=order.items.map(item=>`<li>${Number(item.qty)||1} × ${html(item.name)}</li>`).join('');
  modal('Reorder Previous Items',`<form id="reorderForm"><p class="muted">A fresh order request will be sent to ${html(store.name)}. The store reviews the current amount and then sends your payment QR.</p><div class="card" style="margin:12px 0"><strong>Items</strong><ul style="margin:8px 0 0;padding-left:20px">${itemSummary}</ul></div><div class="field"><label>Contact number</label><input name="phone" type="tel" value="${html(customer.phone||order.phone||'')}" placeholder="10-digit mobile number" required></div><div class="field"><button type="button" class="btn small secondary" id="shareLocationBtn">📍 Share My Location</button><p class="muted" id="locationStatus" style="margin-top:6px">Optional — helps the store guide your delivery.</p></div><button class="btn full green" type="submit" style="margin-top:10px">Send Reorder Request</button></form>`,()=>{
    bindShareLocationButton($('#shareLocationBtn'),$('#locationStatus'),point=>{capturedLocation=point});
    $('#reorderForm').onsubmit=async event=>{
      event.preventDefault();
      const phone=$('input[name="phone"]',event.target).value.trim();
      const button=event.submitter;button.disabled=true;
      try{
        await api.executeFunction(api.config.digitalOrderFunctionId,{action:'digit58-reorder',ownerId:store.ownerId,orderId:order.id,phone,locationLat:capturedLocation?.lat,locationLng:capturedLocation?.lng});
        if(phone&&phone!==customer.phone){await api.update(customerKind(store.ownerId),customer.id,{phone}).catch(()=>{});customer.phone=phone}
        closeModal();showIncomingOrderCall(store,customer,'Reorder sent — the store will review the amount and send your payment QR');
      }catch(error){button.disabled=false;toast(error.message||'Could not send reorder request')}
    };
  });
}
function orderItemRowMarkup(item={}){return `<div class="order-item-row"><input name="itemName[]" placeholder="Item name" value="${html(item.name||'')}" required><input name="itemQty[]" type="number" min="1" value="${Math.max(1,Number(item.qty)||1)}" aria-label="Quantity"><button type="button" class="btn small secondary remove-item-row" aria-label="Remove item">✕</button></div>`}
function openPlaceOrderModal(store,customer,promotions=[],rejectedDraft=null){
  let capturedLocation=null;
  const selectedPromotions=promotions.filter(promotion=>customerPromotionQuantities.has(promotion.id)).map(promotion=>({name:promotion.name,qty:customerPromotionQuantities.get(promotion.id)}));
  const rejectedItems=Array.isArray(rejectedDraft?.items)?rejectedDraft.items.map(item=>({name:item.name,qty:item.qty})).filter(item=>item.name):[];
  const startingItems=rejectedItems.length?rejectedItems:(selectedPromotions.length?selectedPromotions:[{}]);
  const minimum=storeMinimum(store),selectedPromotionValue=promotions.reduce((total,promotion)=>total+(customerPromotionQuantities.get(promotion.id)||0)*(Number(promotion.price)||0),0);
  const draftValue=Math.max(0,Number(rejectedDraft?.customerOrderValue)||0)||selectedPromotionValue;
  const minimumBlock=minimum?`<div class="minimum-order-notice"><strong>Minimum new order: ${money(minimum)}</strong><p>Enter the estimated value of these items. If it is lower, you can request one-order approval from the store.</p><div class="field"><label>Estimated order value (₹)</label><input id="customerOrderValue" name="customerOrderValue" type="number" min="0" step="0.01" value="${draftValue||''}" placeholder="${minimum}" required></div></div>`:'';
  const rejectedNote=rejectedDraft?`<div class="rejection-revise-note"><strong>Update the rejected order</strong><p>${html(rejectedDraft.rejectionReason||'Change the items or details before resubmitting.')}</p></div>`:'';
  modal(rejectedDraft?'Revise Rejected Order':'Place New Order',`<form id="placeOrderForm">${rejectedNote}${selectedPromotions.length&&!rejectedItems.length?`<div class="selected-offer-note">${selectedPromotions.length} promotional item${selectedPromotions.length===1?'':'s'} added. You can change quantities below.</div>`:''}${minimumBlock}<div id="orderItemRows">${startingItems.map(orderItemRowMarkup).join('')}</div><button type="button" class="btn small secondary" id="addItemRow" style="margin-top:8px">+ Add another item</button><div class="field" style="margin-top:14px"><label>Contact number</label><input name="phone" type="tel" value="${html(customer.phone||rejectedDraft?.phone||'')}" placeholder="10-digit mobile number" required></div><div class="field"><button type="button" class="btn small secondary" id="shareLocationBtn">📍 Share My Location</button><p class="muted" id="locationStatus" style="margin-top:6px">Optional — helps the store guide your delivery.</p></div><div class="field"><label>Prescription image <small>(optional)</small></label><input id="prescriptionFile" type="file" accept="image/jpeg,image/png,image/webp"></div><div class="minimum-order-actions"><button class="btn full" type="submit" style="margin-top:14px">${rejectedDraft?'Resubmit Order':'Submit Order'}</button>${minimum?'<button class="btn full secondary" type="submit" data-request-minimum-approval="true">Request Owner Approval</button>':''}</div></form>`,()=>{
    $('#addItemRow').onclick=()=>$('#orderItemRows').insertAdjacentHTML('beforeend',orderItemRowMarkup());
    $('#orderItemRows').addEventListener('click',event=>{const row=event.target.closest('.remove-item-row');if(row&&$$('.order-item-row').length>1)row.closest('.order-item-row').remove()});
    bindShareLocationButton($('#shareLocationBtn'),$('#locationStatus'),point=>{capturedLocation=point});
    $('#placeOrderForm').onsubmit=async event=>{
      event.preventDefault();
      const names=$$('input[name="itemName[]"]').map(input=>input.value.trim());
      const qtys=$$('input[name="itemQty[]"]').map(input=>Math.max(1,Number(input.value)||1));
      const items=names.map((name,index)=>({name,qty:qtys[index]})).filter(item=>item.name);
      if(!items.length)return toast('Add at least one item');
      const customerOrderValue=minimum?Math.max(0,Number($('#customerOrderValue').value)||0):0;
      const requestMinimumApproval=event.submitter?.dataset.requestMinimumApproval==='true';
      if(minimum&&customerOrderValue<minimum&&!requestMinimumApproval){$('#customerOrderValue').focus();return toast(`Minimum new order value is ${money(minimum)} — or request owner approval`)}
      if(requestMinimumApproval&&customerOrderValue>=minimum)return toast('This order already meets the minimum. Use Submit Order.');
      const phone=$('input[name="phone"]',event.target).value.trim();
      const button=event.submitter;button.disabled=true;
      try{
        let prescription={};
        const file=$('#prescriptionFile').files[0];
        if(file){
          const uploaded=await api.uploadAdMedia(file);
          prescription={prescriptionUrl:uploaded.mediaUrl,prescriptionFileId:uploaded.fileId,prescriptionName:uploaded.mediaName,prescriptionType:uploaded.mediaType};
        }
        await api.executeFunction(api.config.digitalOrderFunctionId,{action:'digit58-create-order',ownerId:store.ownerId,storeId:store.id,customerName:customer.customerName,customerEmail:customer.customerEmail,items,customerOrderValue,requestMinimumApproval,phone,locationLat:capturedLocation?.lat,locationLng:capturedLocation?.lng,...prescription});
        if(phone&&phone!==customer.phone){await api.update(customerKind(store.ownerId),customer.id,{phone}).catch(()=>{});customer.phone=phone}
        customerPromotionQuantities.clear();
        closeModal();showIncomingOrderCall(store,customer,requestMinimumApproval?'Minimum-order approval requested from the store':'Order sent to the store');
      }catch(error){button.disabled=false;toast(error.message||'Could not place order')}
    };
  });
}

window.addEventListener('hashchange',boot);
boot();
