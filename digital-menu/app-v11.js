const $ = (s, root=document) => root.querySelector(s);
const $$ = (s, root=document) => [...root.querySelectorAll(s)];
const uid = (p='id') => `${p}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2,7)}`;
const money = n => `₹${Number(n||0).toLocaleString('en-IN')}`;
const now = () => new Date().toISOString();
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
async function compressImageTo100Kb(file){const image=await loadBrowserImage(file);let width=Math.min(1600,image.naturalWidth||image.width),height=Math.max(1,Math.round((image.naturalHeight||image.height)*(width/(image.naturalWidth||image.width))));for(let sizePass=0;sizePass<10;sizePass++){const canvas=document.createElement('canvas');canvas.width=Math.max(1,Math.round(width));canvas.height=Math.max(1,Math.round(height));canvas.getContext('2d',{alpha:false}).drawImage(image,0,0,canvas.width,canvas.height);for(let quality=.86;quality>=.32;quality-=.09){const blob=await canvasImageBlob(canvas,'image/webp',quality);if(blob.size<=100*1024)return blob}width*=.78;height*=.78}throw new Error('Could not reduce this image below 100 KB. Try a smaller source image.')}
function openImageCompressor(){modal('Image Compressor',`<div class="compressor-panel"><p class="muted">Choose a JPG, PNG or WebP image. Compression happens only in this browser and the source file is never uploaded or retained.</p><div class="field"><label>Source image <small>(up to 20 MB)</small></label><input id="compressorFile" type="file" accept="image/jpeg,image/png,image/webp"></div><div class="compressor-result" id="compressorResult"><div class="compressor-placeholder">Choose an image to create a menu-ready file below 100 KB.</div></div><button class="btn full" id="downloadCompressedImage" hidden>Download Compressed Image</button></div>`,()=>{const input=$('#compressorFile'),result=$('#compressorResult'),download=$('#downloadCompressedImage');input.onchange=async()=>{const file=input.files[0];if(!file)return;if(activeCompressorUrl)URL.revokeObjectURL(activeCompressorUrl);activeCompressorUrl='';download.hidden=true;result.innerHTML='<div class="compressor-placeholder">Compressing image…</div>';try{const blob=await compressImageTo100Kb(file);activeCompressorUrl=URL.createObjectURL(blob);const saved=Math.max(0,Math.round((1-blob.size/file.size)*100));result.innerHTML=`<img src="${activeCompressorUrl}" alt="Compressed preview"><div><strong>${Math.ceil(blob.size/1024)} KB ready</strong><span>Original ${Math.ceil(file.size/1024)} KB${saved?` · ${saved}% smaller`:''}</span><small>Nothing has been uploaded. Download this file, then select it for your restaurant or menu item.</small></div>`;download.hidden=false;download.onclick=()=>{const link=document.createElement('a');link.href=activeCompressorUrl;link.download=`${slugify(file.name.replace(/\.[^.]+$/,''))}-g58.webp`;document.body.appendChild(link);link.click();link.remove();toast('Compressed image downloaded')}}catch(error){input.value='';result.innerHTML=`<div class="compressor-error">${html(error.message||'Could not compress this image')}</div>`}}})}

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
const CLOUD_MENU_KIND_PREFIX = 'digital_menu_';
const CLOUD_ORDER_KIND_PREFIX = 'digital_order_';
const CLOUD_TOKEN_KIND_PREFIX = 'digital_token_';
let cloudMenuSyncing = false;
let ownerOrderUnsubscribe = null;
let ownerOrderSubscriptionKind = '';
let customerOrderUnsubscribe = null;
let customerOrderSubscriptionKind = '';
let orderAlertTimer = null;
let orderAlertContext = null;
const ringingOrderIds = new Set();
const knownCloudOrderIds = new Set();

