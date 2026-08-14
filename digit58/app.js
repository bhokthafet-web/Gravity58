const $=(selector,root=document)=>root.querySelector(selector),$$=(selector,root=document)=>[...root.querySelectorAll(selector)];
const app=$('#app'),api=window.Gravity58Ads;
const now=()=>new Date().toISOString();
const id=(prefix='d58')=>`${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2,7)}`;
const html=value=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const money=value=>`₹${Number(value||0).toLocaleString('en-IN')}`;
const safeId=(prefix,ownerId,max)=>`${prefix}${String(ownerId||'public').replace(/[^a-zA-Z0-9._-]/g,'-').slice(0,max)}`;
const storeKind=(ownerId)=>safeId('digit58_store_',ownerId,40);
const customerKind=(ownerId)=>safeId('digit58_customer_',ownerId,36);
const cardKind=(ownerId)=>safeId('digit58_card_',ownerId,40);
const orderKind=(ownerId)=>safeId('digit58_order_',ownerId,40);
const REQUEST_KIND='digit58_requests',ENTITLEMENT_KIND='digit58_entitlements',SUBSCRIPTION_AMOUNT=399,QR_REVEAL_DAYS=5;
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
let state={activeStoreId:'',stores:[],customers:[],cards:[],orders:[]};
function save(){try{localStorage.setItem('gravity58Digit58',JSON.stringify(state))}catch{}}
function load(){try{return {...state,...JSON.parse(localStorage.getItem('gravity58Digit58')||'{}')}}catch{return state}}
state=load();

