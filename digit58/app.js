(function captureDigit58ReferralCode(){
  try{
    const ref=new URLSearchParams(location.search).get('ref');
    if(ref&&/^[A-Za-z0-9]{4,12}$/.test(ref))localStorage.setItem('g58ReferredByCode',ref.toUpperCase());
  }catch{}
})();
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
function indiaTimeValue(value=new Date()){
  const date=value instanceof Date?value:new Date(value);
  if(Number.isNaN(date.getTime()))return '';
  const parts=Object.fromEntries(new Intl.DateTimeFormat('en-GB',{timeZone:'Asia/Kolkata',hour:'2-digit',minute:'2-digit',hour12:false}).formatToParts(date).filter(part=>part.type!=='literal').map(part=>[part.type,part.value]));
  return `${parts.hour}:${parts.minute}`;
}
function isMedicalStore(store){return /medic|pharma|chemist|drug/i.test(String(store?.category||''))}
function medicineDaysElapsed(medicine){
  const startDay=indiaDateValue(medicine.startedAt);
  const today=indiaDateValue();
  if(!startDay)return 0;
  return Math.max(0,Math.round((new Date(today)-new Date(startDay))/86400000));
}
function isMedicineComplete(medicine){return medicineDaysElapsed(medicine)>=Number(medicine.days)}
function isCourseComplete(course){return (course.medicines||[]).every(isMedicineComplete)}
function courseCompletionDate(course){
  const times=(course.medicines||[]).map(medicine=>new Date(medicine.startedAt).getTime()+Number(medicine.days)*86400000);
  return times.length?new Date(Math.max(...times)).toISOString():course.updatedAt||course.createdAt;
}
function activeCourses(courses){return courses.filter(course=>!isCourseComplete(course))}
function completedCourses(courses){return courses.filter(isCourseComplete)}
function latestCoursePerPatient(courses){
  const byPatient=new Map();
  courses.forEach(course=>{
    const key=course.patientName||'';
    const existing=byPatient.get(key);
    if(!existing||new Date(courseCompletionDate(course))>new Date(courseCompletionDate(existing)))byPatient.set(key,course);
  });
  return [...byPatient.values()];
}
function filterCoursesByIndiaDate(courses,fromDate,toDate){
  return courses.filter(course=>{
    const day=indiaDateValue(courseCompletionDate(course));
    return (!fromDate||day>=fromDate)&&(!toDate||day<=toDate);
  });
}
function medicineRowMarkup(medicine){
  const done=isMedicineComplete(medicine),remaining=Math.max(0,Number(medicine.days)-medicineDaysElapsed(medicine));
  return `<div class="medicine-row ${done?'medicine-done':''}"><span class="medicine-name">${html(medicine.name)}</span><span class="medicine-meta">${html(medicine.time)} · ${done?'Completed':`${remaining} day(s) left`}</span></div>`;
}
function courseMarkup(course){
  return `<article class="card course-card"><h3>${html(course.patientName)}</h3><div class="medicine-list">${(course.medicines||[]).map(medicineRowMarkup).join('')}</div><button class="btn small secondary" data-add-medicine="${html(course.id)}">+ Add Medicine</button></article>`;
}
function courseHistoryRow(course){
  return `<tr><td>${html(course.patientName)}</td><td>${(course.medicines||[]).map(medicine=>html(medicine.name)).join(', ')}</td><td>${new Date(courseCompletionDate(course)).toLocaleString('en-IN',{timeZone:'Asia/Kolkata',dateStyle:'medium'})}</td></tr>`;
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
const courseKind=(ownerId)=>safeId('digit58_course_',ownerId,39);
const catalogKind=(ownerId)=>safeId('digit58_catalog_',ownerId,38);
const serviceKind=(ownerId)=>safeId('digit58_service_',ownerId,38);
const expertKind=(ownerId)=>safeId('digit58_expert_',ownerId,38);
const bookingKind=(ownerId)=>safeId('digit58_booking_',ownerId,38);
const isGameZone=(store)=>store?.bookingMode==='game_zones'||store?.businessType==='game_zones';
const isServiceStore=(store)=>store?.businessType==='services'||store?.businessType==='game_zones';
const bookingCopy=(store)=>isGameZone(store)
  ?{items:'Games & Slots',item:'Game / Slot',itemLower:'game or slot',resources:'Play Areas',resource:'Play Area',resourceLower:'play area',bookTitle:'Book a Game',bookButton:'+ Book a Game',empty:'No game bookings yet. Choose a game and time slot to get started.',historyItem:'Game',historyResource:'Play Area',after:'at the venue',completed:'after the play session'}
  :{items:'Services',item:'Service',itemLower:'service',resources:'Experts',resource:'Expert',resourceLower:'expert',bookTitle:'Book a Service',bookButton:'+ Book a Service',empty:'No bookings yet. Book a service to get started.',historyItem:'Service',historyResource:'Expert',after:'after service',completed:'after the service is done'};
const WEEKDAYS=[{id:1,label:'Monday',short:'Mon'},{id:2,label:'Tuesday',short:'Tue'},{id:3,label:'Wednesday',short:'Wed'},{id:4,label:'Thursday',short:'Thu'},{id:5,label:'Friday',short:'Fri'},{id:6,label:'Saturday',short:'Sat'},{id:0,label:'Sunday',short:'Sun'}];
const normaliseAvailableDays=(value)=>[...new Set((Array.isArray(value)?value:[]).map(Number).filter(day=>Number.isInteger(day)&&day>=0&&day<=6))];
const REQUEST_KIND='digit58_requests',ENTITLEMENT_KIND='digit58_entitlements',SUBSCRIPTION_AMOUNT=399;
const CARD_PURCHASE_KIND='digit58_card_purchases',FREE_PROMOTION_CARDS=3;
const PROMOTION_CARD_PRICING={'30d':{label:'30 Days',amount:150,days:30},'6mo':{label:'6 Months',amount:750,days:182},'1yr':{label:'1 Year',amount:1200,days:365}};
const BRAND_KIND='digit58_brand_owners',BRAND_REQUEST_KIND='digit58_brand_requests';
const BRAND_CARD_PRICING={'30d':{label:'30 Days',amount:300,days:30},'6mo':{label:'6 Months',amount:1500,days:182},'1yr':{label:'1 Year',amount:2000,days:365}};
const AI_IMAGE_PROMPT=`Create a high-resolution promotional product image using the uploaded product photo as the exact visual reference.
The user will provide:

* Product image
* Offer percentage
* Optional short offer text

DESIGN REQUIREMENTS
Preserve the original product identity completely, including:

* Brand name
* Logo
* Packaging shape
* Colors
* Label details

Do not redesign or replace the product.
The product must remain instantly recognizable and unchanged in structure.
Place the product as the main hero object with a premium commercial presentation:

* studio-quality lighting
* realistic glossy reflections
* subtle 3D depth and perspective tilt
* sharp, clean cutout edges
* high-end advertising look
* fully readable packaging
* no human elements

VISUAL ENHANCEMENT ELEMENTS
Add subtle, category-appropriate decorative effects around the product to enhance appeal.
Examples:

* Toothpaste → mint leaves, water splash, freshness waves
* Health drink → milk splash, wheat, chocolate/malt textures
* Medicine/healthcare → clean clinical glow, soft medical light accents
* FMCG/grocery → ingredient-based natural elements

Keep effects minimal, elegant, and non-distracting.
Do not overcrowd the composition.
OFFER BADGE
Add a premium, visually striking promotional badge or ribbon displaying:
{{OFFER_PERCENTAGE}} OFF
Example:

* 20% OFF
* 40% OFF
* 50% OFF

If additional offer text is provided, include it subtly as secondary text:
{{OFFER_TEXT}}
Otherwise, only display the discount percentage and "OFF".
Design rules:

* high contrast and easy readability
* glossy, modern ribbon or badge style
* integrated naturally with the product composition
* must not block the main brand name or key label

BACKGROUND REQUIREMENT
The final output must have a fully transparent background (PNG style).
Do NOT include:

* white background
* colored background
* gradients as full backdrop
* studio room environment
* patterns or textures behind the product

Only the following should remain:

* product
* decorative effects
* offer badge/ribbon

Everything else must be removed.
COMPOSITION GUIDELINES
Design for commercial use in:

* promotional cards (G58 style)
* e-commerce banners
* social media ads
* store offer displays
* digital marketing creatives

Recommended layout balance:

* 65–75% product focus
* 20–30% offer badge prominence
* minimal supporting effects around edges

Ensure the product remains fully visible and centered as the hero element.
IMPORTANT RULES

* Use ONLY the uploaded image as the product reference
* Do NOT invent or modify the brand identity
* Do NOT change packaging design
* Do NOT add fake claims, pricing, or benefits
* Keep all branding accurate and intact
* Output must look like a professional transparent PNG product cutout advertisement

The final result should be a clean, premium, 3D-style promotional product visual ready for direct use in marketing materials.`;
function imageUploadFieldMarkup(previewId,initialPreviewHtml='',extraPreviewClass=''){
  return `<div class="field local-image-field"><label>Product image <small>(optional · large images are compressed automatically)</small></label><div class="image-guide-tabs"><button type="button" class="image-guide-tab active" data-guide-tab="upload">Upload Photo</button><button type="button" class="image-guide-tab" data-guide-tab="ai">✨ AI Image Guide</button></div><div class="image-guide-panel" data-guide-panel="upload"><input name="imageFile" type="file" accept="image/jpeg,image/png,image/webp"><div class="image-preview ${extraPreviewClass}" id="${previewId}">${initialPreviewHtml}</div></div><div class="image-guide-panel hidden" data-guide-panel="ai">${aiImageGuideMarkup()}</div></div>`;
}
function aiImageGuideMarkup(){
  return `<ol class="image-guide-steps"><li>Open <a href="https://chatgpt.com" target="_blank" rel="noopener noreferrer">ChatGPT</a> in a new tab (sign in if it asks).</li><li>Start a new chat and upload a plain photo of your product.</li><li>Tap <strong>Copy Prompt</strong> below, then paste it into the same chat.</li><li>In the pasted text, replace <code>{{OFFER_PERCENTAGE}}</code> with your discount (e.g. 20%) and <code>{{OFFER_TEXT}}</code> with a short offer line — or delete that line if you don't need one.</li><li>Send it. ChatGPT will generate a premium transparent-background product image with an offer badge.</li><li>Download the image, switch back to <strong>Upload Photo</strong> above, and upload it here.</li></ol><button type="button" class="btn small green" data-copy-ai-prompt>📋 Copy Prompt</button>`;
}
function bindImageGuideTabs(scope){
  $$('[data-guide-tab]',scope).forEach(tab=>tab.onclick=()=>{
    $$('[data-guide-tab]',scope).forEach(item=>item.classList.toggle('active',item===tab));
    $$('[data-guide-panel]',scope).forEach(panel=>panel.classList.toggle('hidden',panel.dataset.guidePanel!==tab.dataset.guideTab));
  });
  $('[data-copy-ai-prompt]',scope)?.addEventListener('click',async()=>{
    try{await navigator.clipboard.writeText(AI_IMAGE_PROMPT);toast('Prompt copied — paste it into ChatGPT')}
    catch{toast('Could not copy automatically — select and copy the prompt manually')}
  });
}
let brandSession=null,brandProfile=null,brandRequests=[],pendingBrandTarget=null;
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
function doorstepBookingOwnerMarkup(booking){
  if(!booking.doorstepServiceEnabled)return'';
  const location=booking.locationUrl?`<a href="${html(booking.locationUrl)}" target="_blank" rel="noopener">📍 View doorstep location</a>`:'<span class="muted">Waiting for customer location</span>';
  const shareLabel=booking.expertPhone?`Send to ${html(booking.expertName||'Expert')}`:'Share with Expert';
  return `<div class="delivery-block doorstep-booking-block"><div class="delivery-info"><strong>🏠 Doorstep Service</strong>${location}${booking.phone?`<span>📞 ${html(booking.phone)}</span>`:''}</div>${booking.locationUrl?`<button type="button" class="btn small whatsapp-btn" data-share-booking-expert="${html(booking.id)}">${WHATSAPP_ICON_SVG} ${shareLabel}</button>`:''}</div>`;
}
function shareBookingWithExpert(booking){
  if(!booking?.locationUrl)return toast('The customer has not shared a service location yet');
  const message=[
    `Doorstep service: ${booking.serviceName||'Service'}`,
    `Customer: ${customerNameFor(booking)}`,
    booking.phone?`Contact: ${booking.phone}`:'',
    booking.date&&booking.startTime?`Schedule: ${booking.date} at ${booking.startTime}`:'',
    `Location: ${booking.locationUrl}`,
  ].filter(Boolean).join('\n');
  const direct=whatsappLink(booking.expertPhone,message);
  window.open(direct||`https://wa.me/?text=${encodeURIComponent(message)}`,'_blank','noopener');
}
function bindBookingExpertShareButtons(bookings){
  $$('[data-share-booking-expert]').forEach(button=>button.onclick=()=>{
    const booking=bookings.find(row=>row.id===button.dataset.shareBookingExpert);
    if(booking)shareBookingWithExpert(booking);
  });
}

let session=null,view='dashboard';
let refreshView=()=>renderShell();
let entitlement=null,myRequest=null,myStoreRequest=null,digit58Pricing={monthly:399};
const DIGIT58_PLAN_PERIODS=[{id:'6m',label:'6 Months',months:6,discount:0},{id:'1y',label:'1 Year',months:12,discount:5},{id:'3y',label:'3 Years',months:36,discount:10}];
function digit58PlanAmount(monthly,period){return Math.round(Number(monthly)*Number(period.months)*(1-Number(period.discount)/100))}
function storeSlotsAllowed(){return Math.max(1,Number(entitlement?.storeSlots)||1)}
let state={activeStoreId:'',stores:[],customers:[],cards:[],orders:[],promotions:[],cardPurchases:[],brandRequests:[]};
function save(){try{localStorage.setItem('gravity58Digit58',JSON.stringify(state))}catch{}}
function load(){try{return {...state,...JSON.parse(localStorage.getItem('gravity58Digit58')||'{}')}}catch{return state}}
state=load();

let orderAlertTimer=null,orderAlertContext=null;
// Browsers block AudioContext playback until a real user gesture has
// occurred on the page — without this, the very first alert of a
// session can fail silently if an order/booking arrives before the
// owner has clicked anything. Unlock it proactively on first interaction.
// iOS Safari is stricter than desktop/Android: resume() alone can leave
// the context reporting "running" while still producing no sound, and it
// re-suspends whenever the tab is backgrounded — so we also play a
// silent buffer inline with the gesture (the standard WebKit unlock
// trick) and re-resume on every return to the tab.
function unlockOrderAlertAudio(){
  try{
    orderAlertContext||=new (window.AudioContext||window.webkitAudioContext)();
    if(orderAlertContext.state==='suspended')orderAlertContext.resume();
    const buffer=orderAlertContext.createBuffer(1,1,22050);
    const source=orderAlertContext.createBufferSource();
    source.buffer=buffer;
    source.connect(orderAlertContext.destination);
    source.start(0);
  }catch{}
}
['pointerdown','touchstart','touchend','click','keydown'].forEach(type=>document.addEventListener(type,unlockOrderAlertAudio,{passive:true,once:true}));
document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible')unlockOrderAlertAudio()});
window.addEventListener('pageshow',unlockOrderAlertAudio);
const ringingIds=new Set();
let knownOrderIds=new Set(),knownBuyRequestIds=new Set(),knownBookingIds=new Set();
let ownerOrdersUnsubscribe=null,ownerCardsUnsubscribe=null,ownerPromotionsUnsubscribe=null,ownerBookingsUnsubscribe=null;
const knownMessageCounts=new Map();
function checkForNewMessages(rows,otherRole){
  let heard=false;
  for(const row of rows||[]){
    const messages=row.messages||[];
    const prevCount=knownMessageCounts.has(row.id)?knownMessageCounts.get(row.id):messages.length;
    if(messages.length>prevCount){
      const newest=messages[messages.length-1];
      if(newest&&newest.senderRole===otherRole)heard=true;
    }
    knownMessageCounts.set(row.id,messages.length);
  }
  return heard;
}
function playChatMessageBeep(){orderAlertBeep(.14,720)}
function orderAlertBeep(duration=.18,frequency=880){
  try{
    orderAlertContext||=new (window.AudioContext||window.webkitAudioContext)();
    if(orderAlertContext.state==='suspended')orderAlertContext.resume();
    const oscillator=orderAlertContext.createOscillator(),gain=orderAlertContext.createGain(),start=orderAlertContext.currentTime;
    oscillator.frequency.value=frequency;gain.gain.setValueAtTime(.0001,start);gain.gain.exponentialRampToValueAtTime(.16,start+.015);gain.gain.exponentialRampToValueAtTime(.0001,start+duration);
    oscillator.connect(gain);gain.connect(orderAlertContext.destination);oscillator.start(start);oscillator.stop(start+duration+.02);
  }catch(error){console.warn('Audio alert unavailable',error)}
}
function playTelephoneRingBurst(){
  try{
    orderAlertContext||=new (window.AudioContext||window.webkitAudioContext)();
    if(orderAlertContext.state==='suspended')orderAlertContext.resume();
    const ctx=orderAlertContext,start=ctx.currentTime,duration=.4;
    [440,480].forEach(frequency=>{
      const oscillator=ctx.createOscillator(),gain=ctx.createGain();
      oscillator.type='sine';oscillator.frequency.value=frequency;
      gain.gain.setValueAtTime(.0001,start);
      gain.gain.exponentialRampToValueAtTime(.4,start+.04);
      gain.gain.setValueAtTime(.4,start+duration-.06);
      gain.gain.exponentialRampToValueAtTime(.0001,start+duration);
      oscillator.connect(gain);gain.connect(ctx.destination);
      oscillator.start(start);oscillator.stop(start+duration+.02);
    });
  }catch(error){console.warn('Ring unavailable',error)}
}
function playOwnerNotificationChime(){
  try{
    orderAlertContext||=new (window.AudioContext||window.webkitAudioContext)();
    if(orderAlertContext.state==='suspended')orderAlertContext.resume();
    const ctx=orderAlertContext,start=ctx.currentTime;
    [{frequency:880,at:0,duration:.3},{frequency:659.25,at:.16,duration:.4}].forEach(note=>{
      const oscillator=ctx.createOscillator(),gain=ctx.createGain(),noteStart=start+note.at;
      oscillator.type='sine';oscillator.frequency.value=note.frequency;
      gain.gain.setValueAtTime(.0001,noteStart);
      gain.gain.exponentialRampToValueAtTime(.28,noteStart+.02);
      gain.gain.exponentialRampToValueAtTime(.0001,noteStart+note.duration);
      oscillator.connect(gain);gain.connect(ctx.destination);
      oscillator.start(noteStart);oscillator.stop(noteStart+note.duration+.02);
    });
  }catch(error){console.warn('Chime unavailable',error)}
}
function ownerPortalIsActive(){return document.visibilityState==='visible'&&document.hasFocus()}
function updateOrderAlertSound(){
  [...ringingIds].forEach(id=>{
    const stillRinging=state.orders.some(row=>row.id===id&&['Requested','Minimum Approval Requested'].includes(row.status))
      ||state.cards.some(row=>row.id===id&&row.status==='Buy Requested')
      ||(state.bookings||[]).some(row=>row.id===id&&['Requested','Pending Payment'].includes(row.status));
    if(!stillRinging)ringingIds.delete(id);
  });
  if(!ringingIds.size){if(orderAlertTimer)clearInterval(orderAlertTimer);orderAlertTimer=null;return}
  if(!orderAlertTimer){
    playOwnerNotificationChime();pendingAlertReplay=playOwnerNotificationChime;
    orderAlertTimer=setInterval(()=>{if(ringingIds.size&&!ownerPortalIsActive()){playOwnerNotificationChime();pendingAlertReplay=playOwnerNotificationChime}},3500);
  }
}
const dueReminderRung=new Set();
let pendingDueBeep=false;
function ringDueReminders(cards){
  const dueIds=cards.filter(isCardDue).map(card=>card.id);
  const newlyDue=dueIds.filter(id=>!dueReminderRung.has(id));
  dueIds.forEach(id=>dueReminderRung.add(id));
  if(newlyDue.length){orderAlertBeep(.22,660);pendingDueBeep=true}
}
document.addEventListener('pointerdown',()=>{if(pendingDueBeep){orderAlertBeep(.22,660);pendingDueBeep=false}},{passive:true});
let pendingAlertReplay=null;
document.addEventListener('pointerdown',()=>{if(pendingAlertReplay){const fn=pendingAlertReplay;pendingAlertReplay=null;fn()}},{passive:true});
let incomingCallTimer=null;
function playIncomingCallRing(){playTelephoneRingBurst();setTimeout(playTelephoneRingBurst,550);pendingAlertReplay=playTelephoneRingBurst}
function stopIncomingCallRing(){if(incomingCallTimer){clearInterval(incomingCallTimer);incomingCallTimer=null}$('.incoming-call-overlay')?.remove();pendingAlertReplay=null}
function bindSlideToView(wrap,onComplete){
  const track=wrap.querySelector('.slide-to-view-track'),thumb=wrap.querySelector('.slide-to-view-thumb');
  let dragging=false,startClientX=0,startX=0,maxX=0,done=false;
  const setX=x=>{thumb.style.transform=`translateX(${x}px)`;track.style.setProperty('--slide-progress',maxX>0?x/maxX:0);thumb.setAttribute('aria-valuenow',String(Math.round((maxX>0?x/maxX:0)*100)))};
  const complete=()=>{if(done)return;done=true;maxX=track.clientWidth-thumb.offsetWidth-8;setX(Math.max(0,maxX));onComplete()};
  const pointerX=event=>(event.touches?event.touches[0]:event).clientX;
  const onDown=event=>{
    if(done)return;
    dragging=true;startClientX=pointerX(event);
    const current=/translateX\(([-\d.]+)px\)/.exec(thumb.style.transform);
    startX=current?parseFloat(current[1]):0;
    maxX=track.clientWidth-thumb.offsetWidth-8;
    thumb.setPointerCapture?.(event.pointerId);
  };
  const onMove=event=>{
    if(!dragging||done)return;
    const x=Math.max(0,Math.min(maxX,startX+(pointerX(event)-startClientX)));
    setX(x);
  };
  const onUp=()=>{
    if(!dragging||done)return;
    dragging=false;
    const current=/translateX\(([-\d.]+)px\)/.exec(thumb.style.transform);
    const x=current?parseFloat(current[1]):0;
    if(maxX>0&&x>=maxX*.8)complete()
    else setX(0);
  };
  thumb.setAttribute('role','slider');thumb.setAttribute('aria-valuemin','0');thumb.setAttribute('aria-valuemax','100');thumb.setAttribute('aria-valuenow','0');
  thumb.addEventListener('pointerdown',onDown);
  thumb.addEventListener('pointermove',onMove);
  thumb.addEventListener('pointerup',onUp);
  thumb.addEventListener('pointercancel',onUp);
  thumb.addEventListener('keydown',event=>{
    if(!['ArrowRight','End','Enter',' '].includes(event.key))return;
    event.preventDefault();maxX=track.clientWidth-thumb.offsetWidth-8;
    if(['End','Enter',' '].includes(event.key))return complete();
    const current=/translateX\(([-\d.]+)px\)/.exec(thumb.style.transform),x=Math.min(maxX,(current?parseFloat(current[1]):0)+Math.max(24,maxX*.2));
    setX(x);if(maxX>0&&x>=maxX*.8)complete();
  });
}
function customerPortalRecordId(type,recordId){return `customer-${type}-${recordId}`}
function focusCustomerPortalRecord(type,recordId){
  setTimeout(()=>{
    const target=document.getElementById(customerPortalRecordId(type,recordId));if(!target)return;
    target.scrollIntoView({behavior:'smooth',block:'center'});target.classList.add('slide-open-highlight');
    setTimeout(()=>target.classList.remove('slide-open-highlight'),2400);
  },80);
}
function showIncomingOrderCall(store,customer,message,{title='Order placed!',hint='Slide to view order',type='order',recordId=''}={}){
  if($('.incoming-call-overlay'))return false;
  stopIncomingCallRing();
  const wrap=document.createElement('div');
  wrap.className='incoming-call-overlay';
  wrap.innerHTML=`<div class="incoming-call-card"><div class="incoming-call-rings"><span></span><span></span><span></span><div class="incoming-call-avatar"><svg viewBox="0 0 120 120" fill="none" stroke="#7fffd4" stroke-width="8" aria-hidden="true"><circle cx="60" cy="26" r="15"/><circle cx="28" cy="82" r="15"/><circle cx="92" cy="82" r="15"/></svg></div></div><h2>${html(title)}</h2><p class="muted">${html(store.name)}</p><div class="slide-to-view"><div class="slide-to-view-track"><span class="slide-to-view-label">${html(hint)}</span><button type="button" class="slide-to-view-thumb" aria-label="${html(hint)}"><svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M8.59 16.59 13.17 12 8.59 7.41 10 6l6 6-6 6z"/></svg></button></div></div></div>`;
  document.body.appendChild(wrap);
  playIncomingCallRing();
  pendingAlertReplay=null;
  bindSlideToView(wrap,()=>{
    stopIncomingCallRing();
    if(message)toast(message);
    Promise.resolve(loadAndRenderCustomerView(store,customer)).then(()=>recordId&&focusCustomerPortalRecord(type,recordId));
  });
  return true;
}
const shownCustomerPortalAlerts=new Set();
function customerPortalAlertKey(customer,type,recordId){return `g58-customer-incoming-alert:${customer.customerAccountId}:${type}:${recordId}`}
function customerPortalAlertWasShown(customer,type,recordId){const key=customerPortalAlertKey(customer,type,recordId);if(shownCustomerPortalAlerts.has(key))return true;try{return localStorage.getItem(key)==='1'}catch{return false}}
function markCustomerPortalAlertShown(customer,type,recordId){const key=customerPortalAlertKey(customer,type,recordId);shownCustomerPortalAlerts.add(key);try{localStorage.setItem(key,'1')}catch{}}
function newestRecord(records){return [...records].sort((a,b)=>new Date(b.updatedAt||b.createdAt||0)-new Date(a.updatedAt||a.createdAt||0))[0]}
function ringCustomerPortalUpdates(store,customer,orders=[],bookings=[]){
  if($('.incoming-call-overlay'))return;
  const incomingOrder=newestRecord(orders.filter(row=>row.status==='Pending Customer Acceptance'&&!customerPortalAlertWasShown(customer,'order',row.id)));
  if(incomingOrder){
    if(showIncomingOrderCall(store,customer,'New order from the store — review and accept or reject it on the order card.',{title:'Incoming order!',hint:'Slide to open order',type:'order',recordId:incomingOrder.id}))markCustomerPortalAlertShown(customer,'order',incomingOrder.id);
    return;
  }
  const incomingBooking=newestRecord((bookings||[]).filter(row=>row.status==='Pending Customer Acceptance'&&!customerPortalAlertWasShown(customer,'booking',row.id)));
  if(incomingBooking){
    if(showIncomingOrderCall(store,customer,'New booking from the store — review and accept or reject it on the booking card.',{title:'Incoming booking!',hint:'Slide to open booking',type:'booking',recordId:incomingBooking.id}))markCustomerPortalAlertShown(customer,'booking',incomingBooking.id);
  }
}
async function acceptOwnerOrder(store,customer,orderId){
  try{
    await api.executeFunction(api.config.digitalOrderFunctionId,{action:'digit58-accept-owner-order',ownerId:store.ownerId,orderId});
    toast('Order accepted — the store will now review and set the amount');
    await loadAndRenderCustomerView(store,customer);
  }catch(error){toast(error.message||'Could not accept the order')}
}
async function rejectOwnerOrder(store,customer,orderId){
  if(!confirm('Reject this order from the store?'))return;
  customerSuppressedRejectionIds.add(orderId);
  try{
    await api.executeFunction(api.config.digitalOrderFunctionId,{action:'digit58-reject-owner-order',ownerId:store.ownerId,orderId});
    toast('Order rejected');
    await loadAndRenderCustomerView(store,customer);
  }catch(error){customerSuppressedRejectionIds.delete(orderId);toast(error.message||'Could not reject the order')}
}
async function acceptOwnerBooking(store,customer,bookingId){
  try{
    await api.executeFunction(api.config.digitalOrderFunctionId,{action:'digit58-accept-owner-booking',ownerId:store.ownerId,bookingId});
    toast('Booking accepted — continue to confirm your slot');
    await loadAndRenderCustomerView(store,customer);
  }catch(error){toast(error.message||'Could not accept the booking')}
}
async function rejectOwnerBooking(store,customer,bookingId){
  if(!confirm('Reject this booking from the store?'))return;
  try{
    await api.executeFunction(api.config.digitalOrderFunctionId,{action:'digit58-reject-owner-booking',ownerId:store.ownerId,bookingId});
    toast('Booking rejected');
    await loadAndRenderCustomerView(store,customer);
  }catch(error){toast(error.message||'Could not reject the booking')}
}
let medicineAlarmTimer=null,customerCoursesCache=[];
const medicineAlarmRung=new Set();
function medicineAlarmKey(medicineId){return `${medicineId}:${indiaDateValue()}`}
function startMedicineAlarmTimer(store,customer){
  stopMedicineAlarmTimer();
  if(!isMedicalStore(store))return;
  medicineAlarmTimer=setInterval(()=>checkMedicineAlarms(store,customer),20000);
}
function stopMedicineAlarmTimer(){if(medicineAlarmTimer){clearInterval(medicineAlarmTimer);medicineAlarmTimer=null}}
function isWithinAlarmWindow(scheduledTime,nowTime,windowMinutes=5){
  const [sh,sm]=scheduledTime.split(':').map(Number),[nh,nm]=nowTime.split(':').map(Number);
  if([sh,sm,nh,nm].some(Number.isNaN))return false;
  const scheduledMinutes=sh*60+sm,nowMinutes=nh*60+nm;
  return nowMinutes>=scheduledMinutes&&nowMinutes<scheduledMinutes+windowMinutes;
}
function checkMedicineAlarms(store,customer){
  if($('.incoming-call-overlay')||$('.modal-backdrop'))return;
  const nowTime=indiaTimeValue();
  for(const course of customerCoursesCache){
    for(const medicine of course.medicines||[]){
      if(isMedicineComplete(medicine))continue;
      const key=medicineAlarmKey(medicine.id);
      if(medicineAlarmRung.has(key))continue;
      if(medicine.time&&isWithinAlarmWindow(medicine.time,nowTime)){
        medicineAlarmRung.add(key);
        showMedicineAlarm(store,customer,course,medicine);
        return;
      }
    }
  }
}
function showMedicineAlarm(store,customer,course,medicine){
  stopIncomingCallRing();
  const wrap=document.createElement('div');
  wrap.className='incoming-call-overlay';
  wrap.innerHTML=`<div class="incoming-call-card"><div class="incoming-call-rings"><span></span><span></span><span></span><div class="incoming-call-avatar medicine-alarm-avatar" aria-hidden="true">💊</div></div><h2>Medicine time!</h2><p class="muted">${html(medicine.name)} for ${html(course.patientName)}</p><button type="button" class="incoming-call-accept-btn" aria-label="Accept"><svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M6.6 10.8c1.5 3 3.9 5.4 6.9 6.9l2.3-2.3c.3-.3.7-.4 1-.2 1.1.4 2.3.6 3.5.6.6 0 1 .4 1 1V20c0 .6-.4 1-1 1C10.6 21 3 13.4 3 4c0-.6.4-1 1-1h3.2c.6 0 1 .4 1 1 0 1.2.2 2.4.6 3.5.1.4 0 .8-.2 1L6.6 10.8z"/></svg></button><p class="incoming-call-hint">Tap to mark as taken</p></div>`;
  document.body.appendChild(wrap);
  playIncomingCallRing();
  incomingCallTimer=setInterval(playIncomingCallRing,1900);
  wrap.querySelector('.incoming-call-accept-btn').onclick=()=>{
    stopIncomingCallRing();
    toast(`${medicine.name} marked as taken for today`);
    checkMedicineAlarms(store,customer);
  };
}
let bookingReminderTimer=null,customerBookingsCache=[];
const bookingReminderRung=new Set();
function bookingReminderKey(bookingId){return `${bookingId}:${indiaDateValue()}`}
function startBookingReminderTimer(store,customer){
  stopBookingReminderTimer();
  if(!isServiceStore(store))return;
  bookingReminderTimer=setInterval(()=>checkBookingReminders(store,customer),20000);
}
function stopBookingReminderTimer(){if(bookingReminderTimer){clearInterval(bookingReminderTimer);bookingReminderTimer=null}}
function isApproachingTime(scheduledTime,nowTime,leadMinutes=15){
  const [sh,sm]=scheduledTime.split(':').map(Number),[nh,nm]=nowTime.split(':').map(Number);
  if([sh,sm,nh,nm].some(Number.isNaN))return false;
  const scheduledMinutes=sh*60+sm,nowMinutes=nh*60+nm;
  return nowMinutes>=scheduledMinutes-leadMinutes&&nowMinutes<scheduledMinutes;
}
function checkBookingReminders(store,customer){
  if($('.incoming-call-overlay')||$('.modal-backdrop'))return;
  const today=indiaDateValue(),nowTime=indiaTimeValue();
  for(const booking of customerBookingsCache){
    if(booking.status!=='Confirmed'||booking.date!==today)continue;
    const key=bookingReminderKey(booking.id);
    if(bookingReminderRung.has(key))continue;
    if(booking.startTime&&isApproachingTime(booking.startTime,nowTime)){
      bookingReminderRung.add(key);
      showBookingReminder(store,customer,booking);
      return;
    }
  }
}
function showBookingReminder(store,customer,booking){
  stopIncomingCallRing();
  const wrap=document.createElement('div');
  wrap.className='incoming-call-overlay';
  wrap.innerHTML=`<div class="incoming-call-card"><div class="incoming-call-rings"><span></span><span></span><span></span><div class="incoming-call-avatar medicine-alarm-avatar" aria-hidden="true">📅</div></div><h2>Booking time approaching!</h2><p class="muted">${html(booking.serviceName)} at ${html(booking.startTime)}${booking.expertName?` with ${html(booking.expertName)}`:''}</p><button type="button" class="incoming-call-accept-btn" aria-label="Dismiss"><svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M6.6 10.8c1.5 3 3.9 5.4 6.9 6.9l2.3-2.3c.3-.3.7-.4 1-.2 1.1.4 2.3.6 3.5.6.6 0 1 .4 1 1V20c0 .6-.4 1-1 1C10.6 21 3 13.4 3 4c0-.6.4-1 1-1h3.2c.6 0 1 .4 1 1 0 1.2.2 2.4.6 3.5.1.4 0 .8-.2 1L6.6 10.8z"/></svg></button><p class="incoming-call-hint">Tap to dismiss</p></div>`;
  document.body.appendChild(wrap);
  playIncomingCallRing();
  pendingAlertReplay=null;
  wrap.querySelector('.incoming-call-accept-btn').onclick=()=>stopIncomingCallRing();
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
  knownBookingIds=new Set((state.bookings||[]).map(row=>row.id));
  ownerOrdersUnsubscribe?.();
  ownerOrdersUnsubscribe=api.subscribeKind(orderKind(ownerId),()=>refreshOwnerOrdersRealtime());
  ownerCardsUnsubscribe?.();
  ownerCardsUnsubscribe=api.subscribeKind(cardKind(ownerId),()=>refreshOwnerCardsRealtime());
  ownerPromotionsUnsubscribe?.();
  ownerPromotionsUnsubscribe=api.subscribeKind(promotionKind(ownerId),()=>refreshOwnerPromotionsRealtime());
  ownerBookingsUnsubscribe?.();
  ownerBookingsUnsubscribe=api.subscribeKind(bookingKind(ownerId),()=>refreshOwnerBookingsRealtime());
}
function stopOwnerRealtime(){ownerOrdersUnsubscribe?.();ownerCardsUnsubscribe?.();ownerPromotionsUnsubscribe?.();ownerBookingsUnsubscribe?.();ownerOrdersUnsubscribe=ownerCardsUnsubscribe=ownerPromotionsUnsubscribe=ownerBookingsUnsubscribe=null;ringingIds.clear();knownOrderIds.clear();knownBuyRequestIds.clear();knownBookingIds.clear();knownMessageCounts.clear();updateOrderAlertSound()}
async function refreshOwnerOrdersRealtime(){
  const ownerId=cloudOwnerId();if(!ownerId)return;
  const orders=await api.list(orderKind(ownerId)).catch(()=>null);
  if(!orders)return;
  let isNew=false;
  orders.forEach(order=>{if(['Requested','Minimum Approval Requested'].includes(order.status)&&!knownOrderIds.has(order.id)){ringingIds.add(order.id);isNew=true}knownOrderIds.add(order.id)});
  state.orders=orders;save();
  updateOrderAlertSound();
  if(checkForNewMessages(orders,'customer'))playChatMessageBeep();
  if(isNew)toast('🔔 New order or minimum approval request received');
  if(!$('.modal-backdrop'))refreshView();
}
async function refreshOwnerBookingsRealtime(){
  const ownerId=cloudOwnerId();if(!ownerId)return;
  const bookings=await api.list(bookingKind(ownerId)).catch(()=>null);
  if(!bookings)return;
  let isNew=false;
  bookings.forEach(booking=>{if(['Requested','Pending Payment'].includes(booking.status)&&!knownBookingIds.has(booking.id)){ringingIds.add(booking.id);isNew=true}knownBookingIds.add(booking.id)});
  state.bookings=bookings;save();
  updateOrderAlertSound();
  if(checkForNewMessages(bookings,'customer'))playChatMessageBeep();
  if(isNew)toast('🔔 New booking received');
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
  if(checkForNewMessages(cards,'customer'))playChatMessageBeep();
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
async function resumeLastCustomerStore(){
  const account=await api.currentUser().catch(()=>null);
  if(!account)return false;
  try{
    const result=await api.executeFunction(api.config.digitalOrderFunctionId,{action:'digit58-list-customer-stores'});
    const stores=result?.stores||[];
    if(!stores.length)return false;
    const mostRecent=[...stores].sort((a,b)=>new Date(b.lastLoginAt||0)-new Date(a.lastLoginAt||0))[0];
    location.hash=`store&owner=${encodeURIComponent(mostRecent.ownerId)}&store=${encodeURIComponent(mostRecent.storeId)}`;
    return true;
  }catch{return false}
}
function renderCustomerPortalLanding(){
  app.innerHTML=`<main class="screen"><section class="auth-card">
    <a class="brand" href="../"><svg class="brand-mark" viewBox="0 0 120 120" fill="none" stroke="#7fffd4" stroke-width="8" aria-hidden="true"><circle cx="60" cy="26" r="15"/><circle cx="28" cy="82" r="15"/><circle cx="92" cy="82" r="15"/></svg><div><h2>G58 Refills</h2><p class="tagline">Your orders and reminder cards, from the stores you shop with.</p></div></a>
    <div class="card"><p class="muted">Open the link your store shared with you — by WhatsApp message or QR code — to sign in and see your orders and reminders here.</p><button class="btn full" id="pasteStoreLinkBtn" style="margin-top:12px">Paste Store Link</button></div>
  </section></main>${siteFooter(true)}`;
  $('#pasteStoreLinkBtn').onclick=()=>openPasteStoreLinkPrompt();
}
async function boot(){
  if(!api?.configured)return renderConfigError();
  captureRazorpaySuccessfulReturn();
  const hash=new URLSearchParams(location.hash.replace(/^#store&?/,''));
  if(location.hash.startsWith('#store&'))return renderPublicStore(hash);
  if(location.hash.startsWith('#brand'))return bootBrand();
  if(isRefillsCustomerApp()){
    if(await resumeLastCustomerStore())return boot();
    return renderCustomerPortalLanding();
  }
  session=await api.currentUser().catch(()=>null);
  if(!session)return renderOwnerAuth();
  await loadEntitlement();
  if(!hasActiveEntitlement())return renderPlanGate();
  await proceedAfterEntitlement();
}
let entitlementStatusTimer=null;
function stopEntitlementStatusPolling(){
  if(entitlementStatusTimer){clearInterval(entitlementStatusTimer);entitlementStatusTimer=null}
}
function startEntitlementStatusPolling(){
  stopEntitlementStatusPolling();
  entitlementStatusTimer=setInterval(async()=>{
    const previousStatus=myRequest?.status||'';
    try{
      await loadEntitlement();
      if(hasActiveEntitlement()){
        stopEntitlementStatusPolling();
        toast('Your Refills access is active');
        return proceedAfterEntitlement();
      }
      if((myRequest?.status||'')!==previousStatus)renderPlanGate();
    }catch(error){console.warn('Refills activation status could not be refreshed',error)}
  },Number(window.G58EntitlementRefreshMs)||8000);
}
async function startDigit58FreeTrial(){
  const button=$('#startTrialBtn');if(button)button.disabled=true;
  const ownerId=cloudOwnerId();
  try{
    if(myRequest&&['Requested','Payment Link Sent'].includes(myRequest.status))throw new Error('Your Refills access request is already waiting for G58 approval.');
    const record={
      id:id('req'),ownerId,ownerEmail:session?.email||'',ownerName:session?.name||session?.email?.split('@')[0]||'Store Owner',
      amount:0,status:'Requested',type:'free-trial',plan:'trial',periodLabel:'1 Month',months:1,
      paymentLink:'',createdAt:now(),updatedAt:now(),
    };
    const referredByCode=localStorage.getItem('g58ReferredByCode');
    if(referredByCode)record.referredByCode=referredByCode;
    myRequest=await api.create(REQUEST_KIND,record,record.id,api.permissionSet?.(REQUEST_KIND,ownerId,true)||api.collaborativePermissionSet(ownerId));
    renderPlanGate();
    toast('Free-trial request sent to the G58 admin for approval');
  }catch(error){if(button)button.disabled=false;toast(error.message||'Could not request your free trial')}
}
async function startDigit58Subscription(periodId){
  const period=DIGIT58_PLAN_PERIODS.find(row=>row.id===periodId);if(!period)return;
  const button=document.querySelector(`[data-subscribe-plan="${periodId}"]`);if(button)button.disabled=true;
  try{
    const referredByCode=entitlement?'':(localStorage.getItem('g58ReferredByCode')||'');
    const result=await api.executeFunction(api.config.digitalOrderFunctionId,{action:'digit58-create-subscription-checkout',ownerId:cloudOwnerId(),periodId,ownerEmail:session?.email||'',ownerName:session?.name||'',referredByCode});
    if(!window.Razorpay)throw new Error('Payment could not start. Reload the page and try again.');
    const checkout=new window.Razorpay({
      key:result.razorpayKeyId,subscription_id:result.subscriptionId,
      name:'Refills by G58',description:`Refills Store Access — ${period.label}`,
      theme:{color:'#2dd4a8'},prefill:{email:session?.email||'',name:session?.name||''},
      handler:async()=>{toast('Payment authorized — confirming your subscription...');await pollDigit58SubscriptionActivation()},
      modal:{ondismiss:()=>{if(button)button.disabled=false}},
    });
    checkout.open();
  }catch(error){if(button)button.disabled=false;toast(error.message||'Could not start checkout')}
}
async function pollDigit58SubscriptionActivation(attempt=0){
  await loadEntitlement();
  if(hasActiveEntitlement())return proceedAfterEntitlement();
  if(attempt>=10){toast('Still confirming with Razorpay — reload this page in a minute.');return renderPlanGate()}
  await new Promise(resolve=>setTimeout(resolve,2000));
  return pollDigit58SubscriptionActivation(attempt+1);
}
const DIGIT58_POLICY_TEXT='Refills generates a payment QR code from the UPI ID you provide, to help you collect payment from your customers. G58 only facilitates this QR generation — we are not a party to any payment and are not responsible for any fraud, dispute or disagreement between you and your customer. Please verify payments independently before fulfilling any order. G58 keeps order and booking history for a maximum of 1 year. A backup warning appears during the final 30 days; history is permanently removed at the retention deadline. You may download a CSV and permanently delete closed history earlier after confirming your current password. Active work and customer login accounts are not deleted by that control. After a store subscription expires, owner-linked customer records receive a 30-day buffer and are then permanently removed.';
const DIGIT58_CUSTOMER_AGREEMENT_TEXT='By continuing, you agree that this store — not G58 — is responsible for its products, pricing, offers, stock, and order fulfillment. Any payment you make (by UPI QR code or payment link shown on your order) goes directly to the store; G58 only provides this ordering platform and does not process, hold, or verify these payments. Before you pay, always confirm the amount matches your order and that the QR code or payment link genuinely belongs to this store. G58 is not responsible for any payment error, fraud, delay, or dispute between you and the store. For any issue with your order or payment, contact the store directly using the Support button in this portal.';
async function proceedAfterEntitlement(){
  stopEntitlementStatusPolling();
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
  const [entitlements,requests,pricingRows]=await Promise.all([
    api.list(ENTITLEMENT_KIND).catch(()=>[]),
    api.list(REQUEST_KIND).catch(()=>[]),
    api.list('digit58_pricing').catch(()=>[]),
  ]);
  entitlement=entitlements.find(row=>row.ownerId===ownerId)||null;
  const ownerRequests=requests.filter(row=>row.ownerId===ownerId).sort((a,b)=>new Date(b.createdAt)-new Date(a.createdAt));
  myRequest=ownerRequests.find(row=>row.type!=='additional-store')||null;
  myStoreRequest=ownerRequests.find(row=>row.type==='additional-store')||null;
  const pricingRow=pricingRows.find(row=>(row.id||row.$id)==='default')||{};
  digit58Pricing={monthly:Number(pricingRow.monthly)||SUBSCRIPTION_AMOUNT};
}
function hasActiveEntitlement(){
  if(!entitlement||!entitlement.active||entitlement.paused)return false;
  if(entitlement.expiresAt&&new Date(entitlement.expiresAt).getTime()<Date.now())return false;
  return true;
}
function renderPlanGate(){
  const requestStatus=myRequest?.status||'';
  const pendingAccessRequest=['Requested','Payment Link Sent'].includes(requestStatus);
  const pendingTrial=myRequest?.type==='free-trial'&&pendingAccessRequest;
  const approvedTrial=myRequest?.type==='free-trial'&&requestStatus==='Activated';
  const rejectedTrial=myRequest?.type==='free-trial'&&requestStatus==='Rejected';
  const expired=!!(entitlement&&entitlement.expiresAt&&new Date(entitlement.expiresAt).getTime()<Date.now());
  const paused=!!entitlement?.paused;
  const repairableInactiveTrial=!!(entitlement?.freeTrial&&!entitlement.active&&!paused&&!expired);
  const trialEligible=(!entitlement?.trialUsed||repairableInactiveTrial)&&!pendingAccessRequest&&!approvedTrial&&!rejectedTrial;
  const monthly=digit58Pricing.monthly;
  let statusNote='';
  if(paused)statusNote=`<div class="card"><p class="muted">Your store subscription is currently paused by the G58 team. Contact G58 support to resume access.</p></div>`;
  else if(expired){const graceEnds=new Date(new Date(entitlement.expiresAt).getTime()+30*86400000);statusNote=`<div class="card"><p class="muted">Your ${entitlement?.freeTrial?'free trial has':'subscription has'} ended. Choose a plan below to continue. Owner-linked customer records remain available during a 30-day buffer, until ${graceEnds.toLocaleDateString('en-IN',{dateStyle:'medium'})}, and are then permanently removed.</p></div>`;}
  else if(pendingTrial)statusNote=`<div class="card trial-request-status"><span class="chip due">Approval pending</span><h3>Free-trial request sent</h3><p class="muted">The G58 admin will review and activate your 30-day Refills trial. This page checks the approval automatically; you may also sign in again later.</p><button class="btn secondary full" id="refreshTrialStatus" type="button">Refresh Approval Status</button></div>`;
  else if(approvedTrial)statusNote=`<div class="card trial-request-status"><span class="chip delivered">Approved</span><h3>Finishing your activation</h3><p class="muted">Your trial was approved. Refresh the status to enter your Refills dashboard.</p><button class="btn secondary full" id="refreshTrialStatus" type="button">Refresh Approval Status</button></div>`;
  else if(rejectedTrial)statusNote=`<div class="card trial-request-status"><span class="chip due">Request not approved</span><h3>Contact G58 support</h3><p class="muted">The G58 team could not approve this free-trial request. Contact support if you believe this needs another review.</p></div>`;
  const trialCard=trialEligible?`<article class="plan-card trial">
      <span class="plan-badge">Free Trial</span>
      <h3>1 Month Free</h3>
      <div class="plan-price">₹0<small> for 30 days</small></div>
      <p class="plan-note">Request full store access for 30 days with no payment. The G58 admin reviews and activates every free trial before the store goes live.</p>
      <button class="btn full" id="startTrialBtn" type="button">Request Free Trial</button>
    </article>`:'';
  const planCards=DIGIT58_PLAN_PERIODS.map(period=>{
    const amount=digit58PlanAmount(monthly,period);
    return `<article class="plan-card">
      <span class="plan-badge">${period.discount?`${period.discount}% OFF`:'REFILLS PLAN'}</span>
      <h3>${html(period.label)}</h3>
      <div class="plan-price">${money(amount)}<small> / ${period.label.toLowerCase()}</small></div>
      <p class="plan-note">Renews automatically every ${period.label.toLowerCase()} — the amount is auto-debited from your chosen payment method via Razorpay. Cancel anytime; the current paid period is non-refundable.</p>
      <button class="btn full" data-subscribe-plan="${period.id}" type="button">Subscribe</button>
    </article>`;
  }).join('');
  app.innerHTML=`<main class="screen"><section class="auth-card" style="width:min(760px,100%)"><a class="brand" href="../"><svg class="brand-mark" viewBox="0 0 120 120" fill="none" stroke="#7fffd4" stroke-width="8" aria-hidden="true"><circle cx="60" cy="26" r="15"/><circle cx="28" cy="82" r="15"/><circle cx="92" cy="82" r="15"/></svg><div><h2>Choose your Refills plan</h2><p class="tagline">Start free, or subscribe to keep your store live.</p></div></a>${statusNote}<div class="plan-grid">${trialCard}${planCards}</div><div class="actions" style="margin-top:16px"><button class="btn full" id="refreshAccessStatus" type="button">Refresh Access Status</button><button class="btn secondary full" id="gateLogout">Sign out</button></div></section></main>${siteFooter()}`;
  (typeof bindAndroidAppFooter==='function'&&bindAndroidAppFooter());
  $('#startTrialBtn')?.addEventListener('click',startDigit58FreeTrial);
  $('#refreshTrialStatus')?.addEventListener('click',async()=>{const button=$('#refreshTrialStatus');button.disabled=true;try{await loadEntitlement();if(hasActiveEntitlement())return proceedAfterEntitlement();renderPlanGate();toast('Approval is still pending')}catch(error){button.disabled=false;toast(error.message||'Could not refresh approval status')}});
  $('#refreshAccessStatus').onclick=async()=>{const button=$('#refreshAccessStatus');button.disabled=true;button.textContent='Checking…';try{await loadEntitlement();if(hasActiveEntitlement())return proceedAfterEntitlement();renderPlanGate();toast(myRequest?'Approval is still pending':'No active Refills approval found yet')}catch(error){button.disabled=false;button.textContent='Refresh Access Status';toast(error.message||'Could not refresh access status')}};
  $$('[data-subscribe-plan]').forEach(button=>button.addEventListener('click',()=>startDigit58Subscription(button.dataset.subscribePlan)));
  $('#gateLogout').onclick=async()=>{stopOwnerRealtime();await api.logout();session=null;renderOwnerAuth()};
  startEntitlementStatusPolling();
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
    <span class="chip" style="display:inline-block;margin-bottom:14px">Your first month is free</span>
    <div class="actions" style="margin-bottom:14px"><button class="btn small" id="tabLogin">Sign in</button><button class="btn small secondary" id="tabSignup">Create store account</button></div>
    <form id="ownerAuthForm">
      <div class="field full-name-field hidden"><label>Your name</label><input name="name"></div>
      <div class="field"><label>Email</label><input name="email" type="email" required></div>
      <div class="field"><label>Password</label><input name="password" type="password" minlength="8" required></div>
      <label class="field full-name-field hidden"><span><input name="retentionAccepted" type="checkbox"> I accept the <a href="/terms/" target="_blank" rel="noopener">Terms</a>, including the 1-year order/booking history, password-confirmed CSV backup and permanent deletion policy.</span></label>
      <button class="btn full" id="ownerAuthSubmit" type="submit">Sign In</button>
    </form>
    <p class="muted" style="text-align:center;margin-top:14px">Are you a customer? Use the link your store shared with you, or <a href="#" id="customerPasteLinkLink">paste your store link</a>.</p>
  </section></main>${siteFooter()}`;
  (typeof bindAndroidAppFooter==='function'&&bindAndroidAppFooter());
  $('#customerPasteLinkLink').onclick=event=>{event.preventDefault();openPasteStoreLinkPrompt()};
  let mode='login';
  const syncMode=()=>{$('.full-name-field').classList.toggle('hidden',mode!=='signup');$('#ownerAuthSubmit').textContent=mode==='signup'?'Create Account':'Sign In';$('#tabLogin').className=mode==='login'?'btn small':'btn small secondary';$('#tabSignup').className=mode==='signup'?'btn small':'btn small secondary'};
  $('#tabLogin').onclick=()=>{mode='login';syncMode()};
  $('#tabSignup').onclick=()=>{mode='signup';syncMode()};
  $('#ownerAuthForm').onsubmit=async event=>{
    event.preventDefault();
    const values=Object.fromEntries(new FormData(event.target)),button=$('#ownerAuthSubmit');
    if(mode==='signup'&&!values.retentionAccepted)return toast('Accept the data-retention and permanent-deletion Terms to create the account');
    button.disabled=true;
    try{
      if(mode==='signup')await api.register(values.email.trim(),values.password,values.name.trim()||values.email.split('@')[0]);
      else await api.login(values.email.trim(),values.password);
      session=await api.currentUser();
      await loadEntitlement();
      if(!hasActiveEntitlement())return renderPlanGate();
      await proceedAfterEntitlement();
    }catch(error){button.disabled=false;toast(error.message||'Could not sign in')}
  };
}

async function loadOwnerData(){
  const ownerId=cloudOwnerId();if(!ownerId)return;
  const [stores,customers,cards,orders,promotions,cardPurchases,incomingBrandRequests,catalog,services,experts,bookings]=await Promise.all([
    api.list(storeKind(ownerId)).catch(()=>[]),
    api.list(customerKind(ownerId)).catch(()=>[]),
    api.list(cardKind(ownerId)).catch(()=>[]),
    api.list(orderKind(ownerId)).catch(()=>[]),
    api.list(promotionKind(ownerId)).catch(()=>[]),
    api.list(CARD_PURCHASE_KIND).catch(()=>[]),
    api.list(BRAND_REQUEST_KIND).catch(()=>[]),
    api.list(catalogKind(ownerId)).catch(()=>[]),
    api.list(serviceKind(ownerId)).catch(()=>[]),
    api.list(expertKind(ownerId)).catch(()=>[]),
    api.list(bookingKind(ownerId)).catch(()=>[]),
  ]);
  state.stores=stores;state.customers=customers;state.cards=cards;state.orders=orders;state.promotions=await cleanupExpiredOwnerPromotions(ownerId,promotions);
  state.catalog=catalog;state.services=services;state.experts=experts;state.bookings=bookings;
  state.cardPurchases=cardPurchases.filter(row=>row.ownerId===ownerId);
  state.brandRequests=incomingBrandRequests.filter(row=>row.ownerId===ownerId);
  if(!state.activeStoreId||!stores.some(row=>row.id===state.activeStoreId))state.activeStoreId=stores[0]?.id||'';
  save();
}
function promotionCardAllowance(storeId){
  const now=Date.now();
  return FREE_PROMOTION_CARDS+state.cardPurchases.filter(row=>row.storeId===storeId&&row.status==='Declared Paid'&&(!row.expiresAt||new Date(row.expiresAt).getTime()>now)).length;
}
function promotionCardsPaused(storeId){
  return state.cardPurchases.some(row=>row.storeId===storeId&&row.status==='Paused');
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
function customerBrandStrip(){
  return `<div class="customer-brand-strip"><svg class="brand-mark" viewBox="0 0 120 120" fill="none" stroke="#7fffd4" stroke-width="8" aria-hidden="true"><circle cx="60" cy="26" r="15"/><circle cx="28" cy="82" r="15"/><circle cx="92" cy="82" r="15"/></svg><div><strong>Refills</strong><small>powered by <a href="https://www.g58.in/" target="_blank" rel="noopener noreferrer">g58.in</a></small></div></div>`;
}
function whatsappLink(phone,message){
  const digits=String(phone||'').replace(/[^\d+]/g,'').replace(/^\+/,'');
  if(!digits)return '';
  return `https://wa.me/${digits}?text=${encodeURIComponent(message)}`;
}
const WHATSAPP_ICON_SVG='<svg class="whatsapp-icon" viewBox="0 0 32 32" width="16" height="16" fill="currentColor" aria-hidden="true"><path d="M16.001 3C9.383 3 4 8.383 4 15c0 2.386.703 4.61 1.912 6.478L4 29l7.72-1.877A11.94 11.94 0 0 0 16.001 27C22.617 27 28 21.617 28 15S22.617 3 16.001 3zm6.51 16.984c-.276.777-1.366 1.42-2.24 1.605-.596.126-1.373.226-3.992-.855-3.35-1.386-5.505-4.775-5.673-4.996-.161-.221-1.359-1.809-1.359-3.451 0-1.642.86-2.449 1.166-2.785.276-.303.6-.379.8-.379.2 0 .4.002.575.01.184.008.432-.07.676.516.276.665.936 2.307.02 2.474.108.166.181.36.036.582-.145.221-.217.359-.435.552-.221.194-.463.433-.662.581-.221.166-.451.346-.194.786.257.44 1.144 1.888 2.457 3.058 1.688 1.505 3.11 1.973 3.552 2.196.442.221.7.19.958-.114.257-.303 1.103-1.287 1.397-1.729.294-.442.588-.368.99-.221.404.147 2.564 1.21 3.005 1.431.44.221.735.331.842.516.108.184.108 1.06-.168 1.837z"/></svg>';
const PRINT_ICON_SVG='<svg class="print-icon" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 9V2h12v7"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><path d="M6 14h12v8H6z"/></svg>';
function storeForRow(row){return state.stores.find(s=>s.id===row.storeId)||activeStore()}
function posPrintLink(row,amount,note){
  const store=storeForRow(row);
  const params=new URLSearchParams({source:'digit58',embedded:'1',amount:String(Math.round(amount*100)/100),note:note.slice(0,80),upi:store?.upiId||'',brand:store?.name||''});
  return `../pos/?${params.toString()}`;
}
function openPosPrintModal(url){
  modal('Print POS Bill',`<iframe class="pos-print-frame" src="${html(url)}" title="POS bill"></iframe>`);
  $('#modal .modal')?.classList.add('pos-print-modal-card');
}
function bindPosPrintButtons(){$$('[data-pos-print]').forEach(button=>button.onclick=()=>openPosPrintModal(button.dataset.posPrint))}
window.addEventListener('message',event=>{
  if(event.origin!==location.origin)return;
  if(event.data?.type==='g58-pos-bill-done')closeModal();
});
function floatingStoreWhatsappButton(store){
  const phone=String(store?.phone||'').replace(/[^\d+]/g,'').replace(/^\+/,'');
  if(!phone)return '';
  const message=encodeURIComponent(`Hi ${store.name||'there'}, I need help with my order on G58 Refills.`);
  return `<a class="floating-support-btn floating-whatsapp-btn" href="https://wa.me/${phone}?text=${message}" target="_blank" rel="noopener noreferrer" title="Chat with ${html(store.name||'the store')} on WhatsApp">💬<span>Support</span></a>`;
}
function siteFooter(forCustomer){
  const badge=forCustomer
    ? `<a class="g58-app-badge" href="/downloads/Refills_Customer.apk" download aria-label="Download the G58 Refills Android app"><span class="g58-app-badge-icon">▶</span><span class="g58-app-badge-text"><small>Never miss a refill</small><strong>Get the G58 Refills App</strong></span></a>`
    : `<a class="g58-app-badge" href="/downloads/GRAVITY58-Android-v1.9.apk" download aria-label="Download the Gravity58 Android app"><span class="g58-app-badge-icon">▶</span><span class="g58-app-badge-text"><small>Download Android</small><strong>Get G58 App</strong></span></a>`;
  return `<footer class="g58-site-footer"><div class="g58-site-footer-badge">${badge}</div><p class="g58-site-footer-note">© ${new Date().getFullYear()} Gravity58 · Refills</p></footer>`;
}
function renderShell(){
  const store=activeStore();
  const copy=bookingCopy(store);
  app.innerHTML=`<div class="shell"><aside class="sidebar"><a class="brand" href="../"><svg class="brand-mark" viewBox="0 0 120 120" fill="none" stroke="#7fffd4" stroke-width="8" aria-hidden="true"><circle cx="60" cy="26" r="15"/><circle cx="28" cy="82" r="15"/><circle cx="92" cy="82" r="15"/></svg><div><strong>Refills</strong><small class="muted">Store workspace</small></div></a><nav class="nav">${navButton('dashboard','◉','Dashboard')}${navButton('stores','◫','My Stores')}${navButton('promotions','✦','Promotions')}${navButton('brands','♟','Brand Orders')}${navButton('wall','☰','Customer Wall')}${isServiceStore(store)?`${navButton('services',isGameZone(store)?'🎮':'🛎',copy.items)}${navButton('experts',isGameZone(store)?'🏟':'🧑‍💼',copy.resources)}${navButton('availability','🗓','Availability')}${navButton('bookings','📅','Bookings')}${navButton('bookingHistory','🕘','Booking History')}`:`${navButton('orders','🧾','Orders')}${navButton('orderHistory','🕘','Order History')}${navButton('catalog','▦','Catalog')}`}${navButton('subscription','♢','Subscription')}${navButton('referrals','🎁','Refer & Earn')}${navButton('settings','⚙','Settings')}${hasActiveEntitlement()?`<a class="btn small" style="text-align:center;text-decoration:none" href="../pos/?source=digit58" target="_blank" rel="noopener">▣ Open POS</a>`:''}<button id="logout">⇥ Logout</button></nav></aside><main class="main"><header class="topbar"><div>${state.stores.length?`<select id="storeSwitch">${state.stores.map(row=>`<option value="${html(row.id)}" ${row.id===state.activeStoreId?'selected':''}>${html(row.name)}</option>`).join('')}</select>`:'<strong>No store yet</strong>'}</div><nav class="g58-topbar-home" aria-label="Quick links"><a href="https://www.g58.in/" aria-label="Home"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 11.5 12 4l9 7.5"/><path d="M5.5 10v9a1 1 0 0 0 1 1h11a1 1 0 0 0 1-1v-9"/><path d="M9.5 20v-6h5v6"/></svg><span>Home</span></a><a href="/digit58/" aria-label="Refills"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 11A8 8 0 0 0 6.3 6.3L4 8.6"/><path d="M4 4v4.6h4.6"/><path d="M4 13a8 8 0 0 0 13.7 4.7L20 15.4"/><path d="M20 20v-4.6h-4.6"/></svg><span>Refills</span></a><a href="/digital-menu/" aria-label="Digital Menu"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M7 3v6a2 2 0 0 0 2 2h0"/><path d="M9 3v18"/><path d="M7 3v5"/><path d="M15 3c-1.2 1.4-1.2 6.6 0 8 .5.6 1 .8 1 1.5V21"/></svg><span>Digital Menu</span></a></nav><span class="status-pill"><span class="dot"></span>${html(session?.email||'')}</span></header><section class="content" id="page"></section></main></div>${siteFooter()}${floatingSupportButton('digit58')}`;
  $$('[data-view]').forEach(button=>button.onclick=()=>{view=button.dataset.view;renderShell()});
  $('#logout').onclick=async()=>{stopOwnerRealtime();await api.logout();session=null;renderOwnerAuth()};
  $('#storeSwitch')?.addEventListener('change',event=>{state.activeStoreId=event.target.value;save();renderShell()});
  bindFloatingSupportButton();
  renderView();
}
function navButton(key,icon,label){return `<button data-view="${key}" class="${view===key?'active':''}"><span>${icon}</span>${label}</button>`}
function renderView(){if(!activeStore()&&view!=='stores'&&view!=='settings'&&view!=='subscription'&&view!=='referrals'){view='stores';return renderShell()}({dashboard:dashboardView,stores:storesView,promotions:promotionsView,brands:brandPartnersView,wall:customerWallView,orders:ordersView,orderHistory:orderHistoryView,catalog:catalogView,services:servicesView,experts:expertsView,availability:availabilityView,bookings:bookingsView,bookingHistory:bookingHistoryView,subscription:subscriptionView,referrals:referEarnView,settings:settingsView}[view]||dashboardView)()}
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
  const active=hasActiveEntitlement();
  const status=entitlement?.paused?'Paused':active?'Active':'Inactive';
  const onFreeTrial=!!entitlement?.freeTrial&&active;
  const plan=DIGIT58_PLAN_PERIODS.find(period=>period.id===entitlement?.plan);
  const planLabel=onFreeTrial?'Free Trial':plan?plan.label:'Refills Store Access';
  const price=onFreeTrial?'Free':plan?money(digit58PlanAmount(digit58Pricing.monthly,plan)):money(SUBSCRIPTION_AMOUNT);
  const priceSuffix=onFreeTrial?' for your first month':plan?` / ${plan.label.toLowerCase()}`:'/month';
  const expiry=entitlement?.lifetime?'Lifetime access':entitlement?.expiresAt?new Date(entitlement.expiresAt).toLocaleDateString('en-IN',{dateStyle:'medium'}):'—';
  const cancelScheduled=!!entitlement?.cancelAtPeriodEnd;
  const canCancel=!!entitlement?.razorpaySubscriptionId&&!cancelScheduled&&['created','active'].includes(entitlement?.subscriptionStatus||'');
  const autoRenewNote=cancelScheduled
    ?'Auto-renewal is off. Your access continues until the date above, then it will not renew.'
    :entitlement?.razorpaySubscriptionId
      ?`Renews automatically on ${expiry} by auto-debit. Cancel anytime — the current paid period is non-refundable.`
      :'';
  const showPlans=!active||onFreeTrial||!entitlement?.razorpaySubscriptionId;
  $('#page').innerHTML=`<div class="section-head"><div><h1>Subscription</h1><p class="muted">Your Refills store portal access.</p></div></div>
    <div class="card" style="max-width:460px">
      <span class="chip">${html(planLabel)}</span>
      <h2 style="margin:10px 0">${price}<small class="muted" style="font-size:14px">${priceSuffix}</small></h2>
      <div class="chips"><span class="chip ${status==='Active'?'delivered':status==='Paused'?'due':''}">${status}</span>${cancelScheduled?'<span class="chip due">Cancelling</span>':''}</div>
      <p class="muted" style="margin-top:12px">${entitlement?.lifetime?'Your subscription never expires.':`${onFreeTrial?'Free trial ends':'Renews / expires'}: ${expiry}`}</p>
      ${onFreeTrial?`<p class="muted">After your free trial, keep your store live by subscribing to a plan below.</p>`:''}
      ${autoRenewNote?`<p class="muted">${autoRenewNote}</p>`:''}
      ${status==='Paused'?'<p class="muted">Contact the G58 team to resume access.</p>':''}
      ${canCancel?'<button class="btn secondary full" id="cancelSubBtn" style="margin-top:12px">Cancel Subscription</button>':''}
    </div>
    ${showPlans?`<div class="section-head"><h2>${onFreeTrial?'Upgrade to a paid plan':'Refills Plans'}</h2></div><div class="plan-grid">${DIGIT58_PLAN_PERIODS.map(period=>{
      const amount=digit58PlanAmount(digit58Pricing.monthly,period);
      return `<article class="plan-card">
        <span class="plan-badge">${period.discount?`${period.discount}% OFF`:'REFILLS PLAN'}</span>
        <h3>${html(period.label)}</h3>
        <div class="plan-price">${money(amount)}<small> / ${period.label.toLowerCase()}</small></div>
        <p class="plan-note">Renews automatically every ${period.label.toLowerCase()} by auto-debit. Cancel anytime — the current paid period is non-refundable.</p>
        <button class="btn full" data-subscribe-plan="${period.id}" type="button">Subscribe</button>
      </article>`;
    }).join('')}</div>`:''}`;
  $('#cancelSubBtn')?.addEventListener('click',cancelDigit58SubscriptionFlow);
  $$('[data-subscribe-plan]').forEach(button=>button.addEventListener('click',()=>startDigit58Subscription(button.dataset.subscribePlan)));
}
async function cancelDigit58SubscriptionFlow(){
  if(!confirm('Cancel your Refills subscription? Auto-renewal will stop, but your access continues until the current paid period ends — no refund is given for that period.'))return;
  const button=$('#cancelSubBtn');if(button)button.disabled=true;
  try{
    const result=await api.executeFunction(api.config.digitalOrderFunctionId,{action:'digit58-cancel-subscription',ownerId:cloudOwnerId()});
    entitlement=result.entitlement||{...entitlement,cancelAtPeriodEnd:true};
    subscriptionView();
    toast('Auto-renewal has been turned off. Your access continues until it expires.');
  }catch(error){if(button)button.disabled=false;toast(error.message||'Could not cancel your subscription')}
}

function referEarnView(){
  refreshView=referEarnView;
  $('#page').innerHTML=`<div class="section-head"><div><h1>Refer &amp; Earn</h1><p class="muted">Invite another store owner to Refills and earn ₹399 once they complete a paid subscription.</p></div></div>
    <div class="card" id="referLinkCard" style="max-width:560px"><span class="chip">Loading your referral link…</span></div>
    <div class="section-head"><h2>My Referrals</h2></div>
    <div class="card table-wrap" id="referralsTableWrap"><table><thead><tr><th>Referred Store Owner</th><th>Plan</th><th>Status</th><th>Date</th></tr></thead><tbody><tr><td colspan="4">Loading…</td></tr></tbody></table></div>`;
  loadDigit58ReferralLink();
  loadDigit58MyReferrals();
}
async function loadDigit58ReferralLink(){
  const card=$('#referLinkCard');if(!card)return;
  try{
    const ownerId=cloudOwnerId();
    let code=entitlement?.referralCode;
    if(!code){
      const result=await api.executeFunction(api.config.digitalOrderFunctionId,{action:'digit58-get-referral-code',ownerId});
      code=result.code;
      entitlement={...entitlement,referralCode:code};
    }
    const link=`${location.origin}/digit58/?ref=${code}`;
    card.innerHTML=`<span class="chip">Your referral link</span>
      <div class="refer-link-row"><input readonly value="${html(link)}" id="referLinkInput"><button class="btn small" id="copyReferLinkBtn" type="button">Copy</button></div>
      <p class="muted" style="margin-top:12px">Share this link with another business owner. When they sign up and complete a paid Refills plan (6 months, 1 year or 3 years), you earn <strong>₹399</strong>. A free trial alone doesn't qualify — the reward is credited once G58 confirms their successful paid subscription.</p>`;
    $('#copyReferLinkBtn').onclick=async()=>{
      try{await navigator.clipboard.writeText(link);toast('Referral link copied')}
      catch{$('#referLinkInput').select();document.execCommand('copy');toast('Referral link copied')}
    };
  }catch(error){
    card.innerHTML=`<span class="chip">Refer &amp; Earn</span><p class="muted" style="margin-top:10px">${html(error.message||'Could not load your referral link')}</p>`;
  }
}
async function loadDigit58MyReferrals(){
  const wrap=$('#referralsTableWrap');if(!wrap)return;
  try{
    const ownerId=cloudOwnerId();
    const rows=(await api.list('digit58_referrals').catch(()=>[])).filter(row=>row.referrerUserId===ownerId).sort((a,b)=>new Date(b.createdAt)-new Date(a.createdAt));
    wrap.innerHTML=`<table><thead><tr><th>Referred Store Owner</th><th>Plan</th><th>Status</th><th>Date</th></tr></thead><tbody>${rows.map(row=>`<tr><td>${html(row.referredEmail||'Store owner')}</td><td>${html(DIGIT58_PLAN_PERIODS.find(period=>period.id===row.plan)?.label||row.plan||'—')}</td><td><span class="chip ${row.status==='Paid'?'delivered':'due'}">${html(row.status||'Eligible')}</span></td><td>${row.createdAt?new Date(row.createdAt).toLocaleDateString('en-IN',{dateStyle:'medium'}):''}</td></tr>`).join('')||'<tr><td colspan="4">No referrals yet.</td></tr>'}</tbody></table>`;
  }catch{
    wrap.innerHTML='<table><thead><tr><th>Referred Store Owner</th><th>Plan</th><th>Status</th><th>Date</th></tr></thead><tbody><tr><td colspan="4">Could not load referrals.</td></tr></tbody></table>';
  }
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
  <div class="section-head"><h2>Recent buy-again requests</h2></div><div class="card table-wrap">${buyRequestsTable(cards)}</div><div id="retentionControl"></div>`;
  window.G58DataRetention?.mount({host:'#retentionControl',product:'refills',rows:[...state.orders,...(state.bookings||[])],afterDelete:async()=>{await loadOwnerData();dashboardView()}});
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
  $$('[data-share-brand]').forEach(button=>button.onclick=()=>shareBrandModal(button.dataset.shareBrand));
  $$('[data-edit-store]').forEach(button=>button.onclick=()=>openStoreForm(button.dataset.editStore));
}
function storeCard(store){
  const link=publicStoreLink(store);
  return `<article class="card"><h3>${html(store.name)}</h3>${storeMinimum(store)?`<p class="store-minimum-order">Minimum new order ${money(storeMinimum(store))}</p>`:''}<p class="muted">${html(store.category)}${store.city?' · '+html(store.city):''}</p>${store.highlightText?`<p class="store-highlight-text">${html(store.highlightText)}</p>`:''}<p>${html(store.description||'')}</p><div class="chips"><span class="chip">${ownerCustomers(store.id).length} customers</span>${store.razorpayEnabled&&validRazorpayLink(store.razorpayLink)?'<span class="chip delivered">Razorpay enabled</span>':''}${store.suspended?'<span class="chip due">Paused by G58 admin</span>':''}</div><div class="actions"><button class="btn small" data-share-store="${html(store.id)}">Share Link / QR</button><button class="btn small secondary" data-share-brand="${html(store.id)}">Brand QR</button><button class="btn small secondary" data-edit-store="${html(store.id)}">Edit</button></div></article>`;
}
function publicStoreLink(store){return `${location.origin}${location.pathname.replace(/index\.html$/,'')}#store&owner=${encodeURIComponent(store.ownerId)}&store=${encodeURIComponent(store.id)}`}
function publicBrandLink(store){return `${location.origin}${location.pathname.replace(/index\.html$/,'')}#brand&owner=${encodeURIComponent(store.ownerId)}&store=${encodeURIComponent(store.id)}`}
function parseBrandTargetFromHash(){
  const text=String(location.hash||'').replace(/^#/,'');
  if(!text.startsWith('brand&'))return null;
  const params=new URLSearchParams(text.replace(/^brand&?/,''));
  const ownerId=params.get('owner'),storeId=params.get('store');
  return ownerId&&storeId?{ownerId,storeId}:null;
}
function parseStoreLinkHash(input){
  const text=String(input||'').trim();
  if(!text)return null;
  const hashIndex=text.indexOf('#store&');
  const hashPart=hashIndex>=0?text.slice(hashIndex+1):(text.startsWith('store&')?text:'');
  if(!hashPart)return null;
  const params=new URLSearchParams(hashPart.replace(/^store&?/,''));
  const owner=params.get('owner'),store=params.get('store');
  if(!owner||!store)return null;
  return `store&owner=${encodeURIComponent(owner)}&store=${encodeURIComponent(store)}`;
}
function openPasteStoreLinkPrompt(){
  modal('Open Your Store',`<form id="pasteStoreLinkForm"><p class="muted">Paste the link your store shared with you.</p><div class="field"><label>Store link</label><input name="storeLink" placeholder="https://g58.in/digit58/#store&owner=...&store=..." required></div><button class="btn full" type="submit" style="margin-top:10px">Continue</button></form>`,()=>{
    $('#pasteStoreLinkForm').onsubmit=event=>{
      event.preventDefault();
      const hash=parseStoreLinkHash($('input[name="storeLink"]',event.target).value);
      if(!hash)return toast("That doesn't look like a valid store link");
      closeModal();
      location.hash=hash;
      boot();
    };
  });
}
function parseStoreLinkOwnerStore(input){
  const hash=parseStoreLinkHash(input);if(!hash)return null;
  const params=new URLSearchParams(hash.replace(/^store&?/,''));
  const ownerId=params.get('owner'),storeId=params.get('store');
  return ownerId&&storeId?{ownerId,storeId}:null;
}
async function bootBrand(){
  pendingBrandTarget=parseBrandTargetFromHash();
  brandSession=await api.currentUser().catch(()=>null);
  if(!brandSession)return renderBrandAuth();
  await ensureBrandProfile();
  await loadBrandData();
  afterBrandAuth();
}
function afterBrandAuth(){
  if(brandProfile.blocked)return renderBrandBlocked();
  if(!brandProfile.disclaimerAcceptedAt)return renderBrandDisclaimer();
  renderBrandDashboard();
  openPendingBrandTarget();
}
function renderBrandBlocked(){
  app.innerHTML=`<main class="screen"><section class="auth-card"><a class="brand" href="../"><svg class="brand-mark" viewBox="0 0 120 120" fill="none" stroke="#7fffd4" stroke-width="8" aria-hidden="true"><circle cx="60" cy="26" r="15"/><circle cx="28" cy="82" r="15"/><circle cx="92" cy="82" r="15"/></svg><div><h2>Account Restricted</h2><p class="tagline">Your brand account has been paused by the G58 team.</p></div></a><div class="card"><p class="muted">Contact G58 support if you believe this is a mistake.</p></div><div class="actions" style="margin-top:16px"><button class="btn secondary full" id="brandBlockedLogout">Sign out</button></div></section></main>${siteFooter()}`;
  (typeof bindAndroidAppFooter==='function'&&bindAndroidAppFooter());
  $('#brandBlockedLogout').onclick=async()=>{await api.logout();brandSession=null;brandProfile=null;renderBrandAuth()};
}
function renderBrandDisclaimer(){
  app.innerHTML=`<main class="screen"><section class="auth-card"><a class="brand" href="../"><svg class="brand-mark" viewBox="0 0 120 120" fill="none" stroke="#7fffd4" stroke-width="8" aria-hidden="true"><circle cx="60" cy="26" r="15"/><circle cx="28" cy="82" r="15"/><circle cx="92" cy="82" r="15"/></svg><div><h2>Before you continue</h2><p class="tagline">One-time agreement</p></div></a><div class="card" style="text-align:left"><p class="muted">A promotion card placement is a direct agreement between <strong>you (the brand)</strong> and the <strong>store owner</strong> you request a card from — covering the product shown, the price displayed, the plan duration, and the payment for that placement.</p><p class="muted" style="margin-top:10px">G58 is not a party to this agreement. G58 does not verify, guarantee, mediate, or take responsibility for the accuracy of what either side declares, or for any dispute between you and a store owner. G58 only provides the platform and audits self-declared payments to keep the system honest.</p><button class="btn full green" id="brandDisclaimerAccept" style="margin-top:16px">I Understand — Continue</button></div></section></main>${siteFooter()}`;
  (typeof bindAndroidAppFooter==='function'&&bindAndroidAppFooter());
  $('#brandDisclaimerAccept').onclick=async()=>{
    const button=$('#brandDisclaimerAccept');button.disabled=true;
    try{
      const disclaimerAcceptedAt=now();
      await api.update(BRAND_KIND,brandProfile.id,{disclaimerAcceptedAt});
      brandProfile.disclaimerAcceptedAt=disclaimerAcceptedAt;
      afterBrandAuth();
    }catch(error){button.disabled=false;toast(error.message||'Could not save your acceptance')}
  };
}
function openPendingBrandTarget(){
  if(!pendingBrandTarget)return;
  const target=pendingBrandTarget;pendingBrandTarget=null;
  history.replaceState(null,'','#brand');
  openBrandRequestForm(target);
}
function renderBrandAuth(){
  app.innerHTML=`<main class="screen"><section class="auth-card"><a class="brand" href="../"><svg class="brand-mark" viewBox="0 0 120 120" fill="none" stroke="#7fffd4" stroke-width="8" aria-hidden="true"><circle cx="60" cy="26" r="15"/><circle cx="28" cy="82" r="15"/><circle cx="92" cy="82" r="15"/></svg><div><h2>G58 Brand Partners</h2><p class="tagline">Get your product's promotion card placed on Refills stores.</p></div></a><div class="actions" style="margin-bottom:14px"><button class="btn small" id="brandTabLogin">Sign in</button><button class="btn small secondary" id="brandTabSignup">Create brand account</button></div><form id="brandAuthForm"><div class="field full-name-field hidden"><label>Brand / contact name</label><input name="name"></div><div class="field"><label>Email</label><input name="email" type="email" required></div><div class="field"><label>Password</label><input name="password" type="password" minlength="8" required></div><button class="btn full" id="brandAuthSubmit" type="submit">Sign In</button></form></section></main>${siteFooter()}`;
  (typeof bindAndroidAppFooter==='function'&&bindAndroidAppFooter());
  let mode='signup';
  const syncMode=()=>{$('.full-name-field').classList.toggle('hidden',mode!=='signup');$('#brandAuthSubmit').textContent=mode==='signup'?'Create Account':'Sign In';$('#brandTabLogin').className=mode==='login'?'btn small':'btn small secondary';$('#brandTabSignup').className=mode==='signup'?'btn small':'btn small secondary'};
  $('#brandTabLogin').onclick=()=>{mode='login';syncMode()};
  $('#brandTabSignup').onclick=()=>{mode='signup';syncMode()};
  syncMode();
  $('#brandAuthForm').onsubmit=async event=>{
    event.preventDefault();
    const values=Object.fromEntries(new FormData(event.target)),button=$('#brandAuthSubmit');
    button.disabled=true;
    try{
      if(mode==='signup')await api.register(values.email.trim(),values.password,values.name.trim()||values.email.split('@')[0]);
      else await api.login(values.email.trim(),values.password);
      brandSession=await api.currentUser();
      await ensureBrandProfile();
      await loadBrandData();
      afterBrandAuth();
    }catch(error){button.disabled=false;toast(error.message||'Could not sign in')}
  };
}
async function ensureBrandProfile(){
  const existing=await api.list(BRAND_KIND).catch(()=>[]);
  brandProfile=existing.find(row=>row.userId===brandSession.$id)||null;
  if(brandProfile)return;
  const record={id:id('brand'),userId:brandSession.$id,name:brandSession.name||brandSession.email.split('@')[0],email:brandSession.email,createdAt:now()};
  brandProfile=await api.create(BRAND_KIND,record,record.id,api.collaborativePermissionSet?.(brandSession.$id));
}
async function loadBrandData(){
  const rows=await api.list(BRAND_REQUEST_KIND).catch(()=>[]);
  brandRequests=rows.filter(row=>row.brandOwnerId===brandSession.$id).sort((a,b)=>new Date(b.createdAt||0)-new Date(a.createdAt||0));
}
function brandRequestStatusNote(row){
  if(row.status==='Rejected')return `<span class="chip due">Rejected by store</span>`;
  if(row.status==='Paused')return `<span class="chip due">Paused by G58</span>`;
  if(row.status==='Live')return `<span class="chip delivered">Live on store</span>`;
  if(row.status==='Awaiting Payment'){
    if(!row.brandPaidAt)return `<span class="chip due">Approved — payment needed</span>`;
    return `<span class="chip due">Payment submitted — waiting for store</span>`;
  }
  return `<span class="chip due">Waiting for store approval</span>`;
}
function renderBrandDashboard(){
  app.innerHTML=`<main class="screen brand-dashboard"><a class="brand" href="../"><svg class="brand-mark" viewBox="0 0 120 120" fill="none" stroke="#7fffd4" stroke-width="8" aria-hidden="true"><circle cx="60" cy="26" r="15"/><circle cx="28" cy="82" r="15"/><circle cx="92" cy="82" r="15"/></svg><div><h2>G58 Brand Partners</h2><p class="tagline">${html(brandProfile?.name||brandSession.email)}</p></div></a><div class="section-head"><div><h1>Your Card Requests</h1><p class="muted">Request a promotion card on any Refills store — choose a 30-day, 6-month, or 1-year plan.</p></div><button class="btn" id="newBrandRequest">+ New Request</button></div><div class="grid card-grid">${brandRequests.map(brandRequestCard).join('')||'<div class="empty">No requests yet. Create your first one.</div>'}</div><div class="actions" style="margin-top:20px"><button class="btn secondary" id="brandLogout">Sign out</button></div></main>${siteFooter()}`;
  (typeof bindAndroidAppFooter==='function'&&bindAndroidAppFooter());
  $('#newBrandRequest').onclick=()=>openBrandRequestForm();
  $('#brandLogout').onclick=async()=>{await api.logout();brandSession=null;brandProfile=null;renderBrandAuth()};
  $$('[data-pay-brand-request]').forEach(button=>button.onclick=()=>declareBrandPayment(button.dataset.payBrandRequest));
}
function brandRequestCard(row){
  const tier=BRAND_CARD_PRICING[row.duration||'30d'];
  return `<article class="card brand-request-card"><h3>${html(row.promotionName)}</h3><p class="muted">${html(row.storeName)} · ${money(row.price)} shown to customers</p><p class="muted">${html(tier.label)} plan · ${money(tier.amount)}</p>${brandRequestStatusNote(row)}${row.status==='Awaiting Payment'&&!row.brandPaidAt?`<button type="button" class="btn small green" style="margin-top:10px" data-pay-brand-request="${html(row.id)}">Pay ${money(tier.amount)}</button>`:''}</article>`;
}
async function openBrandRequestForm(prefillTarget){
  let prefillStore=null;
  if(prefillTarget){
    prefillStore=await api.get(storeKind(prefillTarget.ownerId),prefillTarget.storeId).catch(()=>null);
    if(!prefillStore)toast("Couldn't load that store — paste the link manually");
  }
  const storeField=prefillStore?`<div class="field"><label>Store</label><input value="${html(prefillStore.name)}" disabled></div>`:`<div class="field"><label>Store link</label><input name="storeLink" placeholder="https://g58.in/digit58/#store&owner=...&store=..." required></div>`;
  const tierOptions=Object.entries(BRAND_CARD_PRICING).map(([key,tier])=>`<label class="option-toggle"><input type="radio" name="brandDuration" value="${key}" ${key==='30d'?'checked':''}><span><strong>${tier.label}</strong><small>${money(tier.amount)}</small></span></label>`).join('');
  modal('New Card Request',`<form id="brandRequestForm">${storeField}<div class="field"><label>Product name</label><input name="promotionName" maxlength="80" required></div><div class="field"><label>Offer line</label><input name="offerText" maxlength="120" placeholder="Pure 500g jar · limited stock"></div><div class="field"><label>Price to display</label><input name="price" type="number" min="0" step="0.01" required></div>${imageUploadFieldMarkup('brandImagePreview')}<div class="field"><label>Plan duration</label><div class="card-purchase-tiers">${tierOptions}</div></div><p class="muted">This request goes to the store owner for approval, then costs the plan amount above for that placement duration.</p><button class="btn full" style="margin-top:10px">Send Request</button></form>`,()=>{
    const form=$('#brandRequestForm'),imageFile=form.imageFile,imagePreview=$('#brandImagePreview'),submitButton=$('button.btn.full',form);
    bindImageGuideTabs(form);
    let compressedBlob=null,previewUrl='',compressionPromise=null;
    imageFile.onchange=async()=>{
      const file=imageFile.files[0];if(!file)return;
      compressedBlob=null;submitButton.disabled=true;imagePreview.innerHTML='<span class="muted" style="font-size:12px">Compressing image for upload…</span>';
      compressionPromise=compressImageTo100Kb(file);
      try{
        compressedBlob=await compressionPromise;
        if(previewUrl)URL.revokeObjectURL(previewUrl);
        previewUrl=URL.createObjectURL(compressedBlob);
        imagePreview.innerHTML=`<img src="${previewUrl}" alt="">`;
      }catch(error){imageFile.value='';imagePreview.innerHTML='';toast(error.message)}
      finally{compressionPromise=null;submitButton.disabled=false}
    };
    form.onsubmit=async event=>{
      event.preventDefault();
      const raw=Object.fromEntries(new FormData(event.target)),button=event.submitter;
      const target=prefillTarget||parseStoreLinkOwnerStore(raw.storeLink);
      if(!target)return toast("That doesn't look like a valid store link");
      button.disabled=true;
      try{
        if(compressionPromise)await compressionPromise;
        if(imageFile.files[0]&&!compressedBlob)compressedBlob=await compressImageTo100Kb(imageFile.files[0]);
        const store=prefillStore||await api.get(storeKind(target.ownerId),target.storeId);
        const duration=BRAND_CARD_PRICING[raw.brandDuration]?raw.brandDuration:'30d';
        const record={id:id('brandreq'),brandOwnerId:brandSession.$id,brandOwnerName:brandProfile?.name||brandSession.email.split('@')[0],brandOwnerEmail:brandSession.email,ownerId:target.ownerId,storeId:target.storeId,storeName:store.name,promotionName:raw.promotionName.trim(),offerText:raw.offerText.trim(),price:Math.max(0,Number(raw.price)||0),duration,status:'Pending Store Approval',createdAt:now()};
        if(compressedBlob){
          const ext=compressedBlob.type==='image/webp'?'webp':compressedBlob.type==='image/png'?'png':'jpg';
          const upload=await api.uploadMenuMedia(new File([compressedBlob],`brand-${id('img')}.${ext}`,{type:compressedBlob.type}));
          record.imageUrl=upload.mediaUrl;record.imageFileId=upload.fileId;
        }
        const created=await api.create(BRAND_REQUEST_KIND,record,record.id,api.collaborativePermissionSet?.(brandSession.$id));
        brandRequests.unshift(created);
        closeModal();renderBrandDashboard();toast('Request sent to the store owner');
      }catch(error){button.disabled=false;toast(error.message||'Could not find that store — check the link')}
    };
  });
}
async function declareBrandPayment(requestId){
  const row=brandRequests.find(item=>item.id===requestId);if(!row)return;
  try{
    const tier=BRAND_CARD_PRICING[row.duration||'30d'];
    const pricingRows=await api.list('digit58_pricing').catch(()=>[]);
    const paymentLink=(pricingRows.find(item=>(item.id||item.$id)==='default')||pricingRows[0])?.paymentLink||'';
    if(!paymentLink)return toast('Payment link is not configured yet. Contact G58 support.');
    window.open(paymentLink,'_blank','noopener');
    if(!confirm(`Have you completed the ${money(tier.amount)} payment?`))return;
    const brandPaidAt=now();
    const nextStatus=row.storePaidAt?'Live':'Awaiting Payment';
    const changes={brandPaidAt,status:nextStatus,updatedAt:brandPaidAt};
    if(nextStatus==='Live')changes.expiresAt=new Date(Date.now()+tier.days*86400000).toISOString();
    await api.update(BRAND_REQUEST_KIND,requestId,changes);
    Object.assign(row,changes);
    renderBrandDashboard();toast(nextStatus==='Live'?'Card is now live on the store!':'Payment submitted — waiting for the store to pay their share');
  }catch(error){toast(error.message||'Could not submit payment')}
}
function openStoreForm(storeId=''){
  const store=state.stores.find(row=>row.id===storeId)||{};
  const minimumEnabled=store.minimumOrderEnabled===true||(store.minimumOrderEnabled!==false&&configuredStoreMinimum(store)>0);
  modal(storeId?'Edit Store':'Create Store',`<form id="storeForm"><div class="field"><label>Store name</label><input name="name" value="${html(store.name||'')}" required></div><div class="field"><label>Business type</label><div class="business-type-toggle"><label class="option-toggle"><input type="radio" name="businessType" value="products" ${(!store.businessType||store.businessType==='products')?'checked':''}><span><strong>Store</strong><small>Sell products — customers place orders you price and fulfil.</small></span></label><label class="option-toggle"><input type="radio" name="businessType" value="services" ${store.businessType==='services'&&!isGameZone(store)?'checked':''}><span><strong>Service</strong><small>Offer bookable services — customers book a slot and pay a prepayment.</small></span></label><label class="option-toggle"><input type="radio" name="businessType" value="game_zones" ${isGameZone(store)?'checked':''}><span><strong>Game Zone</strong><small>Book box-cricket turfs, courts, tables, play stations or indoor games in timed slots.</small></span></label></div></div><label class="option-toggle"><input id="minimumOrderEnabled" name="minimumOrderEnabled" type="checkbox" ${minimumEnabled?'checked':''}><span><strong>Enable minimum new order criteria</strong><small>Switch this off anytime. Refills and history Reorders never use this limit.</small></span></label><div class="field ${minimumEnabled?'':'hidden'}" id="minimumOrderValueField"><label>Minimum new order value (₹)</label><input name="minimumOrderValue" type="number" min="1" step="1" value="${configuredStoreMinimum(store)||''}" placeholder="Example: 500"><small class="muted">A customer below this value can request a one-order approval from you.</small></div><div class="form-grid"><div class="field"><label>Category</label><input name="category" value="${html(store.category||'')}" placeholder="Example: Pharmacy"></div><div class="field"><label>City</label><input name="city" value="${html(store.city||'')}"></div></div><div class="field"><label>Customer highlight text <small>(optional)</small></label><input name="highlightText" maxlength="40" value="${html(store.highlightText||'')}" placeholder="Example: 20% Off"><small class="muted">Shown as bold orange text on this store's customer page.</small></div><div class="field"><label>Phone</label><input name="phone" value="${html(store.phone||'')}"></div><div class="field"><label>UPI ID <small>(for order payment QR codes)</small></label><input name="upiId" value="${html(store.upiId||'')}" placeholder="yourstore@upi"></div><label class="option-toggle"><input id="razorpayEnabled" name="razorpayEnabled" type="checkbox" ${store.razorpayEnabled?'checked':''}><span><strong>Enable Razorpay payment link</strong><small>Optional — customers can open your Razorpay page after you set the order amount.</small></span></label><div class="field ${store.razorpayEnabled?'':'hidden'}" id="razorpayLinkField"><label>Razorpay payment link</label><input name="razorpayLink" type="text" inputmode="url" value="${html(store.razorpayLink||'')}" placeholder="razorpay.me/@yourstore"><small class="muted">Only razorpay.me or rzp.io secure links are accepted. https:// is added automatically.</small><div class="razorpay-link-note"><strong>How reusable Razorpay.me links work</strong><small>Razorpay.me has no return-URL setting. After paying, the customer returns to the G58 tab and taps Payment completed. Always verify the payment in Razorpay before accepting the order.</small></div></div><div class="field"><label>Description</label><textarea name="description">${html(store.description||'')}</textarea></div><button class="btn full">${storeId?'Save Store':'Create Store'}</button></form>`,()=>{
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
      const selectedBusinessType=['services','game_zones'].includes(raw.businessType)?raw.businessType:'products';
      const businessType=selectedBusinessType==='products'?'products':'services';
      const bookingMode=selectedBusinessType==='game_zones'?'game_zones':selectedBusinessType==='services'?'services':'';
      const values={name:raw.name.trim(),businessType,bookingMode,minimumOrderEnabled,minimumOrderValue,category:raw.category.trim()||(selectedBusinessType==='game_zones'?'Indoor Game Zone':'General store'),city:raw.city.trim(),highlightText:raw.highlightText.trim(),phone:raw.phone.trim(),upiId:raw.upiId.trim(),razorpayEnabled,razorpayLink:razorpayEnabled?razorpayLink:'',description:raw.description.trim()};
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
  const store=activeStore();if(!store){$('#page').innerHTML='<div class="empty">Create a store first.</div>';return}
  const promotions=storePromotions(store.id).sort((a,b)=>new Date(b.createdAt||0)-new Date(a.createdAt||0));
  const allowance=promotionCardAllowance(store.id),paused=promotionCardsPaused(store.id),atLimit=promotions.length>=allowance;
  const pausedNotice=paused?`<div class="card"><p class="muted">Your paid promotion cards are currently paused by the G58 team pending payment verification. Contact G58 support to resolve this.</p></div>`:'';
  const limitNote=`<p class="muted" style="margin-top:4px">${promotions.length} of ${allowance} card${allowance===1?'':'s'} used (${FREE_PROMOTION_CARDS} free).</p>`;
  const pendingBrandRequests=state.brandRequests.filter(row=>row.storeId===store.id&&row.status==='Pending Store Approval');
  const brandRequestsSection=pendingBrandRequests.length?`<div class="section-head"><h2>Brand card requests</h2></div><div class="grid card-grid">${pendingBrandRequests.map(brandRequestOwnerCard).join('')}</div>`:'';
  $('#page').innerHTML=`<div class="section-head"><div><h1>Promotions</h1><p class="muted">Create compact offer tickets that scroll above customer orders for ${html(store.name||'this store')}.</p>${limitNote}</div><button class="btn" id="addPromotion">${atLimit?'+ Buy More Cards':'+ New Promotion'}</button></div>${pausedNotice}${brandRequestsSection}<div class="promotion-owner-grid">${promotions.map(promotionOwnerCard).join('')||'<div class="empty">No promotions yet. Create your first offer ticket.</div>'}</div>`;
  $('#addPromotion').onclick=()=>atLimit?openBuyPromotionCardForm(store):openPromotionForm();
  $$('[data-edit-promotion]').forEach(button=>button.onclick=()=>openPromotionForm(button.dataset.editPromotion));
  $$('[data-toggle-promotion]').forEach(button=>button.onclick=()=>togglePromotion(button.dataset.togglePromotion));
  $$('[data-delete-promotion]').forEach(button=>button.onclick=()=>deletePromotion(button.dataset.deletePromotion));
  $$('[data-approve-brand-request]').forEach(button=>button.onclick=()=>approveBrandRequest(button.dataset.approveBrandRequest));
  $$('[data-reject-brand-request]').forEach(button=>button.onclick=()=>rejectBrandRequest(button.dataset.rejectBrandRequest));
}
function brandRequestOwnerCard(row){
  const brandTier=BRAND_CARD_PRICING[row.duration||'30d'],approvalTier=PROMOTION_CARD_PRICING[row.duration||'30d'];
  return `<article class="card brand-request-card"><h3>${html(row.promotionName)}</h3><p class="muted">From ${html(row.brandOwnerName||row.brandOwnerEmail)} · ${money(row.price)} shown to customers</p><p class="muted">${html(brandTier.label)} plan · Approving costs you ${money(approvalTier.amount)} to G58; the brand pays ${money(brandTier.amount)}.</p><div class="actions" style="margin-top:10px"><button class="btn small green" data-approve-brand-request="${html(row.id)}">Approve</button><button class="btn small red" data-reject-brand-request="${html(row.id)}">Reject</button></div></article>`;
}
async function rejectBrandRequest(requestId){
  const row=state.brandRequests.find(item=>item.id===requestId);if(!row||!confirm(`Reject the "${row.promotionName}" request?`))return;
  try{
    await api.update(BRAND_REQUEST_KIND,requestId,{status:'Rejected',updatedAt:now()});
    row.status='Rejected';refreshView();toast('Request rejected');
  }catch(error){toast(error.message||'Could not reject this request')}
}
async function approveBrandRequest(requestId){
  const row=state.brandRequests.find(item=>item.id===requestId);if(!row)return;
  const brandTier=BRAND_CARD_PRICING[row.duration||'30d'],approvalTier=PROMOTION_CARD_PRICING[row.duration||'30d'];
  let paymentLink='';
  try{const pricingRows=await api.list('digit58_pricing');paymentLink=(pricingRows.find(item=>(item.id||item.$id)==='default')||pricingRows[0])?.paymentLink||''}catch{}
  modal('Approve Brand Request',`<div class="card"><p class="muted">Approving "${html(row.promotionName)}" from ${html(row.brandOwnerName||row.brandOwnerEmail)} costs you ${money(approvalTier.amount)} to G58 for a ${html(approvalTier.label)} placement.</p>${paymentLink?`<a class="btn full" href="${html(paymentLink)}" target="_blank" rel="noopener noreferrer" style="margin-top:14px;text-align:center;text-decoration:none">Pay ${money(approvalTier.amount)}</a><p class="muted" style="margin-top:6px;font-size:12px">Opens securely in another tab. Come back and confirm below once paid.</p>`:'<p class="muted" style="margin-top:14px">Payment link is not configured yet. Contact G58 support.</p>'}<button type="button" class="btn full green" id="brandApproveConfirm" style="margin-top:10px" ${paymentLink?'':'disabled'}>I've Paid — Approve Request</button></div>`,()=>{
    $('#brandApproveConfirm').onclick=async()=>{
      const button=$('#brandApproveConfirm');button.disabled=true;
      try{
        const storePaidAt=now();
        const nextStatus=row.brandPaidAt?'Live':'Awaiting Payment';
        const changes={storePaidAt,status:nextStatus,updatedAt:storePaidAt};
        if(nextStatus==='Live')changes.expiresAt=new Date(Date.now()+brandTier.days*86400000).toISOString();
        await api.update(BRAND_REQUEST_KIND,requestId,changes);
        Object.assign(row,changes);
        closeModal();refreshView();
        toast(nextStatus==='Live'?'Card is now live for customers!':'Approved — waiting for the brand to pay their share');
      }catch(error){button.disabled=false;toast(error.message||'Could not approve this request')}
    };
  });
}
function brandPartnersView(){
  refreshView=brandPartnersView;
  const rows=state.brandRequests.slice().sort((a,b)=>new Date(b.createdAt||0)-new Date(a.createdAt||0));
  const pending=rows.filter(row=>row.status==='Pending Store Approval');
  const live=rows.filter(row=>row.status==='Live');
  const brandSpend=rows.filter(row=>row.storePaidAt).reduce((sum,row)=>sum+(PROMOTION_CARD_PRICING[row.duration||'30d']?.amount||0),0);
  const ownSpend=state.cardPurchases.filter(row=>row.status==='Declared Paid').reduce((sum,row)=>sum+Number(row.amount||0),0);
  const brandOwnersMap=new Map();
  rows.forEach(row=>{
    if(!row.brandOwnerId)return;
    if(!brandOwnersMap.has(row.brandOwnerId))brandOwnersMap.set(row.brandOwnerId,{name:row.brandOwnerName||row.brandOwnerEmail,email:row.brandOwnerEmail,requests:[]});
    brandOwnersMap.get(row.brandOwnerId).requests.push(row);
  });
  const brandOwners=[...brandOwnersMap.values()];
  const pendingSection=pending.length?`<div class="section-head"><h2>Pending your approval</h2></div><div class="grid card-grid">${pending.map(brandRequestOwnerCard).join('')}</div>`:'';
  $('#page').innerHTML=`<div class="section-head"><div><h1>Brand Orders</h1><p class="muted">Brand card requests and connected accounts across your stores, with promotion spend tracked separately from your own cards.</p></div></div>
  <div class="grid stats">${metric('Your Own Cards — Spent',money(ownSpend))}${metric('Brand Partner Cards — Spent',money(brandSpend))}${metric('Connected Brand Accounts',brandOwners.length)}${metric('Live Brand Cards',live.length)}</div>
  ${pendingSection}
  <div class="section-head"><h2>Connected brand accounts</h2></div>
  <div class="card table-wrap">${brandOwnersTable(brandOwners)}</div>
  <div class="section-head"><h2>All brand card requests</h2></div>
  <div class="card table-wrap">${brandRequestsTable(rows)}</div>`;
  $$('[data-approve-brand-request]').forEach(button=>button.onclick=()=>approveBrandRequest(button.dataset.approveBrandRequest));
  $$('[data-reject-brand-request]').forEach(button=>button.onclick=()=>rejectBrandRequest(button.dataset.rejectBrandRequest));
  $$('[data-pause-brand-request]').forEach(button=>button.onclick=()=>toggleBrandRequestPause(button.dataset.pauseBrandRequest));
}
function brandOwnersTable(brandOwners){
  if(!brandOwners.length)return `<div class="empty">No brand accounts connected yet. Share your Brand QR from My Stores so a brand can request a card.</div>`;
  return `<table><thead><tr><th>Brand</th><th>Email</th><th>Requests</th><th>Live Cards</th></tr></thead><tbody>${brandOwners.map(row=>`<tr><td><strong>${html(row.name)}</strong></td><td>${html(row.email||'')}</td><td>${row.requests.length}</td><td>${row.requests.filter(item=>item.status==='Live').length}</td></tr>`).join('')}</tbody></table>`;
}
function brandRequestsTable(rows){
  if(!rows.length)return `<div class="empty">No brand card requests yet.</div>`;
  return `<table><thead><tr><th>Product</th><th>Store</th><th>Brand</th><th>Price</th><th>Status</th><th>Action</th></tr></thead><tbody>${rows.map(row=>`<tr><td>${html(row.promotionName)}</td><td>${html(row.storeName)}</td><td>${html(row.brandOwnerName||row.brandOwnerEmail)}</td><td>${money(row.price)}</td><td>${html(row.status)}</td><td>${row.status==='Live'?`<button class="btn small secondary" data-pause-brand-request="${html(row.id)}">Pause</button>`:row.status==='Paused'?`<button class="btn small green" data-pause-brand-request="${html(row.id)}">Resume</button>`:''}</td></tr>`).join('')}</tbody></table>`;
}
async function toggleBrandRequestPause(requestId){
  const row=state.brandRequests.find(item=>item.id===requestId);if(!row)return;
  const nextStatus=row.status==='Paused'?'Live':'Paused';
  try{
    await api.update(BRAND_REQUEST_KIND,requestId,{status:nextStatus,updatedAt:now()});
    row.status=nextStatus;refreshView();toast(nextStatus==='Paused'?'Brand card paused':'Brand card resumed');
  }catch(error){toast(error.message||'Could not update this request')}
}
async function openBuyPromotionCardForm(store){
  let selectedTier='30d',paymentLink='';
  try{const pricingRows=await api.list('digit58_pricing');paymentLink=(pricingRows.find(row=>(row.id||row.$id)==='default')||pricingRows[0])?.paymentLink||''}catch{}
  const tierOptions=Object.entries(PROMOTION_CARD_PRICING).map(([key,tier])=>`<label class="option-toggle"><input type="radio" name="cardTier" value="${key}" ${key===selectedTier?'checked':''}><span><strong>${tier.label}</strong><small>${money(tier.amount)}</small></span></label>`).join('');
  modal('Buy a Promotion Card',`<div class="card-purchase-form"><p class="muted">You've used all ${FREE_PROMOTION_CARDS} free promotion cards for ${html(store.name)}. Choose a duration to unlock one more.</p><div class="card-purchase-tiers">${tierOptions}</div>${paymentLink?`<a class="btn full" id="cardPurchasePayLink" href="${html(paymentLink)}" target="_blank" rel="noopener noreferrer" style="margin-top:14px;text-align:center;text-decoration:none">Pay ${money(PROMOTION_CARD_PRICING[selectedTier].amount)}</a><p class="muted" style="margin-top:6px;font-size:12px">Opens securely in another tab. Come back and confirm below once paid.</p>`:'<p class="muted" style="margin-top:14px">Payment link is not configured yet. Contact G58 support.</p>'}<button type="button" class="btn full green" id="cardPurchaseConfirm" style="margin-top:10px" ${paymentLink?'':'disabled'}>I've Paid — Unlock Card</button></div>`,()=>{
    const updatePayLink=()=>{
      const tier=PROMOTION_CARD_PRICING[selectedTier];
      const link=$('#cardPurchasePayLink');if(link)link.textContent=`Pay ${money(tier.amount)}`;
    };
    $$('input[name="cardTier"]').forEach(input=>input.onchange=()=>{selectedTier=input.value;updatePayLink()});
    $('#cardPurchaseConfirm').onclick=async()=>{
      const button=$('#cardPurchaseConfirm');button.disabled=true;
      try{
        const tier=PROMOTION_CARD_PRICING[selectedTier],ownerId=cloudOwnerId(),declaredPaidAt=now(),expiresAt=new Date(Date.now()+tier.days*86400000).toISOString();
        const record={id:id('cardbuy'),ownerId,ownerEmail:session.email,ownerName:session.name||session.email.split('@')[0],storeId:store.id,storeName:store.name,duration:selectedTier,amount:tier.amount,status:'Declared Paid',declaredPaidAt,expiresAt,createdAt:declaredPaidAt};
        const created=await api.create(CARD_PURCHASE_KIND,record,record.id,api.collaborativePermissionSet?.(ownerId));
        state.cardPurchases.push(created);save();
        closeModal();promotionsView();
        toast(`Card unlocked for ${tier.label} — create your new promotion`);
      }catch(error){button.disabled=false;toast(error.message||'Could not confirm your payment')}
    };
  });
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
  return `<article class="promotion-ticket owner-ticket ${promotion.active===false||expired?'promotion-disabled':''}">${promotion.imageUrl?`<div class="promotion-ticket-image"><img src="${html(promotion.imageUrl)}" alt="" loading="lazy"></div>`:''}<h3>${html(promotion.name)}</h3>${Number(promotion.price)>0?`<strong class="promotion-offer-price">₹${Math.round(promotion.price)}/- only</strong>`:''}${promotion.endsOn?`<small class="promotion-end-date">Offer ends ${html(formatPromotionEnd(promotion.endsOn))}</small>`:''}<div class="chips"><span class="chip ${promotion.active===false||expired?'due':'delivered'}">${expired?'Expired':promotion.active===false?'Paused':'Visible to customers'}</span></div><div class="actions"><button class="btn small" data-edit-promotion="${html(promotion.id)}">Edit</button><button class="btn small secondary" data-toggle-promotion="${html(promotion.id)}">${promotion.active===false?'Enable':'Pause'}</button><button class="btn small red" data-delete-promotion="${html(promotion.id)}">Delete</button></div></article>`;
}
function loadBrowserImage(file){return new Promise((resolve,reject)=>{if(!file?.type?.startsWith('image/'))return reject(new Error('Select a JPG, PNG or WebP image'));if(file.size>20*1024*1024)return reject(new Error('Source image must be below 20 MB'));const url=URL.createObjectURL(file),image=new Image();image.onload=()=>{URL.revokeObjectURL(url);resolve(image)};image.onerror=()=>{URL.revokeObjectURL(url);reject(new Error('This image could not be opened'))};image.src=url})}
function canvasImageBlob(canvas,type,quality){return new Promise((resolve,reject)=>canvas.toBlob(blob=>blob?resolve(blob):reject(new Error('Image compression failed')),type,quality))}
const PROMOTION_IMAGE_MAX_BYTES=95000;
async function compressImageTo100Kb(file){
  // Appwrite storage limits are decimal bytes. Keeping a small safety margin
  // avoids a 100 KiB browser file being rejected by a 100,000-byte bucket.
  if(file.size<=PROMOTION_IMAGE_MAX_BYTES)return file;
  const image=await loadBrowserImage(file);
  let width=Math.min(1920,image.naturalWidth||image.width),height=Math.max(1,Math.round((image.naturalHeight||image.height)*(width/(image.naturalWidth||image.width))));
  const sourceCanvas=document.createElement('canvas');
  sourceCanvas.width=Math.max(1,Math.round(width));sourceCanvas.height=Math.max(1,Math.round(height));
  const sourceContext=sourceCanvas.getContext('2d',{alpha:true});
  sourceContext.imageSmoothingEnabled=true;sourceContext.imageSmoothingQuality='high';
  sourceContext.drawImage(image,0,0,sourceCanvas.width,sourceCanvas.height);
  for(let sizePass=0;sizePass<16;sizePass++){
    const canvas=document.createElement('canvas');
    canvas.width=Math.max(1,Math.round(width));canvas.height=Math.max(1,Math.round(height));
    const context=canvas.getContext('2d',{alpha:true});
    context.imageSmoothingEnabled=true;context.imageSmoothingQuality='high';
    context.drawImage(sourceCanvas,0,0,canvas.width,canvas.height);
    for(let quality=.94;quality>=.34;quality-=.05){
      const blob=await canvasImageBlob(canvas,'image/webp',quality);
      if(blob.size<=PROMOTION_IMAGE_MAX_BYTES)return blob;
    }
    width*=.86;height*=.86;
  }
  throw new Error('This image could not be prepared for upload. Try a JPG, PNG or WebP image below 20 MB.');
}
function openPromotionForm(promotionId=''){
  const store=activeStore(),promotion=state.promotions.find(row=>row.id===promotionId)||{};if(!store)return;
  if(!promotionId&&storePromotions(store.id).length>=promotionCardAllowance(store.id))return openBuyPromotionCardForm(store);
  const defaultEnd=indiaDateValue(new Date(Date.now()+7*86400000)),today=indiaDateValue();
  modal(promotionId?'Edit Promotion':'Create Promotion',`<form id="promotionForm"><div class="field"><label>Product name</label><input name="name" value="${html(promotion.name||'')}" placeholder="Organic Honey" maxlength="80" required></div><div class="field"><label>Offer line</label><input name="offerText" value="${html(promotion.offerText||'')}" placeholder="Pure 500g jar · limited stock" maxlength="120"></div>${imageUploadFieldMarkup('promotionImagePreview',promotion.imageUrl?`<img src="${html(promotion.imageUrl)}" alt="">`:'','promotion-image-preview')}<div class="form-grid"><div class="field"><label>Offer price</label><input name="price" type="number" min="0" step="0.01" value="${Number(promotion.price)||''}" placeholder="299" required></div><div class="field"><label>Offer ends</label><input name="endsOn" type="date" min="${today}" value="${html(promotion.endsOn||defaultEnd)}" required></div></div><label class="option-toggle"><input name="active" type="checkbox" ${promotion.active===false?'':'checked'}><span><strong>Show to customers</strong><small>Paused promotions remain saved but disappear from the customer portal.</small></span></label><button class="btn full" style="margin-top:14px">${promotionId?'Save Promotion':'Publish Promotion'}</button></form>`,()=>{
    const form=$('#promotionForm'),imageFile=form.imageFile,imagePreview=$('#promotionImagePreview'),submitButton=$('button.btn.full',form);
    bindImageGuideTabs(form);
    let previewUrl='',compressedBlob=null,compressionPromise=null;
    imageFile.onchange=async()=>{
      const file=imageFile.files[0];if(!file)return;
      compressedBlob=null;submitButton.disabled=true;
      imagePreview.innerHTML=`<span class="muted" style="font-size:12px">Compressing image for upload…</span>`;
      compressionPromise=compressImageTo100Kb(file);
      try{
        compressedBlob=await compressionPromise;
        if(previewUrl)URL.revokeObjectURL(previewUrl);
        previewUrl=URL.createObjectURL(compressedBlob);
        imagePreview.innerHTML=`<img src="${previewUrl}" alt="">`;
      }catch(error){imageFile.value='';imagePreview.innerHTML=promotion.imageUrl?`<img src="${html(promotion.imageUrl)}" alt="">`:'';toast(error.message)}
      finally{compressionPromise=null;submitButton.disabled=false}
    };
    form.onsubmit=async event=>{
      event.preventDefault();
      const raw=Object.fromEntries(new FormData(event.target)),button=event.submitter,ownerId=cloudOwnerId();
      const values={name:raw.name.trim(),offerText:raw.offerText.trim(),price:Math.max(0,Number(raw.price)||0),endsOn:raw.endsOn,badge:'Special Offer',active:$('input[name="active"]',event.target).checked,updatedAt:now()};
      if(!values.name)return toast('Enter a product name');
      if(!values.endsOn||values.endsOn<today)return toast('Choose today or a future offer end date');
      button.disabled=true;
      try{
        if(compressionPromise)await compressionPromise;
        if(imageFile.files[0]&&!compressedBlob)compressedBlob=await compressImageTo100Kb(imageFile.files[0]);
        if(compressedBlob){
          const oldFileId=promotion.imageFileId;
          const ext=compressedBlob.type==='image/webp'?'webp':compressedBlob.type==='image/png'?'png':'jpg';
          const upload=await api.uploadMenuMedia(new File([compressedBlob],`promo-${id('img')}.${ext}`,{type:compressedBlob.type}));
          values.imageUrl=upload.mediaUrl;values.imageFileId=upload.fileId;
          if(oldFileId&&oldFileId!==upload.fileId)api.removeMenuMedia(oldFileId).catch(()=>{});
        }
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
  try{
    await api.remove(promotionKind(promotion.ownerId),promotion.id);
    if(promotion.imageFileId)api.removeMenuMedia(promotion.imageFileId).catch(()=>{});
    state.promotions=state.promotions.filter(row=>row.id!==promotion.id);save();promotionsView();toast('Promotion deleted')
  }
  catch(error){toast(error.message||'Could not delete promotion')}
}
function shareStoreModal(storeId){
  const store=state.stores.find(row=>row.id===storeId);if(!store)return;
  const link=publicStoreLink(store);
  const whatsappText=encodeURIComponent(`Order your refills from ${store.name} here: ${link}`);
  modal('Share With Customers',`<p class="muted">Customers open this link, sign up, and see their reminder cards.</p><div class="field"><label>Customer link</label><input id="storeLinkOutput" readonly value="${html(link)}"></div><div class="actions"><button class="btn small green" id="copyStoreLink">Copy Link</button><a class="btn small" href="https://wa.me/?text=${whatsappText}" target="_blank" rel="noopener noreferrer">Share via WhatsApp</a></div><div class="qr-wrap" id="storeQr" style="margin-top:16px"></div>`,()=>{
    $('#copyStoreLink').onclick=async()=>{try{await navigator.clipboard.writeText(link);toast('Link copied')}catch{toast('Could not copy link')}};
    if(window.QRCode)new QRCode($('#storeQr'),{text:link,width:180,height:180});
  });
}
function shareBrandModal(storeId){
  const store=state.stores.find(row=>row.id===storeId);if(!store)return;
  const link=publicBrandLink(store);
  const whatsappText=encodeURIComponent(`Put your product's promotion card on ${store.name} — request it here: ${link}`);
  modal('Share With Brand Owners',`<p class="muted">Brand owners open this link, sign in (or create a brand account), and their request comes straight to you for approval — this store is pre-selected.</p><div class="field"><label>Brand link</label><input id="brandLinkOutput" readonly value="${html(link)}"></div><div class="actions"><button class="btn small green" id="copyBrandLink">Copy Link</button><a class="btn small" href="https://wa.me/?text=${whatsappText}" target="_blank" rel="noopener noreferrer">Share via WhatsApp</a></div><div class="qr-wrap" id="brandQr" style="margin-top:16px"></div>`,()=>{
    $('#copyBrandLink').onclick=async()=>{try{await navigator.clipboard.writeText(link);toast('Link copied')}catch{toast('Could not copy link')}};
    if(window.QRCode)new QRCode($('#brandQr'),{text:link,width:180,height:180});
  });
}

function customerWallView(){
  refreshView=customerWallView;
  const store=activeStore();
  const customers=ownerCustomers(store?.id);
  $('#page').innerHTML=`<div class="section-head"><div><h1>Customer Wall</h1><p class="muted">Customers who signed up under ${html(store?.name||'this store')}.</p></div><button class="btn secondary" id="openBulkOrder" ${customers.length?'':'disabled'}>+ Bulk Create Orders</button></div><div class="grid customer-grid">${customers.map(customerCardMarkup).join('')||'<div class="empty">No customers yet. Share your store link to get started.</div>'}</div>`;
  $$('[data-open-customer]').forEach(button=>button.onclick=()=>customerDetailView(button.dataset.openCustomer));
  $$('[data-remove-customer]').forEach(button=>button.onclick=()=>removeCustomer(button.dataset.removeCustomer));
  $('#openBulkOrder')?.addEventListener('click',()=>openBulkOrderForm(store,customers));
}
function bulkOrderCustomerRowMarkup(customer){
  return `<label class="bulk-order-customer-row"><input type="checkbox" name="customerId[]" value="${html(customer.id)}"><span>${html(customer.customerName||'Customer')}${customer.phone?` · ${html(customer.phone)}`:''}</span></label>`;
}
function openBulkOrderForm(store,customers){
  if(!customers.length)return;
  modal('Bulk Create Orders',`<form id="bulkOrderForm"><p class="muted">Creates the same order for every customer you select below. Each one still needs to accept it before it enters your normal queue.</p><label class="bulk-order-select-all"><input type="checkbox" id="bulkOrderSelectAll" checked> <span>Select all (${customers.length})</span></label><div class="bulk-order-customer-list">${customers.map(bulkOrderCustomerRowMarkup).join('')}</div><div id="bulkOrderItemRows">${orderItemRowMarkup()}</div><button type="button" class="btn small secondary" id="addBulkOrderItemRow" style="margin-top:8px">+ Add another item</button><button class="btn full" type="submit" style="margin-top:14px">Send Orders</button></form>`,()=>{
    $$('input[name="customerId[]"]').forEach(box=>box.checked=true);
    $('#bulkOrderSelectAll').onchange=event=>{$$('input[name="customerId[]"]').forEach(box=>box.checked=event.target.checked)};
    $('#addBulkOrderItemRow').onclick=()=>$('#bulkOrderItemRows').insertAdjacentHTML('beforeend',orderItemRowMarkup());
    $('#bulkOrderItemRows').addEventListener('click',event=>{const row=event.target.closest('.remove-item-row');if(row&&$$('#bulkOrderItemRows .order-item-row').length>1)row.closest('.order-item-row').remove()});
    $('#bulkOrderForm').onsubmit=async event=>{
      event.preventDefault();
      const customerIds=$$('input[name="customerId[]"]:checked').map(box=>box.value);
      if(!customerIds.length)return toast('Select at least one customer');
      const names=$$('#bulkOrderItemRows [name="itemName[]"]').map(input=>input.value.trim());
      const qtys=$$('#bulkOrderItemRows [name="itemQty[]"]').map(input=>Math.max(1,Number(input.value)||1));
      const items=names.map((name,index)=>({name,qty:qtys[index]})).filter(item=>item.name);
      if(!items.length)return toast('Add at least one item');
      const ownerId=cloudOwnerId(),button=event.submitter;button.disabled=true;
      let sent=0,failed=0;
      for(const customerId of customerIds){
        const customer=customers.find(row=>row.id===customerId);if(!customer)continue;
        try{
          const result=await api.executeFunction(api.config.digitalOrderFunctionId,{action:'digit58-owner-create-order',ownerId,storeId:customer.storeId,customerAccountId:customer.customerAccountId,items});
          state.orders.push(result.order);sent++;
        }catch{failed++}
      }
      save();closeModal();customerWallView();
      toast(failed?`${sent} order(s) sent, ${failed} failed`:`${sent} order(s) sent — waiting for customers to accept`);
    };
  });
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
  const store=state.stores.find(row=>row.id===customer.storeId);
  if(isServiceStore(store)){
    const copy=bookingCopy(store);
    const services=(state.services||[]).filter(row=>row.storeId===store.id);
    const experts=(state.experts||[]).filter(row=>row.storeId===store.id&&row.active!==false);
    const nowMs=Date.now();
    const bookingEndMs=row=>new Date(`${row.date}T${row.startTime}:00+05:30`).getTime()+Math.max(5,Number(row.durationMinutes)||30)*60000;
    const allBookings=(state.bookings||[]).filter(row=>row.storeId===store.id&&row.customerAccountId===customer.customerAccountId);
    const bookings=allBookings.filter(row=>!['Completed','Cancelled'].includes(row.status)&&bookingEndMs(row)>nowMs).sort((a,b)=>new Date(`${a.date}T${a.startTime}`)-new Date(`${b.date}T${b.startTime}`));
    const historyBookings=allBookings.filter(row=>['Completed','Cancelled'].includes(row.status)||bookingEndMs(row)<=nowMs).sort((a,b)=>bookingEndMs(b)-bookingEndMs(a));
    $('#page').innerHTML=`<div class="section-head"><div><h1>${html(customer.customerName||'Customer')}</h1><p class="muted">${html(customer.customerEmail||'')}</p></div><div class="actions"><button class="btn secondary" id="backToWall">← Back</button><button class="btn" id="addOwnerBooking" ${services.length?'':'disabled'}>${copy.bookButton}</button></div></div>
    <div class="section-head"><h2>Bookings</h2></div>
    <div class="grid card-grid">${bookings.map(booking=>ownerBookingMarkup(booking,store)).join('')||'<div class="empty">No active bookings from this customer.</div>'}</div>
    ${historyBookings.length?`<div class="section-head"><h2>Booking History</h2></div><div class="card table-wrap"><table><thead><tr><th>${copy.historyItem}</th><th>${copy.historyResource}</th><th>Amount</th><th>Status</th><th>Date &amp; Time</th></tr></thead><tbody>${historyBookings.map(customerWallBookingHistoryRow).join('')}</tbody></table></div>`:''}`;
    $('#backToWall').onclick=()=>{view='wall';renderShell()};
    $('#addOwnerBooking').onclick=()=>openBookingModal(store,customer,services,experts,'',customer);
    $$('[data-confirm-booking]').forEach(button=>button.onclick=()=>confirmBookingPayment(button.dataset.confirmBooking));
    $$('[data-complete-booking]').forEach(button=>button.onclick=()=>completeBooking(button.dataset.completeBooking));
    $$('[data-cancel-booking]').forEach(button=>button.onclick=()=>cancelBooking(button.dataset.cancelBooking));
    $$('[data-reopen-booking-payment]').forEach(button=>button.onclick=()=>reopenBookingPayment(button.dataset.reopenBookingPayment));
    bindBookingExpertShareButtons(bookings);
    bindBookingChatForms(bookings,'owner',refreshView);
    return;
  }
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
  'Pending Customer Acceptance':'The store started this order on your behalf — accept it below to continue',
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
const BOOKING_STEPS=[
  {key:'Requested',icon:'📝',label:'Requested'},
  {key:'Pending Payment',icon:'💳',label:'Payment'},
  {key:'Confirmed',icon:'✅',label:'Confirmed'},
  {key:'Completed',icon:'✨',label:'Completed'},
];
const BOOKING_STATUS_SUB={
  'Pending Customer Acceptance':'The store created this booking — review it below',
  Requested:'Your booking request is waiting for the store',
  'Pending Payment':'Complete payment to reserve your service slot',
  'Payment Verification':'Payment submitted — waiting for store verification',
  Confirmed:'Your service slot is confirmed',
  Completed:'Your service booking is complete',
  Cancelled:'This booking was cancelled',
};
function bookingStatusMarkup(status,store){
  const gameZone=isGameZone(store);
  const displayStatus=status==='Payment Verification'?'Pending Payment':status;
  const step=BOOKING_STEPS.find(item=>item.key===displayStatus);
  const icon=status==='Cancelled'?'🚫':status==='Pending Customer Acceptance'?'📞':(step?.icon||'📅');
  const label=status==='Cancelled'?'Booking Cancelled':status==='Pending Customer Acceptance'?'Review Booking':status;
  const slug=String(status||'').toLowerCase().replace(/[^a-z]+/g,'-');
  const serviceCopy=BOOKING_STATUS_SUB[status]||'';
  const statusCopy=gameZone?serviceCopy.replace('service slot','game slot').replace('service booking','game booking'):serviceCopy;
  return `<div class="big-status booking-status status-${slug} ${status==='Cancelled'?'rejected':''}"><span class="big-status-icon">${icon}</span><strong>${html(label)}</strong><small>${html(statusCopy)}</small></div>`;
}
function bookingStepperMarkup(status){
  if(status==='Cancelled')return `<div class="order-stepper booking-stepper"><div class="order-step current"><span class="order-step-icon">🚫</span><small>Cancelled</small></div></div>`;
  if(status==='Pending Customer Acceptance')return `<div class="order-stepper booking-stepper"><div class="order-step current"><span class="order-step-icon">📞</span><small>Review booking</small></div></div>`;
  const displayStatus=status==='Payment Verification'?'Pending Payment':status;
  const currentIndex=BOOKING_STEPS.findIndex(step=>step.key===displayStatus);
  return `<div class="order-stepper booking-stepper">${BOOKING_STEPS.map((step,index)=>`<div class="order-step ${index<=currentIndex?'done':''} ${index===currentIndex?'current':''}"><span class="order-step-icon">${step.icon}</span><small>${step.label}</small></div>`).join('')}</div>`;
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
function bookingChatMarkup(booking,role){
  const messages=(booking.messages||[]).slice(-8);
  return `<div class="order-chat"><div class="order-chat-log">${messages.map(message=>`<div class="order-message ${message.senderRole===role?'mine':''}"><strong>${html(message.senderRole==='owner'?'Store':message.senderName||'Customer')}</strong><span>${html(message.text)}</span></div>`).join('')||'<p class="muted no-messages">No messages yet.</p>'}</div><form class="order-chat-form" data-booking-chat="${html(booking.id)}"><input name="message" maxlength="240" placeholder="Message ${role==='owner'?'customer':'store'}"><button class="btn small" type="submit">Send</button></form></div>`;
}
async function sendBookingMessage(booking,role,text,onSent){
  const message={senderRole:role,senderName:role==='owner'?(session?.name||'Store'):(booking.customerName||'Customer'),text,createdAt:now()};
  const messages=[...(booking.messages||[]),message];
  try{
    await api.update(bookingKind(booking.ownerId),booking.id,{messages,updatedAt:now()});
    booking.messages=messages;
    onSent?.();
  }catch(error){toast(error.message||'Could not send message')}
}
function bindBookingChatForms(bookings,role,onSent){
  $$('[data-booking-chat]').forEach(form=>{
    form.onsubmit=async event=>{
      event.preventDefault();
      const bookingId=form.dataset.bookingChat,booking=bookings.find(b=>b.id===bookingId),input=form.querySelector('input[name="message"]'),text=input.value.trim();
      if(!text||!booking)return;
      input.value='';
      await sendBookingMessage(booking,role,text,onSent);
    };
  });
}
function ownerOrderMarkup(order,showCustomer,showStore){
  const ringing=ringingIds.has(order.id);
  const customer=showCustomer?state.customers.find(c=>c.customerAccountId===order.customerAccountId&&c.storeId===order.storeId):null;
  const store=showStore?state.stores.find(s=>s.id===order.storeId):null;
  const paymentReview=order.paymentMarkedAt?`<div class="razorpay-owner-review"><span>Razorpay payment submitted</span><strong>Verify payment before accepting</strong><small>Customer marked this payment completed ${new Date(order.paymentMarkedAt).toLocaleString('en-IN',{dateStyle:'medium',timeStyle:'short'})}.</small></div>`:'';
  const visibleStatus=order.paymentMarkedAt&&order.status==='Priced'?'Payment Verification':order.status;
  return `<article class="card order-item-card ${ringing?'incoming-order':''} ${order.paymentMarkedAt?'payment-awaiting':''}">${ringing?'<span class="incoming-order-beacon" aria-label="New order" title="New order"></span>':''}<div class="section-head"><h3>Order #${html(order.id.slice(-6).toUpperCase())}</h3><span class="chip ${['Requested','Priced','Minimum Approval Requested'].includes(order.status)?'due':''}">${html(visibleStatus)}</span></div>${showStore?`<p class="muted" style="margin:-8px 0 0"><strong>${html(store?.name||'Store')}</strong></p>`:''}${showCustomer?`<p class="muted" style="margin:-4px 0 4px">${html(customer?.customerName||order.customerName||'Customer')}</p>`:''}${order.refillCardId?'<span class="chip delivered">Refill order</span>':''}${order.status==='Minimum Approval Requested'?`<div class="minimum-approval-owner"><strong>Below-minimum approval requested</strong><span>Customer estimate ${money(order.customerOrderValue)} · Store minimum ${money(order.minimumOrderValueAtOrder)}</span></div>`:''}${orderStepperMarkup(order.status)}<div class="order-items-list">${order.items.map(item=>`<div class="order-line-item"><span>${item.qty} ×</span><span>${html(item.name)}</span></div>`).join('')}</div>${Number(order.customerOrderValue)>0?`<div class="customer-order-value"><span>Customer estimated order value</span><strong>${money(order.customerOrderValue)}</strong></div>`:''}${(order.reorderedFrom||order.refillCardId)&&Number(order.previousAmount)>0?`<div class="previous-price-note"><span>${order.refillCardId?'Previous refill price':'Previous order amount'}</span><strong>${money(order.previousAmount)}</strong></div>`:''}${order.prescriptionUrl?`<a class="link-btn" href="${html(order.prescriptionUrl)}" target="_blank" rel="noopener">📄 View prescription</a>`:''}${order.amount?`<h3 style="margin:10px 0">${money(order.amount)}</h3>`:'<p class="muted">Amount not set yet.</p>'}${paymentReview}${deliveryContactMarkup(order)}<div class="actions">${orderOwnerActions(order)}${order.amount>0?`<button type="button" class="btn small secondary" data-pos-print="${html(posPrintLink(order,order.amount,`Order #${order.id.slice(-6).toUpperCase()} — ${customer?.customerName||order.customerName||'Customer'}`))}" title="Print POS bill">${PRINT_ICON_SVG} Print</button>`:''}</div>${orderChatMarkup(order,'owner')}</article>`;
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
  bindPosPrintButtons();
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
  if(next==='Delivered'){changes.deliveredAt=now();changes.messages=[]}
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
      const names=$$('[name="itemName[]"]').map(input=>input.value.trim());
      const qtys=$$('[name="itemQty[]"]').map(input=>Math.max(1,Number(input.value)||1));
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
function modal(title,body,ready){document.body.classList.add('modal-open');document.body.insertAdjacentHTML('beforeend',`<div class="modal-backdrop" id="modal"><section class="modal"><div class="section-head"><h2>${title}</h2><button class="btn small secondary" id="closeModal">✕</button></div>${body}</section></div>`);$('#closeModal').onclick=closeModal;ready?.()}
function closeModal(){
  document.body.classList.remove('modal-open');
  $('#modal')?.remove();
  if(customerRenderPending&&activeCustomerContext){
    customerRenderPending=false;
    loadAndRenderCustomerView(activeCustomerContext.store,activeCustomerContext.customer);
  }
  setTimeout(showNextRejectedOrder,0);
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
  let linked;
  try{linked=await ensureCustomerLink(ownerId,storeId,account)}
  catch(error){
    app.innerHTML=`<main class="public-store"><section class="store-hero"><h1>${html(store.name)}</h1></section><div class="empty">Could not connect right now. ${html(error.message||'Please try again in a moment.')}<div class="actions" style="justify-content:center;margin-top:14px"><button class="btn small" id="retryCustomerLink" type="button">Try Again</button></div></div></main>${siteFooter(true)}`;
    (typeof bindAndroidAppFooter==='function'&&bindAndroidAppFooter());
    $('#retryCustomerLink').onclick=()=>renderPublicStore(hashParams);
    return;
  }
  customerStoreLinks=linked.stores?.length?linked.stores:[{ownerId,storeId,storeName:store.name,category:store.category,city:store.city}];
  if(!linked.customer.agreementAcceptedAt)return renderCustomerAgreementGate(store,linked.customer);
  await loadAndRenderCustomerView(store,linked.customer);
  startCustomerRealtime(store,linked.customer);
}
async function proceedAfterCustomerAgreement(store,customer){
  await loadAndRenderCustomerView(store,customer);
  startCustomerRealtime(store,customer);
}
function renderCustomerAgreementGate(store,customer){
  app.innerHTML=`<main class="public-store"><section class="store-hero"><h1>${html(store.name)}</h1></section><div class="card" style="text-align:left"><h3 style="margin-top:0">Before you continue</h3><p class="muted">${html(DIGIT58_CUSTOMER_AGREEMENT_TEXT)}</p><button class="btn full green" id="acceptCustomerAgreement" style="margin-top:14px">I Accept</button></div></main>${siteFooter(true)}`;
  (typeof bindAndroidAppFooter==='function'&&bindAndroidAppFooter());
  $('#acceptCustomerAgreement').onclick=async()=>{
    const button=$('#acceptCustomerAgreement');button.disabled=true;
    try{
      const agreementAcceptedAt=now();
      await api.update(customerKind(store.ownerId),customer.id,{agreementAcceptedAt});
      customer.agreementAcceptedAt=agreementAcceptedAt;
      proceedAfterCustomerAgreement(store,customer);
    }catch(error){button.disabled=false;toast(error.message||'Could not save your acceptance')}
  };
}
function openCustomerAgreementModal(store,customer){
  modal('Legal Agreement',`<p class="muted">${html(DIGIT58_CUSTOMER_AGREEMENT_TEXT)}</p>${customer.agreementAcceptedAt?`<p class="muted" style="margin-top:10px;font-size:12px">Accepted on ${html(new Date(customer.agreementAcceptedAt).toLocaleString('en-IN',{dateStyle:'medium',timeStyle:'short'}))}</p>`:''}`);
}
let activeCustomerContext=null,customerRenderPending=false;
function brandRequestAsPromotion(row){
  return {id:row.id,name:row.promotionName,offerText:row.offerText,price:row.price,imageUrl:row.imageUrl,endsOn:row.expiresAt?indiaDateValue(new Date(row.expiresAt)):'',active:true,isBrandCard:true};
}
async function loadAndRenderCustomerView(store,customer){
  activeCustomerContext={store,customer};
  const serviceStore=isServiceStore(store);
  const [cards,orders,promotions,courses,brandRequestsForStore,services,experts,bookings]=await Promise.all([
    api.list(cardKind(store.ownerId)).catch(()=>[]),
    api.list(orderKind(store.ownerId)).catch(()=>[]),
    api.list(promotionKind(store.ownerId)).catch(()=>[]),
    isMedicalStore(store)?api.list(courseKind(store.ownerId)).catch(()=>[]):Promise.resolve([]),
    api.list(BRAND_REQUEST_KIND).catch(()=>[]),
    serviceStore?api.list(serviceKind(store.ownerId)).catch(()=>[]):Promise.resolve([]),
    serviceStore?api.list(expertKind(store.ownerId)).catch(()=>[]):Promise.resolve([]),
    serviceStore?api.list(bookingKind(store.ownerId)).catch(()=>[]):Promise.resolve([]),
  ]);
  const myCards=cards.filter(row=>row.storeId===store.id&&row.customerAccountId===customer.customerAccountId);
  const myOrders=orders.filter(row=>row.storeId===store.id&&row.customerAccountId===customer.customerAccountId);
  const liveBrandCards=brandRequestsForStore.filter(row=>row.storeId===store.id&&row.status==='Live'&&(!row.expiresAt||new Date(row.expiresAt).getTime()>Date.now())).map(brandRequestAsPromotion);
  const myPromotions=[...promotions.filter(row=>row.storeId===store.id&&row.active!==false&&!promotionIsExpired(row)),...liveBrandCards];
  const myCourses=courses.filter(row=>row.storeId===store.id&&row.customerAccountId===customer.customerAccountId);
  const myServices=services.filter(row=>row.storeId===store.id&&row.active!==false);
  const myExperts=experts.filter(row=>row.storeId===store.id&&row.active!==false);
  const myBookings=bookings.filter(row=>row.storeId===store.id&&row.customerAccountId===customer.customerAccountId);
  customerBookingsCache=myBookings;
  const heardNewMessage=[checkForNewMessages(myOrders,'owner'),checkForNewMessages(myCards,'owner'),checkForNewMessages(myBookings,'owner')].some(Boolean);
  if(heardNewMessage)playChatMessageBeep();
  if($('.modal-backdrop')){customerRenderPending=true;return}
  customerRenderPending=false;
  renderCustomerCards(store,customer,myCards,myOrders,myPromotions,myCourses,myServices,myExperts,myBookings);
}
let customerOrdersUnsubscribe=null,customerCardsUnsubscribe=null,customerPromotionsUnsubscribe=null,customerCoursesUnsubscribe=null,customerBookingsUnsubscribe=null;
function startCustomerRealtime(store,customer){
  activeCustomerContext={store,customer};
  startMedicineAlarmTimer(store,customer);
  startBookingReminderTimer(store,customer);
  if(!api?.subscribeKind)return;
  customerOrdersUnsubscribe?.();
  customerOrdersUnsubscribe=api.subscribeKind(orderKind(store.ownerId),()=>loadAndRenderCustomerView(store,customer));
  customerCardsUnsubscribe?.();
  customerCardsUnsubscribe=api.subscribeKind(cardKind(store.ownerId),()=>loadAndRenderCustomerView(store,customer));
  customerPromotionsUnsubscribe?.();
  customerPromotionsUnsubscribe=api.subscribeKind(promotionKind(store.ownerId),()=>loadAndRenderCustomerView(store,customer));
  customerCoursesUnsubscribe?.();
  if(isMedicalStore(store))customerCoursesUnsubscribe=api.subscribeKind(courseKind(store.ownerId),()=>loadAndRenderCustomerView(store,customer));
  customerBookingsUnsubscribe?.();
  if(isServiceStore(store))customerBookingsUnsubscribe=api.subscribeKind(bookingKind(store.ownerId),()=>loadAndRenderCustomerView(store,customer));
}
function stopCustomerRealtime(){customerOrdersUnsubscribe?.();customerCardsUnsubscribe?.();customerPromotionsUnsubscribe?.();customerCoursesUnsubscribe?.();customerBookingsUnsubscribe?.();customerOrdersUnsubscribe=customerCardsUnsubscribe=customerPromotionsUnsubscribe=customerCoursesUnsubscribe=customerBookingsUnsubscribe=null;stopPromotionAutoScroll();clearTimeout(promotionAutoScrollResumeTimer);stopMedicineAlarmTimer();stopBookingReminderTimer();dueReminderRung.clear();pendingDueBeep=false;medicineAlarmRung.clear();bookingReminderRung.clear();knownMessageCounts.clear();resetRejectedOrderNotifications();activeCustomerContext=null;customerRenderPending=false;stopIncomingCallRing()}
const VAPID_PUBLIC_KEY='BBWHhjt1keQag3HnZIooxS1pJvelQ8CuQ6eWBxFp9AStQLDpTzZqwKHmwj_gomaCpNBykqJRo6AsmfbC0roZoEY';
function urlBase64ToUint8Array(base64String){
  const padding='='.repeat((4-base64String.length%4)%4);
  const base64=(base64String+padding).replace(/-/g,'+').replace(/_/g,'/');
  const rawData=atob(base64);
  const outputArray=new Uint8Array(rawData.length);
  for(let i=0;i<rawData.length;i++)outputArray[i]=rawData.charCodeAt(i);
  return outputArray;
}
function isStandalonePwa(){return window.matchMedia('(display-mode: standalone)').matches||window.navigator.standalone===true}
function isIOSDevice(){return /iphone|ipad|ipod/i.test(navigator.userAgent)}
function pushDismissKey(store){return `g58-push-hint-dismissed:${store.ownerId}:${store.id}`}
async function subscribeToPush(store,customer){
  if(!('serviceWorker' in navigator)||!('PushManager' in window))return null;
  try{
    const registration=await navigator.serviceWorker.register('/digit58/sw.js');
    const permission=await Notification.requestPermission();
    if(permission!=='granted')return null;
    let subscription=await registration.pushManager.getSubscription();
    if(!subscription){
      subscription=await registration.pushManager.subscribe({
        userVisibleOnly:true,
        applicationServerKey:urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
      });
    }
    await api.executeFunction(api.config.digitalOrderFunctionId,{
      action:'digit58-save-push-subscription',
      ownerId:store.ownerId,storeId:store.id,
      subscription:subscription.toJSON(),
    });
    return subscription;
  }catch(error){console.warn('Push subscription failed',error);return null}
}
function isNativePushAvailable(){return !!(window.Capacitor&&window.Capacitor.Plugins&&window.Capacitor.Plugins.PushNotifications)}
async function subscribeToNativePush(store,customer){
  const {PushNotifications}=window.Capacitor.Plugins;
  try{
    let status=await PushNotifications.checkPermissions();
    if(status.receive==='prompt'||status.receive==='prompt-with-rationale')status=await PushNotifications.requestPermissions();
    if(status.receive!=='granted')return null;
    return await new Promise(resolve=>{
      let settled=false;
      const finish=async token=>{
        if(settled)return;settled=true;
        registrationHandle.remove();errorHandle.remove();
        if(!token){resolve(null);return}
        try{
          await api.executeFunction(api.config.digitalOrderFunctionId,{
            action:'digit58-save-fcm-token',
            ownerId:store.ownerId,storeId:store.id,
            token,
          });
          resolve(token);
        }catch(error){console.warn('Save FCM token failed',error);resolve(null)}
      };
      const registrationHandle=PushNotifications.addListener('registration',token=>finish(token?.value||null));
      const errorHandle=PushNotifications.addListener('registrationError',error=>{console.warn('FCM registration error',error);finish(null)});
      PushNotifications.register();
    });
  }catch(error){console.warn('Native push subscription failed',error);return null}
}
async function renderPushPrompt(store,customer){
  const container=$('#pushNotifyPrompt');
  if(!container)return;
  if(localStorage.getItem(pushDismissKey(store))==='1'){container.innerHTML='';return}
  if(isNativePushAvailable()){
    const nativeStatus=await window.Capacitor.Plugins.PushNotifications.checkPermissions().catch(()=>({receive:'prompt'}));
    if(nativeStatus.receive==='granted'){container.innerHTML='';return}
    container.innerHTML=`<div class="push-hint-card"><p>Get notified about your orders — even when the app is closed.</p><div class="push-hint-actions"><button type="button" class="btn small green" id="pushEnableBtn">Enable Notifications</button><button type="button" class="push-hint-dismiss" id="pushHintDismiss">Not now</button></div></div>`;
    $('#pushEnableBtn').onclick=async()=>{
      const token=await subscribeToNativePush(store,customer);
      if(token){toast('Notifications enabled');container.innerHTML=''}
      else toast('Could not enable notifications');
    };
    $('#pushHintDismiss').onclick=()=>{localStorage.setItem(pushDismissKey(store),'1');container.innerHTML=''};
    return;
  }
  if(!('Notification' in window)||!('serviceWorker' in navigator)||!('PushManager' in window)){
    if(isRefillsCustomerApp()){
      container.innerHTML=`<div class="push-hint-card"><p>Order notifications aren't available inside this app. Open <strong>g58.in/digit58/</strong> in Chrome or Safari on your phone to enable them.</p><button type="button" class="push-hint-dismiss" id="pushHintDismiss">Not now</button></div>`;
      $('#pushHintDismiss').onclick=()=>{localStorage.setItem(pushDismissKey(store),'1');container.innerHTML=''};
    }else{
      container.innerHTML='';
    }
    return;
  }
  if(Notification.permission==='granted'){container.innerHTML='';return}
  if(isIOSDevice()&&!isStandalonePwa()){
    container.innerHTML=`<div class="push-hint-card"><p>Add this page to your Home Screen (Share → Add to Home Screen) to get notified about your orders — even when this page is closed.</p><button type="button" class="push-hint-dismiss" id="pushHintDismiss">Not now</button></div>`;
    $('#pushHintDismiss').onclick=()=>{localStorage.setItem(pushDismissKey(store),'1');container.innerHTML=''};
    return;
  }
  container.innerHTML=`<div class="push-hint-card"><p>Get notified about your orders — even when this page is closed.</p><div class="push-hint-actions"><button type="button" class="btn small green" id="pushEnableBtn">Enable Notifications</button><button type="button" class="push-hint-dismiss" id="pushHintDismiss">Not now</button></div></div>`;
  $('#pushEnableBtn').onclick=async()=>{
    const subscription=await subscribeToPush(store,customer);
    if(subscription){toast('Notifications enabled');container.innerHTML=''}
    else toast('Could not enable notifications');
  };
  $('#pushHintDismiss').onclick=()=>{localStorage.setItem(pushDismissKey(store),'1');container.innerHTML=''};
}
function initPushNotifications(store,customer){renderPushPrompt(store,customer)}
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
let rejectedOrderNotificationContext='',rejectedOrderSnapshots=new Map(),rejectedOrderNotificationQueue=[];
const shownRejectedOrderEvents=new Set(),customerSuppressedRejectionIds=new Set();
function resetRejectedOrderNotifications(){
  rejectedOrderNotificationContext='';
  rejectedOrderSnapshots=new Map();
  rejectedOrderNotificationQueue=[];
  shownRejectedOrderEvents.clear();
  customerSuppressedRejectionIds.clear();
}
function rejectedOrderSnapshot(order){return {status:order.status,rejectedAt:order.rejectedAt||''}}
function rejectedOrderEventKey(order){return `${order.id}:${order.rejectedAt||order.updatedAt||''}`}
function queueRejectedOrderNotifications(orders,store,customer,promotions=[]){
  const context=`${store.ownerId}:${store.id}:${customer.customerAccountId}`;
  if(rejectedOrderNotificationContext!==context){
    rejectedOrderNotificationContext=context;
    rejectedOrderSnapshots=new Map(orders.map(order=>[order.id,rejectedOrderSnapshot(order)]));
    rejectedOrderNotificationQueue=[];
    shownRejectedOrderEvents.clear();
    customerSuppressedRejectionIds.clear();
    return;
  }
  const presentIds=new Set(orders.map(order=>order.id));
  const queuedEvents=new Set(rejectedOrderNotificationQueue.map(entry=>entry.eventKey));
  orders.forEach(order=>{
    const previous=rejectedOrderSnapshots.get(order.id);
    const newlyRejected=order.status==='Rejected'&&previous&&previous.status!=='Rejected';
    const eventKey=rejectedOrderEventKey(order);
    if(newlyRejected&&!customerSuppressedRejectionIds.has(order.id)&&!shownRejectedOrderEvents.has(eventKey)&&!queuedEvents.has(eventKey)){
      rejectedOrderNotificationQueue.push({order,store,customer,promotions,eventKey});
      queuedEvents.add(eventKey);
    }
    rejectedOrderSnapshots.set(order.id,rejectedOrderSnapshot(order));
  });
  [...rejectedOrderSnapshots.keys()].forEach(orderId=>{if(!presentIds.has(orderId))rejectedOrderSnapshots.delete(orderId)});
  setTimeout(showNextRejectedOrder,0);
}
function showNextRejectedOrder(){
  if($('.modal-backdrop')||$('.incoming-call-overlay'))return;
  const notification=rejectedOrderNotificationQueue.shift();
  if(!notification)return;
  const {order,store,customer,promotions,eventKey}=notification;
  shownRejectedOrderEvents.add(eventKey);
  const reason=order.rejectionReason||'The store could not process this order. Contact the store if you need more information.';
  const storePhone=String(store.phone||'').replace(/[^\d+]/g,'');
  modal('Order Rejected',`<div class="rejection-popup"><span class="rejection-popup-icon" aria-hidden="true">!</span><p>Your order from <strong>${html(store.name)}</strong> was rejected.</p><div class="rejection-reason"><small>Reason</small><strong>${html(reason)}</strong></div><p class="muted">Order #${html(order.id.slice(-6).toUpperCase())}</p><div class="rejection-next-actions"><button class="btn full" id="reviseRejectedOrder" type="button">Revise &amp; Resubmit</button><button class="btn full secondary" id="viewRejectedHistory" type="button">View Order History</button>${storePhone?`<a class="btn full secondary" id="callRejectedStore" href="tel:${html(storePhone)}">Call ${html(store.name)}</a>`:''}<button class="rejection-dismiss" id="dismissRejectedOrder" type="button">Close</button></div></div>`,()=>{
    const acknowledge=()=>closeModal();
    $('#reviseRejectedOrder').onclick=()=>{acknowledge();openPlaceOrderModal(store,customer,promotions,order)};
    $('#viewRejectedHistory').onclick=()=>{acknowledge();setTimeout(()=>$('#customerOrderHistory')?.scrollIntoView({behavior:'smooth',block:'start'}),0)};
    $('#dismissRejectedOrder').onclick=acknowledge;
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
let promotionAutoScrollResumeTimer=null;
function stopPromotionAutoScroll(){const rail=$('#promotionRail');rail?.classList.remove('is-auto-scrolling')}
function pausePromotionAutoScroll(){
  stopPromotionAutoScroll();
  $('#promotionRail')?.classList.add('is-paused');
  clearTimeout(promotionAutoScrollResumeTimer);
  promotionAutoScrollResumeTimer=setTimeout(startPromotionAutoScroll,3000);
}
function startPromotionAutoScroll(){
  stopPromotionAutoScroll();
  const rail=$('#promotionRail');if(!rail||rail.scrollWidth<=rail.clientWidth)return;
  rail.classList.remove('is-paused');
  rail.onpointerdown=()=>pausePromotionAutoScroll();
  requestAnimationFrame(()=>rail.classList.add('is-auto-scrolling'));
}
function promotionQuantityControl(promotionId){
  const qty=customerPromotionQuantities.get(promotionId)||0;
  return qty>0?`<div class="promotion-stepper" aria-label="Selected quantity"><button type="button" data-promotion-minus="${html(promotionId)}" aria-label="Remove one">−</button><strong>${qty}</strong><button type="button" data-promotion-plus="${html(promotionId)}" aria-label="Add one">+</button></div>`:`<button type="button" class="promotion-add" data-promotion-add="${html(promotionId)}"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/></svg>Buy</button>`;
}
function adjustPromotionQuantity(promotions,promotionId,delta){
  if(!promotions.some(row=>row.id===promotionId))return;
  pausePromotionAutoScroll();
  const next=Math.max(0,Math.min(99,(customerPromotionQuantities.get(promotionId)||0)+delta));
  if(next)customerPromotionQuantities.set(promotionId,next);else customerPromotionQuantities.delete(promotionId);
  $$(`[data-promotion-control="${CSS.escape(promotionId)}"]`).forEach(control=>{control.innerHTML=promotionQuantityControl(promotionId)});
  refreshPromotionCartBar(promotions);
  bindCustomerPromotionActions(promotions);
}
function refreshPromotionCartBar(promotions){
  const bar=$('#promotionCartBar');if(!bar)return;
  const selected=promotions.filter(promotion=>customerPromotionQuantities.has(promotion.id));
  const count=selected.reduce((sum,promotion)=>sum+customerPromotionQuantities.get(promotion.id),0);
  if(!count){bar.hidden=true;bar.classList.remove('is-expanded');return}
  const total=selected.reduce((sum,promotion)=>sum+customerPromotionQuantities.get(promotion.id)*(Number(promotion.price)||0),0);
  bar.hidden=false;
  $('#promotionCartCount',bar).textContent=`${count} item${count===1?'':'s'} selected`;
  $('#promotionCartTotal',bar).textContent=money(total);
  $('#promotionCartItems',bar).innerHTML=selected.map(promotion=>{
    const qty=customerPromotionQuantities.get(promotion.id);
    return `<div class="promotion-cart-item"><span>${html(promotion.name)}</span><div class="promotion-stepper" aria-label="Quantity"><button type="button" data-cart-minus="${html(promotion.id)}" aria-label="Remove one">−</button><strong>${qty}</strong><button type="button" data-cart-plus="${html(promotion.id)}" aria-label="Add one">+</button></div></div>`;
  }).join('');
  $$('[data-cart-plus]',bar).forEach(button=>button.onclick=()=>adjustPromotionQuantity(promotions,button.dataset.cartPlus,1));
  $$('[data-cart-minus]',bar).forEach(button=>button.onclick=()=>adjustPromotionQuantity(promotions,button.dataset.cartMinus,-1));
}
function customerPromotionTicket(promotion,decorative=false){
  const hasImage=Boolean(promotion.imageUrl);
  return `<article class="promotion-ticket customer-ticket ${hasImage?'brand-art-ticket':''}" aria-label="${html(promotion.name)}" ${decorative?'aria-hidden="true"':''}>${hasImage?`<div class="promotion-ticket-image"><img src="${html(promotion.imageUrl)}" alt="${html(promotion.name)}" loading="lazy" decoding="async"></div>`:''}<h3 class="promotion-product-title">${html(promotion.name)}</h3>${Number(promotion.price)>0?`<strong class="promotion-offer-price">₹${Math.round(promotion.price)}/- only</strong>`:''}${promotion.endsOn?`<small class="promotion-end-date">Offer ends ${html(formatPromotionEnd(promotion.endsOn))}</small>`:''}<div class="promotion-ticket-foot"><div class="promotion-control" data-promotion-control="${html(promotion.id)}">${promotionQuantityControl(promotion.id)}</div></div></article>`;
}
function bindCustomerPromotionActions(promotions){
  $$('[data-promotion-add]').forEach(button=>button.onclick=()=>adjustPromotionQuantity(promotions,button.dataset.promotionAdd,1));
  $$('[data-promotion-plus]').forEach(button=>button.onclick=()=>adjustPromotionQuantity(promotions,button.dataset.promotionPlus,1));
  $$('[data-promotion-minus]').forEach(button=>button.onclick=()=>adjustPromotionQuantity(promotions,button.dataset.promotionMinus,-1));
  refreshPromotionCartBar(promotions);
}
function renderCustomerCards(store,customer,cards,orders=[],promotions=[],courses=[],services=[],experts=[],bookings=[]){
  if(activePromotionStoreId!==store.id){activePromotionStoreId=store.id;customerPromotionQuantities.clear()}
  ringDueReminders(cards);
  ringCustomerPortalUpdates(store,customer,orders,bookings);
  customerCoursesCache=courses;
  const active=activeOrders(orders).sort((a,b)=>new Date(b.createdAt)-new Date(a.createdAt));
  const history=orderHistoryOrders(orders).sort((a,b)=>new Date(b.updatedAt||b.createdAt)-new Date(a.updatedAt||a.createdAt));
  const today=indiaDateValue(),historyFrom=$('#customerHistoryFrom')?.value||today,historyTo=$('#customerHistoryTo')?.value||today;
  const filteredHistory=filterOrdersByIndiaDate(history,historyFrom,historyTo).sort((a,b)=>new Date(orderHistoryTimestamp(b))-new Date(orderHistoryTimestamp(a)));
  const medical=isMedicalStore(store);
  const activeCourseList=activeCourses(courses).sort((a,b)=>new Date(b.createdAt)-new Date(a.createdAt));
  const completedCourseList=completedCourses(courses);
  const courseHistoryFrom=$('#courseHistoryFrom')?.value||'',courseHistoryTo=$('#courseHistoryTo')?.value||'';
  const courseHistoryFiltered=(courseHistoryFrom||courseHistoryTo)
    ?filterCoursesByIndiaDate(completedCourseList,courseHistoryFrom,courseHistoryTo).sort((a,b)=>new Date(courseCompletionDate(b))-new Date(courseCompletionDate(a)))
    :latestCoursePerPatient(completedCourseList).sort((a,b)=>new Date(courseCompletionDate(b))-new Date(courseCompletionDate(a)));
  const marqueePromotions=promotions.length?Array.from({length:Math.max(1,Math.ceil(6/promotions.length))},()=>promotions).flat():[];
  const serviceStoreFlag=isServiceStore(store);
  const gameZone=isGameZone(store),copy=bookingCopy(store);
  const bookingEndMs=row=>{const end=new Date(`${row.date}T${row.startTime}:00+05:30`);return Number.isNaN(end.getTime())?Infinity:end.getTime()+Math.max(5,Number(row.durationMinutes)||30)*60000};
  const activeBookings=bookings.filter(row=>!['Completed','Cancelled'].includes(row.status)).sort((a,b)=>new Date(`${a.date}T${a.startTime}`)-new Date(`${b.date}T${b.startTime}`));
  const visibleBookings=activeBookings.filter(row=>bookingEndMs(row)>Date.now());
  const bookingHistoryAll=[...bookings.filter(row=>['Completed','Cancelled'].includes(row.status)),...activeBookings.filter(row=>bookingEndMs(row)<=Date.now())];
  const cancellationPaymentsDue=unpaidCancellationBookings(bookings);
  const cancellationPaymentsTotal=cancellationPaymentsDue.reduce((sum,row)=>sum+(Number(row.cancellationDueAmount)||0),0);
  const bookingHistoryFrom=$('#customerBookingHistoryFrom')?.value||today,bookingHistoryTo=$('#customerBookingHistoryTo')?.value||today;
  const filteredBookingHistory=filterBookingsByIndiaDate(bookingHistoryAll,bookingHistoryFrom,bookingHistoryTo).sort((a,b)=>new Date(bookingHistoryTimestamp(b))-new Date(bookingHistoryTimestamp(a)));
  const dueServiceReminders=gameZone?[]:bookings.filter(row=>row.status==='Completed'&&row.nextReminderAt&&new Date(row.nextReminderAt).getTime()<=Date.now());
  const reminderCardsMarkup=`<div class="section-head reminder-section-head"><div><h2>Your reminder cards</h2>${cards.length>1?'<p class="muted">Swipe to see the next card or switch to list view.</p>':''}</div>${cards.length>1?`<div class="reminder-view-toggle" role="group" aria-label="Reminder card view"><button type="button" class="${customerReminderView==='swipe'?'active':''}" data-reminder-view="swipe" aria-pressed="${customerReminderView==='swipe'}">Swipe</button><button type="button" class="${customerReminderView==='list'?'active':''}" data-reminder-view="list" aria-pressed="${customerReminderView==='list'}">List</button></div>`:''}</div>
  <div class="customer-reminder-view reminder-view-${customerReminderView}" id="customerCardGrid">${cards.map(customerCardCardMarkup).join('')||'<div class="empty">Your store will add reminder cards here after your first purchase.</div>'}</div>`;
  app.innerHTML=`<main class="public-store">${customerBrandStrip()}${customerStoreHub(store)}<div id="pushNotifyPrompt"></div><section class="store-hero"><span class="chip">${html(store.category||'Store')}</span>${store.highlightText?`<strong class="store-highlight-text">${html(store.highlightText)}</strong>`:''}<h1>${html(store.name)}</h1>${customer.phone?`<p class="customer-phone-line">Your contact number: ${html(customer.phone)}</p>`:''}${storeMinimum(store)?`<p class="store-minimum-order">Minimum new order ${money(storeMinimum(store))}</p>`:''}<p class="muted">${html(store.description||'')}${store.city?' · '+html(store.city):''}</p></section>
  ${promotions.length?`<section class="promotion-strip"><div class="promotion-strip-head"><span>Store Offers</span></div><div class="promotion-rail" id="promotionRail"><div class="promotion-track"><div class="promotion-sequence">${marqueePromotions.map((promotion,index)=>customerPromotionTicket(promotion,index>=promotions.length)).join('')}</div><div class="promotion-sequence" aria-hidden="true">${marqueePromotions.map(promotion=>customerPromotionTicket(promotion,true)).join('')}</div></div></div></section>`:''}
  ${serviceStoreFlag?`${cancellationPaymentsDue.length?`<section class="cancellation-payment-section"><div class="section-head"><div><h2>Cancellation payment required</h2><p class="muted">${money(cancellationPaymentsTotal)} must be confirmed by this store before another booking can be made.</p></div></div><div class="grid card-grid">${cancellationPaymentsDue.map(booking=>cancellationPaymentCardMarkup(booking,store)).join('')}</div></section>`:''}${dueServiceReminders.length?`<div class="section-head"><h2>Time to Book Again?</h2></div><div class="grid card-grid">${dueServiceReminders.map(serviceReminderMarkup).join('')}</div>`:''}<div class="section-head"><div><h2>${copy.bookTitle}</h2><p class="muted">${cancellationPaymentsDue.length?`Bookings are locked until ${money(cancellationPaymentsTotal)} cancellation payment is confirmed.`:gameZone?'Choose a game, select a play area and reserve an available time slot.':'Pick a service, choose a slot and pay the prepayment to confirm.'}</p></div>${store.emergencyMode?'':`<button class="btn small" id="bookServiceBtn" ${cancellationPaymentsDue.length?'disabled':''}>${cancellationPaymentsDue.length?'Payment Required':copy.bookButton}</button>`}</div>${store.emergencyMode?`<p class="muted">This ${gameZone?'game zone':'store'} is not accepting new bookings right now — please check back shortly.</p>`:''}<div class="grid card-grid">${visibleBookings.map(booking=>customerBookingMarkup(booking,store)).join('')||`<div class="empty">${copy.empty}</div>`}</div>
  ${reminderCardsMarkup}
  ${bookingHistoryAll.length?`<section class="order-history-section" id="customerBookingHistory"><div class="section-head"><div><h2>Booking History</h2><p class="muted">Today's completed and cancelled bookings are shown by default. Select a different date range if needed.</p></div></div><div class="date-filter-bar"><label>From<input id="customerBookingHistoryFrom" type="date" value="${html(bookingHistoryFrom)}" max="${html(bookingHistoryTo)}"></label><label>To<input id="customerBookingHistoryTo" type="date" value="${html(bookingHistoryTo)}" min="${html(bookingHistoryFrom)}"></label><button class="btn small secondary" id="customerBookingHistoryToday" type="button">Today</button></div><div class="card table-wrap"><table><thead><tr><th>${copy.historyItem}</th><th>${copy.historyResource}</th><th>Amount</th><th>Status</th><th>Date</th></tr></thead><tbody>${filteredBookingHistory.map(booking=>customerBookingHistoryRow(booking,store)).join('')||'<tr><td colspan="5">No bookings in this period.</td></tr>'}</tbody></table></div></section>`:''}`:''}
  ${serviceStoreFlag?'':`<div class="section-head"><div><h2>Your orders</h2>${storeMinimum(store)?`<p class="muted">New orders must be at least ${money(storeMinimum(store))}. Refill and reorder requests are exempt.</p>`:''}</div><button class="btn small" id="placeOrderBtn">+ Place New Order</button></div>
  <div class="grid card-grid">${active.map(order=>customerOrderMarkup(order,store)).join('')||'<div class="empty">No active orders. Place a new order to get started.</div>'}</div>`}
  ${serviceStoreFlag?'':reminderCardsMarkup}
  ${medical?`<div class="section-head"><div><h2>Medicine Courses</h2><p class="muted">Add the patient, medicine, time, and days from your prescription — you'll receive a daily alarm.</p></div><button class="btn small" id="newCourseBtn">+ New Course</button></div><div class="grid card-grid">${activeCourseList.map(courseMarkup).join('')||'<div class="empty">No active medicine courses yet.</div>'}</div>${completedCourseList.length?`<section class="order-history-section" id="courseHistorySection"><div class="section-head"><div><h2>Course History</h2><p class="muted">The latest course per patient is shown by default. Choose a date range to see more.</p></div></div><div class="date-filter-bar"><label>From<input id="courseHistoryFrom" type="date" value="${html(courseHistoryFrom)}"></label><label>To<input id="courseHistoryTo" type="date" value="${html(courseHistoryTo)}"></label><button class="btn small secondary" id="courseHistoryClear" type="button">Show Latest</button></div><div class="card table-wrap"><table><thead><tr><th>Patient</th><th>Medicines</th><th>Completed</th></tr></thead><tbody>${courseHistoryFiltered.map(courseHistoryRow).join('')||'<tr><td colspan="3">No courses in this period.</td></tr>'}</tbody></table></div></section>`:''}`:''}
  ${history.length?`<section class="order-history-section" id="customerOrderHistory"><div class="section-head"><div><h2>Order History</h2><p class="muted">Today's orders are shown by default. Select a different date range if needed.</p></div><button class="btn small secondary" id="exportCustomerHistory" ${filteredHistory.length?'':'disabled'}>Export CSV</button></div><div class="date-filter-bar"><label>From<input id="customerHistoryFrom" type="date" value="${html(historyFrom)}" max="${html(historyTo)}"></label><label>To<input id="customerHistoryTo" type="date" value="${html(historyTo)}" min="${html(historyFrom)}"></label><button class="btn small secondary" id="customerHistoryToday" type="button">Today</button></div><div class="card table-wrap"><table><thead><tr><th>Items</th><th>Reorder</th><th>Amount</th><th>Status</th><th>Date</th></tr></thead><tbody>${filteredHistory.map(customerOrderHistoryRow).join('')||'<tr><td colspan="5">No orders in this period.</td></tr>'}</tbody></table></div></section>`:''}
  <div class="actions" style="margin-top:20px"><button class="btn secondary" id="viewAgreementBtn">Legal Agreement</button><button class="btn secondary" id="custLogout">Sign out</button></div></main><div class="promotion-cart-bar" id="promotionCartBar" hidden><div class="promotion-cart-items" id="promotionCartItems"></div><div class="promotion-cart-summary" id="promotionCartSummary"><div class="promotion-cart-info"><strong id="promotionCartCount">0 items selected</strong><span id="promotionCartTotal">₹0</span></div><button type="button" class="btn" id="promotionCartCheckout">Checkout</button></div></div>${siteFooter(true)}${floatingStoreWhatsappButton(store)}`;
  active.filter(order=>order.status==='Priced'&&order.upiUri).forEach(order=>{
    const target=document.getElementById(`qr-${order.id}`);
    if(target&&window.QRCode)new QRCode(target,{text:order.upiUri,width:180,height:180});
  });
  activeBookings.filter(booking=>booking.status==='Pending Payment'&&booking.upiUri&&!booking.paymentMarkedAt).forEach(booking=>{
    const target=document.getElementById(`booking-qr-${booking.id}`);
    if(target&&window.QRCode)new QRCode(target,{text:booking.upiUri,width:180,height:180});
  });
  cancellationPaymentsDue.filter(booking=>booking.cancellationPaymentStatus==='Due'&&booking.cancellationPaymentUpiUri).forEach(booking=>{
    const target=document.getElementById(`cancellation-qr-${booking.id}`);
    if(target&&window.QRCode)new QRCode(target,{text:booking.cancellationPaymentUpiUri,width:180,height:180});
  });
  bindCustomerPromotionActions(promotions);
  bindCustomerStoreHub(store);
  startPromotionAutoScroll();
  bindRazorpayPaymentActions(active,store,customer);
  bindBookingRazorpayPaymentActions(activeBookings,store,customer);
  $('#viewAgreementBtn').onclick=()=>openCustomerAgreementModal(store,customer);
  $('#placeOrderBtn')?.addEventListener('click',()=>openPlaceOrderModal(store,customer,promotions));
  $('#bookServiceBtn')?.addEventListener('click',()=>openBookingModal(store,customer,services,experts));
  $$('[data-rebook-service]').forEach(button=>button.onclick=()=>openBookingModal(store,customer,services,experts,button.dataset.rebookService));
  $('#promotionCartCheckout').onclick=()=>openPlaceOrderModal(store,customer,promotions);
  $('#promotionCartSummary').onclick=event=>{if(event.target.closest('#promotionCartCheckout'))return;$('#promotionCartBar').classList.toggle('is-expanded')};
  $$('[data-accept-owner-order]').forEach(button=>button.onclick=()=>acceptOwnerOrder(store,customer,button.dataset.acceptOwnerOrder));
  $$('[data-reject-owner-order]').forEach(button=>button.onclick=()=>rejectOwnerOrder(store,customer,button.dataset.rejectOwnerOrder));
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
  $('#customerHistoryFrom')?.addEventListener('change',()=>renderCustomerCards(store,customer,cards,orders,promotions,courses,services,experts,bookings));
  $('#customerHistoryTo')?.addEventListener('change',()=>renderCustomerCards(store,customer,cards,orders,promotions,courses,services,experts,bookings));
  $('#customerHistoryToday')?.addEventListener('click',()=>{$('#customerHistoryFrom').value=today;$('#customerHistoryTo').value=today;renderCustomerCards(store,customer,cards,orders,promotions,courses,services,experts,bookings)});
  $('#customerBookingHistoryFrom')?.addEventListener('change',()=>renderCustomerCards(store,customer,cards,orders,promotions,courses,services,experts,bookings));
  $('#customerBookingHistoryTo')?.addEventListener('change',()=>renderCustomerCards(store,customer,cards,orders,promotions,courses,services,experts,bookings));
  $('#customerBookingHistoryToday')?.addEventListener('click',()=>{$('#customerBookingHistoryFrom').value=today;$('#customerBookingHistoryTo').value=today;renderCustomerCards(store,customer,cards,orders,promotions,courses,services,experts,bookings)});
  $('#exportCustomerHistory')?.addEventListener('click',()=>downloadOrderHistoryCsv(filteredHistory,{filePrefix:`${store.name||'store'}-my-orders`.toLowerCase().replace(/[^a-z0-9]+/g,'-'),storeName:store.name||'Store'}));
  $('#newCourseBtn')?.addEventListener('click',()=>openCreateCourseModal(store,customer));
  $$('[data-add-medicine]').forEach(button=>button.onclick=()=>{
    const course=courses.find(row=>row.id===button.dataset.addMedicine);
    if(course)openAddMedicineModal(store,customer,course);
  });
  $('#courseHistoryFrom')?.addEventListener('change',()=>renderCustomerCards(store,customer,cards,orders,promotions,courses,services,experts,bookings));
  $('#courseHistoryTo')?.addEventListener('change',()=>renderCustomerCards(store,customer,cards,orders,promotions,courses,services,experts,bookings));
  $('#courseHistoryClear')?.addEventListener('click',()=>{$('#courseHistoryFrom').value='';$('#courseHistoryTo').value='';renderCustomerCards(store,customer,cards,orders,promotions,courses,services,experts,bookings)});
  bindOrderChatForms(active,'customer',()=>loadAndRenderCustomerView(store,customer));
  bindCardChatForms(cards,'customer',()=>loadAndRenderCustomerView(store,customer));
  bindBookingChatForms(activeBookings,'customer',()=>loadAndRenderCustomerView(store,customer));
  $$('[data-cancel-my-booking]').forEach(button=>button.onclick=()=>{
    const booking=activeBookings.find(row=>row.id===button.dataset.cancelMyBooking);
    if(booking)cancelCustomerBooking(booking,store,customer);
  });
  $$('[data-accept-owner-booking]').forEach(button=>button.onclick=()=>acceptOwnerBooking(store,customer,button.dataset.acceptOwnerBooking));
  $$('[data-reject-owner-booking]').forEach(button=>button.onclick=()=>rejectOwnerBooking(store,customer,button.dataset.rejectOwnerBooking));
  $$('[data-mark-cancellation-paid]').forEach(button=>button.onclick=()=>{
    const booking=bookings.find(row=>row.id===button.dataset.markCancellationPaid);
    if(booking)markCancellationPayment(booking,store,customer,button);
  });
  initShakeDetection();
  initPushNotifications(store,customer);
  (typeof bindAndroidAppFooter==='function'&&bindAndroidAppFooter());
  queueRejectedOrderNotifications(orders,store,customer,promotions);
  if(medical)checkMedicineAlarms(store,customer);
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
    payBlock='<button class="btn full secondary refill-card-action" type="button" disabled>Refill</button><p class="muted refill-card-note">Your refill order has been sent — track it under Your orders while the store reviews the amount and processes it.</p>';
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
        closeModal();toast('Refill order sent — the store can now review and process it');
        await loadAndRenderCustomerView(store,customer);
      }catch(error){button.disabled=false;toast(error.message||'Could not send request')}
    };
  });
}
function customerOrderMarkup(order,store){
  const razorpayEnabled=store?.razorpayEnabled&&validRazorpayLink(store.razorpayLink);
  const razorpayReturnOpen=razorpayPaymentWasOpened(order.id);
  const paymentBlock=order.status==='Pending Customer Acceptance'
    ?`<div class="pending-acceptance-note"><p class="muted">The store started this order on your behalf. Accept it to move it into your regular order queue.</p><button type="button" class="btn full green" data-accept-owner-order="${html(order.id)}">Accept Order</button><button type="button" class="btn full secondary" data-reject-owner-order="${html(order.id)}">Reject</button></div>`
    :order.status==='Priced'
    ?order.paymentMarkedAt
      ?`<div class="razorpay-submitted"><span class="razorpay-submitted-icon">✓</span><div><strong>Payment submitted for verification</strong><p>The store has been notified. It will verify the Razorpay payment and accept your order.</p></div></div>`
      :`<div class="payment-warning"><strong>⚠️ Before you pay</strong><p>Check that the amount below matches your order, and that this QR code or payment link genuinely belongs to <strong>${html(store?.name||'this store')}</strong>. G58 does not process or verify this payment — any payment issue, fraud, or dispute is strictly between you and the store. If anything looks wrong, use the Support button to contact the store before paying.</p></div><div class="qr-wrap" id="qr-${html(order.id)}"></div><h3 style="margin:10px 0;text-align:center">${money(order.amount)}</h3><p class="muted" style="text-align:center">Scan to pay via UPI${razorpayEnabled?' or use the secure Razorpay option below':''}. The store will accept your order once payment is received.</p>${razorpayEnabled?`<a class="btn full razorpay-pay-btn" data-open-razorpay="${html(order.id)}" href="${html(normaliseRazorpayLink(store.razorpayLink))}" target="_blank" rel="noopener noreferrer">Open Razorpay & Pay ↗</a><p class="razorpay-window-note">Razorpay opens securely in another tab. Keep this G58 page open.</p><div class="razorpay-return-step ${razorpayReturnOpen?'':'is-hidden'}" data-razorpay-return="${html(order.id)}"><strong>Returned from Razorpay?</strong><p>Choose the correct option so your order can move to the next step.</p><div class="razorpay-return-actions"><button type="button" class="btn green" data-confirm-razorpay-payment="${html(order.id)}">Payment completed</button><button type="button" class="btn secondary" data-razorpay-not-paid="${html(order.id)}">Payment not completed</button></div></div>`:''}`
    :order.amount?`<h3 style="margin:10px 0">${money(order.amount)}</h3>`:'<p class="muted">Waiting for the store to review and set the amount.</p>';
  const visibleStatus=order.paymentMarkedAt&&order.status==='Priced'?'Payment Verification':order.status;
  return `<article class="card order-item-card premium-card" id="${html(customerPortalRecordId('order',order.id))}"><div class="section-head"><h3>Order #${html(order.id.slice(-6).toUpperCase())}</h3><span class="chip">${html(visibleStatus)}</span></div>${bigStatusMarkup(visibleStatus)}${orderStepperMarkup(order.status)}<div class="order-items-list">${order.items.map(item=>`<div class="order-line-item"><span>${item.qty} ×</span><span>${html(item.name)}</span></div>`).join('')}</div>${Number(order.customerOrderValue)>0?`<div class="customer-order-value"><span>Your estimated order value</span><strong>${money(order.customerOrderValue)}</strong></div>`:''}${order.prescriptionUrl?`<a class="link-btn" href="${html(order.prescriptionUrl)}" target="_blank" rel="noopener">📄 View your prescription</a>`:''}${paymentBlock}${orderChatMarkup(order,'customer')}</article>`;
}
function serviceReminderMarkup(booking){
  return `<article class="card"><h3>${html(booking.serviceName)}</h3><p class="muted">It's been a while since your last visit — ready to book again?</p><button class="btn full" data-rebook-service="${html(booking.serviceId)}" type="button">Book Again</button></article>`;
}
function unpaidCancellationBookings(bookings=[]){
  return bookings.filter(booking=>booking.status==='Cancelled'&&Number(booking.cancellationDueAmount)>0&&['Due','Verification'].includes(booking.cancellationPaymentStatus));
}
function cancellationPaymentCardMarkup(booking,store){
  const amount=Number(booking.cancellationDueAmount)||0;
  const verifying=booking.cancellationPaymentStatus==='Verification';
  const razorpayEnabled=store?.razorpayEnabled&&validRazorpayLink(store.razorpayLink);
  const paymentOptions=verifying
    ?`<div class="razorpay-submitted"><span class="razorpay-submitted-icon">✓</span><div><strong>Payment sent for verification</strong><p>The store owner must confirm receipt before you can book here again.</p></div></div>`
    :`${booking.cancellationPaymentUpiUri?`<div class="qr-wrap" id="cancellation-qr-${html(booking.id)}"></div>`:''}<h3 class="cancellation-due-amount">${money(amount)}</h3><p class="muted">Pay this cancellation charge to the store. New bookings at this store remain locked until the owner confirms receipt.</p>${razorpayEnabled?`<a class="btn full razorpay-pay-btn" href="${html(normaliseRazorpayLink(store.razorpayLink))}" target="_blank" rel="noopener noreferrer">Open Razorpay & Pay ↗</a>`:''}<button class="btn full green" type="button" data-mark-cancellation-paid="${html(booking.id)}">I have paid — notify store</button>`;
  return `<article class="card premium-card cancellation-payment-card"><div class="section-head"><div><span class="chip due">Booking Locked</span><h3>Cancellation payment due</h3></div><strong>${money(amount)}</strong></div><p class="muted">${html(booking.serviceName)} · cancelled ${html(booking.date||'')}</p>${paymentOptions}</article>`;
}
function customerBookingMarkup(booking,store){
  const copy=bookingCopy(store),gameZone=isGameZone(store);
  const status=booking.status||'Pending Payment';
  const visibleStatus=booking.paymentMarkedAt&&status==='Pending Payment'?'Payment Verification':status;
  const razorpayEnabled=store?.razorpayEnabled&&validRazorpayLink(store.razorpayLink);
  const razorpayReturnOpen=razorpayPaymentWasOpened(booking.id);
  const upfrontAmount=Number(booking.upfrontAmount)||Number(booking.prepaymentAmount)||0;
  const cancellationNote=Number(booking.cancellationChargeAmount)>0?`<p class="muted">Cancellation fee if you cancel: ${money(booking.cancellationChargeAmount)}</p>`:'';
  const balanceNote=Number(booking.balanceAmount)>0?`<p class="muted">Balance ${money(booking.balanceAmount)}${booking.balancePaid?' · Paid':` due ${copy.after}`}</p>`:'';
  const paymentBlock=status==='Pending Payment'
    ?(booking.paymentMarkedAt
      ?`<div class="razorpay-submitted"><span class="razorpay-submitted-icon">✓</span><div><strong>Payment submitted for verification</strong><p>The store has been notified. It will verify the payment and confirm your booking.</p></div></div>`
      :`<div class="qr-wrap" id="booking-qr-${html(booking.id)}"></div><h3 style="margin:10px 0;text-align:center">${money(upfrontAmount)}</h3>${cancellationNote}<p class="muted" style="text-align:center">Scan to pay via UPI${razorpayEnabled?' or use the secure Razorpay option below':''}. The ${gameZone?'game zone':'store'} will confirm your slot once payment is received.</p>${razorpayEnabled?`<a class="btn full razorpay-pay-btn" data-open-razorpay-booking="${html(booking.id)}" href="${html(normaliseRazorpayLink(store.razorpayLink))}" target="_blank" rel="noopener noreferrer">Open Razorpay & Pay ↗</a><p class="razorpay-window-note">Razorpay opens securely in another tab. Keep this G58 page open.</p><div class="razorpay-return-step ${razorpayReturnOpen?'':'is-hidden'}" data-razorpay-return-booking="${html(booking.id)}"><strong>Returned from Razorpay?</strong><p>Choose the correct option so your booking can move to the next step.</p><div class="razorpay-return-actions"><button type="button" class="btn green" data-confirm-razorpay-payment-booking="${html(booking.id)}">Payment completed</button><button type="button" class="btn secondary" data-razorpay-not-paid-booking="${html(booking.id)}">Payment not completed</button></div></div>`:''}`)
    :status==='Requested'
    ?`<p class="muted" style="text-align:center">No payment needed yet — waiting for the ${gameZone?'game zone':'store'} to accept your booking. You'll pay ${money(booking.price)} ${copy.completed}.</p>`
    :'';
  const pendingAcceptanceBlock=status==='Pending Customer Acceptance'
    ?`<div class="pending-acceptance-note"><p class="muted">The store started this booking on your behalf. Accept it to continue to slot confirmation.</p><button type="button" class="btn full green" data-accept-owner-booking="${html(booking.id)}">Accept Booking</button><button type="button" class="btn full secondary" data-reject-owner-booking="${html(booking.id)}">Reject</button></div>`
    :'';
  const canCancel=['Requested','Pending Payment','Confirmed'].includes(status);
  const expertWaHref=store?.customerWhatsappEnabled!==false?whatsappLink(booking.expertPhone,`Hi ${booking.expertName||'there'}, this is regarding my ${booking.serviceName} booking on ${booking.date} at ${booking.startTime}.`):'';
  const bookingActions=[expertWaHref?`<a class="btn small whatsapp-btn" href="${expertWaHref}" target="_blank" rel="noopener noreferrer">${WHATSAPP_ICON_SVG} WhatsApp ${html(booking.expertName||'Expert')}</a>`:'',canCancel?`<button class="btn small red" data-cancel-my-booking="${html(booking.id)}">Cancel Booking</button>`:''].filter(Boolean).join('');
  const doorstepNote=booking.doorstepServiceEnabled?`<div class="delivery-block"><div class="delivery-info"><strong>🏠 Doorstep Service</strong>${booking.locationUrl?`<a href="${html(booking.locationUrl)}" target="_blank" rel="noopener">📍 Your shared service location</a>`:'<span class="muted">Location will be requested before confirmation.</span>'}</div></div>`:'';
  return `<article class="card order-item-card premium-card" id="${html(customerPortalRecordId('booking',booking.id))}"><div class="section-head"><h3>${html(booking.serviceName)}</h3><span class="chip">${html(visibleStatus)}</span></div>${bookingStatusMarkup(visibleStatus,store)}${bookingStepperMarkup(visibleStatus)}<p class="muted">${html(booking.date)} · ${html(booking.startTime)}${booking.expertName?` · ${gameZone?html(booking.expertName):`with ${html(booking.expertName)}`}`:''}</p><p class="muted">Price ${money(booking.price)}${upfrontAmount>0?` · Prepaid ${money(upfrontAmount)}`:''}</p>${doorstepNote}${balanceNote}${pendingAcceptanceBlock}${paymentBlock}${bookingActions?`<div class="actions">${bookingActions}</div>`:''}${bookingChatMarkup(booking,'customer')}</article>`;
}
async function cancelCustomerBooking(booking,store,customer){
  const cancellationAmount=booking.cancellationChargeMode==='post-cancel'?Math.max(0,Number(booking.cancellationChargeAmount)||0):0;
  if(cancellationAmount>0&&!confirm(`Cancelling creates a ${money(cancellationAmount)} cancellation charge. You cannot book at this store again until you pay and the store confirms it. Continue?`))return;
  if(cancellationAmount<=0&&!confirm('Cancel this booking?'))return;
  try{
    const result=await api.executeFunction(api.config.digitalOrderFunctionId,{action:'digit58-cancel-customer-booking',ownerId:booking.ownerId,bookingId:booking.id});
    if(result?.booking)Object.assign(booking,result.booking);
    toast(cancellationAmount>0?`Booking cancelled — ${money(cancellationAmount)} payment is due`:'Booking cancelled');
    await loadAndRenderCustomerView(store,customer);
  }catch(error){toast(error.message||'Could not cancel booking')}
}
async function markCancellationPayment(booking,store,customer,button){
  if(!booking||booking.cancellationPaymentStatus==='Paid')return;
  if(!confirm(`Confirm that you paid ${money(booking.cancellationDueAmount)} to ${store.name||'this store'}? The store owner will verify it.`))return;
  button.disabled=true;button.textContent='Notifying store…';
  try{
    const result=await api.executeFunction(api.config.digitalOrderFunctionId,{action:'digit58-mark-cancellation-payment',ownerId:booking.ownerId,bookingId:booking.id});
    if(result?.booking)Object.assign(booking,result.booking);
    toast('Payment sent for store verification');
    await loadAndRenderCustomerView(store,customer);
  }catch(error){button.disabled=false;button.textContent='I have paid — notify store';toast(error.message||'Could not notify the store')}
}
async function submitBookingRazorpayPaymentForVerification(booking,store,customer,button=null,returned=false){
  if(!booking||booking.paymentMarkedAt)return;
  if(button){button.disabled=true;button.textContent='Notifying store…'}
  const changes={paymentMarkedAt:now(),updatedAt:now()};
  try{
    await api.update(bookingKind(booking.ownerId),booking.id,changes);Object.assign(booking,changes);rememberRazorpayPayment(booking.id,false,store);
    toast(returned?'Payment successful — returned to your bookings':'Payment submitted — waiting for store verification');await loadAndRenderCustomerView(store,customer);
  }catch(error){if(button){button.disabled=false;button.textContent='Payment completed'}toast(error.message||'Could not notify the store')}
}
function bindBookingRazorpayPaymentActions(bookings,store,customer){
  $$('[data-open-razorpay-booking]').forEach(link=>link.onclick=()=>{
    const bookingId=link.dataset.openRazorpayBooking;rememberRazorpayPayment(bookingId,true,store);
    const step=$(`[data-razorpay-return-booking="${CSS.escape(bookingId)}"]`);step?.classList.remove('is-hidden');
    setTimeout(()=>step?.scrollIntoView({behavior:'smooth',block:'center'}),180);
  });
  $$('[data-razorpay-not-paid-booking]').forEach(button=>button.onclick=()=>{
    const bookingId=button.dataset.razorpayNotPaidBooking;rememberRazorpayPayment(bookingId,false,store);
    $(`[data-razorpay-return-booking="${CSS.escape(bookingId)}"]`)?.classList.add('is-hidden');
    toast('Payment not submitted. You can reopen Razorpay when ready.');
  });
  $$('[data-confirm-razorpay-payment-booking]').forEach(button=>button.onclick=async()=>{
    const bookingId=button.dataset.confirmRazorpayPaymentBooking,booking=bookings.find(row=>row.id===bookingId);if(!booking)return;
    await submitBookingRazorpayPaymentForVerification(booking,store,customer,button,false);
  });
}
function timeToMinutes(text){const [h,m]=String(text||'0:0').split(':').map(Number);return h*60+(m||0)}
function minutesToTime(mins){return `${String(Math.floor(mins/60)).padStart(2,'0')}:${String(mins%60).padStart(2,'0')}`}
function serviceDurationMinutes(store,service){return Math.max(5,Number(service?.durationMinutes)||Number(store?.slotDurationMinutes)||30)}
function lunchBreakRange(store){
  if(!store?.lunchBreakEnabled)return null;
  const start=timeToMinutes(store.lunchBreakStart||'13:00');
  return {start,end:start+60};
}
function rangesOverlap(startA,endA,startB,endB){return startA<endB&&endA>startB}
function generateSlotOptions(store,service=null){
  const duration=serviceDurationMinutes(store,service);
  const startMins=timeToMinutes(store.slotStartTime||'10:00'),endMins=timeToMinutes(store.slotEndTime||'18:00');
  const lunch=lunchBreakRange(store);
  const slots=[];
  for(let mins=startMins;mins+duration<=endMins;mins+=duration){
    if(lunch&&rangesOverlap(mins,mins+duration,lunch.start,lunch.end))continue;
    slots.push(minutesToTime(mins));
  }
  return slots;
}
function dateValueFromNow(msFromNow){const target=new Date(Date.now()+msFromNow);return new Date(target.getTime()-target.getTimezoneOffset()*60000).toISOString().slice(0,10)}
function bookingWindowForService(store,service){
  const windowDays=Math.max(1,Number(store.preBookingWindowDays)||30);
  const storeMin=dateValueFromNow(5*60000),storeMax=dateValueFromNow(windowDays*86400000);
  if(service?.bookingFromDate&&service?.bookingUntilDate){
    const today=dateValueFromNow(0);
    return {min:service.bookingFromDate>today?service.bookingFromDate:storeMin,max:service.bookingUntilDate};
  }
  return {min:storeMin,max:storeMax};
}
async function fetchBookingAvailability(store,date){
  if(!date)return [];
  try{
    const result=await api.executeFunction(api.config.digitalOrderFunctionId,{action:'digit58-get-slot-status',ownerId:store.ownerId,storeId:store.id,date});
    return Array.isArray(result?.occupied)?result.occupied:[];
  }catch{return []}
}
function slotButtonMarkup(startTime,booked,selected){
  return `<button type="button" class="slot-btn ${booked?'booked':'available'} ${selected?'selected':''}" data-slot="${html(startTime)}" ${booked?'disabled':''}>${html(startTime)}</button>`;
}
function openBookingModal(store,customer,services,experts,preselectServiceId='',ownerBookingFor=null){
  const copy=bookingCopy(store),gameZone=isGameZone(store);
  if(!ownerBookingFor){
    const outstanding=unpaidCancellationBookings(customerBookingsCache);
    if(outstanding.length){
      const amount=outstanding.reduce((sum,row)=>sum+(Number(row.cancellationDueAmount)||0),0);
      return toast(`Pay the pending cancellation charge of ${money(amount)} before booking again at this store.`);
    }
  }
  if(!services.length)return toast(`This ${gameZone?'game zone':'store'} has not added any ${gameZone?'games or slots':'services'} yet`);
  const initialService=services.find(row=>row.id===preselectServiceId)||services[0];
  const initialWindow=bookingWindowForService(store,initialService);
  let slotFetchToken=0,capturedLocation=null;
  const title=ownerBookingFor?`Book ${copy.item} for Customer`:copy.bookTitle;
  const intro=ownerBookingFor?`<p class="muted">Creates a booking for ${html(ownerBookingFor.customerName||'this customer')}. They'll get a call-style alert and must accept it before it's confirmed.</p>`:'';
  const submitLabel=ownerBookingFor?'Send to Customer':gameZone?'Reserve & Pay Prepayment':'Book & Pay Prepayment';
  const askPhone=!ownerBookingFor&&!customer.phone;
  const phoneField=askPhone?'<div class="field"><label>Your phone number</label><input name="phone" type="tel" placeholder="10-digit mobile number" required><small class="muted">Saved to your account so the store and expert can reach you — you won\'t be asked again.</small></div>':'';
  const doorstepField=ownerBookingFor||gameZone?'':`<div class="field ${initialService.doorstepServiceEnabled?'':'hidden'}" id="doorstepLocationField"><label>Doorstep service location</label><button type="button" class="btn secondary" id="bookingShareLocationBtn">📍 Share Service Location</button><p class="muted" id="bookingLocationStatus" style="margin-top:6px">Required — the service owner can forward this Maps location to the selected expert.</p></div>`;
  modal(title,`<form id="bookingForm">${intro}${phoneField}<div class="field"><label>${copy.item}</label><select name="serviceId" id="bookingServiceSelect" required>${services.map(service=>`<option value="${html(service.id)}" ${service.id===initialService.id?'selected':''}>${html(service.name)} — ${money(service.price)}${service.doorstepServiceEnabled&&!gameZone?' · Doorstep':''}</option>`).join('')}</select></div>${experts.length?`<div class="field"><label>${copy.resource} <small>(optional)</small></label><select name="expertId" id="bookingExpertSelect"><option value="">${gameZone?'Any available area':'No preference'}</option>${experts.map(expert=>`<option value="${html(expert.id)}">${html(expert.name)}</option>`).join('')}</select></div>`:''}${doorstepField}<div class="field"><label>Date</label><input name="date" type="date" id="bookingDateInput" min="${initialWindow.min}" max="${initialWindow.max}" value="${initialWindow.min}" required></div><div class="field"><label>Time slot</label><div class="slot-grid" id="bookingSlotGrid"><p class="muted">Loading slots…</p></div><input type="hidden" name="startTime" id="bookingStartTimeInput" required><p class="slot-legend"><span class="slot-legend-dot available"></span>Available<span class="slot-legend-dot booked"></span>Booked</p></div><p class="muted" id="bookingPriceNote"></p><button class="btn full" type="submit" id="bookingSubmitBtn" style="margin-top:14px" disabled>${submitLabel}</button></form>`,()=>{
    const currentService=()=>services.find(row=>row.id===$('#bookingServiceSelect').value);
    const doorstepRequired=()=>!ownerBookingFor&&currentService()?.doorstepServiceEnabled===true;
    const updateSubmitState=()=>{$('#bookingSubmitBtn').disabled=!$('#bookingStartTimeInput').value||(doorstepRequired()&&!capturedLocation)};
    if($('#bookingShareLocationBtn'))bindShareLocationButton($('#bookingShareLocationBtn'),$('#bookingLocationStatus'),point=>{capturedLocation=point;updateSubmitState()});
    const renderSlotGrid=async()=>{
      const service=currentService();if(!service)return;
      const date=$('#bookingDateInput').value,expertId=$('#bookingExpertSelect')?.value||'';
      const grid=$('#bookingSlotGrid');
      $('#bookingStartTimeInput').value='';updateSubmitState();
      if(!date){grid.innerHTML='<p class="muted">Pick a date to see available times.</p>';return}
      grid.innerHTML='<p class="muted">Loading slots…</p>';
      const token=++slotFetchToken;
      const duration=serviceDurationMinutes(store,service);
      const candidates=generateSlotOptions(store,service);
      const isToday=date===indiaDateValue(),nowFloor=timeToMinutes(indiaTimeValue())+5;
      const occupied=await fetchBookingAvailability(store,date);
      if(token!==slotFetchToken)return;
      const slots=candidates.filter(slot=>!isToday||timeToMinutes(slot)>=nowFloor);
      if(!slots.length){grid.innerHTML='<p class="muted">No slots available on this date.</p>';return}
      grid.innerHTML=slots.map(slot=>{
        const startMins=timeToMinutes(slot);
        const booked=occupied.some(o=>(o.expertId||'')===(expertId||'')&&rangesOverlap(startMins,startMins+duration,timeToMinutes(o.startTime),timeToMinutes(o.startTime)+(Number(o.durationMinutes)||30)));
        return slotButtonMarkup(slot,booked,false);
      }).join('');
      $$('.slot-btn.available',grid).forEach(button=>button.onclick=()=>{
        $$('.slot-btn',grid).forEach(other=>other.classList.remove('selected'));
        button.classList.add('selected');
        $('#bookingStartTimeInput').value=button.dataset.slot;
        updateSubmitState();
      });
    };
    const updateNote=()=>{
      const service=currentService();if(!service)return;
      $('#doorstepLocationField')?.classList.toggle('hidden',!service.doorstepServiceEnabled);
      const prepayPercent=service.prepaymentPercent??100;
      const prepay=Math.round(service.price*prepayPercent)/100;
      const cancellationCharge=service.cancellationChargeEnabled?Math.max(0,Number(service.cancellationChargeAmount)||0):0;
      const upfront=Math.round(prepay*100)/100;
      const balance=Math.round((service.price*100-prepay*100))/100;
      const cancelNote=cancellationCharge>0?` If the customer cancels, a ${money(cancellationCharge)} cancellation charge becomes due and blocks new bookings until payment is confirmed.`:'';
      $('#bookingPriceNote').textContent=ownerBookingFor
        ?(upfront<=0?`No prepayment required — the customer will pay ${money(service.price)} ${copy.completed}.${cancelNote}`:`The customer will be asked to pay ${money(upfront)} to confirm this booking.${cancelNote}`)
        :(upfront<=0?`No payment needed to book — pay ${money(service.price)} ${copy.completed}.${cancelNote}`:balance>0?`Pay ${money(upfront)} now, ${money(balance)} balance ${copy.after}.${cancelNote}`:`Pay ${money(upfront)} now.${cancelNote}`);
      if(!ownerBookingFor)$('#bookingSubmitBtn').textContent=upfront<=0?(gameZone?'Request Slot':'Request Booking'):(gameZone?'Reserve & Pay Prepayment':'Book & Pay Prepayment');
      const window=bookingWindowForService(store,service),dateInput=$('#bookingDateInput');
      dateInput.min=window.min;dateInput.max=window.max;
      if(dateInput.value&&(dateInput.value<window.min||dateInput.value>window.max))dateInput.value=window.min;
      renderSlotGrid();
    };
    $('#bookingServiceSelect').onchange=updateNote;
    $('#bookingExpertSelect')?.addEventListener('change',renderSlotGrid);
    $('#bookingDateInput').onchange=renderSlotGrid;
    updateNote();
    $('#bookingForm').onsubmit=async event=>{
      event.preventDefault();
      const values=Object.fromEntries(new FormData(event.target)),button=event.submitter;
      if(!values.startTime)return toast('Choose a time slot');
      if(!ownerBookingFor&&!gameZone&&currentService()?.doorstepServiceEnabled&&!capturedLocation)return toast('Share the service location for this doorstep booking');
      button.disabled=true;
      try{
        if(ownerBookingFor){
          const result=await api.executeFunction(api.config.digitalOrderFunctionId,{action:'digit58-owner-create-booking',ownerId:store.ownerId,storeId:store.id,customerAccountId:ownerBookingFor.customerAccountId,serviceId:values.serviceId,expertId:values.expertId||'',date:values.date,startTime:values.startTime});
          closeModal();toast('Booking sent — waiting for the customer to accept it');
          if(result?.booking){state.bookings=[...(state.bookings||[]),result.booking];save()}
          customerDetailView(ownerBookingFor.id);
        }else{
          const phone=(values.phone||customer.phone||'').trim();
          const result=await api.executeFunction(api.config.digitalOrderFunctionId,{action:'digit58-create-booking',ownerId:store.ownerId,storeId:store.id,serviceId:values.serviceId,expertId:values.expertId||'',date:values.date,startTime:values.startTime,customerName:customer.customerName,customerEmail:customer.customerEmail,phone,locationLat:capturedLocation?.lat,locationLng:capturedLocation?.lng});
          if(askPhone&&phone){
            try{
              await api.update(customerKind(store.ownerId),customer.id,{phone});
              customer.phone=phone;
              const cached=state.customers.find(row=>row.id===customer.id);if(cached)cached.phone=phone;
              save();
            }catch{}
          }
          closeModal();toast(result?.booking?.status==='Requested'?'Booking requested — the store will confirm it soon':'Slot booked — pay the prepayment to confirm');
          await loadAndRenderCustomerView(store,customer);
        }
      }catch(error){button.disabled=false;updateSubmitState();toast(error.message||'Could not book this slot')}
    };
  });
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
function customerBookingHistoryRow(booking){
  return `<tr><td>${html(booking.serviceName)}</td><td>${html(booking.expertName||'—')}</td><td>${money(booking.price)}</td><td>${html(booking.status)}</td><td>${new Date(bookingHistoryTimestamp(booking)).toLocaleString('en-IN',{timeZone:'Asia/Kolkata',dateStyle:'medium',timeStyle:'short'})}</td></tr>`;
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
        closeModal();toast('Reorder sent — the store will review the amount and send your payment QR');
        await loadAndRenderCustomerView(store,customer);
      }catch(error){button.disabled=false;toast(error.message||'Could not send reorder request')}
    };
  });
}
function orderItemRowMarkup(item={}){
  const catalog=(state.catalog||[]).filter(row=>!activeStore()||row.storeId===activeStore().id);
  const nameField=catalog.length
    ?`<select name="itemName[]" required><option value="" ${item.name?'':'selected'} disabled>Select item</option>${catalog.map(row=>`<option value="${html(row.name)}" ${item.name===row.name?'selected':''}>${html(row.name)}${row.price?` — ${money(row.price)}`:''}${row.unit?` / ${html(row.unit)}`:''}</option>`).join('')}</select>`
    :`<input name="itemName[]" placeholder="Item name" value="${html(item.name||'')}" required>`;
  return `<div class="order-item-row">${nameField}<input name="itemQty[]" type="number" min="1" value="${Math.max(1,Number(item.qty)||1)}" aria-label="Quantity"><button type="button" class="btn small secondary remove-item-row" aria-label="Remove item">✕</button></div>`;
}
const CATALOG_CSV_TEMPLATE='item_name,price,unit\r\nMilk 1L,60,pack\r\nDrinking Water 20L,80,can\r\n';
function parseCsvText(text){
  const rows=[];let row=[],cell='',inQuotes=false;
  const clean=String(text||'').replace(/^﻿/,'').replace(/\r\n/g,'\n').replace(/\r/g,'\n');
  for(let i=0;i<clean.length;i++){
    const ch=clean[i];
    if(inQuotes){
      if(ch==='"'){if(clean[i+1]==='"'){cell+='"';i++}else inQuotes=false}
      else cell+=ch;
    }else if(ch==='"')inQuotes=true;
    else if(ch===','){row.push(cell);cell=''}
    else if(ch==='\n'){row.push(cell);rows.push(row);row=[];cell=''}
    else cell+=ch;
  }
  if(cell.length||row.length){row.push(cell);rows.push(row)}
  return rows.filter(r=>r.some(c=>c.trim()!==''));
}
function parseCatalogCsv(text){
  const rows=parseCsvText(text);
  if(!rows.length)throw new Error('CSV file is empty');
  const headers=rows[0].map(h=>h.trim().toLowerCase());
  const nameIdx=headers.indexOf('item_name'),priceIdx=headers.indexOf('price'),unitIdx=headers.indexOf('unit');
  if(nameIdx===-1||priceIdx===-1)throw new Error('CSV must have item_name and price columns');
  return rows.slice(1).map(cells=>{
    const name=(cells[nameIdx]||'').trim().slice(0,120);
    if(!name)return null;
    const price=Number(cells[priceIdx]);
    if(!Number.isFinite(price)||price<0)throw new Error(`Invalid price for "${name}"`);
    return {name,price,unit:unitIdx>-1?(cells[unitIdx]||'').trim().slice(0,20):''};
  }).filter(Boolean);
}
function catalogItemMarkup(item){
  return `<article class="card catalog-item-card"><h3>${html(item.name)}</h3><p class="muted">${money(item.price)}${item.unit?` / ${html(item.unit)}`:''}</p><div class="actions"><button class="btn small red" data-remove-catalog-item="${html(item.id)}">Remove</button></div></article>`;
}
function catalogView(){
  refreshView=catalogView;
  const store=activeStore();
  const items=(state.catalog||[]).filter(row=>row.storeId===store?.id);
  $('#page').innerHTML=`<div class="section-head"><div><h1>Catalog</h1><p class="muted">Items here appear as dropdown choices when you create an order for a customer.</p></div><div class="actions"><button class="btn" id="addCatalogItem">+ Add Item</button><button class="btn secondary" id="downloadCatalogCsv">Download CSV Template</button><button class="btn secondary" id="importCatalogCsv">Import Catalog CSV</button><input id="catalogCsvFile" type="file" accept=".csv,text/csv" hidden></div></div><div class="grid catalog-grid">${items.map(catalogItemMarkup).join('')||'<div class="empty">No catalog items yet. Add items manually or import a CSV so they show up as order dropdown choices.</div>'}</div>`;
  $('#addCatalogItem').onclick=()=>openCatalogItemForm(store);
  $('#downloadCatalogCsv').onclick=()=>{
    const url=URL.createObjectURL(new Blob(['﻿'+CATALOG_CSV_TEMPLATE],{type:'text/csv;charset=utf-8'})),link=document.createElement('a');
    link.href=url;link.download='g58-refills-catalog-template.csv';document.body.appendChild(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);
  };
  $('#importCatalogCsv').onclick=()=>$('#catalogCsvFile').click();
  $('#catalogCsvFile').onchange=e=>importCatalogCsvFile(store,e.target.files[0]);
  $$('[data-remove-catalog-item]').forEach(button=>button.onclick=()=>removeCatalogItem(button.dataset.removeCatalogItem));
}
function openCatalogItemForm(store){
  modal('Add Catalog Item',`<form id="catalogItemForm"><div class="field"><label>Item name</label><input name="name" required></div><div class="form-grid"><div class="field"><label>Price (₹)</label><input name="price" type="number" min="0" step="0.01" required></div><div class="field"><label>Unit <small>(optional)</small></label><input name="unit" placeholder="Example: kg, pack, bottle"></div></div><button class="btn full" type="submit" style="margin-top:14px">Add Item</button></form>`,()=>{
    $('#catalogItemForm').onsubmit=async event=>{
      event.preventDefault();
      const values=Object.fromEntries(new FormData(event.target)),name=values.name.trim(),price=Number(values.price),button=event.submitter;
      if(!name)return toast('Enter the item name');
      if(!Number.isFinite(price)||price<0)return toast('Enter a valid price');
      button.disabled=true;
      try{
        const record={id:id('catalog'),ownerId:store.ownerId,storeId:store.id,name,price,unit:(values.unit||'').trim(),createdAt:now()};
        await api.create(catalogKind(store.ownerId),record,record.id,api.permissionSet?.(catalogKind(store.ownerId),store.ownerId,true));
        state.catalog=[...(state.catalog||[]),record];save();
        closeModal();catalogView();toast('Item added to catalog');
      }catch(error){button.disabled=false;toast(error.message||'Could not add item')}
    };
  });
}
async function removeCatalogItem(itemId){
  if(!confirm('Remove this item from the catalog?'))return;
  try{
    await api.remove(catalogKind(cloudOwnerId()),itemId);
    state.catalog=(state.catalog||[]).filter(row=>row.id!==itemId);save();
    catalogView();toast('Item removed');
  }catch(error){toast(error.message||'Could not remove item')}
}
function servicesView(){
  refreshView=servicesView;
  const store=activeStore();
  const copy=bookingCopy(store),gameZone=isGameZone(store);
  const items=(state.services||[]).filter(row=>row.storeId===store?.id);
  $('#page').innerHTML=`<div class="section-head"><div><h1>${copy.items}</h1><p class="muted">${gameZone?'Add games, courts, tables or play stations customers can reserve by time slot.':'Services customers can browse and book on your store page.'}</p></div><button class="btn" id="addService">+ Add ${copy.item}</button></div><div class="grid catalog-grid">${items.map(item=>serviceItemMarkup(item,store)).join('')||`<div class="empty">No ${gameZone?'games or slots':'services'} yet. Add your first bookable ${copy.itemLower}.</div>`}</div>`;
  $('#addService').onclick=()=>openServiceForm(store);
  $$('[data-edit-service]').forEach(button=>button.onclick=()=>openServiceForm(store,button.dataset.editService));
  $$('[data-remove-service]').forEach(button=>button.onclick=()=>removeService(button.dataset.removeService));
}
function serviceItemMarkup(item,store=activeStore()){
  const gameZone=isGameZone(store);
  const prepay=item.prepaymentPercent??100;
  const prepayNote=prepay<=0?`No prepayment — pay in full ${gameZone?'at the venue':'after service'}`:prepay>=100?'Full payment at booking':`${prepay}% prepayment, balance ${gameZone?'at the venue':'after service'}`;
  const cancelNote=item.cancellationChargeEnabled&&Number(item.cancellationChargeAmount)>0?`<p class="muted">Cancellation guarantee ${money(item.cancellationChargeAmount)}</p>`:'';
  const doorstepNote=item.doorstepServiceEnabled?'<p class="chip doorstep-chip">🏠 Doorstep Service enabled</p>':'';
  return `<article class="card catalog-item-card"><h3>${html(item.name)}</h3><p class="muted">${money(item.price)}${item.durationMinutes?` · ${item.durationMinutes} min`:''}</p><p class="muted">${prepayNote}</p>${doorstepNote}${cancelNote}${item.bookingFromDate&&item.bookingUntilDate?`<p class="muted">Bookable ${html(item.bookingFromDate)} → ${html(item.bookingUntilDate)}</p>`:''}${item.description?`<p class="muted">${html(item.description)}</p>`:''}<div class="actions"><button class="btn small" data-edit-service="${html(item.id)}">Edit</button><button class="btn small red" data-remove-service="${html(item.id)}">Remove</button></div></article>`;
}
function openServiceForm(store,serviceId=''){
  const service=(state.services||[]).find(row=>row.id===serviceId)||{};
  const copy=bookingCopy(store),gameZone=isGameZone(store);
  const doorstepField=gameZone?'':`<label class="option-toggle"><input id="doorstepServiceEnabled" name="doorstepServiceEnabled" type="checkbox" ${service.doorstepServiceEnabled?'checked':''}><span><strong>Enable Doorstep Service</strong><small>Customers must share the service location while booking. You can forward the booking and Maps location directly to the selected expert's mobile number.</small></span></label>`;
  const reminderField=gameZone?'':`<div class="field"><label>Schedule Service — remind to rebook every <small>(optional, days)</small></label><input name="reminderDays" type="number" min="1" step="1" value="${service.reminderDays||''}" placeholder="Example: 30"><small class="muted">Like Refills reminders — once a booking for this service is marked completed, the customer sees a "Book Again" prompt after this many days.</small></div>`;
  modal(serviceId?`Edit ${copy.item}`:`Add ${copy.item}`,`<form id="serviceForm"><div class="field"><label>${gameZone?'Game or slot':'Service'} name</label><input name="name" value="${html(service.name||'')}" ${gameZone?'list="gameZoneExamples"':''} placeholder="${gameZone?'Example: Box Cricket':'Example: Haircut'}" required>${gameZone?'<datalist id="gameZoneExamples"><option value="Box Cricket"><option value="Badminton"><option value="Pickleball"><option value="Pool Table"><option value="PlayStation"><option value="Bowling"></datalist>':''}</div><div class="form-grid"><div class="field"><label>${gameZone?'Price per slot':'Price'} (₹)</label><input name="price" type="number" min="0" step="0.01" value="${service.price??''}" required></div><div class="field"><label>Duration (minutes) <small>(optional)</small></label><input name="durationMinutes" type="number" min="5" step="5" value="${service.durationMinutes||''}" placeholder="Example: 30"></div></div><div class="field"><label>Prepayment at booking (%)</label><input name="prepaymentPercent" type="number" min="0" max="100" step="1" value="${service.prepaymentPercent??100}" required><small class="muted">100% means the customer pays the full amount when booking. Anything less leaves a balance to pay ${gameZone?'at the venue':'after the service is done'}. Set to 0 for no prepayment at all.</small></div>${doorstepField}<label class="option-toggle"><input id="cancellationChargeEnabled" name="cancellationChargeEnabled" type="checkbox" ${service.cancellationChargeEnabled?'checked':''}><span><strong>Enable cancellation charge</strong><small>If the customer cancels, this amount becomes due. They cannot make another booking at this ${gameZone?'game zone':'store'} until payment is confirmed by the owner.</small></span></label><div class="field ${service.cancellationChargeEnabled?'':'hidden'}" id="cancellationChargeAmountField"><label>Cancellation charge amount (₹)</label><input name="cancellationChargeAmount" type="number" min="0" step="0.01" value="${service.cancellationChargeAmount??''}"></div><div class="field"><label>Advance booking period <small>(optional)</small></label><div class="form-grid"><input name="bookingFromDate" type="date" value="${html(service.bookingFromDate||'')}"><input name="bookingUntilDate" type="date" value="${html(service.bookingUntilDate||'')}"></div><small class="muted">Leave blank to use the general Availability window. If set, customers can only book this ${copy.itemLower} between these two dates.</small></div>${reminderField}<div class="field"><label>Description <small>(optional)</small></label><textarea name="description">${html(service.description||'')}</textarea></div><button class="btn full" type="submit" style="margin-top:14px">${serviceId?`Save ${copy.item}`:`Add ${copy.item}`}</button></form>`,()=>{
    $('#cancellationChargeEnabled').onchange=event=>$('#cancellationChargeAmountField').classList.toggle('hidden',!event.target.checked);
    $('#serviceForm').onsubmit=async event=>{
      event.preventDefault();
      const values=Object.fromEntries(new FormData(event.target)),name=values.name.trim(),price=Number(values.price),prepaymentPercent=Math.min(100,Math.max(0,Math.round(Number.isFinite(Number(values.prepaymentPercent))?Number(values.prepaymentPercent):100))),durationMinutes=Math.max(0,Number(values.durationMinutes)||0),button=event.submitter;
      if(!name)return toast(`Enter the ${copy.itemLower} name`);
      if(!Number.isFinite(price)||price<0)return toast('Enter a valid price');
      const bookingFromDate=(values.bookingFromDate||'').trim(),bookingUntilDate=(values.bookingUntilDate||'').trim();
      if((bookingFromDate&&!bookingUntilDate)||(!bookingFromDate&&bookingUntilDate))return toast('Set both the from and until dates, or leave both blank');
      if(bookingFromDate&&bookingUntilDate&&bookingFromDate>bookingUntilDate)return toast('The "until" date must be after the "from" date');
      const cancellationChargeEnabled=values.cancellationChargeEnabled==='on',cancellationChargeAmount=cancellationChargeEnabled?Math.max(0,Number(values.cancellationChargeAmount)||0):0;
      if(cancellationChargeEnabled&&cancellationChargeAmount<=0)return toast('Enter a cancellation charge amount');
      button.disabled=true;
      const reminderDays=gameZone?0:Math.max(0,Number(values.reminderDays)||0);
      const doorstepServiceEnabled=gameZone?false:values.doorstepServiceEnabled==='on';
      const changes={name,price,durationMinutes,prepaymentPercent,doorstepServiceEnabled,cancellationChargeEnabled,cancellationChargeAmount,bookingFromDate,bookingUntilDate,reminderDays,description:(values.description||'').trim()};
      try{
        if(serviceId){
          await api.update(serviceKind(store.ownerId),serviceId,changes);
          Object.assign(service,changes);
        }else{
          const record={id:id('service'),ownerId:store.ownerId,storeId:store.id,...changes,active:true,createdAt:now()};
          await api.create(serviceKind(store.ownerId),record,record.id,api.permissionSet?.(serviceKind(store.ownerId),store.ownerId,true));
          state.services=[...(state.services||[]),record];
        }
        save();closeModal();servicesView();toast(serviceId?`${copy.item} updated`:`${copy.item} added`);
      }catch(error){button.disabled=false;toast(error.message||`Could not save ${copy.itemLower}`)}
    };
  });
}
async function removeService(serviceId){
  const store=activeStore(),copy=bookingCopy(store);
  if(!confirm(`Remove this ${copy.itemLower}? Customers will no longer be able to book it.`))return;
  try{
    await api.remove(serviceKind(cloudOwnerId()),serviceId);
    state.services=(state.services||[]).filter(row=>row.id!==serviceId);save();
    servicesView();toast(`${copy.item} removed`);
  }catch(error){toast(error.message||`Could not remove ${copy.itemLower}`)}
}
function availabilityView(){
  refreshView=availabilityView;
  const store=activeStore();if(!store)return;
  const gameZone=isGameZone(store);
  const selectedDays=normaliseAvailableDays(store.availableDays);
  $('#page').innerHTML=`<div class="section-head"><div><h1>Availability</h1><p class="muted">${gameZone?'Set operating days, opening hours, default game-slot length and advance booking window.':"Set the days and hours customers can book, and how far ahead they're allowed to book."}</p></div></div>
    <div class="card" style="max-width:560px">
      <form id="availabilityForm">
        <fieldset class="delivery-days-field"><legend>${gameZone?'Operating days':'Open days'}</legend><div class="delivery-day-grid">${WEEKDAYS.map(day=>`<label><input type="checkbox" name="availableDays" value="${day.id}" ${selectedDays.includes(day.id)?'checked':''}><span>${day.short}</span></label>`).join('')}</div></fieldset>
        <div class="form-grid"><div class="field"><label>Opening time</label><input name="slotStartTime" type="time" value="${html(store.slotStartTime||'10:00')}" required></div><div class="field"><label>Closing time</label><input name="slotEndTime" type="time" value="${html(store.slotEndTime||'18:00')}" required></div></div>
        <div class="field"><label>Slot length (minutes)</label><input name="slotDurationMinutes" type="number" min="5" step="5" value="${store.slotDurationMinutes||30}" required><small class="muted">Used when a ${gameZone?'game':'service'} doesn't set its own duration.</small></div>
        <label class="option-toggle"><input id="lunchBreakEnabled" name="lunchBreakEnabled" type="checkbox" ${store.lunchBreakEnabled?'checked':''}><span><strong>Block a 1-hour ${gameZone?'maintenance break':'lunch break'}</strong><small>No slots will be offered during this hour.</small></span></label>
        <div class="field ${store.lunchBreakEnabled?'':'hidden'}" id="lunchBreakStartField"><label>${gameZone?'Break':'Lunch break'} starts at</label><input name="lunchBreakStart" type="time" value="${html(store.lunchBreakStart||'13:00')}"></div>
        <div class="field"><label>How far ahead can customers book? (days)</label><input name="preBookingWindowDays" type="number" min="1" max="365" value="${store.preBookingWindowDays||30}" required><small class="muted">Example: 30 = about a month ahead, 90 = about 3 months ahead.</small></div>
        ${gameZone?'':`<label class="option-toggle"><input id="customerWhatsappEnabled" name="customerWhatsappEnabled" type="checkbox" ${store.customerWhatsappEnabled!==false?'checked':''}><span><strong>Let customers WhatsApp the expert</strong><small>Shows a "WhatsApp Expert" button on a customer's booking once an expert with a number is assigned. Turn off to hide it from customers.</small></span></label>`}
        <button class="btn full" type="submit" style="margin-top:14px">Save Availability</button>
      </form>
    </div>`;
  $('#lunchBreakEnabled').onchange=event=>$('#lunchBreakStartField').classList.toggle('hidden',!event.target.checked);
  $('#availabilityForm').onsubmit=async event=>{
    event.preventDefault();
    const availableDays=normaliseAvailableDays($$('input[name="availableDays"]:checked').map(input=>input.value));
    const values=Object.fromEntries(new FormData(event.target)),button=event.submitter;
    if(!availableDays.length)return toast('Select at least one open day');
    if(values.slotStartTime>=values.slotEndTime)return toast('Closing time must be after opening time');
    const lunchBreakEnabled=values.lunchBreakEnabled==='on',lunchBreakStart=lunchBreakEnabled?(values.lunchBreakStart||'13:00'):'';
    const customerWhatsappEnabled=gameZone?false:values.customerWhatsappEnabled==='on';
    button.disabled=true;
    const changes={availableDays,slotStartTime:values.slotStartTime,slotEndTime:values.slotEndTime,slotDurationMinutes:Math.max(5,Number(values.slotDurationMinutes)||30),preBookingWindowDays:Math.max(1,Number(values.preBookingWindowDays)||30),lunchBreakEnabled,lunchBreakStart,customerWhatsappEnabled};
    try{
      await api.update(storeKind(store.ownerId),store.id,changes);
      Object.assign(store,changes);save();
      toast('Availability saved');
    }catch(error){button.disabled=false;toast(error.message||'Could not save availability')}
  };
}
function expertsView(){
  refreshView=expertsView;
  const store=activeStore();
  const copy=bookingCopy(store),gameZone=isGameZone(store);
  const items=(state.experts||[]).filter(row=>row.storeId===store?.id);
  $('#page').innerHTML=`<div class="section-head"><div><h1>${copy.resources}</h1><p class="muted">${gameZone?'Optional — add Court 1, Table 2 or PS5 Station so each play area has independent slot availability. Leave empty for one shared booking capacity.':"Optional — add named staff so customers can choose who they book with. Leave empty if bookings don't need a specific expert."}</p></div><button class="btn" id="addExpert">+ Add ${copy.resource}</button></div><div class="grid catalog-grid">${items.map(expertItemMarkup).join('')||`<div class="empty">No ${copy.resources.toLowerCase()} added. Customers will book without choosing a specific ${copy.resourceLower}.</div>`}</div>`;
  $('#addExpert').onclick=()=>openExpertForm(store);
  $$('[data-edit-expert]').forEach(button=>button.onclick=()=>openExpertForm(store,button.dataset.editExpert));
  $$('[data-remove-expert]').forEach(button=>button.onclick=()=>removeExpert(button.dataset.removeExpert));
}
function expertItemMarkup(item){
  return `<article class="card catalog-item-card"><h3>${html(item.name)}</h3><p class="muted">${item.active===false?'Inactive':'Active'}${item.phone?` · ${html(item.phone)}`:''}</p><div class="actions"><button class="btn small" data-edit-expert="${html(item.id)}">Edit</button><button class="btn small red" data-remove-expert="${html(item.id)}">Remove</button></div></article>`;
}
function openExpertForm(store,expertId=''){
  const expert=(state.experts||[]).find(row=>row.id===expertId)||{};
  const copy=bookingCopy(store),gameZone=isGameZone(store);
  modal(expertId?`Edit ${copy.resource}`:`Add ${copy.resource}`,`<form id="expertForm"><div class="field"><label>${copy.resource} name</label><input name="name" value="${html(expert.name||'')}" placeholder="${gameZone?'Example: Box Cricket Turf 1':'Example: Priya'}" required></div>${gameZone?'':`<div class="field"><label>WhatsApp number <small>(optional)</small></label><input name="phone" type="tel" value="${html(expert.phone||'')}" placeholder="10-digit mobile number"><small class="muted">Lets customers message this expert directly on WhatsApp about their booking.</small></div>`}<label class="option-toggle"><input name="active" type="checkbox" ${expert.active===false?'':'checked'}><span><strong>Active</strong><small>Customers can only book ${gameZone?'play areas':'experts'} marked active.</small></span></label><button class="btn full" type="submit" style="margin-top:14px">${expertId?`Save ${copy.resource}`:`Add ${copy.resource}`}</button></form>`,()=>{
    $('#expertForm').onsubmit=async event=>{
      event.preventDefault();
      const values=Object.fromEntries(new FormData(event.target)),name=(values.name||'').trim(),phone=gameZone?'':(values.phone||'').trim(),active=values.active==='on',button=event.submitter;
      if(!name)return toast(`Enter the ${copy.resourceLower} name`);
      button.disabled=true;
      const changes={name,phone,active};
      try{
        if(expertId){
          await api.update(expertKind(store.ownerId),expertId,changes);
          Object.assign(expert,changes);
        }else{
          const record={id:id('expert'),ownerId:store.ownerId,storeId:store.id,...changes,createdAt:now()};
          await api.create(expertKind(store.ownerId),record,record.id,api.permissionSet?.(expertKind(store.ownerId),store.ownerId,true));
          state.experts=[...(state.experts||[]),record];
        }
        save();closeModal();expertsView();toast(expertId?`${copy.resource} updated`:`${copy.resource} added`);
      }catch(error){button.disabled=false;toast(error.message||`Could not save ${copy.resourceLower}`)}
    };
  });
}
async function removeExpert(expertId){
  const copy=bookingCopy(activeStore());
  if(!confirm(`Remove this ${copy.resourceLower}?`))return;
  try{
    await api.remove(expertKind(cloudOwnerId()),expertId);
    state.experts=(state.experts||[]).filter(row=>row.id!==expertId);save();
    expertsView();toast(`${copy.resource} removed`);
  }catch(error){toast(error.message||`Could not remove ${copy.resourceLower}`)}
}
async function toggleEmergencyMode(store,enabled){
  try{
    await api.update(storeKind(store.ownerId),store.id,{emergencyMode:enabled});
    store.emergencyMode=enabled;save();
    bookingsView();toast(enabled?'Emergency mode on — new bookings are paused':'Emergency mode off — bookings resumed');
  }catch(error){toast(error.message||'Could not update emergency mode')}
}
async function applyEmergencyDelay(store,minutes){
  const today=indiaDateValue();
  const affected=(state.bookings||[]).filter(row=>row.storeId===store.id&&row.date===today&&['Requested','Pending Payment','Confirmed'].includes(row.status));
  if(!affected.length)return toast('No bookings today to delay');
  try{
    for(const booking of affected){
      const newStartTime=minutesToTime((timeToMinutes(booking.startTime)+minutes+1440)%1440);
      const changes={startTime:newStartTime,updatedAt:now()};
      await api.update(bookingKind(booking.ownerId),booking.id,changes);
      Object.assign(booking,changes);
      await sendBookingMessage(booking,'owner',`We're running behind — your booking has been moved to ${newStartTime} today. Sorry for the inconvenience.`);
    }
    save();bookingsView();toast(`Delayed ${affected.length} booking${affected.length===1?'':'s'} by ${minutes} minutes`);
  }catch(error){toast(error.message||'Could not delay bookings')}
}
function confirmedBookingCompactMarkup(booking){
  const ringing=ringingIds.has(booking.id);
  const balance=Number(booking.balanceAmount)||0;
  const phone=booking.phone||(state.customers||[]).find(row=>row.storeId===booking.storeId&&row.customerAccountId===booking.customerAccountId)?.phone||'';
  const waHref=whatsappLink(phone,`Hi ${booking.customerName||'there'}, this is regarding your ${booking.serviceName} booking on ${booking.date} at ${booking.startTime}.`);
  return `<div class="booking-compact-card ${ringing?'incoming-order':''}">${ringing?'<span class="incoming-order-beacon" aria-label="New booking" title="New booking"></span>':''}<div class="booking-compact-info"><strong>${html(booking.serviceName)}</strong><span class="muted">${html(booking.date)} · ${html(booking.startTime)}${booking.expertName?` · ${html(booking.expertName)}`:''} · ${html(booking.customerName||'Customer')}</span>${balance>0?`<span class="chip due">Balance ${money(balance)}</span>`:''}</div>${doorstepBookingOwnerMarkup(booking)}<div class="actions">${waHref?`<a class="btn small whatsapp-btn" href="${waHref}" target="_blank" rel="noopener noreferrer" title="Chat with ${html(booking.customerName||'customer')} on WhatsApp">${WHATSAPP_ICON_SVG}</a>`:''}<button type="button" class="btn small secondary" data-pos-print="${html(posPrintLink(booking,booking.price,`${booking.serviceName} — ${booking.customerName||'Customer'}`))}" title="Print POS bill">${PRINT_ICON_SVG}</button><button class="btn small green" data-complete-booking="${html(booking.id)}">Complete</button><button class="btn small red" data-cancel-booking="${html(booking.id)}">Cancel</button></div>${bookingChatMarkup(booking,'owner')}</div>`;
}
function bookingsView(){
  refreshView=bookingsView;
  const store=activeStore();if(!store)return;
  const today=indiaDateValue();
  const dateFilter=$('#bookingsDateFilter')?.value??today;
  const all=(state.bookings||[]).filter(row=>row.storeId===store.id&&!['Completed','Cancelled'].includes(row.status));
  const pending=all.filter(row=>['Pending Customer Acceptance','Requested','Pending Payment'].includes(row.status)).sort((a,b)=>new Date(b.createdAt||`${b.date}T${b.startTime}`)-new Date(a.createdAt||`${a.date}T${a.startTime}`));
  const confirmed=(dateFilter?all.filter(row=>row.date===dateFilter):all).filter(row=>row.status==='Confirmed').sort((a,b)=>new Date(`${a.date}T${a.startTime}`)-new Date(`${b.date}T${b.startTime}`));
  const visible=[...pending,...confirmed];
  $('#page').innerHTML=`<div class="section-head"><div><h1>Bookings</h1><p class="muted">Incoming and payment-pending bookings always stay visible. The date filter applies only to confirmed bookings for ${html(store.name||'this store')}.</p></div></div>
    <div class="card emergency-mode-card"><label class="option-toggle"><input id="emergencyModeToggle" type="checkbox" ${store.emergencyMode?'checked':''}><span><strong>Emergency Mode</strong><small>Pauses new bookings so you can catch up. Existing bookings stay — use the delay below to push them back.</small></span></label>${store.emergencyMode?`<div class="emergency-delay-row"><input id="emergencyDelayMinutes" type="number" min="5" step="5" value="30" placeholder="Minutes"><button class="btn small" id="applyEmergencyDelay" type="button">Apply delay to today's bookings</button></div>`:''}</div>
    <div class="date-filter-bar"><label>Date<input id="bookingsDateFilter" type="date" value="${html(dateFilter)}"></label><button class="btn small secondary" id="bookingsDateToday" type="button">Today</button><button class="btn small secondary" id="bookingsDateAll" type="button">All upcoming</button></div>
    <div class="section-head"><h2>Incoming &amp; Awaiting Action</h2>${pending.length?`<span class="chip due">${pending.length} waiting</span>`:''}</div>
    <div class="grid card-grid">${pending.map(booking=>ownerBookingMarkup(booking,store)).join('')||'<div class="empty">No bookings awaiting response.</div>'}</div>
    ${confirmed.length?`<div class="section-head"><h2>Confirmed</h2></div><div class="booking-compact-list">${confirmed.map(confirmedBookingCompactMarkup).join('')}</div>`:''}`;
  $('#emergencyModeToggle').onchange=event=>toggleEmergencyMode(store,event.target.checked);
  $('#applyEmergencyDelay')?.addEventListener('click',()=>{
    const minutes=Math.max(5,Number($('#emergencyDelayMinutes').value)||0);
    if(!minutes)return toast('Enter how many minutes to delay by');
    applyEmergencyDelay(store,minutes);
  });
  $('#bookingsDateFilter').onchange=refreshView;
  $('#bookingsDateToday').onclick=()=>{$('#bookingsDateFilter').value=today;bookingsView()};
  $('#bookingsDateAll').onclick=()=>{$('#bookingsDateFilter').value='';bookingsView()};
  $$('[data-confirm-booking]').forEach(button=>button.onclick=()=>confirmBookingPayment(button.dataset.confirmBooking));
  $$('[data-complete-booking]').forEach(button=>button.onclick=()=>completeBooking(button.dataset.completeBooking));
  $$('[data-cancel-booking]').forEach(button=>button.onclick=()=>cancelBooking(button.dataset.cancelBooking));
  $$('[data-reopen-booking-payment]').forEach(button=>button.onclick=()=>reopenBookingPayment(button.dataset.reopenBookingPayment));
  bindBookingExpertShareButtons(visible);
  bindBookingChatForms(visible,'owner',refreshView);
  bindPosPrintButtons();
}
function bookingHistoryTimestamp(booking){
  if(booking.completedAt)return booking.completedAt;
  if(booking.cancelledAt)return booking.cancelledAt;
  if(booking.date&&booking.startTime){const scheduled=new Date(`${booking.date}T${booking.startTime}:00+05:30`);if(!Number.isNaN(scheduled.getTime()))return scheduled.toISOString()}
  return booking.updatedAt||booking.createdAt;
}
function filterBookingsByIndiaDate(bookings,fromDate,toDate){
  return bookings.filter(booking=>{
    const day=indiaDateValue(bookingHistoryTimestamp(booking));
    return (!fromDate||day>=fromDate)&&(!toDate||day<=toDate);
  });
}
function downloadBookingHistoryCsv(bookings,{filePrefix='booking-history',includeCustomer=false,storeName=''}={}){
  const headers=['Booking ID',...(includeCustomer?['Customer','Phone']:['Store']),'Service','Expert','Date','Time','Amount (INR)','Status','Completed/Cancelled'];
  const rows=bookings.map(booking=>[
    booking.id,
    ...(includeCustomer?[booking.customerName||'Customer',booking.phone||'']:[storeName||'']),
    booking.serviceName||'',booking.expertName||'',booking.date||'',booking.startTime||'',
    Number(booking.price)||0,booking.status||'',
    new Date(bookingHistoryTimestamp(booking)).toLocaleString('en-IN',{timeZone:'Asia/Kolkata',dateStyle:'medium',timeStyle:'short'}),
  ]);
  const csv='﻿'+[headers,...rows].map(row=>row.map(csvCell).join(',')).join('\r\n');
  const url=URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8'})),link=document.createElement('a');
  link.href=url;link.download=`${filePrefix}-${indiaDateValue()}.csv`;document.body.appendChild(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);
}
function bookingHistoryView(){
  refreshView=bookingHistoryView;
  const store=activeStore();
  const copy=bookingCopy(store);
  const today=indiaDateValue(),fromInput=$('#bookingHistoryFrom')?.value||today,toInput=$('#bookingHistoryTo')?.value||today;
  const all=(state.bookings||[]).filter(row=>row.storeId===store?.id&&['Completed','Cancelled'].includes(row.status));
  const filtered=filterBookingsByIndiaDate(all,fromInput,toInput).sort((a,b)=>new Date(bookingHistoryTimestamp(b))-new Date(bookingHistoryTimestamp(a)));
  $('#page').innerHTML=`<div class="section-head"><div><h1>Booking History</h1><p class="muted">Today's completed and cancelled bookings are shown by default. Select a From and To date for another period.</p></div><button class="btn small secondary" id="exportBookingHistory" ${filtered.length?'':'disabled'}>Export CSV</button></div><div class="date-filter-bar"><label>From<input id="bookingHistoryFrom" type="date" value="${html(fromInput)}" max="${html(toInput)}"></label><label>To<input id="bookingHistoryTo" type="date" value="${html(toInput)}" min="${html(fromInput)}"></label><button class="btn small secondary" id="bookingHistoryToday" type="button">Today</button></div><div class="grid stats">${metric('Bookings',filtered.length)}${metric('Revenue',money(filtered.filter(b=>b.status==='Completed').reduce((sum,b)=>sum+Number(b.price||0),0)))}</div><div class="card table-wrap"><table><thead><tr><th>Customer</th><th>${copy.historyItem}</th><th>${copy.historyResource}</th><th>Amount</th><th>Status</th><th>Date</th><th>Actions</th></tr></thead><tbody>${filtered.map(bookingHistoryRow).join('')||'<tr><td colspan="7">No bookings in this period.</td></tr>'}</tbody></table></div>`;
  $('#bookingHistoryFrom').onchange=bookingHistoryView;$('#bookingHistoryTo').onchange=bookingHistoryView;
  $('#bookingHistoryToday').onclick=()=>{$('#bookingHistoryFrom').value=today;$('#bookingHistoryTo').value=today;bookingHistoryView()};
  $('#exportBookingHistory').onclick=()=>downloadBookingHistoryCsv(filtered,{filePrefix:`${store?.name||'store'}-bookings`.toLowerCase().replace(/[^a-z0-9]+/g,'-'),includeCustomer:true});
  $$('[data-restore-booking]').forEach(button=>button.onclick=()=>restoreBooking(button.dataset.restoreBooking));
  $$('[data-confirm-cancellation-payment]').forEach(button=>button.onclick=()=>confirmCancellationPayment(button.dataset.confirmCancellationPayment,true,button));
  $$('[data-reopen-cancellation-payment]').forEach(button=>button.onclick=()=>confirmCancellationPayment(button.dataset.reopenCancellationPayment,false,button));
}
function bookingHistoryRow(booking){
  const cancellationDue=booking.status==='Cancelled'&&Number(booking.cancellationDueAmount)>0;
  const paymentStatus=booking.cancellationPaymentStatus||'';
  const paymentLabel=cancellationDue?`<small class="booking-cancellation-status ${paymentStatus.toLowerCase()}">Cancellation ${money(booking.cancellationDueAmount)} · ${html(paymentStatus==='Verification'?'Verify payment':paymentStatus)}</small>`:'';
  let actions='';
  if(cancellationDue&&paymentStatus==='Verification')actions=`<button class="btn small green" data-confirm-cancellation-payment="${html(booking.id)}">Payment Received</button><button class="btn small secondary" data-reopen-cancellation-payment="${html(booking.id)}">Not Received</button>`;
  else if(cancellationDue&&paymentStatus==='Due')actions=`<button class="btn small green" data-confirm-cancellation-payment="${html(booking.id)}">Mark Payment Received</button>`;
  if(booking.status==='Cancelled'&&(!cancellationDue||paymentStatus==='Paid'))actions+=`<button class="btn small secondary" data-restore-booking="${html(booking.id)}">Restore</button>`;
  return `<tr><td>${html(booking.customerName||'Customer')}</td><td>${html(booking.serviceName)}</td><td>${html(booking.expertName||'—')}</td><td>${money(booking.price)}</td><td>${html(booking.status)}${paymentLabel}</td><td>${new Date(bookingHistoryTimestamp(booking)).toLocaleString('en-IN',{timeZone:'Asia/Kolkata',dateStyle:'medium',timeStyle:'short'})}</td><td><div class="actions">${actions}</div></td></tr>`;
}
function customerWallBookingHistoryRow(booking){
  return `<tr><td>${html(booking.serviceName)}</td><td>${html(booking.expertName||'—')}</td><td>${money(booking.price)}</td><td>${html(booking.status)}</td><td>${html(booking.date)} · ${html(booking.startTime)}</td></tr>`;
}
async function reopenBookingPayment(bookingId){
  const booking=(state.bookings||[]).find(row=>row.id===bookingId);if(!booking)return;
  if(!confirm('Mark payment as not received and ask the customer to try again?'))return;
  const changes={paymentMarkedAt:'',updatedAt:now()};
  try{
    await api.update(bookingKind(booking.ownerId),bookingId,changes);
    Object.assign(booking,changes);refreshView();toast('Payment reopened for the customer');
  }catch(error){toast(error.message||'Could not reopen payment')}
}
async function confirmCancellationPayment(bookingId,paid,button){
  const booking=(state.bookings||[]).find(row=>row.id===bookingId);if(!booking)return;
  const question=paid?`Confirm that ${money(booking.cancellationDueAmount)} cancellation payment was received?`:'Mark this payment as not received and ask the customer to pay again?';
  if(!confirm(question))return;
  button.disabled=true;
  try{
    const action=paid?'digit58-confirm-cancellation-payment':'digit58-reopen-cancellation-payment';
    const result=await api.executeFunction(api.config.digitalOrderFunctionId,{action,ownerId:booking.ownerId,bookingId});
    if(result?.booking)Object.assign(booking,result.booking);
    save();bookingHistoryView();toast(paid?'Cancellation payment confirmed — customer can book again':'Cancellation payment reopened');
  }catch(error){button.disabled=false;toast(error.message||'Could not update cancellation payment')}
}
function ownerBookingMarkup(booking,store=activeStore()){
  const copy=bookingCopy(store),gameZone=isGameZone(store);
  const status=booking.status||'Pending Payment';
  const ringing=ringingIds.has(booking.id);
  let actions='';
  if(status==='Requested')actions=`<button class="btn small green" data-confirm-booking="${html(booking.id)}">Accept Booking</button><button class="btn small red" data-cancel-booking="${html(booking.id)}">Cancel</button>`;
  else if(status==='Pending Payment')actions=booking.paymentMarkedAt?`<button class="btn small green" data-confirm-booking="${html(booking.id)}">Payment Received — Confirm</button><button class="btn small secondary" data-reopen-booking-payment="${html(booking.id)}">Payment Not Received</button>`:`<button class="btn small green" data-confirm-booking="${html(booking.id)}">Payment Received — Confirm</button><button class="btn small red" data-cancel-booking="${html(booking.id)}">Cancel</button>`;
  else if(status==='Confirmed')actions=`<button class="btn small green" data-complete-booking="${html(booking.id)}">Mark Completed</button><button class="btn small red" data-cancel-booking="${html(booking.id)}">Cancel</button>`;
  const upfrontAmount=Number(booking.upfrontAmount)||Number(booking.prepaymentAmount)||0;
  const cancellationNote=Number(booking.cancellationChargeAmount)>0?`<p class="muted">Cancellation fee if customer cancels: ${money(booking.cancellationChargeAmount)}</p>`:'';
  const balanceNote=Number(booking.balanceAmount)>0?`<p class="muted">Balance ${money(booking.balanceAmount)}${booking.balancePaid?' · Paid':` due ${copy.after}`}</p>`:'';
  return `<article class="card order-item-card ${ringing?'incoming-order':''}">${ringing?'<span class="incoming-order-beacon" aria-label="New booking" title="New booking"></span>':''}<div class="section-head"><h3>${html(booking.serviceName)}</h3><span class="chip">${html(status)}</span></div><p class="muted">${html(booking.date)} · ${html(booking.startTime)}${booking.expertName?` · ${gameZone?html(booking.expertName):`with ${html(booking.expertName)}`}`:''}</p><p class="muted">${html(booking.customerName||'Customer')}${booking.phone?` · ${html(booking.phone)}`:''}</p><p class="muted">Price ${money(booking.price)}${upfrontAmount>0?` · Prepaid ${money(upfrontAmount)}`:''}</p>${doorstepBookingOwnerMarkup(booking)}${cancellationNote}${balanceNote}${actions?`<div class="actions">${actions}</div>`:''}${bookingChatMarkup(booking,'owner')}</article>`;
}
async function confirmBookingPayment(bookingId){
  const booking=(state.bookings||[]).find(row=>row.id===bookingId);if(!booking)return;
  const wasRequested=booking.status==='Requested';
  try{
    const changes={status:'Confirmed',confirmedAt:now(),updatedAt:now()};
    await api.update(bookingKind(booking.ownerId),bookingId,changes);
    Object.assign(booking,changes);refreshView();toast(wasRequested?'Booking accepted':'Booking confirmed');
  }catch(error){toast(error.message||'Could not confirm booking')}
}
async function completeBooking(bookingId){
  const booking=(state.bookings||[]).find(row=>row.id===bookingId);if(!booking)return;
  try{
    const hasBalance=Number(booking.balanceAmount)>0;
    const service=(state.services||[]).find(row=>row.id===booking.serviceId);
    const reminderDays=Math.max(0,Number(service?.reminderDays)||0);
    const changes={status:'Completed',completedAt:now(),balancePaid:true,balancePaidAt:hasBalance?now():booking.balancePaidAt||'',nextReminderAt:reminderDays?new Date(Date.now()+reminderDays*86400000).toISOString():'',updatedAt:now(),messages:[]};
    await api.update(bookingKind(booking.ownerId),bookingId,changes);
    Object.assign(booking,changes);refreshView();toast('Booking marked completed');
  }catch(error){toast(error.message||'Could not update booking')}
}
async function cancelBooking(bookingId){
  const booking=(state.bookings||[]).find(row=>row.id===bookingId);if(!booking)return;
  try{
    const changes={status:'Cancelled',cancelledAt:now(),updatedAt:now()};
    await api.update(bookingKind(booking.ownerId),bookingId,changes);
    Object.assign(booking,changes);refreshView();toast('Booking cancelled');
  }catch(error){toast(error.message||'Could not cancel booking')}
}
async function restoreBooking(bookingId){
  const booking=(state.bookings||[]).find(row=>row.id===bookingId);if(!booking)return;
  try{
    if(Number(booking.cancellationDueAmount)>0&&booking.cancellationPaymentStatus!=='Paid')return toast('Confirm the cancellation payment before restoring this booking');
    const changes={status:'Confirmed',cancelledAt:'',confirmedAt:now(),updatedAt:now()};
    await api.update(bookingKind(booking.ownerId),bookingId,changes);
    Object.assign(booking,changes);refreshView();toast('Booking restored');
  }catch(error){toast(error.message||'Could not restore booking')}
}
async function importCatalogCsvFile(store,file){
  if(!file)return;
  if(file.size>1024*1024){$('#catalogCsvFile').value='';return toast('CSV file must be below 1 MB')}
  try{
    const rows=parseCatalogCsv(await file.text());
    if(!rows.length)throw new Error('No valid rows found in CSV');
    if(rows.length>200)throw new Error('Import up to 200 items at a time');
    const created=[];
    for(const row of rows){
      const record={id:id('catalog'),ownerId:store.ownerId,storeId:store.id,name:row.name,price:row.price,unit:row.unit,createdAt:now()};
      await api.create(catalogKind(store.ownerId),record,record.id,api.permissionSet?.(catalogKind(store.ownerId),store.ownerId,true));
      created.push(record);
    }
    state.catalog=[...(state.catalog||[]),...created];save();
    catalogView();toast(`${created.length} item(s) imported`);
  }catch(error){
    toast(error.message||'Could not import catalog CSV');
  }finally{$('#catalogCsvFile')&&($('#catalogCsvFile').value='')}
}
function medicineFieldsMarkup(){return `<div class="form-grid"><div class="field"><label>Medicine name</label><input name="medName" required></div><div class="field"><label>Time</label><input name="medTime" type="time" required></div></div><div class="field"><label>Days</label><input name="medDays" type="number" min="1" step="1" value="5" required></div>`}
function openCreateCourseModal(store,customer){
  modal('New Medicine Course',`<form id="createCourseForm"><div class="field"><label>Patient name</label><input name="patientName" value="${html(customer.customerName||'')}" required></div>${medicineFieldsMarkup()}<button class="btn full" type="submit" style="margin-top:14px">Start Course</button></form>`,()=>{
    $('#createCourseForm').onsubmit=async event=>{
      event.preventDefault();
      const values=Object.fromEntries(new FormData(event.target)),patientName=values.patientName.trim(),button=event.submitter;
      if(!patientName)return toast('Enter the patient name');
      button.disabled=true;
      try{
        await api.executeFunction(api.config.digitalOrderFunctionId,{action:'digit58-create-course',ownerId:store.ownerId,storeId:store.id,patientName,medicine:{name:values.medName.trim(),time:values.medTime,days:Number(values.medDays)}});
        closeModal();toast('Medicine course started');
        await loadAndRenderCustomerView(store,customer);
      }catch(error){button.disabled=false;toast(error.message||'Could not start course')}
    };
  });
}
function openAddMedicineModal(store,customer,course){
  modal(`Add Medicine — ${html(course.patientName)}`,`<form id="addMedicineForm">${medicineFieldsMarkup()}<button class="btn full" type="submit" style="margin-top:14px">Add Medicine</button></form>`,()=>{
    $('#addMedicineForm').onsubmit=async event=>{
      event.preventDefault();
      const values=Object.fromEntries(new FormData(event.target)),button=event.submitter;
      button.disabled=true;
      try{
        await api.executeFunction(api.config.digitalOrderFunctionId,{action:'digit58-add-medicine',ownerId:store.ownerId,courseId:course.id,medicine:{name:values.medName.trim(),time:values.medTime,days:Number(values.medDays)}});
        closeModal();toast('Medicine added to course');
        await loadAndRenderCustomerView(store,customer);
      }catch(error){button.disabled=false;toast(error.message||'Could not add medicine')}
    };
  });
}
function openPlaceOrderModal(store,customer,promotions=[],rejectedDraft=null){
  let capturedLocation=(customer.savedLocationLat&&customer.savedLocationLng)?{lat:customer.savedLocationLat,lng:customer.savedLocationLng}:null;
  const selectedPromotions=promotions.filter(promotion=>customerPromotionQuantities.has(promotion.id)).map(promotion=>({name:promotion.name,qty:customerPromotionQuantities.get(promotion.id)}));
  const rejectedItems=Array.isArray(rejectedDraft?.items)?rejectedDraft.items.map(item=>({name:item.name,qty:item.qty})).filter(item=>item.name):[];
  const startingItems=rejectedItems.length?rejectedItems:(selectedPromotions.length?selectedPromotions:[{}]);
  const minimum=storeMinimum(store),selectedPromotionValue=promotions.reduce((total,promotion)=>total+(customerPromotionQuantities.get(promotion.id)||0)*(Number(promotion.price)||0),0);
  const draftValue=Math.max(0,Number(rejectedDraft?.customerOrderValue)||0)||selectedPromotionValue;
  const minimumBlock=minimum?`<div class="minimum-order-notice"><strong>Minimum new order: ${money(minimum)}</strong><p>Enter the estimated value of these items. If it's below the minimum, you can request one-time approval from the store.</p><div class="field"><label>Estimated order value (₹)</label><input id="customerOrderValue" name="customerOrderValue" type="number" min="0" step="0.01" value="${draftValue||''}" placeholder="${minimum}" required></div></div>`:'';
  const rejectedNote=rejectedDraft?`<div class="rejection-revise-note"><strong>Update the rejected order</strong><p>${html(rejectedDraft.rejectionReason||'Change the items or details before resubmitting.')}</p></div>`:'';
  const hasSavedLocation=!!capturedLocation;
  modal(rejectedDraft?'Revise Rejected Order':'Place New Order',`<form id="placeOrderForm">${rejectedNote}${selectedPromotions.length&&!rejectedItems.length?`<div class="selected-offer-note">${selectedPromotions.length} promotional item${selectedPromotions.length===1?'':'s'} added. You can change quantities below.</div>`:''}${minimumBlock}<div id="orderItemRows">${startingItems.map(orderItemRowMarkup).join('')}</div><button type="button" class="btn small secondary" id="addItemRow" style="margin-top:8px">+ Add another item</button><div class="field" style="margin-top:14px"><label>Contact number</label><input name="phone" type="tel" value="${html(customer.phone||rejectedDraft?.phone||'')}" placeholder="10-digit mobile number" required></div><div class="field"><label>Delivery address</label><textarea name="address" rows="2" placeholder="House/flat no., street, landmark, city" required>${html(customer.address||'')}</textarea></div><div class="field"><button type="button" class="btn small secondary" id="shareLocationBtn">📍 ${hasSavedLocation?'Update Location':'Share My Location'}</button><p class="muted ${hasSavedLocation?'location-captured':''}" id="locationStatus" style="margin-top:6px">${hasSavedLocation?'📍 Using your saved location — it will be sent with your order.':'Optional — helps the store guide your delivery.'}</p></div><div class="field"><label>Prescription image <small>(optional)</small></label><input id="prescriptionFile" type="file" accept="image/jpeg,image/png,image/webp"></div><div class="minimum-order-actions"><button class="btn full" type="submit" style="margin-top:14px">${rejectedDraft?'Resubmit Order':'Submit Order'}</button>${minimum?'<button class="btn full secondary" type="submit" data-request-minimum-approval="true">Request Owner Approval</button>':''}</div></form>`,()=>{
    $('#addItemRow').onclick=()=>$('#orderItemRows').insertAdjacentHTML('beforeend',orderItemRowMarkup());
    $('#orderItemRows').addEventListener('click',event=>{const row=event.target.closest('.remove-item-row');if(row&&$$('.order-item-row').length>1)row.closest('.order-item-row').remove()});
    bindShareLocationButton($('#shareLocationBtn'),$('#locationStatus'),point=>{capturedLocation=point});
    $('#placeOrderForm').onsubmit=async event=>{
      event.preventDefault();
      const names=$$('[name="itemName[]"]').map(input=>input.value.trim());
      const qtys=$$('[name="itemQty[]"]').map(input=>Math.max(1,Number(input.value)||1));
      const items=names.map((name,index)=>({name,qty:qtys[index]})).filter(item=>item.name);
      if(!items.length)return toast('Add at least one item');
      const customerOrderValue=minimum?Math.max(0,Number($('#customerOrderValue').value)||0):0;
      const requestMinimumApproval=event.submitter?.dataset.requestMinimumApproval==='true';
      if(minimum&&customerOrderValue<minimum&&!requestMinimumApproval){$('#customerOrderValue').focus();return toast(`Minimum new order value is ${money(minimum)} — or request owner approval`)}
      if(requestMinimumApproval&&customerOrderValue>=minimum)return toast('This order already meets the minimum. Use Submit Order.');
      const phone=$('input[name="phone"]',event.target).value.trim();
      const address=$('textarea[name="address"]',event.target).value.trim();
      const button=event.submitter;button.disabled=true;
      try{
        let prescription={};
        const file=$('#prescriptionFile').files[0];
        if(file){
          const uploaded=await api.uploadAdMedia(file);
          prescription={prescriptionUrl:uploaded.mediaUrl,prescriptionFileId:uploaded.fileId,prescriptionName:uploaded.mediaName,prescriptionType:uploaded.mediaType};
        }
        await api.executeFunction(api.config.digitalOrderFunctionId,{action:'digit58-create-order',ownerId:store.ownerId,storeId:store.id,customerName:customer.customerName,customerEmail:customer.customerEmail,items,customerOrderValue,requestMinimumApproval,phone,address,locationLat:capturedLocation?.lat,locationLng:capturedLocation?.lng,...prescription});
        const profileUpdates={};
        if(phone&&phone!==customer.phone)profileUpdates.phone=phone;
        if(address&&address!==customer.address)profileUpdates.address=address;
        if(capturedLocation&&(capturedLocation.lat!==customer.savedLocationLat||capturedLocation.lng!==customer.savedLocationLng)){profileUpdates.savedLocationLat=capturedLocation.lat;profileUpdates.savedLocationLng=capturedLocation.lng}
        if(Object.keys(profileUpdates).length){await api.update(customerKind(store.ownerId),customer.id,profileUpdates).catch(()=>{});Object.assign(customer,profileUpdates)}
        customerPromotionQuantities.clear();
        closeModal();toast(requestMinimumApproval?'Minimum-order approval requested from the store':'Order sent to the store');
        await loadAndRenderCustomerView(store,customer);
      }catch(error){button.disabled=false;toast(error.message||'Could not place order')}
    };
  });
}

window.addEventListener('hashchange',boot);
boot();