function load(){
  try{
    const stored=JSON.parse(localStorage.getItem('gravity58DigitalMenu'))||structuredClone(seed);
    stored.advertisements=[];
    stored.adRequests=[];
    stored.restaurants=(stored.restaurants||[]).map(r=>({...r,logoImageKey:r.logoImageKey||(isWebImage(r.logoImage)&&String(r.logoImage).startsWith('data:')?`restaurant:${r.id}`:''),address:r.address||'',phone:r.phone||'',email:r.email||'',paymentEnabled:!!r.paymentEnabled,upiId:r.upiId||'',paymentLink:r.paymentLink||'',restaurantKey:`${r.name}|${r.city}`}));
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
function formatToken(value){return String(Math.max(0,Number(value)||0)).padStart(4,'0')}
function activeQueueStatus(status){return !['Completed','Rejected','Payment Rejected'].includes(status)}
function restaurantCloudFields(r){const fields=['id','name','type','city','description','address','phone','email','open','accepting','tax','service','identification','restaurantKey','social','paymentEnabled','upiId','paymentLink','logoImageUrl','logoImageFileId'];return Object.fromEntries(fields.map(key=>[key,r?.[key]]))}
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
      applyCloudMenus(records);
      if(!ownerRestaurants().some(row=>row.id===state.activeRestaurantId))state.activeRestaurantId=ownerRestaurants()[0]?.id||'';
      save();
    }
    await syncCloudOrders();
  }finally{cloudMenuSyncing=false}
}
async function syncCloudOrders({alertNew=false}={}){
  if(!isCloudMenuSession())return;
  const ownerId=cloudOwnerId(),restaurantIds=new Set(ownerRestaurants().map(row=>row.id));
  const records=(await Gravity58Ads.list(cloudOrderKind(ownerId))).filter(row=>row.ownerId===ownerId&&restaurantIds.has(row.restaurantId)&&!row.tokenReservation);
  if(alertNew){
    records.filter(order=>!knownCloudOrderIds.has(order.id||order.$id)&&['Pending','Payment Verification'].includes(order.status)).forEach(order=>ringingOrderIds.add(order.id||order.$id));
  }
  records.forEach(order=>knownCloudOrderIds.add(order.id||order.$id));
  state.orders=(state.orders||[]).filter(row=>!restaurantIds.has(row.restaurantId));
  state.orders.push(...records.map(row=>({...row,id:row.id||row.$id,messages:Array.isArray(row.messages)?row.messages:[]})));
  save();
  updateOrderAlertSound();
}
async function persistCloudOrder(order){
  if(!order?.id||!order.cloudOwnerId)return order;
  const current=await Gravity58Ads.ensureUser();
  order.customerAccountId||=current?.$id||'';
  const permissions=Gravity58Ads.collaborativePermissionSet?.(order.customerAccountId)||Gravity58Ads.userPermissionSet([order.customerAccountId]);
  try{return await Gravity58Ads.create(cloudOrderKind(order.cloudOwnerId),order,order.id,permissions)}
  catch(error){if(error?.code===409||/already exists/i.test(error?.message||''))return Gravity58Ads.update(cloudOrderKind(order.cloudOwnerId),order.id,order);throw error}
}
async function reserveOrderToken(ownerId,restaurantId){
  const day=orderDay(),localOrders=(state.orders||[]).filter(order=>order.restaurantId===restaurantId&&order.orderDay===day),localNext=Math.max(0,...localOrders.map(order=>Number(order.tokenNumber)||0))+1;
  if(!Gravity58Ads?.configured||!ownerId)return localNext;
  const current=await Gravity58Ads.ensureUser(),permissions=Gravity58Ads.userPermissionSet([current?.$id]),prefix=`tok-${String(restaurantId).replace(/[^a-zA-Z0-9._-]/g,'-').slice(0,14)}-${day.slice(2)}-`;
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
  [...ringingOrderIds].forEach(id=>{const order=state.orders.find(row=>row.id===id);if(!order||!['Pending','Payment Verification'].includes(order.status))ringingOrderIds.delete(id)});
  if(!ringingOrderIds.size){if(orderAlertTimer)clearInterval(orderAlertTimer);orderAlertTimer=null;return}
  if(!orderAlertTimer){orderAlertBeep();orderAlertTimer=setInterval(()=>orderAlertBeep(),2200)}
}
function startOwnerOrderRealtime(){
  const ownerId=cloudOwnerId(),kind=ownerId?cloudOrderKind(ownerId):'';
  if(!Gravity58Ads?.subscribeKind||!kind||ownerOrderSubscriptionKind===kind)return;
  ownerOrderUnsubscribe?.();ownerOrderSubscriptionKind=kind;
  ownerOrderUnsubscribe=Gravity58Ads.subscribeKind(kind,async()=>{try{await syncCloudOrders({alertNew:true});if(!location.hash&&state.session){renderView()}}catch(error){console.warn('Live order update failed',error)}});
}
function stopOrderRealtime(){ownerOrderUnsubscribe?.();customerOrderUnsubscribe?.();ownerOrderUnsubscribe=customerOrderUnsubscribe=null;ownerOrderSubscriptionKind=customerOrderSubscriptionKind='';ringingOrderIds.clear();knownCloudOrderIds.clear();updateOrderAlertSound()}
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
function renderLogin(){const cloud=!!Gravity58Ads?.configured,available=cloud||CONFIG.testMode===true;app.innerHTML=`<main class="screen auth"><section class="auth-card glass"><a class="menu-home-link" href="../">← Gravity58 Home</a><div class="premium-menu-kicker">PREMIUM RESTAURANT EXPERIENCE</div><div class="brand"><div class="brand-mark">G</div><div><h2>Gravity58 Digital Menu</h2><p class="tagline">Scan. Order. Relax.</p></div></div>${available?`<form id="loginForm"><div class="field"><label>Email</label><input name="email" type="email" autocomplete="email" value="${cloud?'':'testing@g58.in'}" required></div><div class="field"><label>Password</label><input name="password" type="password" autocomplete="current-password" value="${cloud?'':'test123'}" required></div><button class="btn full">Login</button></form><div class="actions" style="justify-content:center;margin-top:12px"><button class="link-btn" id="newUser">Create Account</button><button class="link-btn" id="forgot">Forgot Password</button></div>`:'<div class="service-unavailable">The menu service is temporarily unavailable. Please try again shortly.</div>'}<p class="muted" style="text-align:center;margin-top:18px">Your restaurants, menus and availability stay connected to your G58 account.</p></section></main>`;
  if(!available)return;
  $('#loginForm').onsubmit=async e=>{e.preventDefault();const d=Object.fromEntries(new FormData(e.target)),button=e.submitter;button.disabled=true;button.textContent='Signing in…';const local=cloud?null:state.users.find(x=>(x.email===d.email||x.id===d.email)&&x.password===d.password);if(local){state.session={userId:local.id};save();return render()}try{if(!cloud)throw new Error('Invalid login');await Gravity58Ads.login(d.email.trim(),d.password);const account=await Gravity58Ads.currentUser();if(!account)throw new Error('Could not read this account');const user=ensureGravity58User(account);state.session={userId:user.id,provider:'gravity58'};save();button.textContent='Loading menu…';await syncCloudMenus();render()}catch(error){button.disabled=false;button.textContent='Login';toast(error.message||'Invalid login')}};
  $('#newUser').onclick=()=>modal('Create Account',registerForm(),bindRegister);
  $('#forgot').onclick=()=>{const localFields=cloud?'':`<div class="field"><label>New local password</label><input name="password" type="password" minlength="6"></div><div class="field"><label>Confirm local password</label><input name="confirm" type="password" minlength="6"></div>`;modal('Password Recovery',`<p class="muted">${cloud?'Enter your account email to receive a secure reset link.':'Reset the local test account on this browser.'}</p><form id="forgotForm"><div class="field"><label>Email</label><input name="email" type="email" required></div>${localFields}<div class="actions">${cloud?'<button class="btn" name="action" value="email">Send Reset Email</button>':'<button class="btn" name="action" value="local">Reset Password</button>'}</div></form>`,()=>{$('#forgotForm').onsubmit=async e=>{e.preventDefault();const d=Object.fromEntries(new FormData(e.target)),action=e.submitter?.value||'email';if(action==='email'){try{await Gravity58Ads.forgotPassword(d.email.trim(),location.origin+'/reset-password/');closeModal();return toast('Password reset email sent')}catch(error){return toast(error.message||'Could not send reset email')}}const u=state.users.find(x=>x.email.toLowerCase()===d.email.trim().toLowerCase());if(!u)return toast('No local account exists for this email');if((d.password||'').length<6)return toast('Use at least 6 characters');if(d.password!==d.confirm)return toast('Passwords do not match');u.password=d.password;save();closeModal();toast('Password reset on this browser')}})};
}
function registerForm(){return `<form id="registerForm"><div class="form-grid"><div class="field"><label>Full name</label><input name="name" required></div><div class="field"><label>Email</label><input name="email" type="email" required></div><div class="field"><label>Mobile</label><input name="mobile"></div><div class="field"><label>City</label><input name="city"></div><div class="field"><label>Password</label><input name="password" type="password" required></div><div class="field"><label>Confirm password</label><input name="confirm" type="password" required></div></div><button class="btn full">Create Account</button></form>`}
function ensureGravity58User(account,details={}){let user=state.users.find(row=>row.cloudUserId===account.$id||row.email?.toLowerCase()===account.email?.toLowerCase());if(!user){user={id:`g58_${account.$id}`,cloudUserId:account.$id,name:account.name||details.name||account.email.split('@')[0],email:account.email,mobile:details.mobile||'',city:details.city||'',provider:'gravity58'};state.users.push(user)}else Object.assign(user,{cloudUserId:account.$id,name:account.name||user.name,email:account.email,provider:'gravity58'});return user}
function bindRegister(){$('#registerForm').onsubmit=async e=>{e.preventDefault();const d=Object.fromEntries(new FormData(e.target));if(state.users.some(x=>x.email.toLowerCase()===d.email.trim().toLowerCase()))return toast('This email already has an account on this browser');if(d.password.length<6)return toast('Use at least 6 characters');if(d.password!==d.confirm)return toast('Passwords do not match');const button=e.submitter;button.disabled=true;button.textContent='Creating…';try{let user;if(Gravity58Ads?.configured){const account=await Gravity58Ads.register(d.email.trim().toLowerCase(),d.password,d.name,d.mobile);user=ensureGravity58User(account,d)}else{user={id:uid('usr'),name:d.name,email:d.email.trim().toLowerCase(),password:d.password,mobile:d.mobile,city:d.city,provider:'local'};state.users.push(user)}state.session={userId:user.id,provider:user.provider};save();closeModal();renderOwnerOnboarding()}catch(error){button.disabled=false;button.textContent='Create Account';toast(error.message||'Could not create account')}}}

async function logoutOwner(){stopOrderRealtime();if(state.session?.provider==='gravity58')try{await Gravity58Ads?.logout()}catch{}state.session=null;save();render()}
function renderOwnerOnboarding(){app.innerHTML=`<main class="screen auth"><section class="auth-card glass"><a class="menu-home-link" href="../">← Gravity58 Home</a><div class="premium-menu-kicker">SET UP YOUR RESTAURANT</div><div class="brand"><div class="brand-mark">G</div><div><h2>Create your first Digital Menu</h2><p class="tagline">Your restaurant and menu are securely saved to your G58 account.</p></div></div><button class="btn full" id="createFirstRestaurant">Add Restaurant</button><button class="link-btn full" id="onboardingLogout">Logout</button></section></main>`;$('#createFirstRestaurant').onclick=()=>openRestaurantForm(true);$('#onboardingLogout').onclick=logoutOwner}

