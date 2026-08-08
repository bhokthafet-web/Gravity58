const $ = (s, root=document) => root.querySelector(s);
const $$ = (s, root=document) => [...root.querySelectorAll(s)];
const uid = (p='id') => `${p}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2,7)}`;
const money = n => `₹${Number(n||0).toLocaleString('en-IN')}`;
const now = () => new Date().toISOString();
const app = $('#app');
const CONFIG = window.GRAVITY58_CONFIG || {demoMode:true,gravity58Url:'https://g58.in/'};

const seed = {
  users:[{id:'usr_demo',name:'Demo Owner',email:'demo@g58.in',password:'demo123'}],
  session:null, activeRestaurantId:'res_cafe',
  restaurants:[
    {id:'res_cafe',ownerId:'usr_demo',name:'Gravity58 Café',type:'Café',city:'Bengaluru',logo:'☕',open:true,accepting:true,tax:5,service:0,identification:'Table Number',social:{Instagram:'#',YouTube:'#'},description:'Coffee, snacks and quick meals.',address:'12 Central Avenue',phone:'+91 90000 10001',email:'cafe@example.com',paymentEnabled:true,upiId:'gravity58cafe@upi',paymentLink:'https://g58.in/'},
    {id:'res_family',ownerId:'usr_demo',name:'Gravity58 Family Restaurant',type:'Restaurant',city:'Hyderabad',logo:'🍽️',open:true,accepting:true,tax:5,service:2,identification:'Customer Name',social:{Instagram:'#',Facebook:'#'},description:'Comfort food for the whole family.',address:'45 Lake View Road',phone:'+91 90000 10002',email:'family@example.com',paymentEnabled:false,upiId:'',paymentLink:''},
    {id:'res_cloud',ownerId:'usr_demo',name:'Gravity58 Cloud Kitchen',type:'Cloud Kitchen',city:'Chennai',logo:'🥡',open:false,accepting:false,tax:5,service:0,identification:'Token Number',social:{WhatsApp:'#'},description:'Fast delivery kitchen.',address:'8 Market Street',phone:'+91 90000 10003',email:'cloud@example.com',paymentEnabled:false,upiId:'',paymentLink:''}
  ],
  categories:[
    {id:'cat1',restaurantId:'res_cafe',name:'Breakfast'},{id:'cat2',restaurantId:'res_cafe',name:'Beverages'},
    {id:'cat3',restaurantId:'res_family',name:'Starters'},{id:'cat4',restaurantId:'res_family',name:'Main Course'},
    {id:'cat5',restaurantId:'res_cloud',name:'Combos'}
  ],
  items:[
    {id:'i1',restaurantId:'res_cafe',categoryId:'cat1',name:'Masala Dosa',description:'Crispy dosa with potato masala',price:120,type:'Veg',emoji:'🥞',available:true,prep:15},
    {id:'i2',restaurantId:'res_cafe',categoryId:'cat1',name:'Paneer Sandwich',description:'Grilled paneer and vegetables',price:160,type:'Veg',emoji:'🥪',available:true,prep:12,prepareInstructionsEnabled:true},
    {id:'i3',restaurantId:'res_cafe',categoryId:'cat2',name:'Cold Coffee',description:'Creamy chilled coffee',price:140,type:'Veg',emoji:'🥤',available:true,prep:6},
    {id:'i4',restaurantId:'res_family',categoryId:'cat3',name:'Chicken 65',description:'Spicy crispy chicken',price:280,type:'Non-Veg',emoji:'🍗',available:true,prep:18},
    {id:'i5',restaurantId:'res_family',categoryId:'cat4',name:'Paneer Butter Masala',description:'Rich tomato and butter gravy',price:260,type:'Veg',emoji:'🍛',available:true,prep:20},
    {id:'i6',restaurantId:'res_family',categoryId:'cat4',name:'Chicken Biryani',description:'Aromatic basmati rice and chicken',price:340,type:'Non-Veg',emoji:'🍚',available:true,prep:25},
    {id:'i7',restaurantId:'res_cloud',categoryId:'cat5',name:'Family Combo',description:'Biryani, starter and beverage',price:699,type:'Non-Veg',emoji:'🥡',available:true,prep:30}
  ],
  locations:[{id:'t1',restaurantId:'res_cafe',type:'Table',name:'Table 1'},{id:'t2',restaurantId:'res_cafe',type:'Table',name:'Table 2'},{id:'f1',restaurantId:'res_family',type:'Table',name:'Family Table 1'}],
  advertisements:[
    {id:'ad_demo_1',restaurantKey:'Gravity58 Café|Bengaluru',title:'Weekend Breakfast Festival',description:'Fresh breakfast combos from 8 AM to 11 AM.',buttonLabel:'View Offer',destinationUrl:'#',active:true,image:'🍳',expiresAt:new Date(Date.now()+24*60*60*1000).toISOString()},
    {id:'ad_demo_2',restaurantKey:'Gravity58 Family Restaurant|Hyderabad',title:'Family Dining Special',description:'Celebrate together with our chef-selected family menu.',buttonLabel:'Know More',destinationUrl:'#',active:true,image:'🥘',expiresAt:new Date(Date.now()+48*60*60*1000).toISOString()}
  ],
  adRequests:[],
  orders:[
    {id:'GR58-1001',restaurantId:'res_cafe',customer:'Table 2',items:[{name:'Masala Dosa',qty:2,price:120},{name:'Cold Coffee',qty:1,price:140}],total:380,status:'Pending',createdAt:now()},
    {id:'GR58-1002',restaurantId:'res_family',customer:'Ravi',items:[{name:'Chicken Biryani',qty:1,price:340}],total:340,status:'Preparing',createdAt:now()}
  ]
};
let state = load();
if((state.orders||[]).some(order=>order.status==='Delivered')){
  state.orders.forEach(order=>{if(order.status==='Delivered')order.status='Completed'});
  save();
}
let view = 'dashboard';
let customerCart = [];
let customerContext = null;

function load(){try{const data=JSON.parse(localStorage.getItem('gravity58DigitalMenu'))||structuredClone(seed);data.advertisements ||= structuredClone(seed.advertisements);data.adRequests ||= [];data.restaurants=(data.restaurants||[]).map(r=>({...r,address:r.address||'',phone:r.phone||'',email:r.email||'',paymentEnabled:!!r.paymentEnabled,upiId:r.upiId||'',paymentLink:r.paymentLink||'',restaurantKey:`${r.name}|${r.city}`}));data.items=(data.items||[]).map(i=>({...i,prepareInstructionsEnabled:!!i.prepareInstructionsEnabled}));return data}catch{return structuredClone(seed)}}
function save(){localStorage.setItem('gravity58DigitalMenu',JSON.stringify(state))}
function toast(msg){const t=$('#toast');if(!t){console.warn(msg);return}t.textContent=msg;t.classList.add('show');setTimeout(()=>t.classList.remove('show'),2200)}
function ownerRestaurants(){if(!state.session)return state.restaurants;return state.restaurants.filter(r=>r.ownerId===state.session.userId)}
function activeRestaurant(){const owned=ownerRestaurants();const active=owned.find(r=>r.id===state.activeRestaurantId)||owned[0];if(active&&active.id!==state.activeRestaurantId)state.activeRestaurantId=active.id;return active}
function restaurantItems(id=state.activeRestaurantId){return state.items.filter(x=>x.restaurantId===id)}
function restaurantCategories(id=state.activeRestaurantId){return state.categories.filter(x=>x.restaurantId===id)}
function restaurantOrders(id=state.activeRestaurantId){return state.orders.filter(x=>x.restaurantId===id)}
async function hydrateAdvertisements(){
  if(!window.Gravity58Ads)return;
  try{
    const advertisements=await Gravity58Ads.list('advertisements');
    if(Gravity58Ads.configured||advertisements.length){state.advertisements=advertisements;save();render()}
  }catch(error){console.warn('Advertisement refresh failed',error)}
}

