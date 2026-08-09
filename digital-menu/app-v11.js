const $ = (s, root=document) => root.querySelector(s);
const $$ = (s, root=document) => [...root.querySelectorAll(s)];
const uid = (p='id') => `${p}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2,7)}`;
const money = n => `₹${Number(n||0).toLocaleString('en-IN')}`;
const now = () => new Date().toISOString();
const app = $('#app');
const CONFIG = window.GRAVITY58_CONFIG || {demoMode:true,gravity58Url:'https://g58.in/'};
const html=value=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
function isWebImage(value){return /^(data:image\/|blob:|https?:\/\/)/i.test(String(value||''))}
function imageMarkup(value,fallback='G',className=''){return isWebImage(value)?`<img class="${className}" src="${html(value)}" alt="" loading="lazy">`:`<span class="media-fallback">${html(value||fallback)}</span>`}
function adMediaMarkup(ad,className=''){
  const source=ad?.mediaUrl||((isWebImage(ad?.image)||/^(data:video\/|blob:|https?:\/\/)/i.test(String(ad?.image||'')))?ad.image:'');
  if(source&&(/^video\//i.test(ad?.mediaType||'')||/\.(mp4|webm|mov)(\?|$)/i.test(source)))return `<video class="${className}" src="${html(source)}" autoplay muted loop playsinline preload="metadata"></video>`;
  if(source)return `<img class="${className}" src="${html(source)}" alt="${html(ad?.title||'Advertisement')}" loading="lazy">`;
  return `<span class="media-fallback">${html(ad?.image||'AD')}</span>`;
}
const LOCAL_MEDIA_DB='gravity58LocalMedia';
const LOCAL_MEDIA_STORE='images';
const localMediaUrls=new Map();
let localMediaDbPromise;
function openLocalMediaDb(){
  if(!('indexedDB' in window))return Promise.reject(new Error('This browser does not support local image storage'));
  if(localMediaDbPromise)return localMediaDbPromise;
  localMediaDbPromise=new Promise((resolve,reject)=>{const request=indexedDB.open(LOCAL_MEDIA_DB,1);request.onupgradeneeded=()=>{const db=request.result;if(!db.objectStoreNames.contains(LOCAL_MEDIA_STORE))db.createObjectStore(LOCAL_MEDIA_STORE)};request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error||new Error('Could not open local image storage'))});
  return localMediaDbPromise;
}
async function getLocalMedia(key){if(!key)return null;const db=await openLocalMediaDb();return new Promise((resolve,reject)=>{const request=db.transaction(LOCAL_MEDIA_STORE,'readonly').objectStore(LOCAL_MEDIA_STORE).get(key);request.onsuccess=()=>resolve(request.result||null);request.onerror=()=>reject(request.error)})}
async function putLocalMedia(key,blob){const db=await openLocalMediaDb();await new Promise((resolve,reject)=>{const request=db.transaction(LOCAL_MEDIA_STORE,'readwrite').objectStore(LOCAL_MEDIA_STORE).put(blob,key);request.onsuccess=()=>resolve();request.onerror=()=>reject(request.error)});const previous=localMediaUrls.get(key);if(previous)URL.revokeObjectURL(previous);const url=URL.createObjectURL(blob);localMediaUrls.set(key,url);return url}
async function deleteLocalMedia(key){if(!key)return;try{const db=await openLocalMediaDb();await new Promise((resolve,reject)=>{const request=db.transaction(LOCAL_MEDIA_STORE,'readwrite').objectStore(LOCAL_MEDIA_STORE).delete(key);request.onsuccess=()=>resolve();request.onerror=()=>reject(request.error)});const url=localMediaUrls.get(key);if(url)URL.revokeObjectURL(url);localMediaUrls.delete(key)}catch(error){console.warn('Local image cleanup failed',error)}}
async function clearLocalMedia(){try{const db=await openLocalMediaDb();await new Promise((resolve,reject)=>{const request=db.transaction(LOCAL_MEDIA_STORE,'readwrite').objectStore(LOCAL_MEDIA_STORE).clear();request.onsuccess=()=>resolve();request.onerror=()=>reject(request.error)});localMediaUrls.forEach(url=>URL.revokeObjectURL(url));localMediaUrls.clear()}catch(error){console.warn('Local image reset failed',error)}}
function localMediaSource(record,keyName,legacyName){return localMediaUrls.get(record?.[keyName])||record?.[legacyName]||record?.[keyName==='logoImageKey'?'logoImageUrl':'imageUrl']||''}
function optimizeLocalImage(file,{maxWidth=960,quality=.78}={}){
  return new Promise((resolve,reject)=>{
    if(!file||!file.size)return resolve('');
    if(!file.type.startsWith('image/'))return reject(new Error('Select a JPG, PNG or WebP image'));
    if(file.size>10*1024*1024)return reject(new Error('Image must be below 10 MB'));
    const source=URL.createObjectURL(file),img=new Image();
    img.onerror=()=>{URL.revokeObjectURL(source);reject(new Error('Invalid image file'))};
    img.onload=()=>{const scale=Math.min(1,maxWidth/img.width),canvas=document.createElement('canvas');canvas.width=Math.max(1,Math.round(img.width*scale));canvas.height=Math.max(1,Math.round(img.height*scale));canvas.getContext('2d').drawImage(img,0,0,canvas.width,canvas.height);URL.revokeObjectURL(source);canvas.toBlob(blob=>blob?resolve(blob):reject(new Error('Could not optimise image')),'image/webp',quality)};img.src=source;
  });
}

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
let remoteMenuConfig = null;
let remoteMenuSource = '';
let remoteMenuLoading = false;
const CLOUD_MENU_KIND_PREFIX = 'digital_menu_';
let cloudMenuSyncing = false;

function load(){
  try{
    const stored=JSON.parse(localStorage.getItem('gravity58DigitalMenu'))||structuredClone(seed);
    stored.advertisements=[];
    stored.adRequests=[];
    stored.restaurants=(stored.restaurants||[]).map(r=>({...r,logoImageKey:r.logoImageKey||(isWebImage(r.logoImage)&&String(r.logoImage).startsWith('data:')?`restaurant:${r.id}`:''),address:r.address||'',phone:r.phone||'',email:r.email||'',paymentEnabled:!!r.paymentEnabled,upiId:r.upiId||'',paymentLink:r.paymentLink||'',restaurantKey:`${r.name}|${r.city}`}));
    stored.items=(stored.items||[]).map(i=>({...i,imageKey:i.imageKey||(isWebImage(i.imageData)&&String(i.imageData).startsWith('data:')?`menu-item:${i.id}`:''),prepareInstructionsEnabled:!!i.prepareInstructionsEnabled}));
    return stored;
  }catch{return {...structuredClone(seed),advertisements:[],adRequests:[]}}
}
function localStatePayload(){
  const {advertisements,adRequests,...local}=state;
  return {...local,restaurants:(local.restaurants||[]).map(({logoImage,...restaurant})=>restaurant),items:(local.items||[]).map(({imageData,...item})=>item)};
}
function save(){localStorage.setItem('gravity58DigitalMenu',JSON.stringify(localStatePayload()))}
async function hydrateLocalMedia(){
  let changed=false,hydrated=false;
  const records=[...(state.restaurants||[]).map(record=>({record,keyName:'logoImageKey',legacyName:'logoImage',prefix:'restaurant'})),...(state.items||[]).map(record=>({record,keyName:'imageKey',legacyName:'imageData',prefix:'menu-item'}))];
  for(const entry of records){
    const {record,keyName,legacyName,prefix}=entry;
    if(record[legacyName]&&String(record[legacyName]).startsWith('data:image/')){
      try{const key=record[keyName]||`${prefix}:${record.id}`,blob=await fetch(record[legacyName]).then(response=>response.blob());record[keyName]=key;await putLocalMedia(key,blob);record[legacyName]='';changed=hydrated=true}catch(error){console.warn('Legacy image migration failed',error)}
    }else if(record[keyName]&&!localMediaUrls.has(record[keyName])){
      try{const blob=await getLocalMedia(record[keyName]);if(blob){const url=URL.createObjectURL(blob);localMediaUrls.set(record[keyName],url);hydrated=true}}catch(error){console.warn('Local image hydration failed',error)}
    }
  }
  if(changed)save();
  if(hydrated)render();
}
function toast(msg){const t=$('#toast');if(!t){console.warn(msg);return}t.textContent=msg;t.classList.add('show');setTimeout(()=>t.classList.remove('show'),2200)}
function ownerRestaurants(){if(!state.session)return state.restaurants;return state.restaurants.filter(r=>r.ownerId===state.session.userId)}
function activeRestaurant(){const owned=ownerRestaurants();const active=owned.find(r=>r.id===state.activeRestaurantId)||owned[0];if(active&&active.id!==state.activeRestaurantId)state.activeRestaurantId=active.id;return active}
function restaurantItems(id=state.activeRestaurantId){return state.items.filter(x=>x.restaurantId===id)}
function restaurantCategories(id=state.activeRestaurantId){return state.categories.filter(x=>x.restaurantId===id)}
function restaurantOrders(id=state.activeRestaurantId){return state.orders.filter(x=>x.restaurantId===id)}
function isCloudMenuSession(){return state.session?.provider==='gravity58'&&Gravity58Ads?.configured}
function cloudOwnerId(){return state.users.find(row=>row.id===state.session?.userId)?.cloudUserId||''}
function cloudMenuKind(ownerId=cloudOwnerId()){return `${CLOUD_MENU_KIND_PREFIX}${String(ownerId||'public').replace(/[^a-zA-Z0-9._-]/g,'-').slice(0,48)}`}
function restaurantCloudFields(r){const fields=['id','name','type','city','description','address','phone','email','open','accepting','tax','service','identification','restaurantKey','social','paymentEnabled','upiId','paymentLink','logoImageUrl','logoImageFileId'];return Object.fromEntries(fields.map(key=>[key,r?.[key]]))}
function itemCloudFields(item){const fields=['id','categoryId','name','description','price','type','available','prep','prepareInstructionsEnabled','imageUrl','imageFileId'];return Object.fromEntries(fields.map(key=>[key,item?.[key]]))}
function buildCloudMenuRecord(restaurantId=state.activeRestaurantId){const restaurant=state.restaurants.find(row=>row.id===restaurantId);if(!restaurant)throw new Error('Restaurant not found');return {schemaVersion:2,ownerId:cloudOwnerId(),updatedAt:now(),restaurant:restaurantCloudFields(restaurant),categories:restaurantCategories(restaurantId).map(row=>({id:row.id,name:row.name})),items:restaurantItems(restaurantId).map(itemCloudFields)}}
async function uploadMenuImage(blob,name){if(!blob?.size||!isCloudMenuSession())return null;const file=new File([blob],`${slugify(name)}.webp`,{type:'image/webp'});return Gravity58Ads.uploadAdMedia(file)}
async function migrateLocalMenuImages(restaurantId){if(!isCloudMenuSession())return;const restaurant=state.restaurants.find(row=>row.id===restaurantId);const records=[{record:restaurant,keyName:'logoImageKey',urlName:'logoImageUrl',fileName:'logoImageFileId'},...restaurantItems(restaurantId).map(record=>({record,keyName:'imageKey',urlName:'imageUrl',fileName:'imageFileId'}))];for(const entry of records){if(!entry.record?.[entry.keyName]||entry.record[entry.urlName])continue;try{const blob=await getLocalMedia(entry.record[entry.keyName]);if(!blob)continue;const upload=await uploadMenuImage(blob,entry.record.name||'menu-image');entry.record[entry.urlName]=upload?.mediaUrl||'';entry.record[entry.fileName]=upload?.fileId||''}catch(error){console.warn('Menu image cloud migration failed',error)}}}
async function persistCloudMenu(restaurantId=state.activeRestaurantId){save();if(!isCloudMenuSession())return null;await migrateLocalMenuImages(restaurantId);const data=buildCloudMenuRecord(restaurantId),kind=cloudMenuKind(),permissions=Gravity58Ads.permissionSet?.(kind,data.ownerId);let record;try{record=await Gravity58Ads.create(kind,data,restaurantId,permissions)}catch(error){if(error?.code!==409&&!/already exists/i.test(error?.message||''))throw error;record=await Gravity58Ads.update(kind,restaurantId,data)}const restaurant=state.restaurants.find(row=>row.id===restaurantId);if(restaurant)restaurant.cloudRecordId=record?.$id||record?.id||restaurantId;save();return record}
function applyCloudMenus(records){const userId=state.session?.userId;if(!userId)return;const oldIds=new Set(state.restaurants.filter(row=>row.ownerId===userId).map(row=>row.id));state.restaurants=state.restaurants.filter(row=>row.ownerId!==userId);state.categories=state.categories.filter(row=>!oldIds.has(row.restaurantId));state.items=state.items.filter(row=>!oldIds.has(row.restaurantId));for(const record of records){if(!record?.restaurant?.id)continue;const rid=record.restaurant.id;state.restaurants.push({...record.restaurant,id:rid,ownerId:userId,cloudRecordId:record.$id||record.id||rid,logo:'G',restaurantKey:record.restaurant.restaurantKey||`${record.restaurant.name}|${record.restaurant.city}`});state.categories.push(...(record.categories||[]).map(row=>({...row,restaurantId:rid})));state.items.push(...(record.items||[]).map(row=>({...row,restaurantId:rid,available:row.available!==false,prepareInstructionsEnabled:!!row.prepareInstructionsEnabled})))}}
async function syncCloudMenus(){if(!isCloudMenuSession()||cloudMenuSyncing)return;cloudMenuSyncing=true;try{const kind=cloudMenuKind(),ownerId=cloudOwnerId(),localOwned=ownerRestaurants();let records=(await Gravity58Ads.list(kind)).filter(row=>row.ownerId===ownerId);if(!records.length&&localOwned.length){for(const restaurant of localOwned)await persistCloudMenu(restaurant.id);records=(await Gravity58Ads.list(kind)).filter(row=>row.ownerId===ownerId)}if(records.length){applyCloudMenus(records);if(!ownerRestaurants().some(row=>row.id===state.activeRestaurantId))state.activeRestaurantId=ownerRestaurants()[0]?.id||'';save()}}finally{cloudMenuSyncing=false}}
async function removeCloudMenu(restaurant){if(!isCloudMenuSession())return;await Gravity58Ads.remove(cloudMenuKind(),restaurant.cloudRecordId||restaurant.id)}
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
function renderLogin(){const cloud=!!Gravity58Ads?.configured;app.innerHTML=`<main class="screen auth"><section class="auth-card glass"><a class="menu-home-link" href="../">← Gravity58 Home</a><div class="premium-menu-kicker">PREMIUM RESTAURANT EXPERIENCE</div><div class="brand"><div class="brand-mark">G</div><div><h2>Gravity58 Digital Menu</h2><p class="tagline">Scan. Order. Relax.</p></div></div><form id="loginForm"><div class="field"><label>Email</label><input name="email" type="email" value="${cloud?'':'demo@g58.in'}" required></div><div class="field"><label>Password</label><input name="password" type="password" value="${cloud?'':'demo123'}" required></div><button class="btn full">Login</button></form><div class="actions" style="justify-content:center;margin-top:12px"><button class="link-btn" id="newUser">New User</button><button class="link-btn" id="forgot">Forgot Password</button></div><p class="muted" style="text-align:center;margin-top:18px">Sign in to access your restaurant and menu configuration from any device.</p></section></main>`;
  $('#loginForm').onsubmit=async e=>{e.preventDefault();const d=Object.fromEntries(new FormData(e.target)),button=e.submitter;button.disabled=true;button.textContent='Signing in…';const local=cloud?null:state.users.find(x=>(x.email===d.email||x.id===d.email)&&x.password===d.password);if(local){state.session={userId:local.id};save();return render()}try{if(!cloud)throw new Error('Invalid login');await Gravity58Ads.login(d.email.trim(),d.password);const account=await Gravity58Ads.currentUser();if(!account)throw new Error('Could not read this account');const user=ensureGravity58User(account);state.session={userId:user.id,provider:'gravity58'};save();button.textContent='Loading menu…';await syncCloudMenus();render()}catch(error){button.disabled=false;button.textContent='Login';toast(error.message||'Invalid login')}};
  $('#newUser').onclick=()=>modal('Create Account',registerForm(),bindRegister);
  $('#forgot').onclick=()=>{const localFields=cloud?'':`<div class="field"><label>New local password</label><input name="password" type="password" minlength="6"></div><div class="field"><label>Confirm local password</label><input name="confirm" type="password" minlength="6"></div>`;modal('Password Recovery',`<p class="muted">${cloud?'Enter your account email to receive a secure reset link.':'Reset the local demo account on this browser.'}</p><form id="forgotForm"><div class="field"><label>Email</label><input name="email" type="email" required></div>${localFields}<div class="actions">${cloud?'<button class="btn" name="action" value="email">Send Reset Email</button>':'<button class="btn" name="action" value="local">Reset Password</button>'}</div></form>`,()=>{$('#forgotForm').onsubmit=async e=>{e.preventDefault();const d=Object.fromEntries(new FormData(e.target)),action=e.submitter?.value||'email';if(action==='email'){try{await Gravity58Ads.forgotPassword(d.email.trim(),location.origin+'/reset-password/');closeModal();return toast('Password reset email sent')}catch(error){return toast(error.message||'Could not send reset email')}}const u=state.users.find(x=>x.email.toLowerCase()===d.email.trim().toLowerCase());if(!u)return toast('No local account exists for this email');if((d.password||'').length<6)return toast('Use at least 6 characters');if(d.password!==d.confirm)return toast('Passwords do not match');u.password=d.password;save();closeModal();toast('Password reset on this browser')}})};
}
function registerForm(){return `<form id="registerForm"><div class="form-grid"><div class="field"><label>Full name</label><input name="name" required></div><div class="field"><label>Email</label><input name="email" type="email" required></div><div class="field"><label>Mobile</label><input name="mobile"></div><div class="field"><label>City</label><input name="city"></div><div class="field"><label>Password</label><input name="password" type="password" required></div><div class="field"><label>Confirm password</label><input name="confirm" type="password" required></div></div><button class="btn full">Create Account</button></form>`}
function ensureGravity58User(account,details={}){let user=state.users.find(row=>row.cloudUserId===account.$id||row.email?.toLowerCase()===account.email?.toLowerCase());if(!user){user={id:`g58_${account.$id}`,cloudUserId:account.$id,name:account.name||details.name||account.email.split('@')[0],email:account.email,mobile:details.mobile||'',city:details.city||'',provider:'gravity58'};state.users.push(user)}else Object.assign(user,{cloudUserId:account.$id,name:account.name||user.name,email:account.email,provider:'gravity58'});return user}
function bindRegister(){$('#registerForm').onsubmit=async e=>{e.preventDefault();const d=Object.fromEntries(new FormData(e.target));if(state.users.some(x=>x.email.toLowerCase()===d.email.trim().toLowerCase()))return toast('This email already has an account on this browser');if(d.password.length<6)return toast('Use at least 6 characters');if(d.password!==d.confirm)return toast('Passwords do not match');const button=e.submitter;button.disabled=true;button.textContent='Creating…';try{let user;if(Gravity58Ads?.configured){const account=await Gravity58Ads.register(d.email.trim().toLowerCase(),d.password,d.name,d.mobile);user=ensureGravity58User(account,d)}else{user={id:uid('usr'),name:d.name,email:d.email.trim().toLowerCase(),password:d.password,mobile:d.mobile,city:d.city,provider:'local'};state.users.push(user)}state.session={userId:user.id,provider:user.provider};save();closeModal();renderOwnerOnboarding()}catch(error){button.disabled=false;button.textContent='Create Account';toast(error.message||'Could not create account')}}}

async function logoutOwner(){if(state.session?.provider==='gravity58')try{await Gravity58Ads?.logout()}catch{}state.session=null;save();render()}
function renderOwnerOnboarding(){const cloud=isCloudMenuSession();app.innerHTML=`<main class="screen auth"><section class="auth-card glass"><a class="menu-home-link" href="../">← Gravity58 Home</a><div class="premium-menu-kicker">SET UP YOUR RESTAURANT</div><div class="brand"><div class="brand-mark">G</div><div><h2>Create your first Digital Menu</h2><p class="tagline">${cloud?'Restaurant and menu configuration will be saved to your G58 account.':'Demo restaurant data remains in this browser.'}</p></div></div><button class="btn full" id="createFirstRestaurant">Add Restaurant</button><button class="btn secondary full" id="importFirstConfig" style="margin-top:10px">Import Existing Menu Config</button><input id="firstConfigFile" type="file" accept="application/json,.json" hidden><button class="link-btn full" id="onboardingLogout">Logout</button></section></main>`;$('#createFirstRestaurant').onclick=()=>openRestaurantForm(true);$('#importFirstConfig').onclick=()=>$('#firstConfigFile').click();$('#firstConfigFile').onchange=e=>importMenuConfigFile(e.target.files[0]);$('#onboardingLogout').onclick=logoutOwner}

function renderShell(){const r=activeRestaurant(),cloud=isCloudMenuSession();if(!r)return renderOwnerOnboarding();app.innerHTML=`<div class="shell"><aside class="sidebar"><div class="brand"><div class="brand-mark">G</div><div><strong>Gravity58 Menu</strong><small class="muted">Restaurant workspace</small></div></div><nav class="nav">${navButton('dashboard','⌂','Dashboard')}${navButton('restaurants','◫','Restaurants')}${navButton('menu','☰','Menu Setup')}${navButton('orders','◉','Orders')}${navButton('qr','▦','QR Codes')}${navButton('reports','◒','Reports')}${navButton('publish','⇧',cloud?'Share Menu':'Publish & Setup')}${navButton('settings','⚙','Settings')}<a class="owner-book-ad" href="${CONFIG.adBookingPortalUrl||'../advertise/'}?restaurant=${encodeURIComponent(`${r.name}|${r.city}`)}">✦ Book Ad Space</a><button id="logout">⇥ Logout</button></nav></aside><main class="main"><header class="topbar"><div class="restaurant-switch"><span>${r.name?.[0]||'G'}</span><select id="restaurantSelect">${ownerRestaurants().map(x=>`<option value="${x.id}" ${x.id===r.id?'selected':''}>${x.name}</option>`).join('')}</select><button class="btn small secondary" id="addRestaurant">+ Add</button></div><div class="user-label">${cloud?'<button class="status-pill sync-menu-button" id="syncCloudMenu"><span class="dot"></span> Synced to G58 account</button>':'<span class="status-pill"><span class="dot"></span> Demo browser data</span>'}</div></header><section class="content" id="page"></section></main></div>`;
  $('#restaurantSelect').onchange=e=>{state.activeRestaurantId=e.target.value;save();renderShell()};
  $('#addRestaurant').onclick=()=>openRestaurantForm(false);
  $('#syncCloudMenu')?.addEventListener('click',async e=>{e.currentTarget.disabled=true;try{await syncCloudMenus();renderShell();toast('Latest account menu loaded')}catch(error){e.currentTarget.disabled=false;toast(error.message||'Could not sync menu')}});
  $('#logout').onclick=logoutOwner;
  $$('.nav button[data-view]').forEach(b=>b.onclick=()=>{view=b.dataset.view;renderShell()});
  renderView();
}
function navButton(v,i,t){return `<button data-view="${v}" class="${view===v?'active':''}"><span>${i}</span>${t}</button>`}
function renderView(){({dashboard:dashboardView,restaurants:restaurantsView,menu:menuView,orders:ordersView,qr:qrView,reports:reportsView,publish:publishSetupView,settings:settingsView}[view]||dashboardView)()}
function dashboardView(){const r=activeRestaurant(),items=restaurantItems(),orders=restaurantOrders();$('#page').innerHTML=`<div class="hero"><div><span class="status-pill"><span class="dot"></span>${r.open?'Open':'Closed'}</span><h1 style="margin:12px 0 6px">${r.logo} ${r.name}</h1><p>${r.description||r.type+' in '+r.city}</p></div><div class="actions"><button class="btn secondary" id="previewMenu">Preview Menu</button><button class="btn violet" id="newOrder">Simulate Order</button></div></div><div class="grid stats">${metric('Categories',restaurantCategories().length)}${metric('Menu Items',items.length)}${metric('Pending Orders',orders.filter(x=>x.status==='Pending').length)}${metric('Today Revenue',money(orders.filter(x=>x.status==='Completed').reduce((a,b)=>a+b.total,0)))}</div><div class="section-head"><h2>Live Orders</h2><button class="btn small secondary" data-go="orders">View all</button></div><div class="grid order-grid">${orders.slice(0,3).map(orderCard).join('')||empty('No orders yet')}</div>`;
  $('#previewMenu').onclick=()=>{location.hash=`menu&restaurant=${r.id}`};$('#newOrder').onclick=simulateOrder;$('[data-go="orders"]').onclick=()=>{view='orders';renderShell()};bindOrderActions();}
function metric(label,value){return `<article class="card"><span class="muted">${label}</span><div class="metric">${value}</div></article>`}
function restaurantVisual(r,className=''){return imageMarkup(localMediaSource(r,'logoImageKey','logoImage'),r.name?.trim()?.[0]||'G',className)}
function restaurantsView(){$('#page').innerHTML=`<div class="section-head"><div><h1>My Restaurants</h1><p class="muted">Each restaurant has an account-synced menu. Orders and reports continue to work as before on this device.</p></div><button class="btn" id="createRestaurant">+ New Restaurant</button></div><div class="grid restaurant-grid">${ownerRestaurants().map(r=>`<article class="card restaurant-card"><div class="logo restaurant-logo">${restaurantVisual(r,'restaurant-logo-image')}</div><h3>${html(r.name)}</h3><p class="muted">${html(r.type)} · ${html(r.city)}</p><div class="chips"><span class="chip">${restaurantItems(r.id).length} items</span><span class="chip">${restaurantOrders(r.id).length} orders</span><span class="chip">${r.open?'Open':'Closed'}</span></div><div class="actions"><button class="btn small" data-open="${r.id}">Open Dashboard</button><button class="btn small secondary" data-edit="${r.id}">Edit</button><button class="btn small red" data-delete-restaurant="${r.id}">Delete</button></div></article>`).join('')}</div>`;$('#createRestaurant').onclick=()=>openRestaurantForm(false);$$('[data-open]').forEach(b=>b.onclick=()=>{state.activeRestaurantId=b.dataset.open;view='dashboard';save();renderShell()});$$('[data-edit]').forEach(b=>b.onclick=()=>openRestaurantForm(false,b.dataset.edit));$$('[data-delete-restaurant]').forEach(b=>b.onclick=()=>deleteRestaurant(b.dataset.deleteRestaurant))}
function restaurantForm(r={}){return `<form id="restaurantForm"><div class="form-grid"><div class="field"><label>Restaurant name</label><input name="name" value="${html(r.name||'')}" required></div><div class="field"><label>Type</label><select name="type">${['Restaurant','Café','Bakery','Cloud Kitchen','Fast Food','Other'].map(x=>`<option ${r.type===x?'selected':''}>${x}</option>`).join('')}</select></div><div class="field"><label>City / Location</label><input name="city" value="${html(r.city||'')}" required></div><div class="field local-image-field"><label>Restaurant image <small>(${isCloudMenuSession()?'saved to your G58 account':'demo browser storage'})</small></label><input name="logoFile" type="file" accept="image/jpeg,image/png,image/webp"><div class="image-preview restaurant-image-preview">${restaurantVisual(r,'restaurant-preview-image')}</div></div><div class="field"><label>Identification mode</label><select name="identification">${['Customer Name','Table Number','Counter Number','Token Number'].map(x=>`<option ${r.identification===x?'selected':''}>${x}</option>`).join('')}</select></div><div class="field"><label>Tax %</label><input name="tax" type="number" value="${r.tax??5}"></div></div><div class="form-grid"><div class="field"><label>Address</label><input name="address" value="${html(r.address||'')}"></div><div class="field"><label>Phone</label><input name="phone" value="${html(r.phone||'')}"></div><div class="field"><label>Email</label><input name="email" type="email" value="${html(r.email||'')}"></div></div><div class="field"><label>Description</label><textarea name="description">${html(r.description||'')}</textarea></div><button class="btn full">Save Restaurant</button></form>`}
function openRestaurantForm(first=false,id=null){
  const r=id?state.restaurants.find(x=>x.id===id):{};
  modal(id?'Edit Restaurant':first?'Create Your First Restaurant':'Add Restaurant',restaurantForm(r),()=>{
    const form=$('#restaurantForm'),file=form.logoFile,preview=$('.restaurant-image-preview');
    let previewUrl='';
    file.onchange=async()=>{try{const blob=await optimizeLocalImage(file.files[0],{maxWidth:720});file._optimizedBlob=blob;if(previewUrl)URL.revokeObjectURL(previewUrl);previewUrl=URL.createObjectURL(blob);preview.innerHTML=imageMarkup(previewUrl,'G','restaurant-preview-image')}catch(error){file.value='';toast(error.message)}};
    form.onsubmit=async e=>{
      e.preventDefault();const fd=new FormData(e.target),selectedFile=fd.get('logoFile');fd.delete('logoFile');const d=Object.fromEntries(fd),button=e.submitter;button.disabled=true;button.textContent='Saving…';
      try{
        let saved;
        if(id){Object.assign(r,d,{tax:+d.tax,restaurantKey:`${d.name}|${d.city}`});saved=r}
        else{saved={id:uid('res'),ownerId:state.session.userId,...d,logo:'G',restaurantKey:`${d.name}|${d.city}`,tax:+d.tax,service:0,open:true,accepting:true,social:{}};state.restaurants.push(saved);state.activeRestaurantId=saved.id}
        if(selectedFile?.size){const blob=file._optimizedBlob||await optimizeLocalImage(selectedFile,{maxWidth:720});if(isCloudMenuSession()){const oldFile=saved.logoImageFileId,upload=await uploadMenuImage(blob,saved.name);saved.logoImageUrl=upload.mediaUrl;saved.logoImageFileId=upload.fileId;if(oldFile&&oldFile!==upload.fileId)Gravity58Ads.removeAdMedia(oldFile).catch(()=>{})}else{const key=saved.logoImageKey||`restaurant:${saved.id}`;await putLocalMedia(key,blob);saved.logoImageKey=key;saved.logoImage=''}}
        await persistCloudMenu(saved.id);Gravity58Ads?.upsertSlot({id:saved.id,restaurantKey:saved.restaurantKey,name:saved.name,city:saved.city,active:true}).catch(()=>{});if(previewUrl)URL.revokeObjectURL(previewUrl);closeModal();renderShell();toast(isCloudMenuSession()?'Restaurant saved to your G58 account':'Restaurant saved in this browser')
      }catch(error){button.disabled=false;button.textContent='Save Restaurant';toast(error.message||'Could not save restaurant')}
    };
  });
}
async function deleteRestaurant(id){const restaurant=state.restaurants.find(r=>r.id===id);if(!restaurant||!confirm(`Permanently delete ${restaurant.name}, its menu, orders and QR locations?`))return;try{await removeCloudMenu(restaurant)}catch(error){return toast(error.message||'Could not delete the account menu')}const restaurantItemsToDelete=state.items.filter(row=>row.restaurantId===id),imageKeys=[restaurant.logoImageKey,...restaurantItemsToDelete.map(row=>row.imageKey)].filter(Boolean),cloudFiles=[restaurant.logoImageFileId,...restaurantItemsToDelete.map(row=>row.imageFileId)].filter(Boolean);state.restaurants=state.restaurants.filter(r=>r.id!==id);state.categories=state.categories.filter(row=>row.restaurantId!==id);state.items=state.items.filter(row=>row.restaurantId!==id);state.orders=state.orders.filter(row=>row.restaurantId!==id);state.locations=state.locations.filter(row=>row.restaurantId!==id);const next=ownerRestaurants()[0];state.activeRestaurantId=next?.id||'';save();Promise.all(imageKeys.map(deleteLocalMedia)).catch(()=>{});if(isCloudMenuSession())Promise.all(cloudFiles.map(fileId=>Gravity58Ads.removeAdMedia(fileId))).catch(()=>{});Gravity58Ads?.upsertSlot({id:restaurant.id,restaurantKey:restaurant.restaurantKey||`${restaurant.name}|${restaurant.city}`,name:restaurant.name,city:restaurant.city,active:false}).catch(()=>{});toast('Restaurant deleted');next?restaurantsView():renderOwnerOnboarding()}
function menuView(){const cats=restaurantCategories(),items=restaurantItems();$('#page').innerHTML=`<div class="section-head"><div><h1>Menu Setup</h1><p class="muted">Add individual dishes or import multiple menu items from CSV.</p></div><div class="actions"><button class="btn secondary" id="downloadMenuCsv">Download CSV Template</button><button class="btn secondary" id="importMenuCsv">Import CSV</button><input id="menuCsvFile" type="file" accept=".csv,text/csv" hidden><button class="btn" id="addItem">+ Menu Item</button></div></div><div class="cloud-menu-note"><strong>${isCloudMenuSession()?'Account-synced menu':'Demo menu'}</strong><span>${isCloudMenuSession()?'Restaurant and menu changes are available after signing in on another device.':'This local demo remains in the current browser.'}</span></div><div class="toolbar"><input id="itemSearch" placeholder="Search menu items"><select id="catFilter"><option value="">All categories</option>${cats.map(c=>`<option value="${c.id}">${html(c.name)}</option>`).join('')}</select></div><div class="grid menu-grid" id="menuGrid">${items.map(menuCard).join('')||empty('Create your first menu item')}</div>`;$('#addItem').onclick=()=>openItemForm();$('#downloadMenuCsv').onclick=downloadMenuCsvTemplate;$('#importMenuCsv').onclick=()=>$('#menuCsvFile').click();$('#menuCsvFile').onchange=e=>importMenuCsvFile(e.target.files[0]);$('#itemSearch').oninput=filterItems;$('#catFilter').onchange=filterItems;bindMenuActions()}
function menuCard(i){const c=state.categories.find(x=>x.id===i.categoryId);return `<article class="card menu-item" data-name="${html(i.name.toLowerCase())}" data-cat="${i.categoryId}"><span class="availability chip">${i.available?'Available':'Out of stock'}</span><div class="food-img menu-owner-image">${imageMarkup(localMediaSource(i,'imageKey','imageData'),i.name?.[0]||'G','menu-owner-photo')}</div><div class="chips"><span class="chip">${html(c?.name||'Uncategorised')}</span><span class="chip">${html(i.type)}</span></div><h3>${html(i.name)}</h3><p class="muted">${html(i.description)}</p>${i.prepareInstructionsEnabled?'<span class="chip instruction-enabled-chip">Preparation instructions enabled</span>':''}<div class="price">${money(i.price)}</div><div class="actions" style="margin-top:12px"><button class="btn small secondary" data-item-edit="${i.id}">Edit</button><button class="btn small ${i.available?'red':'green'}" data-stock="${i.id}">${i.available?'Out of stock':'Make available'}</button><button class="btn small red" data-item-delete="${i.id}">Delete</button></div></article>`}
function filterItems(){const q=$('#itemSearch').value.toLowerCase(),c=$('#catFilter').value;$$('#menuGrid .menu-item').forEach(x=>x.classList.toggle('hidden',!x.dataset.name.includes(q)||(c&&x.dataset.cat!==c)))}
function downloadMenuCsvTemplate(){downloadFile('g58-digital-menu-template.csv',Gravity58MenuData.MENU_CSV_TEMPLATE,'text/csv;charset=utf-8');toast('CSV template downloaded')}
async function importMenuCsvFile(file){if(!file)return;if(file.size>2*1024*1024)return toast('CSV file must be below 2 MB');try{const rows=Gravity58MenuData.parseMenuCsv(await file.text());if(rows.length>100)throw new Error('Import up to 100 menu items at a time');let created=0,updated=0;for(const row of rows){const categoryName=row.category.trim().slice(0,80),normalisedCategory=categoryName.toLowerCase();let category=restaurantCategories().find(entry=>entry.name.trim().toLowerCase()===normalisedCategory);if(!category){category={id:uid('cat'),restaurantId:state.activeRestaurantId,name:categoryName};state.categories.push(category)}let item=restaurantItems().find(entry=>entry.categoryId===category.id&&entry.name.trim().toLowerCase()===row.item_name.trim().toLowerCase());if(item)updated++;else{item={id:uid('item'),restaurantId:state.activeRestaurantId,available:true};state.items.push(item);created++}Object.assign(item,{categoryId:category.id,name:row.item_name.trim().slice(0,120),description:(row.description||'').trim().slice(0,500),price:Number(row.price),type:String(row.food_type||'Veg').trim().toLowerCase().includes('non')?'Non-Veg':'Veg',available:Gravity58MenuData.csvBoolean(row.available,true),prep:Math.max(0,Number(row.preparation_minutes)||0),prepareInstructionsEnabled:Gravity58MenuData.csvBoolean(row.preparation_instructions,false)});if(row.image_url)item.imageUrl=row.image_url.trim()}await persistCloudMenu();menuView();toast(`${created} created, ${updated} updated from CSV`)}catch(error){toast(error.message||'Could not import menu CSV')}finally{$('#menuCsvFile')&&($('#menuCsvFile').value='')}}
function addCategory(){modal('Add Category',`<form id="categoryForm"><div class="field"><label>Category name</label><input name="name" required></div><button class="btn full">Create Category</button></form>`,()=>{$('#categoryForm').onsubmit=async e=>{e.preventDefault();const d=Object.fromEntries(new FormData(e.target));state.categories.push({id:uid('cat'),restaurantId:state.activeRestaurantId,name:d.name});try{await persistCloudMenu();closeModal();menuView();toast('Category created')}catch(error){toast(error.message||'Could not save category')}}})}
function itemForm(i={}){const cats=restaurantCategories(),category=state.categories.find(c=>c.id===i.categoryId);return `<form id="itemForm"><datalist id="categorySuggestions">${cats.map(c=>`<option value="${html(c.name)}">`).join('')}</datalist><div class="form-grid"><div class="field"><label>Item name</label><input name="name" value="${html(i.name||'')}" required></div><div class="field"><label>Category <small>(type your own)</small></label><input name="categoryName" list="categorySuggestions" value="${html(category?.name||'')}" placeholder="Example: Starters" required></div><div class="field"><label>Price</label><input name="price" type="number" min="0" value="${i.price||''}" required></div><div class="field"><label>Food type</label><select name="type"><option ${i.type==='Veg'?'selected':''}>Veg</option><option ${i.type==='Non-Veg'?'selected':''}>Non-Veg</option></select></div><div class="field local-image-field"><label>Menu item image <small>(${isCloudMenuSession()?'saved to your G58 account':'demo browser storage'})</small></label><input name="imageFile" type="file" accept="image/jpeg,image/png,image/webp"><div class="image-preview menu-item-preview">${imageMarkup(localMediaSource(i,'imageKey','imageData'),i.name?.[0]||'G','menu-preview-image')}</div></div><div class="field"><label>Preparation minutes</label><input name="prep" type="number" min="0" value="${i.prep||15}"></div><div class="field"><label>Allow customer preparation instructions</label><select name="prepareInstructionsEnabled"><option value="true" ${i.prepareInstructionsEnabled?'selected':''}>Enabled</option><option value="false" ${!i.prepareInstructionsEnabled?'selected':''}>Disabled</option></select></div></div><div class="field"><label>Description</label><textarea name="description">${html(i.description||'')}</textarea></div><button class="btn full">Save Menu Item</button></form>`}
function openItemForm(id=null){
  const i=id?state.items.find(x=>x.id===id):{};
  modal(id?'Edit Menu Item':'Add Menu Item',itemForm(i),()=>{
    const form=$('#itemForm'),file=form.imageFile,preview=$('.menu-item-preview');let previewUrl='';
    file.onchange=async()=>{try{const blob=await optimizeLocalImage(file.files[0]);file._optimizedBlob=blob;if(previewUrl)URL.revokeObjectURL(previewUrl);previewUrl=URL.createObjectURL(blob);preview.innerHTML=imageMarkup(previewUrl,'G','menu-preview-image')}catch(error){file.value='';toast(error.message)}};
    form.onsubmit=async e=>{
      e.preventDefault();const fd=new FormData(e.target),selectedFile=fd.get('imageFile');fd.delete('imageFile');const d=Object.fromEntries(fd),categoryName=d.categoryName.trim();delete d.categoryName;let category=restaurantCategories().find(c=>c.name.trim().toLowerCase()===categoryName.toLowerCase());if(!category){category={id:uid('cat'),restaurantId:state.activeRestaurantId,name:categoryName};state.categories.push(category)}const button=e.submitter;button.disabled=true;button.textContent='Saving…';
      try{
        const item=id?i:{id:uid('item'),restaurantId:state.activeRestaurantId,available:true};
        Object.assign(item,{...d,categoryId:category.id,price:+d.price,prep:+d.prep,prepareInstructionsEnabled:d.prepareInstructionsEnabled==='true'});
        if(selectedFile?.size){const blob=file._optimizedBlob||await optimizeLocalImage(selectedFile);if(isCloudMenuSession()){const oldFile=item.imageFileId,upload=await uploadMenuImage(blob,item.name);item.imageUrl=upload.mediaUrl;item.imageFileId=upload.fileId;if(oldFile&&oldFile!==upload.fileId)Gravity58Ads.removeAdMedia(oldFile).catch(()=>{})}else{const key=item.imageKey||`menu-item:${item.id}`;await putLocalMedia(key,blob);item.imageKey=key;item.imageData=''}}
        if(!id)state.items.push(item);await persistCloudMenu();if(previewUrl)URL.revokeObjectURL(previewUrl);closeModal();menuView();toast(isCloudMenuSession()?'Menu item saved to your G58 account':'Menu item saved in this browser')
      }catch(error){button.disabled=false;button.textContent='Save Menu Item';toast(error.message||'Could not save menu item')}
    };
  });
}
function bindMenuActions(){$$('[data-item-edit]').forEach(b=>b.onclick=()=>openItemForm(b.dataset.itemEdit));$$('[data-stock]').forEach(b=>b.onclick=async()=>{const i=state.items.find(x=>x.id===b.dataset.stock);i.available=!i.available;try{await persistCloudMenu();menuView()}catch(error){i.available=!i.available;toast(error.message||'Could not update availability')}});$$('[data-item-delete]').forEach(b=>b.onclick=async()=>{const i=state.items.find(x=>x.id===b.dataset.itemDelete);if(!i||!confirm(`Delete ${i.name} from this menu?`))return;state.items=state.items.filter(x=>x.id!==i.id);try{await persistCloudMenu();deleteLocalMedia(i.imageKey);if(isCloudMenuSession()&&i.imageFileId)Gravity58Ads.removeAdMedia(i.imageFileId).catch(()=>{});menuView();toast('Menu item deleted')}catch(error){state.items.push(i);toast(error.message||'Could not delete menu item')}})}
function ordersView(){const statuses=['All','Pending','Accepted','Preparing','Ready','Completed','Rejected'];$('#page').innerHTML=`<div class="section-head"><div><h1>Live Orders</h1><p class="muted">Restaurant-specific real-time order board</p></div><button class="btn" id="simulate">+ Simulate Customer Order</button></div><div class="tabs">${statuses.map((s,i)=>`<button class="btn small ${i?'secondary':''}" data-tab="${s}">${s}</button>`).join('')}</div><div class="grid order-grid" id="ordersGrid" style="margin-top:16px">${restaurantOrders().map(orderCard).join('')||empty('No orders yet')}</div>`;$('#simulate').onclick=simulateOrder;$$('[data-tab]').forEach(b=>b.onclick=()=>{$$('[data-tab]').forEach(x=>x.className='btn small secondary');b.className='btn small';const s=b.dataset.tab;$('#ordersGrid').innerHTML=restaurantOrders().filter(o=>s==='All'||o.status===s).map(orderCard).join('')||empty(`No ${s.toLowerCase()} orders`);bindOrderActions()});bindOrderActions()}
function orderCard(o){const identity=o.serviceMode==='table'?`Table ${o.tableNumber||'-'}`:'Single Counter';const pay=o.paymentMethod==='online'?`Online · ${o.transactionId||'No ID'}`:'Pay at counter';return `<article class="card order-card" data-status="${o.status}"><div class="section-head" style="margin:0 0 8px"><div><strong>${o.id}</strong><div class="muted">${o.customerName||o.customer||'Guest'} · ${identity}</div>${o.phone?`<small class="muted">☎ ${o.phone}</small>`:''}</div><span class="chip">${o.status}</span></div><div class="chips"><span class="chip">${pay}</span>${o.paymentStatus?`<span class="chip">${o.paymentStatus}</span>`:''}</div><div class="order-items">${o.items.map(i=>`<div class="staff-order-item"><strong>${i.qty} × ${i.name}</strong>${i.prepareInstruction?`<div class="staff-prep-note"><span>Preparation:</span> ${i.prepareInstruction}</div>`:''}</div>`).join('')}</div><h3 style="margin:12px 0">${money(o.total)}</h3><div class="actions">${orderActions(o)}</div></article>`}
function orderActions(o){const map={'Payment Verification':['Confirm Payment','Reject Payment'],Pending:['Accept','Reject'],Accepted:['Start Preparing'],Preparing:['Mark Ready'],Ready:['Complete']};return (map[o.status]||[]).map(a=>`<button class="btn small ${a==='Reject'?'red':['Start Preparing','Mark Ready','Complete'].includes(a)?'green':''}" data-order="${o.id}" data-action="${a}">${a}</button>`).join('')}
function bindOrderActions(){$$('[data-order]').forEach(b=>b.onclick=()=>updateOrder(b.dataset.order,b.dataset.action))}
function updateOrder(id,action){const o=state.orders.find(x=>x.id===id);const next={Accept:'Accepted',Reject:'Rejected','Confirm Payment':'Pending','Reject Payment':'Payment Rejected','Start Preparing':'Preparing','Mark Ready':'Ready',Complete:'Completed'}[action];if(!next)return;o.status=next;if(action==='Confirm Payment')o.paymentStatus='Confirmed';if(action==='Reject Payment')o.paymentStatus='Rejected';o.updatedAt=now();save();toast(action==='Mark Ready'?`Order ${o.id}: Food is ready`:`Order ${o.id}: ${next}`);view==='orders'?ordersView():dashboardView()}
function simulateOrder(){const items=restaurantItems().filter(x=>x.available);if(!items.length)return toast('No available menu items');const picked=items.slice(0,Math.min(2,items.length)).map((i,n)=>({name:i.name,qty:n+1,price:i.price}));state.orders.unshift({id:`GR58-${Math.floor(1000+Math.random()*8999)}`,restaurantId:state.activeRestaurantId,customer:activeRestaurant().identification==='Customer Name'?'Demo Customer':'Table 1',items:picked,total:picked.reduce((a,b)=>a+b.qty*b.price,0),status:'Pending',createdAt:now()});save();toast('New order received');view==='orders'?ordersView():dashboardView()}
function slugify(value){return String(value||'restaurant').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'').slice(0,60)||'restaurant'}
function blobToDataUrl(blob){return new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result);reader.onerror=()=>reject(reader.error||new Error('Could not encode image'));reader.readAsDataURL(blob)})}
async function exportImageData(record,keyName,legacyName){if(record?.[keyName]){const blob=await getLocalMedia(record[keyName]);if(blob)return blobToDataUrl(blob)}return String(record?.[legacyName]||'').startsWith('data:image/')?record[legacyName]:''}
async function buildMenuConfig(restaurantId=state.activeRestaurantId){
  const source=state.restaurants.find(row=>row.id===restaurantId);if(!source)throw new Error('Restaurant not found');
  const restaurantFields=['id','name','type','city','description','address','phone','open','accepting','tax','service','identification','restaurantKey','social'];
  const restaurant=Object.fromEntries(restaurantFields.map(key=>[key,source[key]]));restaurant.logoImage=await exportImageData(source,'logoImageKey','logoImage');
  const categories=restaurantCategories(restaurantId).map(({id,name})=>({id,name}));
  const items=[];for(const row of restaurantItems(restaurantId)){items.push({id:row.id,categoryId:row.categoryId,name:row.name,description:row.description||'',price:Number(row.price)||0,type:row.type==='Non-Veg'?'Non-Veg':'Veg',available:row.available!==false,prep:Number(row.prep)||0,prepareInstructionsEnabled:!!row.prepareInstructionsEnabled,imageData:await exportImageData(row,'imageKey','imageData')})}
  return {g58MenuConfig:1,exportedAt:now(),restaurant,categories,items};
}
function validateMenuConfig(config){if(!config||config.g58MenuConfig!==1||!config.restaurant?.name||!Array.isArray(config.categories)||!Array.isArray(config.items))throw new Error('Select a valid Gravity58 menu config file');if(config.items.length>1000)throw new Error('Menu config contains too many items');return config}
function downloadFile(name,contents,type='application/json'){const url=URL.createObjectURL(new Blob([contents],{type})),link=document.createElement('a');link.href=url;link.download=name;document.body.appendChild(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),1000)}
async function downloadMenuConfig(){const button=$('#downloadMenuConfig');if(button){button.disabled=true;button.textContent='Preparing config…'}try{const config=await buildMenuConfig();downloadFile(`${slugify(config.restaurant.name)}-g58-menu.json`,JSON.stringify(config,null,2));toast('Menu config downloaded')}catch(error){toast(error.message||'Could not create config')}finally{if(button){button.disabled=false;button.textContent='Download Menu Config'}}}
async function importMenuConfigFile(file){
  if(!file)return;if(file.size>30*1024*1024)return toast('Config file must be below 30 MB');
  try{
    const config=validateMenuConfig(JSON.parse(await file.text())),ownerId=state.session?.userId;if(!ownerId)throw new Error('Login before importing a menu');
    const rid=uid('res'),categoryMap=new Map(),restaurant={...config.restaurant,id:rid,ownerId,restaurantKey:`${config.restaurant.name}|${config.restaurant.city}`,logo:'G',paymentEnabled:false,upiId:'',paymentLink:''};delete restaurant.logoImage;
    if(config.restaurant.logoImage){const key=`restaurant:${rid}`,blob=await fetch(config.restaurant.logoImage).then(response=>response.blob());await putLocalMedia(key,blob);restaurant.logoImageKey=key}
    const categories=config.categories.map(row=>{const id=uid('cat');categoryMap.set(row.id,id);return {id,restaurantId:rid,name:String(row.name||'Uncategorised')}});
    const items=[];for(const row of config.items){const id=uid('item'),item={...row,id,restaurantId:rid,categoryId:categoryMap.get(row.categoryId)||categories[0]?.id||'',available:row.available!==false};delete item.imageData;if(row.imageData){const key=`menu-item:${id}`,blob=await fetch(row.imageData).then(response=>response.blob());await putLocalMedia(key,blob);item.imageKey=key}items.push(item)}
    state.restaurants.push(restaurant);state.categories.push(...categories);state.items.push(...items);state.activeRestaurantId=rid;await persistCloudMenu(rid);Gravity58Ads?.upsertSlot({id:rid,restaurantKey:restaurant.restaurantKey,name:restaurant.name,city:restaurant.city,active:true}).catch(()=>{});closeModal();view='publish';renderShell();toast(isCloudMenuSession()?'Menu imported to your G58 account':'Menu config imported into this browser')
  }catch(error){toast(error.message||'Could not import config')}
}
function customerMenuUrl(configUrl){return `${location.href.split('#')[0]}#menu&config=${encodeURIComponent(configUrl)}`}
function cloudCustomerMenuUrl(restaurant=activeRestaurant()){return `${location.href.split('#')[0]}#menu&cloud=${encodeURIComponent(restaurant.cloudRecordId||restaurant.id)}&owner=${encodeURIComponent(cloudOwnerId())}`}
function renderPublishResult(r){const area=$('#publishResult');if(!area)return;const configUrl=(r.publishedConfigUrl||'').trim();if(!configUrl){area.innerHTML='<div class="publish-empty">Enter the public HTTPS address of your uploaded config file.</div>';return}const url=customerMenuUrl(configUrl);area.innerHTML=`<div class="published-link-card"><div><span class="eyebrow">CUSTOMER MENU LINK</span><a href="${html(url)}" target="_blank" rel="noopener">${html(url)}</a><p>Customers opening this URL download the static menu config into their browser. Advertisement slots continue loading from Gravity58.</p></div><div class="qr-wrap"><div id="publishedMenuQr"></div></div><div class="actions"><button class="btn" id="copyPublishedLink">Copy Customer Link</button><a class="btn secondary" href="${html(url)}" target="_blank" rel="noopener">Open Menu</a></div></div>`;try{new QRCode($('#publishedMenuQr'),{text:url,width:170,height:170})}catch{$('#publishedMenuQr').textContent='QR unavailable'}$('#copyPublishedLink').onclick=()=>navigator.clipboard?.writeText(url).then(()=>toast('Customer link copied'))}
function publishSetupView(){
  const r=activeRestaurant();if(isCloudMenuSession()){const url=cloudCustomerMenuUrl(r);$('#page').innerHTML=`<div class="section-head"><div><h1>Share Menu</h1><p class="muted">Your restaurant configuration is already published through your authenticated G58 account.</p></div></div><article class="card cloud-share-card"><div><span class="publish-step">LIVE</span><h2>${html(r.name)} customer menu</h2><p>Menu items, categories, images and availability are loaded from this restaurant’s account-scoped Appwrite record. Changes made in Menu Setup update this link automatically.</p><a href="${html(url)}" target="_blank" rel="noopener">${html(url)}</a><div class="actions"><button class="btn" id="copyCloudMenuLink">Copy Customer Link</button><a class="btn secondary" href="${html(url)}" target="_blank" rel="noopener">Open Customer Menu</a></div></div><div class="qr-wrap"><div id="cloudMenuQr"></div></div></article><article class="card"><h2>Bulk menu setup</h2><p class="muted">Open Menu Setup to download the CSV template and import up to 100 dishes at a time. Imported items are saved to this same G58 account.</p><button class="btn secondary" id="openMenuSetup">Open Menu Setup</button></article>`;try{new QRCode($('#cloudMenuQr'),{text:url,width:220,height:220})}catch{$('#cloudMenuQr').textContent='QR unavailable'}$('#copyCloudMenuLink').onclick=()=>navigator.clipboard?.writeText(url).then(()=>toast('Customer link copied'));$('#openMenuSetup').onclick=()=>{view='menu';renderShell()};return}
  $('#page').innerHTML=`<div class="section-head"><div><h1>Publish & Setup</h1><p class="muted">Turn this demo browser restaurant into a customer-visible static menu.</p></div></div><section class="publish-setup-grid"><article class="card publish-primary"><span class="publish-step">01</span><h2>Download your menu config</h2><p>The JSON file contains this restaurant, categories, menu items and compressed food images. It contains no owner password.</p><div class="actions"><button class="btn" id="downloadMenuConfig">Download Menu Config</button><button class="btn secondary" id="importMenuConfig">Import Config</button><input id="importConfigFile" type="file" accept="application/json,.json" hidden></div></article><article class="card publish-instructions"><span class="publish-step">02</span><h2>Host the config file</h2><ol><li>Upload the downloaded JSON file to your own public HTTPS hosting.</li><li>Copy its direct public URL, paste it below, and generate the customer menu link.</li></ol></article></section><article class="card publish-link-builder"><span class="publish-step">03</span><h2>Create the customer link</h2><form id="publishUrlForm"><div class="field"><label>Public config file URL</label><input name="configUrl" type="url" value="${html(r.publishedConfigUrl||'')}" placeholder="https://your-site.com/menu-config.json" required></div><button class="btn">Save URL & Generate Link</button></form><div id="publishResult"></div></article>`;
  $('#downloadMenuConfig').onclick=downloadMenuConfig;$('#importMenuConfig').onclick=()=>$('#importConfigFile').click();$('#importConfigFile').onchange=e=>importMenuConfigFile(e.target.files[0]);$('#publishUrlForm').onsubmit=e=>{e.preventDefault();const value=new FormData(e.target).get('configUrl').trim();try{const url=new URL(value);if(url.protocol!=='https:')throw new Error('Use a public HTTPS config URL');r.publishedConfigUrl=url.href;save();renderPublishResult(r);toast('Customer menu link ready')}catch(error){toast(error.message||'Enter a valid HTTPS URL')}};renderPublishResult(r)
}
function qrView(){const r=activeRestaurant(),cloud=isCloudMenuSession(),published=cloud||!!r.publishedConfigUrl,url=cloud?cloudCustomerMenuUrl(r):r.publishedConfigUrl?customerMenuUrl(r.publishedConfigUrl):`${location.href.split('#')[0]}#menu&restaurant=${r.id}`;$('#page').innerHTML=`<div class="section-head"><div><h1>QR Codes</h1><p class="muted">${cloud?'Account-synced customer menu QR':published?'Customer-ready published menu QR':'Owner-browser preview QR only'}</p></div><button class="btn secondary" id="previewQr">Preview Menu</button></div>${published?'':`<div class="publish-warning"><strong>This QR works only on this browser.</strong><span>Open Publish & Setup before sharing it with customers.</span><button class="btn small" id="openPublishSetup">Open Publish & Setup</button></div>`}<article class="card qr-card"><h2>${html(r.name)}</h2><p>${published?'Scan to View Menu':'Local Preview'}</p><div class="qr-wrap"><div id="qrcode"></div></div><div class="actions" style="margin-top:18px"><button class="btn" id="copyQr">Copy Menu Link</button><button class="btn secondary" onclick="window.print()">Print</button></div><small class="muted" style="margin-top:16px">Powered by Gravity58 Digital Menu</small></article>`;try{new QRCode($('#qrcode'),{text:url,width:220,height:220})}catch{$('#qrcode').innerHTML='<div style="color:#111;padding:70px 25px">QR library requires internet once</div>'}$('#copyQr').onclick=()=>navigator.clipboard?.writeText(url).then(()=>toast('Menu link copied'));$('#previewQr').onclick=()=>published?window.open(url,'_blank'):location.hash=`menu&restaurant=${r.id}`;$('#openPublishSetup')?.addEventListener('click',()=>{view='publish';renderShell()})}
function reportsView(){const orders=restaurantOrders(),sales=orders.filter(x=>x.status==='Completed').reduce((a,b)=>a+b.total,0);$('#page').innerHTML=`<div class="section-head"><div><h1>Reports</h1><p class="muted">Data for ${activeRestaurant().name} only</p></div></div><div class="grid stats">${metric('Total Orders',orders.length)}${metric('Completed',orders.filter(x=>x.status==='Completed').length)}${metric('Total Sales',money(sales))}${metric('Average Order',money(orders.length?orders.reduce((a,b)=>a+b.total,0)/orders.length:0))}</div><div class="section-head"><h2>All Restaurants Overview</h2></div><div class="grid restaurant-grid">${ownerRestaurants().map(r=>{const os=restaurantOrders(r.id);return `<article class="card"><h3>${r.logo} ${r.name}</h3><p class="muted">${os.length} orders · ${money(os.filter(x=>x.status==='Completed').reduce((a,b)=>a+b.total,0))} sales</p></article>`}).join('')}</div>`}
function adsView(){const key=`${activeRestaurant().name}|${activeRestaurant().city}`;const ads=(state.advertisements||[]).filter(a=>a.restaurantKey===key);const requests=state.adRequests||[];$('#page').innerHTML=`<div class="section-head"><div><h1>Gravity58 Advertisement Control</h1><p class="muted">Central ad control using unique restaurant key: <strong>${key}</strong></p></div><button class="btn" id="createAd">+ Create Advertisement</button></div><div class="grid stats">${metric('Active Ads',ads.filter(a=>a.active).length)}${metric('Restaurant Ads',ads.length)}${metric('Ad Enquiries',requests.length)}${metric('Pending Enquiries',requests.filter(x=>x.status!=='Contacted').length)}</div><div class="section-head"><h2>Advertisements for this restaurant</h2></div><div class="grid restaurant-grid">${ads.map(a=>`<article class="card"><div class="ad-icon">${a.image||'📣'}</div><h3>${a.title}</h3><p class="muted">${a.description}</p><div class="chips"><span class="chip">${a.active?'Enabled':'Disabled'}</span><span class="chip">${a.restaurantKey}</span></div><div class="actions"><button class="btn small" data-toggle-ad="${a.id}">${a.active?'Disable':'Enable'}</button><button class="btn small red" data-delete-ad="${a.id}">Delete</button></div></article>`).join('')||empty('No advertisement enabled. Customers will see the Ad Space placeholder.')}</div><div class="section-head"><h2>Ad-space enquiries</h2></div><div class="card table-wrap"><table><thead><tr><th>Name</th><th>Phone</th><th>Email</th><th>Restaurant</th><th>Status</th><th></th></tr></thead><tbody>${requests.map(q=>`<tr><td>${q.name}</td><td>${q.phone}</td><td>${q.email}</td><td>${q.restaurantKey}</td><td>${q.status||'New'}</td><td><button class="btn small secondary" data-contacted="${q.id}">Mark Contacted</button></td></tr>`).join('')||'<tr><td colspan="6" class="muted">No enquiries yet.</td></tr>'}</tbody></table></div>`;$('#createAd').onclick=()=>modal('Create G58 Advertisement',`<form id="adForm"><div class="field"><label>Restaurant key</label><input value="${key}" disabled></div><div class="field"><label>Title</label><input name="title" required></div><div class="field"><label>Description</label><textarea name="description" required></textarea></div><div class="form-grid"><div class="field"><label>Button label</label><input name="buttonLabel" value="View Offer"></div><div class="field"><label>Destination URL</label><input name="destinationUrl" value="#"></div><div class="field"><label>Icon / Emoji</label><input name="image" value="📣"></div><div class="field"><label>Status</label><select name="active"><option value="true">Enabled</option><option value="false">Disabled</option></select></div></div><button class="btn full">Save Advertisement</button></form>`,()=>{$('#adForm').onsubmit=e=>{e.preventDefault();const d=Object.fromEntries(new FormData(e.target));state.advertisements.push({id:uid('ad'),restaurantKey:key,...d,active:d.active==='true'});save();closeModal();adsView();toast('Advertisement saved')}});$$('[data-toggle-ad]').forEach(b=>b.onclick=()=>{const a=state.advertisements.find(x=>x.id===b.dataset.toggleAd);a.active=!a.active;save();adsView()});$$('[data-delete-ad]').forEach(b=>b.onclick=()=>{state.advertisements=state.advertisements.filter(x=>x.id!==b.dataset.deleteAd);save();adsView()});$$('[data-contacted]').forEach(b=>b.onclick=()=>{const q=state.adRequests.find(x=>x.id===b.dataset.contacted);q.status='Contacted';save();adsView()})}
function currentAdvertisement(r,slotId='right_rail'){const restaurantKey=`${r.name}|${r.city}`,ts=Date.now();return (state.advertisements||[]).filter(a=>a.restaurantKey===restaurantKey&&a.active&&(!a.slotId||a.slotId===slotId)&&(!a.expiresAt||new Date(a.expiresAt).getTime()>ts)).sort((a,b)=>new Date(b.activatedAt||b.createdAt||0)-new Date(a.activatedAt||a.createdAt||0))[0]}
function adTimeLeft(ad){if(!ad?.expiresAt)return 'Slot duration not set';const ms=new Date(ad.expiresAt).getTime()-Date.now();if(ms<=0)return 'Expired';const h=Math.floor(ms/36e5),m=Math.floor((ms%36e5)/6e4);return `${h}h ${m}m remaining`}
function publicAdSection(r){const slotId=location.hash.includes('track')?(location.hash.includes('Completed')?'thankyou':'preparing'):'right_rail';const ad=currentAdvertisement(r,slotId);if(ad)return `<section class="public-ad active-ad"><div class="ad-art">${ad.image||'📣'}</div><div><p class="eyebrow">SPONSORED PROMOTION</p><h3>${ad.title}</h3><p>${ad.description}</p><small class="ad-expiry" data-ad-expiry="${ad.expiresAt||''}">${adTimeLeft(ad)}</small></div><a class="btn" href="${ad.destinationUrl||'#'}" target="_blank">${ad.buttonLabel||'View Offer'}</a></section>`;return `<section class="public-ad ad-placeholder"><div class="ad-art">✦</div><div><p class="eyebrow">GRAVITY58 AD SPACE</p><h3>Your advertisement can appear here</h3><p>Book a restaurant-specific advertising slot through Gravity58.</p></div><button class="btn secondary" id="contactG58Ads">Contact Gravity58 for Ad Space</button></section>`}
function bindPublicAdContact(r){const b=$('#contactG58Ads');if(!b)return;b.onclick=()=>{const base=CONFIG.adBookingPortalUrl||'../advertise/';location.href=`${base}?restaurant=${encodeURIComponent(`${r.name}|${r.city}`)}`}}
function settingsView(){const r=activeRestaurant(),cloud=isCloudMenuSession();$('#page').innerHTML=`<div class="section-head"><div><h1>Restaurant Settings</h1><p class="muted">Settings apply only to ${r.name}</p></div></div><article class="card"><form id="settingsForm"><div class="form-grid"><div class="field"><label>Restaurant status</label><select name="open"><option value="true" ${r.open?'selected':''}>Open</option><option value="false" ${!r.open?'selected':''}>Closed</option></select></div><div class="field"><label>Accept orders</label><select name="accepting"><option value="true" ${r.accepting?'selected':''}>Yes</option><option value="false" ${!r.accepting?'selected':''}>No</option></select></div><div class="field"><label>Tax %</label><input name="tax" type="number" value="${r.tax||0}"></div><div class="field"><label>Service charge %</label><input name="service" type="number" value="${r.service||0}"></div><div class="field"><label>Enable customer payment</label><select name="paymentEnabled"><option value="true" ${r.paymentEnabled?'selected':''}>Enabled</option><option value="false" ${!r.paymentEnabled?'selected':''}>Disabled</option></select></div><div class="field"><label>UPI ID</label><input name="upiId" value="${r.upiId||''}" placeholder="restaurant@upi"></div><div class="field"><label>Payment link (optional)</label><input name="paymentLink" value="${r.paymentLink||''}" placeholder="https://..."></div><div class="field"><label>Instagram URL</label><input name="instagram" value="${r.social?.Instagram||''}"></div><div class="field"><label>WhatsApp URL</label><input name="whatsapp" value="${r.social?.WhatsApp||''}"></div></div><p class="muted">${cloud?'These restaurant settings sync with your G58 account. ':''}Online payments remain unconfirmed until staff verify the customer transaction ID.</p><button class="btn">Save Settings</button>${cloud?'':'<button type="button" class="btn red" id="resetDemo">Reset Demo Data</button>'}</form></article>`;$('#settingsForm').onsubmit=async e=>{e.preventDefault();const d=Object.fromEntries(new FormData(e.target)),button=e.submitter;button.disabled=true;Object.assign(r,{open:d.open==='true',accepting:d.accepting==='true',tax:+d.tax,service:+d.service,paymentEnabled:d.paymentEnabled==='true',upiId:d.upiId,paymentLink:d.paymentLink,social:{...r.social,Instagram:d.instagram,WhatsApp:d.whatsapp}});try{await persistCloudMenu(r.id);toast('Settings saved');renderShell()}catch(error){button.disabled=false;toast(error.message||'Could not save settings')}};$('#resetDemo')?.addEventListener('click',async()=>{if(confirm('Reset all demo data?')){await clearLocalMedia();state={...structuredClone(seed),advertisements:[],adRequests:[]};save();render();hydrateAdvertisements()}})}