function renderShell(){const r=activeRestaurant();if(!r)return renderOwnerOnboarding();app.innerHTML=`<div class="shell"><aside class="sidebar"><div class="brand"><div class="brand-mark">G</div><div><strong>Gravity58 Menu</strong><small class="muted">Restaurant workspace</small></div></div><nav class="nav">${navButton('dashboard','⌂','Dashboard')}${navButton('restaurants','◫','Restaurants')}${navButton('menu','☰','Menu')}${navButton('orders','◉','Orders')}${navButton('qr','▦','QR Codes')}${navButton('reports','◒','Reports')}${navButton('publish','⇧','Share Menu')}${navButton('settings','⚙','Settings')}<a class="owner-book-ad" href="${CONFIG.adBookingPortalUrl||'../advertise/'}?restaurant=${encodeURIComponent(`${r.name}|${r.city}`)}">✦ Book Ad Space</a><button id="logout">⇥ Logout</button></nav></aside><main class="main"><header class="topbar"><div class="restaurant-switch"><span>${r.name?.[0]||'G'}</span><select id="restaurantSelect">${ownerRestaurants().map(x=>`<option value="${x.id}" ${x.id===r.id?'selected':''}>${x.name}</option>`).join('')}</select><button class="btn small secondary" id="addRestaurant">+ Add</button></div><div class="user-label"><button class="status-pill sync-menu-button" id="syncCloudMenu"><span class="dot"></span> Menu synced</button></div></header><section class="content" id="page"></section></main></div>`;
  $('#restaurantSelect').onchange=e=>{state.activeRestaurantId=e.target.value;save();renderShell()};
  $('#addRestaurant').onclick=()=>openRestaurantForm(false);
  $('#syncCloudMenu')?.addEventListener('click',async e=>{e.currentTarget.disabled=true;try{await syncCloudMenus();renderShell();toast('Latest account menu loaded')}catch(error){e.currentTarget.disabled=false;toast(error.message||'Could not sync menu')}});
  $('#logout').onclick=logoutOwner;
  $$('.nav button[data-view]').forEach(b=>b.onclick=()=>{view=b.dataset.view;renderShell()});
  startOwnerOrderRealtime();
  renderView();
}
function navButton(v,i,t){return `<button data-view="${v}" class="${view===v?'active':''}"><span>${i}</span>${t}</button>`}
function renderView(){({dashboard:dashboardView,restaurants:restaurantsView,menu:menuView,orders:ordersView,qr:qrView,reports:reportsView,publish:publishSetupView,settings:settingsView}[view]||dashboardView)()}
function dashboardView(){const r=activeRestaurant(),items=restaurantItems(),orders=restaurantOrders();$('#page').innerHTML=`<div class="hero"><div><span class="status-pill"><span class="dot"></span>${r.open?'Open':'Closed'}</span><h1 style="margin:12px 0 6px">${r.logo} ${r.name}</h1><p>${r.description||r.type+' in '+r.city}</p></div><div class="actions"><button class="btn secondary" id="previewMenu">Preview Menu</button><button class="btn" id="openCsv">Manage Menu</button></div></div><div class="grid stats">${metric('Categories',restaurantCategories().length)}${metric('Menu Items',items.length)}${metric('Pending Orders',orders.filter(x=>x.status==='Pending').length)}${metric('Today Revenue',money(orders.filter(x=>x.status==='Completed').reduce((a,b)=>a+b.total,0)))}</div><article class="card image-compressor-card"><div><span class="eyebrow">PRIVATE IMAGE TOOL</span><h2>Image Compressor</h2><p>Compress restaurant and food photos to the required 100 KB limit. Processing stays in this browser; the original image is never uploaded or saved.</p></div><button class="btn" id="openImageCompressor">Compress an Image</button></article><div class="section-head"><h2>Live Orders</h2><button class="btn small secondary" data-go="orders">View all</button></div><div class="grid order-grid">${orders.slice(0,3).map(orderCard).join('')||empty('No orders yet')}</div>`;
  $('#previewMenu').onclick=()=>{location.hash=`menu&restaurant=${r.id}`};$('#openCsv').onclick=()=>{view='menu';renderShell()};$('#openImageCompressor').onclick=openImageCompressor;$('[data-go="orders"]').onclick=()=>{view='orders';renderShell()};bindOrderActions();}
