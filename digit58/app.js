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
function toast(message){const target=$('#toast');if(!target)return alert(message);target.textContent=message;target.classList.add('show');setTimeout(()=>target.classList.remove('show'),2400)}

let session=null,view='dashboard';
let refreshView=()=>renderShell();
let state={activeStoreId:'',stores:[],customers:[],cards:[]};
function save(){try{localStorage.setItem('gravity58Digit58',JSON.stringify(state))}catch{}}
function load(){try{return {...state,...JSON.parse(localStorage.getItem('gravity58Digit58')||'{}')}}catch{return state}}
state=load();

function cloudOwnerId(){return session?.$id||''}
function activeStore(){return state.stores.find(row=>row.id===state.activeStoreId)||state.stores[0]||null}
function ownerCustomers(storeId=state.activeStoreId){return state.customers.filter(row=>row.storeId===storeId)}
function customerCards(customerAccountId,storeId=state.activeStoreId){return state.cards.filter(row=>row.storeId===storeId&&row.customerAccountId===customerAccountId)}
function isCardDue(card){return new Date(card.dueAt).getTime()<=Date.now()}
function daysRemaining(card){return Math.max(0,Math.ceil((new Date(card.dueAt).getTime()-Date.now())/86400000))}

async function boot(){
  if(!api?.configured)return renderConfigError();
  const hash=new URLSearchParams(location.hash.replace(/^#store&?/,''));
  if(location.hash.startsWith('#store&'))return renderPublicStore(hash);
  session=await api.currentUser().catch(()=>null);
  if(!session)return renderOwnerAuth();
  await loadOwnerData();
  renderShell();
}
function renderConfigError(){app.innerHTML=`<main class="screen"><section class="auth-card"><div class="brand"><div class="brand-mark">D</div><div><h2>Digit58</h2><p class="tagline">Take any store online</p></div></div><p>Digit58 is temporarily unavailable. Please try again shortly.</p></section></main>`}

function renderOwnerAuth(){
  app.innerHTML=`<main class="screen"><section class="auth-card">
    <div class="brand"><div class="brand-mark">D</div><div><h2>Digit58</h2><p class="tagline">Turn your store digital — orders, customers and reminders in one place.</p></div></div>
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
      await loadOwnerData();
      renderShell();
    }catch(error){button.disabled=false;toast(error.message||'Could not sign in')}
  };
}

async function loadOwnerData(){
  const ownerId=cloudOwnerId();if(!ownerId)return;
  const [stores,customers,cards]=await Promise.all([
    api.list(storeKind(ownerId)).catch(()=>[]),
    api.list(customerKind(ownerId)).catch(()=>[]),
    api.list(cardKind(ownerId)).catch(()=>[]),
  ]);
  state.stores=stores;state.customers=customers;state.cards=cards;
  if(!state.activeStoreId||!stores.some(row=>row.id===state.activeStoreId))state.activeStoreId=stores[0]?.id||'';
  save();
}

function renderShell(){
  const store=activeStore();
  app.innerHTML=`<div class="shell"><aside class="sidebar"><div class="brand"><div class="brand-mark">D</div><div><strong>Digit58</strong><small class="muted">Store workspace</small></div></div><nav class="nav">${navButton('dashboard','◉','Dashboard')}${navButton('stores','◫','My Stores')}${navButton('wall','☰','Customer Wall')}${navButton('settings','⚙','Settings')}<button id="logout">⇥ Logout</button></nav></aside><main class="main"><header class="topbar"><div>${state.stores.length?`<select id="storeSwitch">${state.stores.map(row=>`<option value="${html(row.id)}" ${row.id===state.activeStoreId?'selected':''}>${html(row.name)}</option>`).join('')}</select>`:'<strong>No store yet</strong>'}</div><span class="status-pill"><span class="dot"></span>${html(session?.email||'')}</span></header><section class="content" id="page"></section></main></div>`;
  $$('[data-view]').forEach(button=>button.onclick=()=>{view=button.dataset.view;renderShell()});
  $('#logout').onclick=async()=>{await api.logout();session=null;renderOwnerAuth()};
  $('#storeSwitch')?.addEventListener('change',event=>{state.activeStoreId=event.target.value;save();renderShell()});
  renderView();
}
function navButton(key,icon,label){return `<button data-view="${key}" class="${view===key?'active':''}"><span>${icon}</span>${label}</button>`}
function renderView(){if(!activeStore()&&view!=='stores'&&view!=='settings'){view='stores';return renderShell()}({dashboard:dashboardView,stores:storesView,wall:customerWallView,settings:settingsView}[view]||dashboardView)()}

function metric(title,value){return `<article class="card metric"><span>${html(title)}</span><strong>${value}</strong></article>`}
function dashboardView(){
  refreshView=dashboardView;
  const store=activeStore();
  const cards=state.cards.filter(row=>row.storeId===store?.id);
  const due=cards.filter(isCardDue).length;
  $('#page').innerHTML=`<div class="section-head"><div><h1>${html(store?.name||'Dashboard')}</h1><p class="muted">${html(store?.category||'')}${store?.city?' · '+html(store.city):''}</p></div></div><div class="grid stats">${metric('Customers',ownerCustomers(store?.id).length)}${metric('Active Cards',cards.length)}${metric('Due For Reminder',due)}${metric('Deliveries Made',cards.reduce((sum,row)=>sum+(Number(row.timesDelivered)||0),0))}</div><div class="section-head"><h2>Recent buy-again requests</h2></div><div class="card table-wrap">${buyRequestsTable(cards)}</div>`;
  bindBuyRequestActions();
}
function buyRequestsTable(cards){
  const requested=cards.filter(row=>row.status==='Buy Requested');
  if(!requested.length)return `<div class="empty">No pending requests.</div>`;
  return `<table><thead><tr><th>Customer</th><th>Item</th><th>Requested</th><th>Action</th></tr></thead><tbody>${requested.map(row=>{const customer=state.customers.find(c=>c.customerAccountId===row.customerAccountId&&c.storeId===row.storeId);return `<tr><td>${html(customer?.customerName||'Customer')}</td><td>${html(row.productName)} · ${money(row.price)}</td><td>${row.buyRequestedAt?new Date(row.buyRequestedAt).toLocaleString('en-IN',{dateStyle:'medium',timeStyle:'short'}):''}</td><td><button class="btn small green" data-deliver="${html(row.id)}">Mark Delivered</button></td></tr>`}).join('')}</tbody></table>`;
}
function bindBuyRequestActions(){$$('[data-deliver]').forEach(button=>button.onclick=()=>deliverCard(button.dataset.deliver))}

function storesView(){
  refreshView=storesView;
  $('#page').innerHTML=`<div class="section-head"><div><h1>My Stores</h1><p class="muted">Create a store, then share its customer link so people can sign up.</p></div><button class="btn" id="addStore">+ New Store</button></div><div class="grid store-grid">${state.stores.map(storeCard).join('')||'<div class="empty">No stores yet — create your first one.</div>'}</div>`;
  $('#addStore').onclick=()=>openStoreForm();
  $$('[data-share-store]').forEach(button=>button.onclick=()=>shareStoreModal(button.dataset.shareStore));
  $$('[data-edit-store]').forEach(button=>button.onclick=()=>openStoreForm(button.dataset.editStore));
}
function storeCard(store){
  const link=publicStoreLink(store);
  return `<article class="card"><h3>${html(store.name)}</h3><p class="muted">${html(store.category)}${store.city?' · '+html(store.city):''}</p><p>${html(store.description||'')}</p><div class="chips"><span class="chip">${ownerCustomers(store.id).length} customers</span></div><div class="actions"><button class="btn small" data-share-store="${html(store.id)}">Share Link / QR</button><button class="btn small secondary" data-edit-store="${html(store.id)}">Edit</button></div></article>`;
}
function publicStoreLink(store){return `${location.origin}${location.pathname.replace(/index\.html$/,'')}#store&owner=${encodeURIComponent(store.ownerId)}&store=${encodeURIComponent(store.id)}`}
function openStoreForm(storeId=''){
  const store=state.stores.find(row=>row.id===storeId)||{};
  modal(storeId?'Edit Store':'Create Store',`<form id="storeForm"><div class="field"><label>Store name</label><input name="name" value="${html(store.name||'')}" required></div><div class="form-grid"><div class="field"><label>Category</label><input name="category" value="${html(store.category||'')}" placeholder="Example: Pharmacy"></div><div class="field"><label>City</label><input name="city" value="${html(store.city||'')}"></div></div><div class="field"><label>Phone</label><input name="phone" value="${html(store.phone||'')}"></div><div class="field"><label>Description</label><textarea name="description">${html(store.description||'')}</textarea></div><button class="btn full">${storeId?'Save Store':'Create Store'}</button></form>`,()=>{
    $('#storeForm').onsubmit=async event=>{
      event.preventDefault();
      const values=Object.fromEntries(new FormData(event.target)),ownerId=cloudOwnerId(),button=event.submitter;
      button.disabled=true;
      try{
        if(storeId){
          await api.update(storeKind(ownerId),storeId,values);
          Object.assign(store,values);
          try{await api.update('digit58_owners',storeId,{storeName:values.name.trim(),category:values.category.trim()||'General store',city:values.city.trim()})}catch{}
        }else{
          const record={id:id('store'),ownerId,name:values.name.trim(),category:values.category.trim()||'General store',city:values.city.trim(),phone:values.phone.trim(),description:values.description.trim(),createdAt:now()};
          const permissions=api.permissionSet?.(storeKind(ownerId),ownerId);
          const created=await api.create(storeKind(ownerId),record,record.id,permissions);
          state.stores.push({...record,...created});
          state.activeStoreId=record.id;
          try{await api.create('digit58_owners',{ownerId,ownerEmail:session?.email||'',storeId:record.id,storeName:record.name,category:record.category,city:record.city,createdAt:record.createdAt},record.id,api.permissionSet?.('digit58_owners',ownerId,true))}catch{}
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
}
function customerCardMarkup(customer){
  const cards=customerCards(customer.customerAccountId,customer.storeId);
  const due=cards.filter(isCardDue).length;
  return `<article class="card"><h3>${html(customer.customerName||'Customer')}</h3><p class="muted">${html(customer.customerEmail||'')}${customer.phone?' · '+html(customer.phone):''}</p><div class="chips"><span class="chip">${cards.length} card(s)</span>${due?`<span class="chip due">${due} due</span>`:''}</div><button class="btn small full" data-open-customer="${html(customer.id)}">Open Customer Wall →</button></article>`;
}
function customerDetailView(customerId){
  refreshView=()=>customerDetailView(customerId);
  const customer=state.customers.find(row=>row.id===customerId);if(!customer)return;
  const cards=customerCards(customer.customerAccountId,customer.storeId);
  $('#page').innerHTML=`<div class="section-head"><div><h1>${html(customer.customerName||'Customer')}</h1><p class="muted">${html(customer.customerEmail||'')}</p></div><div class="actions"><button class="btn secondary" id="backToWall">← Back</button><button class="btn" id="addCard">+ Add Reminder Card</button></div></div><div class="grid card-grid">${cards.map(ownerCardMarkup).join('')||'<div class="empty">No cards yet for this customer.</div>'}</div>`;
  $('#backToWall').onclick=()=>{view='wall';renderShell()};
  $('#addCard').onclick=()=>openCardForm(customer);
  bindOwnerCardActions();
}
function ownerCardMarkup(card){
  const due=isCardDue(card),remaining=daysRemaining(card),pct=Math.min(100,Math.round((1-remaining/Math.max(1,Number(card.reminderDays)||1))*100));
  return `<article class="card reminder-card ${due||card.status==='Buy Requested'?'due':''}"><h3>${html(card.productName)}</h3><p class="muted">${money(card.price)} · every ${Number(card.reminderDays)} day(s)</p><div class="reminder-progress ${due?'due':''}"><span style="width:${pct}%"></span></div><div class="chips"><span class="chip ${due?'due':''}">${due?'Due now':`${remaining} day(s) left`}</span>${card.status==='Buy Requested'?'<span class="chip due">Buy requested</span>':''}${Number(card.timesDelivered)?`<span class="chip delivered">${Number(card.timesDelivered)} delivered</span>`:''}</div><div class="actions">${card.status==='Buy Requested'?`<button class="btn small green" data-deliver="${html(card.id)}">Mark Delivered</button>`:''}<button class="btn small secondary" data-edit-card="${html(card.id)}">Edit</button><button class="btn small red" data-remove-card="${html(card.id)}">Remove</button></div></article>`;
}
function bindOwnerCardActions(){
  $$('[data-deliver]').forEach(button=>button.onclick=()=>deliverCard(button.dataset.deliver));
  $$('[data-edit-card]').forEach(button=>button.onclick=()=>openCardForm(null,button.dataset.editCard));
  $$('[data-remove-card]').forEach(button=>button.onclick=()=>removeCard(button.dataset.removeCard));
}
function openCardForm(customer,cardId=''){
  const card=cardId?state.cards.find(row=>row.id===cardId):null;
  const owner=customer||state.customers.find(row=>row.customerAccountId===card?.customerAccountId&&row.storeId===card?.storeId);
  modal(cardId?'Edit Reminder Card':'Add Reminder Card',`<form id="cardForm"><div class="field"><label>Item / medicine name</label><input name="productName" value="${html(card?.productName||'')}" required></div><div class="form-grid"><div class="field"><label>Price (₹)</label><input name="price" type="number" min="0" step="0.01" value="${card?.price??''}" required></div><div class="field"><label>Remind every (days)</label><input name="reminderDays" type="number" min="1" step="1" value="${card?.reminderDays||30}" required></div></div><button class="btn full">${cardId?'Save Card':'Add Card'}</button></form>`,()=>{
    $('#cardForm').onsubmit=async event=>{
      event.preventDefault();
      const values=Object.fromEntries(new FormData(event.target)),ownerId=cloudOwnerId(),button=event.submitter;
      button.disabled=true;
      try{
        if(cardId){
          const changes={productName:values.productName.trim(),price:Number(values.price),reminderDays:Number(values.reminderDays)};
          await api.update(cardKind(ownerId),cardId,changes);
          Object.assign(card,changes);
        }else{
          const reminderDays=Math.max(1,Number(values.reminderDays)||30);
          const record={id:id('card'),ownerId,storeId:owner.storeId,customerAccountId:owner.customerAccountId,productName:values.productName.trim(),price:Number(values.price),reminderDays,purchasedAt:now(),dueAt:new Date(Date.now()+reminderDays*86400000).toISOString(),status:'Active',timesDelivered:0,buyRequestedAt:'',createdAt:now()};
          const permissions=api.userPermissionSet?.([ownerId,owner.customerAccountId]);
          const created=await api.create(cardKind(ownerId),record,record.id,permissions);
          state.cards.push({...record,...created});
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
    refreshView();
    toast('Marked delivered — reminder reset for next cycle');
  }catch(error){toast(error.message||'Could not update card')}
}
async function removeCard(cardId){
  const card=state.cards.find(row=>row.id===cardId);if(!card||!confirm('Remove this reminder card?'))return;
  try{
    await api.remove(cardKind(card.ownerId),cardId);
    state.cards=state.cards.filter(row=>row.id!==cardId);save();
    refreshView();toast('Card removed');
  }catch(error){toast(error.message||'Could not remove card')}
}

function settingsView(){
  $('#page').innerHTML=`<div class="section-head"><div><h1>Settings</h1><p class="muted">Signed in as ${html(session?.email||'')}</p></div></div><div class="card"><p class="muted">More store settings are coming soon. For now, manage your stores from the My Stores tab.</p></div>`;
}
function modal(title,body,ready){document.body.insertAdjacentHTML('beforeend',`<div class="modal-backdrop" id="modal"><section class="modal"><div class="section-head"><h2>${title}</h2><button class="btn small secondary" id="closeModal">✕</button></div>${body}</section></div>`);$('#closeModal').onclick=closeModal;ready?.()}
function closeModal(){$('#modal')?.remove()}

async function renderPublicStore(hashParams){
  const ownerId=hashParams.get('owner')||'',storeId=hashParams.get('store')||'';
  if(!ownerId||!storeId){app.innerHTML=`<main class="public-store"><div class="empty">This store link is invalid.</div></main>`;return}
  let store;
  try{store=await api.get(storeKind(ownerId),storeId)}
  catch{app.innerHTML=`<main class="public-store"><div class="empty">This store could not be found.</div></main>`;return}
  const account=await api.currentUser().catch(()=>null);
  if(!account)return renderCustomerAuth(store,ownerId,storeId);
  const customer=await ensureCustomerLink(ownerId,storeId,account);
  const cards=(await api.list(cardKind(ownerId)).catch(()=>[])).filter(row=>row.storeId===storeId&&row.customerAccountId===account.$id);
  renderCustomerCards(store,customer,cards);
}
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
  const kind=customerKind(ownerId);
  const rows=await api.list(kind).catch(()=>[]);
  const existing=rows.find(row=>row.storeId===storeId&&row.customerAccountId===account.$id);
  if(existing)return existing;
  const record={id:id('cust'),ownerId,storeId,customerAccountId:account.$id,customerName:account.name||account.email.split('@')[0],customerEmail:account.email,phone:'',createdAt:now()};
  const permissions=api.userPermissionSet?.([ownerId,account.$id]);
  return api.create(kind,record,record.id,permissions);
}
function renderCustomerCards(store,customer,cards){
  app.innerHTML=`<main class="public-store"><section class="store-hero"><span class="chip">${html(store.category||'Store')}</span><h1>${html(store.name)}</h1><p class="muted">${html(store.description||'')}${store.city?' · '+html(store.city):''}</p></section><div class="section-head"><h2>Your reminder cards</h2></div><div class="grid card-grid" id="customerCardGrid">${cards.map(customerCardCardMarkup).join('')||'<div class="empty">Your store will add reminder cards here after your first purchase.</div>'}</div><div class="actions" style="margin-top:20px"><button class="btn secondary" id="custLogout">Sign out</button></div></main>`;
  $$('[data-buy-again]').forEach(button=>button.onclick=()=>requestBuyAgain(button.dataset.buyAgain,store,customer));
  $('#custLogout').onclick=async()=>{await api.logout();location.hash=`store&owner=${encodeURIComponent(store.ownerId)}&store=${encodeURIComponent(store.id)}`;boot()};
}
function customerCardCardMarkup(card){
  const due=isCardDue(card),remaining=daysRemaining(card),pct=Math.min(100,Math.round((1-remaining/Math.max(1,Number(card.reminderDays)||1))*100));
  return `<article class="card reminder-card ${due?'due':''}"><h3>${html(card.productName)}</h3><p class="muted">${money(card.price)} · every ${Number(card.reminderDays)} day(s)</p><div class="reminder-progress ${due?'due':''}"><span style="width:${pct}%"></span></div><div class="chips"><span class="chip ${due?'due':''}">${due?'Due now':`${remaining} day(s) left`}</span>${card.status==='Buy Requested'?'<span class="chip due">Request sent</span>':''}</div>${due&&card.status!=='Buy Requested'?`<button class="btn full green" data-buy-again="${html(card.id)}">Buy Again</button>`:card.status==='Buy Requested'?'<p class="muted">Waiting for the store to confirm and deliver.</p>':''}</article>`;
}
async function requestBuyAgain(cardId,store,customer){
  try{
    await api.update(cardKind(store.ownerId),cardId,{status:'Buy Requested',buyRequestedAt:now()});
    toast('Request sent — the store will confirm and deliver soon');
    const cards=(await api.list(cardKind(store.ownerId)).catch(()=>[])).filter(row=>row.storeId===store.id&&row.customerAccountId===customer.customerAccountId);
    renderCustomerCards(store,customer,cards);
  }catch(error){toast(error.message||'Could not send request')}
}

boot();