async function loadRemoteMenuConfig(source){
  if(remoteMenuLoading)return;remoteMenuLoading=true;app.innerHTML='<main class="public-menu"><div class="remote-menu-loading"><span></span><h2>Loading published menu</h2><p>Downloading the restaurant config securely…</p></div></main>';
  try{const url=new URL(source,location.href);if(!['https:','http:'].includes(url.protocol))throw new Error('Unsupported config URL');const response=await fetch(url.href,{mode:'cors',credentials:'omit'});if(!response.ok)throw new Error(`Config download failed (${response.status})`);const text=await response.text();if(text.length>30*1024*1024)throw new Error('Menu config is too large');remoteMenuConfig=validateMenuConfig(JSON.parse(text));remoteMenuSource=source;remoteMenuLoading=false;renderPublicMenu()}catch(error){remoteMenuLoading=false;remoteMenuSource='';remoteMenuConfig=null;app.innerHTML=`<main class="public-menu"><div class="remote-menu-error"><h2>Menu could not be loaded</h2><p>${html(error.message||'Check the public config URL and hosting permissions.')}</p><a class="btn" href="${location.href.split('#')[0]}">Return to Digital Menu</a></div></main>`}
}

function cloudRecordToConfig(record){if(!record?.restaurant?.id||!Array.isArray(record.categories)||!Array.isArray(record.items))throw new Error('This restaurant menu is not available');return {g58MenuConfig:1,restaurant:{...record.restaurant},categories:record.categories.map(row=>({...row,restaurantId:record.restaurant.id})),items:record.items.map(row=>({...row,restaurantId:record.restaurant.id,available:row.available!==false}))}}
function cacheCloudMenuForOrders(config,ownerId){const rid=config.restaurant.id,existing=state.restaurants.find(row=>row.id===rid),ownerIdForCache=existing?.ownerId||`public_${ownerId}`;state.restaurants=state.restaurants.filter(row=>row.id!==rid);state.categories=state.categories.filter(row=>row.restaurantId!==rid);state.items=state.items.filter(row=>row.restaurantId!==rid);state.restaurants.push({...config.restaurant,ownerId:ownerIdForCache,cloudRecordId:rid,logo:'G'});state.categories.push(...config.categories.map(row=>({...row,restaurantId:rid})));state.items.push(...config.items.map(row=>({...row,restaurantId:rid})));save()}
async function loadCloudMenuConfig(recordId,ownerId){if(remoteMenuLoading)return;remoteMenuLoading=true;app.innerHTML='<main class="public-menu"><div class="remote-menu-loading"><span></span><h2>Loading restaurant menu</h2><p>Reading the latest menu from Gravity58…</p></div></main>';try{if(!recordId||!ownerId)throw new Error('Invalid customer menu link');const record=await Gravity58Ads.get(cloudMenuKind(ownerId),recordId);if(record.ownerId!==ownerId)throw new Error('Restaurant menu owner does not match this link');remoteMenuConfig=cloudRecordToConfig(record);remoteMenuSource=`cloud:${ownerId}:${recordId}`;cacheCloudMenuForOrders(remoteMenuConfig,ownerId);remoteMenuLoading=false;renderPublicMenu()}catch(error){remoteMenuLoading=false;remoteMenuSource='';remoteMenuConfig=null;app.innerHTML=`<main class="public-menu"><div class="remote-menu-error"><h2>Menu could not be loaded</h2><p>${html(error.message||'Ask the restaurant for its latest menu QR code.')}</p><a class="btn" href="${location.href.split('#')[0]}">Return to Digital Menu</a></div></main>`}}

