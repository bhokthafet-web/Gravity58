const $ = (s, root=document) => root.querySelector(s);
const $$ = (s, root=document) => [...root.querySelectorAll(s)];
const uid = (p='id') => `${p}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2,7)}`;
const money = n => `₹${Number(n||0).toLocaleString('en-IN')}`;
const now = () => new Date().toISOString();
const WEEKDAYS = [{id:1,label:'Monday',short:'Mon'},{id:2,label:'Tuesday',short:'Tue'},{id:3,label:'Wednesday',short:'Wed'},{id:4,label:'Thursday',short:'Thu'},{id:5,label:'Friday',short:'Fri'},{id:6,label:'Saturday',short:'Sat'},{id:0,label:'Sunday',short:'Sun'}];
const app = $('#app');
const CONFIG = window.GRAVITY58_CONFIG || {testMode:false,gravity58Url:'https://g58.in/'};
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
function loadBrowserImage(file){return new Promise((resolve,reject)=>{if(!file?.type?.startsWith('image/'))return reject(new Error('Select a JPG, PNG or WebP image'));if(file.size>20*1024*1024)return reject(new Error('Source image must be below 20 MB'));const url=URL.createObjectURL(file),image=new Image();image.onload=()=>{URL.revokeObjectURL(url);resolve(image)};image.onerror=()=>{URL.revokeObjectURL(url);reject(new Error('This image could not be opened'))};image.src=url})}
function canvasImageBlob(canvas,type,quality){return new Promise((resolve,reject)=>canvas.toBlob(blob=>blob?resolve(blob):reject(new Error('Image compression failed')),type,quality))}
async function compressImageTo100Kb(file){const image=await loadBrowserImage(file);let width=Math.min(1600,image.naturalWidth||image.width),height=Math.max(1,Math.round((image.naturalHeight||image.height)*(width/(image.naturalWidth||image.width))));for(let sizePass=0;sizePass<10;sizePass++){const canvas=document.createElement('canvas');canvas.width=Math.max(1,Math.round(width));canvas.height=Math.max(1,Math.round(height));const context=canvas.getContext('2d',{alpha:false});context.fillStyle='#ffffff';context.fillRect(0,0,canvas.width,canvas.height);context.drawImage(image,0,0,canvas.width,canvas.height);for(let quality=.88;quality>=.3;quality-=.08){const blob=await canvasImageBlob(canvas,'image/jpeg',quality);if(blob.size<=100*1024)return blob}width*=.78;height*=.78}throw new Error('Could not reduce this image below 100 KB. Try a smaller source image.')}
async function optimizePaymentReceipt(file){
  if(!file?.size)throw new Error('Upload the payment receipt image.');
  if(!['image/jpeg','image/png','image/webp'].includes(file.type))throw new Error('Payment receipt must be a JPG, PNG or WebP image.');
  if(file.size>15*1024*1024)throw new Error('Payment receipt image must be below 15 MB.');
  if(file.size<=700*1024)return file;
  const image=await loadBrowserImage(file);
  const originalWidth=image.naturalWidth||image.width,originalHeight=image.naturalHeight||image.height;
  let ratio=Math.min(1,1800/Math.max(originalWidth,originalHeight)),width=Math.max(1,Math.round(originalWidth*ratio)),height=Math.max(1,Math.round(originalHeight*ratio));
  let best=null;
  for(let pass=0;pass<6;pass++){
    const canvas=document.createElement('canvas');canvas.width=width;canvas.height=height;
    const context=canvas.getContext('2d',{alpha:false});context.fillStyle='#fff';context.fillRect(0,0,width,height);context.drawImage(image,0,0,width,height);
    for(let quality=.9;quality>=.58;quality-=.08){const blob=await canvasImageBlob(canvas,'image/jpeg',quality);best=blob;if(blob.size<=700*1024)return new File([blob],`${slugify(file.name.replace(/\.[^.]+$/,''))}-receipt.jpg`,{type:'image/jpeg'});}
    width=Math.max(1,Math.round(width*.82));height=Math.max(1,Math.round(height*.82));
  }
  if(!best)throw new Error('Payment receipt image could not be prepared.');
  return new File([best],`${slugify(file.name.replace(/\.[^.]+$/,''))}-receipt.jpg`,{type:'image/jpeg'});
}
function openImageCompressor(){modal('Image Compressor',`<div class="compressor-panel"><p class="muted">Choose a JPG, PNG or WebP image. Compression happens only in this browser and downloads as a standard JPG file.</p><div class="field"><label>Source image <small>(up to 20 MB)</small></label><input id="compressorFile" type="file" accept="image/jpeg,image/png,image/webp"></div><div class="compressor-result" id="compressorResult"><div class="compressor-placeholder">Choose an image to create a menu-ready JPG below 100 KB.</div></div><button class="btn full" id="downloadCompressedImage" hidden>Download Compressed JPG</button></div>`,()=>{const input=$('#compressorFile'),result=$('#compressorResult'),download=$('#downloadCompressedImage');input.onchange=async()=>{const file=input.files[0];if(!file)return;if(activeCompressorUrl)URL.revokeObjectURL(activeCompressorUrl);activeCompressorUrl='';download.hidden=true;result.innerHTML='<div class="compressor-placeholder">Compressing image…</div>';try{const blob=await compressImageTo100Kb(file);activeCompressorUrl=URL.createObjectURL(blob);const saved=Math.max(0,Math.round((1-blob.size/file.size)*100));result.innerHTML=`<img src="${activeCompressorUrl}" alt="Compressed preview"><div><strong>${Math.ceil(blob.size/1024)} KB JPG ready</strong><span>Original ${Math.ceil(file.size/1024)} KB${saved?` · ${saved}% smaller`:''}</span><small>Nothing has been uploaded. Download this JPG, then select it for your restaurant or menu item.</small></div>`;download.hidden=false;download.onclick=()=>{const link=document.createElement('a');link.href=activeCompressorUrl;link.download=`${slugify(file.name.replace(/\.[^.]+$/,''))}-g58.jpg`;document.body.appendChild(link);link.click();link.remove();toast('Compressed JPG downloaded')}}catch(error){input.value='';result.innerHTML=`<div class="compressor-error">${html(error.message||'Could not compress this image')}</div>`}}})}