function render(){
  if(location.hash.startsWith('#menu')) return renderPublicMenu();
  if(location.hash.startsWith('#track')) return renderTrack();
  if(!state.session) return renderLogin();
  if(!ownerRestaurants().length) return renderOwnerOnboarding();
  renderShell();
}
function renderLogin(){app.innerHTML=`<main class="screen auth"><section class="auth-card glass"><a class="menu-home-link" href="../">← Gravity58 Home</a><div class="premium-menu-kicker">PREMIUM RESTAURANT EXPERIENCE</div><div class="brand"><div class="brand-mark">G</div><div><h2>Gravity58 Digital Menu</h2><p class="tagline">Scan. Order. Relax.</p></div></div><form id="loginForm"><div class="field"><label>User ID or Email</label><input name="email" value="demo@g58.in" required></div><div class="field"><label>Password</label><input name="password" type="password" value="demo123" required></div><button class="btn full">Login</button></form><div class="actions" style="justify-content:center;margin-top:12px"><button class="link-btn" id="newUser">New User</button><button class="link-btn" id="forgot">Forgot Password</button></div><p class="muted" style="text-align:center;margin-top:18px">Restaurant accounts and operational data remain in this browser.</p></section></main>`;
  $('#loginForm').onsubmit=e=>{e.preventDefault();const d=Object.fromEntries(new FormData(e.target));const u=state.users.find(x=>(x.email===d.email||x.id===d.email)&&x.password===d.password);if(!u)return toast('Invalid login');state.session={userId:u.id};save();render()};
  $('#newUser').onclick=()=>modal('Create Account',registerForm(),bindRegister);
  $('#forgot').onclick=()=>modal('Reset Local Password',`<p class="muted">This restaurant account exists only in this browser. Enter its email and choose a new password.</p><form id="forgotForm"><div class="field"><label>Email</label><input name="email" type="email" required></div><div class="field"><label>New password</label><input name="password" type="password" minlength="6" required></div><div class="field"><label>Confirm password</label><input name="confirm" type="password" minlength="6" required></div><button class="btn full">Reset Password</button></form>`,()=>{$('#forgotForm').onsubmit=e=>{e.preventDefault();const d=Object.fromEntries(new FormData(e.target)),u=state.users.find(x=>x.email.toLowerCase()===d.email.trim().toLowerCase());if(!u)return toast('No local account exists for this email');if(d.password.length<6)return toast('Use at least 6 characters');if(d.password!==d.confirm)return toast('Passwords do not match');u.password=d.password;save();closeModal();toast('Password reset on this browser')}});
}
function registerForm(){return `<form id="registerForm"><div class="form-grid"><div class="field"><label>Full name</label><input name="name" required></div><div class="field"><label>Email</label><input name="email" type="email" required></div><div class="field"><label>Mobile</label><input name="mobile"></div><div class="field"><label>City</label><input name="city"></div><div class="field"><label>Password</label><input name="password" type="password" required></div><div class="field"><label>Confirm password</label><input name="confirm" type="password" required></div></div><button class="btn full">Create Account</button></form>`}
function bindRegister(){$('#registerForm').onsubmit=e=>{e.preventDefault();const d=Object.fromEntries(new FormData(e.target));if(state.users.some(x=>x.email.toLowerCase()===d.email.trim().toLowerCase()))return toast('This email already has a local account');if(d.password.length<6)return toast('Use at least 6 characters');if(d.password!==d.confirm)return toast('Passwords do not match');const u={id:uid('usr'),name:d.name,email:d.email.trim().toLowerCase(),password:d.password,mobile:d.mobile,city:d.city};state.users.push(u);state.session={userId:u.id};save();closeModal();renderOwnerOnboarding()}}

function renderOwnerOnboarding(){app.innerHTML=`<main class="screen auth"><section class="auth-card glass"><a class="menu-home-link" href="../">← Gravity58 Home</a><div class="premium-menu-kicker">SET UP YOUR RESTAURANT</div><div class="brand"><div class="brand-mark">G</div><div><h2>Create your first Digital Menu</h2><p class="tagline">Restaurant data remains in this browser.</p></div></div><button class="btn full" id="createFirstRestaurant">Add Restaurant</button><button class="link-btn full" id="onboardingLogout">Logout</button></section></main>`;$('#createFirstRestaurant').onclick=()=>openRestaurantForm(true);$('#onboardingLogout').onclick=()=>{state.session=null;save();render()}}

function renderShell(){const r=activeRestaurant();if(!r)return renderOwnerOnboarding();app.innerHTML=`<div class="shell"><aside class="sidebar"><div class="brand"><div class="brand-mark">G</div><div><strong>Gravity58 Menu</strong><small class="muted">Restaurant workspace</small></div></div><nav class="nav">${navButton('dashboard','⌂','Dashboard')}${navButton('restaurants','◫','Restaurants')}${navButton('menu','☰','Menu Setup')}${navButton('orders','◉','Orders')}${navButton('qr','▦','QR Codes')}${navButton('reports','◒','Reports')}${navButton('settings','⚙','Settings')}<a class="owner-book-ad" href="${CONFIG.adBookingPortalUrl||'../advertise/'}?restaurant=${encodeURIComponent(`${r.name}|${r.city}`)}">✦ Book Ad Space</a><button id="logout">⇥ Logout</button></nav></aside><main class="main"><header class="topbar"><div class="restaurant-switch"><span>${r.logo}</span><select id="restaurantSelect">${ownerRestaurants().map(x=>`<option value="${x.id}" ${x.id===r.id?'selected':''}>${x.name}</option>`).join('')}</select><button class="btn small secondary" id="addRestaurant">+ Add</button></div><div class="user-label"><span class="status-pill"><span class="dot"></span> Browser-local data</span></div></header><section class="content" id="page"></section></main></div>`;
  $('#restaurantSelect').onchange=e=>{state.activeRestaurantId=e.target.value;save();renderShell()};
  $('#addRestaurant').onclick=()=>openRestaurantForm(false);
  $('#logout').onclick=()=>{state.session=null;save();render()};
  $$('.nav button[data-view]').forEach(b=>b.onclick=()=>{view=b.dataset.view;renderShell()});
  renderView();
}
function navButton(v,i,t){return `<button data-view="${v}" class="${view===v?'active':''}"><span>${i}</span>${t}</button>`}
function renderView(){({dashboard:dashboardView,restaurants:restaurantsView,menu:menuView,orders:ordersView,qr:qrView,reports:reportsView,settings:settingsView}[view]||dashboardView)()}
function dashboardView(){const r=activeRestaurant(),items=restaurantItems(),orders=restaurantOrders();$('#page').innerHTML=`<div class="hero"><div><span class="status-pill"><span class="dot"></span>${r.open?'Open':'Closed'}</span><h1 style="margin:12px 0 6px">${r.logo} ${r.name}</h1><p>${r.description||r.type+' in '+r.city}</p></div><div class="actions"><button class="btn secondary" id="previewMenu">Preview Menu</button><button class="btn violet" id="newOrder">Simulate Order</button></div></div><div class="grid stats">${metric('Categories',restaurantCategories().length)}${metric('Menu Items',items.length)}${metric('Pending Orders',orders.filter(x=>x.status==='Pending').length)}${metric('Today Revenue',money(orders.filter(x=>x.status==='Completed').reduce((a,b)=>a+b.total,0)))}</div><div class="section-head"><h2>Live Orders</h2><button class="btn small secondary" data-go="orders">View all</button></div><div class="grid order-grid">${orders.slice(0,3).map(orderCard).join('')||empty('No orders yet')}</div>`;
  $('#previewMenu').onclick=()=>{location.hash=`menu&restaurant=${r.id}`};$('#newOrder').onclick=simulateOrder;$('[data-go="orders"]').onclick=()=>{view='orders';renderShell()};bindOrderActions();}