function metric(label,value){return `<article class="card"><span class="muted">${label}</span><div class="metric">${value}</div></article>`}
function restaurantVisual(r,className=''){return imageMarkup(localMediaSource(r,'logoImageKey','logoImage'),r.name?.trim()?.[0]||'G',className)}
function restaurantsView(){$('#page').innerHTML=`<div class="section-head"><div><h1>My Restaurants</h1><p class="muted">Manage each restaurant, its menu, availability and orders.</p></div><button class="btn" id="createRestaurant">+ New Restaurant</button></div><div class="grid restaurant-grid">${ownerRestaurants().map(r=>`<article class="card restaurant-card"><div class="logo restaurant-logo">${restaurantVisual(r,'restaurant-logo-image')}</div><h3>${html(r.name)}</h3><p class="muted">${html(r.type)} · ${html(r.city)}</p><div class="chips"><span class="chip">${restaurantItems(r.id).length} items</span><span class="chip">${restaurantOrders(r.id).length} orders</span><span class="chip">${r.open?'Open':'Closed'}</span></div><div class="actions"><button class="btn small" data-open="${r.id}">Open Dashboard</button><button class="btn small secondary" data-edit="${r.id}">Edit</button><button class="btn small red" data-delete-restaurant="${r.id}">Delete</button></div></article>`).join('')}</div>`;$('#createRestaurant').onclick=()=>openRestaurantForm(false);$$('[data-open]').forEach(b=>b.onclick=()=>{state.activeRestaurantId=b.dataset.open;view='dashboard';save();renderShell()});$$('[data-edit]').forEach(b=>b.onclick=()=>openRestaurantForm(false,b.dataset.edit));$$('[data-delete-restaurant]').forEach(b=>b.onclick=()=>deleteRestaurant(b.dataset.deleteRestaurant))}
function restaurantForm(r={}){return `<form id="restaurantForm"><div class="form-grid"><div class="field"><label>Restaurant name</label><input name="name" value="${html(r.name||'')}" required></div><div class="field"><label>Type</label><select name="type">${['Restaurant','Café','Bakery','Cloud Kitchen','Fast Food','Other'].map(x=>`<option ${r.type===x?'selected':''}>${x}</option>`).join('')}</select></div><div class="field"><label>City / Location</label><input name="city" value="${html(r.city||'')}" required></div><div class="field local-image-field"><label>Restaurant image <small>(maximum 100 KB)</small></label><input name="logoFile" type="file" accept="image/jpeg,image/png,image/webp"><div class="image-preview restaurant-image-preview">${restaurantVisual(r,'restaurant-preview-image')}</div></div><div class="field"><label>Identification mode</label><select name="identification">${['Customer Name','Table Number','Counter Number','Token Number'].map(x=>`<option ${r.identification===x?'selected':''}>${x}</option>`).join('')}</select></div><div class="field"><label>Tax %</label><input name="tax" type="number" value="${r.tax??5}"></div></div><div class="form-grid"><div class="field"><label>Address</label><input name="address" value="${html(r.address||'')}"></div><div class="field"><label>Phone</label><input name="phone" value="${html(r.phone||'')}"></div><div class="field"><label>Email</label><input name="email" type="email" value="${html(r.email||'')}"></div></div><div class="field"><label>Description</label><textarea name="description">${html(r.description||'')}</textarea></div><button class="btn full">Save Restaurant</button></form>`}
function openRestaurantForm(first=false,id=null){
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
        else{saved={id:uid('res'),ownerId:state.session.userId,...d,logo:'G',restaurantKey:`${d.name}|${d.city}`,tax:+d.tax,service:0,open:true,accepting:true,social:{}};state.restaurants.push(saved);state.activeRestaurantId=saved.id}
        if(selectedFile?.size){const oldFile=saved.logoImageFileId,upload=await uploadMenuImage(selectedFile,saved.name);saved.logoImageUrl=upload.mediaUrl;saved.logoImageFileId=upload.fileId;if(oldFile&&oldFile!==upload.fileId)Gravity58Ads.removeMenuMedia(oldFile).catch(()=>{})}
        await persistCloudMenu(saved.id);Gravity58Ads?.upsertSlot({id:saved.id,restaurantKey:saved.restaurantKey,name:saved.name,city:saved.city,active:true}).catch(()=>{});if(previewUrl)URL.revokeObjectURL(previewUrl);closeModal();renderShell();toast('Restaurant saved')
      }catch(error){button.disabled=false;button.textContent='Save Restaurant';toast(error.message||'Could not save restaurant')}
    };
  });
}
async function deleteRestaurant(id){const restaurant=state.restaurants.find(r=>r.id===id);if(!restaurant||!confirm(`Permanently delete ${restaurant.name}, its menu, orders and QR locations?`))return;try{await removeCloudMenu(restaurant)}catch(error){return toast(error.message||'Could not delete the account menu')}const restaurantItemsToDelete=state.items.filter(row=>row.restaurantId===id),imageKeys=[restaurant.logoImageKey,...restaurantItemsToDelete.map(row=>row.imageKey)].filter(Boolean),cloudFiles=[restaurant.logoImageFileId,...restaurantItemsToDelete.map(row=>row.imageFileId)].filter(Boolean);state.restaurants=state.restaurants.filter(r=>r.id!==id);state.categories=state.categories.filter(row=>row.restaurantId!==id);state.items=state.items.filter(row=>row.restaurantId!==id);state.orders=state.orders.filter(row=>row.restaurantId!==id);state.locations=state.locations.filter(row=>row.restaurantId!==id);const next=ownerRestaurants()[0];state.activeRestaurantId=next?.id||'';save();Promise.all(imageKeys.map(deleteLocalMedia)).catch(()=>{});Promise.all(cloudFiles.map(fileId=>Gravity58Ads.removeMenuMedia(fileId))).catch(()=>{});Gravity58Ads?.upsertSlot({id:restaurant.id,restaurantKey:restaurant.restaurantKey||`${restaurant.name}|${restaurant.city}`,name:restaurant.name,city:restaurant.city,active:false}).catch(()=>{});toast('Restaurant deleted');next?restaurantsView():renderOwnerOnboarding()}
function menuView(){
  const cats=restaurantCategories(),items=restaurantItems();
  $('#page').innerHTML=`<div class="section-head menu-management-head"><div><h1>Menu Management</h1><p class="muted">Add dishes individually or import a complete menu from CSV.</p></div><div class="actions"><button class="btn" id="addMenuItem">+ Add Menu Item</button><button class="btn secondary" id="downloadMenuCsv">Download CSV Template</button><button class="btn secondary" id="chooseMenuImages">Choose CSV Images</button><button class="btn secondary" id="importMenuCsv">Import Menu CSV</button><input id="menuImageFiles" type="file" accept="image/jpeg,image/png,image/webp" multiple hidden><input id="menuCsvFile" type="file" accept=".csv,text/csv" hidden></div></div><div class="cloud-menu-note"><strong>Food images</strong><span>Add a JPG, PNG or WebP image up to 100 KB in the manual form. For CSV import, put each image filename in the <code>image_file</code> column, then choose the matching files before importing.</span><small id="imageSelectionStatus">No CSV images selected</small></div><div class="menu-import-options"><label for="menuImportMode">CSV import method</label><select id="menuImportMode"><option value="merge">Add or update existing menu</option><option value="replace">Overwrite entire menu</option></select><small id="menuImportModeHelp">Keeps current dishes and updates matching item names inside the same category.</small></div><div class="toolbar"><input id="itemSearch" placeholder="Search menu items"><select id="catFilter"><option value="">All categories</option>${cats.map(c=>`<option value="${c.id}">${html(c.name)}</option>`).join('')}</select></div><div class="grid menu-grid" id="menuGrid">${items.map(menuCard).join('')||empty('Add your first menu item or import a CSV file')}</div>`;
  $('#addMenuItem').onclick=()=>openMenuItemForm();
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
function ordersView(){
  const statuses=['All','Payment Verification','Pending','Accepted','Preparing','Ready','Completed','Rejected'],orders=sortedRestaurantOrders(),active=orders.filter(order=>activeQueueStatus(order.status));
  $('#page').innerHTML=`<div class="section-head"><div><h1>Live Orders</h1><p class="muted">Instant order board · ${active.length} token(s) in the active queue</p></div><span class="status-pill live-sync-pill"><span class="dot"></span> Live sync & sound alerts</span></div><div class="tabs">${statuses.map((s,i)=>`<button class="btn small ${i?'secondary':''}" data-tab="${s}">${s}</button>`).join('')}</div><div class="grid order-grid" id="ordersGrid" style="margin-top:16px">${orders.map(orderCard).join('')||empty('No orders yet')}</div>`;
  $$('[data-tab]').forEach(b=>b.onclick=()=>{$$('[data-tab]').forEach(x=>x.className='btn small secondary');b.className='btn small';const s=b.dataset.tab;$('#ordersGrid').innerHTML=orders.filter(o=>s==='All'||o.status===s).map(orderCard).join('')||empty(`No ${s.toLowerCase()} orders`);bindOrderActions()});
  bindOrderActions();
}
function orderMessagesMarkup(o,role='owner'){
  const messages=(o.messages||[]).slice(-6);
  return `<div class="order-chat"><div class="order-chat-log">${messages.map(message=>`<div class="order-message ${message.senderRole===role?'mine':''}"><strong>${html(message.senderRole==='owner'?'Restaurant':message.senderName||'Customer')}</strong><span>${html(message.text)}</span><small>${new Date(message.createdAt).toLocaleTimeString('en-IN',{hour:'2-digit',minute:'2-digit'})}</small></div>`).join('')||'<p class="muted no-messages">No messages yet.</p>'}</div><form class="order-chat-form" data-order-chat="${html(o.id)}"><input name="message" maxlength="240" placeholder="Message the customer" aria-label="Message customer"><button class="btn small" type="submit">Send</button></form></div>`
}
function orderCard(o){
  const identity=o.serviceMode==='table'?`Table ${o.tableNumber||'-'}`:'Single Counter',pay=o.paymentMethod==='online'?`Online · ${o.transactionId||'No ID'}`:'Pay at counter',token=formatToken(o.tokenNumber);
  return `<article class="card order-card" data-status="${html(o.status)}" data-order-card="${html(o.id)}"><div class="order-card-head"><div><span class="order-token">TOKEN ${token}</span><strong class="order-id">${html(o.id)}</strong><div class="muted">${html(o.customerName||o.customer||'Guest')} · ${html(identity)}</div>${o.phone?`<small class="muted">☎ ${html(o.phone)}</small>`:''}</div><span class="chip order-status">${html(o.status)}</span></div><div class="chips"><span class="chip">${html(pay)}</span>${o.paymentStatus?`<span class="chip">${html(o.paymentStatus)}</span>`:''}<span class="chip">${new Date(o.createdAt).toLocaleTimeString('en-IN',{hour:'2-digit',minute:'2-digit'})}</span></div><div class="order-items">${o.items.map(i=>`<div class="staff-order-item"><strong>${Number(i.qty)||1} × ${html(i.name)}</strong>${i.prepareInstruction?`<div class="staff-prep-note"><span>Preparation:</span> ${html(i.prepareInstruction)}</div>`:''}</div>`).join('')}</div><h3 style="margin:12px 0">${money(o.total)}</h3><div class="actions order-primary-actions">${orderActions(o)}${o.serviceMode==='table'?`<button class="btn small secondary" data-edit-table="${html(o.id)}">Correct table</button>`:''}<button class="btn small secondary" data-print-order="${html(o.id)}">Print</button></div>${orderMessagesMarkup(o)}</article>`
}
function orderActions(o){const map={'Payment Verification':['Confirm Payment','Reject Payment'],Pending:['Accept','Reject'],Accepted:['Start Preparing'],Preparing:['Mark Ready'],Ready:['Complete']};return (map[o.status]||[]).map(a=>`<button class="btn small ${['Reject','Reject Payment'].includes(a)?'red':['Start Preparing','Mark Ready','Complete'].includes(a)?'green':''}" data-order="${html(o.id)}" data-action="${a}">${a}</button>`).join('')}
function bindOrderActions(){
  $$('[data-order]').forEach(b=>b.onclick=()=>updateOrder(b.dataset.order,b.dataset.action));
  $$('[data-edit-table]').forEach(b=>b.onclick=()=>editOrderTable(b.dataset.editTable));
  $$('[data-print-order]').forEach(b=>b.onclick=()=>printOrderReceipt(b.dataset.printOrder));
  $$('[data-order-chat]').forEach(form=>form.onsubmit=event=>sendOrderMessage(event,form.dataset.orderChat,'owner'));
}
async function updateOrder(id,action){
  const o=state.orders.find(x=>x.id===id),next={Accept:'Accepted',Reject:'Rejected','Confirm Payment':'Pending','Reject Payment':'Payment Rejected','Start Preparing':'Preparing','Mark Ready':'Ready',Complete:'Completed'}[action];if(!o||!next)return;
  const previous={status:o.status,paymentStatus:o.paymentStatus,acceptedAt:o.acceptedAt,readyAt:o.readyAt,completedAt:o.completedAt};
  o.status=next;if(action==='Confirm Payment')o.paymentStatus='Confirmed';if(action==='Reject Payment')o.paymentStatus='Rejected';if(action==='Accept')o.acceptedAt=now();if(action==='Mark Ready')o.readyAt=now();if(action==='Complete')o.completedAt=now();o.updatedAt=now();
  if(!['Pending','Payment Verification'].includes(next))ringingOrderIds.delete(id);updateOrderAlertSound();
  try{await persistCloudOrder(o);save();toast(action==='Mark Ready'?`Token ${formatToken(o.tokenNumber)} is ready`:`Order ${o.id}: ${next}`);view==='orders'?ordersView():dashboardView()}catch(error){Object.assign(o,previous);toast(error.message||'Could not update order')}
}
function editOrderTable(id){
  const order=state.orders.find(row=>row.id===id);if(!order)return;
  modal('Correct Table Number',`<form id="correctTableForm"><p class="muted">Update the customer’s table if it is duplicated or incorrect. Their live order screen updates automatically.</p><div class="field"><label for="correctTableNumber">Table number</label><input id="correctTableNumber" name="tableNumber" value="${html(order.tableNumber||'')}" maxlength="20" required></div><button class="btn full">Update table</button></form>`,()=>{$('#correctTableForm').onsubmit=async event=>{event.preventDefault();const value=String(new FormData(event.target).get('tableNumber')||'').trim();if(!value)return;const previous=order.tableNumber;order.tableNumber=value;order.customer=`${order.customerName?order.customerName+' · ':''}Table ${value}`;order.updatedAt=now();try{await persistCloudOrder(order);save();closeModal();ordersView();toast(`Token ${formatToken(order.tokenNumber)} moved to Table ${value}`)}catch(error){order.tableNumber=previous;toast(error.message||'Could not update table')}}})
}
async function sendOrderMessage(event,id,senderRole){
  event.preventDefault();const form=event.currentTarget,input=$('input[name="message"]',form),text=String(input?.value||'').trim();if(!text)return;
  const order=state.orders.find(row=>row.id===id);if(!order)return;
  const button=$('button',form);button.disabled=true;
  try{
    let latest=order;if(order.cloudOwnerId&&Gravity58Ads?.configured)try{latest=await Gravity58Ads.get(cloudOrderKind(order.cloudOwnerId),id)}catch{}
    const message={id:uid('msg'),senderRole,senderName:senderRole==='owner'?activeRestaurant()?.name:(order.customerName||'Customer'),text,createdAt:now()};
    order.messages=[...(latest.messages||[]),message].slice(-50);order.updatedAt=now();await persistCloudOrder(order);save();input.value='';senderRole==='owner'?(view==='orders'?ordersView():dashboardView()):renderTrack();toast('Message sent');
  }catch(error){button.disabled=false;toast(error.message||'Could not send message')}
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
function cloudCustomerMenuUrl(restaurant=activeRestaurant()){const ownerId=cloudOwnerId()||restaurant?.cloudOwnerId||'';return `${location.href.split('#')[0]}#menu&cloud=${encodeURIComponent(restaurant.cloudRecordId||restaurant.id)}${ownerId?`&owner=${encodeURIComponent(ownerId)}`:''}`}
function publishSetupView(){
  const r=activeRestaurant(),url=cloudCustomerMenuUrl(r);$('#page').innerHTML=`<div class="section-head"><div><h1>Share Menu</h1><p class="muted">This customer link always opens your latest published menu.</p></div></div><article class="card cloud-share-card"><div><span class="publish-step">LIVE</span><h2>${html(r.name)} customer menu</h2><p>Restaurant details, menu items, images and availability update automatically.</p><a href="${html(url)}" target="_blank" rel="noopener">${html(url)}</a><div class="actions"><button class="btn" id="copyCloudMenuLink">Copy Customer Link</button><a class="btn secondary" href="${html(url)}" target="_blank" rel="noopener">Open Customer Menu</a></div></div><div class="qr-wrap"><div id="cloudMenuQr"></div></div></article><article class="card"><h2>Manage your menu</h2><p class="muted">Add items manually or import up to 100 dishes at a time from CSV.</p><button class="btn secondary" id="openMenuSetup">Open Menu Management</button></article>`;try{new QRCode($('#cloudMenuQr'),{text:url,width:220,height:220})}catch{$('#cloudMenuQr').textContent='QR unavailable'}$('#copyCloudMenuLink').onclick=()=>navigator.clipboard?.writeText(url).then(()=>toast('Customer link copied'));$('#openMenuSetup').onclick=()=>{view='menu';renderShell()}
}
function qrView(){const r=activeRestaurant(),url=cloudCustomerMenuUrl(r);$('#page').innerHTML=`<div class="section-head"><div><h1>QR Codes</h1><p class="muted">Share your live customer menu</p></div><button class="btn secondary" id="previewQr">Preview Menu</button></div><article class="card qr-card"><h2>${html(r.name)}</h2><p>Scan to View Menu</p><div class="qr-wrap"><div id="qrcode"></div></div><div class="actions" style="margin-top:18px"><button class="btn" id="copyQr">Copy Menu Link</button><button class="btn secondary" onclick="window.print()">Print</button></div><small class="muted" style="margin-top:16px">Powered by Gravity58 Digital Menu</small></article>`;try{new QRCode($('#qrcode'),{text:url,width:220,height:220})}catch{$('#qrcode').innerHTML='<div style="color:#111;padding:70px 25px">QR unavailable</div>'}$('#copyQr').onclick=()=>navigator.clipboard?.writeText(url).then(()=>toast('Menu link copied'));$('#previewQr').onclick=()=>window.open(url,'_blank')}
function reportsView(){const orders=restaurantOrders(),sales=orders.filter(x=>x.status==='Completed').reduce((a,b)=>a+b.total,0);$('#page').innerHTML=`<div class="section-head"><div><h1>Reports</h1><p class="muted">Data for ${activeRestaurant().name} only</p></div></div><div class="grid stats">${metric('Total Orders',orders.length)}${metric('Completed',orders.filter(x=>x.status==='Completed').length)}${metric('Total Sales',money(sales))}${metric('Average Order',money(orders.length?orders.reduce((a,b)=>a+b.total,0)/orders.length:0))}</div><div class="section-head"><h2>All Restaurants Overview</h2></div><div class="grid restaurant-grid">${ownerRestaurants().map(r=>{const os=restaurantOrders(r.id);return `<article class="card"><h3>${r.logo} ${r.name}</h3><p class="muted">${os.length} orders · ${money(os.filter(x=>x.status==='Completed').reduce((a,b)=>a+b.total,0))} sales</p></article>`}).join('')}</div>`}
function adsView(){const key=`${activeRestaurant().name}|${activeRestaurant().city}`;const ads=(state.advertisements||[]).filter(a=>a.restaurantKey===key);const requests=state.adRequests||[];$('#page').innerHTML=`<div class="section-head"><div><h1>Gravity58 Advertisement Control</h1><p class="muted">Central ad control using unique restaurant key: <strong>${key}</strong></p></div><button class="btn" id="createAd">+ Create Advertisement</button></div><div class="grid stats">${metric('Active Ads',ads.filter(a=>a.active).length)}${metric('Restaurant Ads',ads.length)}${metric('Ad Enquiries',requests.length)}${metric('Pending Enquiries',requests.filter(x=>x.status!=='Contacted').length)}</div><div class="section-head"><h2>Advertisements for this restaurant</h2></div><div class="grid restaurant-grid">${ads.map(a=>`<article class="card"><div class="ad-icon">${a.image||'📣'}</div><h3>${a.title}</h3><p class="muted">${a.description}</p><div class="chips"><span class="chip">${a.active?'Enabled':'Disabled'}</span><span class="chip">${a.restaurantKey}</span></div><div class="actions"><button class="btn small" data-toggle-ad="${a.id}">${a.active?'Disable':'Enable'}</button><button class="btn small red" data-delete-ad="${a.id}">Delete</button></div></article>`).join('')||empty('No advertisement enabled. Customers will see the Ad Space placeholder.')}</div><div class="section-head"><h2>Ad-space enquiries</h2></div><div class="card table-wrap"><table><thead><tr><th>Name</th><th>Phone</th><th>Email</th><th>Restaurant</th><th>Status</th><th></th></tr></thead><tbody>${requests.map(q=>`<tr><td>${q.name}</td><td>${q.phone}</td><td>${q.email}</td><td>${q.restaurantKey}</td><td>${q.status||'New'}</td><td><button class="btn small secondary" data-contacted="${q.id}">Mark Contacted</button></td></tr>`).join('')||'<tr><td colspan="6" class="muted">No enquiries yet.</td></tr>'}</tbody></table></div>`;$('#createAd').onclick=()=>modal('Create G58 Advertisement',`<form id="adForm"><div class="field"><label>Restaurant key</label><input value="${key}" disabled></div><div class="field"><label>Title</label><input name="title" required></div><div class="field"><label>Description</label><textarea name="description" required></textarea></div><div class="form-grid"><div class="field"><label>Button label</label><input name="buttonLabel" value="View Offer"></div><div class="field"><label>Destination URL</label><input name="destinationUrl" value="#"></div><div class="field"><label>Icon / Emoji</label><input name="image" value="📣"></div><div class="field"><label>Status</label><select name="active"><option value="true">Enabled</option><option value="false">Disabled</option></select></div></div><button class="btn full">Save Advertisement</button></form>`,()=>{$('#adForm').onsubmit=e=>{e.preventDefault();const d=Object.fromEntries(new FormData(e.target));state.advertisements.push({id:uid('ad'),restaurantKey:key,...d,active:d.active==='true'});save();closeModal();adsView();toast('Advertisement saved')}});$$('[data-toggle-ad]').forEach(b=>b.onclick=()=>{const a=state.advertisements.find(x=>x.id===b.dataset.toggleAd);a.active=!a.active;save();adsView()});$$('[data-delete-ad]').forEach(b=>b.onclick=()=>{state.advertisements=state.advertisements.filter(x=>x.id!==b.dataset.deleteAd);save();adsView()});$$('[data-contacted]').forEach(b=>b.onclick=()=>{const q=state.adRequests.find(x=>x.id===b.dataset.contacted);q.status='Contacted';save();adsView()})}
function currentAdvertisement(r,slotId='right_rail'){const restaurantKey=`${r.name}|${r.city}`,ts=Date.now();return (state.advertisements||[]).filter(a=>a.restaurantKey===restaurantKey&&a.active&&(!a.slotId||a.slotId===slotId)&&(!a.expiresAt||new Date(a.expiresAt).getTime()>ts)).sort((a,b)=>new Date(b.activatedAt||b.createdAt||0)-new Date(a.activatedAt||a.createdAt||0))[0]}
function adTimeLeft(ad){if(!ad?.expiresAt)return 'Slot duration not set';const ms=new Date(ad.expiresAt).getTime()-Date.now();if(ms<=0)return 'Expired';const h=Math.floor(ms/36e5),m=Math.floor((ms%36e5)/6e4);return `${h}h ${m}m remaining`}
function publicAdSection(r){
  let slotId='right_rail';
  if(location.hash.includes('track')){const id=new URLSearchParams(location.hash.replace('#track&','')).get('order'),order=state.orders.find(row=>row.id===id);slotId=order?.status==='Completed'?'thankyou':'preparing'}
  const ad=currentAdvertisement(r,slotId),size=slotId==='right_rail'?'1080 × 1350 px':slotId==='preparing'?'1200 × 628 px':'1080 × 1080 px';
  if(ad)return `<section class="public-ad active-ad"><div class="ad-art">${adMediaMarkup(ad,'public-ad-media')}</div><div><p class="eyebrow">SPONSORED PROMOTION</p><h3>${html(ad.title)}</h3><p>${html(ad.description)}</p></div><a class="btn" href="${html(ad.destinationUrl||'#')}" target="_blank" rel="noopener">${html(ad.buttonLabel||'View Offer')}</a><small class="ad-expiry ad-expiry-badge" data-ad-expiry="${html(ad.expiresAt||'')}">${adTimeLeft(ad)}</small></section>`;
  return `<section class="public-ad ad-placeholder"><div class="ad-art">✦</div><div><p class="eyebrow">GRAVITY58 AD SPACE</p><h3>Your advertisement can appear here</h3><p>Book a restaurant-specific advertising slot through Gravity58.</p><small class="ad-size-note">Recommended creative: ${size}</small></div><button class="btn secondary" id="contactG58Ads">Contact Gravity58 for Ad Space</button></section>`
}
function bindPublicAdContact(r){const b=$('#contactG58Ads');if(!b)return;b.onclick=()=>{const base=CONFIG.adBookingPortalUrl||'../advertise/';location.href=`${base}?restaurant=${encodeURIComponent(`${r.name}|${r.city}`)}`}}
function settingsView(){const r=activeRestaurant();$('#page').innerHTML=`<div class="section-head"><div><h1>Restaurant Settings</h1><p class="muted">Settings apply only to ${r.name}</p></div></div><article class="card"><form id="settingsForm"><div class="form-grid"><div class="field"><label>Restaurant status</label><select name="open"><option value="true" ${r.open?'selected':''}>Open</option><option value="false" ${!r.open?'selected':''}>Closed</option></select></div><div class="field"><label>Accept orders</label><select name="accepting"><option value="true" ${r.accepting?'selected':''}>Yes</option><option value="false" ${!r.accepting?'selected':''}>No</option></select></div><div class="field"><label>Tax %</label><input name="tax" type="number" value="${r.tax||0}"></div><div class="field"><label>Service charge %</label><input name="service" type="number" value="${r.service||0}"></div><div class="field"><label>Enable customer payment</label><select name="paymentEnabled"><option value="true" ${r.paymentEnabled?'selected':''}>Enabled</option><option value="false" ${!r.paymentEnabled?'selected':''}>Disabled</option></select></div><div class="field"><label>UPI ID</label><input name="upiId" value="${r.upiId||''}" placeholder="restaurant@upi"></div><div class="field"><label>Payment link (optional)</label><input name="paymentLink" value="${r.paymentLink||''}" placeholder="https://..."></div><div class="field"><label>Instagram URL</label><input name="instagram" value="${r.social?.Instagram||''}"></div><div class="field"><label>WhatsApp URL</label><input name="whatsapp" value="${r.social?.WhatsApp||''}"></div></div><p class="muted">These settings sync with your G58 account. Online payments remain unconfirmed until staff verify the customer transaction ID.</p><button class="btn">Save Settings</button></form></article>`;$('#settingsForm').onsubmit=async e=>{e.preventDefault();const d=Object.fromEntries(new FormData(e.target)),button=e.submitter;button.disabled=true;Object.assign(r,{open:d.open==='true',accepting:d.accepting==='true',tax:+d.tax,service:+d.service,paymentEnabled:d.paymentEnabled==='true',upiId:d.upiId,paymentLink:d.paymentLink,social:{...r.social,Instagram:d.instagram,WhatsApp:d.whatsapp}});try{await persistCloudMenu(r.id);toast('Settings saved');renderShell()}catch(error){button.disabled=false;toast(error.message||'Could not save settings')}}}

async function loadRemoteMenuConfig(source){
  if(remoteMenuLoading)return;remoteMenuLoading=true;app.innerHTML='<main class="public-menu"><div class="remote-menu-loading"><span></span><h2>Loading published menu</h2><p>Downloading the restaurant config securely…</p></div></main>';
  try{const url=new URL(source,location.href);if(!['https:','http:'].includes(url.protocol))throw new Error('Unsupported config URL');const response=await fetch(url.href,{mode:'cors',credentials:'omit'});if(!response.ok)throw new Error(`Config download failed (${response.status})`);const text=await response.text();if(text.length>30*1024*1024)throw new Error('Menu config is too large');remoteMenuConfig=validateMenuConfig(JSON.parse(text));remoteMenuSource=source;remoteMenuLoading=false;renderPublicMenu()}catch(error){remoteMenuLoading=false;remoteMenuSource='';remoteMenuConfig=null;app.innerHTML=`<main class="public-menu"><div class="remote-menu-error"><h2>Menu could not be loaded</h2><p>${html(error.message||'Check the public config URL and hosting permissions.')}</p><a class="btn" href="${location.href.split('#')[0]}">Return to Digital Menu</a></div></main>`}
}

function cloudRecordToConfig(record){if(!record?.restaurant?.id||!Array.isArray(record.categories)||!Array.isArray(record.items))throw new Error('This restaurant menu is not available');return {g58MenuConfig:1,restaurant:{...record.restaurant},categories:record.categories.map(row=>({...row,restaurantId:record.restaurant.id})),items:record.items.map(row=>({...row,restaurantId:record.restaurant.id,available:row.available!==false}))}}
function cacheCloudMenuForOrders(config,ownerId){const rid=config.restaurant.id,existing=state.restaurants.find(row=>row.id===rid),ownerIdForCache=existing?.ownerId||`public_${ownerId}`;state.restaurants=state.restaurants.filter(row=>row.id!==rid);state.categories=state.categories.filter(row=>row.restaurantId!==rid);state.items=state.items.filter(row=>row.restaurantId!==rid);state.restaurants.push({...config.restaurant,ownerId:ownerIdForCache,cloudRecordId:rid,logo:'G'});state.categories.push(...config.categories.map(row=>({...row,restaurantId:rid})));state.items.push(...config.items.map(row=>({...row,restaurantId:rid})));save()}
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
    cacheCloudMenuForOrders(remoteMenuConfig,resolvedOwnerId);
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
  if(!published&&!customerContext){
    modal('Welcome to '+r.name,`<form id="identityForm" class="customer-entry-form"><div class="field centered-field"><label>Customer name <small id="nameRequirement">(required for counter orders)</small></label><input name="customerName" required placeholder="Enter your name"></div><div class="service-choice"><label class="choice-card"><input type="radio" name="serviceMode" value="counter" checked><span><strong>Single Counter</strong><small>Collect from the service counter</small></span></label><label class="choice-card"><input type="radio" name="serviceMode" value="table"><span><strong>Enter Table Number</strong><small>Order for your table</small></span></label></div><div class="field" id="tableNumberField" hidden><label>Table number</label><input name="tableNumber" placeholder="Example: 12"></div><div class="field"><label>Phone number <small>(optional)</small></label><input name="phone" type="tel" placeholder="Optional contact number"></div><button class="btn full">Continue to Menu</button></form>`,()=>{const form=$('#identityForm'),tableField=$('#tableNumberField'),nameNote=$('#nameRequirement');const syncIdentity=()=>{const table=form.serviceMode.value==='table';tableField.hidden=!table;form.tableNumber.required=table;form.customerName.required=!table;nameNote.textContent=table?'(optional for table orders)':'(required for counter orders)';form.customerName.placeholder=table?'Optional customer name':'Enter your name'};$$('input[name="serviceMode"]',form).forEach(x=>x.onchange=syncIdentity);syncIdentity();form.onsubmit=e=>{e.preventDefault();const d=Object.fromEntries(new FormData(e.target));const customerName=(d.customerName||'').trim();const tableNumber=(d.tableNumber||'').trim();if(d.serviceMode==='counter'&&!customerName)return toast('Enter customer name for counter order');if(d.serviceMode==='table'&&!tableNumber)return toast('Enter table number');customerContext={restaurantId:rid,customerName,serviceMode:d.serviceMode,tableNumber:d.serviceMode==='table'?tableNumber:'',phone:(d.phone||'').trim(),customer:d.serviceMode==='table'?`${customerName?customerName+' · ':''}Table ${tableNumber}`:customerName};sessionStorage.setItem(`gravity58Customer_${rid}`,JSON.stringify(customerContext));closeModal();renderPublicMenu()}})
  }
  const cats=sharedMenu?remoteMenuConfig.categories:restaurantCategories(rid),items=sharedMenu?remoteMenuConfig.items:restaurantItems(rid),restaurantHero=localMediaSource(r,'logoImageKey','logoImage');
  const filterKey=`gravity58MenuFilters_${rid}`;
  const filters={category:'all',diet:'all',search:'',available:false,sort:'recommended',...JSON.parse(sessionStorage.getItem(filterKey)||'{}')};
  const activeCategory=cats.find(c=>c.id===filters.category);
  const ad=currentAdvertisement(r);
  app.innerHTML=`<main class="public-menu compact-public-menu">
    <section class="menu-sticky-header">
    <section class="compact-menu-hero">
      <nav class="menu-nav compact-nav"><div><h2>${html(r.name)}</h2><p>${html(r.type)} · ${html(r.city)}</p>${published?'<span class="published-menu-badge">Published customer menu</span>':cloudMenu?'<span class="published-menu-badge">Live account menu</span>':''}</div><a class="sponsor-mini" href="https://www.g58.in" target="_blank" rel="noopener">Sponsored by <strong>Gravity58</strong></a></nav>
      <div class="compact-hero-layout"><div><p class="eyebrow">PREMIUM DIGITAL MENU</p><h1>Fresh favourites,<br>ready to order</h1><p>${html(r.description)}</p><div class="compact-details"><span>📍 ${html(r.address||r.city)}</span><span>☎ ${html(r.phone||'Contact restaurant')}</span><span class="open-tag">${r.open?'Open now':'Closed'}</span></div></div><div class="compact-hero-dish">${imageMarkup(restaurantHero,r.name?.[0]||'G','compact-hero-photo')}</div></div>
    </section>
    <aside class="header-ad-panel">
      <button class="ad-space-contact" id="contactG58Ads" type="button">Book this ad space · 1080 × 1350 px</button>
      ${ad?`<a class="header-active-ad creative-${html(ad.creativeStyle||'spotlight')}" href="${html(ad.destinationUrl||'#')}" target="_blank" rel="noopener"><span class="ad-label">SPONSORED</span><div class="header-ad-art">${adMediaMarkup(ad,'header-ad-media')}</div><div><h3>${html(ad.title)}</h3><p>${html(ad.description)}</p><strong>${html(ad.buttonLabel||'View Offer')} →</strong></div><small class="ad-expiry ad-expiry-badge" data-ad-expiry="${html(ad.expiresAt||'')}">${adTimeLeft(ad)}</small></a>`:`<div class="header-ad-placeholder"><span class="ad-label">GRAVITY58 AD SPACE</span><div class="header-ad-art"><span class="media-fallback">G58</span></div><div><h3>Put your brand beside the menu</h3><p>Best image: 1080 × 1350 px (4:5)</p></div></div>`}
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
            <select id="publicMenuSort" aria-label="Sort menu"><option value="recommended" ${filters.sort==='recommended'?'selected':''}>Recommended</option><option value="price-low" ${filters.sort==='price-low'?'selected':''}>Price: Low to High</option><option value="price-high" ${filters.sort==='price-high'?'selected':''}>Price: High to Low</option></select>
          </div>
        </div>
        <nav class="category-chip-strip" aria-label="Menu categories"><button class="category-chip ${filters.category==='all'?'active':''}" data-cat-select="all">All dishes</button>${cats.map(c=>`<button class="category-chip ${c.id===filters.category?'active':''}" data-cat-select="${c.id}">${html(c.name)}</button>`).join('')}</nav>
        <header class="focused-menu-heading"><div><p class="eyebrow">CURATED MENU</p><h2 id="publicMenuHeading">${html(activeCategory?.name||'All dishes')}</h2></div><span id="publicMenuCount">${items.length} items</span></header>
        <div class="poster-menu-list swiggy-menu-list" id="publicMenuItems">${items.map((item,index)=>publicItem(item,{categories:cats,index,readOnly:published})).join('')}</div>
        <div class="empty menu-filter-empty hidden" id="menuFilterEmpty">No dishes match these filters.</div>
      </section>
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
  const options=['Spicy','Medium spicy','Low spicy','No salt'];
  modal('Prepare '+item.name,`<form id="prepareInstructionForm" class="prepare-instruction-form"><p class="muted">Select one or more kitchen preferences. Use the note box for anything else.</p><div class="prep-option-grid">${options.map(o=>`<label class="prep-option"><input type="checkbox" name="prepOption" value="${o}" ${selected.has(o)?'checked':''}><span>${o}</span></label>`).join('')}</div><div class="field"><label>Other preparation request</label><textarea name="customNote" maxlength="250" placeholder="Type any other request for the kitchen">${html(cartItem.customPrepareNote||'')}</textarea></div><button class="btn full">Save Instructions</button></form>`,()=>{$('#prepareInstructionForm').onsubmit=e=>{e.preventDefault();const fd=new FormData(e.target);const opts=fd.getAll('prepOption');const note=(fd.get('customNote')||'').trim();cartItem.prepareOptions=opts;cartItem.customPrepareNote=note;cartItem.prepareInstruction=[...opts,note].filter(Boolean).join(' · ');closeModal();renderPublicMenu();toast('Preparation instructions saved')}})
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

    button.addEventListener('click',async()=>{
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
        const orderOwnerId=remoteMenuSource.startsWith('cloud:')?remoteMenuSource.split(':')[1]:cloudOwnerId();
        const tokenNumber=await reserveOrderToken(orderOwnerId,r.id);
        const order={
          id:orderId,restaurantId:r.id,customer:identity||'Guest',
          ownerId:orderOwnerId,cloudOwnerId:orderOwnerId,
          tokenNumber,orderDay:orderDay(),messages:[],
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
        await persistCloudOrder(order);
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
        fail('Order could not be placed. Please reload this menu and try again.');
      }
    });
  });
}

function renderTrack(){const params=new URLSearchParams(location.hash.replace('#track&',''));const id=params.get('order'),o=state.orders.find(x=>x.id===id);if(!o){app.innerHTML=`<main class="public-menu"><div class="empty">Order not found</div></main>`;return}const r=state.restaurants.find(x=>x.id===o.restaurantId),stage={'Payment Verification':5,'Payment Rejected':100,Pending:8,Accepted:25,Preparing:55,Ready:85,Delivered:94,Completed:100,Rejected:100}[o.status]||8;let content;if(o.status==='Completed')content=`<section class="card thankyou"><h1>Thank You!</h1><h2>${r.logo} ${r.name}</h2><p class="muted">We hope you enjoyed your experience.</p><div class="chips" style="justify-content:center"><span class="chip">Order ${o.id}</span><span class="chip">${o.customer}</span></div><div class="grid restaurant-grid" style="margin-top:24px"><article class="card"><h3>Restaurant</h3><p class="muted">Follow ${r.name} and leave your feedback.</p></article><article class="card"><h3>Discover More with Gravity58</h3><p class="muted">Explore local businesses and useful digital tools.</p><a class="btn" href="${CONFIG.gravity58Url}" target="_blank">Explore Gravity58</a></article><article class="card"><h3>Featured</h3><p class="muted">Advertisement space for restaurant or Gravity58 promotions.</p></article></div></section>`;else content=`<section class="card" style="text-align:center"><span class="status-pill"><span class="dot"></span>${o.status}</span><h1 style="margin:18px 0 6px">${o.status==='Ready'?'Your Food Is Ready!':o.status==='Payment Verification'?'Verifying Your Payment':o.status==='Payment Rejected'?'Payment Could Not Be Confirmed':o.status==='Rejected'?'Order Rejected':'Your Food Is Being Prepared'}</h1><div class="track-message ${o.status==='Ready'?'ready-message':''}">${o.status==='Ready'?'<strong>Your order will be served soon</strong><span>Please stay at your table or near the service counter. Our team will bring your food shortly.</span>':o.status==='Payment Verification'?'Restaurant staff are checking transaction '+(o.transactionId||''):'Order '+o.id+' · '+o.customer}</div>${['Accepted','Preparing'].includes(o.status)?`<div class="pot-scene"><div><div class="steam"><span></span><span></span><span></span></div><div class="pot"></div></div></div>`:''}<div class="progress"><span style="width:${stage}%"></span></div><div class="chips" style="justify-content:center;margin-top:18px">${o.items.map(i=>`<span class="chip">${i.qty} × ${i.name}${i.prepareInstruction?' · '+i.prepareInstruction:''}</span>`).join('')}</div><div class="section-head"><span>Total</span><strong>${money(o.total)}</strong></div><section class="social-discovery"><div class="social-discovery-copy"><span class="eyebrow">Restaurant profile</span><h2>Take a look at how we specialise</h2><p>Explore ${r.name} beyond today’s order. See our food creations, kitchen moments, new dishes and restaurant updates.</p></div><div class="social-profile-grid">${Object.entries(r.social||{}).filter(([,u])=>u).map(([p,u])=>{const key=p.toLowerCase();const icon=key==='instagram'?'◎':key==='youtube'?'▶':key==='facebook'?'f':key==='whatsapp'?'◉':'↗';const desc=key==='instagram'?'View our restaurant profile, food photos, reels and latest specials.':key==='youtube'?'Watch our kitchen stories, signature dishes and restaurant videos.':key==='facebook'?'Visit our restaurant page for updates, offers and community posts.':key==='whatsapp'?'Connect with the restaurant team on WhatsApp.':'Open our restaurant profile and discover more.';return `<a class="social-profile-card ${key}" href="${u}" target="_blank" rel="noopener"><span class="social-profile-icon">${icon}</span><span class="social-profile-text"><strong>${p}</strong><small>${desc}</small><b>View restaurant profile →</b></span></a>`}).join('')||'<div class="social-empty">Restaurant social profiles will appear here.</div>'}</div></section>${publicAdSection(r)}</section>`;app.innerHTML=`<main class="public-menu">${content}<div class="actions" style="justify-content:center;margin-top:18px"><button class="btn secondary" id="refreshTrack">Refresh Status</button><button class="btn" id="backMenu">View Menu</button></div></main>`;$('#refreshTrack').onclick=renderTrack;$('#backMenu').onclick=()=>location.hash=`menu&restaurant=${r.id}`;bindPublicAdContact(r)}

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
  if(card&&!$('.customer-order-chat',card)){
    const ad=$('.public-ad',card);
    const chat=`<section class="customer-order-chat"><div><span class="eyebrow">LIVE RESTAURANT CHAT</span><h2>Need help with this order?</h2><p class="muted">Messages and corrected table details update for both you and the restaurant.</p></div><div class="order-chat-log">${(order.messages||[]).slice(-8).map(item=>`<div class="order-message ${item.senderRole==='customer'?'mine':''}"><strong>${html(item.senderRole==='owner'?'Restaurant':item.senderName||'You')}</strong><span>${html(item.text)}</span><small>${new Date(item.createdAt).toLocaleTimeString('en-IN',{hour:'2-digit',minute:'2-digit'})}</small></div>`).join('')||'<p class="muted no-messages">No messages yet.</p>'}</div><form class="order-chat-form" data-customer-chat="${html(order.id)}"><input name="message" maxlength="240" placeholder="Message the restaurant" aria-label="Message restaurant"><button class="btn" type="submit">Send</button></form></section>`;
    if(ad)ad.insertAdjacentHTML('beforebegin',chat);else card.insertAdjacentHTML('beforeend',chat);
    $('[data-customer-chat]',card).onsubmit=event=>sendOrderMessage(event,order.id,'customer');
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
  customerOrderUnsubscribe=Gravity58Ads.subscribeKind(kind,async row=>{if(row&&(row.id||row.$id)!==order.id)return;try{const latest=row||await Gravity58Ads.get(kind,order.id),local=state.orders.find(item=>item.id===order.id);if(local)Object.assign(local,latest);save();renderTrack()}catch(error){console.warn('Customer live order update failed',error)}});
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
  if(activeCompressorUrl){URL.revokeObjectURL(activeCompressorUrl);activeCompressorUrl=''}
  $('#modal')?.remove();
  document.body.classList.remove('modal-open');
}
document.addEventListener('keydown',event=>{if(event.key==='Escape'&&$('#modal'))closeModal()});
document.addEventListener('pointerdown',()=>{if(ringingOrderIds.size)orderAlertBeep()},{passive:true});
function empty(t){return `<div class="empty">${t}</div>`}
window.addEventListener('hashchange',render);
window.addEventListener('storage',()=>{state=load();render();hydrateLocalMedia()});
async function refreshTrackedCloudOrder(){if(!location.hash.startsWith('#track'))return;state=load();const params=new URLSearchParams(location.hash.replace('#track&','')),id=params.get('order'),local=state.orders.find(row=>row.id===id);if(local?.cloudOwnerId)try{const latest=await Gravity58Ads.get(cloudOrderKind(local.cloudOwnerId),id);Object.assign(local,latest);save()}catch(error){console.warn('Order status refresh failed',error)}renderTrack()}
setInterval(refreshTrackedCloudOrder,2500);
setInterval(async()=>{if(state.session?.provider==='gravity58'&&view==='orders'&&!location.hash){try{await syncCloudOrders();ordersView()}catch(error){console.warn('Order board refresh failed',error)}}},10000);
function refreshExpiryLabels(){$$('[data-ad-expiry]').forEach(label=>{const expiresAt=label.dataset.adExpiry;if(!expiresAt){label.textContent='Contact G58 for slot duration';return}label.textContent=adTimeLeft({expiresAt})})}
setInterval(refreshExpiryLabels,30000);
async function resumeGravity58Account(){if(location.hash.startsWith('#menu')||!Gravity58Ads?.configured)return;try{const account=await Gravity58Ads.currentUser();if(!account?.email)return;const user=ensureGravity58User(account);state.session={userId:user.id,provider:'gravity58'};save();await syncCloudMenus();render()}catch(error){console.warn('Gravity58 account resume failed',error)}}
Gravity58Ads?.subscribeAdvertisements(hydrateAdvertisements);
render();
hydrateLocalMedia();
hydrateAdvertisements();
resumeGravity58Account();