const seed = {
  users:[{id:'usr_fixture',name:'Test Owner',email:'testing@g58.in',password:'test123'}],
  session:null, activeRestaurantId:'res_cafe',
  restaurants:[
    {id:'res_cafe',ownerId:'usr_fixture',name:'Gravity58 Café',type:'Café',city:'Bengaluru',logo:'☕',open:true,accepting:true,tax:5,service:0,identification:'Table Number',social:{Instagram:'#',YouTube:'#'},description:'Coffee, snacks and quick meals.',address:'12 Central Avenue',phone:'+91 90000 10001',email:'cafe@example.com',paymentEnabled:true,upiId:'gravity58cafe@upi',paymentLink:'https://g58.in/'},
    {id:'res_family',ownerId:'usr_fixture',name:'Gravity58 Family Restaurant',type:'Restaurant',city:'Hyderabad',logo:'🍽️',open:true,accepting:true,tax:5,service:2,identification:'Customer Name',social:{Instagram:'#',Facebook:'#'},description:'Comfort food for the whole family.',address:'45 Lake View Road',phone:'+91 90000 10002',email:'family@example.com',paymentEnabled:false,upiId:'',paymentLink:''},
    {id:'res_cloud',ownerId:'usr_fixture',name:'Gravity58 Cloud Kitchen',type:'Cloud Kitchen',city:'Chennai',logo:'🥡',open:false,accepting:false,tax:5,service:0,identification:'Token Number',social:{WhatsApp:'#'},description:'Fast delivery kitchen.',address:'8 Market Street',phone:'+91 90000 10003',email:'cloud@example.com',paymentEnabled:false,upiId:'',paymentLink:''}
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
    {id:'ad_fixture_1',restaurantKey:'Gravity58 Café|Bengaluru',title:'Weekend Breakfast Festival',description:'Fresh breakfast combos from 8 AM to 11 AM.',buttonLabel:'View Offer',destinationUrl:'#',active:true,image:'🍳',expiresAt:new Date(Date.now()+24*60*60*1000).toISOString()},
    {id:'ad_fixture_2',restaurantKey:'Gravity58 Family Restaurant|Hyderabad',title:'Family Dining Special',description:'Celebrate together with our chef-selected family menu.',buttonLabel:'Know More',destinationUrl:'#',active:true,image:'🥘',expiresAt:new Date(Date.now()+48*60*60*1000).toISOString()}
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
let activeCompressorUrl = '';
let customerChatOpen = false;
const CLOUD_MENU_KIND_PREFIX = 'digital_menu_';
const CLOUD_ORDER_KIND_PREFIX = 'digital_order_';
const CLOUD_TOKEN_KIND_PREFIX = 'digital_token_';
const MENU_PRICING_KIND = 'digital_menu_pricing';
const MENU_ENTITLEMENT_KIND = 'digital_menu_entitlements';
const MENU_REQUEST_KIND = 'digital_menu_requests';
const MENU_SUBSCRIPTION_KIND_PREFIX = 'digital_subscription_';
const PLAN_UTILS = window.Gravity58DigitalPlans;
let cloudMenuSyncing = false;
let ownerOrderUnsubscribe = null;
let ownerOrderSubscriptionKind = '';
let customerOrderUnsubscribe = null;
let customerOrderSubscriptionKind = '';
let orderAlertTimer = null;
let orderAlertContext = null;
const ringingOrderIds = new Set();
const knownCloudOrderIds = new Set();
const orderMutationIds = new Set();
const chatMutationIds = new Set();
const orderChatDrafts = new Map();
const stableAdvertisementIds = new Map();
let customerCartRestaurantId = '';
let menuPricing = PLAN_UTILS.normalisePricing();
let menuEntitlement = (()=>{try{const cached=JSON.parse(localStorage.getItem('g58DigitalMenuEntitlement')||'null');return cached?.ownerId?cached:null}catch{return null}})();
let menuAccountRequests = [];
let mealSubscriptions = [];
let orderResetTimer = null;
let orderRetentionTimer = null;
let scheduleAlertTimer = null;
const scheduleAlertedIds = new Set();
let ownerPeriodFilter = {mode:'day',day:indiaDateValue(),week:indiaWeekValue(),month:indiaDateValue().slice(0,7),year:indiaDateValue().slice(0,4)};
let ownerOrderStatusFilter = 'All';

function activeMenuEntitlement(){
  if(CONFIG.testMode===true)return {plan:'premium',ordersEnabled:true,maxRestaurants:99,permanentOrders:true,messaging:true,reports:true,scheduling:true,customerSubscriptions:true,posPremium:true,lifetime:true};
  const currentOwner=cloudOwnerId();
  const entitlement=menuEntitlement&&(!currentOwner||menuEntitlement.ownerId===currentOwner)?menuEntitlement:null;
  const active=entitlement&&(entitlement.lifetime||!entitlement.expiresAt||new Date(entitlement.expiresAt).getTime()>Date.now());
  if(!active)return {plan:'free',ordersEnabled:true,maxRestaurants:1,permanentOrders:false,messaging:false,reports:false,scheduling:false,customerSubscriptions:false,posPremium:false,lifetime:true};
  const premium=entitlement.plan==='premium';
  return {...entitlement,plan:premium?'premium':'standard',ordersEnabled:true,maxRestaurants:Math.max(5,Number(entitlement.maxRestaurants)||Number(entitlement.restaurantPacks||1)*5),permanentOrders:premium,messaging:premium,reports:premium,scheduling:premium,customerSubscriptions:premium,posPremium:premium};
}
function menuFeature(name){return !!activeMenuEntitlement()[name]}
function menuPlanLabel(){const plan=activeMenuEntitlement().plan;return plan==='premium'?'Digital Menu Premium':plan==='standard'?'Digital Menu Standard':'Free Digital Menu'}
function premiumPosUrl(restaurant=activeRestaurant()){
  if(!restaurant)return '../pos/';
  const params=new URLSearchParams({source:'digital-menu',restaurant:restaurant.id,owner:cloudOwnerId()});
  return `../pos/?${params.toString()}`;
}
function ownerSubscriptionKind(ownerId=cloudOwnerId()){return `${MENU_SUBSCRIPTION_KIND_PREFIX}${String(ownerId||'public').replace(/[^a-zA-Z0-9._-]/g,'-').slice(0,43)}`}
function orderRetentionDecision(order,at=new Date()){return PLAN_UTILS.orderRetention(order,{premium:menuFeature('permanentOrders'),at})}
function orderResetCountdown(){return PLAN_UTILS.resetCountdown(new Date())}
function restaurantLimit(){return Number(activeMenuEntitlement().maxRestaurants)||1}
function pricingRows(plan){
  const monthly=plan==='premium'?menuPricing.premiumMonthly:menuPricing.standardMonthly;
  return menuPricing.periods.map(period=>({...period,amount:PLAN_UTILS.priceFor(monthly,period),link:menuPricing.links?.[`${plan}_${period.id}`]||''}));
}
function scheduleOrderRetentionReset(){
  clearTimeout(orderRetentionTimer);
  const delay=Math.max(1000,PLAN_UTILS.nextIndiaMidnight(new Date()).getTime()-Date.now()+1500);
  orderRetentionTimer=setTimeout(async()=>{try{await syncCloudOrders();if(!location.hash&&state.session)renderShell()}catch(error){console.warn('Daily order reset failed',error)}finally{scheduleOrderRetentionReset()}},delay);
}

function load(){
  try{
    const stored=JSON.parse(localStorage.getItem('gravity58DigitalMenu'))||structuredClone(seed);
    stored.advertisements=[];
    stored.adRequests=[];
    stored.restaurants=(stored.restaurants||[]).map(r=>({...r,logoImageKey:r.logoImageKey||(isWebImage(r.logoImage)&&String(r.logoImage).startsWith('data:')?`restaurant:${r.id}`:''),address:r.address||'',phone:r.phone||'',email:r.email||'',paymentEnabled:!!r.paymentEnabled,upiId:r.upiId||'',upiPayeeName:r.upiPayeeName||r.name||'',paymentLink:r.paymentLink||'',restaurantKey:`${r.name}|${r.city}`}));
    stored.items=(stored.items||[]).map(i=>({...i,imageKey:i.imageKey||(isWebImage(i.imageData)&&String(i.imageData).startsWith('data:')?`menu-item:${i.id}`:''),prepareInstructionsEnabled:!!i.prepareInstructionsEnabled}));
    stored.orders=(stored.orders||[]).map((order,index)=>({...order,tokenNumber:Number(order.tokenNumber)||index+1,orderDay:order.orderDay||orderDay(order.createdAt),messages:Array.isArray(order.messages)?order.messages:[]}));
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
function cloudOrderKind(ownerId=cloudOwnerId()){return `${CLOUD_ORDER_KIND_PREFIX}${String(ownerId||'public').replace(/[^a-zA-Z0-9._-]/g,'-').slice(0,47)}`}
function cloudTokenKind(ownerId=cloudOwnerId()){return `${CLOUD_TOKEN_KIND_PREFIX}${String(ownerId||'public').replace(/[^a-zA-Z0-9._-]/g,'-').slice(0,47)}`}
function orderDay(value=now()){return new Date(value).toLocaleDateString('en-CA',{timeZone:'Asia/Kolkata'}).replaceAll('-','')}
function indiaDateValue(value=now()){const key=orderDay(value);return `${key.slice(0,4)}-${key.slice(4,6)}-${key.slice(6,8)}`}
function orderCalendarDate(order){const key=String(order?.orderDay||'');return /^\d{8}$/.test(key)?`${key.slice(0,4)}-${key.slice(4,6)}-${key.slice(6,8)}`:indiaDateValue(order?.createdAt||now())}
function indiaWeekValue(value=now()){const d=new Date(`${indiaDateValue(value)}T00:00:00`);const day=(d.getDay()+6)%7;d.setDate(d.getDate()-day+3);const firstThursday=new Date(d.getFullYear(),0,4);const diff=(d-firstThursday)/86400000;const week=1+Math.round(diff/7);return `${d.getFullYear()}-W${String(week).padStart(2,'0')}`}
function ownerWeekRange(weekValue){const [yearStr,weekStr]=String(weekValue||'').split('-W');const year=Number(yearStr),week=Number(weekStr);if(!year||!week)return null;const jan4=new Date(year,0,4);const jan4Day=(jan4.getDay()+6)%7;const monday=new Date(jan4);monday.setDate(jan4.getDate()-jan4Day+(week-1)*7);const sunday=new Date(monday);sunday.setDate(monday.getDate()+6);const fmt=d=>`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;return {start:fmt(monday),end:fmt(sunday)}}
function effectiveOwnerPeriod(premium=menuFeature('permanentOrders')){
  if(!premium)return {mode:'day',value:indiaDateValue()};
  const mode=['day','week','month','year'].includes(ownerPeriodFilter.mode)?ownerPeriodFilter.mode:'day';
  return {mode,value:ownerPeriodFilter[mode]||({day:indiaDateValue(),week:indiaWeekValue(),month:indiaDateValue().slice(0,7),year:indiaDateValue().slice(0,4)})[mode]};
}
function ordersForOwnerPeriod(records,premium=menuFeature('permanentOrders')){
  const period=effectiveOwnerPeriod(premium);
  if(period.mode==='week'){const range=ownerWeekRange(period.value);return range?records.filter(order=>{const date=orderCalendarDate(order);return date>=range.start&&date<=range.end}):records}
  return records.filter(order=>{const date=orderCalendarDate(order);return period.mode==='day'?date===period.value:period.mode==='month'?date.startsWith(period.value+'-'):date.startsWith(period.value+'-')});
}
function ownerPeriodLabel(premium=menuFeature('permanentOrders')){
  const period=effectiveOwnerPeriod(premium);
  if(!premium)return 'Today';
  if(period.mode==='day')return new Date(`${period.value}T12:00:00`).toLocaleDateString('en-IN',{dateStyle:'medium'});
  if(period.mode==='week'){const range=ownerWeekRange(period.value);return range?`${new Date(`${range.start}T12:00:00`).toLocaleDateString('en-IN',{day:'numeric',month:'short'})} – ${new Date(`${range.end}T12:00:00`).toLocaleDateString('en-IN',{day:'numeric',month:'short',year:'numeric'})}`:period.value}
  if(period.mode==='month')return new Date(`${period.value}-01T12:00:00`).toLocaleDateString('en-IN',{month:'long',year:'numeric'});
  return period.value;
}
function ownerPeriodControls(label='Filter dashboard'){
  const premium=menuFeature('permanentOrders'),period=effectiveOwnerPeriod(premium);
  const input=period.mode==='day'?`<input id="ownerPeriodValue" type="date" value="${html(period.value)}">`:period.mode==='week'?`<input id="ownerPeriodValue" type="week" value="${html(period.value)}">`:period.mode==='month'?`<input id="ownerPeriodValue" type="month" value="${html(period.value)}">`:`<input id="ownerPeriodValue" type="number" min="2020" max="2100" step="1" value="${html(period.value)}" aria-label="Year">`;
  const modeLabel=period.mode==='day'?'Date':period.mode==='week'?'Week':period.mode==='month'?'Month':'Year';
  return `<div class="owner-period-filter" aria-label="${html(label)}"><label><span>View by</span><select id="ownerPeriodMode" ${premium?'':'disabled'}><option value="day" ${period.mode==='day'?'selected':''}>Date</option>${premium?`<option value="week" ${period.mode==='week'?'selected':''}>Week</option><option value="month" ${period.mode==='month'?'selected':''}>Month</option><option value="year" ${period.mode==='year'?'selected':''}>Year</option>`:''}</select></label><label><span>${modeLabel}</span>${premium?input:`<input value="${html(period.value)}" disabled aria-label="Today only">`}</label><small>${premium?'Premium historical filters':'Free plan shows today only'}</small></div>`;
}
function bindOwnerPeriodControls(renderer){const mode=$('#ownerPeriodMode'),value=$('#ownerPeriodValue');if(mode&&!mode.disabled)mode.onchange=()=>{ownerPeriodFilter.mode=mode.value;renderer()};if(value&&!value.disabled)value.onchange=()=>{if(value.value){ownerPeriodFilter[ownerPeriodFilter.mode]=value.value;renderer()}}}
function formatToken(value){return String(Math.max(0,Number(value)||0)).padStart(4,'0')}
function chatEditorActive(){return document.activeElement?.matches?.('.order-chat-form input[name="message"]')||false}
function activeQueueStatus(status){return !['Completed','Rejected','Payment Rejected'].includes(status)}
function restaurantCloudFields(r){const fields=['id','name','type','city','description','address','phone','email','open','accepting','tax','service','identification','restaurantKey','social','paymentEnabled','upiId','upiPayeeName','logoImageUrl','logoImageFileId','subscriptionPlans','digitalMenuPlan','ordersEnabled','premiumFeatures','entitlementExpiresAt'];return Object.fromEntries(fields.map(key=>[key,r?.[key]]))}
function restaurantPaymentSettings(restaurant={}){
  const upiId=String(restaurant.upiId||'').trim(),payeeName=String(restaurant.upiPayeeName||restaurant.name||'').trim();
  const hasExplicitSetting=restaurant.paymentEnabled!==undefined&&restaurant.paymentEnabled!==null;
  const explicitlyEnabled=restaurant.paymentEnabled===true||restaurant.paymentEnabled==='true';
  return {enabled:hasExplicitSetting?explicitlyEnabled:!!upiId,configured:!!upiId,upiId,payeeName};
}
function normaliseCustomerPhone(value){return String(value||'').replace(/\D/g,'')}
function validCustomerPhone(value){const digits=normaliseCustomerPhone(value);return digits.length>=10&&digits.length<=15}
function customerOpenOrderKey(restaurantId){return `gravity58OpenOrder_${restaurantId}`}
function orderMenuHash(order,restaurant={}){
  if(order?.menuHash)return String(order.menuHash).replace(/^#/, '');
  const ownerId=order?.cloudOwnerId||restaurant?.cloudOwnerId||'';
  const recordId=order?.menuRecordId||restaurant?.cloudRecordId||restaurant?.id||order?.restaurantId||'';
  return ownerId?`menu&cloud=${encodeURIComponent(recordId)}&owner=${encodeURIComponent(ownerId)}`:`menu&restaurant=${encodeURIComponent(recordId)}`;
}
function combinedOrderItems(existingItems=[],incomingItems=[]){
  const merged=[];
  [...existingItems,...incomingItems].forEach(item=>{
    const key=[item.id||item.name,item.prepareInstruction||'',...(item.prepareOptions||[]),item.customPrepareNote||''].join('|');
    const found=merged.find(row=>row._mergeKey===key);
    if(found)found.qty=Math.min(99,(Number(found.qty)||1)+(Number(item.qty)||1));
    else merged.push({...item,qty:Math.max(1,Number(item.qty)||1),_mergeKey:key});
  });
  return merged.map(({_mergeKey,...item})=>item).slice(0,50);
}
function buildUpiPaymentUri({upiId,payeeName,amount,orderId}){
  if(!upiId)return '';
  const reference=`58${String(orderId||Date.now()).replace(/\D/g,'').slice(-30)}`.slice(0,35);
  const params=new URLSearchParams({pa:upiId,pn:payeeName||upiId,tr:reference,tn:`G58 order ${orderId}`,am:Number(amount||0).toFixed(2),cu:'INR'});
  return `upi://pay?${params.toString()}`;
}
function itemCloudFields(item){const fields=['id','categoryId','name','description','price','type','available','prep','prepareInstructionsEnabled','imageUrl','imageFileId'];return Object.fromEntries(fields.map(key=>[key,item?.[key]]))}
function buildCloudMenuRecord(restaurantId=state.activeRestaurantId){const restaurant=state.restaurants.find(row=>row.id===restaurantId);if(!restaurant)throw new Error('Restaurant not found');return {schemaVersion:2,ownerId:cloudOwnerId(),updatedAt:now(),restaurant:restaurantCloudFields(restaurant),categories:restaurantCategories(restaurantId).map(row=>({id:row.id,name:row.name})),items:restaurantItems(restaurantId).map(itemCloudFields)}}
async function uploadMenuImage(blob,name){if(!blob?.size||!isCloudMenuSession())return null;const file=blob instanceof File?blob:new File([blob],`${slugify(name)}.webp`,{type:blob.type||'image/webp'});Gravity58Ads.validateMenuImage(file);return Gravity58Ads.uploadMenuMedia(file)}
async function migrateLocalMenuImages(restaurantId){if(!isCloudMenuSession())return;const restaurant=state.restaurants.find(row=>row.id===restaurantId);const records=[{record:restaurant,keyName:'logoImageKey',urlName:'logoImageUrl',fileName:'logoImageFileId'},...restaurantItems(restaurantId).map(record=>({record,keyName:'imageKey',urlName:'imageUrl',fileName:'imageFileId'}))];for(const entry of records){if(!entry.record?.[entry.keyName]||entry.record[entry.urlName])continue;try{const blob=await getLocalMedia(entry.record[entry.keyName]);if(!blob)continue;const upload=await uploadMenuImage(blob,entry.record.name||'menu-image');entry.record[entry.urlName]=upload?.mediaUrl||'';entry.record[entry.fileName]=upload?.path||''}catch(error){console.warn('Menu image cloud migration failed',error)}}}
async function persistCloudMenu(restaurantId=state.activeRestaurantId){
  save();
  if(!isCloudMenuSession())return null;
  await migrateLocalMenuImages(restaurantId);
  const data=buildCloudMenuRecord(restaurantId),kind=cloudMenuKind(),permissions=Gravity58Ads.permissionSet?.(kind,data.ownerId);
  let record;
  try{record=await Gravity58Ads.create(kind,data,restaurantId,permissions)}
  catch(error){
    if(error?.code!==409&&!/already exists/i.test(error?.message||''))throw error;
    record=await Gravity58Ads.update(kind,restaurantId,data,permissions);
  }
  const restaurant=state.restaurants.find(row=>row.id===restaurantId);
  if(restaurant){restaurant.cloudRecordId=record?.$id||record?.id||restaurantId;restaurant.cloudOwnerId=data.ownerId}
  save();
  return record;
}
function applyCloudMenus(records){const userId=state.session?.userId;if(!userId)return;const oldIds=new Set(state.restaurants.filter(row=>row.ownerId===userId).map(row=>row.id));state.restaurants=state.restaurants.filter(row=>row.ownerId!==userId);state.categories=state.categories.filter(row=>!oldIds.has(row.restaurantId));state.items=state.items.filter(row=>!oldIds.has(row.restaurantId));for(const record of records){if(!record?.restaurant?.id)continue;const rid=record.restaurant.id;state.restaurants.push({...record.restaurant,id:rid,ownerId:userId,cloudRecordId:record.$id||record.id||rid,logo:'G',restaurantKey:record.restaurant.restaurantKey||`${record.restaurant.name}|${record.restaurant.city}`});state.categories.push(...(record.categories||[]).map(row=>({...row,restaurantId:rid})));state.items.push(...(record.items||[]).map(row=>({...row,restaurantId:rid,available:row.available!==false,prepareInstructionsEnabled:!!row.prepareInstructionsEnabled})))}}
function applyCloudMenusDeduped(records){
  const userId=state.session?.userId;if(!userId)return;
  const incomingIds=new Set(records.map(record=>record?.restaurant?.id).filter(Boolean));
  const oldIds=new Set(state.restaurants.filter(row=>row.ownerId===userId).map(row=>row.id));
  const replaceIds=new Set([...oldIds,...incomingIds]);
  state.restaurants=state.restaurants.filter(row=>row.ownerId!==userId&&!incomingIds.has(row.id));
  state.categories=state.categories.filter(row=>!replaceIds.has(row.restaurantId));
  state.items=state.items.filter(row=>!replaceIds.has(row.restaurantId));
  for(const record of records){
    if(!record?.restaurant?.id)continue;const rid=record.restaurant.id;
    state.restaurants.push({...record.restaurant,id:rid,ownerId:userId,cloudRecordId:record.$id||record.id||rid,logo:'G',restaurantKey:record.restaurant.restaurantKey||`${record.restaurant.name}|${record.restaurant.city}`});
    state.categories.push(...(record.categories||[]).map(row=>({...row,restaurantId:rid})));
    state.items.push(...(record.items||[]).map(row=>({...row,restaurantId:rid,available:row.available!==false,prepareInstructionsEnabled:!!row.prepareInstructionsEnabled})));
  }
}
async function syncCloudMenus(){
  if(!isCloudMenuSession()||cloudMenuSyncing)return;
  cloudMenuSyncing=true;
  try{
    const kind=cloudMenuKind(),ownerId=cloudOwnerId(),localOwned=ownerRestaurants();
    let records=(await Gravity58Ads.list(kind)).filter(row=>row.ownerId===ownerId);
    if(!records.length&&localOwned.length){
      for(const restaurant of localOwned)await persistCloudMenu(restaurant.id);
      records=(await Gravity58Ads.list(kind)).filter(row=>row.ownerId===ownerId);
    }
    if(records.length){
      const permissions=Gravity58Ads.permissionSet?.(kind,ownerId);
      records=await Promise.all(records.map(async record=>{
        const recordId=record.$id||record.id||record.restaurant?.id;
        if(!recordId)return record;
        if(permissions?.[0]&&record.$permissions?.includes(permissions[0]))return record;
        try{return await Gravity58Ads.update(kind,recordId,{},permissions)}catch(error){console.warn('Customer menu access repair failed',error);return record}
      }));
      applyCloudMenusDeduped(records);
      if(!ownerRestaurants().some(row=>row.id===state.activeRestaurantId))state.activeRestaurantId=ownerRestaurants()[0]?.id||'';
      save();
    }
    await syncDigitalMenuAccount();
    await syncCloudOrders();
  }finally{cloudMenuSyncing=false}
}
async function syncDigitalMenuAccount(){
  if(!isCloudMenuSession())return;
  const ownerId=cloudOwnerId();
  const [pricing,entitlements,requests]=await Promise.all([
    Gravity58Ads.list(MENU_PRICING_KIND).catch(()=>[]),
    Gravity58Ads.list(MENU_ENTITLEMENT_KIND).catch(()=>[]),
    Gravity58Ads.list(MENU_REQUEST_KIND).catch(()=>[]),
  ]);
  const pricingRecord=pricing.find(row=>(row.id||row.$id)==='plans')||pricing[0];
  menuPricing=PLAN_UTILS.normalisePricing(pricingRecord||{});
  menuEntitlement=entitlements.find(row=>row.ownerId===ownerId)||null;
  menuAccountRequests=requests.filter(row=>row.ownerId===ownerId);
  localStorage.setItem('g58DigitalMenuEntitlement',JSON.stringify(menuEntitlement||{ownerId,plan:'free'}));
  scheduleOrderRetentionReset();
  const features=activeMenuEntitlement();
  for(const restaurant of ownerRestaurants()){
    const signature=JSON.stringify([restaurant.digitalMenuPlan,restaurant.ordersEnabled,restaurant.premiumFeatures,restaurant.entitlementExpiresAt]);
    restaurant.digitalMenuPlan=features.plan;
    restaurant.ordersEnabled=features.ordersEnabled;
    restaurant.premiumFeatures=features.plan==='premium';
    restaurant.entitlementExpiresAt=features.lifetime?'':features.expiresAt||'';
    const nextSignature=JSON.stringify([restaurant.digitalMenuPlan,restaurant.ordersEnabled,restaurant.premiumFeatures,restaurant.entitlementExpiresAt]);
    if(signature!==nextSignature&&restaurant.cloudRecordId)await persistCloudMenu(restaurant.id).catch(error=>console.warn('Menu plan publish failed',error));
  }
}
async function hardDeleteCloudOrder(kind,order,ownerId){
  const id=order.id||order.$id;if(!id)return;
  try{await Gravity58Ads.remove(kind,id);return}
  catch(error){
    const permissions=Gravity58Ads.collaborativePermissionSet?.(ownerId);
    if(!permissions)throw error;
    await Gravity58Ads.update(kind,id,{retentionPermissionRepairedAt:now()},permissions);
    await Gravity58Ads.remove(kind,id);
  }
}
async function applyFreeOrderRetention(records,ownerId){
  if(menuFeature('permanentOrders'))return records;
  const kind=cloudOrderKind(ownerId),retained=[];
  for(const order of records){
    const decision=orderRetentionDecision(order);
    if(!decision.keep){
      try{await hardDeleteCloudOrder(kind,order,ownerId)}catch(error){console.warn('Expired order deletion failed',error)}
      continue;
    }
    if(decision.carry&&order.retentionCarryDay!==decision.carryDay){
      try{Object.assign(order,await Gravity58Ads.update(kind,order.id||order.$id,{retentionCarryDay:decision.carryDay,retentionReason:'processing-at-midnight'}))}catch(error){console.warn('Order carry-over marker failed',error)}
    }
    retained.push(order);
  }
  return retained;
}
async function cleanupOrderTokens(ownerId){
  const kind=cloudTokenKind(ownerId),today=orderDay();
  try{
    const tokens=(await Gravity58Ads.list(kind)).filter(row=>row.tokenReservation&&String(row.orderDay||'')<today);
    for(const token of tokens)try{await hardDeleteCloudOrder(kind,token,ownerId)}catch(error){console.warn('Expired token cleanup failed',error)}
  }catch(error){console.warn('Token retention scan failed',error)}
}
async function syncCloudOrders({alertNew=false}={}){
  if(!isCloudMenuSession())return;
  const ownerId=cloudOwnerId(),restaurantIds=new Set(ownerRestaurants().map(row=>row.id));
  const previousById=new Map((state.orders||[]).map(order=>[order.id||order.$id,order]));
  let records=(await Gravity58Ads.list(cloudOrderKind(ownerId))).filter(row=>row.ownerId===ownerId&&restaurantIds.has(row.restaurantId)&&!row.tokenReservation);
  records=await applyFreeOrderRetention(records,ownerId);
  await cleanupOrderTokens(ownerId);
  if(alertNew){
    records.filter(order=>{const id=order.id||order.$id,previous=previousById.get(id),newItems=order.lastItemsAddedAt&&order.lastItemsAddedAt!==previous?.lastItemsAddedAt;return (!knownCloudOrderIds.has(id)||newItems)&&['Pending','Payment Verification'].includes(order.status)}).forEach(order=>ringingOrderIds.add(order.id||order.$id));
  }
  records.forEach(order=>knownCloudOrderIds.add(order.id||order.$id));
  state.orders=(state.orders||[]).filter(row=>!restaurantIds.has(row.restaurantId));
  state.orders.push(...records.map(row=>({...row,id:row.id||row.$id,messages:Array.isArray(row.messages)?row.messages:[]})));
  save();
  updateOrderAlertSound();
  checkScheduledOrderAlerts();
}
async function persistCloudOrder(order){
  if(!order?.id||!order.cloudOwnerId)return order;
  const kind=cloudOrderKind(order.cloudOwnerId);
  const current=await Gravity58Ads.ensureUser();
  order.customerAccountId||=current?.$id||'';
  if(validCustomerPhone(order.phone)){
    const storedId=sessionStorage.getItem(customerOpenOrderKey(order.restaurantId));
    let existing=storedId?await Gravity58Ads.get(kind,storedId).catch(()=>null):null;
    const mergeable=row=>row&&row.restaurantId===order.restaurantId&&normaliseCustomerPhone(row.phone)===normaliseCustomerPhone(order.phone)&&row.serviceMode===order.serviceMode&&(order.serviceMode!=='table'||row.tableNumber===order.tableNumber)&&row.orderDay===orderDay()&&['Pending','Accepted','Preparing','Ready'].includes(row.status);
    if(!mergeable(existing))existing=null;
    if(!existing){
      const candidates=await Gravity58Ads.list(kind).catch(()=>[]);
      existing=candidates.find(mergeable);
    }
    if(existing){
      const items=combinedOrderItems(existing.items,order.items),subtotal=items.reduce((sum,item)=>sum+(Number(item.price)||0)*(Number(item.qty)||1),0),restaurant=state.restaurants.find(row=>row.id===order.restaurantId)||{};
      const tax=Math.round(subtotal*(Number(restaurant.tax)||0))/100,serviceCharge=Math.round(subtotal*(Number(restaurant.service)||0))/100;
      const onlineTopUp=order.paymentMethod==='online';
      return Gravity58Ads.update(kind,existing.id||existing.$id,{items,subtotal,tax,serviceCharge,total:Math.round((subtotal+tax+serviceCharge)*100)/100,status:onlineTopUp?'Payment Verification':'Pending',customer:order.customer,customerName:order.customerName,serviceMode:order.serviceMode,tableNumber:order.tableNumber,phone:normaliseCustomerPhone(order.phone),paymentMethod:order.paymentMethod,paymentStatus:onlineTopUp?'Awaiting confirmation':'Not required',transactionId:onlineTopUp?'':existing.transactionId,upiId:onlineTopUp?order.upiId:existing.upiId,upiUri:onlineTopUp?order.upiUri:existing.upiUri,paymentReceiptUrl:onlineTopUp?(order.paymentReceiptUrl||''):existing.paymentReceiptUrl,paymentReceiptFileId:onlineTopUp?(order.paymentReceiptFileId||''):existing.paymentReceiptFileId,paymentReceiptName:onlineTopUp?(order.paymentReceiptName||''):existing.paymentReceiptName,paymentReceiptType:onlineTopUp?(order.paymentReceiptType||''):existing.paymentReceiptType,menuHash:order.menuHash,menuRecordId:order.menuRecordId,lastItemsAddedAt:now(),updatedAt:now()});
    }
  }
  const functionId=Gravity58Ads.config?.digitalOrderFunctionId;
  if(functionId&&Gravity58Ads.executeFunction){
    const result=await Gravity58Ads.executeFunction(functionId,{order});
    if(!result?.order)throw new Error('Secure order service did not return the order.');
    return result.order;
  }
  // Local and automated-test adapters do not run Appwrite Functions.
  order.tokenNumber||=await reserveOrderToken(order.cloudOwnerId,order.restaurantId);
  const permissions=Gravity58Ads.userPermissionSet?.([order.customerAccountId,order.cloudOwnerId])||Gravity58Ads.collaborativePermissionSet?.(order.customerAccountId);
  return Gravity58Ads.create(kind,order,order.id,permissions);
}
async function patchCloudOrder(order,changes){
  if(!order)return null;
  if(order.cloudOwnerId&&Gravity58Ads?.configured){
    const updated=await Gravity58Ads.update(cloudOrderKind(order.cloudOwnerId),order.id,changes);
    Object.assign(order,updated);
  }else Object.assign(order,changes);
  save();
  return order;
}
async function appendOrderMessage(order,message){
  if(!order.cloudOwnerId||!Gravity58Ads?.configured){
    order.messages=[...(order.messages||[]),message].slice(-50);
    order.updatedAt=now();save();return order;
  }
  const kind=cloudOrderKind(order.cloudOwnerId);
  for(let attempt=0;attempt<3;attempt++){
    const latest=await Gravity58Ads.get(kind,order.id);
    const merged=[...(latest.messages||[]),...(order.messages||[]),message].filter((entry,index,all)=>all.findIndex(candidate=>candidate.id===entry.id)===index).slice(-50);
    await Gravity58Ads.update(kind,order.id,{messages:merged,updatedAt:now()});
    const verified=await Gravity58Ads.get(kind,order.id);
    if((verified.messages||[]).some(entry=>entry.id===message.id)){Object.assign(order,verified,{messages:verified.messages});save();return order}
  }
  throw new Error('Message could not be saved. Please try again.');
}
async function reserveOrderToken(ownerId,restaurantId){
  const day=orderDay(),localOrders=(state.orders||[]).filter(order=>order.restaurantId===restaurantId&&order.orderDay===day),localNext=Math.max(0,...localOrders.map(order=>Number(order.tokenNumber)||0))+1;
  if(!Gravity58Ads?.configured||!ownerId)return localNext;
  const current=await Gravity58Ads.ensureUser(),permissions=Gravity58Ads.collaborativePermissionSet(current?.$id),prefix=`tok-${String(restaurantId).replace(/[^a-zA-Z0-9._-]/g,'-').slice(0,14)}-${day.slice(2)}-`;
  for(let number=Math.max(1,localNext);number<=9999;number++){
    const reservationId=`${prefix}${formatToken(number)}`.slice(0,36);
    try{
      await Gravity58Ads.create(cloudTokenKind(ownerId),{tokenReservation:true,ownerId,restaurantId,orderDay:day,tokenNumber:number,createdAt:now()},reservationId,permissions);
      return number;
    }catch(error){if(error?.code!==409&&!/already exists/i.test(error?.message||''))throw error}
  }
  throw new Error('Today’s token queue is full. Please contact the restaurant.');
}
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
  [...ringingOrderIds].forEach(id=>{const order=state.orders.find(row=>row.id===id);if(!order||!(['Pending','Payment Verification'].includes(order.status)||order.status==='Scheduled'))ringingOrderIds.delete(id)});
  if(!ringingOrderIds.size){if(orderAlertTimer)clearInterval(orderAlertTimer);orderAlertTimer=null;return}
  if(!orderAlertTimer){orderAlertBeep();orderAlertTimer=setInterval(()=>orderAlertBeep(),2200)}
}
function startOwnerOrderRealtime(){
  const ownerId=cloudOwnerId(),kind=ownerId?cloudOrderKind(ownerId):'';
  if(!Gravity58Ads?.subscribeKind||!kind||ownerOrderSubscriptionKind===kind)return;
  ownerOrderUnsubscribe?.();ownerOrderSubscriptionKind=kind;
  ownerOrderUnsubscribe=Gravity58Ads.subscribeKind(kind,async row=>{const changedId=row?.id||row?.$id;if(changedId&&chatMutationIds.has(changedId))return;try{await syncCloudOrders({alertNew:true});if(!location.hash&&state.session&&!chatEditorActive()){renderView()}}catch(error){console.warn('Live order update failed',error)}});
}
function stopOrderRealtime(){ownerOrderUnsubscribe?.();customerOrderUnsubscribe?.();ownerOrderUnsubscribe=customerOrderUnsubscribe=null;ownerOrderSubscriptionKind=customerOrderSubscriptionKind='';ringingOrderIds.clear();knownCloudOrderIds.clear();clearTimeout(orderRetentionTimer);orderRetentionTimer=null;updateOrderAlertSound()}
async function removeCloudMenu(restaurant){if(!isCloudMenuSession())return;await Gravity58Ads.remove(cloudMenuKind(),restaurant.cloudRecordId||restaurant.id)}
async function hydrateAdvertisements(){
  if(!window.Gravity58Ads)return;
  try{
    const advertisements=await Gravity58Ads.list('advertisements');
    if(Gravity58Ads.configured||advertisements.length){state.advertisements=advertisements;save();if(!chatEditorActive())render()}
  }catch(error){console.warn('Advertisement refresh failed',error)}
}

function render(){
  if(location.hash.startsWith('#subscriptions')) return renderCustomerSubscriptionRoute();
  if(location.hash.startsWith('#menu')) return renderPublicMenu();
  if(location.hash.startsWith('#track')) return renderTrack();
  if(!state.session) return renderLogin();
  if(!ownerRestaurants().length) return renderOwnerOnboarding();
  renderShell();
}
function renderLogin(){const cloud=!!Gravity58Ads?.configured,available=cloud||CONFIG.testMode===true;app.innerHTML=`<main class="screen auth"><section class="auth-card glass"><a class="menu-home-link" href="../">← Gravity58 Home</a><div class="premium-menu-kicker">PREMIUM RESTAURANT EXPERIENCE</div><div class="brand"><div class="brand-mark">G</div><div><h2>Gravity58 Digital Menu</h2><p class="tagline">Scan. Order. Relax.</p></div></div>${available?`<form id="loginForm"><div class="field"><label>Email</label><input name="email" type="email" autocomplete="email" value="${cloud?'':'testing@g58.in'}" required></div><div class="field"><label>Password</label><input name="password" type="password" autocomplete="current-password" value="${cloud?'':'test123'}" required></div><button class="btn full">Login</button></form><div class="actions" style="justify-content:center;margin-top:12px"><button class="link-btn" id="newUser">Create Account</button><button class="link-btn" id="forgot">Forgot Password</button></div>`:'<div class="service-unavailable">The menu service is temporarily unavailable. Please try again shortly.</div>'}<p class="muted" style="text-align:center;margin-top:18px">Your restaurants, menus and availability stay connected to your G58 account.</p></section></main>`;
  if(!available)return;
  $('#loginForm').onsubmit=async e=>{e.preventDefault();const d=Object.fromEntries(new FormData(e.target)),button=e.submitter;button.disabled=true;button.textContent='Signing in…';const local=cloud?null:state.users.find(x=>(x.email===d.email||x.id===d.email)&&x.password===d.password);if(local){state.session={userId:local.id};save();return render()}try{if(!cloud)throw new Error('Invalid login');await Gravity58Ads.login(d.email.trim(),d.password);const account=await Gravity58Ads.currentUser();if(!account)throw new Error('Could not read this account');const user=ensureGravity58User(account);state.session={userId:user.id,provider:'gravity58'};save();button.textContent='Loading menu…';await syncCloudMenus();render()}catch(error){button.disabled=false;button.textContent='Login';toast(error.message||'Invalid login')}};
  $('#newUser').onclick=()=>modal('Create Account',registerForm(),bindRegister);
  $('#forgot').onclick=()=>{const localFields=cloud?'':`<div class="field"><label>New local password</label><input name="password" type="password" minlength="6"></div><div class="field"><label>Confirm local password</label><input name="confirm" type="password" minlength="6"></div>`;modal('Password Recovery',`<p class="muted">${cloud?'Enter your account email to receive a secure reset link.':'Reset the local test account on this browser.'}</p><form id="forgotForm"><div class="field"><label>Email</label><input name="email" type="email" required></div>${localFields}<div class="actions">${cloud?'<button class="btn" name="action" value="email">Send Reset Email</button>':'<button class="btn" name="action" value="local">Reset Password</button>'}</div></form>`,()=>{$('#forgotForm').onsubmit=async e=>{e.preventDefault();const d=Object.fromEntries(new FormData(e.target)),action=e.submitter?.value||'email';if(action==='email'){try{await Gravity58Ads.forgotPassword(d.email.trim(),location.origin+'/reset-password/');closeModal();return toast('Password reset email sent')}catch(error){return toast(error.message||'Could not send reset email')}}const u=state.users.find(x=>x.email.toLowerCase()===d.email.trim().toLowerCase());if(!u)return toast('No local account exists for this email');if((d.password||'').length<6)return toast('Use at least 6 characters');if(d.password!==d.confirm)return toast('Passwords do not match');u.password=d.password;save();closeModal();toast('Password reset on this browser')}})};
}
function registerForm(){return `<form id="registerForm"><div class="form-grid"><div class="field"><label>Full name</label><input name="name" required></div><div class="field"><label>Email</label><input name="email" type="email" required></div><div class="field"><label>Mobile</label><input name="mobile"></div><div class="field"><label>City</label><input name="city"></div><div class="field"><label>Password</label><input name="password" type="password" required></div><div class="field"><label>Confirm password</label><input name="confirm" type="password" required></div></div><button class="btn full">Create Account</button></form>`}
function ensureGravity58User(account,details={}){let user=state.users.find(row=>row.cloudUserId===account.$id||row.email?.toLowerCase()===account.email?.toLowerCase());if(!user){user={id:`g58_${account.$id}`,cloudUserId:account.$id,name:account.name||details.name||account.email.split('@')[0],email:account.email,mobile:details.mobile||'',city:details.city||'',provider:'gravity58'};state.users.push(user)}else Object.assign(user,{cloudUserId:account.$id,name:account.name||user.name,email:account.email,provider:'gravity58'});return user}
function bindRegister(){$('#registerForm').onsubmit=async e=>{e.preventDefault();const d=Object.fromEntries(new FormData(e.target));if(state.users.some(x=>x.email.toLowerCase()===d.email.trim().toLowerCase()))return toast('This email already has an account on this browser');if(d.password.length<6)return toast('Use at least 6 characters');if(d.password!==d.confirm)return toast('Passwords do not match');const button=e.submitter;button.disabled=true;button.textContent='Creating…';try{let user;if(Gravity58Ads?.configured){const account=await Gravity58Ads.register(d.email.trim().toLowerCase(),d.password,d.name,d.mobile);user=ensureGravity58User(account,d)}else{user={id:uid('usr'),name:d.name,email:d.email.trim().toLowerCase(),password:d.password,mobile:d.mobile,city:d.city,provider:'local'};state.users.push(user)}state.session={userId:user.id,provider:user.provider};save();if(user.provider==='gravity58')await syncDigitalMenuAccount();closeModal();renderOwnerOnboarding()}catch(error){button.disabled=false;button.textContent='Create Account';toast(error.message||'Could not create account')}}}

async function logoutOwner(){stopOrderRealtime();if(state.session?.provider==='gravity58')try{await Gravity58Ads?.logout()}catch{}state.session=null;save();render()}
function renderOwnerOnboarding(){app.innerHTML=`<main class="screen auth"><section class="auth-card glass"><a class="menu-home-link" href="../">← Gravity58 Home</a><div class="premium-menu-kicker">SET UP YOUR RESTAURANT</div><div class="brand"><div class="brand-mark">G</div><div><h2>Create your first Digital Menu</h2><p class="tagline">Your restaurant and menu are securely saved to your G58 account.</p></div></div><button class="btn full" id="createFirstRestaurant">Add Restaurant</button><button class="link-btn full" id="onboardingLogout">Logout</button></section></main>`;$('#createFirstRestaurant').onclick=()=>openRestaurantForm(true);$('#onboardingLogout').onclick=logoutOwner}

function renderShell(){const r=activeRestaurant();if(!r)return renderOwnerOnboarding();app.innerHTML=`<div class="shell"><aside class="sidebar"><div class="brand"><div class="brand-mark">G</div><div><strong>Gravity58 Menu</strong><small class="muted">Restaurant workspace</small></div></div><nav class="nav">${navButton('dashboard','⌂','Dashboard')}${navButton('restaurants','◫','Restaurants')}${navButton('menu','☰','Menu')}${navButton('orders','◉','Orders')}${navButton('schedule','◷','Schedule')}${navButton('subscriptions','♢','Subscriptions')}${navButton('qr','▦','QR Codes')}${navButton('reports','◒','Reports')}${navButton('pricing','₹','Pricing')}${navButton('publish','⇧','Share Menu')}${navButton('settings','⚙','Settings')}<a class="owner-book-ad" href="${CONFIG.adBookingPortalUrl||'../advertise/'}?restaurant=${encodeURIComponent(`${r.name}|${r.city}`)}">✦ Book Ad Space</a><button id="logout">⇥ Logout</button></nav></aside><main class="main"><header class="topbar"><div class="restaurant-switch"><span>${r.name?.[0]||'G'}</span><select id="restaurantSelect">${ownerRestaurants().map(x=>`<option value="${x.id}" ${x.id===r.id?'selected':''}>${x.name}</option>`).join('')}</select><button class="btn small secondary" id="addRestaurant">+ Add</button></div><div class="user-label"><span class="plan-badge plan-${activeMenuEntitlement().plan}">${menuPlanLabel()}</span><button class="status-pill sync-menu-button" id="syncCloudMenu"><span class="dot"></span> Menu synced</button></div></header><section class="content" id="page"></section></main></div>`;
  $('#restaurantSelect').onchange=e=>{state.activeRestaurantId=e.target.value;save();renderShell()};
  $('#addRestaurant').onclick=()=>openRestaurantForm(false);
  $('#syncCloudMenu')?.addEventListener('click',async e=>{e.currentTarget.disabled=true;try{await syncCloudMenus();renderShell();toast('Latest account menu loaded')}catch(error){e.currentTarget.disabled=false;toast(error.message||'Could not sync menu')}});
  $('#logout').onclick=logoutOwner;
  $$('.nav button[data-view]').forEach(b=>b.onclick=()=>{const requested=b.dataset.view,gates={orders:'ordersEnabled',schedule:'scheduling',subscriptions:'customerSubscriptions',reports:'reports'};if(gates[requested]&&!menuFeature(gates[requested])){view='pricing';renderShell();toast(`${requested[0].toUpperCase()+requested.slice(1)} is available after activation`);return}view=requested;renderShell()});
  startOwnerOrderRealtime();
  renderView();
}
function navButton(v,i,t){return `<button data-view="${v}" class="${view===v?'active':''}"><span>${i}</span>${t}</button>`}
function renderView(){({dashboard:dashboardView,restaurants:restaurantsView,menu:menuView,orders:ordersView,schedule:scheduleView,subscriptions:subscriptionsView,qr:qrView,reports:reportsView,pricing:pricingView,publish:publishSetupView,settings:settingsView}[view]||dashboardView)()}
function dashboardView(){const r=activeRestaurant(),items=restaurantItems(),orders=ordersForOwnerPeriod(restaurantOrders()),period=ownerPeriodLabel(),completed=orders.filter(x=>x.status==='Completed');$('#page').innerHTML=`<div class="hero"><div><span class="status-pill"><span class="dot"></span>${r.open?'Open':'Closed'}</span><h1 style="margin:12px 0 6px">${r.logo} ${r.name}</h1><p>${r.description||r.type+' in '+r.city}</p></div><div class="actions"><button class="btn secondary" id="previewMenu">Preview Menu</button><button class="btn secondary" id="openOrders">Open Orders</button><button class="btn" id="openCsv">Manage Menu</button></div></div><div class="dashboard-filter-row"><div><h2>${html(period)} overview</h2><p class="muted">Order totals and the list below follow this period.</p></div>${ownerPeriodControls('Filter restaurant dashboard')}</div><div class="grid stats">${metric('Categories',restaurantCategories().length)}${metric('Menu Items',items.length)}${metric('Orders',orders.length)}${metric('Revenue',money(completed.reduce((a,b)=>a+b.total,0)))}</div><div class="section-head"><div><h2>Orders for ${html(period)}</h2><p class="muted">${orders.length} order${orders.length===1?'':'s'} in the selected period</p></div></div>${orderCompactTable(orders.slice(0,12),{actions:false,emptyText:'No orders in this period'})}`;
  bindOwnerPeriodControls(dashboardView);$('#previewMenu').onclick=()=>{location.href=cloudCustomerMenuUrl(r)};$('#openCsv').onclick=()=>{view='menu';renderShell()};$('#openOrders').onclick=()=>{view=menuFeature('ordersEnabled')?'orders':'pricing';renderShell();if(view==='pricing')toast('Request Standard or Premium activation to receive orders')};}
function metric(label,value){return `<article class="card"><span class="muted">${label}</span><div class="metric">${value}</div></article>`}

function pricingView(){
  const entitlement=activeMenuEntitlement(),expiry=entitlement.lifetime?'Lifetime':entitlement.expiresAt?new Date(entitlement.expiresAt).toLocaleDateString('en-IN'):'Not activated',pending=menuAccountRequests.filter(row=>!['Activated','Rejected'].includes(row.status));
  const planSection=(plan,title,description)=>`<section class="pricing-plan-section"><div class="section-head"><div><span class="eyebrow">${plan==='premium'?'FULL RESTAURANT SUITE':'DIGITAL MENU + ORDERS'}</span><h2>${title}</h2><p class="muted">${description}</p></div><strong class="pricing-from">from ${money(plan==='premium'?menuPricing.premiumMonthly:menuPricing.standardMonthly)}/month</strong></div><div class="pricing-grid">${pricingRows(plan).map(period=>`<article class="card pricing-card ${plan}"><span>${period.discount?`${period.discount}% SAVING`:'MONTHLY'}</span><h3>${period.label}</h3><div class="pricing-amount">${money(period.amount)}</div><small>${plan==='standard'?'Includes one pack of up to 5 restaurants':'Premium menu, Premium POS and permanent order history'}</small><button class="btn full" data-request-plan="${plan}" data-period="${period.id}">${period.link?'Pay & Request Activation':'Request Activation'}</button></article>`).join('')}</div></section>`;
  $('#page').innerHTML=`<div class="section-head"><div><h1>Digital Menu Pricing</h1><p class="muted">Your first restaurant and live orders are free. Choose a paid plan for more restaurants or Premium features.</p></div><span class="plan-badge plan-${entitlement.plan}">${menuPlanLabel()}</span></div><article class="card entitlement-summary"><div><strong>Current access</strong><h2>${menuPlanLabel()}</h2><p>${restaurantLimit()} restaurant slot(s) · ${entitlement.ordersEnabled?'Orders enabled':'Menu-only access'} · ${expiry}</p></div>${pending.length?`<span class="chip">${pending.length} request(s) awaiting G58</span>`:''}</article>${planSection('standard','Digital Menu Standard','₹699 adds one pack of up to 5 restaurants. Orders reset daily; messaging and reports remain Premium-only.')}${planSection('premium','Digital Menu Premium','Permanent order history, Premium POS, reports, messaging, meal subscriptions and scheduled orders.')}`;
  $$('[data-request-plan]').forEach(button=>button.onclick=()=>requestMenuActivation(button.dataset.requestPlan,button.dataset.period));
}
async function requestMenuActivation(plan,periodId){
  if(!isCloudMenuSession())return toast('Sign in with your G58 account to request activation');
  const period=pricingRows(plan).find(row=>row.id===periodId);if(!period)return;
  const existing=menuAccountRequests.find(row=>row.plan===plan&&row.periodId===periodId&&['Requested','Payment Pending','Proof Sent'].includes(row.status));
  if(existing){if(period.link)window.open(period.link,'_blank','noopener');return toast('This activation request is already pending')}
  const account=state.users.find(row=>row.id===state.session.userId),ownerId=cloudOwnerId(),request={ownerId,ownerName:account?.name||'',ownerEmail:account?.email||'',plan,periodId,periodLabel:period.label,months:period.months,amount:period.amount,restaurantPacks:1,status:period.link?'Payment Pending':'Requested',paymentLink:period.link||'',createdAt:now()};
  const popup=period.link?window.open('about:blank','_blank'):null;
  try{const created=await Gravity58Ads.create(MENU_REQUEST_KIND,request,undefined,Gravity58Ads.collaborativePermissionSet(ownerId));menuAccountRequests.unshift(created);if(popup)popup.location.href=period.link;pricingView();toast('Activation request sent to the G58 team')}catch(error){popup?.close();toast(error.message||'Could not send activation request')}
}
async function requestFreeRestaurantAccess(restaurant){
  if(!isCloudMenuSession()||!restaurant)return null;
  const ownerId=cloudOwnerId(),existing=menuAccountRequests.find(row=>row.plan==='free'&&row.restaurantId===restaurant.id&&!['Rejected'].includes(row.status));
  if(existing)return existing;
  const account=state.users.find(row=>row.id===state.session.userId),request={ownerId,ownerName:account?.name||'',ownerEmail:account?.email||'',plan:'free',periodId:'free',periodLabel:'Free Account',months:0,amount:0,restaurantPacks:0,restaurantId:restaurant.id,restaurantName:restaurant.name,restaurantCity:restaurant.city,requestType:'Free Restaurant Access',status:'Requested',createdAt:now()};
  const created=await Gravity58Ads.create(MENU_REQUEST_KIND,request,undefined,Gravity58Ads.collaborativePermissionSet(ownerId));menuAccountRequests.unshift(created);return created;
}
function restaurantVisual(r,className=''){return imageMarkup(localMediaSource(r,'logoImageKey','logoImage'),r.name?.trim()?.[0]||'G',className)}
function restaurantsView(){$('#page').innerHTML=`<div class="section-head"><div><h1>My Restaurants</h1><p class="muted">Manage each restaurant, its menu, availability and orders.</p></div><button class="btn" id="createRestaurant">+ New Restaurant</button></div><div class="grid restaurant-grid">${ownerRestaurants().map(r=>`<article class="card restaurant-card"><div class="logo restaurant-logo">${restaurantVisual(r,'restaurant-logo-image')}</div><h3>${html(r.name)}</h3><p class="muted">${html(r.type)} · ${html(r.city)}</p><div class="chips"><span class="chip">${restaurantItems(r.id).length} items</span><span class="chip">${restaurantOrders(r.id).length} orders</span><span class="chip">${r.open?'Open':'Closed'}</span></div><div class="actions"><button class="btn small" data-open="${r.id}">Open Dashboard</button><button class="btn small secondary" data-edit="${r.id}">Edit</button><button class="btn small red" data-delete-restaurant="${r.id}">Delete</button></div></article>`).join('')}</div>`;$('#createRestaurant').onclick=()=>openRestaurantForm(false);$$('[data-open]').forEach(b=>b.onclick=()=>{state.activeRestaurantId=b.dataset.open;view='dashboard';save();renderShell()});$$('[data-edit]').forEach(b=>b.onclick=()=>openRestaurantForm(false,b.dataset.edit));$$('[data-delete-restaurant]').forEach(b=>b.onclick=()=>deleteRestaurant(b.dataset.deleteRestaurant))}
function restaurantForm(r={}){return `<form id="restaurantForm"><div class="form-grid"><div class="field"><label>Restaurant name</label><input name="name" value="${html(r.name||'')}" required></div><div class="field"><label>Type</label><select name="type">${['Restaurant','Café','Bakery','Cloud Kitchen','Fast Food','Other'].map(x=>`<option ${r.type===x?'selected':''}>${x}</option>`).join('')}</select></div><div class="field"><label>City / Location</label><input name="city" value="${html(r.city||'')}" required></div><div class="field local-image-field"><label>Restaurant image <small>(maximum 100 KB)</small></label><input name="logoFile" type="file" accept="image/jpeg,image/png,image/webp"><div class="image-preview restaurant-image-preview">${restaurantVisual(r,'restaurant-preview-image')}</div></div><div class="field"><label>Identification mode</label><select name="identification">${['Customer Name','Table Number','Counter Number','Token Number'].map(x=>`<option ${r.identification===x?'selected':''}>${x}</option>`).join('')}</select></div><div class="field"><label>Tax %</label><input name="tax" type="number" value="${r.tax??5}"></div></div><div class="form-grid"><div class="field"><label>Address</label><input name="address" value="${html(r.address||'')}"></div><div class="field"><label>Phone</label><input name="phone" value="${html(r.phone||'')}"></div><div class="field"><label>Email</label><input name="email" type="email" value="${html(r.email||'')}"></div></div><div class="field"><label>Description</label><textarea name="description">${html(r.description||'')}</textarea></div><button class="btn full">Save Restaurant</button></form>`}
function openRestaurantForm(first=false,id=null){
  if(!id&&!first&&ownerRestaurants().length>=restaurantLimit()){
    view='pricing';renderShell();toast(`Your current plan supports ${restaurantLimit()} restaurant${restaurantLimit()===1?'':'s'}. Choose a plan to add more.`);return;
  }
  const r=id?state.restaurants.find(x=>x.id===id):{};
  modal(id?'Edit Restaurant':first?'Create Your First Restaurant':'Add Restaurant',restaurantForm(r),()=>{
    const form=$('#restaurantForm'),file=form.logoFile,preview=$('.restaurant-image-preview');
    let previewUrl='';
    file.onchange=async()=>{try{Gravity58Ads.validateMenuImage(file.files[0]);if(previewUrl)URL.revokeObjectURL(previewUrl);previewUrl=URL.createObjectURL(file.files[0]);preview.innerHTML=imageMarkup(previewUrl,'G','restaurant-preview-image')}catch(error){file.value='';toast(error.message)}};
    form.onsubmit=async e=>{
      e.preventDefault();const fd=new FormData(e.target),selectedFile=fd.get('logoFile');fd.delete('logoFile');const d=Object.fromEntries(fd),button=e.submitter;button.disabled=true;button.textContent='Saving…';
      try{
        let saved;
        if(id){Object.assign(r,d,{tax:+d.tax,restaurantKey:`${d.name}|${d.city}`});saved=r}
        else{const features=activeMenuEntitlement();saved={id:uid('res'),ownerId:state.session.userId,...d,logo:'G',restaurantKey:`${d.name}|${d.city}`,tax:+d.tax,service:0,open:true,accepting:true,social:{},subscriptionPlans:[],digitalMenuPlan:features.plan,ordersEnabled:features.ordersEnabled,premiumFeatures:features.plan==='premium',entitlementExpiresAt:features.lifetime?'':features.expiresAt||''};state.restaurants.push(saved);state.activeRestaurantId=saved.id}
        if(selectedFile?.size){const oldFile=saved.logoImageFileId,upload=await uploadMenuImage(selectedFile,saved.name);saved.logoImageUrl=upload.mediaUrl;saved.logoImageFileId=upload.fileId;if(oldFile&&oldFile!==upload.fileId)Gravity58Ads.removeMenuMedia(oldFile).catch(()=>{})}
        await persistCloudMenu(saved.id);let freeRequestSent=false;if(!id&&first)try{await requestFreeRestaurantAccess(saved);freeRequestSent=true}catch(error){console.warn('Free restaurant access request failed',error)}Gravity58Ads?.upsertSlot({id:saved.id,restaurantKey:saved.restaurantKey,name:saved.name,city:saved.city,active:true}).catch(()=>{});if(previewUrl)URL.revokeObjectURL(previewUrl);closeModal();renderShell();toast(freeRequestSent?'Restaurant saved · Free account request sent':'Restaurant saved')
      }catch(error){button.disabled=false;button.textContent='Save Restaurant';toast(error.message||'Could not save restaurant')}
    };
  });
}
async function deleteRestaurant(id){const restaurant=state.restaurants.find(r=>r.id===id);if(!restaurant||!confirm(`Permanently delete ${restaurant.name}, its menu, orders and QR locations?`))return;try{await removeCloudMenu(restaurant)}catch(error){return toast(error.message||'Could not delete the account menu')}const restaurantItemsToDelete=state.items.filter(row=>row.restaurantId===id),imageKeys=[restaurant.logoImageKey,...restaurantItemsToDelete.map(row=>row.imageKey)].filter(Boolean),cloudFiles=[restaurant.logoImageFileId,...restaurantItemsToDelete.map(row=>row.imageFileId)].filter(Boolean);state.restaurants=state.restaurants.filter(r=>r.id!==id);state.categories=state.categories.filter(row=>row.restaurantId!==id);state.items=state.items.filter(row=>row.restaurantId!==id);state.orders=state.orders.filter(row=>row.restaurantId!==id);state.locations=state.locations.filter(row=>row.restaurantId!==id);const next=ownerRestaurants()[0];state.activeRestaurantId=next?.id||'';save();Promise.all(imageKeys.map(deleteLocalMedia)).catch(()=>{});Promise.all(cloudFiles.map(fileId=>Gravity58Ads.removeMenuMedia(fileId))).catch(()=>{});Gravity58Ads?.upsertSlot({id:restaurant.id,restaurantKey:restaurant.restaurantKey||`${restaurant.name}|${restaurant.city}`,name:restaurant.name,city:restaurant.city,active:false}).catch(()=>{});toast('Restaurant deleted');next?restaurantsView():renderOwnerOnboarding()}
function menuView(){
  const cats=restaurantCategories(),items=restaurantItems();
  $('#page').innerHTML=`<div class="section-head menu-management-head"><div><h1>Menu Management</h1><p class="muted">Add dishes individually or import a complete menu from CSV.</p></div><div class="actions"><button class="btn" id="addMenuItem">+ Add Menu Item</button><button class="btn secondary" id="downloadMenuCsv">Download CSV Template</button><button class="btn secondary" id="chooseMenuImages">Choose CSV Images</button><button class="btn secondary" id="importMenuCsv">Import Menu CSV</button><input id="menuImageFiles" type="file" accept="image/jpeg,image/png,image/webp" multiple hidden><input id="menuCsvFile" type="file" accept=".csv,text/csv" hidden></div></div><article class="card image-compressor-card"><div><span class="eyebrow">PRIVATE IMAGE TOOL</span><h2>Image Compressor</h2><p>Compress restaurant and food photos to the required 100 KB limit. Processing stays in this browser; the original image is never uploaded or saved.</p></div><button class="btn" id="openImageCompressor">Compress an Image</button></article><div class="cloud-menu-note"><strong>Food images</strong><span>Add a JPG, PNG or WebP image up to 100 KB in the manual form. For CSV import, put each image filename in the <code>image_file</code> column, then choose the matching files before importing.</span><small id="imageSelectionStatus">No CSV images selected</small></div><div class="menu-import-options"><label for="menuImportMode">CSV import method</label><select id="menuImportMode"><option value="merge">Add or update existing menu</option><option value="replace">Overwrite entire menu</option></select><small id="menuImportModeHelp">Keeps current dishes and updates matching item names inside the same category.</small></div><div class="toolbar"><input id="itemSearch" placeholder="Search menu items"><select id="catFilter"><option value="">All categories</option>${cats.map(c=>`<option value="${c.id}">${html(c.name)}</option>`).join('')}</select></div><div class="grid menu-grid" id="menuGrid">${items.map(menuCard).join('')||empty('Add your first menu item or import a CSV file')}</div>`;
  $('#addMenuItem').onclick=()=>openMenuItemForm();
  $('#openImageCompressor').onclick=openImageCompressor;
  $('#downloadMenuCsv').onclick=downloadMenuCsvTemplate;
  $('#chooseMenuImages').onclick=()=>$('#menuImageFiles').click();
  $('#menuImageFiles').onchange=e=>{$('#imageSelectionStatus').textContent=e.target.files.length?`${e.target.files.length} food image${e.target.files.length===1?'':'s'} ready for CSV import`:'No CSV images selected'};
  $('#menuImportMode').onchange=e=>{$('#menuImportModeHelp').textContent=e.target.value==='replace'?'Deletes the current restaurant menu and replaces it with this CSV after confirmation.':'Keeps current dishes and updates matching item names inside the same category.'};
  $('#importMenuCsv').onclick=()=>$('#menuCsvFile').click();
  $('#menuCsvFile').onchange=e=>importMenuCsvFile(e.target.files[0],[...$('#menuImageFiles').files],$('#menuImportMode').value);
  $('#itemSearch').oninput=filterItems;
  $('#catFilter').onchange=filterItems;
  bindMenuActions();
}
function menuCard(i){const c=state.categories.find(x=>x.id===i.categoryId);return `<article class="card menu-item" data-name="${html(i.name.toLowerCase())}" data-cat="${i.categoryId}"><span class="availability chip">${i.available?'Available':'Out of stock'}</span><div class="food-img menu-owner-image">${imageMarkup(localMediaSource(i,'imageKey','imageData'),i.name?.[0]||'G','menu-owner-photo')}</div><div class="chips"><span class="chip">${html(c?.name||'Uncategorised')}</span><span class="chip">${html(i.type)}</span></div><h3>${html(i.name)}</h3><p class="muted">${html(i.description)}</p>${i.prepareInstructionsEnabled?'<span class="chip instruction-enabled-chip">Preparation instructions enabled</span>':''}<div class="price">${money(i.price)}</div><div class="actions" style="margin-top:12px"><button class="btn small ${i.available?'red':'green'}" data-stock="${i.id}">${i.available?'Out of stock':'Make available'}</button><button class="btn small secondary" data-item-edit="${i.id}">Edit</button><button class="btn small red" data-item-delete="${i.id}">Remove</button></div></article>`}
function menuItemForm(item={}){
  const category=state.categories.find(row=>row.id===item.categoryId)?.name||'';
  return `<form id="menuItemForm" class="menu-item-form"><div class="form-grid"><div class="field"><label for="manualItemName">Item name</label><input id="manualItemName" name="name" maxlength="120" value="${html(item.name||'')}" required></div><div class="field"><label for="manualItemCategory">Category</label><input id="manualItemCategory" name="category" list="menuCategoryOptions" maxlength="80" value="${html(category)}" placeholder="Example: Starters" required><datalist id="menuCategoryOptions">${restaurantCategories().map(row=>`<option value="${html(row.name)}"></option>`).join('')}</datalist></div><div class="field"><label for="manualItemPrice">Price (₹)</label><input id="manualItemPrice" name="price" type="number" min="0.01" step="0.01" value="${item.price??''}" required></div><div class="field"><label for="manualItemType">Food type</label><select id="manualItemType" name="type"><option value="Veg" ${item.type!=='Non-Veg'?'selected':''}>Veg</option><option value="Non-Veg" ${item.type==='Non-Veg'?'selected':''}>Non-Veg</option></select></div><div class="field"><label for="manualItemPrep">Preparation time <small>(minutes)</small></label><input id="manualItemPrep" name="prep" type="number" min="0" max="240" step="1" value="${item.prep??0}"></div><div class="field local-image-field"><label for="manualItemImage">Food image <small>(optional · maximum 100 KB)</small></label><input id="manualItemImage" name="imageFile" type="file" accept="image/jpeg,image/png,image/webp"><div class="image-preview menu-item-preview" id="menuItemPreview">${imageMarkup(localMediaSource(item,'imageKey','imageData'),item.name?.[0]||'G','menu-preview-image')}</div></div></div><div class="field"><label for="manualItemDescription">Description</label><textarea id="manualItemDescription" name="description" maxlength="500" placeholder="Describe the dish">${html(item.description||'')}</textarea></div><div class="menu-item-checks"><label><input name="available" type="checkbox" ${item.available!==false?'checked':''}> Available for ordering</label><label><input name="prepareInstructionsEnabled" type="checkbox" ${item.prepareInstructionsEnabled?'checked':''}> Allow customer preparation instructions</label></div><button class="btn full" type="submit">${item.id?'Save Changes':'Add Menu Item'}</button></form>`;
}
function openMenuItemForm(itemId=null){
  const existing=itemId?state.items.find(row=>row.id===itemId):null;
  modal(existing?'Edit Menu Item':'Add Menu Item',menuItemForm(existing||{}),()=>{
    const form=$('#menuItemForm'),file=form.imageFile,preview=$('#menuItemPreview');
    let previewUrl='';
    file.onchange=()=>{
      try{Gravity58Ads.validateMenuImage(file.files[0]);if(previewUrl)URL.revokeObjectURL(previewUrl);previewUrl=URL.createObjectURL(file.files[0]);preview.innerHTML=imageMarkup(previewUrl,'G','menu-preview-image')}
      catch(error){file.value='';toast(error.message)}
    };
    form.onsubmit=async event=>{
      event.preventDefault();
      const fd=new FormData(form),selectedFile=fd.get('imageFile'),name=String(fd.get('name')||'').trim(),categoryName=String(fd.get('category')||'').trim(),price=Number(fd.get('price')),button=event.submitter;
      if(!name)return toast('Enter an item name');
      if(!categoryName)return toast('Enter a category');
      if(!Number.isFinite(price)||price<=0)return toast('Enter a valid price greater than zero');
      let category=restaurantCategories().find(row=>row.name.trim().toLowerCase()===categoryName.toLowerCase());
      const duplicate=restaurantItems().find(row=>row.id!==existing?.id&&row.categoryId===category?.id&&row.name.trim().toLowerCase()===name.toLowerCase());
      if(duplicate)return toast('This item already exists in the selected category');
      const categoriesBefore=structuredClone(state.categories),itemsBefore=structuredClone(state.items),item=existing||{id:uid('item'),restaurantId:state.activeRestaurantId},oldFileId=existing?.imageFileId||'',oldImageKey=existing?.imageKey||'';
      let newFileId='',newImageKey='';
      button.disabled=true;button.textContent='Saving…';
      try{
        if(!category){category={id:uid('cat'),restaurantId:state.activeRestaurantId,name:categoryName.slice(0,80)};state.categories.push(category)}
        Object.assign(item,{categoryId:category.id,name:name.slice(0,120),description:String(fd.get('description')||'').trim().slice(0,500),price,type:fd.get('type')==='Non-Veg'?'Non-Veg':'Veg',available:fd.has('available'),prep:Math.max(0,Math.min(240,Number(fd.get('prep'))||0)),prepareInstructionsEnabled:fd.has('prepareInstructionsEnabled')});
        if(!existing)state.items.push(item);
        if(selectedFile?.size){
          Gravity58Ads.validateMenuImage(selectedFile);
          if(isCloudMenuSession()){
            const upload=await uploadMenuImage(selectedFile,item.name);newFileId=upload.fileId;item.imageUrl=upload.mediaUrl;item.imageFileId=upload.fileId;
          }else{
            newImageKey=`menu-item:${item.id}`;await putLocalMedia(newImageKey,selectedFile);item.imageKey=newImageKey;
          }
        }
        await persistCloudMenu();
        if(oldFileId&&newFileId&&oldFileId!==newFileId)Gravity58Ads.removeMenuMedia(oldFileId).catch(()=>{});
        if(oldImageKey&&newImageKey&&oldImageKey!==newImageKey)deleteLocalMedia(oldImageKey);
        if(previewUrl)URL.revokeObjectURL(previewUrl);
        closeModal();menuView();toast(existing?'Menu item updated':'Menu item added');
      }catch(error){
        state.categories=categoriesBefore;state.items=itemsBefore;
        if(newFileId)Gravity58Ads.removeMenuMedia(newFileId).catch(()=>{});
        if(newImageKey&&!oldImageKey)deleteLocalMedia(newImageKey);
        button.disabled=false;button.textContent=existing?'Save Changes':'Add Menu Item';toast(error.message||'Could not save menu item');
      }
    };
  });
}
function filterItems(){const q=$('#itemSearch').value.toLowerCase(),c=$('#catFilter').value;$$('#menuGrid .menu-item').forEach(x=>x.classList.toggle('hidden',!x.dataset.name.includes(q)||(c&&x.dataset.cat!==c)))}
function downloadMenuCsvTemplate(){downloadFile('g58-digital-menu-template.csv',Gravity58MenuData.MENU_CSV_TEMPLATE,'text/csv;charset=utf-8');toast('CSV template downloaded')}
async function importMenuCsvFile(file,imageFiles=[],mode='merge'){
  if(!file)return;
  if(file.size>2*1024*1024)return toast('CSV file must be below 2 MB');
  if(mode==='replace'&&restaurantItems().length&&!confirm('Overwrite every current menu item for this restaurant? This cannot be undone after the import succeeds.')){$('#menuCsvFile').value='';return}
  const categoriesBefore=structuredClone(state.categories),itemsBefore=structuredClone(state.items),uploadedFiles=[],oldFiles=new Set();
  try{
    const rows=Gravity58MenuData.parseMenuCsv(await file.text());
    if(rows.length>100)throw new Error('Import up to 100 menu items at a time');
    const images=new Map(imageFiles.map(entry=>[entry.name.trim().toLowerCase(),entry]));
    for(const row of rows)if(row.image_file){const selected=images.get(row.image_file.trim().toLowerCase());if(!selected)throw new Error(`Choose the image file named ${row.image_file}`);Gravity58Ads.validateMenuImage(selected)}
    if(mode==='replace'){
      restaurantItems().forEach(item=>item.imageFileId&&oldFiles.add(item.imageFileId));
      state.items=state.items.filter(item=>item.restaurantId!==state.activeRestaurantId);
      state.categories=state.categories.filter(category=>category.restaurantId!==state.activeRestaurantId);
    }
    let created=0,updated=0;
    for(const row of rows){
      const categoryName=row.category.trim().slice(0,80),normalisedCategory=categoryName.toLowerCase();
      let category=restaurantCategories().find(entry=>entry.name.trim().toLowerCase()===normalisedCategory);
      if(!category){category={id:uid('cat'),restaurantId:state.activeRestaurantId,name:categoryName};state.categories.push(category)}
      let item=restaurantItems().find(entry=>entry.categoryId===category.id&&entry.name.trim().toLowerCase()===row.item_name.trim().toLowerCase());
      if(item)updated++;else{item={id:uid('item'),restaurantId:state.activeRestaurantId,available:true};state.items.push(item);created++}
      Object.assign(item,{categoryId:category.id,name:row.item_name.trim().slice(0,120),description:(row.description||'').trim().slice(0,500),price:Number(row.price),type:String(row.food_type||'Veg').trim().toLowerCase().includes('non')?'Non-Veg':'Veg',available:Gravity58MenuData.csvBoolean(row.available,true),prep:Math.max(0,Number(row.preparation_minutes)||0),prepareInstructionsEnabled:Gravity58MenuData.csvBoolean(row.preparation_instructions,false)});
      const selectedImage=images.get(String(row.image_file||'').trim().toLowerCase());
      if(selectedImage){const upload=await uploadMenuImage(selectedImage,item.name);if(item.imageFileId)oldFiles.add(item.imageFileId);item.imageUrl=upload.mediaUrl;item.imageFileId=upload.fileId;uploadedFiles.push(upload.fileId)}
    }
    await persistCloudMenu();
    [...oldFiles].filter(Boolean).forEach(fileId=>Gravity58Ads.removeMenuMedia(fileId).catch(()=>{}));
    menuView();
    toast(mode==='replace'?`${created} menu item(s) replaced the previous menu`:`${created} created, ${updated} updated from CSV`);
  }catch(error){
    state.categories=categoriesBefore;
    state.items=itemsBefore;
    uploadedFiles.filter(Boolean).forEach(fileId=>Gravity58Ads.removeMenuMedia(fileId).catch(()=>{}));
    toast(error.message||'Could not import menu CSV');
  }finally{$('#menuCsvFile')&&($('#menuCsvFile').value='')}
}
function bindMenuActions(){$$('[data-stock]').forEach(b=>b.onclick=async()=>{const i=state.items.find(x=>x.id===b.dataset.stock);i.available=!i.available;try{await persistCloudMenu();menuView()}catch(error){i.available=!i.available;toast(error.message||'Could not update availability')}});$$('[data-item-edit]').forEach(b=>b.onclick=()=>openMenuItemForm(b.dataset.itemEdit));$$('[data-item-delete]').forEach(b=>b.onclick=async()=>{const i=state.items.find(x=>x.id===b.dataset.itemDelete);if(!i||!confirm(`Delete ${i.name} from this menu?`))return;state.items=state.items.filter(x=>x.id!==i.id);try{await persistCloudMenu();deleteLocalMedia(i.imageKey);if(isCloudMenuSession()&&i.imageFileId)Gravity58Ads.removeMenuMedia(i.imageFileId).catch(()=>{});menuView();toast('Menu item deleted')}catch(error){state.items.push(i);toast(error.message||'Could not delete menu item')}})}
function sortedRestaurantOrders(){return restaurantOrders().slice().sort((a,b)=>{const active=Number(activeQueueStatus(b.status))-Number(activeQueueStatus(a.status));if(active)return active;const day=String(a.orderDay||'').localeCompare(String(b.orderDay||''));if(day)return day;return (Number(a.tokenNumber)||99999)-(Number(b.tokenNumber)||99999)||new Date(a.createdAt)-new Date(b.createdAt)})}
function orderCompactRow(o,{actions=true}={}){
  const identity=o.serviceMode==='table'?`Table ${o.tableNumber||'-'}`:'Counter',items=o.items.map(item=>`${Number(item.qty)||1} × ${html(item.name)}`).join(', '),incoming=['Pending','Payment Verification'].includes(o.status);
  return `<tr class="compact-order-row ${incoming?'incoming-order-row':''}" data-status="${html(o.status)}" data-order-row="${html(o.id)}"><td><strong class="compact-order-token">${formatToken(o.tokenNumber)}</strong><small>${html(o.id)}</small></td><td><strong>${html(o.customerName||o.customer||'Guest')}</strong><small>${html(identity)}</small></td><td class="compact-order-items">${items}</td><td><strong>${new Date(o.createdAt).toLocaleDateString('en-IN',{dateStyle:'medium'})}</strong><small>${new Date(o.createdAt).toLocaleTimeString('en-IN',{hour:'2-digit',minute:'2-digit'})}</small></td><td><strong>${money(o.total)}</strong></td><td><span class="chip order-status">${html(o.status)}</span></td>${actions?`<td><div class="compact-order-actions">${orderActions(o)}<button class="btn small secondary" data-order-details="${html(o.id)}">Details</button><button class="btn small secondary" data-print-order="${html(o.id)}">Print</button></div></td>`:''}</tr>`;
}
function orderCompactTable(orders,{actions=true,emptyText='No orders in this period'}={}){if(!orders.length)return empty(emptyText);return `<div class="card table-wrap order-list-table"><table><thead><tr><th>Token / Order</th><th>Customer</th><th>Items</th><th>Date & time</th><th>Amount</th><th>Status</th>${actions?'<th>Actions</th>':''}</tr></thead><tbody>${orders.map(order=>orderCompactRow(order,{actions})).join('')}</tbody></table></div>`}
function ordersBoardMarkup(orders,emptyText='No orders yet'){
  if(!orders.length)return empty(emptyText);
  const activeOrders=orders.filter(order=>activeQueueStatus(order.status));
  const featured=activeOrders.length?activeOrders:orders.slice().sort((a,b)=>new Date(b.createdAt)-new Date(a.createdAt)).slice(0,3);
  const featuredIds=new Set(featured.map(order=>order.id));
  const history=orders.filter(order=>!featuredIds.has(order.id));
  const subtitle=activeOrders.length?'Completed and other closed orders.':'Order 4 onward is shown in a compact list.';
  return `<div class="featured-order-grid">${featured.map(orderCard).join('')}</div><div class="section-head compact-order-heading"><div><h2>Orders History</h2><p class="muted">${subtitle}</p></div><div class="order-history-controls">${ownerPeriodControls('Filter order history')}<span class="chip">${history.length} order${history.length===1?'':'s'}</span></div></div>${orderCompactTable(history)}`;
}
function ordersView(){
  if(!menuFeature('ordersEnabled')){view='pricing';return pricingView()}
  const statuses=['All','Payment Verification','Pending','Accepted','Preparing','Ready','Completed','Rejected'],allOrders=sortedRestaurantOrders(),periodOrders=ordersForOwnerPeriod(allOrders),periodIds=new Set(periodOrders.map(order=>order.id)),orders=allOrders.filter(order=>activeQueueStatus(order.status)||periodIds.has(order.id)),active=allOrders.filter(order=>activeQueueStatus(order.status)),visible=orders.filter(order=>ownerOrderStatusFilter==='All'||order.status===ownerOrderStatusFilter);
  const posButton=menuFeature('posPremium')&&isCloudMenuSession()?`<a class="btn small premium-pos-button" href="${premiumPosUrl()}">▣ Open POS</a>`:'';
  $('#page').innerHTML=`<div class="section-head"><div><h1>Live Orders <small class="order-reset-copy">(${menuFeature('permanentOrders')?'Premium: order history is permanent':`You're using freeware — orders reset in <span id="orderResetCountdown">${orderResetCountdown()}</span>`})</small></h1><p class="muted">Instant order board · ${active.length} active token(s) always pinned · history: ${html(ownerPeriodLabel())}</p></div><div class="orders-header-actions">${posButton}<span class="status-pill live-sync-pill"><span class="dot"></span> Live sync & sound alerts</span></div></div><div class="order-controls"><div class="tabs">${statuses.map(s=>`<button class="btn small ${s===ownerOrderStatusFilter?'':'secondary'}" data-tab="${s}">${s}</button>`).join('')}</div></div><div id="ordersGrid" class="orders-board">${ordersBoardMarkup(visible,`No ${ownerOrderStatusFilter==='All'?'':ownerOrderStatusFilter.toLowerCase()+' '}orders in this period`)}</div>`;
  clearInterval(orderResetTimer);if(!menuFeature('permanentOrders'))orderResetTimer=setInterval(()=>{const target=$('#orderResetCountdown');if(target)target.textContent=orderResetCountdown()},1000);
  $$('[data-tab]').forEach(b=>b.onclick=()=>{ownerOrderStatusFilter=b.dataset.tab;ordersView()});
  bindOwnerPeriodControls(ordersView);
  bindOrderActions();
}
function orderMessagesMarkup(o,role='owner'){
  if(!menuFeature('messaging'))return '<div class="premium-inline-lock">Customer messaging is available in Digital Menu Premium.</div>';
  const messages=(o.messages||[]).slice(-6);
  return `<div class="order-chat"><div class="order-chat-log">${messages.map(message=>`<div class="order-message ${message.senderRole===role?'mine':''}"><strong>${html(message.senderRole==='owner'?'Restaurant':message.senderName||'Customer')}</strong><span>${html(message.text)}</span><small>${new Date(message.createdAt).toLocaleTimeString('en-IN',{hour:'2-digit',minute:'2-digit'})}</small></div>`).join('')||'<p class="muted no-messages">No messages yet.</p>'}</div><form class="order-chat-form" data-order-chat="${html(o.id)}"><input name="message" value="${html(orderChatDrafts.get(o.id)||'')}" maxlength="240" placeholder="Message the customer" aria-label="Message customer"><button class="btn small" type="submit">Send</button></form></div>`
}
function orderCard(o){
  const identity=o.serviceMode==='table'?`Table ${o.tableNumber||'-'}`:'Single Counter',pay=o.paymentMethod==='online'?'Receipt verification':'Pay at counter',token=formatToken(o.tokenNumber);
  const incoming=['Pending','Payment Verification'].includes(o.status);
  return `<article class="card order-card ${incoming?'incoming-order':''}" data-status="${html(o.status)}" data-order-card="${html(o.id)}">${incoming?'<span class="incoming-order-beacon" aria-label="New incoming order" title="New incoming order"></span>':''}<div class="order-card-head"><div><span class="order-token">TOKEN ${token}</span><strong class="order-id">${html(o.id)}</strong><div class="muted">${html(o.customerName||o.customer||'Guest')} · ${html(identity)}</div>${o.phone?`<small class="muted">☎ ${html(o.phone)}</small>`:''}</div><span class="chip order-status">${html(o.status)}</span></div><div class="chips"><span class="chip">${html(pay)}</span>${o.paymentStatus?`<span class="chip">${html(o.paymentStatus)}</span>`:''}<span class="chip">${new Date(o.createdAt).toLocaleTimeString('en-IN',{hour:'2-digit',minute:'2-digit'})}</span>${o.scheduledFor?`<span class="chip schedule-chip">Scheduled ${new Date(o.scheduledFor).toLocaleString('en-IN',{dateStyle:'medium',timeStyle:'short'})}</span>`:''}</div>${o.paymentReceiptUrl?`<a class="payment-receipt-link" href="${html(o.paymentReceiptUrl)}" target="_blank" rel="noopener">View payment receipt ↗</a>`:''}<div class="order-items">${o.items.map(i=>`<div class="staff-order-item"><strong>${Number(i.qty)||1} × ${html(i.name)}</strong>${i.prepareInstruction?`<div class="staff-prep-note"><span>Preparation:</span> ${html(i.prepareInstruction)}</div>`:''}</div>`).join('')}</div><h3 style="margin:12px 0">${money(o.total)}</h3><div class="actions order-primary-actions">${orderActions(o)}${o.serviceMode==='table'?`<button class="btn small secondary" data-edit-table="${html(o.id)}">Correct table</button>`:''}<button class="btn small secondary" data-print-order="${html(o.id)}">Print</button></div>${orderMessagesMarkup(o)}</article>`
}
function orderActions(o){const map={'Payment Verification':['Confirm Payment','Reject Payment'],Scheduled:['Start Scheduled Order','Reject'],Pending:['Accept','Reject'],Accepted:['Start Preparing'],Preparing:['Mark Ready'],Ready:['Complete']};return (map[o.status]||[]).map(a=>`<button class="btn small ${['Reject','Reject Payment'].includes(a)?'red':['Start Scheduled Order','Start Preparing','Mark Ready','Complete'].includes(a)?'green':''}" data-order="${html(o.id)}" data-action="${a}">${a}</button>`).join('')}
function bindOrderActions(){
  $$('[data-order]').forEach(b=>b.onclick=async()=>{if(orderMutationIds.has(b.dataset.order))return;const inModal=!!b.closest('#modal');b.disabled=true;await updateOrder(b.dataset.order,b.dataset.action);if(inModal)closeModal()});
  $$('[data-edit-table]').forEach(b=>b.onclick=()=>editOrderTable(b.dataset.editTable));
  $$('[data-print-order]').forEach(b=>b.onclick=()=>printOrderReceipt(b.dataset.printOrder));
  $$('[data-order-details]').forEach(b=>b.onclick=()=>{const order=state.orders.find(row=>row.id===b.dataset.orderDetails);if(!order)return;modal(`Order · Token ${formatToken(order.tokenNumber)}`,orderCard(order),bindOrderActions)});
  $$('[data-order-chat]').forEach(form=>{const input=$('input[name="message"]',form);input.oninput=()=>orderChatDrafts.set(form.dataset.orderChat,input.value);form.onsubmit=event=>sendOrderMessage(event,form.dataset.orderChat,'owner')});
}
async function updateOrder(id,action){
  if(orderMutationIds.has(id))return;
  const o=state.orders.find(x=>x.id===id),confirmedNext=o?.scheduledFor&&new Date(o.scheduledFor).getTime()>Date.now()+5*60000?'Scheduled':'Pending',next={Accept:'Accepted',Reject:'Rejected','Confirm Payment':confirmedNext,'Reject Payment':'Payment Rejected','Start Scheduled Order':'Pending','Start Preparing':'Preparing','Mark Ready':'Ready',Complete:'Completed'}[action];if(!o||!next)return;
  orderMutationIds.add(id);const previous=structuredClone(o);
  try{
    if(o.cloudOwnerId&&Gravity58Ads?.configured)try{Object.assign(o,await Gravity58Ads.get(cloudOrderKind(o.cloudOwnerId),id))}catch{}
    const allowed={PaymentVerification:['Confirm Payment','Reject Payment'],Scheduled:['Start Scheduled Order','Reject'],Pending:['Accept','Reject'],Accepted:['Start Preparing'],Preparing:['Mark Ready'],Ready:['Complete']}[String(o.status).replace(/\s/g,'')]||[];
    if(!allowed.includes(action))throw new Error(`This order is already ${o.status}. Reloading the latest status.`);
    if(action==='Confirm Payment'&&o.cloudOwnerId&&Gravity58Ads?.configured&&Gravity58Ads.config?.digitalOrderFunctionId){
      const result=await Gravity58Ads.executeFunction(Gravity58Ads.config.digitalOrderFunctionId,{action:'confirm-payment',ownerId:o.cloudOwnerId,orderId:o.id});
      if(!result?.order)throw new Error('Secure payment approval did not return the order.');
      Object.assign(o,result.order);ringingOrderIds.delete(id);updateOrderAlertSound();save();
      toast(`Payment approved. Receipt deleted permanently. Token ${formatToken(o.tokenNumber)} is now ${o.status}.`);
      view==='orders'?ordersView():view==='schedule'?scheduleView():dashboardView();return;
    }
    const changes={status:next,updatedAt:now()};
    if(action==='Confirm Payment'){
      if(o.paymentReceiptFileId)await Gravity58Ads?.removeAdMedia?.(o.paymentReceiptFileId);
      Object.assign(changes,{paymentStatus:'Confirmed',paymentReceiptUrl:'',paymentReceiptFileId:'',paymentReceiptName:'',paymentReceiptType:'',paymentReceiptDeletedAt:now()});
    }
    if(action==='Reject Payment'){changes.paymentStatus='Rejected';changes.paymentRejectedAt=now()}if(action==='Reject')changes.rejectedAt=now();if(action==='Accept')changes.acceptedAt=now();if(action==='Start Scheduled Order')changes.scheduledStartedAt=now();if(action==='Mark Ready')changes.readyAt=now();if(action==='Complete')changes.completedAt=now();
    await patchCloudOrder(o,changes);
    if(action==='Start Scheduled Order'||!['Pending','Payment Verification'].includes(next))ringingOrderIds.delete(id);updateOrderAlertSound();
    toast(action==='Mark Ready'?`Token ${formatToken(o.tokenNumber)} is ready`:`Order ${o.id}: ${next}`);view==='orders'?ordersView():view==='schedule'?scheduleView():dashboardView();
  }catch(error){Object.assign(o,previous);save();toast(error.message||'Could not update order')}
  finally{orderMutationIds.delete(id)}
}
function editOrderTable(id){
  const order=state.orders.find(row=>row.id===id);if(!order)return;
  modal('Correct Table Number',`<form id="correctTableForm"><p class="muted">Update the customer’s table if it is duplicated or incorrect. Their live order screen updates automatically.</p><div class="field"><label for="correctTableNumber">Table number</label><input id="correctTableNumber" name="tableNumber" value="${html(order.tableNumber||'')}" maxlength="20" required></div><button class="btn full">Update table</button></form>`,()=>{$('#correctTableForm').onsubmit=async event=>{event.preventDefault();const value=String(new FormData(event.target).get('tableNumber')||'').trim();if(!value)return;const previous={tableNumber:order.tableNumber,customer:order.customer};try{await patchCloudOrder(order,{tableNumber:value,customer:`${order.customerName?order.customerName+' · ':''}Table ${value}`,updatedAt:now()});closeModal();ordersView();toast(`Token ${formatToken(order.tokenNumber)} moved to Table ${value}`)}catch(error){Object.assign(order,previous);toast(error.message||'Could not update table')}}})
}
async function sendOrderMessage(event,id,senderRole){
  event.preventDefault();const form=event.currentTarget,input=$('input[name="message"]',form),text=String(input?.value||'').trim();if(!text)return;
  const order=state.orders.find(row=>row.id===id);if(!order)return;
  const button=$('button',form);button.disabled=true;chatMutationIds.add(id);orderChatDrafts.set(id,text);
  try{
    const message={id:uid('msg'),senderRole,senderName:senderRole==='owner'?activeRestaurant()?.name:(order.customerName||'Customer'),text,createdAt:now()};
    await appendOrderMessage(order,message);orderChatDrafts.delete(id);input.value='';senderRole==='owner'?ordersView():renderTrack();toast('Message sent');
  }catch(error){button.disabled=false;toast(error.message||'Could not send message')}
  finally{chatMutationIds.delete(id)}
}
function printOrderReceipt(id){
  const order=state.orders.find(row=>row.id===id),restaurant=state.restaurants.find(row=>row.id===order?.restaurantId);if(!order||!restaurant)return;
  const frame=document.createElement('iframe');frame.className='receipt-print-frame';frame.setAttribute('title','Order receipt');document.body.appendChild(frame);
  const doc=frame.contentDocument;doc.open();doc.write(`<!doctype html><html><head><title>Token ${formatToken(order.tokenNumber)}</title><style>@page{size:80mm auto;margin:3mm}*{box-sizing:border-box}body{width:74mm;margin:0;font:12px/1.35 monospace;color:#000}h1,h2,p{margin:0 0 5px;text-align:center}.token{margin:8px 0;padding:7px;border:2px solid #000;font-size:24px;font-weight:900;text-align:center}.line{display:flex;justify-content:space-between;gap:8px;border-bottom:1px dashed #777;padding:5px 0}.note{font-size:10px;padding:3px 0}.total{font-size:16px;font-weight:900}.meta{margin:8px 0;border-top:1px dashed #000;border-bottom:1px dashed #000;padding:7px 0}</style></head><body><h2>${html(restaurant.name)}</h2><p>${html(restaurant.address||restaurant.city||'')}</p><div class="token">TOKEN ${formatToken(order.tokenNumber)}</div><div class="meta">${html(order.customerName||'Guest')} · ${html(order.serviceMode==='table'?`Table ${order.tableNumber}`:'Single Counter')}<br>${new Date(order.createdAt).toLocaleString('en-IN')}<br>${html(order.id)}</div>${order.items.map(item=>`<div class="line"><span>${Number(item.qty)||1} × ${html(item.name)}</span><b>${money((Number(item.qty)||1)*Number(item.price))}</b></div>${item.prepareInstruction?`<div class="note">Preparation: ${html(item.prepareInstruction)}</div>`:''}`).join('')}<div class="line total"><span>TOTAL</span><span>${money(order.total)}</span></div><p style="margin-top:10px">Thank you</p></body></html>`);doc.close();
  setTimeout(()=>{try{frame.contentWindow?.focus();frame.contentWindow?.print()}finally{setTimeout(()=>frame.remove(),800)}},180)
}
function slugify(value){return String(value||'restaurant').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'').slice(0,60)||'restaurant'}
function downloadFile(name,contents,type='application/json'){const url=URL.createObjectURL(new Blob([contents],{type})),link=document.createElement('a');link.href=url;link.download=name;document.body.appendChild(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),1000)}
function validateMenuConfig(config){if(!config||config.g58MenuConfig!==1||!config.restaurant?.name||!Array.isArray(config.categories)||!Array.isArray(config.items))throw new Error('Invalid restaurant menu data');if(config.items.length>1000)throw new Error('Restaurant menu contains too many items');return config}
function cloudCustomerMenuUrl(restaurant=activeRestaurant()){const ownerId=cloudOwnerId()||restaurant?.cloudOwnerId||'';return `${location.href.split('#')[0]}#menu&cloud=${encodeURIComponent(restaurant.id)}${ownerId?`&owner=${encodeURIComponent(ownerId)}`:''}`}
function publishSetupView(){
  const r=activeRestaurant(),url=cloudCustomerMenuUrl(r);$('#page').innerHTML=`<div class="section-head"><div><h1>Share Menu</h1><p class="muted">This customer link always opens your latest published menu.</p></div></div><article class="card cloud-share-card"><div><span class="publish-step">LIVE</span><h2>${html(r.name)} customer menu</h2><p>Restaurant details, menu items, images and availability update automatically.</p><a href="${html(url)}" target="_blank" rel="noopener">${html(url)}</a><div class="actions"><button class="btn" id="copyCloudMenuLink">Copy Customer Link</button><a class="btn secondary" href="${html(url)}" target="_blank" rel="noopener">Open Customer Menu</a></div></div><div class="qr-wrap"><div id="cloudMenuQr"></div></div></article><article class="card"><h2>Manage your menu</h2><p class="muted">Add items manually or import up to 100 dishes at a time from CSV.</p><button class="btn secondary" id="openMenuSetup">Open Menu Management</button></article>`;try{new QRCode($('#cloudMenuQr'),{text:url,width:220,height:220})}catch{$('#cloudMenuQr').textContent='QR unavailable'}$('#copyCloudMenuLink').onclick=()=>navigator.clipboard?.writeText(url).then(()=>toast('Customer link copied'));$('#openMenuSetup').onclick=()=>{view='menu';renderShell()}
}
function qrView(){const r=activeRestaurant(),url=cloudCustomerMenuUrl(r);$('#page').innerHTML=`<div class="section-head"><div><h1>QR Codes</h1><p class="muted">Share your live customer menu</p></div><button class="btn secondary" id="previewQr">Preview Menu</button></div><article class="card qr-card"><h2>${html(r.name)}</h2><p>Scan to View Menu</p><div class="qr-wrap"><div id="qrcode"></div></div><div class="actions" style="margin-top:18px"><button class="btn" id="copyQr">Copy Menu Link</button><button class="btn secondary" onclick="window.print()">Print</button></div><small class="muted" style="margin-top:16px">Powered by Gravity58 Digital Menu</small></article>`;try{new QRCode($('#qrcode'),{text:url,width:220,height:220})}catch{$('#qrcode').innerHTML='<div style="color:#111;padding:70px 25px">QR unavailable</div>'}$('#copyQr').onclick=()=>navigator.clipboard?.writeText(url).then(()=>toast('Menu link copied'));$('#previewQr').onclick=()=>window.open(url,'_blank')}
function reportsView(){if(!menuFeature('reports')){view='pricing';return pricingView()}const orders=ordersForOwnerPeriod(restaurantOrders()),sales=orders.filter(x=>x.status==='Completed').reduce((a,b)=>a+b.total,0),period=ownerPeriodLabel();$('#page').innerHTML=`<div class="section-head"><div><h1>Reports</h1><p class="muted">Permanent Premium data for ${activeRestaurant().name} · ${html(period)}</p></div>${ownerPeriodControls('Filter reports')}</div><div class="grid stats">${metric('Total Orders',orders.length)}${metric('Completed',orders.filter(x=>x.status==='Completed').length)}${metric('Total Sales',money(sales))}${metric('Average Order',money(orders.length?orders.reduce((a,b)=>a+b.total,0)/orders.length:0))}</div><div class="section-head"><h2>All Restaurants Overview · ${html(period)}</h2></div><div class="grid restaurant-grid">${ownerRestaurants().map(r=>{const os=ordersForOwnerPeriod(restaurantOrders(r.id));return `<article class="card"><h3>${r.logo} ${r.name}</h3><p class="muted">${os.length} orders · ${money(os.filter(x=>x.status==='Completed').reduce((a,b)=>a+b.total,0))} sales</p></article>`}).join('')}</div>${orderCompactTable(orders,{actions:false,emptyText:'No report data in this period'})}`;bindOwnerPeriodControls(reportsView)}

function scheduleView(){
  if(!menuFeature('scheduling')){view='pricing';return pricingView()}
  const current=Date.now();
  const scheduled=restaurantOrders().filter(order=>{
    if(!order.scheduledFor)return false;
    if(['Completed','Rejected','Payment Rejected'].includes(order.status))return false;
    if(order.status==='Scheduled')return new Date(order.scheduledFor).getTime()-current<=15*60000;
    return true;
  }).sort((a,b)=>new Date(a.scheduledFor)-new Date(b.scheduledFor));
  $('#page').innerHTML=`<div class="section-head"><div><h1>Scheduled Orders</h1><p class="muted">Orders appear here once they're within 15 minutes of their scheduled time, and ring continuously — like an incoming call — until started.</p></div><span class="status-pill"><span class="dot"></span> Premium scheduling</span></div><div class="grid order-grid">${scheduled.map(order=>{const ringing=ringingOrderIds.has(order.id);return `<article class="card schedule-card ${ringing?'incoming-order':''}">${ringing?'<span class="incoming-order-beacon" aria-label="Scheduled order starting" title="Scheduled order starting"></span>':''}<span class="eyebrow">TOKEN ${formatToken(order.tokenNumber)}</span><h2>${new Date(order.scheduledFor).toLocaleString('en-IN',{dateStyle:'medium',timeStyle:'short'})}</h2><p><strong>${html(order.customerName||order.customer)}</strong> · ${order.items.map(item=>`${item.qty} × ${html(item.name)}`).join(', ')}</p><div class="chips"><span class="chip">${html(order.status)}</span><span class="chip">${money(order.total)}</span></div><div class="actions">${orderActions(order)}<button class="btn small secondary" data-print-order="${html(order.id)}">Print</button></div></article>`}).join('')||empty('No scheduled orders')}</div>`;
  bindOrderActions();checkScheduledOrderAlerts();
}
function checkScheduledOrderAlerts(){
  if(!menuFeature('scheduling'))return;
  const current=Date.now();
  let added=false;
  restaurantOrders().filter(order=>order.status==='Scheduled'&&order.scheduledFor).forEach(order=>{
    const remaining=new Date(order.scheduledFor).getTime()-current;
    if(remaining<=15*60000){
      if(!ringingOrderIds.has(order.id)){ringingOrderIds.add(order.id);added=true}
      if(!scheduleAlertedIds.has(order.id)){scheduleAlertedIds.add(order.id);toast(`Scheduled token ${formatToken(order.tokenNumber)} starts within 15 minutes`)}
    }
  });
  if(added)updateOrderAlertSound();
}

async function loadMealSubscriptions(){
  if(!menuFeature('customerSubscriptions'))return [];
  if(isCloudMenuSession())mealSubscriptions=(await Gravity58Ads.list(ownerSubscriptionKind())).filter(row=>row.ownerId===cloudOwnerId());
  else mealSubscriptions=state.mealSubscriptions||[];
  return mealSubscriptions;
}
function subscriptionsView(){
  if(!menuFeature('customerSubscriptions')){view='pricing';return pricingView()}
  $('#page').innerHTML='<div class="remote-menu-loading"><span></span><h2>Loading subscriptions</h2></div>';
  loadMealSubscriptions().then(drawSubscriptionsView).catch(error=>{$('#page').innerHTML=empty(error.message||'Could not load subscriptions')});
}
function safePlanColour(value,fallback){return /^#[0-9a-f]{6}$/i.test(String(value||''))?String(value):fallback}
function normaliseDeliveryDays(value){return [...new Set((Array.isArray(value)?value:[]).map(Number).filter(day=>Number.isInteger(day)&&day>=0&&day<=6))]}
function deliveryDaysLabel(value){const days=normaliseDeliveryDays(value);return days.length?WEEKDAYS.filter(day=>days.includes(day.id)).map(day=>day.short).join(' · '):'Days not selected'}
function nextPlanDeliveryDate(deliveryDays,deliveryTime='12:00',from=new Date()){
  const days=normaliseDeliveryDays(deliveryDays);if(!days.length)return '';
  const shifted=new Date(from.getTime()+330*60000),[hour,minute]=/^\d{2}:\d{2}$/.test(deliveryTime)?deliveryTime.split(':').map(Number):[12,0];
  for(let offset=0;offset<=7;offset+=1){const indiaDate=new Date(Date.UTC(shifted.getUTCFullYear(),shifted.getUTCMonth(),shifted.getUTCDate()+offset));if(!days.includes(indiaDate.getUTCDay()))continue;const candidate=new Date(Date.UTC(indiaDate.getUTCFullYear(),indiaDate.getUTCMonth(),indiaDate.getUTCDate(),hour,minute)-330*60000);if(candidate.getTime()>from.getTime())return candidate.toISOString()}
  return '';
}
async function secureSubscriptionAction(action,row,extra={}){
  const functionId=Gravity58Ads.config?.digitalOrderFunctionId,ownerId=row.ownerId||cloudOwnerId(),subscriptionId=row.id||row.$id;
  if(functionId&&Gravity58Ads.executeFunction){const result=await Gravity58Ads.executeFunction(functionId,{action,subscription:{ownerId,subscriptionId,...extra}});if(!result?.subscription)throw new Error('Secure subscription service did not return the updated request.');return result.subscription}
  if(action==='send-subscription-link'){const paymentLink=String(extra.paymentLink||row.paymentLink||'').trim();if(!/^https:\/\//i.test(paymentLink))throw new Error('Enter a valid secure HTTPS subscription payment link.');return Gravity58Ads.update(ownerSubscriptionKind(ownerId),subscriptionId,{paymentLink,status:'Payment Link Sent',paymentLinkSentAt:now(),updatedAt:now()})}
  if(action==='submit-subscription-payment')return Gravity58Ads.update(ownerSubscriptionKind(ownerId),subscriptionId,{status:'Payment Proof Submitted',paymentSubmittedAt:now(),...extra,updatedAt:now()});
  if(action==='confirm-subscription-payment'){if(row.paymentReceiptFileId)await Gravity58Ads.removeAdMedia(row.paymentReceiptFileId);return Gravity58Ads.update(ownerSubscriptionKind(ownerId),subscriptionId,{status:'Active',activatedAt:now(),nextScheduledMeal:nextPlanDeliveryDate(row.deliveryDays,row.deliveryTime),paymentReceiptFileId:'',paymentReceiptUrl:'',paymentReceiptName:'',paymentReceiptType:'',paymentReceiptDeletedAt:now(),updatedAt:now()})}
  throw new Error('Unsupported subscription action.');
}
function subscriptionPlanCard(plan,{owner=false,subscribed=false}={}){
  const primary=safePlanColour(plan.themeColor,'#7a2512'),accent=safePlanColour(plan.accentColor,'#ff7a12'),title=plan.planType||plan.name||'Meal Plan';
  return `<article class="card meal-plan-card subscription-plan-3d" style="--plan-primary:${primary};--plan-accent:${accent}">${plan.imageUrl?`<div class="meal-plan-art">${imageMarkup(plan.imageUrl,title,'meal-plan-image')}</div>`:''}<div class="meal-plan-content"><span>${html(title)}</span><h3>${html(plan.name||title)}</h3><div class="pricing-amount">${money(plan.price)}</div><p>${html(plan.description||'Fresh meals prepared by the restaurant.')}</p><div class="chips"><span class="chip">${Number(plan.meals)||0} meals</span><span class="chip">${html(plan.periodLabel||'Monthly')}</span><span class="chip">${html(deliveryDaysLabel(plan.deliveryDays))} · ${html(plan.deliveryTime||'12:00')}</span>${subscribed?'<span class="chip">Requested</span>':''}</div>${owner?`<div class="actions"><button class="btn small secondary" data-edit-plan="${html(plan.id)}">Edit</button><button class="btn small red" data-delete-plan="${html(plan.id)}">Delete</button></div>`:`<button class="btn full customer-plan-action" data-customer-subscribe="${html(plan.id)}" ${subscribed?'disabled':''}>${subscribed?'Request sent':'Request Subscription'}</button>`}</div></article>`
}
function drawSubscriptionsView(){
  const r=activeRestaurant(),plans=r.subscriptionPlans||[],subscribers=mealSubscriptions.filter(row=>row.restaurantId===r.id);
  const subscriberCards=subscribers.map(row=>{const id=row.id||row.$id,delivered=Number(row.mealsDelivered||0),total=Number(row.totalMeals||0),progress=total?Math.min(100,Math.round(delivered/total*100)):0;let workflow='';
    if(row.status==='Requested')workflow=`<div class="subscription-activation-panel"><label>Customer payment link<input type="url" inputmode="url" data-sub-link-input="${html(id)}" value="${html(row.paymentLink||'')}" placeholder="https://your-payment-link" aria-label="Customer payment link" required></label><button class="btn small subscription-owner-primary" data-send-sub-link="${html(id)}">Send Payment Link</button><small>Enter or paste the secure link, then activate it for this customer.</small></div>`;
    if(row.status==='Payment Link Sent')workflow='<span class="subscription-workflow-note">Payment link is visible in the customer dashboard.</span>';
    if(row.status==='Payment Proof Submitted')workflow=`${row.paymentReceiptUrl?`<a class="btn small secondary" href="${html(row.paymentReceiptUrl)}" target="_blank" rel="noopener">View receipt</a>`:''}<button class="btn small subscription-owner-primary" data-confirm-sub-payment="${html(id)}">Confirm payment</button>`;
    if(row.status==='Active')workflow=`<button class="btn small green" data-deliver-meal="${html(id)}">Meal Delivered</button>`;
    return `<article class="card subscriber-management-card status-${html(String(row.status||'requested').toLowerCase().replace(/\s+/g,'-'))}"><div class="subscriber-card-head"><div><span class="eyebrow">${html(row.planType||row.planName||'MEAL PLAN')}</span><h3>${html(row.customerName||'Customer')}</h3><small>${html(row.customerEmail||'')}</small></div><span class="chip">${html(row.status||'Requested')}</span></div><div class="subscription-service-days">${html(deliveryDaysLabel(row.deliveryDays))} · ${html(row.deliveryTime||'12:00')}</div><div class="subscriber-meal-progress"><div><span>Meals delivered</span><strong>${delivered} / ${total||'∞'}</strong></div><progress max="100" value="${progress}"></progress></div><p><strong>Next meal:</strong> ${row.nextScheduledMeal?new Date(row.nextScheduledMeal).toLocaleString('en-IN',{dateStyle:'medium',timeStyle:'short'}):'Starts after payment confirmation'}</p>${row.ownerNote?`<p class="subscriber-note">${html(row.ownerNote)}</p>`:''}<div class="actions">${workflow}<button class="btn small secondary" data-manage-sub="${html(id)}">Manage</button></div></article>`}).join('');
  $('#page').innerHTML=`<section class="subscription-owner-hero"><div><span class="eyebrow">PROFIT-STYLE MEAL MANAGEMENT</span><h1>Meal Subscriptions</h1><p>Create plans, send payment links, verify customer receipts and record each scheduled meal.</p></div><button class="btn" id="addMealPlan">+ Create Subscription Card</button></section><div class="grid stats">${metric('Active Plans',plans.filter(row=>row.active!==false).length)}${metric('Subscribers',subscribers.length)}${metric('Payment Proofs',subscribers.filter(row=>row.status==='Payment Proof Submitted').length)}${metric('Meals Delivered',subscribers.reduce((sum,row)=>sum+Number(row.mealsDelivered||0),0))}</div><div class="section-head"><div><h2>Customer-facing plans</h2><p class="muted">Plan type, colours, cover image, delivery weekdays and time are editable.</p></div></div><div class="pricing-grid owner-meal-plans">${plans.map(plan=>subscriptionPlanCard(plan,{owner:true})).join('')||empty('Create your first customer subscription card')}</div><div class="section-head"><div><h2>Subscribed customers</h2><p class="muted">Request → payment link → receipt verification → active meal schedule.</p></div></div><div class="subscriber-management-grid">${subscriberCards||empty('No customer subscriptions yet.')}</div>`;
  $('#addMealPlan').onclick=()=>openMealPlanForm();$$('[data-edit-plan]').forEach(button=>button.onclick=()=>openMealPlanForm(button.dataset.editPlan));$$('[data-delete-plan]').forEach(button=>button.onclick=()=>deleteMealPlan(button.dataset.deletePlan));$$('[data-deliver-meal]').forEach(button=>button.onclick=()=>markMealDelivered(button.dataset.deliverMeal));$$('[data-manage-sub]').forEach(button=>button.onclick=()=>manageMealSubscription(button.dataset.manageSub));
  $$('[data-send-sub-link]').forEach(button=>button.onclick=async()=>{const row=subscribers.find(item=>(item.id||item.$id)===button.dataset.sendSubLink),input=$(`[data-sub-link-input="${CSS.escape(button.dataset.sendSubLink)}"]`);if(!row)return;const plan=plans.find(item=>item.id===row.planId),paymentLink=String(input?.value||'').trim();if(!/^https:\/\//i.test(paymentLink)){input?.focus();return toast('Enter a valid secure HTTPS payment link')};if(plan)Object.assign(row,{deliveryDays:normaliseDeliveryDays(plan.deliveryDays),deliveryTime:plan.deliveryTime||row.deliveryTime});button.disabled=true;try{Object.assign(row,await secureSubscriptionAction('send-subscription-link',row,{paymentLink}));drawSubscriptionsView();toast('Payment link sent to the customer dashboard')}catch(error){button.disabled=false;toast(error.message||'Could not send payment link')}});
  $$('[data-confirm-sub-payment]').forEach(button=>button.onclick=async()=>{const row=subscribers.find(item=>(item.id||item.$id)===button.dataset.confirmSubPayment);if(!row)return;button.disabled=true;try{Object.assign(row,await secureSubscriptionAction('confirm-subscription-payment',row));drawSubscriptionsView();toast('Subscription activated and next meal scheduled')}catch(error){button.disabled=false;toast(error.message||'Could not confirm subscription payment')}});
}
function openMealPlanForm(id=''){
  const r=activeRestaurant(),plan=(r.subscriptionPlans||[]).find(row=>row.id===id)||{};
  const selectedDays=normaliseDeliveryDays(plan.deliveryDays?.length?plan.deliveryDays:[1,2,3,4,5,6,0]);
  modal(id?'Edit Subscription Card':'Create Subscription Card',`<form id="mealPlanForm"><div class="form-grid"><div class="field"><label>Plan type</label><input name="planType" value="${html(plan.planType||'')}" placeholder="Fitness, Family, Weight Loss" required></div><div class="field"><label>Plan name</label><input name="name" value="${html(plan.name||'')}" required></div><div class="field"><label>Price (₹)</label><input name="price" type="number" min="1" value="${Number(plan.price)||''}" required></div><div class="field"><label>Total meals</label><input name="meals" type="number" min="1" value="${Number(plan.meals)||30}" required></div><div class="field"><label>Period label</label><input name="periodLabel" value="${html(plan.periodLabel||'1 Month')}" required></div><div class="field"><label>Meal delivery time</label><input name="deliveryTime" type="time" value="${html(plan.deliveryTime||'12:00')}" required></div><div class="field"><label>Primary colour</label><input name="themeColor" type="color" value="${safePlanColour(plan.themeColor,'#7a2512')}"></div><div class="field"><label>Accent colour</label><input name="accentColor" type="color" value="${safePlanColour(plan.accentColor,'#ff7a12')}"></div><div class="field"><label>Plan cover image <small>(JPG, PNG or WebP, max 100 KB)</small></label><input name="planImage" type="file" accept="image/jpeg,image/png,image/webp"></div></div><fieldset class="delivery-days-field"><legend>Meal delivery days in a week</legend><div class="delivery-day-grid">${WEEKDAYS.map(day=>`<label><input type="checkbox" name="deliveryDays" value="${day.id}" ${selectedDays.includes(day.id)?'checked':''}><span>${day.short}</span></label>`).join('')}</div><small>Customers will see their next meal date based on these selected days.</small></fieldset>${plan.imageUrl?`<div class="meal-plan-form-preview">${imageMarkup(plan.imageUrl,plan.planType||'Plan','meal-plan-image')}<span>Current cover image</span></div>`:''}<div class="field"><label>Description</label><textarea name="description" required>${html(plan.description||'')}</textarea></div><div class="field"><label>Secure subscription payment link</label><input name="paymentLink" type="url" value="${html(plan.paymentLink||'')}" placeholder="https://..." required><small>The customer sees this only after you press Send payment link.</small></div><label class="menu-checkbox"><input name="active" type="checkbox" ${plan.active!==false?'checked':''}> Show this plan to customers</label><button class="btn full">Save Subscription Card</button></form>`,()=>{$('#mealPlanForm').onsubmit=async event=>{event.preventDefault();const form=event.currentTarget,button=event.submitter,fd=new FormData(form),values=Object.fromEntries(fd),entry=plan.id?plan:{id:uid('mealplan')},selectedImage=form.planImage.files[0],oldFileId=entry.imageFileId||'',deliveryDays=normaliseDeliveryDays(fd.getAll('deliveryDays'));if(!deliveryDays.length)return toast('Select at least one meal delivery day');button.disabled=true;try{let upload=null;if(selectedImage){upload=await uploadMenuImage(selectedImage,values.planType||values.name);entry.imageUrl=upload.mediaUrl;entry.imageFileId=upload.fileId}delete values.planImage;delete values.deliveryDays;Object.assign(entry,values,{price:Number(values.price),meals:Number(values.meals),deliveryDays,active:fd.has('active')});r.subscriptionPlans||=[];if(!plan.id)r.subscriptionPlans.push(entry);await persistCloudMenu(r.id);if(upload&&oldFileId&&oldFileId!==upload.fileId)Gravity58Ads.removeMenuMedia(oldFileId).catch(()=>{});closeModal();drawSubscriptionsView();toast('Subscription card published')}catch(error){button.disabled=false;toast(error.message||'Could not save subscription card')}}});
  $('#mealPlanForm').paymentLink.required=false;
}
async function deleteMealPlan(id){const r=activeRestaurant(),plan=(r.subscriptionPlans||[]).find(row=>row.id===id);if(!plan||!confirm(`Delete ${plan.name}? Existing subscriber records will remain.`))return;r.subscriptionPlans=r.subscriptionPlans.filter(row=>row.id!==id);try{await persistCloudMenu(r.id);if(plan.imageFileId)Gravity58Ads.removeMenuMedia(plan.imageFileId).catch(()=>{});drawSubscriptionsView();toast('Subscription card deleted')}catch(error){r.subscriptionPlans.push(plan);toast(error.message||'Could not delete subscription card')}}
async function markMealDelivered(id){const row=mealSubscriptions.find(item=>(item.id||item.$id)===id);if(!row)return;const changes={mealsDelivered:Number(row.mealsDelivered||0)+1,lastMealDeliveredAt:now(),nextScheduledMeal:nextPlanDeliveryDate(row.deliveryDays,row.deliveryTime,new Date(Date.now()+60000)),updatedAt:now()};try{if(isCloudMenuSession())Object.assign(row,await Gravity58Ads.update(ownerSubscriptionKind(),id,changes));else Object.assign(row,changes);drawSubscriptionsView();toast('Meal delivery recorded and next date scheduled')}catch(error){toast(error.message||'Could not update meal delivery')}}
function manageMealSubscription(id){const row=mealSubscriptions.find(item=>(item.id||item.$id)===id);if(!row)return;modal('Manage Customer Subscription',`<form id="manageMealSubscription"><div class="form-grid"><div class="field"><label>Status</label><select name="status">${['Requested','Payment Link Sent','Payment Proof Submitted','Active','Paused','Cancelled'].map(status=>`<option ${row.status===status?'selected':''}>${status}</option>`).join('')}</select></div><div class="field"><label>Total meals</label><input name="totalMeals" type="number" min="0" value="${Number(row.totalMeals)||0}"></div><div class="field"><label>Meals delivered</label><input name="mealsDelivered" type="number" min="0" value="${Number(row.mealsDelivered)||0}"></div><div class="field"><label>Next scheduled meal</label><input name="nextScheduledMeal" type="datetime-local" value="${row.nextScheduledMeal?new Date(new Date(row.nextScheduledMeal).getTime()-new Date(row.nextScheduledMeal).getTimezoneOffset()*60000).toISOString().slice(0,16):''}"></div></div><div class="field"><label>Owner note visible to customer</label><textarea name="ownerNote">${html(row.ownerNote||'')}</textarea></div><button class="btn full">Save Subscriber</button></form>`,()=>{$('#manageMealSubscription').onsubmit=async event=>{event.preventDefault();const values=Object.fromEntries(new FormData(event.target));values.nextScheduledMeal=values.nextScheduledMeal?new Date(values.nextScheduledMeal).toISOString():'';values.totalMeals=Math.max(0,Number(values.totalMeals)||0);values.mealsDelivered=Math.max(0,Number(values.mealsDelivered)||0);try{if(isCloudMenuSession())Object.assign(row,await Gravity58Ads.update(ownerSubscriptionKind(),id,{...values,updatedAt:now()}));else Object.assign(row,values);closeModal();drawSubscriptionsView();toast('Subscriber updated')}catch(error){toast(error.message||'Could not update subscriber')}}})}
function adsView(){const key=`${activeRestaurant().name}|${activeRestaurant().city}`;const ads=(state.advertisements||[]).filter(a=>a.restaurantKey===key);const requests=state.adRequests||[];$('#page').innerHTML=`<div class="section-head"><div><h1>Gravity58 Advertisement Control</h1><p class="muted">Central ad control using unique restaurant key: <strong>${key}</strong></p></div><button class="btn" id="createAd">+ Create Advertisement</button></div><div class="grid stats">${metric('Active Ads',ads.filter(a=>a.active).length)}${metric('Restaurant Ads',ads.length)}${metric('Ad Enquiries',requests.length)}${metric('Pending Enquiries',requests.filter(x=>x.status!=='Contacted').length)}</div><div class="section-head"><h2>Advertisements for this restaurant</h2></div><div class="grid restaurant-grid">${ads.map(a=>`<article class="card"><div class="ad-icon">${a.image||'📣'}</div><h3>${a.title}</h3><p class="muted">${a.description}</p><div class="chips"><span class="chip">${a.active?'Enabled':'Disabled'}</span><span class="chip">${a.restaurantKey}</span></div><div class="actions"><button class="btn small" data-toggle-ad="${a.id}">${a.active?'Disable':'Enable'}</button><button class="btn small red" data-delete-ad="${a.id}">Delete</button></div></article>`).join('')||empty('No advertisement enabled. Customers will see the Ad Space placeholder.')}</div><div class="section-head"><h2>Ad-space enquiries</h2></div><div class="card table-wrap"><table><thead><tr><th>Name</th><th>Phone</th><th>Email</th><th>Restaurant</th><th>Status</th><th></th></tr></thead><tbody>${requests.map(q=>`<tr><td>${q.name}</td><td>${q.phone}</td><td>${q.email}</td><td>${q.restaurantKey}</td><td>${q.status||'New'}</td><td><button class="btn small secondary" data-contacted="${q.id}">Mark Contacted</button></td></tr>`).join('')||'<tr><td colspan="6" class="muted">No enquiries yet.</td></tr>'}</tbody></table></div>`;$('#createAd').onclick=()=>modal('Create G58 Advertisement',`<form id="adForm"><div class="field"><label>Restaurant key</label><input value="${key}" disabled></div><div class="field"><label>Title</label><input name="title" required></div><div class="field"><label>Description</label><textarea name="description" required></textarea></div><div class="form-grid"><div class="field"><label>Button label</label><input name="buttonLabel" value="View Offer"></div><div class="field"><label>Destination URL</label><input name="destinationUrl" value="#"></div><div class="field"><label>Icon / Emoji</label><input name="image" value="📣"></div><div class="field"><label>Status</label><select name="active"><option value="true">Enabled</option><option value="false">Disabled</option></select></div></div><button class="btn full">Save Advertisement</button></form>`,()=>{$('#adForm').onsubmit=e=>{e.preventDefault();const d=Object.fromEntries(new FormData(e.target));state.advertisements.push({id:uid('ad'),restaurantKey:key,...d,active:d.active==='true'});save();closeModal();adsView();toast('Advertisement saved')}});$$('[data-toggle-ad]').forEach(b=>b.onclick=()=>{const a=state.advertisements.find(x=>x.id===b.dataset.toggleAd);a.active=!a.active;save();adsView()});$$('[data-delete-ad]').forEach(b=>b.onclick=()=>{state.advertisements=state.advertisements.filter(x=>x.id!==b.dataset.deleteAd);save();adsView()});$$('[data-contacted]').forEach(b=>b.onclick=()=>{const q=state.adRequests.find(x=>x.id===b.dataset.contacted);q.status='Contacted';save();adsView()})}
function currentAdvertisement(r,slotId='right_rail'){
  const restaurantKey=`${r.name}|${r.city}`,normaliseKey=value=>String(value||'').split('|').map(part=>part.trim().toLocaleLowerCase()).join('|'),cacheKey=`${normaliseKey(restaurantKey)}|${slotId}`,ts=Date.now();
  const candidates=(state.advertisements||[]).filter(a=>(String(a.restaurantId||'')===String(r.id)||normaliseKey(a.restaurantKey)===normaliseKey(restaurantKey))&&a.active&&(!a.slotId||a.slotId===slotId)&&(a.lifetime===true||!a.expiresAt||new Date(a.expiresAt).getTime()>ts)).sort((a,b)=>new Date(b.activatedAt||b.createdAt||0)-new Date(a.activatedAt||a.createdAt||0));
  const cachedId=stableAdvertisementIds.get(cacheKey),cached=candidates.find(ad=>(ad.id||ad.$id)===cachedId);
  if(cached)return cached;
  const selected=candidates[0];if(selected)stableAdvertisementIds.set(cacheKey,selected.id||selected.$id);else stableAdvertisementIds.delete(cacheKey);return selected;
}
function adTimeLeft(ad){if(ad?.lifetime===true)return 'Lifetime advertisement';if(!ad?.expiresAt)return 'Slot duration not set';const ms=new Date(ad.expiresAt).getTime()-Date.now();if(ms<=0)return 'Expired';const h=Math.floor(ms/36e5),m=Math.floor((ms%36e5)/6e4);return `${h}h ${m}m remaining`}
function adExpiryBadge(ad){return ad&&ad.lifetime!==true&&ad.expiresAt?`<small class="ad-expiry ad-expiry-badge" data-ad-expiry="${html(ad.expiresAt)}">${adTimeLeft(ad)}</small>`:''}
function publicAdSection(r){
  let slotId='right_rail';
  if(location.hash.includes('track')){const id=new URLSearchParams(location.hash.replace('#track&','')).get('order'),order=state.orders.find(row=>row.id===id);slotId=order?.status==='Completed'?'thankyou':'preparing'}
  const ad=currentAdvertisement(r,slotId);
  if(ad)return `<section class="public-ad-placement"><button class="ad-space-contact" data-book-ad-space type="button">Book Ad Space</button><section class="public-ad active-ad ad-cover-placement"><a class="ad-click-area" href="${html(ad.destinationUrl||'#')}" target="_blank" rel="noopener" aria-label="Open ${html(ad.title||'advertisement')}"><span class="ad-art">${adMediaMarkup(ad,'public-ad-media')}</span></a>${adExpiryBadge(ad)}</section></section>`;
  return `<section class="public-ad-placement"><button class="ad-space-contact" data-book-ad-space type="button">Book Ad Space</button><section class="public-ad ad-placeholder"><div class="ad-art">✦</div><div><p class="eyebrow">GRAVITY58 AD SPACE</p><h3>Your advertisement can appear here</h3><p>Book a restaurant-specific advertising slot through Gravity58.</p></div></section></section>`
}
function bindPublicAdContact(r){$$('[data-book-ad-space]').forEach(b=>b.onclick=()=>{const base=CONFIG.adBookingPortalUrl||'../advertise/';location.href=`${base}?restaurant=${encodeURIComponent(`${r.name}|${r.city}`)}`})}
function settingsView(){
  const r=activeRestaurant(),payment=restaurantPaymentSettings(r);
  $('#page').innerHTML=`<div class="section-head"><div><h1>Restaurant Settings</h1><p class="muted">Settings apply only to ${html(r.name)}</p></div></div><article class="card"><form id="settingsForm"><div class="form-grid"><div class="field"><label>Restaurant status</label><select name="open"><option value="true" ${r.open?'selected':''}>Open</option><option value="false" ${!r.open?'selected':''}>Closed</option></select></div><div class="field"><label>Accept orders</label><select name="accepting"><option value="true" ${r.accepting?'selected':''}>Yes</option><option value="false" ${!r.accepting?'selected':''}>No</option></select></div><div class="field"><label>Tax %</label><input name="tax" type="number" value="${r.tax||0}"></div><div class="field"><label>Service charge %</label><input name="service" type="number" value="${r.service||0}"></div><div class="field"><label>Enable customer payment</label><select name="paymentEnabled"><option value="true" ${payment.enabled?'selected':''}>Enabled</option><option value="false" ${!payment.enabled?'selected':''}>Disabled</option></select></div><div class="field"><label>UPI ID</label><input name="upiId" value="${html(payment.upiId)}" placeholder="restaurant@upi"></div><div class="field"><label>UPI payee name</label><input name="upiPayeeName" value="${html(payment.payeeName)}" placeholder="Exact bank-registered receiver name"><small>Enter the exact receiver or merchant name shown by the bank for this UPI ID.</small></div><div class="field"><label>Instagram URL</label><input name="instagram" value="${html(r.social?.Instagram||'')}"></div><div class="field"><label>WhatsApp number or URL</label><input name="whatsapp" value="${html(r.social?.WhatsApp||'')}" placeholder="9876543210 or https://wa.me/..."></div></div><p class="muted">Customers scan the restaurant UPI QR, upload the payment receipt image, and the order remains under Payment Verification until you confirm it. Confirmation permanently deletes the receipt image.</p><button class="btn">Save Settings</button></form></article>`;
  $('#settingsForm').onsubmit=async event=>{
    event.preventDefault();
    const values=Object.fromEntries(new FormData(event.target)),button=event.submitter;
    const paymentEnabled=values.paymentEnabled==='true',upiId=values.upiId.trim(),upiPayeeName=values.upiPayeeName.trim(),whatsapp=values.whatsapp.trim();
    if(paymentEnabled&&!upiId)return toast('Add a UPI ID before enabling the customer payment QR');
    if(paymentEnabled&&upiId&&!upiPayeeName)return toast('Add the exact bank-registered UPI payee name');
    button.disabled=true;
    Object.assign(r,{open:values.open==='true',accepting:values.accepting==='true',tax:+values.tax,service:+values.service,paymentEnabled,upiId,upiPayeeName,social:{...r.social,Instagram:values.instagram.trim(),WhatsApp:whatsapp}});
    try{await persistCloudMenu(r.id);toast('Settings saved and published to the customer menu');renderShell()}catch(error){button.disabled=false;toast(error.message||'Could not save settings')}
  };
}

async function loadRemoteMenuConfig(source){
  if(remoteMenuLoading)return;remoteMenuLoading=true;app.innerHTML='<main class="public-menu"><div class="remote-menu-loading"><span></span><h2>Loading published menu</h2><p>Downloading the restaurant config securely…</p></div></main>';
  try{const url=new URL(source,location.href);if(!['https:','http:'].includes(url.protocol))throw new Error('Unsupported config URL');const response=await fetch(url.href,{mode:'cors',credentials:'omit'});if(!response.ok)throw new Error(`Config download failed (${response.status})`);const text=await response.text();if(text.length>30*1024*1024)throw new Error('Menu config is too large');remoteMenuConfig=validateMenuConfig(JSON.parse(text));remoteMenuSource=source;remoteMenuLoading=false;renderPublicMenu()}catch(error){remoteMenuLoading=false;remoteMenuSource='';remoteMenuConfig=null;app.innerHTML=`<main class="public-menu"><div class="remote-menu-error"><h2>Menu could not be loaded</h2><p>${html(error.message||'Check the public config URL and hosting permissions.')}</p><a class="btn" href="${location.href.split('#')[0]}">Return to Digital Menu</a></div></main>`}
}

function cloudRecordToConfig(record){if(!record?.restaurant?.id||!Array.isArray(record.categories)||!Array.isArray(record.items))throw new Error('This restaurant menu is not available');return {g58MenuConfig:1,restaurant:{...record.restaurant},categories:record.categories.map(row=>({...row,restaurantId:record.restaurant.id})),items:record.items.map(row=>({...row,restaurantId:record.restaurant.id,available:row.available!==false}))}}
function cacheCloudMenuForOrders(config,ownerId){const rid=config.restaurant.id,existing=state.restaurants.find(row=>row.id===rid),ownerIdForCache=existing?.ownerId||`public_${ownerId}`;state.restaurants=state.restaurants.filter(row=>row.id!==rid);state.categories=state.categories.filter(row=>row.restaurantId!==rid);state.items=state.items.filter(row=>row.restaurantId!==rid);state.restaurants.push({...config.restaurant,ownerId:ownerIdForCache,cloudOwnerId:ownerId,cloudRecordId:rid,logo:'G'});state.categories.push(...config.categories.map(row=>({...row,restaurantId:rid})));state.items.push(...config.items.map(row=>({...row,restaurantId:rid})));save()}
function cacheCloudMenuForOrdersSafely(config,ownerId){
  const rid=config.restaurant.id,existing=state.restaurants.find(row=>row.id===rid);
  const signedInOwner=state.session?.provider==='gravity58'&&cloudOwnerId()===ownerId?state.session.userId:'';
  const ownerIdForCache=existing?.ownerId||signedInOwner||`public_${ownerId}`;
  state.restaurants=state.restaurants.filter(row=>row.id!==rid);
  state.categories=state.categories.filter(row=>row.restaurantId!==rid);
  state.items=state.items.filter(row=>row.restaurantId!==rid);
  state.restaurants.push({...config.restaurant,ownerId:ownerIdForCache,cloudOwnerId:ownerId,cloudRecordId:rid,logo:'G'});
  state.categories.push(...config.categories.map(row=>({...row,restaurantId:rid})));
  state.items.push(...config.items.map(row=>({...row,restaurantId:rid})));
  save();
}
async function loadCloudMenuConfig(recordId,ownerId){
  if(remoteMenuLoading)return;
  remoteMenuLoading=true;
  app.innerHTML='<main class="public-menu"><div class="remote-menu-loading"><span></span><h2>Loading restaurant menu</h2><p>Reading the latest menu from Gravity58…</p></div></main>';
  try{
    if(!recordId)throw new Error('Invalid customer menu link');
    // Older QR links may omit the owner, so recover the public menu by its ID.
    const record=await Gravity58Ads.get(cloudMenuKind(ownerId||'public'),recordId);
    const resolvedOwnerId=ownerId||record.ownerId||'';
    if(!resolvedOwnerId)throw new Error('This customer menu link is incomplete');
    if(ownerId&&record.ownerId!==ownerId)throw new Error('Restaurant menu owner does not match this link');
    remoteMenuConfig=cloudRecordToConfig(record);
    remoteMenuSource=`cloud:${resolvedOwnerId}:${recordId}`;
    cacheCloudMenuForOrdersSafely(remoteMenuConfig,resolvedOwnerId);
    if(!ownerId){
      const repaired=`#menu&cloud=${encodeURIComponent(recordId)}&owner=${encodeURIComponent(resolvedOwnerId)}`;
      history.replaceState(null,'',repaired);
    }
    remoteMenuLoading=false;
    renderPublicMenu();
  }catch(error){
    remoteMenuLoading=false;
    remoteMenuSource='';
    remoteMenuConfig=null;
    app.innerHTML=`<main class="public-menu"><div class="remote-menu-error"><h2>Menu could not be loaded</h2><p>${html(error.message||'Ask the restaurant for its latest menu QR code.')}</p><a class="btn" href="${location.href.split('#')[0]}">Return to Digital Menu</a></div></main>`;
  }
}

function publicMenuParams(){return new URLSearchParams(location.hash.slice(1).replace(/^menu(?:&|\?)?/,''))}

function renderPublicMenu(){
  const params=publicMenuParams();
  const configUrl=params.get('config')||'',cloudId=params.get('cloud')||'',cloudMenu=!!cloudId,ownerId=params.get('owner')||'',published=!!configUrl,sharedMenu=published||cloudMenu;
  if(published&&remoteMenuSource!==configUrl){loadRemoteMenuConfig(configUrl);return}
  if(cloudMenu&&remoteMenuSource!==`cloud:${ownerId}:${cloudId}`){loadCloudMenuConfig(cloudId,ownerId);return}
  const rid=sharedMenu?remoteMenuConfig?.restaurant?.id:(params.get('restaurant')||state.activeRestaurantId);
  const r=sharedMenu?remoteMenuConfig?.restaurant:state.restaurants.find(x=>x.id===rid);
  if(!r){app.innerHTML=`<main class="public-menu"><div class="empty">Restaurant not found</div></main>`;return}
  customerContext=published?null:JSON.parse(sessionStorage.getItem(`gravity58Customer_${rid}`)||'null');
  if(customerContext&&!validCustomerPhone(customerContext.phone)){customerContext=null;sessionStorage.removeItem(`gravity58Customer_${rid}`)}
  if(!published&&!customerContext){
    modal('Welcome to '+r.name,`<form id="identityForm" class="customer-entry-form"><div class="field centered-field"><label>Customer name <small id="nameRequirement">(required for counter orders)</small></label><input name="customerName" required placeholder="Enter your name"></div><div class="service-choice"><label class="choice-card"><input type="radio" name="serviceMode" value="counter" checked><span><strong>Single Counter</strong><small>Collect from the service counter</small></span></label><label class="choice-card"><input type="radio" name="serviceMode" value="table"><span><strong>Enter Table Number</strong><small>Order for your table</small></span></label></div><div class="field" id="tableNumberField" hidden><label>Table number</label><input name="tableNumber" placeholder="Example: 12"></div><div class="field"><label>Phone number <small>(required)</small></label><input name="phone" type="tel" inputmode="tel" autocomplete="tel" minlength="10" maxlength="18" placeholder="Enter customer phone number" required><small>Used to keep this customer's active counter order and total together.</small></div><button class="btn full">Continue to Menu</button></form>`,()=>{const form=$('#identityForm'),tableField=$('#tableNumberField'),nameNote=$('#nameRequirement');const syncIdentity=()=>{const table=form.serviceMode.value==='table';tableField.hidden=!table;form.tableNumber.required=table;form.customerName.required=!table;nameNote.textContent=table?'(optional for table orders)':'(required for counter orders)';form.customerName.placeholder=table?'Optional customer name':'Enter your name'};$$('input[name="serviceMode"]',form).forEach(x=>x.onchange=syncIdentity);syncIdentity();form.onsubmit=e=>{e.preventDefault();const d=Object.fromEntries(new FormData(e.target));const customerName=(d.customerName||'').trim();const tableNumber=(d.tableNumber||'').trim();const phone=normaliseCustomerPhone(d.phone);if(d.serviceMode==='counter'&&!customerName)return toast('Enter customer name for counter order');if(d.serviceMode==='table'&&!tableNumber)return toast('Enter table number');if(!validCustomerPhone(phone))return toast('Enter a valid phone number with 10 to 15 digits');customerContext={restaurantId:rid,customerName,serviceMode:d.serviceMode,tableNumber:d.serviceMode==='table'?tableNumber:'',phone,customer:d.serviceMode==='table'?`${customerName?customerName+' · ':''}Table ${tableNumber}`:customerName};sessionStorage.setItem(`gravity58Customer_${rid}`,JSON.stringify(customerContext));closeModal();renderPublicMenu()}},{dismissible:false})
  }
  const cats=sharedMenu?remoteMenuConfig.categories:restaurantCategories(rid),items=sharedMenu?remoteMenuConfig.items:restaurantItems(rid),restaurantHero=localMediaSource(r,'logoImageKey','logoImage'),orderingEnabled=r.ordersEnabled!==false;
  if(customerCartRestaurantId!==rid){customerCartRestaurantId=rid;try{customerCart=JSON.parse(sessionStorage.getItem(`gravity58Cart_${rid}`)||'[]').filter(entry=>items.some(item=>item.id===entry.id))}catch{customerCart=[]}}
  const filterKey=`gravity58MenuFilters_${rid}`;
  const filters={category:'all',diet:'all',search:'',available:false,...JSON.parse(sessionStorage.getItem(filterKey)||'{}')};
  const activeCategory=cats.find(c=>c.id===filters.category);
  const ad=currentAdvertisement(r);
  app.innerHTML=`<main class="public-menu compact-public-menu">
    <section class="menu-sticky-header">
    <section class="compact-menu-hero">
      <nav class="menu-nav compact-nav"><div>${published?'<span class="published-menu-badge">Published customer menu</span>':cloudMenu?'<span class="published-menu-badge">Live account menu</span>':''}${!published?'<button class="meal-subscription-entry" id="openCustomerOrders" type="button" hidden>My Orders</button><button class="meal-subscription-entry new-customer-button" id="startNewCustomer" type="button">Start New Customer</button>':''}${r.premiumFeatures?'<button class="meal-subscription-entry" id="openMealSubscriptions" type="button" hidden>My Meal Dashboard</button>':''}</div><a class="sponsor-mini" href="https://www.g58.in" target="_blank" rel="noopener">Sponsored by <strong>Gravity58</strong></a></nav>
      <div class="compact-hero-layout"><div><p class="eyebrow">PREMIUM DIGITAL MENU</p><h1>${html(r.name)}</h1><p>${html(r.description)}</p><div class="compact-details"><span>📍 ${html(r.address||r.city)}</span><span>☎ ${html(r.phone||'Contact restaurant')}</span><span class="open-tag">${r.open?'Open now':'Closed'}</span></div></div><div class="compact-hero-dish">${imageMarkup(restaurantHero,r.name?.[0]||'G','compact-hero-photo')}</div></div>
    </section>
    <aside class="header-ad-panel">
      <button class="ad-space-contact" data-book-ad-space type="button">Book Ad Space</button>
      ${ad?`<div class="header-active-ad creative-${html(ad.creativeStyle||'spotlight')}"><a class="ad-click-area" href="${html(ad.destinationUrl||'#')}" target="_blank" rel="noopener" aria-label="Open ${html(ad.title||'advertisement')}"><span class="header-ad-art">${adMediaMarkup(ad,'header-ad-media')}</span></a>${adExpiryBadge(ad)}</div>`:`<div class="header-ad-placeholder"><span class="ad-label">GRAVITY58 AD SPACE</span><div class="header-ad-art"><span class="media-fallback">G58</span></div><div><h3>Put your brand beside the menu</h3><p>Book this restaurant promotion slot.</p></div></div>`}
    </aside>
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
            <select id="publicMenuCategory" aria-label="Category"><option value="all" ${filters.category==='all'?'selected':''}>All categories</option>${cats.map(c=>`<option value="${c.id}" ${c.id===filters.category?'selected':''}>${html(c.name)}</option>`).join('')}</select>
          </div>
        </div>
        <header class="focused-menu-heading"><div><p class="eyebrow">CURATED MENU</p><h2 id="publicMenuHeading">${html(activeCategory?.name||'All dishes')}</h2></div><span id="publicMenuCount">${items.length} items</span></header>
        <div class="poster-menu-list swiggy-menu-list" id="publicMenuItems">${items.map((item,index)=>publicItem(item,{categories:cats,index,readOnly:published||!orderingEnabled})).join('')}</div>
        <div class="empty menu-filter-empty hidden" id="menuFilterEmpty">No dishes match these filters.</div>
      </section>
    </section>
    ${published?`<div class="published-menu-footer"><span><strong>View-only published menu</strong><small>Contact the restaurant to place your order.</small></span>${r.phone?`<a class="btn" href="tel:${html(r.phone)}">Call Restaurant</a>`:''}</div>`:!orderingEnabled?`<div class="published-menu-footer menu-only-footer"><span><strong>Digital menu viewing is active</strong><small>Online ordering will be available after this restaurant activates an order plan.</small></span>${r.phone?`<a class="btn" href="tel:${html(r.phone)}">Call Restaurant</a>`:''}</div>`:`<div class="cart-bar compact-cart"><span><span id="cartCount">${customerCart.reduce((a,b)=>a+b.qty,0)}</span> items · <span id="cartTotal">${money(customerCart.reduce((a,b)=>a+b.qty*b.price,0))}</span></span><button class="btn" id="openCart">View Cart</button></div>`}
  </main>`;
  const persistFilters=()=>sessionStorage.setItem(filterKey,JSON.stringify(filters));
  const applyFilters=()=>{
    const query=(filters.search||'').trim().toLowerCase();
    const cards=$$('#publicMenuItems .poster-menu-item');
    let visible=0;
    cards.forEach(card=>{const show=(filters.category==='all'||card.dataset.category===filters.category)&&(filters.diet==='all'||card.dataset.type===filters.diet)&&(!filters.available||card.dataset.available==='true')&&(!query||card.dataset.search.includes(query));card.classList.toggle('hidden',!show);if(show)visible++});
    $$('[data-diet]').forEach(chip=>chip.classList.toggle('active',chip.dataset.diet===filters.diet));
    $('.availability-filter')?.classList.toggle('active',filters.available);
    const heading=cats.find(c=>c.id===filters.category)?.name||'All dishes';$('#publicMenuHeading').textContent=heading;$('#publicMenuCount').textContent=`${visible} item${visible===1?'':'s'}`;$('#menuFilterEmpty').classList.toggle('hidden',visible!==0);persistFilters();
  };
  $('#publicMenuCategory').onchange=e=>{filters.category=e.target.value;applyFilters()};
  $$('[data-diet]').forEach(b=>b.onclick=()=>{filters.diet=b.dataset.diet;applyFilters()});
  $('#availableOnlyFilter').onchange=e=>{filters.available=e.target.checked;applyFilters()};
  $('#publicMenuSearch').oninput=e=>{filters.search=e.target.value;applyFilters()};
  if(!published&&orderingEnabled){
    const itemMap=new Map(items.map(item=>[String(item.id),item]));
    $$('[data-qty-action]').forEach(button=>button.onclick=event=>{event.preventDefault();changeCartQuantity(button.dataset.item,button.dataset.qtyAction,itemMap.get(String(button.dataset.item)))});
    $$('[data-prepare-item]').forEach(control=>control.onchange=()=>{if(control.checked)openPreparationInstructions(control.dataset.prepareItem,itemMap.get(String(control.dataset.prepareItem)));else{const ci=customerCart.find(x=>x.id===control.dataset.prepareItem);if(ci){ci.prepareInstruction='';ci.prepareOptions=[];ci.customPrepareNote=''}persistCustomerCart();renderPublicMenu()}});
    $('#openCart').onclick=()=>openCart(r);
  }
  const premiumPortal=()=>openCustomerSubscriptionPortal(r,ownerId||remoteMenuSource.split(':')[1]||cloudOwnerId());
  const dashboardButton=$('#openMealSubscriptions');
  const ordersButton=$('#openCustomerOrders'),menuOwnerId=ownerId||remoteMenuSource.split(':')[1]||cloudOwnerId();
  if(Gravity58Ads?.configured)Gravity58Ads.currentUser().then(account=>{if(account?.email){if(dashboardButton){dashboardButton.hidden=false;dashboardButton.addEventListener('click',premiumPortal)}if(ordersButton){ordersButton.hidden=false;ordersButton.onclick=()=>openCustomerOrderHistory(r,menuOwnerId,account)}}}).catch(()=>{});
  $('#startNewCustomer')?.addEventListener('click',()=>{sessionStorage.removeItem(`gravity58Customer_${rid}`);sessionStorage.removeItem(`gravity58Cart_${rid}`);sessionStorage.removeItem(customerOpenOrderKey(rid));customerContext=null;customerCart=[];customerCartRestaurantId='';renderPublicMenu()});
  bindPublicAdContact(r);applyFilters()
}
async function openCustomerSubscriptionPortal(restaurant,ownerId,{afterAuth='dashboard'}={}){
  if(!Gravity58Ads?.configured)return toast('Customer subscription accounts are temporarily unavailable');
  const account=await Gravity58Ads.currentUser().catch(()=>null);
  const finish=user=>{closeModal();if(afterAuth==='schedule')openCart(restaurant,{scheduleAfterAuth:true});else openCustomerSubscriptionDashboard(restaurant,ownerId,user)};
  if(account?.email)return finish(account);
  modal('Schedule Meal Account',`<div class="customer-subscription-auth"><div class="premium-account-purpose"><strong>Login is required only for scheduled meals</strong><p>Choose one option. Regular immediate orders continue without an account.</p></div><div class="schedule-auth-choice" id="scheduleAuthChoice"><button class="btn full" id="chooseMealLogin" type="button">Login</button><button class="btn secondary full" id="chooseMealRegister" type="button">Create Account</button></div><section class="schedule-auth-panel" id="mealLoginPanel" hidden><form id="mealCustomerLogin"><div class="field"><label>Email ID</label><input name="email" type="email" required autocomplete="email"></div><div class="field"><label>Password</label><input name="password" type="password" minlength="6" required autocomplete="current-password"></div><button class="btn full">Login</button></form><button class="link-btn full" id="mealCustomerForgot" type="button">Forgot Password</button><button class="link-btn full" data-auth-back type="button">← Back</button></section><section class="schedule-auth-panel" id="mealRegisterPanel" hidden><form id="mealCustomerRegister"><div class="field"><label>Name</label><input name="name" required autocomplete="name"></div><div class="field"><label>Email ID</label><input name="email" type="email" required autocomplete="email"></div><div class="field"><label>Password</label><input name="password" type="password" minlength="6" required autocomplete="new-password"></div><button class="btn full">Create Account</button></form><button class="link-btn full" data-auth-back type="button">← Back</button></section></div>`,()=>{
    const choice=$('#scheduleAuthChoice'),loginPanel=$('#mealLoginPanel'),registerPanel=$('#mealRegisterPanel'),show=panel=>{choice.hidden=true;loginPanel.hidden=panel!=='login';registerPanel.hidden=panel!=='register';$(`#${panel==='login'?'mealLoginPanel':'mealRegisterPanel'} input`)?.focus()};
    $('#chooseMealLogin').onclick=()=>show('login');$('#chooseMealRegister').onclick=()=>show('register');$$('[data-auth-back]').forEach(button=>button.onclick=()=>{choice.hidden=false;loginPanel.hidden=true;registerPanel.hidden=true});
    $('#mealCustomerLogin').onsubmit=async event=>{event.preventDefault();const values=Object.fromEntries(new FormData(event.target)),button=event.submitter;button.disabled=true;try{await Gravity58Ads.login(values.email.trim(),values.password);const user=await Gravity58Ads.currentUser();finish(user)}catch(error){button.disabled=false;toast(error.message||'Could not sign in')}};
    $('#mealCustomerRegister').onsubmit=async event=>{event.preventDefault();const values=Object.fromEntries(new FormData(event.target)),button=event.submitter;button.disabled=true;try{const user=await Gravity58Ads.register(values.email.trim(),values.password,values.name);finish(user)}catch(error){button.disabled=false;toast(error.message||'Could not create customer account')}};
    $('#mealCustomerForgot').onclick=()=>{const email=$('#mealCustomerLogin [name="email"]').value.trim();if(!email)return toast('Enter your email ID first');Gravity58Ads.forgotPassword(email,location.origin+'/reset-password/').then(()=>toast('Password reset email sent')).catch(error=>toast(error.message||'Could not send reset email'))};
  });
}
function customerMenuHash(restaurant,ownerId){return `menu&cloud=${encodeURIComponent(restaurant.id)}&owner=${encodeURIComponent(ownerId)}`}
function customerSubscriptionHash(restaurant,ownerId){return `subscriptions&cloud=${encodeURIComponent(restaurant.id)}&owner=${encodeURIComponent(ownerId)}`}
async function openCustomerOrderHistory(restaurant,ownerId,account){
  if(!account?.$id)return toast('Login to view your order history');
  let orders=[];
  try{orders=(await Gravity58Ads.list(cloudOrderKind(ownerId))).filter(row=>row.restaurantId===restaurant.id&&row.customerAccountId===account.$id&&!row.tokenReservation).sort((a,b)=>new Date(b.createdAt)-new Date(a.createdAt))}catch(error){return toast(error.message||'Could not load your orders')}
  const counted=orders.filter(row=>!['Rejected','Payment Rejected','Cancelled'].includes(row.status)),total=counted.reduce((sum,row)=>sum+(Number(row.total)||0),0);
  modal('My Orders',`<section class="customer-order-history"><div class="customer-order-history-summary"><article><strong>${orders.length}</strong><span>All orders</span></article><article><strong>${money(total)}</strong><span>Total ordered</span></article></div><div class="customer-order-history-list">${orders.map(row=>`<article><div><span class="eyebrow">TOKEN ${formatToken(row.tokenNumber)}</span><h3>${html((row.items||[]).map(item=>`${Number(item.qty)||1} × ${item.name}`).join(' · '))}</h3><small>${new Date(row.createdAt).toLocaleString('en-IN',{dateStyle:'medium',timeStyle:'short'})}</small></div><div><span class="chip">${html(row.status||'Pending')}</span><strong>${money(row.total)}</strong><button class="link-btn" data-history-order="${html(row.id||row.$id)}">Track</button></div></article>`).join('')||empty('No orders found for this login.')}</div></section>`,()=>{$$('[data-history-order]').forEach(button=>button.onclick=()=>{const row=orders.find(order=>(order.id||order.$id)===button.dataset.historyOrder);if(!row)return;state.orders=(state.orders||[]).filter(order=>order.id!==(row.id||row.$id));state.orders.unshift({...row,id:row.id||row.$id,cloudOwnerId:row.cloudOwnerId||ownerId,menuHash:row.menuHash||customerMenuHash(restaurant,ownerId),menuRecordId:row.menuRecordId||restaurant.id});save();closeModal();location.hash=`track&order=${encodeURIComponent(row.id||row.$id)}`})})
}
function openCustomerSubscriptionDashboard(restaurant,ownerId,account){history.pushState(null,'',`#${customerSubscriptionHash(restaurant,ownerId)}`);renderCustomerSubscriptions(restaurant,ownerId,account)}
async function renderCustomerSubscriptionRoute(){
  const params=new URLSearchParams(location.hash.slice(1).replace(/^subscriptions(?:&|\?)?/,'')),recordId=params.get('cloud')||'',ownerId=params.get('owner')||'';
  if(!recordId||!ownerId){app.innerHTML='<main class="subscription-dashboard-page"><div class="empty">This subscription dashboard link is incomplete.</div></main>';return}
  try{
    if(remoteMenuSource!==`cloud:${ownerId}:${recordId}`){app.innerHTML='<main class="subscription-dashboard-page"><div class="remote-menu-loading"><span></span><h2>Loading customer dashboard</h2></div></main>';const record=await Gravity58Ads.get(cloudMenuKind(ownerId),recordId);if(record.ownerId!==ownerId)throw new Error('Restaurant owner does not match this dashboard link');remoteMenuConfig=cloudRecordToConfig(record);remoteMenuSource=`cloud:${ownerId}:${recordId}`;cacheCloudMenuForOrdersSafely(remoteMenuConfig,ownerId)}
    const account=await Gravity58Ads.currentUser().catch(()=>null),restaurant=remoteMenuConfig.restaurant;
    if(!account?.email){history.replaceState(null,'',`#${customerMenuHash(restaurant,ownerId)}`);renderPublicMenu();setTimeout(()=>openCustomerSubscriptionPortal(restaurant,ownerId),0);return}
    renderCustomerSubscriptions(restaurant,ownerId,account);
  }catch(error){app.innerHTML=`<main class="subscription-dashboard-page"><div class="remote-menu-error"><h2>Customer dashboard could not be loaded</h2><p>${html(error.message||'Open the latest restaurant menu and try again.')}</p><a class="btn" href="#menu&cloud=${encodeURIComponent(recordId)}&owner=${encodeURIComponent(ownerId)}">Return to Menu</a></div></main>`}
}
async function renderCustomerSubscriptions(restaurant,ownerId,account){
  const plans=(restaurant.subscriptionPlans||[]).filter(plan=>plan.active!==false);
  let records=[],scheduledOrders=[];
  try{records=(await Gravity58Ads.list(ownerSubscriptionKind(ownerId))).filter(row=>row.restaurantId===restaurant.id&&row.customerAccountId===account.$id)}catch(error){console.warn('Customer subscriptions could not be loaded',error)}
  try{scheduledOrders=(await Gravity58Ads.list(cloudOrderKind(ownerId))).filter(row=>row.restaurantId===restaurant.id&&row.customerAccountId===account.$id&&row.scheduledFor).sort((a,b)=>new Date(b.scheduledFor)-new Date(a.scheduledFor))}catch(error){console.warn('Customer scheduled orders could not be loaded',error)}
  const activeScheduled=scheduledOrders.filter(row=>!['Completed','Rejected','Payment Rejected','Cancelled'].includes(row.status));
  const scheduledCards=scheduledOrders.map(row=>`<article class="customer-scheduled-order"><div><span class="eyebrow">TOKEN ${formatToken(row.tokenNumber)}</span><h4>${new Date(row.scheduledFor).toLocaleString('en-IN',{dateStyle:'medium',timeStyle:'short'})}</h4><p>${(row.items||[]).map(item=>`${Number(item.qty)||1} × ${html(item.name)}`).join(' · ')}</p></div><div class="customer-schedule-status"><span class="chip">${html(row.status||'Payment Verification')}</span><strong>${money(row.total)}</strong><button class="link-btn" data-track-customer-order="${html(row.id||row.$id)}">Track Order</button></div></article>`).join('');
  const subscriptionHistory=records.map(row=>{const id=row.id||row.$id,delivered=Number(row.mealsDelivered||0),total=Number(row.totalMeals||0),progress=total?Math.min(100,Math.round(delivered/total*100)):0,next=row.nextScheduledMeal?`Next meal delivery: ${new Date(row.nextScheduledMeal).toLocaleString('en-IN',{dateStyle:'full',timeStyle:'short'})}`:row.status==='Active'?'Next meal date is being scheduled.':'Next meal starts after payment confirmation.';let action='';
    if(row.status==='Requested')action='<div class="subscription-customer-step">Request sent. Waiting for the restaurant to send your payment link.</div>';
    if(row.status==='Payment Link Sent')action=`<div class="subscription-payment-step"><a class="btn full customer-subscription-action" href="${html(row.paymentLink)}" target="_blank" rel="noopener">Open Payment Link</a><label>After payment, upload receipt image<input type="file" accept="image/jpeg,image/png,image/webp" data-subscription-proof="${html(id)}"></label><button class="btn full customer-subscription-action" data-submit-subscription-proof="${html(id)}">Send Receipt to Restaurant</button></div>`;
    if(row.status==='Payment Proof Submitted')action='<div class="subscription-customer-step">Receipt sent. Restaurant confirmation is pending.</div>';
    if(row.status==='Active')action='<div class="subscription-customer-step active">Subscription active · follow the next meal date above.</div>';
    return `<article class="card customer-active-plan"><span class="eyebrow">${html(row.planType||row.planName||'MEAL PLAN')}</span><h3>${html(row.planName)}</h3><span class="chip">${html(row.status||'Requested')}</span><div class="subscription-service-days">${html(deliveryDaysLabel(row.deliveryDays))} · ${html(row.deliveryTime||'12:00')}</div><div class="subscriber-meal-progress"><div><span>Meals delivered</span><strong>${delivered} / ${total||'∞'}</strong></div><progress max="100" value="${progress}"></progress></div><p class="next-meal-date">${html(next)}</p>${row.ownerNote?`<small>${html(row.ownerNote)}</small>`:''}${action}</article>`}).join('');
  const planCards=plans.map(plan=>subscriptionPlanCard(plan,{subscribed:records.some(row=>row.planId===plan.id&&!['Cancelled','Rejected'].includes(row.status))})).join('');
  const historySection=records.length?`<section class="customer-subscription-history"><h2>Your subscriptions</h2><div class="subscriber-management-grid">${subscriptionHistory}</div></section>`:'';
  app.innerHTML=`<main class="subscription-dashboard-page"><header class="subscription-dashboard-nav"><a class="menu-home-link" href="#${customerMenuHash(restaurant,ownerId)}">← ${html(restaurant.name)} Menu</a><div><strong>${html(account.name||account.email)}</strong><button class="btn small secondary" id="mealCustomerLogout">Sign out</button></div></header><section class="customer-subscription-portal"><div class="subscription-dashboard-hero"><span class="eyebrow">${html(restaurant.name)} · CUSTOMER MEAL PORTAL</span><h1>Your meal subscriptions</h1><p>View meal balance, delivery history, the next scheduled meal and available restaurant plans.</p></div><div class="customer-dashboard-stats"><article><strong>${activeScheduled.length}</strong><span>Active scheduled orders</span></article><article><strong>${records.filter(row=>row.status==='Active').length}</strong><span>Active subscriptions</span></article><article><strong>${scheduledOrders.length}</strong><span>Schedule history</span></article></div><section class="premium-schedule-ready"><div><strong>Schedule and pay for a menu item</strong><p>Add dishes to your cart, upload the payment receipt and choose the preparation time.</p></div><button class="btn small" id="continuePremiumOrder">${customerCart.length?'Schedule Current Cart':'Choose Menu Items'}</button></section><section class="customer-scheduled-orders"><div class="customer-dashboard-title"><h2>Your scheduled orders</h2><button class="link-btn" id="refreshCustomerDashboard">Refresh</button></div>${scheduledCards||empty('No scheduled orders yet. Choose menu items to create your first schedule.')}</section>${historySection}<section class="customer-plan-section"><h2>Available meal subscriptions</h2><div class="pricing-grid customer-meal-plans">${planCards||empty('No meal subscription plans are currently available.')}</div></section></section></main>`;
  $('#mealCustomerLogout').onclick=async()=>{await Gravity58Ads.logout();history.replaceState(null,'',`#${customerMenuHash(restaurant,ownerId)}`);renderPublicMenu();toast('Customer signed out')};
  $('#continuePremiumOrder').onclick=()=>{history.replaceState(null,'',`#${customerMenuHash(restaurant,ownerId)}`);renderPublicMenu();if(customerCart.length)setTimeout(()=>openCart(restaurant),0);else{setTimeout(()=>document.querySelector('#menu-list')?.scrollIntoView({behavior:'smooth'}),0);toast('Add items, then open your cart to schedule the order')}};
  $('#refreshCustomerDashboard').onclick=()=>renderCustomerSubscriptions(restaurant,ownerId,account);
  $$('[data-track-customer-order]').forEach(button=>button.onclick=()=>{const row=scheduledOrders.find(order=>(order.id||order.$id)===button.dataset.trackCustomerOrder);if(!row)return;state.orders=(state.orders||[]).filter(order=>order.id!==(row.id||row.$id));state.orders.unshift({...row,id:row.id||row.$id,cloudOwnerId:row.cloudOwnerId||ownerId});save();location.hash=`track&order=${encodeURIComponent(row.id||row.$id)}`;renderTrack()});
  $$('[data-submit-subscription-proof]').forEach(button=>button.onclick=async()=>{const row=records.find(item=>(item.id||item.$id)===button.dataset.submitSubscriptionProof),input=$(`[data-subscription-proof="${CSS.escape(button.dataset.submitSubscriptionProof)}"]`);if(!row||!input?.files?.[0])return toast('Choose the payment receipt image first');button.disabled=true;let uploadedFileId='';try{const receipt=await optimizePaymentReceipt(input.files[0]);Gravity58Ads.validateMediaFile(receipt,'payment receipt');const uploaded=await Gravity58Ads.uploadPaymentReceipt(receipt);uploadedFileId=uploaded.fileId;Object.assign(row,await secureSubscriptionAction('submit-subscription-payment',row,{paymentReceiptFileId:uploaded.fileId,paymentReceiptUrl:uploaded.mediaUrl,paymentReceiptName:uploaded.mediaName,paymentReceiptType:uploaded.mediaType}));toast('Receipt sent to the restaurant for confirmation');renderCustomerSubscriptions(restaurant,ownerId,account)}catch(error){if(uploadedFileId)Gravity58Ads.removeAdMedia(uploadedFileId).catch(()=>{});button.disabled=false;toast(error.message||'Could not send subscription receipt')}});
  $$('[data-customer-subscribe]').forEach(button=>button.onclick=async()=>{const plan=plans.find(row=>row.id===button.dataset.customerSubscribe);if(!plan)return;const existing=records.find(row=>row.planId===plan.id&&!['Cancelled','Rejected'].includes(row.status));if(existing)return toast('You already have this subscription request');button.disabled=true;const request={ownerId,restaurantId:restaurant.id,planId:plan.id,customerName:account.name||account.email.split('@')[0],customerEmail:account.email};try{let created;const functionId=Gravity58Ads.config?.digitalOrderFunctionId;if(functionId&&Gravity58Ads.executeFunction){const result=await Gravity58Ads.executeFunction(functionId,{action:'create-subscription',subscription:request});created=result?.subscription;if(!created)throw new Error('Secure subscription service did not return the request.')}else{const permissions=Gravity58Ads.userPermissionSet?.([account.$id,ownerId])||Gravity58Ads.collaborativePermissionSet(account.$id);created=await Gravity58Ads.create(ownerSubscriptionKind(ownerId),{...request,restaurantName:restaurant.name,customerAccountId:account.$id,planName:plan.name,planType:plan.planType||plan.name,totalMeals:Number(plan.meals)||0,mealsDelivered:0,price:Number(plan.price)||0,paymentLink:plan.paymentLink||'',deliveryDays:normaliseDeliveryDays(plan.deliveryDays),deliveryTime:plan.deliveryTime||'12:00',status:'Requested',createdAt:now()},undefined,permissions)}toast('Subscription request sent. The restaurant will send the payment link to this dashboard.');renderCustomerSubscriptions(restaurant,ownerId,account)}catch(error){button.disabled=false;toast(error.message||'Could not create subscription request')}});
}
function selectPublicCategory(rid,catId){const key=`gravity58MenuFilters_${rid}`,filters={category:'all',diet:'all',search:'',available:false,...JSON.parse(sessionStorage.getItem(key)||'{}'),category:catId};sessionStorage.setItem(key,JSON.stringify(filters));renderPublicMenu()}
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
function openPreparationInstructions(itemId,sourceItem=null){
  const item=sourceItem||currentPublicItem(itemId); if(!item)return toast('This menu item could not be loaded. Refresh the customer menu.');
  let cartItem=customerCart.find(x=>x.id===itemId);
  if(!cartItem){ customerCart.push({...item,qty:1}); cartItem=customerCart.find(x=>x.id===itemId); }
  const current=cartItem.prepareInstruction||'';
  const selected=new Set((cartItem.prepareOptions||[]));
  const options=['Spicy','Medium spicy','Low spicy','No salt'];
  modal('Prepare '+item.name,`<form id="prepareInstructionForm" class="prepare-instruction-form"><p class="muted">Select one or more kitchen preferences. Use the note box for anything else.</p><div class="prep-option-grid">${options.map(o=>`<label class="prep-option"><input type="checkbox" name="prepOption" value="${o}" ${selected.has(o)?'checked':''}><span>${o}</span></label>`).join('')}</div><div class="field"><label>Other preparation request</label><textarea name="customNote" maxlength="250" placeholder="Type any other request for the kitchen">${html(cartItem.customPrepareNote||'')}</textarea></div><button class="btn full">Save Instructions</button></form>`,()=>{$('#prepareInstructionForm').onsubmit=e=>{e.preventDefault();const fd=new FormData(e.target);const opts=fd.getAll('prepOption');const note=(fd.get('customNote')||'').trim();cartItem.prepareOptions=opts;cartItem.customPrepareNote=note;cartItem.prepareInstruction=[...opts,note].filter(Boolean).join(' · ');persistCustomerCart();closeModal();renderPublicMenu();toast('Preparation instructions saved')}})
}

function persistCustomerCart(){if(customerCartRestaurantId)sessionStorage.setItem(`gravity58Cart_${customerCartRestaurantId}`,JSON.stringify(customerCart))}
function changeCartQuantity(id,action,sourceItem=null){const item=sourceItem||currentPublicItem(id);if(!item)return toast('This menu item could not be loaded. Refresh the customer menu.');if(item.available===false)return toast('This item is currently unavailable.');const existing=customerCart.find(x=>x.id===id);if(action==='plus'){existing?existing.qty++:customerCart.push({...item,qty:1})}else if(existing){existing.qty--;if(existing.qty<=0)customerCart=customerCart.filter(x=>x.id!==id)}persistCustomerCart();renderPublicMenu()}
async function openCart(r,{scheduleAfterAuth=false}={}){
  if(!customerCart.length){ toast('Cart is empty'); return; }
  if(!customerContext){ toast('Customer details are missing. Reopen the menu.'); return; }
  if(!validCustomerPhone(customerContext.phone)){sessionStorage.removeItem(`gravity58Customer_${r.id}`);customerContext=null;toast('Enter a valid customer phone number before ordering');renderPublicMenu();return}

  const payment=restaurantPaymentSettings(r);
  const premiumSchedulingAvailable=r.premiumFeatures===true&&payment.enabled;
  const scheduleAccount=premiumSchedulingAvailable&&Gravity58Ads?.configured?await Gravity58Ads.currentUser().catch(()=>null):null;
  const scheduleAccountReady=!!scheduleAccount?.email;
  const sub=customerCart.reduce((a,b)=>a+b.qty*b.price,0);
  const tax=sub*(Number(r.tax)||0)/100;
  const service=sub*(Number(r.service)||0)/100;
  const total=Math.round(sub+tax+service);
  const orderId=`GR58-${Date.now().toString().slice(-7)}-${Math.floor(10+Math.random()*89)}`;
  const sourceMenuHash=location.hash.slice(1).startsWith('menu')?location.hash.slice(1):orderMenuHash(null,r);
  const upiUri=buildUpiPaymentUri({upiId:payment.upiId,payeeName:payment.payeeName,amount:total,orderId});
  const scheduleMinimum=new Date(Date.now()+5*60000);
  const scheduleDateMin=new Date(scheduleMinimum.getTime()-scheduleMinimum.getTimezoneOffset()*60000).toISOString().slice(0,10);

  modal('Your Cart',`<div id="checkoutPanel">
    <div>${customerCart.map(i=>`<div class="section-head"><span>${i.qty} × ${i.name}</span><strong>${money(i.qty*i.price)}</strong></div>`).join('')}</div>
    <hr style="border-color:var(--line)">
    <div class="section-head"><span>Subtotal</span><strong>${money(sub)}</strong></div>
    <div class="section-head"><span>Tax</span><strong>${money(tax)}</strong></div>
    <div class="section-head"><span>Service charge</span><strong>${money(service)}</strong></div>
    <div class="section-head"><h3>Grand Total</h3><h3>${money(total)}</h3></div>
    ${payment.enabled?`<div class="payment-panel"><h3>Pay & send receipt for approval</h3>
      ${!payment.configured?'<p class="checkout-error">Payment is enabled, but the restaurant has not added a UPI ID. Ask the owner to update Restaurant Settings.</p>':''}
      <div id="onlinePaymentFields">
        ${upiUri?`<div class="upi-payment-box"><div id="amountQr"></div><div><strong>Scan this QR to pay ${money(total)}</strong><p class="muted">Payee: ${html(payment.payeeName)}</p><p class="muted">UPI ID: ${html(payment.upiId)}</p></div></div>`:'<p class="checkout-error">A UPI QR is not configured. Ask the restaurant owner to add a UPI ID.</p>'}
        <div class="field"><label>Payment receipt image</label><input id="paymentReceipt" type="file" accept="image/jpeg,image/png,image/webp"><small>Required for verification. After restaurant approval, this image is deleted permanently.</small></div>
        ${premiumSchedulingAvailable?`<div class="premium-schedule-field"><label class="schedule-order-toggle"><input id="scheduleOrderToggle" type="checkbox" ${scheduleAfterAuth&&scheduleAccountReady?'checked':''}><span><strong>Schedule Meal</strong><small>${scheduleAccountReady?`Signed in as ${html(scheduleAccount.email)}`:'Select to login or create an account'}</small></span></label><div id="scheduleDateTimeFields" class="schedule-date-time-fields" ${scheduleAfterAuth&&scheduleAccountReady?'':'hidden'}><div class="field"><label>Preparation date</label><input id="scheduledDate" type="date" min="${scheduleDateMin}"></div><div class="field"><label>Preparation time</label><input id="scheduledTime" type="time"></div><small>The restaurant is alerted 15 minutes before the selected time.</small></div></div>`:''}
        <p class="payment-whatsapp-note"><strong>What happens next?</strong> Upload the receipt and place the order. Restaurant staff verify it; approval permanently deletes the image and starts the order.</p>
      </div>
    </div>`:''}
    <p id="checkoutProgress" class="checkout-progress" hidden aria-live="polite"></p>
    <p id="checkoutError" class="checkout-error" hidden aria-live="assertive"></p>
    <button class="btn full" id="confirmPlaceOrder" type="button">Place Order</button>
  </div>`,()=>{
    const panel=$('#checkoutPanel');
    const button=$('#confirmPlaceOrder');
    const errorBox=$('#checkoutError');
    const progressBox=$('#checkoutProgress');
    let qrMade=false;

    const fail=message=>{
      if(errorBox){ errorBox.textContent=message; errorBox.hidden=false; }
      toast(message);
    };
    const showPayment=()=>{
      if(!qrMade&&upiUri&&window.QRCode&&$('#amountQr')){
        try{
          new QRCode($('#amountQr'),{text:upiUri,width:170,height:170,colorDark:'#24170f',colorLight:'#fffaf0'});
          qrMade=true;
        }catch(err){ console.warn('QR generation unavailable',err); }
      }
    };
    $('#scheduleOrderToggle',panel)?.addEventListener('change',event=>{if(event.currentTarget.checked&&!scheduleAccountReady){event.currentTarget.checked=false;openCustomerSubscriptionPortal(r,remoteMenuSource.startsWith('cloud:')?remoteMenuSource.split(':')[1]:(cloudOwnerId()||r.ownerId||''),{afterAuth:'schedule'});return}$('#scheduleDateTimeFields',panel).hidden=!event.currentTarget.checked});
    showPayment();

    button.addEventListener('click',async()=>{
      if(button.dataset.busy==='1') return;
      if(errorBox) errorBox.hidden=true;
      const paymentMethod=payment.enabled?'online':'counter';
      const receiptFile=$('#paymentReceipt',panel)?.files?.[0]||null;
      const scheduleSelected=!!$('#scheduleOrderToggle',panel)?.checked;
      const scheduledDate=$('#scheduledDate',panel)?.value||'',scheduledTime=$('#scheduledTime',panel)?.value||'';
      const scheduledValue=scheduleSelected&&scheduledDate&&scheduledTime?`${scheduledDate}T${scheduledTime}`:'';
      if(paymentMethod==='online'&&!payment.configured) return fail('Restaurant payment method is not configured.');
      if(paymentMethod==='online'&&!receiptFile) return fail('Upload the payment receipt image.');
      if(scheduleSelected&&(!scheduledDate||!scheduledTime))return fail('Select both a schedule date and time.');
      if(scheduledValue&&!scheduleAccountReady)return fail('Login with a Premium customer account before scheduling an order.');
      if(scheduledValue&&new Date(scheduledValue).getTime()<Date.now()+4*60000)return fail('Choose a schedule time at least 5 minutes from now.');
      if(!customerCart.length) return fail('Your cart is empty.');

      button.dataset.busy='1';
      button.disabled=true;
      const progress=message=>{button.textContent=message;if(progressBox){progressBox.textContent=`${message} Please keep this window open.`;progressBox.hidden=false}};
      progress('Preparing receipt…');
      let uploadedReceiptFileId='',orderPersisted=false;
      try{
        const status=paymentMethod==='online'?'Payment Verification':'Pending';
        const identity=customerContext.serviceMode==='table'
          ? `${customerContext.customerName?customerContext.customerName+' · ':''}Table ${customerContext.tableNumber}`
          : customerContext.customerName;
        const orderOwnerId=remoteMenuSource.startsWith('cloud:')?remoteMenuSource.split(':')[1]:(cloudOwnerId()||r.ownerId||'');
        let receipt={};
        if(receiptFile){const optimizedReceipt=await optimizePaymentReceipt(receiptFile);progress('Uploading receipt…');Gravity58Ads.validateMediaFile(optimizedReceipt,'payment receipt');const uploadReceipt=Gravity58Ads.uploadPaymentReceipt;if(typeof uploadReceipt!=='function')throw new Error('Secure receipt upload is unavailable. Reload this menu and try again.');const uploaded=await uploadReceipt(optimizedReceipt);uploadedReceiptFileId=uploaded.fileId;receipt={paymentReceiptUrl:uploaded.mediaUrl,paymentReceiptFileId:uploaded.fileId,paymentReceiptName:uploaded.mediaName,paymentReceiptType:uploaded.mediaType}}
        const order={
          id:orderId,restaurantId:r.id,customer:identity||'Guest',
          ownerId:orderOwnerId,cloudOwnerId:orderOwnerId,
          tokenNumber:0,orderDay:orderDay(),messages:[],
          customerName:customerContext.customerName||'',serviceMode:customerContext.serviceMode,
          tableNumber:customerContext.tableNumber||'',phone:normaliseCustomerPhone(customerContext.phone),
          items:customerCart.map(i=>({id:i.id,name:i.name,qty:i.qty,price:i.price,prepareInstruction:i.prepareInstruction||'',prepareOptions:i.prepareOptions||[],customPrepareNote:i.customPrepareNote||''})),
          subtotal:sub,tax,serviceCharge:service,total,paymentMethod,
          upiId:paymentMethod==='online'?payment.upiId:'',upiUri:paymentMethod==='online'?upiUri:'',
          transactionId:'',paymentStatus:paymentMethod==='online'?'Awaiting confirmation':'Not required',...receipt,
          menuHash:sourceMenuHash,menuRecordId:publicMenuParams().get('cloud')||r.cloudRecordId||r.id,
          openOrderId:paymentMethod==='counter'?sessionStorage.getItem(customerOpenOrderKey(r.id))||'':'',
          scheduledFor:scheduledValue?new Date(scheduledValue).toISOString():'',
          customerAccountId:scheduledValue?scheduleAccount.$id:'',customerEmail:scheduledValue?scheduleAccount.email:'',
          status,createdAt:now()
        };
        progress('Securing order…');
        Object.assign(order,await persistCloudOrder(order));
        orderPersisted=true;
        state.orders=Array.isArray(state.orders)?state.orders:[];
        state.orders=state.orders.filter(row=>row.id!==order.id);
        state.orders.unshift(order);
        if(paymentMethod==='counter')sessionStorage.setItem(customerOpenOrderKey(r.id),order.id);
        save();
        const verify=JSON.parse(localStorage.getItem('gravity58DigitalMenu')||'{}');
        if(!verify.orders?.some(x=>x.id===order.id)) throw new Error('Order was not saved');
        customerCart=[];
        sessionStorage.removeItem(`gravity58Cart_${r.id}`);
        closeModal();
        location.hash=`track&order=${encodeURIComponent(order.id)}`;
        renderTrack();
      }catch(err){
        if(uploadedReceiptFileId&&!orderPersisted)try{await Gravity58Ads.removeAdMedia(uploadedReceiptFileId)}catch(cleanupError){console.warn('Failed receipt cleanup',cleanupError)}
        console.error('Place order failed',err);
        button.dataset.busy='0';button.disabled=false;button.textContent='Place Order';if(progressBox)progressBox.hidden=true;
        fail(`Order could not be placed. ${err?.message||'Please reload this menu and try again.'}`);
      }
    });
  });
}

let customerRingingOrderId=null,customerRingTimer=null;
function customerScheduleRingKey(orderId){return `gravity58ScheduleRingAck_${orderId}`}
function startCustomerRing(){if(customerRingTimer)return;orderAlertBeep();customerRingTimer=setInterval(()=>orderAlertBeep(),1500)}
function stopCustomerRing(){if(customerRingTimer){clearInterval(customerRingTimer);customerRingTimer=null}customerRingingOrderId=null}
function acknowledgeScheduleRing(){if(customerRingingOrderId)sessionStorage.setItem(customerScheduleRingKey(customerRingingOrderId),'1');stopCustomerRing()}
function maybeRingScheduledStart(o){
  const started=o.scheduledFor&&['Pending','Accepted','Preparing','Ready'].includes(o.status);
  if(!started)return stopCustomerRing();
  if(sessionStorage.getItem(customerScheduleRingKey(o.id))==='1')return stopCustomerRing();
  if(customerRingingOrderId!==o.id){customerRingingOrderId=o.id;startCustomerRing()}
}
function renderTrack(){const params=new URLSearchParams(location.hash.replace('#track&',''));const id=params.get('order'),o=state.orders.find(x=>x.id===id);if(!o){app.innerHTML=`<main class="public-menu"><div class="empty">Order not found</div></main>`;return}const r=state.restaurants.find(x=>x.id===o.restaurantId);maybeRingScheduledStart(o);const stage={Scheduled:3,'Payment Verification':5,'Payment Rejected':100,Pending:8,Accepted:25,Preparing:55,Ready:85,Delivered:94,Completed:100,Rejected:100}[o.status]||8;let content;if(o.status==='Completed')content=`<section class="card thankyou"><h1>Thank You!</h1><h2>${r.logo} ${r.name}</h2><p class="muted">We hope you enjoyed your experience.</p><div class="chips" style="justify-content:center"><span class="chip">Order ${o.id}</span><span class="chip">${o.customer}</span></div><div class="grid restaurant-grid" style="margin-top:24px"><article class="card"><h3>Restaurant</h3><p class="muted">Follow ${r.name} and leave your feedback.</p></article><article class="card"><h3>Discover More with Gravity58</h3><p class="muted">Explore local businesses and useful digital tools.</p><a class="btn" href="${CONFIG.gravity58Url}" target="_blank">Explore Gravity58</a></article><article class="card"><h3>Featured</h3><p class="muted">Advertisement space for restaurant or Gravity58 promotions.</p></article></div></section>`;else content=`<section class="card" style="text-align:center"><span class="status-pill"><span class="dot"></span>${o.status}</span><h1 style="margin:18px 0 6px">${o.status==='Ready'?'Your Food Is Ready!':o.status==='Payment Verification'?'Verifying Your Payment':o.status==='Payment Rejected'?'Payment Could Not Be Confirmed':o.status==='Rejected'?'Order Rejected':o.status==='Scheduled'?'Your Order Is Scheduled':'Your Food Is Being Prepared'}</h1>${customerRingingOrderId===o.id?`<div class="track-message schedule-start-alert">🔔 <strong>Your scheduled order has started!</strong><span>Tap anywhere on this screen to stop the reminder.</span></div>`:''}<div class="track-message ${o.status==='Ready'?'ready-message':''}">${o.status==='Ready'?'<strong>Your order will be served soon</strong><span>Please stay at your table or near the service counter. Our team will bring your food shortly.</span>':o.status==='Payment Verification'?'Restaurant staff are checking your uploaded payment receipt.':o.status==='Scheduled'?`Preparation begins at ${new Date(o.scheduledFor).toLocaleString('en-IN',{dateStyle:'medium',timeStyle:'short'})}. We'll notify you here once it starts.`:'Order '+o.id+' · '+o.customer}</div>${['Accepted','Preparing'].includes(o.status)?`<div class="pot-scene"><div><div class="steam"><span></span><span></span><span></span></div><div class="pot"></div></div></div>`:''}<div class="progress"><span style="width:${stage}%"></span></div><div class="chips" style="justify-content:center;margin-top:18px">${o.items.map(i=>`<span class="chip">${i.qty} × ${i.name}${i.prepareInstruction?' · '+i.prepareInstruction:''}</span>`).join('')}</div><div class="section-head"><span>Total</span><strong>${money(o.total)}</strong></div><section class="social-discovery"><div class="social-discovery-copy"><span class="eyebrow">Restaurant profile</span><h2>Take a look at how we specialise</h2><p>Explore ${r.name} beyond today’s order. See our food creations, kitchen moments, new dishes and restaurant updates.</p></div><div class="social-profile-grid">${Object.entries(r.social||{}).filter(([,u])=>u).map(([p,u])=>{const key=p.toLowerCase();const icon=key==='instagram'?'◎':key==='youtube'?'▶':key==='facebook'?'f':key==='whatsapp'?'◉':'↗';const desc=key==='instagram'?'View our restaurant profile, food photos, reels and latest specials.':key==='youtube'?'Watch our kitchen stories, signature dishes and restaurant videos.':key==='facebook'?'Visit our restaurant page for updates, offers and community posts.':key==='whatsapp'?'Connect with the restaurant team on WhatsApp.':'Open our restaurant profile and discover more.';return `<a class="social-profile-card ${key}" href="${u}" target="_blank" rel="noopener"><span class="social-profile-icon">${icon}</span><span class="social-profile-text"><strong>${p}</strong><small>${desc}</small><b>View restaurant profile →</b></span></a>`}).join('')||'<div class="social-empty">Restaurant social profiles will appear here.</div>'}</div></section>${publicAdSection(r)}</section>`;app.innerHTML=`<main class="public-menu">${content}<div class="actions" style="justify-content:center;margin-top:18px"><button class="btn secondary" id="refreshTrack">Refresh Status</button><button class="btn" id="backMenu">View Menu</button></div></main>`;$('#refreshTrack').onclick=renderTrack;$('#backMenu').onclick=()=>{location.hash=orderMenuHash(o,r)};bindPublicAdContact(r)}

function applyOrderTrackingCopy(){
  if(!location.hash.startsWith('#track')) return;
  const params=new URLSearchParams(location.hash.replace('#track&','')),id=params.get('order'),order=state.orders.find(row=>row.id===id);
  if(!order)return;
  const status=order.status;
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
  const card=$('.public-menu > .card',app),restaurant=state.restaurants.find(row=>row.id===order.restaurantId);
  if(card&&!$('.customer-token-panel',card))card.insertAdjacentHTML('afterbegin',`<section class="customer-token-panel"><span>YOUR QUEUE TOKEN</span><strong>${formatToken(order.tokenNumber)}</strong><small>${html(order.serviceMode==='table'?`Table ${order.tableNumber||'-'}`:'Single Counter')} · ${html(order.status)}</small></section>`);
  const publicMessaging=restaurant?.premiumFeatures===true||menuFeature('messaging');
  if(card&&publicMessaging&&!$('.customer-order-chat',card)){
    const ad=$('.public-ad',card);
    const chat=`<section class="customer-order-chat ${customerChatOpen?'open':''}"><button class="customer-chat-toggle" type="button" aria-expanded="${customerChatOpen?'true':'false'}"><span class="customer-chat-dot"></span><strong>Chat</strong></button><div class="customer-chat-panel"><header><div><span class="eyebrow">LIVE RESTAURANT CHAT</span><h2>Need help?</h2></div><button class="customer-chat-close" type="button" aria-label="Close customer chat">✕</button></header><p class="muted">Messages and corrected table details update live.</p><div class="order-chat-log">${(order.messages||[]).slice(-8).map(item=>`<div class="order-message ${item.senderRole==='customer'?'mine':''}"><strong>${html(item.senderRole==='owner'?'Restaurant':item.senderName||'You')}</strong><span>${html(item.text)}</span><small>${new Date(item.createdAt).toLocaleTimeString('en-IN',{hour:'2-digit',minute:'2-digit'})}</small></div>`).join('')||'<p class="muted no-messages">No messages yet.</p>'}</div><form class="order-chat-form" data-customer-chat="${html(order.id)}"><input name="message" value="${html(orderChatDrafts.get(order.id)||'')}" maxlength="240" placeholder="Message the restaurant" aria-label="Message restaurant"><button class="btn" type="submit">Send</button></form></div></section>`;
    if(ad)ad.insertAdjacentHTML('beforebegin',chat);else card.insertAdjacentHTML('beforeend',chat);
    $('.customer-chat-toggle',card).onclick=()=>{customerChatOpen=true;$('.customer-order-chat',card).classList.add('open');$('.customer-chat-toggle',card).setAttribute('aria-expanded','true');$('[name="message"]',$('.customer-order-chat',card))?.focus()};
    $('.customer-chat-close',card).onclick=()=>{customerChatOpen=false;$('.customer-order-chat',card).classList.remove('open');$('.customer-chat-toggle',card).setAttribute('aria-expanded','false')};
    const customerChatForm=$('[data-customer-chat]',card),customerChatInput=$('input[name="message"]',customerChatForm);customerChatInput.oninput=()=>orderChatDrafts.set(order.id,customerChatInput.value);customerChatForm.onsubmit=event=>sendOrderMessage(event,order.id,'customer');
  }
  if(status==='Completed'&&card&&!$('.public-ad',card)&&restaurant){card.insertAdjacentHTML('beforeend',publicAdSection(restaurant));bindPublicAdContact(restaurant)}
  $('#refreshTrack')?.remove();
  if(status==='Ready'&&!sessionStorage.getItem(`gravity58ReadyPeep_${order.id}`)){sessionStorage.setItem(`gravity58ReadyPeep_${order.id}`,'1');orderAlertBeep(.22,1040)}
  startCustomerOrderRealtime(order);
}
function startCustomerOrderRealtime(order){
  const kind=order?.cloudOwnerId?cloudOrderKind(order.cloudOwnerId):'';
  if(!Gravity58Ads?.subscribeKind||!kind||customerOrderSubscriptionKind===kind)return;
  customerOrderUnsubscribe?.();customerOrderSubscriptionKind=kind;
  customerOrderUnsubscribe=Gravity58Ads.subscribeKind(kind,async row=>{if(row&&(row.id||row.$id)!==order.id)return;if(chatMutationIds.has(order.id))return;try{const latest=row||await Gravity58Ads.get(kind,order.id),local=state.orders.find(item=>item.id===order.id);if(local)Object.assign(local,latest);save();if(!chatEditorActive())renderTrack()}catch(error){console.warn('Customer live order update failed',error)}});
}
const renderTrackBase=renderTrack;
renderTrack=function(){renderTrackBase();applyOrderTrackingCopy()};

function modal(title,body,onReady,options={}){
  // Async data refreshes can render the same view twice. Replace any existing
  // dialog first so duplicate IDs never leave the visible close button unbound.
  closeModal();
  const dismissible=options.dismissible!==false;
  document.body.insertAdjacentHTML('beforeend',`<div class="modal-backdrop" id="modal" role="presentation" data-dismissible="${dismissible?'true':'false'}"><section class="modal" role="dialog" aria-modal="true" aria-labelledby="modalTitle"><div class="section-head" style="margin-top:0"><h2 id="modalTitle">${title}</h2>${dismissible?'<button class="btn small secondary" id="closeModal" type="button" aria-label="Close dialog">✕</button>':''}</div>${body}</section></div>`);
  const backdrop=$('#modal');
  const closeButton=$('#closeModal',backdrop);
  closeButton?.addEventListener('click',closeModal);
  if(dismissible)backdrop?.addEventListener('click',event=>{if(event.target===backdrop)closeModal()});
  document.body.classList.add('modal-open');
  (closeButton||$('input,select,textarea,button',backdrop))?.focus({preventScroll:true});
  onReady?.();
}
function closeModal(){
  if(activeCompressorUrl){URL.revokeObjectURL(activeCompressorUrl);activeCompressorUrl=''}
  $('#modal')?.remove();
  document.body.classList.remove('modal-open');
}
document.addEventListener('keydown',event=>{const current=$('#modal');if(event.key==='Escape'&&current?.dataset.dismissible!=='false')closeModal()});
document.addEventListener('pointerdown',()=>{if(ringingOrderIds.size)orderAlertBeep()},{passive:true});
document.addEventListener('pointerdown',()=>{if(customerRingingOrderId)acknowledgeScheduleRing()},{passive:true});
function empty(t){return `<div class="empty">${t}</div>`}
window.addEventListener('hashchange',render);
window.addEventListener('storage',()=>{state=load();if(!chatEditorActive())render();hydrateLocalMedia()});
async function refreshTrackedCloudOrder(){if(!location.hash.startsWith('#track'))return;const params=new URLSearchParams(location.hash.replace('#track&','')),id=params.get('order');if(chatMutationIds.has(id))return;state=load();const local=state.orders.find(row=>row.id===id);if(local?.cloudOwnerId)try{const latest=await Gravity58Ads.get(cloudOrderKind(local.cloudOwnerId),id),restaurant=state.restaurants.find(row=>row.id===latest.restaurantId),decision=PLAN_UTILS.orderRetention(latest,{premium:restaurant?.premiumFeatures===true});if(!decision.keep){await Gravity58Ads.remove(cloudOrderKind(local.cloudOwnerId),id);state.orders=state.orders.filter(row=>row.id!==id);save()}else{if(decision.carry&&latest.retentionCarryDay!==decision.carryDay)Object.assign(latest,await Gravity58Ads.update(cloudOrderKind(local.cloudOwnerId),id,{retentionCarryDay:decision.carryDay,retentionReason:'processing-at-midnight'}));Object.assign(local,latest);save()}}catch(error){console.warn('Order status refresh failed',error)}if(!chatEditorActive())renderTrack()}
setInterval(refreshTrackedCloudOrder,2500);
setInterval(async()=>{if(state.session?.provider==='gravity58'&&['orders','schedule'].includes(view)&&!location.hash&&!chatEditorActive()){try{await syncCloudOrders();view==='orders'?ordersView():scheduleView()}catch(error){console.warn('Order board refresh failed',error)}}},10000);
scheduleAlertTimer=setInterval(()=>{if(state.session&&!location.hash)checkScheduledOrderAlerts()},30000);
function refreshExpiryLabels(){let expiredVisibleAd=false;$$('[data-ad-expiry]').forEach(label=>{const expiresAt=label.dataset.adExpiry,lifetime=label.dataset.adLifetime==='true';if(lifetime){label.textContent='Lifetime advertisement';return}if(!expiresAt){label.textContent='Contact G58 for slot duration';return}label.textContent=adTimeLeft({expiresAt});if(new Date(expiresAt).getTime()<=Date.now())expiredVisibleAd=true});if(expiredVisibleAd&&location.hash.startsWith('#menu'))renderPublicMenu()}
setInterval(refreshExpiryLabels,15000);
async function resumeGravity58Account(){if(location.hash.startsWith('#menu')||!Gravity58Ads?.configured)return;try{const account=await Gravity58Ads.currentUser();if(!account?.email)return;const user=ensureGravity58User(account);state.session={userId:user.id,provider:'gravity58'};save();await syncCloudMenus();render()}catch(error){console.warn('Gravity58 account resume failed',error)}}
Gravity58Ads?.subscribeAdvertisements(hydrateAdvertisements);
render();
hydrateLocalMedia();
hydrateAdvertisements();
resumeGravity58Account();