function renderPublicMenu(){
  const params=new URLSearchParams(location.hash.replace('#menu&',''));
  const configUrl=params.get('config')||'',cloudId=params.get('cloud')||'',cloudMenu=!!cloudId,ownerId=params.get('owner')||'',published=!!configUrl,sharedMenu=published||cloudMenu;
  if(published&&remoteMenuSource!==configUrl){loadRemoteMenuConfig(configUrl);return}
  if(cloudMenu&&remoteMenuSource!==`cloud:${ownerId}:${cloudId}`){loadCloudMenuConfig(cloudId,ownerId);return}
  const rid=sharedMenu?remoteMenuConfig?.restaurant?.id:(params.get('restaurant')||state.activeRestaurantId);
  const r=sharedMenu?remoteMenuConfig?.restaurant:state.restaurants.find(x=>x.id===rid);
  if(!r){app.innerHTML=`<main class="public-menu"><div class="empty">Restaurant not found</div></main>`;return}
  customerContext=published?null:JSON.parse(sessionStorage.getItem(`gravity58Customer_${rid}`)||'null');
  if(!published&&!customerContext){
    modal('Welcome to '+r.name,`<form id="identityForm" class="customer-entry-form"><div class="field centered-field"><label>Customer name <small id="nameRequirement">(required for counter orders)</small></label><input name="customerName" required placeholder="Enter your name"></div><div class="service-choice"><label class="choice-card"><input type="radio" name="serviceMode" value="counter" checked><span><strong>Single Counter</strong><small>Collect from the service counter</small></span></label><label class="choice-card"><input type="radio" name="serviceMode" value="table"><span><strong>Enter Table Number</strong><small>Order for your table</small></span></label></div><div class="field" id="tableNumberField" hidden><label>Table number</label><input name="tableNumber" placeholder="Example: 12"></div><div class="field"><label>Phone number <small>(optional)</small></label><input name="phone" type="tel" placeholder="Optional contact number"></div><button class="btn full">Continue to Menu</button></form>`,()=>{const form=$('#identityForm'),tableField=$('#tableNumberField'),nameNote=$('#nameRequirement');const syncIdentity=()=>{const table=form.serviceMode.value==='table';tableField.hidden=!table;form.tableNumber.required=table;form.customerName.required=!table;nameNote.textContent=table?'(optional for table orders)':'(required for counter orders)';form.customerName.placeholder=table?'Optional customer name':'Enter your name'};$$('input[name="serviceMode"]',form).forEach(x=>x.onchange=syncIdentity);syncIdentity();form.onsubmit=e=>{e.preventDefault();const d=Object.fromEntries(new FormData(e.target));const customerName=(d.customerName||'').trim();const tableNumber=(d.tableNumber||'').trim();if(d.serviceMode==='counter'&&!customerName)return toast('Enter customer name for counter order');if(d.serviceMode==='table'&&!tableNumber)return toast('Enter table number');customerContext={restaurantId:rid,customerName,serviceMode:d.serviceMode,tableNumber:d.serviceMode==='table'?tableNumber:'',phone:(d.phone||'').trim(),customer:d.serviceMode==='table'?`${customerName?customerName+' · ':''}Table ${tableNumber}`:customerName};sessionStorage.setItem(`gravity58Customer_${rid}`,JSON.stringify(customerContext));closeModal();renderPublicMenu()}})
  }
  const cats=sharedMenu?remoteMenuConfig.categories:restaurantCategories(rid),items=sharedMenu?remoteMenuConfig.items:restaurantItems(rid),heroItem=items.find(i=>i.available)||items[0];
  const filterKey=`gravity58MenuFilters_${rid}`;
  const filters={category:'all',diet:'all',search:'',available:false,sort:'recommended',...JSON.parse(sessionStorage.getItem(filterKey)||'{}')};
  const activeCategory=cats.find(c=>c.id===filters.category);
  const ad=currentAdvertisement(r);
  app.innerHTML=`<main class="public-menu compact-public-menu">
    <section class="compact-menu-hero">
      <nav class="menu-nav compact-nav"><div><h2>${html(r.name)}</h2><p>${html(r.type)} · ${html(r.city)}</p>${published?'<span class="published-menu-badge">Published customer menu</span>':cloudMenu?'<span class="published-menu-badge">Live account menu</span>':''}</div><a class="sponsor-mini" href="https://www.g58.in" target="_blank" rel="noopener">Sponsored by <strong>Gravity58</strong></a></nav>
      <div class="compact-hero-layout"><div><p class="eyebrow">PREMIUM DIGITAL MENU</p><h1>Fresh favourites,<br>ready to order</h1><p>${html(r.description)}</p><div class="compact-details"><span>📍 ${html(r.address||r.city)}</span><span>☎ ${html(r.phone||'Contact restaurant')}</span><span class="open-tag">${r.open?'Open now':'Closed'}</span></div></div><div class="compact-hero-dish">${imageMarkup(localMediaSource(heroItem,'imageKey','imageData')||localMediaSource(r,'logoImageKey','logoImage'),heroItem?.name?.[0]||r.name?.[0]||'G','compact-hero-photo')}</div></div>
    </section>
    <section class="menu-workspace" id="menu-list">
      <section class="focused-menu-panel">
        <div class="premium-menu-tools">
          <label class="premium-menu-search"><span>⌕</span><input id="publicMenuSearch" type="search" value="${html(filters.search)}" placeholder="Search dishes and categories" autocomplete="off"></label>
          <div class="premium-filter-row" aria-label="Menu filters">
            <button class="menu-filter-chip ${filters.diet==='all'?'active':''}" data-diet="all">All</button>
            <button class="menu-filter-chip veg-filter ${filters.diet==='Veg'?'active':''}" data-diet="Veg"><span class="food-dot veg"></span> Veg</button>
            <button class="menu-filter-chip nonveg-filter ${filters.diet==='Non-Veg'?'active':''}" data-diet="Non-Veg"><span class="food-dot nonveg"></span> Non-Veg</button>
            <label class="menu-filter-chip availability-filter ${filters.available?'active':''}"><input id="availableOnlyFilter" type="checkbox" ${filters.available?'checked':''}> Available</label>
            <select id="publicMenuSort" aria-label="Sort menu"><option value="recommended" ${filters.sort==='recommended'?'selected':''}>Recommended</option><option value="price-low" ${filters.sort==='price-low'?'selected':''}>Price: Low to High</option><option value="price-high" ${filters.sort==='price-high'?'selected':''}>Price: High to Low</option></select>
          </div>
        </div>
        <nav class="category-chip-strip" aria-label="Menu categories"><button class="category-chip ${filters.category==='all'?'active':''}" data-cat-select="all">All dishes</button>${cats.map(c=>`<button class="category-chip ${c.id===filters.category?'active':''}" data-cat-select="${c.id}">${html(c.name)}</button>`).join('')}</nav>
        <header class="focused-menu-heading"><div><p class="eyebrow">CURATED MENU</p><h2 id="publicMenuHeading">${html(activeCategory?.name||'All dishes')}</h2></div><span id="publicMenuCount">${items.length} items</span></header>
        <div class="poster-menu-list swiggy-menu-list" id="publicMenuItems">${items.map((item,index)=>publicItem(item,{categories:cats,index,readOnly:published})).join('')}</div>
        <div class="empty menu-filter-empty hidden" id="menuFilterEmpty">No dishes match these filters.</div>
      </section>
      <aside class="vertical-ad-rail">
        <button class="ad-space-contact" id="contactG58Ads" type="button">Contact Gravity58 for Ad Space</button>
        ${ad?`<a class="vertical-active-ad creative-${html(ad.creativeStyle||'spotlight')}" href="${html(ad.destinationUrl||'#')}" target="_blank"><span class="ad-label">SPONSORED</span><div class="vertical-ad-art">${adMediaMarkup(ad,'vertical-ad-media')}</div><h3>${html(ad.title)}</h3><p>${html(ad.description)}</p><strong>${html(ad.buttonLabel||'View Offer')} →</strong><small class="ad-expiry" data-ad-expiry="${html(ad.expiresAt||'')}">${adTimeLeft(ad)}</small></a>`:`<div class="vertical-ad-placeholder creative-flash"><span class="ad-label">GRAVITY58 AD SPACE</span><div class="vertical-ad-art"><span class="media-fallback">AD</span></div><h3>Advertise here</h3><p>Choose a slot, upload an image, GIF or video, and reserve it by the hour.</p><span class="ad-booking-note">Select the button above to book this space.</span></div>`}
      </aside>
    </section>
    ${published?`<div class="published-menu-footer"><span><strong>View-only published menu</strong><small>Contact the restaurant to place your order.</small></span>${r.phone?`<a class="btn" href="tel:${html(r.phone)}">Call Restaurant</a>`:''}</div>`:`<div class="cart-bar compact-cart"><span><span id="cartCount">${customerCart.reduce((a,b)=>a+b.qty,0)}</span> items · <span id="cartTotal">${money(customerCart.reduce((a,b)=>a+b.qty*b.price,0))}</span></span><button class="btn" id="openCart">View Cart</button></div>`}
  </main>`;
  const persistFilters=()=>sessionStorage.setItem(filterKey,JSON.stringify(filters));
  const applyFilters=()=>{
    const query=(filters.search||'').trim().toLowerCase();
    const cards=$$('#publicMenuItems .poster-menu-item');
    cards.sort((a,b)=>filters.sort==='price-low'?+a.dataset.price-+b.dataset.price:filters.sort==='price-high'?+b.dataset.price-+a.dataset.price:+a.dataset.order-+b.dataset.order).forEach(card=>$('#publicMenuItems').appendChild(card));
    let visible=0;
    cards.forEach(card=>{const show=(filters.category==='all'||card.dataset.category===filters.category)&&(filters.diet==='all'||card.dataset.type===filters.diet)&&(!filters.available||card.dataset.available==='true')&&(!query||card.dataset.search.includes(query));card.classList.toggle('hidden',!show);if(show)visible++});
    $$('.category-chip').forEach(chip=>chip.classList.toggle('active',chip.dataset.catSelect===filters.category));
    $$('[data-diet]').forEach(chip=>chip.classList.toggle('active',chip.dataset.diet===filters.diet));
    $('.availability-filter')?.classList.toggle('active',filters.available);
    const heading=cats.find(c=>c.id===filters.category)?.name||'All dishes';$('#publicMenuHeading').textContent=heading;$('#publicMenuCount').textContent=`${visible} item${visible===1?'':'s'}`;$('#menuFilterEmpty').classList.toggle('hidden',visible!==0);persistFilters();
  };
  $$('[data-cat-select]').forEach(b=>b.onclick=()=>{filters.category=b.dataset.catSelect;applyFilters()});
  $$('[data-diet]').forEach(b=>b.onclick=()=>{filters.diet=b.dataset.diet;applyFilters()});
  $('#availableOnlyFilter').onchange=e=>{filters.available=e.target.checked;applyFilters()};
  $('#publicMenuSort').onchange=e=>{filters.sort=e.target.value;applyFilters()};
  $('#publicMenuSearch').oninput=e=>{filters.search=e.target.value;applyFilters()};
  if(!published){$$('[data-qty-action]').forEach(b=>b.onclick=()=>changeCartQuantity(b.dataset.item,b.dataset.qtyAction));$$('[data-prepare-item]').forEach(c=>c.onchange=()=>{if(c.checked)openPreparationInstructions(c.dataset.prepareItem);else{const ci=customerCart.find(x=>x.id===c.dataset.prepareItem);if(ci){ci.prepareInstruction='';ci.prepareOptions=[];ci.customPrepareNote=''}renderPublicMenu()}});$('#openCart').onclick=()=>openCart(r)}
  bindPublicAdContact(r);applyFilters()
}
function selectPublicCategory(rid,catId){const key=`gravity58MenuFilters_${rid}`,filters={category:'all',diet:'all',search:'',available:false,sort:'recommended',...JSON.parse(sessionStorage.getItem(key)||'{}'),category:catId};sessionStorage.setItem(key,JSON.stringify(filters));renderPublicMenu()}
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
function publicItem(i,{categories=state.categories,index=state.items.indexOf(i),readOnly=false}={}){
  const cartItem=customerCart.find(x=>x.id===i.id),qty=cartItem?.qty||0;
  const instruction=cartItem?.prepareInstruction||'';
  const category=categories.find(c=>c.id===i.categoryId)?.name||'';
  const action=readOnly?(i.available?'<span class="public-available-label">AVAILABLE</span>':'<span class="out-label">SOLD OUT</span>'):(i.available?(qty?`<div class="quantity-control"><button data-qty-action="minus" data-item="${i.id}" aria-label="Remove one">−</button><strong>${qty}</strong><button data-qty-action="plus" data-item="${i.id}" aria-label="Add one">+</button></div>`:`<button class="btn small add-item" data-qty-action="plus" data-item="${i.id}">ADD</button>`):'<span class="out-label">SOLD OUT</span>');
  return `<article class="poster-menu-item swiggy-menu-item ${!i.available?'sold-out':''}" data-category="${html(i.categoryId)}" data-type="${html(i.type)}" data-available="${i.available?'true':'false'}" data-price="${Number(i.price)||0}" data-order="${index}" data-search="${html(`${i.name} ${i.description||''} ${category}`.toLowerCase())}"><div class="poster-item-copy swiggy-item-copy"><div class="poster-meta"><span class="food-dot ${i.type==='Veg'?'veg':'nonveg'}"></span><span>${html(i.type)}</span><span>•</span><span>${html(category)}</span></div><div class="poster-title-row"><h3>${html(i.name)}</h3></div><strong class="swiggy-price">${money(i.price)}</strong><p>${html(i.description)}</p><div class="swiggy-item-details"><span>★ ${i.available?'Popular':'Unavailable'}</span><span>${Number(i.prep)||0} min</span></div>${!readOnly&&i.prepareInstructionsEnabled?`<label class="prepare-instruction-trigger"><input type="checkbox" data-prepare-item="${i.id}" ${instruction?'checked':''}><span>Prepare instructions</span></label>${instruction?`<div class="saved-prep-instruction">${html(instruction)}</div>`:''}`:''}</div><div class="swiggy-food-side"><div class="poster-food-thumb">${imageMarkup(localMediaSource(i,'imageKey','imageData'),i.name?.[0]||'G','poster-food-photo')}</div><div class="poster-action">${action}</div></div></article>`
}
function currentPublicItem(itemId){return (remoteMenuConfig?.items||[]).find(row=>row.id===itemId)||state.items.find(row=>row.id===itemId)}
function openPreparationInstructions(itemId){
  const item=currentPublicItem(itemId); if(!item) return;
  let cartItem=customerCart.find(x=>x.id===itemId);
  if(!cartItem){ customerCart.push({...item,qty:1}); cartItem=customerCart.find(x=>x.id===itemId); }
  const current=cartItem.prepareInstruction||'';
  const selected=new Set((cartItem.prepareOptions||[]));
  const options=['Less spicy','Medium spicy','Extra spicy','No onion','No garlic','Less oil','Well cooked'];
  modal('Prepare '+item.name,`<form id="prepareInstructionForm" class="prepare-instruction-form"><p class="muted">Choose quick instructions or add your own note for the kitchen.</p><div class="prep-option-grid">${options.map(o=>`<label class="prep-option"><input type="checkbox" name="prepOption" value="${o}" ${selected.has(o)?'checked':''}><span>${o}</span></label>`).join('')}</div><div class="field"><label>Additional preparation note</label><textarea name="customNote" maxlength="250" placeholder="Example: Make it less salty and serve sauce separately">${cartItem.customPrepareNote||''}</textarea></div><button class="btn full">Save Instructions</button></form>`,()=>{$('#prepareInstructionForm').onsubmit=e=>{e.preventDefault();const fd=new FormData(e.target);const opts=fd.getAll('prepOption');const note=(fd.get('customNote')||'').trim();cartItem.prepareOptions=opts;cartItem.customPrepareNote=note;cartItem.prepareInstruction=[...opts,note].filter(Boolean).join(' · ');closeModal();renderPublicMenu();toast('Preparation instructions saved')}})
}