function metric(label,value){return `<article class="card"><span class="muted">${label}</span><div class="metric">${value}</div></article>`}
function restaurantsView(){$('#page').innerHTML=`<div class="section-head"><div><h1>My Restaurants</h1><p class="muted">Every restaurant has independent menu, QR codes and orders.</p></div><button class="btn" id="createRestaurant">+ New Restaurant</button></div><div class="grid restaurant-grid">${ownerRestaurants().map(r=>`<article class="card restaurant-card"><div class="logo">${r.logo}</div><h3>${r.name}</h3><p class="muted">${r.type} · ${r.city}</p><div class="chips"><span class="chip">${restaurantItems(r.id).length} items</span><span class="chip">${restaurantOrders(r.id).length} orders</span><span class="chip">${r.open?'Open':'Closed'}</span></div><div class="actions"><button class="btn small" data-open="${r.id}">Open Dashboard</button><button class="btn small secondary" data-edit="${r.id}">Edit</button></div></article>`).join('')}</div>`;$('#createRestaurant').onclick=()=>openRestaurantForm(false);$$('[data-open]').forEach(b=>b.onclick=()=>{state.activeRestaurantId=b.dataset.open;view='dashboard';save();renderShell()});$$('[data-edit]').forEach(b=>b.onclick=()=>openRestaurantForm(false,b.dataset.edit))}
function restaurantForm(r={}){return `<form id="restaurantForm"><div class="form-grid"><div class="field"><label>Restaurant name</label><input name="name" value="${r.name||''}" required></div><div class="field"><label>Type</label><select name="type">${['Restaurant','Café','Bakery','Cloud Kitchen','Fast Food','Other'].map(x=>`<option ${r.type===x?'selected':''}>${x}</option>`).join('')}</select></div><div class="field"><label>City / Location</label><input name="city" value="${r.city||''}" required></div><div class="field"><label>Logo emoji</label><input name="logo" value="${r.logo||'🍽️'}"></div><div class="field"><label>Identification mode</label><select name="identification">${['Customer Name','Table Number','Counter Number','Token Number'].map(x=>`<option ${r.identification===x?'selected':''}>${x}</option>`).join('')}</select></div><div class="field"><label>Tax %</label><input name="tax" type="number" value="${r.tax??5}"></div></div><div class="form-grid"><div class="field"><label>Address</label><input name="address" value="${r.address||''}"></div><div class="field"><label>Phone</label><input name="phone" value="${r.phone||''}"></div><div class="field"><label>Email</label><input name="email" type="email" value="${r.email||''}"></div></div><div class="field"><label>Description</label><textarea name="description">${r.description||''}</textarea></div><button class="btn full">Save Restaurant</button></form>`}
function openRestaurantForm(first=false,id=null){const r=id?state.restaurants.find(x=>x.id===id):{};modal(id?'Edit Restaurant':first?'Create Your First Restaurant':'Add Restaurant',restaurantForm(r),()=>{$('#restaurantForm').onsubmit=async e=>{e.preventDefault();const d=Object.fromEntries(new FormData(e.target));let saved;if(id){Object.assign(r,d,{tax:+d.tax,restaurantKey:`${d.name}|${d.city}`});saved=r}else{saved={id:uid('res'),ownerId:state.session.userId,...d,restaurantKey:`${d.name}|${d.city}`,tax:+d.tax,service:0,open:true,accepting:true,social:{}};state.restaurants.push(saved);state.activeRestaurantId=saved.id}save();Gravity58Ads?.upsertSlot({id:saved.id,restaurantKey:saved.restaurantKey,name:saved.name,city:saved.city,active:true}).catch(()=>{});closeModal();renderShell();toast('Restaurant saved')}})}
function menuView(){const cats=restaurantCategories(),items=restaurantItems();$('#page').innerHTML=`<div class="section-head"><div><h1>Menu Setup</h1><p class="muted">Category-wise menu for ${activeRestaurant().name}</p></div><div class="actions"><button class="btn secondary" id="addCategory">+ Category</button><button class="btn" id="addItem">+ Menu Item</button></div></div><div class="toolbar"><input id="itemSearch" placeholder="Search menu items"><select id="catFilter"><option value="">All categories</option>${cats.map(c=>`<option value="${c.id}">${c.name}</option>`).join('')}</select></div><div class="grid menu-grid" id="menuGrid">${items.map(menuCard).join('')||empty('Create your first menu item')}</div>`;$('#addCategory').onclick=addCategory;$('#addItem').onclick=()=>openItemForm();$('#itemSearch').oninput=filterItems;$('#catFilter').onchange=filterItems;bindMenuActions()}
function menuCard(i){const c=state.categories.find(x=>x.id===i.categoryId);return `<article class="card menu-item" data-name="${i.name.toLowerCase()}" data-cat="${i.categoryId}"><span class="availability chip">${i.available?'Available':'Out of stock'}</span><div class="food-img">${i.emoji||'🍽️'}</div><div class="chips"><span class="chip">${c?.name||'Uncategorised'}</span><span class="chip">${i.type}</span></div><h3>${i.name}</h3><p class="muted">${i.description}</p>${i.prepareInstructionsEnabled?'<span class="chip instruction-enabled-chip">Preparation instructions enabled</span>':''}<div class="price">${money(i.price)}</div><div class="actions" style="margin-top:12px"><button class="btn small secondary" data-item-edit="${i.id}">Edit</button><button class="btn small ${i.available?'red':'green'}" data-stock="${i.id}">${i.available?'Out of stock':'Make available'}</button><button class="btn small red" data-item-delete="${i.id}">Delete</button></div></article>`}
function filterItems(){const q=$('#itemSearch').value.toLowerCase(),c=$('#catFilter').value;$$('#menuGrid .menu-item').forEach(x=>x.classList.toggle('hidden',!x.dataset.name.includes(q)||(c&&x.dataset.cat!==c)))}
function addCategory(){modal('Add Category',`<form id="categoryForm"><div class="field"><label>Category name</label><input name="name" required></div><button class="btn full">Create Category</button></form>`,()=>{$('#categoryForm').onsubmit=e=>{e.preventDefault();const d=Object.fromEntries(new FormData(e.target));state.categories.push({id:uid('cat'),restaurantId:state.activeRestaurantId,name:d.name});save();closeModal();menuView();toast('Category created')}})}
function itemForm(i={}){const cats=restaurantCategories();return `<form id="itemForm"><div class="form-grid"><div class="field"><label>Item name</label><input name="name" value="${i.name||''}" required></div><div class="field"><label>Category</label><select name="categoryId">${cats.map(c=>`<option value="${c.id}" ${i.categoryId===c.id?'selected':''}>${c.name}</option>`).join('')}</select></div><div class="field"><label>Price</label><input name="price" type="number" value="${i.price||''}" required></div><div class="field"><label>Food type</label><select name="type"><option ${i.type==='Veg'?'selected':''}>Veg</option><option ${i.type==='Non-Veg'?'selected':''}>Non-Veg</option></select></div><div class="field"><label>Emoji / icon</label><input name="emoji" value="${i.emoji||'🍽️'}"></div><div class="field"><label>Preparation minutes</label><input name="prep" type="number" value="${i.prep||15}"></div><div class="field"><label>Allow customer preparation instructions</label><select name="prepareInstructionsEnabled"><option value="true" ${i.prepareInstructionsEnabled?'selected':''}>Enabled</option><option value="false" ${!i.prepareInstructionsEnabled?'selected':''}>Disabled</option></select></div></div><div class="field"><label>Description</label><textarea name="description">${i.description||''}</textarea></div><button class="btn full">Save Menu Item</button></form>`}
function openItemForm(id=null){if(!restaurantCategories().length)return toast('Create a category first');const i=id?state.items.find(x=>x.id===id):{};modal(id?'Edit Menu Item':'Add Menu Item',itemForm(i),()=>{$('#itemForm').onsubmit=e=>{e.preventDefault();const d=Object.fromEntries(new FormData(e.target));if(id)Object.assign(i,d,{price:+d.price,prep:+d.prep,prepareInstructionsEnabled:d.prepareInstructionsEnabled==='true'});else state.items.push({id:uid('item'),restaurantId:state.activeRestaurantId,...d,price:+d.price,prep:+d.prep,prepareInstructionsEnabled:d.prepareInstructionsEnabled==='true',available:true});save();closeModal();menuView();toast('Menu item saved')}})}
function bindMenuActions(){$$('[data-item-edit]').forEach(b=>b.onclick=()=>openItemForm(b.dataset.itemEdit));$$('[data-stock]').forEach(b=>b.onclick=()=>{const i=state.items.find(x=>x.id===b.dataset.stock);i.available=!i.available;save();menuView()});$$('[data-item-delete]').forEach(b=>b.onclick=()=>{const i=state.items.find(x=>x.id===b.dataset.itemDelete);if(!i||!confirm(`Delete ${i.name} from this menu?`))return;state.items=state.items.filter(x=>x.id!==i.id);save();menuView();toast('Menu item deleted')})}
function ordersView(){const statuses=['All','Pending','Accepted','Preparing','Ready','Completed','Rejected'];$('#page').innerHTML=`<div class="section-head"><div><h1>Live Orders</h1><p class="muted">Restaurant-specific real-time order board</p></div><button class="btn" id="simulate">+ Simulate Customer Order</button></div><div class="tabs">${statuses.map((s,i)=>`<button class="btn small ${i?'secondary':''}" data-tab="${s}">${s}</button>`).join('')}</div><div class="grid order-grid" id="ordersGrid" style="margin-top:16px">${restaurantOrders().map(orderCard).join('')||empty('No orders yet')}</div>`;$('#simulate').onclick=simulateOrder;$$('[data-tab]').forEach(b=>b.onclick=()=>{$$('[data-tab]').forEach(x=>x.className='btn small secondary');b.className='btn small';const s=b.dataset.tab;$('#ordersGrid').innerHTML=restaurantOrders().filter(o=>s==='All'||o.status===s).map(orderCard).join('')||empty(`No ${s.toLowerCase()} orders`);bindOrderActions()});bindOrderActions()}
function orderCard(o){const identity=o.serviceMode==='table'?`Table ${o.tableNumber||'-'}`:'Single Counter';const pay=o.paymentMethod==='online'?`Online · ${o.transactionId||'No ID'}`:'Pay at counter';return `<article class="card order-card" data-status="${o.status}"><div class="section-head" style="margin:0 0 8px"><div><strong>${o.id}</strong><div class="muted">${o.customerName||o.customer||'Guest'} · ${identity}</div>${o.phone?`<small class="muted">☎ ${o.phone}</small>`:''}</div><span class="chip">${o.status}</span></div><div class="chips"><span class="chip">${pay}</span>${o.paymentStatus?`<span class="chip">${o.paymentStatus}</span>`:''}</div><div class="order-items">${o.items.map(i=>`<div class="staff-order-item"><strong>${i.qty} × ${i.name}</strong>${i.prepareInstruction?`<div class="staff-prep-note"><span>Preparation:</span> ${i.prepareInstruction}</div>`:''}</div>`).join('')}</div><h3 style="margin:12px 0">${money(o.total)}</h3><div class="actions">${orderActions(o)}</div></article>`}
function orderActions(o){const map={'Payment Verification':['Confirm Payment','Reject Payment'],Pending:['Accept','Reject'],Accepted:['Start Preparing'],Preparing:['Mark Ready'],Ready:['Complete']};return (map[o.status]||[]).map(a=>`<button class="btn small ${a==='Reject'?'red':['Start Preparing','Mark Ready','Complete'].includes(a)?'green':''}" data-order="${o.id}" data-action="${a}">${a}</button>`).join('')}
function bindOrderActions(){$$('[data-order]').forEach(b=>b.onclick=()=>updateOrder(b.dataset.order,b.dataset.action))}
function updateOrder(id,action){const o=state.orders.find(x=>x.id===id);const next={Accept:'Accepted',Reject:'Rejected','Confirm Payment':'Pending','Reject Payment':'Payment Rejected','Start Preparing':'Preparing','Mark Ready':'Ready',Complete:'Completed'}[action];if(!next)return;o.status=next;if(action==='Confirm Payment')o.paymentStatus='Confirmed';if(action==='Reject Payment')o.paymentStatus='Rejected';o.updatedAt=now();save();toast(action==='Mark Ready'?`Order ${o.id}: Food is ready`:`Order ${o.id}: ${next}`);view==='orders'?ordersView():dashboardView()}
function simulateOrder(){const items=restaurantItems().filter(x=>x.available);if(!items.length)return toast('No available menu items');const picked=items.slice(0,Math.min(2,items.length)).map((i,n)=>({name:i.name,qty:n+1,price:i.price}));state.orders.unshift({id:`GR58-${Math.floor(1000+Math.random()*8999)}`,restaurantId:state.activeRestaurantId,customer:activeRestaurant().identification==='Customer Name'?'Demo Customer':'Table 1',items:picked,total:picked.reduce((a,b)=>a+b.qty*b.price,0),status:'Pending',createdAt:now()});save();toast('New order received');view==='orders'?ordersView():dashboardView()}
function qrView(){const r=activeRestaurant(),url=`${location.href.split('#')[0]}#menu&restaurant=${r.id}`;$('#page').innerHTML=`<div class="section-head"><div><h1>QR Codes</h1><p class="muted">General restaurant menu QR code</p></div><button class="btn secondary" id="previewQr">Preview Menu</button></div><article class="card qr-card"><h2>${r.logo} ${r.name}</h2><p>Scan to View Menu</p><div class="qr-wrap"><div id="qrcode"></div></div><div class="actions" style="margin-top:18px"><button class="btn" id="copyQr">Copy Menu Link</button><button class="btn secondary" onclick="window.print()">Print</button></div><small class="muted" style="margin-top:16px">Powered by Gravity58 Digital Menu</small></article>`;try{new QRCode($('#qrcode'),{text:url,width:220,height:220})}catch{$('#qrcode').innerHTML='<div style="color:#111;padding:70px 25px">QR library requires internet once</div>'}$('#copyQr').onclick=()=>navigator.clipboard?.writeText(url).then(()=>toast('Menu link copied'));$('#previewQr').onclick=()=>location.hash=`menu&restaurant=${r.id}`}
function reportsView(){const orders=restaurantOrders(),sales=orders.filter(x=>x.status==='Completed').reduce((a,b)=>a+b.total,0);$('#page').innerHTML=`<div class="section-head"><div><h1>Reports</h1><p class="muted">Data for ${activeRestaurant().name} only</p></div></div><div class="grid stats">${metric('Total Orders',orders.length)}${metric('Completed',orders.filter(x=>x.status==='Completed').length)}${metric('Total Sales',money(sales))}${metric('Average Order',money(orders.length?orders.reduce((a,b)=>a+b.total,0)/orders.length:0))}</div><div class="section-head"><h2>All Restaurants Overview</h2></div><div class="grid restaurant-grid">${ownerRestaurants().map(r=>{const os=restaurantOrders(r.id);return `<article class="card"><h3>${r.logo} ${r.name}</h3><p class="muted">${os.length} orders · ${money(os.filter(x=>x.status==='Completed').reduce((a,b)=>a+b.total,0))} sales</p></article>`}).join('')}</div>`}
function adsView(){const key=`${activeRestaurant().name}|${activeRestaurant().city}`;const ads=(state.advertisements||[]).filter(a=>a.restaurantKey===key);const requests=state.adRequests||[];$('#page').innerHTML=`<div class="section-head"><div><h1>Gravity58 Advertisement Control</h1><p class="muted">Central ad control using unique restaurant key: <strong>${key}</strong></p></div><button class="btn" id="createAd">+ Create Advertisement</button></div><div class="grid stats">${metric('Active Ads',ads.filter(a=>a.active).length)}${metric('Restaurant Ads',ads.length)}${metric('Ad Enquiries',requests.length)}${metric('Pending Enquiries',requests.filter(x=>x.status!=='Contacted').length)}</div><div class="section-head"><h2>Advertisements for this restaurant</h2></div><div class="grid restaurant-grid">${ads.map(a=>`<article class="card"><div class="ad-icon">${a.image||'📣'}</div><h3>${a.title}</h3><p class="muted">${a.description}</p><div class="chips"><span class="chip">${a.active?'Enabled':'Disabled'}</span><span class="chip">${a.restaurantKey}</span></div><div class="actions"><button class="btn small" data-toggle-ad="${a.id}">${a.active?'Disable':'Enable'}</button><button class="btn small red" data-delete-ad="${a.id}">Delete</button></div></article>`).join('')||empty('No advertisement enabled. Customers will see the Ad Space placeholder.')}</div><div class="section-head"><h2>Ad-space enquiries</h2></div><div class="card table-wrap"><table><thead><tr><th>Name</th><th>Phone</th><th>Email</th><th>Restaurant</th><th>Status</th><th></th></tr></thead><tbody>${requests.map(q=>`<tr><td>${q.name}</td><td>${q.phone}</td><td>${q.email}</td><td>${q.restaurantKey}</td><td>${q.status||'New'}</td><td><button class="btn small secondary" data-contacted="${q.id}">Mark Contacted</button></td></tr>`).join('')||'<tr><td colspan="6" class="muted">No enquiries yet.</td></tr>'}</tbody></table></div>`;$('#createAd').onclick=()=>modal('Create G58 Advertisement',`<form id="adForm"><div class="field"><label>Restaurant key</label><input value="${key}" disabled></div><div class="field"><label>Title</label><input name="title" required></div><div class="field"><label>Description</label><textarea name="description" required></textarea></div><div class="form-grid"><div class="field"><label>Button label</label><input name="buttonLabel" value="View Offer"></div><div class="field"><label>Destination URL</label><input name="destinationUrl" value="#"></div><div class="field"><label>Icon / Emoji</label><input name="image" value="📣"></div><div class="field"><label>Status</label><select name="active"><option value="true">Enabled</option><option value="false">Disabled</option></select></div></div><button class="btn full">Save Advertisement</button></form>`,()=>{$('#adForm').onsubmit=e=>{e.preventDefault();const d=Object.fromEntries(new FormData(e.target));state.advertisements.push({id:uid('ad'),restaurantKey:key,...d,active:d.active==='true'});save();closeModal();adsView();toast('Advertisement saved')}});$$('[data-toggle-ad]').forEach(b=>b.onclick=()=>{const a=state.advertisements.find(x=>x.id===b.dataset.toggleAd);a.active=!a.active;save();adsView()});$$('[data-delete-ad]').forEach(b=>b.onclick=()=>{state.advertisements=state.advertisements.filter(x=>x.id!==b.dataset.deleteAd);save();adsView()});$$('[data-contacted]').forEach(b=>b.onclick=()=>{const q=state.adRequests.find(x=>x.id===b.dataset.contacted);q.status='Contacted';save();adsView()})}
function currentAdvertisement(r,slotId='right_rail'){const restaurantKey=`${r.name}|${r.city}`,ts=Date.now();return (state.advertisements||[]).filter(a=>a.restaurantKey===restaurantKey&&a.active&&(!a.slotId||a.slotId===slotId)&&(!a.expiresAt||new Date(a.expiresAt).getTime()>ts)).sort((a,b)=>new Date(b.activatedAt||b.createdAt||0)-new Date(a.activatedAt||a.createdAt||0))[0]}
function adTimeLeft(ad){if(!ad?.expiresAt)return 'Slot duration not set';const ms=new Date(ad.expiresAt).getTime()-Date.now();if(ms<=0)return 'Expired';const h=Math.floor(ms/36e5),m=Math.floor((ms%36e5)/6e4);return `${h}h ${m}m remaining`}
function publicAdSection(r){const slotId=location.hash.includes('track')?(location.hash.includes('Completed')?'thankyou':'preparing'):'right_rail';const ad=currentAdvertisement(r,slotId);if(ad)return `<section class="public-ad active-ad"><div class="ad-art">${ad.image||'📣'}</div><div><p class="eyebrow">SPONSORED PROMOTION</p><h3>${ad.title}</h3><p>${ad.description}</p><small class="ad-expiry" data-ad-expiry="${ad.expiresAt||''}">${adTimeLeft(ad)}</small></div><a class="btn" href="${ad.destinationUrl||'#'}" target="_blank">${ad.buttonLabel||'View Offer'}</a></section>`;return `<section class="public-ad ad-placeholder"><div class="ad-art">✦</div><div><p class="eyebrow">GRAVITY58 AD SPACE</p><h3>Your advertisement can appear here</h3><p>Book a restaurant-specific advertising slot through Gravity58.</p></div><button class="btn secondary" id="contactG58Ads">Contact Gravity58 for Ad Space</button></section>`}
function bindPublicAdContact(r){const b=$('#contactG58Ads');if(!b)return;b.onclick=()=>{const base=CONFIG.adBookingPortalUrl||'../advertise/';location.href=`${base}?restaurant=${encodeURIComponent(`${r.name}|${r.city}`)}`}}
function settingsView(){const r=activeRestaurant();$('#page').innerHTML=`<div class="section-head"><div><h1>Restaurant Settings</h1><p class="muted">Settings apply only to ${r.name}</p></div></div><article class="card"><form id="settingsForm"><div class="form-grid"><div class="field"><label>Restaurant status</label><select name="open"><option value="true" ${r.open?'selected':''}>Open</option><option value="false" ${!r.open?'selected':''}>Closed</option></select></div><div class="field"><label>Accept orders</label><select name="accepting"><option value="true" ${r.accepting?'selected':''}>Yes</option><option value="false" ${!r.accepting?'selected':''}>No</option></select></div><div class="field"><label>Tax %</label><input name="tax" type="number" value="${r.tax||0}"></div><div class="field"><label>Service charge %</label><input name="service" type="number" value="${r.service||0}"></div><div class="field"><label>Enable customer payment</label><select name="paymentEnabled"><option value="true" ${r.paymentEnabled?'selected':''}>Enabled</option><option value="false" ${!r.paymentEnabled?'selected':''}>Disabled</option></select></div><div class="field"><label>UPI ID</label><input name="upiId" value="${r.upiId||''}" placeholder="restaurant@upi"></div><div class="field"><label>Payment link (optional)</label><input name="paymentLink" value="${r.paymentLink||''}" placeholder="https://..."></div><div class="field"><label>Instagram URL</label><input name="instagram" value="${r.social?.Instagram||''}"></div><div class="field"><label>WhatsApp URL</label><input name="whatsapp" value="${r.social?.WhatsApp||''}"></div></div><p class="muted">Online payments remain unconfirmed until staff verify the customer transaction ID.</p><button class="btn">Save Settings</button><button type="button" class="btn red" id="resetDemo">Reset Demo Data</button></form></article>`;$('#settingsForm').onsubmit=e=>{e.preventDefault();const d=Object.fromEntries(new FormData(e.target));Object.assign(r,{open:d.open==='true',accepting:d.accepting==='true',tax:+d.tax,service:+d.service,paymentEnabled:d.paymentEnabled==='true',upiId:d.upiId,paymentLink:d.paymentLink,social:{...r.social,Instagram:d.instagram,WhatsApp:d.whatsapp}});save();toast('Settings saved');renderShell()};$('#resetDemo').onclick=()=>{if(confirm('Reset all demo data?')){state=structuredClone(seed);save();render()}}}