let orderAlertTimer=null,orderAlertContext=null;
const ringingIds=new Set();
let knownOrderIds=new Set(),knownBuyRequestIds=new Set();
let ownerOrdersUnsubscribe=null,ownerCardsUnsubscribe=null;
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
    const stillRinging=state.orders.some(row=>row.id===id&&row.status==='Requested')||state.cards.some(row=>row.id===id&&row.status==='Buy Requested');
    if(!stillRinging)ringingIds.delete(id);
  });
  if(!ringingIds.size){if(orderAlertTimer)clearInterval(orderAlertTimer);orderAlertTimer=null;return}
  if(!orderAlertTimer){orderAlertBeep();orderAlertTimer=setInterval(()=>orderAlertBeep(),2200)}
}
document.addEventListener('pointerdown',()=>{if(ringingIds.size)orderAlertBeep()},{passive:true});
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
}
function stopOwnerRealtime(){ownerOrdersUnsubscribe?.();ownerCardsUnsubscribe?.();ownerOrdersUnsubscribe=ownerCardsUnsubscribe=null;ringingIds.clear();knownOrderIds.clear();knownBuyRequestIds.clear();updateOrderAlertSound()}
async function refreshOwnerOrdersRealtime(){
  const ownerId=cloudOwnerId();if(!ownerId)return;
  const orders=await api.list(orderKind(ownerId)).catch(()=>null);
  if(!orders)return;
  let isNew=false;
  orders.forEach(order=>{if(order.status==='Requested'&&!knownOrderIds.has(order.id)){ringingIds.add(order.id);isNew=true}knownOrderIds.add(order.id)});
  state.orders=orders;save();
  updateOrderAlertSound();
  if(isNew)toast('🔔 New order received');
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

function cloudOwnerId(){return session?.$id||''}
function activeStore(){return state.stores.find(row=>row.id===state.activeStoreId)||state.stores[0]||null}
function ownerCustomers(storeId=state.activeStoreId){return state.customers.filter(row=>row.storeId===storeId)}
function customerCards(customerAccountId,storeId=state.activeStoreId){return state.cards.filter(row=>row.storeId===storeId&&row.customerAccountId===customerAccountId)}
function isCardDue(card){return new Date(card.dueAt).getTime()<=Date.now()}
function daysRemaining(card){return Math.max(0,Math.ceil((new Date(card.dueAt).getTime()-Date.now())/86400000))}
function storeOrders(storeId=state.activeStoreId){return state.orders.filter(row=>row.storeId===storeId)}
function customerOrders(customerAccountId,storeId=state.activeStoreId){return state.orders.filter(row=>row.storeId===storeId&&row.customerAccountId===customerAccountId)}
function activeOrders(orders){return orders.filter(row=>!['Delivered','Rejected'].includes(row.status))}
function orderHistoryOrders(orders){return orders.filter(row=>['Delivered','Rejected'].includes(row.status))}

async function boot(){
  if(!api?.configured)return renderConfigError();
  const hash=new URLSearchParams(location.hash.replace(/^#store&?/,''));
  if(location.hash.startsWith('#store&'))return renderPublicStore(hash);
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
  app.innerHTML=`<main class="screen"><section class="auth-card"><div class="brand"><div class="brand-mark">R</div><div><h2>Before you continue</h2><p class="tagline">Please review and accept the Refills policy</p></div></div><div class="card"><p class="muted">${html(DIGIT58_POLICY_TEXT)}</p></div><div class="actions" style="margin-top:16px"><button class="btn full" id="acceptPolicyBtn">I Accept</button><button class="btn secondary full" id="policyLogout">Sign out</button></div></section></main>`;
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
  app.innerHTML=`<main class="screen"><section class="auth-card"><div class="brand"><div class="brand-mark">R</div><div><h2>Refills</h2><p class="tagline">Store portal access is ${money(SUBSCRIPTION_AMOUNT)}/month.</p></div></div>${body}<div class="actions" style="margin-top:16px"><button class="btn secondary full" id="gateLogout">Sign out</button></div></section></main>`;
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
function renderConfigError(){app.innerHTML=`<main class="screen"><section class="auth-card"><div class="brand"><div class="brand-mark">R</div><div><h2>Refills</h2><p class="tagline">Take any store online</p></div></div><p>Refills is temporarily unavailable. Please try again shortly.</p></section></main>`}

function renderOwnerAuth(){
  app.innerHTML=`<main class="screen"><section class="auth-card">
    <div class="brand"><div class="brand-mark">R</div><div><h2>Refills</h2><p class="tagline">Turn your store digital — orders, customers and reminders in one place.</p></div></div>
    <div class="actions" style="margin-bottom:14px"><button class="btn small" id="tabLogin">Sign in</button><button class="btn small secondary" id="tabSignup">Create store account</button></div>
    <form id="ownerAuthForm">
      <div class="field full-name-field hidden"><label>Your name</label><input name="name"></div>
      <div class="field"><label>Email</label><input name="email" type="email" required></div>
      <div class="field"><label>Password</label><input name="password" type="password" minlength="8" required></div>
      <button class="btn full" id="ownerAuthSubmit" type="submit">Sign In</button>
    </form>
    <p class="muted" style="text-align:center;margin-top:14px">Are you a customer? Use the link your store shared with you.</p>
  </section></main>`;
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
  const [stores,customers,cards,orders]=await Promise.all([
    api.list(storeKind(ownerId)).catch(()=>[]),
    api.list(customerKind(ownerId)).catch(()=>[]),
    api.list(cardKind(ownerId)).catch(()=>[]),
    api.list(orderKind(ownerId)).catch(()=>[]),
  ]);
  state.stores=stores;state.customers=customers;state.cards=cards;state.orders=orders;
  if(!state.activeStoreId||!stores.some(row=>row.id===state.activeStoreId))state.activeStoreId=stores[0]?.id||'';
  save();
}

function floatingSupportButton(source){return `<a class="floating-support-btn" href="/support/?from=${encodeURIComponent(source)}" title="Support">🛟<span>Support</span></a>`}
function siteFooter(){return `<footer class="g58-site-footer"><div class="g58-site-footer-badge"><button type="button" class="g58-app-badge" id="androidAppBtn"><span class="g58-app-badge-icon">▶</span><span class="g58-app-badge-text"><small>Coming soon on</small><strong>Get G58 App</strong></span></button></div><p class="g58-site-footer-note">© ${new Date().getFullYear()} Gravity58 · Refills</p></footer>`}
function bindAndroidAppFooter(){$('#androidAppBtn')?.addEventListener('click',()=>toast('Android app coming soon — stay tuned!'))}
function renderShell(){
  const store=activeStore();
  app.innerHTML=`<div class="shell"><aside class="sidebar"><div class="brand"><div class="brand-mark">R</div><div><strong>Refills</strong><small class="muted">Store workspace</small></div></div><nav class="nav">${navButton('dashboard','◉','Dashboard')}${navButton('stores','◫','My Stores')}${navButton('wall','☰','Customer Wall')}${navButton('orders','🧾','Orders')}${navButton('orderHistory','🕘','Order History')}${navButton('subscription','♢','Subscription')}${navButton('settings','⚙','Settings')}<button id="logout">⇥ Logout</button></nav></aside><main class="main"><header class="topbar"><div>${state.stores.length?`<select id="storeSwitch">${state.stores.map(row=>`<option value="${html(row.id)}" ${row.id===state.activeStoreId?'selected':''}>${html(row.name)}</option>`).join('')}</select>`:'<strong>No store yet</strong>'}</div><span class="status-pill"><span class="dot"></span>${html(session?.email||'')}</span></header><section class="content" id="page"></section></main></div>${siteFooter()}${floatingSupportButton('digit58')}`;
  $$('[data-view]').forEach(button=>button.onclick=()=>{view=button.dataset.view;renderShell()});
  $('#logout').onclick=async()=>{stopOwnerRealtime();await api.logout();session=null;renderOwnerAuth()};
  $('#storeSwitch')?.addEventListener('change',event=>{state.activeStoreId=event.target.value;save();renderShell()});
  bindAndroidAppFooter();
  renderView();
}
function navButton(key,icon,label){return `<button data-view="${key}" class="${view===key?'active':''}"><span>${icon}</span>${label}</button>`}
function renderView(){if(!activeStore()&&view!=='stores'&&view!=='settings'&&view!=='subscription'){view='stores';return renderShell()}({dashboard:dashboardView,stores:storesView,wall:customerWallView,orders:ordersView,orderHistory:orderHistoryView,subscription:subscriptionView,settings:settingsView}[view]||dashboardView)()}
function ordersView(){
  refreshView=ordersView;
  const orders=activeOrders(state.orders).sort((a,b)=>new Date(b.createdAt)-new Date(a.createdAt));
  const multiStore=state.stores.length>1;
  $('#page').innerHTML=`<div class="section-head"><div><h1>Orders</h1><p class="muted">All active orders from every customer${multiStore?', across every store':''}.</p></div></div><div class="grid card-grid">${orders.map(order=>ownerOrderMarkup(order,true,multiStore)).join('')||'<div class="empty">No active orders right now.</div>'}</div>`;
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
  const needsAttention=orders.filter(row=>['Requested','Priced'].includes(row.status));
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
  return `<article class="card"><h3>${html(store.name)}</h3><p class="muted">${html(store.category)}${store.city?' · '+html(store.city):''}</p><p>${html(store.description||'')}</p><div class="chips"><span class="chip">${ownerCustomers(store.id).length} customers</span>${store.suspended?'<span class="chip due">Paused by G58 admin</span>':''}</div><div class="actions"><button class="btn small" data-share-store="${html(store.id)}">Share Link / QR</button><button class="btn small secondary" data-edit-store="${html(store.id)}">Edit</button></div></article>`;
}
function publicStoreLink(store){return `${location.origin}${location.pathname.replace(/index\.html$/,'')}#store&owner=${encodeURIComponent(store.ownerId)}&store=${encodeURIComponent(store.id)}`}
function openStoreForm(storeId=''){
  const store=state.stores.find(row=>row.id===storeId)||{};
  modal(storeId?'Edit Store':'Create Store',`<form id="storeForm"><div class="field"><label>Store name</label><input name="name" value="${html(store.name||'')}" required></div><div class="form-grid"><div class="field"><label>Category</label><input name="category" value="${html(store.category||'')}" placeholder="Example: Pharmacy"></div><div class="field"><label>City</label><input name="city" value="${html(store.city||'')}"></div></div><div class="field"><label>Phone</label><input name="phone" value="${html(store.phone||'')}"></div><div class="field"><label>UPI ID <small>(for order payment QR codes)</small></label><input name="upiId" value="${html(store.upiId||'')}" placeholder="yourstore@upi"></div><div class="field"><label>Description</label><textarea name="description">${html(store.description||'')}</textarea></div><button class="btn full">${storeId?'Save Store':'Create Store'}</button></form>`,()=>{
    $('#storeForm').onsubmit=async event=>{
      event.preventDefault();
      const values=Object.fromEntries(new FormData(event.target)),ownerId=cloudOwnerId(),button=event.submitter;
      button.disabled=true;
      try{
        if(storeId){
          await api.update(storeKind(ownerId),storeId,values);
          Object.assign(store,values);
          const ownerSummary={ownerId,ownerEmail:session?.email||'',storeId,storeName:values.name.trim(),category:values.category.trim()||'General store',city:values.city.trim(),createdAt:store.createdAt||now()};
          try{await api.update('digit58_owners',`owner-${storeId}`,ownerSummary)}
          catch{try{await api.create('digit58_owners',ownerSummary,`owner-${storeId}`,api.permissionSet?.('digit58_owners',ownerId,true))}catch{}}
        }else{
          const record={id:id('store'),ownerId,name:values.name.trim(),category:values.category.trim()||'General store',city:values.city.trim(),phone:values.phone.trim(),upiId:values.upiId.trim(),description:values.description.trim(),createdAt:now()};
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
  $('#page').innerHTML=`<div class="section-head"><div><h1>${html(customer.customerName||'Customer')}</h1><p class="muted">${html(customer.customerEmail||'')}</p></div><div class="actions"><button class="btn secondary" id="backToWall">← Back</button><button class="btn" id="addCard">+ Add Reminder Card</button></div></div>
  <div class="section-head"><h2>Orders</h2></div>
  <div class="grid card-grid">${orders.map(order=>ownerOrderMarkup(order)).join('')||'<div class="empty">No active orders from this customer.</div>'}</div>
  <div class="section-head"><h2>Reminder Cards</h2></div>
  <div class="grid card-grid">${cards.map(ownerCardMarkup).join('')||'<div class="empty">No cards yet for this customer.</div>'}</div>`;
  $('#backToWall').onclick=()=>{view='wall';renderShell()};
  $('#addCard').onclick=()=>openCardForm(customer);
  bindOwnerCardActions();
  bindOwnerOrderActions();
  bindOrderChatForms(orders,'owner',refreshView);
  bindCardChatForms(cards,'owner',refreshView);
  bindDeliveryShareButtons(orders);
  bindDeliveryShareButtons(cards);
}
const BIG_STATUS_SUB={
  Requested:'Your order has been received by the store',
  Priced:'Review the amount below and pay to continue',
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
  return `<article class="card order-item-card ${ringing?'incoming-order':''}">${ringing?'<span class="incoming-order-beacon" aria-label="New order" title="New order"></span>':''}<div class="section-head"><h3>Order #${html(order.id.slice(-6).toUpperCase())}</h3><span class="chip ${['Requested','Priced'].includes(order.status)?'due':''}">${html(order.status)}</span></div>${showStore?`<p class="muted" style="margin:-8px 0 0"><strong>${html(store?.name||'Store')}</strong></p>`:''}${showCustomer?`<p class="muted" style="margin:-4px 0 4px">${html(customer?.customerName||order.customerName||'Customer')}</p>`:''}${orderStepperMarkup(order.status)}<div class="order-items-list">${order.items.map(item=>`<div class="order-line-item"><span>${item.qty} ×</span><span>${html(item.name)}</span></div>`).join('')}</div>${order.prescriptionUrl?`<a class="link-btn" href="${html(order.prescriptionUrl)}" target="_blank" rel="noopener">📄 View prescription</a>`:''}${order.amount?`<h3 style="margin:10px 0">${money(order.amount)}</h3>`:'<p class="muted">Amount not set yet.</p>'}${deliveryContactMarkup(order)}<div class="actions">${orderOwnerActions(order)}</div>${orderChatMarkup(order,'owner')}</article>`;
}
function orderOwnerActions(order){
  const map={
    Requested:`<button class="btn small" data-set-amount="${html(order.id)}">Set Amount</button><button class="btn small red" data-reject-order="${html(order.id)}">Reject</button>`,
    Priced:`<button class="btn small green" data-accept-order="${html(order.id)}">Accept Order</button><button class="btn small red" data-reject-order="${html(order.id)}">Reject</button>`,
    Accepted:`<button class="btn small green" data-advance-order="${html(order.id)}" data-next="Preparing">Start Preparing</button>`,
    Preparing:`<button class="btn small green" data-advance-order="${html(order.id)}" data-next="Out for Delivery">Out for Delivery</button>`,
    'Out for Delivery':`<button class="btn small green" data-advance-order="${html(order.id)}" data-next="Delivered">Mark Delivered</button>`,
  };
  return map[order.status]||'';
}
function bindOwnerOrderActions(){
  $$('[data-set-amount]').forEach(button=>button.onclick=()=>setOrderAmount(button.dataset.setAmount));
  $$('[data-accept-order]').forEach(button=>button.onclick=()=>advanceOrder(button.dataset.acceptOrder,'Accepted'));
  $$('[data-advance-order]').forEach(button=>button.onclick=()=>advanceOrder(button.dataset.advanceOrder,button.dataset.next));
  $$('[data-reject-order]').forEach(button=>button.onclick=()=>rejectOrder(button.dataset.rejectOrder));
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
  modal('Set Order Amount',`<form id="setAmountForm"><div class="form-grid"><div class="field"><label>Amount (₹)</label><input id="amountInput" name="amount" type="number" min="1" step="0.01" value="${order.amount||''}" required></div><div class="field"><label>UPI ID</label><input id="upiIdInput" name="upiId" value="${html(order.upiId||store?.upiId||'')}" placeholder="yourstore@upi"></div></div><div class="qr-wrap" id="amountQrPreview"></div><button class="btn full" style="margin-top:14px">Set Amount</button></form>`,()=>{
    bindLiveQrPreview({amountInput:$('#amountInput'),upiInput:$('#upiIdInput'),previewEl:$('#amountQrPreview'),payeeName:store?.name,refId:order.id});
    $('#setAmountForm').onsubmit=async event=>{
      event.preventDefault();
      const amount=Number($('#amountInput').value),upiId=$('#upiIdInput').value.trim(),button=event.submitter;
      if(!amount||amount<=0)return toast('Enter a valid amount');
      button.disabled=true;
      const upiUri=buildUpiUri(upiId,store?.name,amount,order.id);
      try{
        await api.update(orderKind(order.ownerId),order.id,{amount,upiId,upiUri,status:'Priced',pricedAt:now()});
        Object.assign(order,{amount,upiId,upiUri,status:'Priced',pricedAt:now()});
        updateOrderAlertSound();
        closeModal();refreshView();toast('Amount set — customer can now pay');
      }catch(error){button.disabled=false;toast(error.message||'Could not set amount')}
    };
  });
}
async function advanceOrder(orderId,next){
  const order=state.orders.find(row=>row.id===orderId);if(!order||!next)return;
  const changes={status:next,updatedAt:now()};
  if(next==='Accepted')changes.acceptedAt=now();
  if(next==='Delivered')changes.deliveredAt=now();
  try{
    await api.update(orderKind(order.ownerId),orderId,changes);
    Object.assign(order,changes);
    ringingIds.delete(orderId);updateOrderAlertSound();
    refreshView();
    toast(next==='Delivered'?'Order delivered':`Order status: ${next}`);
  }catch(error){toast(error.message||'Could not update order')}
}
async function rejectOrder(orderId){
  const order=state.orders.find(row=>row.id===orderId);if(!order||!confirm('Reject this order?'))return;
  try{
    await api.update(orderKind(order.ownerId),orderId,{status:'Rejected',rejectedAt:now()});
    Object.assign(order,{status:'Rejected',rejectedAt:now()});
    ringingIds.delete(orderId);updateOrderAlertSound();
    refreshView();toast('Order rejected');
  }catch(error){toast(error.message||'Could not reject order')}
}
function orderHistoryView(){
  refreshView=orderHistoryView;
  const store=activeStore();
  const fromInput=$('#historyFrom')?.value||'',toInput=$('#historyTo')?.value||'';
  const all=orderHistoryOrders(storeOrders(store?.id));
  const filtered=all.filter(order=>{
    const day=new Date(order.deliveredAt||order.updatedAt||order.createdAt).toISOString().slice(0,10);
    if(fromInput&&day<fromInput)return false;
    if(toInput&&day>toInput)return false;
    return true;
  }).sort((a,b)=>new Date(b.deliveredAt||b.updatedAt||b.createdAt)-new Date(a.deliveredAt||a.updatedAt||a.createdAt));
  $('#page').innerHTML=`<div class="section-head"><div><h1>Order History</h1><p class="muted">Completed and rejected orders for ${html(store?.name||'this store')}.</p></div></div><div class="date-filter-bar"><label>From<input id="historyFrom" type="date" value="${html(fromInput)}"></label><label>To<input id="historyTo" type="date" value="${html(toInput)}"></label></div><div class="grid stats">${metric('Orders',filtered.length)}${metric('Revenue',money(filtered.filter(o=>o.status==='Delivered').reduce((sum,o)=>sum+Number(o.amount||0),0)))}</div><div class="card table-wrap"><table><thead><tr><th>Customer</th><th>Items</th><th>Amount</th><th>Status</th><th>Date</th></tr></thead><tbody>${filtered.map(orderHistoryRow).join('')||'<tr><td colspan="5">No orders in this period.</td></tr>'}</tbody></table></div>`;
  $('#historyFrom').onchange=orderHistoryView;$('#historyTo').onchange=orderHistoryView;
}
function orderHistoryRow(order){
  const customer=state.customers.find(c=>c.customerAccountId===order.customerAccountId&&c.storeId===order.storeId);
  return `<tr><td>${html(customer?.customerName||order.customerName||'Customer')}</td><td>${order.items.map(i=>`${i.qty}×${html(i.name)}`).join(', ')}</td><td>${money(order.amount)}</td><td>${html(order.status)}</td><td>${new Date(order.deliveredAt||order.updatedAt||order.createdAt).toLocaleString('en-IN',{dateStyle:'medium',timeStyle:'short'})}</td></tr>`;
}
function ownerCardMarkup(card){
  const due=isCardDue(card),remaining=daysRemaining(card),pct=Math.min(100,Math.round((1-remaining/Math.max(1,Number(card.reminderDays)||1))*100)),ringing=ringingIds.has(card.id);
  return `<article class="card reminder-card ${due||card.status==='Buy Requested'?'due':''} ${ringing?'incoming-order':''}">${ringing?'<span class="incoming-order-beacon" aria-label="Buy again request" title="Buy again request"></span>':''}<h3>${html(card.productName)}</h3><p class="muted">${money(card.price)} · every ${Number(card.reminderDays)} day(s)</p><div class="reminder-progress ${due?'due':''}"><span style="width:${pct}%"></span></div><div class="chips"><span class="chip ${due?'due':''}">${due?'Due now':`${remaining} day(s) left`}</span>${card.status==='Buy Requested'?'<span class="chip due">Buy requested</span>':''}${Number(card.timesDelivered)?`<span class="chip delivered">${Number(card.timesDelivered)} delivered</span>`:''}</div>${deliveryContactMarkup(card)}<div class="actions">${card.status==='Buy Requested'?`<button class="btn small green" data-deliver="${html(card.id)}">Mark Delivered</button>`:''}<button class="btn small secondary" data-edit-card="${html(card.id)}">Edit</button><button class="btn small red" data-remove-card="${html(card.id)}">Remove</button></div>${cardChatMarkup(card,'owner')}</article>`;
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
function closeModal(){$('#modal')?.remove()}

async function renderPublicStore(hashParams){
  const ownerId=hashParams.get('owner')||'',storeId=hashParams.get('store')||'';
  if(!ownerId||!storeId){app.innerHTML=`<main class="public-store"><div class="empty">This store link is invalid.</div></main>`;return}
  let store;
  try{store=await api.get(storeKind(ownerId),storeId)}
  catch{app.innerHTML=`<main class="public-store"><div class="empty">This store could not be found.</div></main>`;return}
  if(store.suspended){app.innerHTML=`<main class="public-store"><section class="store-hero"><h1>${html(store.name)}</h1></section><div class="empty">This store is temporarily unavailable. Please check back later.</div></main>`;return}
  const account=await api.currentUser().catch(()=>null);
  if(!account)return renderCustomerAuth(store,ownerId,storeId);
  const customer=await ensureCustomerLink(ownerId,storeId,account);
  await loadAndRenderCustomerView(store,customer);
  startCustomerRealtime(store,customer);
}
async function loadAndRenderCustomerView(store,customer){
  const [cards,orders]=await Promise.all([
    api.list(cardKind(store.ownerId)).catch(()=>[]),
    api.list(orderKind(store.ownerId)).catch(()=>[]),
  ]);
  renderCustomerCards(store,customer,
    cards.filter(row=>row.storeId===store.id&&row.customerAccountId===customer.customerAccountId),
    orders.filter(row=>row.storeId===store.id&&row.customerAccountId===customer.customerAccountId));
}
let customerOrdersUnsubscribe=null,customerCardsUnsubscribe=null;
function startCustomerRealtime(store,customer){
  if(!api?.subscribeKind)return;
  customerOrdersUnsubscribe?.();
  customerOrdersUnsubscribe=api.subscribeKind(orderKind(store.ownerId),()=>{if(!$('.modal-backdrop'))loadAndRenderCustomerView(store,customer)});
  customerCardsUnsubscribe?.();
  customerCardsUnsubscribe=api.subscribeKind(cardKind(store.ownerId),()=>{if(!$('.modal-backdrop'))loadAndRenderCustomerView(store,customer)});
}
function stopCustomerRealtime(){customerOrdersUnsubscribe?.();customerCardsUnsubscribe?.();customerOrdersUnsubscribe=customerCardsUnsubscribe=null}
function renderCustomerAuth(store,ownerId,storeId){
  app.innerHTML=`<main class="public-store"><section class="store-hero"><span class="chip">${html(store.category||'Store')}</span><h1>${html(store.name)}</h1><p class="muted">${html(store.description||'')}${store.city?' · '+html(store.city):''}</p></section><div class="card"><div class="actions" style="margin-bottom:14px"><button class="btn small" id="custTabLogin">Sign in</button><button class="btn small secondary" id="custTabSignup">Sign up</button></div><form id="customerAuthForm"><div class="field full-name-field hidden"><label>Your name</label><input name="name"></div><div class="field"><label>Email</label><input name="email" type="email" required></div><div class="field"><label>Password</label><input name="password" type="password" minlength="8" required></div><button class="btn full" id="custAuthSubmit" type="submit">Sign In</button></form></div></main>`;
  let mode='login';
  const syncMode=()=>{$('.full-name-field').classList.toggle('hidden',mode!=='signup');$('#custAuthSubmit').textContent=mode==='signup'?'Create Account':'Sign In';$('#custTabLogin').className=mode==='login'?'btn small':'btn small secondary';$('#custTabSignup').className=mode==='signup'?'btn small':'btn small secondary'};
  $('#custTabLogin').onclick=()=>{mode='login';syncMode()};
  $('#custTabSignup').onclick=()=>{mode='signup';syncMode()};
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
  const result=await api.executeFunction(api.config.digitalOrderFunctionId,{action:'digit58-link-customer',ownerId,storeId,customerName:account.name||account.email.split('@')[0],customerEmail:account.email});
  return result.customer;
}
function renderCustomerCards(store,customer,cards,orders=[]){
  const active=activeOrders(orders).sort((a,b)=>new Date(b.createdAt)-new Date(a.createdAt));
  const history=orderHistoryOrders(orders).sort((a,b)=>new Date(b.updatedAt||b.createdAt)-new Date(a.updatedAt||a.createdAt));
  app.innerHTML=`<main class="public-store"><section class="store-hero"><span class="chip">${html(store.category||'Store')}</span><h1>${html(store.name)}</h1><p class="muted">${html(store.description||'')}${store.city?' · '+html(store.city):''}</p></section>
  <div class="section-head"><h2>Your orders</h2><button class="btn small" id="placeOrderBtn">+ Place New Order</button></div>
  <div class="grid card-grid">${active.map(customerOrderMarkup).join('')||'<div class="empty">No active orders. Place a new order to get started.</div>'}</div>
  <div class="section-head"><h2>Your reminder cards</h2></div>
  <div class="grid card-grid" id="customerCardGrid">${cards.map(customerCardCardMarkup).join('')||'<div class="empty">Your store will add reminder cards here after your first purchase.</div>'}</div>
  ${history.length?`<div class="section-head"><h2>Order History</h2></div><div class="card table-wrap"><table><thead><tr><th>Items</th><th>Amount</th><th>Status</th><th>Date</th></tr></thead><tbody>${history.map(customerOrderHistoryRow).join('')}</tbody></table></div>`:''}
  <div class="actions" style="margin-top:20px"><button class="btn secondary" id="custLogout">Sign out</button></div></main>${siteFooter()}`;
  active.filter(order=>order.status==='Priced'&&order.upiUri).forEach(order=>{
    const target=document.getElementById(`qr-${order.id}`);
    if(target&&window.QRCode)new QRCode(target,{text:order.upiUri,width:180,height:180});
  });
  cards.filter(card=>card.status!=='Buy Requested'&&card.upiUri&&(isCardDue(card)||daysRemaining(card)<=QR_REVEAL_DAYS)).forEach(card=>{
    const target=document.getElementById(`card-qr-${card.id}`);
    if(target&&window.QRCode)new QRCode(target,{text:card.upiUri,width:160,height:160});
  });
  $('#placeOrderBtn').onclick=()=>openPlaceOrderModal(store,customer);
  $$('[data-buy-again]').forEach(button=>button.onclick=()=>{
    const card=cards.find(row=>row.id===button.dataset.buyAgain);
    openBuyAgainModal(button.dataset.buyAgain,store,customer,card?.productName);
  });
  bindOrderChatForms(active,'customer',()=>loadAndRenderCustomerView(store,customer));
  bindCardChatForms(cards,'customer',()=>loadAndRenderCustomerView(store,customer));
  initShakeDetection();
  bindAndroidAppFooter();
  $('#custLogout').onclick=async()=>{stopCustomerRealtime();await api.logout();location.hash=`store&owner=${encodeURIComponent(store.ownerId)}&store=${encodeURIComponent(store.id)}`;boot()};
}
function vialMarkup(card){
  const remaining=daysRemaining(card),total=Math.max(1,Number(card.reminderDays)||1),due=isCardDue(card);
  const pct=Math.max(0,Math.min(100,Math.round((remaining/total)*100)));
  return `<div class="vial ${due?'vial-empty':''}"><div class="vial-cap"></div><div class="vial-glass"><div class="vial-liquid" style="height:${pct}%"></div></div><div class="vial-label"><strong>${due?'Due':`${remaining}d`}</strong><small>left</small></div></div>`;
}
function customerCardCardMarkup(card){
  const due=isCardDue(card),remaining=daysRemaining(card),showQr=(due||remaining<=QR_REVEAL_DAYS)&&card.status!=='Buy Requested';
  let payBlock='';
  if(card.status==='Buy Requested'){
    payBlock='<p class="muted">Waiting for the store to confirm and deliver.</p>';
  }else if(showQr&&card.upiUri){
    payBlock=`<div class="qr-wrap" id="card-qr-${html(card.id)}"></div><p class="muted" style="text-align:center;margin:8px 0">${due?'Scan to pay for your refill.':`Scan to pay — refill due in ${remaining} day(s).`}</p><button class="btn full green" data-buy-again="${html(card.id)}">Buy Again</button>`;
  }else if(showQr){
    payBlock=`<button class="btn full green" data-buy-again="${html(card.id)}">Buy Again</button>`;
  }else{
    payBlock=`<p class="muted" style="text-align:center">Payment QR unlocks ${remaining-QR_REVEAL_DAYS} day(s) before refill.</p>`;
  }
  return `<article class="card reminder-card premium-card vial-card ${due?'due':''}"><div class="vial-card-body"><div class="vial-card-info"><h3>${html(card.productName)}</h3><p class="muted">${money(card.price)} · every ${Number(card.reminderDays)} day(s)</p><div class="chips"><span class="chip ${due?'due':''}">${due?'Due now':`${remaining} day(s) left`}</span>${card.status==='Buy Requested'?'<span class="chip due">Request sent</span>':''}</div></div>${vialMarkup(card)}</div>${payBlock}${cardChatMarkup(card,'customer')}</article>`;
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
        await api.executeFunction(api.config.digitalOrderFunctionId,{action:'digit58-request-buy-again',ownerId:store.ownerId,cardId,phone,locationLat:capturedLocation?.lat,locationLng:capturedLocation?.lng});
        if(phone&&phone!==customer.phone){await api.update(customerKind(store.ownerId),customer.id,{phone}).catch(()=>{});customer.phone=phone}
        closeModal();toast('Request sent — the store will confirm and deliver soon');
        await loadAndRenderCustomerView(store,customer);
      }catch(error){button.disabled=false;toast(error.message||'Could not send request')}
    };
  });
}
function customerOrderMarkup(order){
  const paymentBlock=order.status==='Priced'
    ?`<div class="qr-wrap" id="qr-${html(order.id)}"></div><h3 style="margin:10px 0;text-align:center">${money(order.amount)}</h3><p class="muted" style="text-align:center">Scan to pay via UPI. The store will accept your order once payment is received.</p>`
    :order.amount?`<h3 style="margin:10px 0">${money(order.amount)}</h3>`:'<p class="muted">Waiting for the store to review and set the amount.</p>';
  return `<article class="card order-item-card premium-card"><div class="section-head"><h3>Order #${html(order.id.slice(-6).toUpperCase())}</h3><span class="chip">${html(order.status)}</span></div>${bigStatusMarkup(order.status)}${orderStepperMarkup(order.status)}<div class="order-items-list">${order.items.map(item=>`<div class="order-line-item"><span>${item.qty} ×</span><span>${html(item.name)}</span></div>`).join('')}</div>${order.prescriptionUrl?`<a class="link-btn" href="${html(order.prescriptionUrl)}" target="_blank" rel="noopener">📄 View your prescription</a>`:''}${paymentBlock}${orderChatMarkup(order,'customer')}</article>`;
}
function customerOrderHistoryRow(order){
  return `<tr><td>${order.items.map(item=>`${item.qty}×${html(item.name)}`).join(', ')}</td><td>${money(order.amount)}</td><td>${html(order.status)}</td><td>${new Date(order.updatedAt||order.createdAt).toLocaleString('en-IN',{dateStyle:'medium',timeStyle:'short'})}</td></tr>`;
}
function orderItemRowMarkup(){return `<div class="order-item-row"><input name="itemName[]" placeholder="Item name" required><input name="itemQty[]" type="number" min="1" value="1" aria-label="Quantity"><button type="button" class="btn small secondary remove-item-row" aria-label="Remove item">✕</button></div>`}
function openPlaceOrderModal(store,customer){
  let capturedLocation=null;
  modal('Place New Order',`<form id="placeOrderForm"><div id="orderItemRows">${orderItemRowMarkup()}</div><button type="button" class="btn small secondary" id="addItemRow" style="margin-top:8px">+ Add another item</button><div class="field" style="margin-top:14px"><label>Contact number</label><input name="phone" type="tel" value="${html(customer.phone||'')}" placeholder="10-digit mobile number" required></div><div class="field"><button type="button" class="btn small secondary" id="shareLocationBtn">📍 Share My Location</button><p class="muted" id="locationStatus" style="margin-top:6px">Optional — helps the store guide your delivery.</p></div><div class="field"><label>Prescription image <small>(optional)</small></label><input id="prescriptionFile" type="file" accept="image/jpeg,image/png,image/webp"></div><button class="btn full" type="submit" style="margin-top:14px">Submit Order</button></form>`,()=>{
    $('#addItemRow').onclick=()=>$('#orderItemRows').insertAdjacentHTML('beforeend',orderItemRowMarkup());
    $('#orderItemRows').addEventListener('click',event=>{const row=event.target.closest('.remove-item-row');if(row&&$$('.order-item-row').length>1)row.closest('.order-item-row').remove()});
    bindShareLocationButton($('#shareLocationBtn'),$('#locationStatus'),point=>{capturedLocation=point});
    $('#placeOrderForm').onsubmit=async event=>{
      event.preventDefault();
      const names=$$('input[name="itemName[]"]').map(input=>input.value.trim());
      const qtys=$$('input[name="itemQty[]"]').map(input=>Math.max(1,Number(input.value)||1));
      const items=names.map((name,index)=>({name,qty:qtys[index]})).filter(item=>item.name);
      if(!items.length)return toast('Add at least one item');
      const phone=$('input[name="phone"]',event.target).value.trim();
      const button=event.submitter;button.disabled=true;
      try{
        let prescription={};
        const file=$('#prescriptionFile').files[0];
        if(file){
          const uploaded=await api.uploadAdMedia(file);
          prescription={prescriptionUrl:uploaded.mediaUrl,prescriptionFileId:uploaded.fileId,prescriptionName:uploaded.mediaName,prescriptionType:uploaded.mediaType};
        }
        await api.executeFunction(api.config.digitalOrderFunctionId,{action:'digit58-create-order',ownerId:store.ownerId,storeId:store.id,customerName:customer.customerName,customerEmail:customer.customerEmail,items,phone,locationLat:capturedLocation?.lat,locationLng:capturedLocation?.lng,...prescription});
        if(phone&&phone!==customer.phone){await api.update(customerKind(store.ownerId),customer.id,{phone}).catch(()=>{});customer.phone=phone}
        closeModal();toast('Order sent to the store');
        await loadAndRenderCustomerView(store,customer);
      }catch(error){button.disabled=false;toast(error.message||'Could not place order')}
    };
  });
}

window.addEventListener('hashchange',boot);
boot();