function changeCartQuantity(id,action){const item=currentPublicItem(id);if(!item||!item.available)return;const existing=customerCart.find(x=>x.id===id);if(action==='plus'){existing?existing.qty++:customerCart.push({...item,qty:1})}else if(existing){existing.qty--;if(existing.qty<=0)customerCart=customerCart.filter(x=>x.id!==id)}renderPublicMenu()}
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
window.addEventListener('storage',()=>{state=load();render();hydrateLocalMedia()});
setInterval(()=>{if(location.hash.startsWith('#track')){state=load();renderTrack()}},2500);
function refreshExpiryLabels(){$$('[data-ad-expiry]').forEach(label=>{const expiresAt=label.dataset.adExpiry;if(!expiresAt){label.textContent='Contact G58 for slot duration';return}label.textContent=adTimeLeft({expiresAt})})}
setInterval(refreshExpiryLabels,30000);
async function resumeGravity58Account(){if(state.session||location.hash.startsWith('#menu')||!Gravity58Ads?.configured)return;try{const account=await Gravity58Ads.currentUser();if(!account?.email)return;const user=ensureGravity58User(account);state.session={userId:user.id,provider:'gravity58'};save();await syncCloudMenus();render()}catch(error){console.warn('Gravity58 account resume failed',error)}}
Gravity58Ads?.subscribeAdvertisements(hydrateAdvertisements);
render();
hydrateLocalMedia();
hydrateAdvertisements();
resumeGravity58Account();