function renderPublicMenu(){
  const params=new URLSearchParams(location.hash.replace('#menu&',''));
  const rid=params.get('restaurant')||state.activeRestaurantId;
  const r=state.restaurants.find(x=>x.id===rid);
  if(!r){app.innerHTML=`<main class="public-menu"><div class="empty">Restaurant not found</div></main>`;return}
  customerContext=JSON.parse(sessionStorage.getItem(`gravity58Customer_${rid}`)||'null');
  if(!customerContext){
    modal('Welcome to '+r.name,`<form id="identityForm" class="customer-entry-form"><div class="field centered-field"><label>Customer name <small id="nameRequirement">(required for counter orders)</small></label><input name="customerName" required placeholder="Enter your name"></div><div class="service-choice"><label class="choice-card"><input type="radio" name="serviceMode" value="counter" checked><span><strong>Single Counter</strong><small>Collect from the service counter</small></span></label><label class="choice-card"><input type="radio" name="serviceMode" value="table"><span><strong>Enter Table Number</strong><small>Order for your table</small></span></label></div><div class="field" id="tableNumberField" hidden><label>Table number</label><input name="tableNumber" placeholder="Example: 12"></div><div class="field"><label>Phone number <small>(optional)</small></label><input name="phone" type="tel" placeholder="Optional contact number"></div><button class="btn full">Continue to Menu</button></form>`,()=>{const form=$('#identityForm'),tableField=$('#tableNumberField'),nameNote=$('#nameRequirement');const syncIdentity=()=>{const table=form.serviceMode.value==='table';tableField.hidden=!table;form.tableNumber.required=table;form.customerName.required=!table;nameNote.textContent=table?'(optional for table orders)':'(required for counter orders)';form.customerName.placeholder=table?'Optional customer name':'Enter your name'};$$('input[name="serviceMode"]',form).forEach(x=>x.onchange=syncIdentity);syncIdentity();form.onsubmit=e=>{e.preventDefault();const d=Object.fromEntries(new FormData(e.target));const customerName=(d.customerName||'').trim();const tableNumber=(d.tableNumber||'').trim();if(d.serviceMode==='counter'&&!customerName)return toast('Enter customer name for counter order');if(d.serviceMode==='table'&&!tableNumber)return toast('Enter table number');customerContext={restaurantId:rid,customerName,serviceMode:d.serviceMode,tableNumber:d.serviceMode==='table'?tableNumber:'',phone:(d.phone||'').trim(),customer:d.serviceMode==='table'?`${customerName?customerName+' · ':''}Table ${tableNumber}`:customerName};sessionStorage.setItem(`gravity58Customer_${rid}`,JSON.stringify(customerContext));closeModal();renderPublicMenu()}})
  }
  const cats=restaurantCategories(rid),items=restaurantItems(rid),heroItem=items.find(i=>i.available)||items[0];
  const activeCat=sessionStorage.getItem(`gravity58Category_${rid}`)||cats[0]?.id;
  const activeCategory=cats.find(c=>c.id===activeCat)||cats[0];
  const ad=currentAdvertisement(r);
  app.innerHTML=`<main class="public-menu compact-public-menu">
    <section class="compact-menu-hero">
      <nav class="menu-nav compact-nav"><div><h2>${r.name}</h2><p>${r.type} · ${r.city}</p></div><a class="sponsor-mini" href="https://www.g58.in" target="_blank" rel="noopener">Sponsored by <strong>Gravity58</strong></a></nav>
      <div class="compact-hero-layout"><div><p class="eyebrow">WELCOME TO ${r.name.toUpperCase()}</p><h1>Delicious Food<br>Is Waiting For You</h1><p>${r.description}</p><div class="compact-details"><span>📍 ${r.address||r.city}</span><span>☎ ${r.phone||'Contact restaurant'}</span><span class="open-tag">${r.open?'Open now':'Closed'}</span></div></div><div class="compact-hero-dish">${heroItem?.emoji||r.logo}</div></div>
    </section>
    <section class="menu-workspace" id="menu-list">
      <aside class="category-wheel-zone" aria-label="Menu categories">
        <div class="wheel-zone-title">Rotate for Category</div>
        <div class="wheel-pointer">▶</div>
        <div class="category-wheel" id="categoryWheel" data-count="${cats.length}">
          ${cats.map((c,i)=>`<button class="wheel-category ${c.id===activeCategory?.id?'active':''}" data-cat-select="${c.id}" style="--i:${i};--count:${Math.max(cats.length,1)}"><span>${c.name}</span></button>`).join('')}
        </div>
      </aside>
      <section class="focused-menu-panel">
        <header class="focused-menu-heading"><div><p class="eyebrow">FOOD MENU</p><h2>${activeCategory?.name||'Menu'}</h2></div><span>${items.filter(i=>i.categoryId===activeCategory?.id).length} items</span></header>
        <div class="poster-menu-list">${items.filter(i=>i.categoryId===activeCategory?.id).map(publicItem).join('')||'<div class="empty">No items in this category.</div>'}</div>
      </section>
      <aside class="vertical-ad-rail">
        <button class="ad-space-contact" id="contactG58Ads" type="button">Contact Gravity58 for Ad Space</button>
        ${ad?`<a class="vertical-active-ad" href="${ad.destinationUrl||'#'}" target="_blank"><span class="ad-label">SPONSORED</span><div class="vertical-ad-art">${ad.image||'📣'}</div><h3>${ad.title}</h3><p>${ad.description}</p><strong>${ad.buttonLabel||'View Offer'} →</strong><small class="ad-expiry" data-ad-expiry="${ad.expiresAt||''}">${adTimeLeft(ad)}</small></a>`:`<div class="vertical-ad-placeholder"><span class="ad-label">GRAVITY58 AD SPACE</span><div class="vertical-ad-art">✦</div><h3>Advertise here</h3><p>Choose a slot, select hours and request activation from the Gravity58 team.</p><span class="ad-booking-note">Select the button above to book this space.</span></div>`}
      </aside>
    </section>
    <div class="cart-bar compact-cart"><span><span id="cartCount">${customerCart.reduce((a,b)=>a+b.qty,0)}</span> items · <span id="cartTotal">${money(customerCart.reduce((a,b)=>a+b.qty*b.price,0))}</span></span><button class="btn" id="openCart">View Cart</button></div>
  </main>`;
  $$('[data-cat-select]').forEach(b=>b.onclick=()=>selectPublicCategory(rid,b.dataset.catSelect));
  $$('[data-qty-action]').forEach(b=>b.onclick=()=>changeCartQuantity(b.dataset.item,b.dataset.qtyAction));$$('[data-prepare-item]').forEach(c=>c.onchange=()=>{if(c.checked)openPreparationInstructions(c.dataset.prepareItem);else{const ci=customerCart.find(x=>x.id===c.dataset.prepareItem);if(ci){ci.prepareInstruction='';ci.prepareOptions=[];ci.customPrepareNote=''}renderPublicMenu()}});
  $('#openCart').onclick=()=>openCart(r);
  bindCategoryWheel(rid,cats,activeCategory?.id);
  bindPublicAdContact(r)
}
function selectPublicCategory(rid,catId){sessionStorage.setItem(`gravity58Category_${rid}`,catId);renderPublicMenu()}
function bindCategoryWheel(rid,cats,activeId){
  const wheel=$('#categoryWheel'); if(!wheel||!cats.length)return;
  const step=360/Math.max(cats.length,1);
  let activeIndex=Math.max(0,cats.findIndex(c=>c.id===(sessionStorage.getItem(`gravity58Category_${rid}`)||activeId)));
  let angle=90-activeIndex*step;
  let startY=0,startAngle=angle,lastY=0,lastTime=0,velocity=0,dragging=false,raf=0,lastPreview=activeIndex;
  const normalizeIndex=value=>((Math.round((90-value)/step)%cats.length)+cats.length)%cats.length;
  const markPointed=value=>{
    const index=normalizeIndex(value);
    if(index===lastPreview)return;
    lastPreview=index;
    $$('.wheel-category',wheel).forEach((el,i)=>el.classList.toggle('active',i===index));
    const heading=$('.focused-menu-heading h2'); if(heading) heading.textContent=cats[index].name;
  };
  const paint=(value,animate=false)=>{angle=value;wheel.style.transition=animate?'transform .5s cubic-bezier(.18,.82,.22,1)':'none';wheel.style.transform=`translateY(-50%) rotate(${angle}deg)`;$$('.wheel-category span',wheel).forEach(el=>el.style.transform=`rotate(${-angle}deg)`);markPointed(angle)};
  const nearest=()=>{
    activeIndex=normalizeIndex(angle);
    angle=90-activeIndex*step;
    paint(angle,true);
    sessionStorage.setItem(`gravity58Category_${rid}`,cats[activeIndex].id);
    setTimeout(renderPublicMenu,510);
  };
  const begin=y=>{cancelAnimationFrame(raf);dragging=true;startY=lastY=y;startAngle=angle;lastTime=performance.now();velocity=0;wheel.classList.add('dragging');wheel.style.transition='none'};
  const move=y=>{if(!dragging)return;const now=performance.now(),dy=y-lastY,dt=Math.max(8,now-lastTime);velocity=dy/dt;lastY=y;lastTime=now;paint(startAngle+(y-startY)*.48)};
  const finish=()=>{if(!dragging)return;dragging=false;wheel.classList.remove('dragging');let momentum=velocity*155;const glide=()=>{momentum*=.9;angle+=momentum;paint(angle);if(Math.abs(momentum)>.16)raf=requestAnimationFrame(glide);else nearest()};glide()};
  paint(angle);
  wheel.addEventListener('pointerdown',e=>{wheel.setPointerCapture?.(e.pointerId);begin(e.clientY)});
  wheel.addEventListener('pointermove',e=>move(e.clientY));
  wheel.addEventListener('pointerup',finish);wheel.addEventListener('pointercancel',finish);
  wheel.addEventListener('wheel',e=>{e.preventDefault();angle+=e.deltaY*.1;paint(angle);clearTimeout(wheel._snap);wheel._snap=setTimeout(nearest,140)},{passive:false});
}
function publicItem(i){
  const cartItem=customerCart.find(x=>x.id===i.id),qty=cartItem?.qty||0;
  const instruction=cartItem?.prepareInstruction||'';
  return `<article class="poster-menu-item ${!i.available?'sold-out':''}"><div class="poster-food-thumb">${i.emoji}</div><div class="poster-item-copy"><div class="poster-title-row"><h3>${i.name}</h3><span class="dot-leader"></span><strong>${money(i.price)}</strong></div><p>${i.description}</p>${i.prepareInstructionsEnabled?`<label class="prepare-instruction-trigger"><input type="checkbox" data-prepare-item="${i.id}" ${instruction?'checked':''}><span>Prepare instructions</span></label>${instruction?`<div class="saved-prep-instruction">${instruction}</div>`:''}`:''}<div class="poster-meta"><span class="food-dot ${i.type==='Veg'?'veg':'nonveg'}"></span><span>${i.type}</span><span>•</span><span>${i.prep} min</span></div></div><div class="poster-action">${i.available?(qty?`<div class="quantity-control"><button data-qty-action="minus" data-item="${i.id}" aria-label="Remove one">−</button><strong>${qty}</strong><button data-qty-action="plus" data-item="${i.id}" aria-label="Add one">+</button></div>`:`<button class="btn small add-item" data-qty-action="plus" data-item="${i.id}">Add</button>`):'<span class="out-label">Out</span>'}</div></article>`
}
function openPreparationInstructions(itemId){
  const item=state.items.find(x=>x.id===itemId); if(!item) return;
  let cartItem=customerCart.find(x=>x.id===itemId);
  if(!cartItem){ customerCart.push({...item,qty:1}); cartItem=customerCart.find(x=>x.id===itemId); }
  const current=cartItem.prepareInstruction||'';
  const selected=new Set((cartItem.prepareOptions||[]));
  const options=['Less spicy','Medium spicy','Extra spicy','No onion','No garlic','Less oil','Well cooked'];
  modal('Prepare '+item.name,`<form id="prepareInstructionForm" class="prepare-instruction-form"><p class="muted">Choose quick instructions or add your own note for the kitchen.</p><div class="prep-option-grid">${options.map(o=>`<label class="prep-option"><input type="checkbox" name="prepOption" value="${o}" ${selected.has(o)?'checked':''}><span>${o}</span></label>`).join('')}</div><div class="field"><label>Additional preparation note</label><textarea name="customNote" maxlength="250" placeholder="Example: Make it less salty and serve sauce separately">${cartItem.customPrepareNote||''}</textarea></div><button class="btn full">Save Instructions</button></form>`,()=>{$('#prepareInstructionForm').onsubmit=e=>{e.preventDefault();const fd=new FormData(e.target);const opts=fd.getAll('prepOption');const note=(fd.get('customNote')||'').trim();cartItem.prepareOptions=opts;cartItem.customPrepareNote=note;cartItem.prepareInstruction=[...opts,note].filter(Boolean).join(' · ');closeModal();renderPublicMenu();toast('Preparation instructions saved')}})
}

function changeCartQuantity(id,action){const item=state.items.find(x=>x.id===id);if(!item||!item.available)return;const existing=customerCart.find(x=>x.id===id);if(action==='plus'){existing?existing.qty++:customerCart.push({...item,qty:1})}else if(existing){existing.qty--;if(existing.qty<=0)customerCart=customerCart.filter(x=>x.id!==id)}renderPublicMenu()}
function openCart(r){
  if(!customerCart.length){ toast('Cart is empty'); return; }
  if(!customerContext){ toast('Customer details are missing. Reopen the menu.'); return; }

  const sub=customerCart.reduce((a,b)=>a+b.qty*b.price,0);
  const tax=sub*(Number(r.tax)||0)/100;
  const service=sub*(Number(r.service)||0)/100;
  const total=Math.round(sub+tax+service);
  const orderId=`GR58-${Date.now().toString().slice(-7)}-${Math.floor(10+Math.random()*89)}`;
  const upiUri=r.upiId ? `upi://pay?pa=${encodeURIComponent(r.upiId)}&pn=${encodeURIComponent(r.name)}&am=${total.toFixed(2)}&cu=INR&tn=${encodeURIComponent('Order '+orderId)}` : '';

  modal('Your Cart',`<div id="checkoutPanel">
    <div>${customerCart.map(i=>`<div class="section-head"><span>${i.qty} × ${i.name}</span><strong>${money(i.qty*i.price)}</strong></div>`).join('')}</div>
    <hr style="border-color:var(--line)">
    <div class="section-head"><span>Subtotal</span><strong>${money(sub)}</strong></div>
    <div class="section-head"><span>Tax</span><strong>${money(tax)}</strong></div>
    <div class="section-head"><span>Service charge</span><strong>${money(service)}</strong></div>
    <div class="section-head"><h3>Grand Total</h3><h3>${money(total)}</h3></div>
    ${r.paymentEnabled?`<div class="payment-panel"><h3>Payment option</h3>
      <label class="choice-card"><input type="radio" name="paymentMethod" value="counter" checked><span><strong>Pay at Counter</strong><small>Pay when your order is served</small></span></label>
      <label class="choice-card"><input type="radio" name="paymentMethod" value="online"><span><strong>Pay Online</strong><small>${r.upiId?`Pay ${money(total)} to ${r.upiId}`:'Restaurant UPI ID is not configured'}</small></span></label>
      <div id="onlinePaymentFields" hidden>
        <div class="upi-payment-box"><div id="amountQr"></div><div><strong>Scan to pay ${money(total)}</strong><p class="muted">UPI ID: ${r.upiId||'Not configured'}</p>${upiUri?`<a class="btn secondary small" href="${upiUri}">Open UPI App</a>`:''}</div></div>
        <div class="field"><label>Transaction ID</label><input id="transactionId" autocomplete="off" placeholder="Enter UPI transaction ID after payment"></div>
        <p class="muted">Restaurant staff must confirm payment before accepting the order.</p>
      </div>
    </div>`:''}
    <p id="checkoutError" class="checkout-error" hidden></p>
    <button class="btn full" id="confirmPlaceOrder" type="button">Place Order</button>
  </div>`,()=>{
    const panel=$('#checkoutPanel');
    const button=$('#confirmPlaceOrder');
    const errorBox=$('#checkoutError');
    const online=$('#onlinePaymentFields');
    let qrMade=false;

    const fail=message=>{
      if(errorBox){ errorBox.textContent=message; errorBox.hidden=false; }
      toast(message);
    };
    const selectedPayment=()=> $('input[name="paymentMethod"]:checked',panel)?.value || 'counter';
    const showPayment=()=>{
      const isOnline=selectedPayment()==='online';
      if(online) online.hidden=!isOnline;
      if(isOnline&&!qrMade&&upiUri&&window.QRCode&&$('#amountQr')){
        try{
          new QRCode($('#amountQr'),{text:upiUri,width:170,height:170,colorDark:'#24170f',colorLight:'#fffaf0'});
          qrMade=true;
        }catch(err){ console.warn('QR generation unavailable',err); }
      }
    };
    $$('input[name="paymentMethod"]',panel).forEach(input=>input.addEventListener('change',showPayment));
    showPayment();

    button.addEventListener('click',()=>{
      if(button.dataset.busy==='1') return;
      if(errorBox) errorBox.hidden=true;
      const paymentMethod=r.paymentEnabled?selectedPayment():'counter';
      const transactionId=($('#transactionId',panel)?.value||'').trim();
      if(paymentMethod==='online'&&!r.upiId) return fail('Restaurant UPI ID is not configured.');
      if(paymentMethod==='online'&&!transactionId) return fail('Enter the transaction ID after payment.');
      if(!customerCart.length) return fail('Your cart is empty.');

      button.dataset.busy='1';
      button.disabled=true;
      button.textContent='Placing Order…';
      try{
        const status=paymentMethod==='online'?'Payment Verification':'Pending';
        const identity=customerContext.serviceMode==='table'
          ? `${customerContext.customerName?customerContext.customerName+' · ':''}Table ${customerContext.tableNumber}`
          : customerContext.customerName;
        const order={
          id:orderId,restaurantId:r.id,customer:identity||'Guest',
          customerName:customerContext.customerName||'',serviceMode:customerContext.serviceMode,
          tableNumber:customerContext.tableNumber||'',phone:customerContext.phone||'',
          items:customerCart.map(i=>({id:i.id,name:i.name,qty:i.qty,price:i.price,prepareInstruction:i.prepareInstruction||'',prepareOptions:i.prepareOptions||[],customPrepareNote:i.customPrepareNote||''})),
          subtotal:sub,tax,serviceCharge:service,total,paymentMethod,
          upiId:paymentMethod==='online'?r.upiId:'',upiUri:paymentMethod==='online'?upiUri:'',
          transactionId,paymentStatus:paymentMethod==='online'?'Awaiting confirmation':'Not required',
          status,createdAt:now()
        };
        state.orders=Array.isArray(state.orders)?state.orders:[];
        state.orders.unshift(order);
        save();
        const verify=JSON.parse(localStorage.getItem('gravity58DigitalMenu')||'{}');
        if(!verify.orders?.some(x=>x.id===order.id)) throw new Error('Order was not saved');
        customerCart=[];
        sessionStorage.removeItem(`gravity58Cart_${r.id}`);
        closeModal();
        location.hash=`track&order=${encodeURIComponent(order.id)}`;
        renderTrack();
      }catch(err){
        console.error('Place order failed',err);
        button.dataset.busy='0';button.disabled=false;button.textContent='Place Order';
        fail('Order could not be saved. Please allow browser storage and try again.');
      }
    });
  });
}

function renderTrack(){const params=new URLSearchParams(location.hash.replace('#track&',''));const id=params.get('order'),o=state.orders.find(x=>x.id===id);if(!o){app.innerHTML=`<main class="public-menu"><div class="empty">Order not found</div></main>`;return}const r=state.restaurants.find(x=>x.id===o.restaurantId),stage={'Payment Verification':5,'Payment Rejected':100,Pending:8,Accepted:25,Preparing:55,Ready:85,Delivered:94,Completed:100,Rejected:100}[o.status]||8;let content;if(o.status==='Completed')content=`<section class="card thankyou"><h1>Thank You!</h1><h2>${r.logo} ${r.name}</h2><p class="muted">We hope you enjoyed your experience.</p><div class="chips" style="justify-content:center"><span class="chip">Order ${o.id}</span><span class="chip">${o.customer}</span></div><div class="grid restaurant-grid" style="margin-top:24px"><article class="card"><h3>Restaurant</h3><p class="muted">Follow ${r.name} and leave your feedback.</p></article><article class="card"><h3>Discover More with Gravity58</h3><p class="muted">Explore local businesses and useful digital tools.</p><a class="btn" href="${CONFIG.gravity58Url}" target="_blank">Explore Gravity58</a></article><article class="card"><h3>Featured</h3><p class="muted">Advertisement space for restaurant or Gravity58 promotions.</p></article></div></section>`;else content=`<section class="card" style="text-align:center"><span class="status-pill"><span class="dot"></span>${o.status}</span><h1 style="margin:18px 0 6px">${o.status==='Ready'?'Your Food Is Ready!':o.status==='Payment Verification'?'Verifying Your Payment':o.status==='Payment Rejected'?'Payment Could Not Be Confirmed':o.status==='Rejected'?'Order Rejected':'Your Food Is Being Prepared'}</h1><div class="track-message ${o.status==='Ready'?'ready-message':''}">${o.status==='Ready'?'<strong>Your order will be served soon</strong><span>Please stay at your table or near the service counter. Our team will bring your food shortly.</span>':o.status==='Payment Verification'?'Restaurant staff are checking transaction '+(o.transactionId||''):'Order '+o.id+' · '+o.customer}</div>${['Accepted','Preparing'].includes(o.status)?`<div class="pot-scene"><div><div class="steam"><span></span><span></span><span></span></div><div class="pot"></div></div></div>`:''}<div class="progress"><span style="width:${stage}%"></span></div><div class="chips" style="justify-content:center;margin-top:18px">${o.items.map(i=>`<span class="chip">${i.qty} × ${i.name}${i.prepareInstruction?' · '+i.prepareInstruction:''}</span>`).join('')}</div><div class="section-head"><span>Total</span><strong>${money(o.total)}</strong></div><section class="social-discovery"><div class="social-discovery-copy"><span class="eyebrow">Restaurant profile</span><h2>Take a look at how we specialise</h2><p>Explore ${r.name} beyond today’s order. See our food creations, kitchen moments, new dishes and restaurant updates.</p></div><div class="social-profile-grid">${Object.entries(r.social||{}).filter(([,u])=>u).map(([p,u])=>{const key=p.toLowerCase();const icon=key==='instagram'?'◎':key==='youtube'?'▶':key==='facebook'?'f':key==='whatsapp'?'◉':'↗';const desc=key==='instagram'?'View our restaurant profile, food photos, reels and latest specials.':key==='youtube'?'Watch our kitchen stories, signature dishes and restaurant videos.':key==='facebook'?'Visit our restaurant page for updates, offers and community posts.':key==='whatsapp'?'Connect with the restaurant team on WhatsApp.':'Open our restaurant profile and discover more.';return `<a class="social-profile-card ${key}" href="${u}" target="_blank" rel="noopener"><span class="social-profile-icon">${icon}</span><span class="social-profile-text"><strong>${p}</strong><small>${desc}</small><b>View restaurant profile →</b></span></a>`}).join('')||'<div class="social-empty">Restaurant social profiles will appear here.</div>'}</div></section>${publicAdSection(r)}</section>`;app.innerHTML=`<main class="public-menu">${content}<div class="actions" style="justify-content:center;margin-top:18px"><button class="btn secondary" id="refreshTrack">Refresh Status</button><button class="btn" id="backMenu">View Menu</button></div></main>`;$('#refreshTrack').onclick=renderTrack;$('#backMenu').onclick=()=>location.hash=`menu&restaurant=${r.id}`;bindPublicAdContact(r)}

function applyOrderTrackingCopy(){
  if(!location.hash.startsWith('#track')) return;
  const status=$('.status-pill',app)?.textContent.trim();
  const heading=$('.public-menu > .card > h1',app);
  const message=$('.track-message',app);
  const copy={
    Pending:{heading:'Order Received',message:'Your order was sent to the restaurant and is waiting for confirmation.'},
    Accepted:{heading:'Order Confirmed',message:'The restaurant accepted your order. You will see an update when it is ready.'},
    Preparing:{heading:'Order Preparing',message:'The kitchen is preparing your order now.'},
    Rejected:{heading:'Order Rejected',message:'The restaurant could not accept this order. Please contact the restaurant for help.'},
    'Payment Rejected':{heading:'Payment Could Not Be Confirmed',message:'Please contact the restaurant before trying the payment again.'}
  }[status];
  if(copy&&heading) heading.textContent=copy.heading;
  if(copy&&message) message.textContent=copy.message;
  if(status!=='Preparing') $('.pot-scene',app)?.remove();
}
const renderTrackBase=renderTrack;
renderTrack=function(){renderTrackBase();applyOrderTrackingCopy()};

function modal(title,body,onReady){
  // Async data refreshes can render the same view twice. Replace any existing
  // dialog first so duplicate IDs never leave the visible close button unbound.
  closeModal();
  document.body.insertAdjacentHTML('beforeend',`<div class="modal-backdrop" id="modal" role="presentation"><section class="modal" role="dialog" aria-modal="true" aria-labelledby="modalTitle"><div class="section-head" style="margin-top:0"><h2 id="modalTitle">${title}</h2><button class="btn small secondary" id="closeModal" type="button" aria-label="Close dialog">✕</button></div>${body}</section></div>`);
  const backdrop=$('#modal');
  const closeButton=$('#closeModal',backdrop);
  closeButton?.addEventListener('click',closeModal);
  backdrop?.addEventListener('click',event=>{if(event.target===backdrop)closeModal()});
  document.body.classList.add('modal-open');
  closeButton?.focus({preventScroll:true});
  onReady?.();
}
function closeModal(){
  $('#modal')?.remove();
  document.body.classList.remove('modal-open');
}
document.addEventListener('keydown',event=>{if(event.key==='Escape'&&$('#modal'))closeModal()});
function empty(t){return `<div class="empty">${t}</div>`}
window.addEventListener('hashchange',render);
window.addEventListener('storage',()=>{state=load();if(location.hash.startsWith('#track'))renderTrack()});
setInterval(()=>{if(location.hash.startsWith('#track')){state=load();renderTrack()}},2500);
function refreshExpiryLabels(){$$('[data-ad-expiry]').forEach(label=>{const expiresAt=label.dataset.adExpiry;if(!expiresAt){label.textContent='Contact G58 for slot duration';return}label.textContent=adTimeLeft({expiresAt})})}
setInterval(refreshExpiryLabels,30000);
Gravity58Ads?.subscribeAdvertisements(hydrateAdvertisements);
render();
hydrateAdvertisements();
