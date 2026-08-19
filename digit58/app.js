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
const REQUEST_KIND='digit58_requests',ENTITLEMENT_KIND='digit58_entitlements',SUBSCRIPTION_AMOUNT=399;
const CARD_PURCHASE_KIND='digit58_card_purchases',FREE_PROMOTION_CARDS=3;
const PROMOTION_CARD_PRICING={'30d':{label:'30 Days',amount:150,days:30},'6mo':{label:'6 Months',amount:750,days:182},'1yr':{label:'1 Year',amount:1200,days:365}};
const BRAND_KIND='digit58_brand_owners',BRAND_REQUEST_KIND='digit58_brand_requests';
const BRAND_CARD_PRICING={'30d':{label:'30 Days',amount:300,days:30},'6mo':{label:'6 Months',amount:1500,days:182},'1yr':{label:'1 Year',amount:2000,days:365}};
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

let session=null,view='dashboard';
let refreshView=()=>renderShell();
let entitlement=null,myRequest=null,myStoreRequest=null;
function storeSlotsAllowed(){return Math.max(1,Number(entitlement?.storeSlots)||1)}
let state={activeStoreId:'',stores:[],customers:[],cards:[],orders:[],promotions:[],cardPurchases:[],brandRequests:[]};
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
    const stillRinging=state.orders.some(row=>row.id===id&&['Requested','Minimum Approval Requested'].includes(row.status))||state.cards.some(row=>row.id===id&&row.status==='Buy Requested');
    if(!stillRinging)ringingIds.delete(id);
  });
  if(!ringingIds.size){if(orderAlertTimer)clearInterval(orderAlertTimer);orderAlertTimer=null;return}
  if(!orderAlertTimer){
    if(!ownerPortalIsActive()){playOwnerNotificationChime();pendingAlertReplay=playOwnerNotificationChime}
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
  const setX=x=>{thumb.style.transform=`translateX(${x}px)`;track.style.setProperty('--slide-progress',maxX>0?x/maxX:0)};
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
    if(maxX>0&&x>=maxX*.8){done=true;setX(maxX);onComplete()}
    else setX(0);
  };
  thumb.addEventListener('pointerdown',onDown);
  thumb.addEventListener('pointermove',onMove);
  thumb.addEventListener('pointerup',onUp);
  thumb.addEventListener('pointercancel',onUp);
}
function showIncomingOrderCall(store,customer,message,{title='Order placed!',hint='Slide to view order'}={}){
  stopIncomingCallRing();
  const wrap=document.createElement('div');
  wrap.className='incoming-call-overlay';
  wrap.innerHTML=`<div class="incoming-call-card"><div class="incoming-call-rings"><span></span><span></span><span></span><div class="incoming-call-avatar"><svg viewBox="0 0 120 120" fill="none" stroke="#7fffd4" stroke-width="8" aria-hidden="true"><circle cx="60" cy="26" r="15"/><circle cx="28" cy="82" r="15"/><circle cx="92" cy="82" r="15"/></svg></div></div><h2>${html(title)}</h2><p class="muted">${html(store.name)}</p><div class="slide-to-view"><div class="slide-to-view-track"><span class="slide-to-view-label">${html(hint)}</span><button type="button" class="slide-to-view-thumb" aria-label="${html(hint)}"><svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M8.59 16.59 13.17 12 8.59 7.41 10 6l6 6-6 6z"/></svg></button></div></div></div>`;
  document.body.appendChild(wrap);
  playIncomingCallRing();
  incomingCallTimer=setInterval(playIncomingCallRing,1900);
  bindSlideToView(wrap,()=>{
    stopIncomingCallRing();
    if(message)toast(message);
    loadAndRenderCustomerView(store,customer);
  });
}
const pendingOwnerOrderRung=new Set();
function ringPendingOwnerOrders(store,customer,orders){
  const pending=orders.filter(row=>row.status==='Pending Customer Acceptance');
  const unrung=pending.filter(row=>!pendingOwnerOrderRung.has(row.id));
  pending.forEach(row=>pendingOwnerOrderRung.add(row.id));
  if(unrung.length)showIncomingOrderCall(store,customer,'New order from the store — review and accept it below',{title:'Incoming order!',hint:'Slide to view order'});
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
  try{
    const result=await api.executeFunction(api.config.digitalOrderFunctionId,{action:'digit58-reject-owner-order',ownerId:store.ownerId,orderId});
    if(result?.order)markRejectionSeen(result.order,customer);
    toast('Order rejected');
    await loadAndRenderCustomerView(store,customer);
  }catch(error){toast(error.message||'Could not reject the order')}
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
  const [stores,customers,cards,orders,promotions,cardPurchases,incomingBrandRequests]=await Promise.all([
    api.list(storeKind(ownerId)).catch(()=>[]),
    api.list(customerKind(ownerId)).catch(()=>[]),
    api.list(cardKind(ownerId)).catch(()=>[]),
    api.list(orderKind(ownerId)).catch(()=>[]),
    api.list(promotionKind(ownerId)).catch(()=>[]),
    api.list(CARD_PURCHASE_KIND).catch(()=>[]),
    api.list(BRAND_REQUEST_KIND).catch(()=>[]),
  ]);
  state.stores=stores;state.customers=customers;state.cards=cards;state.orders=orders;state.promotions=await cleanupExpiredOwnerPromotions(ownerId,promotions);
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
function siteFooter(forCustomer){
  const badge=forCustomer
    ? `<a class="g58-app-badge" href="/downloads/Refills_Customer.apk" download aria-label="Download the G58 Refills Android app"><span class="g58-app-badge-icon">▶</span><span class="g58-app-badge-text"><small>Never miss a refill</small><strong>Get the G58 Refills App</strong></span></a>`
    : `<a class="g58-app-badge" href="/downloads/GRAVITY58-Android-v1.3.apk" download aria-label="Download the Gravity58 Android app"><span class="g58-app-badge-icon">▶</span><span class="g58-app-badge-text"><small>Download Android</small><strong>Get G58 App</strong></span></a>`;
  return `<footer class="g58-site-footer"><div class="g58-site-footer-badge">${badge}</div><p class="g58-site-footer-note">© ${new Date().getFullYear()} Gravity58 · Refills</p></footer>`;
}
function renderShell(){
  const store=activeStore();
  app.innerHTML=`<div class="shell"><aside class="sidebar"><a class="brand" href="../"><svg class="brand-mark" viewBox="0 0 120 120" fill="none" stroke="#7fffd4" stroke-width="8" aria-hidden="true"><circle cx="60" cy="26" r="15"/><circle cx="28" cy="82" r="15"/><circle cx="92" cy="82" r="15"/></svg><div><strong>Refills</strong><small class="muted">Store workspace</small></div></a><nav class="nav">${navButton('dashboard','◉','Dashboard')}${navButton('stores','◫','My Stores')}${navButton('promotions','✦','Promotions')}${navButton('brands','♟','Brand Orders')}${navButton('wall','☰','Customer Wall')}${navButton('orders','🧾','Orders')}${navButton('orderHistory','🕘','Order History')}${navButton('subscription','♢','Subscription')}${navButton('settings','⚙','Settings')}<button id="logout">⇥ Logout</button></nav></aside><main class="main"><header class="topbar"><div>${state.stores.length?`<select id="storeSwitch">${state.stores.map(row=>`<option value="${html(row.id)}" ${row.id===state.activeStoreId?'selected':''}>${html(row.name)}</option>`).join('')}</select>`:'<strong>No store yet</strong>'}</div><a class="g58-topbar-home" href="https://www.g58.in/" aria-label="Open the Gravity58 home page">www.g58.in</a><span class="status-pill"><span class="dot"></span>${html(session?.email||'')}</span></header><section class="content" id="page"></section></main></div>${siteFooter()}${floatingSupportButton('digit58')}`;
  $$('[data-view]').forEach(button=>button.onclick=()=>{view=button.dataset.view;renderShell()});
  $('#logout').onclick=async()=>{stopOwnerRealtime();await api.logout();session=null;renderOwnerAuth()};
  $('#storeSwitch')?.addEventListener('change',event=>{state.activeStoreId=event.target.value;save();renderShell()});
  bindFloatingSupportButton();
  renderView();
}
function navButton(key,icon,label){return `<button data-view="${key}" class="${view===key?'active':''}"><span>${icon}</span>${label}</button>`}
function renderView(){if(!activeStore()&&view!=='stores'&&view!=='settings'&&view!=='subscription'){view='stores';return renderShell()}({dashboard:dashboardView,stores:storesView,promotions:promotionsView,brands:brandPartnersView,wall:customerWallView,orders:ordersView,orderHistory:orderHistoryView,subscription:subscriptionView,settings:settingsView}[view]||dashboardView)()}
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
  if(!brandProfile.disclaimerAcceptedAt)return renderBrandDisclaimer();
  renderBrandDashboard();
  openPendingBrandTarget();
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
  modal('New Card Request',`<form id="brandRequestForm">${storeField}<div class="field"><label>Product name</label><input name="promotionName" maxlength="80" required></div><div class="field"><label>Offer line</label><input name="offerText" maxlength="120" placeholder="Pure 500g jar · limited stock"></div><div class="field"><label>Price to display</label><input name="price" type="number" min="0" step="0.01" required></div><div class="field local-image-field"><label>Product image <small>(optional · auto-compressed to fit)</small></label><input name="imageFile" type="file" accept="image/jpeg,image/png,image/webp"><div class="image-preview" id="brandImagePreview"></div></div><div class="field"><label>Plan duration</label><div class="card-purchase-tiers">${tierOptions}</div></div><p class="muted">This request goes to the store owner for approval, then costs the plan amount above for that placement duration.</p><button class="btn full" style="margin-top:10px">Send Request</button></form>`,()=>{
    const form=$('#brandRequestForm'),imageFile=form.imageFile,imagePreview=$('#brandImagePreview');
    let compressedBlob=null,previewUrl='';
    imageFile.onchange=async()=>{
      const file=imageFile.files[0];if(!file)return;
      compressedBlob=null;imagePreview.innerHTML='<span class="muted" style="font-size:12px">Compressing image…</span>';
      try{
        compressedBlob=await compressImageTo100Kb(file);
        if(previewUrl)URL.revokeObjectURL(previewUrl);
        previewUrl=URL.createObjectURL(compressedBlob);
        imagePreview.innerHTML=`<img src="${previewUrl}" alt="">`;
      }catch(error){imageFile.value='';imagePreview.innerHTML='';toast(error.message)}
    };
    form.onsubmit=async event=>{
      event.preventDefault();
      const raw=Object.fromEntries(new FormData(event.target)),button=event.submitter;
      const target=prefillTarget||parseStoreLinkOwnerStore(raw.storeLink);
      if(!target)return toast("That doesn't look like a valid store link");
      button.disabled=true;
      try{
        const store=prefillStore||await api.get(storeKind(target.ownerId),target.storeId);
        const duration=BRAND_CARD_PRICING[raw.brandDuration]?raw.brandDuration:'30d';
        const record={id:id('brandreq'),brandOwnerId:brandSession.$id,brandOwnerName:brandProfile?.name||brandSession.email.split('@')[0],brandOwnerEmail:brandSession.email,ownerId:target.ownerId,storeId:target.storeId,storeName:store.name,promotionName:raw.promotionName.trim(),offerText:raw.offerText.trim(),price:Math.max(0,Number(raw.price)||0),duration,status:'Pending Store Approval',createdAt:now()};
        if(compressedBlob){
          const upload=await api.uploadMenuMedia(new File([compressedBlob],`brand-${id('img')}.webp`,{type:compressedBlob.type}));
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
  return `<article class="promotion-ticket owner-ticket ${promotion.active===false||expired?'promotion-disabled':''}">${Number(promotion.price)>0?`<span class="promotion-ticket-ribbon">₹${Math.round(promotion.price)}</span>`:''}${promotion.imageUrl?`<div class="promotion-ticket-image"><img src="${html(promotion.imageUrl)}" alt="" loading="lazy"></div>`:''}<h3>${html(promotion.name)}</h3>${promotion.endsOn?`<small class="promotion-end-date">Offer ends ${html(formatPromotionEnd(promotion.endsOn))}</small>`:''}<div class="chips"><span class="chip ${promotion.active===false||expired?'due':'delivered'}">${expired?'Expired':promotion.active===false?'Paused':'Visible to customers'}</span></div><div class="actions"><button class="btn small" data-edit-promotion="${html(promotion.id)}">Edit</button><button class="btn small secondary" data-toggle-promotion="${html(promotion.id)}">${promotion.active===false?'Enable':'Pause'}</button><button class="btn small red" data-delete-promotion="${html(promotion.id)}">Delete</button></div></article>`;
}
function loadBrowserImage(file){return new Promise((resolve,reject)=>{if(!file?.type?.startsWith('image/'))return reject(new Error('Select a JPG, PNG or WebP image'));if(file.size>20*1024*1024)return reject(new Error('Source image must be below 20 MB'));const url=URL.createObjectURL(file),image=new Image();image.onload=()=>{URL.revokeObjectURL(url);resolve(image)};image.onerror=()=>{URL.revokeObjectURL(url);reject(new Error('This image could not be opened'))};image.src=url})}
function canvasImageBlob(canvas,type,quality){return new Promise((resolve,reject)=>canvas.toBlob(blob=>blob?resolve(blob):reject(new Error('Image compression failed')),type,quality))}
function imageHasTransparency(image,width,height){
  const probeWidth=Math.min(200,width),probeHeight=Math.max(1,Math.round(probeWidth*(height/width)));
  const canvas=document.createElement('canvas');canvas.width=probeWidth;canvas.height=probeHeight;
  const context=canvas.getContext('2d',{alpha:true});
  context.drawImage(image,0,0,probeWidth,probeHeight);
  const data=context.getImageData(0,0,probeWidth,probeHeight).data;
  for(let i=3;i<data.length;i+=4)if(data[i]<250)return true;
  return false;
}
function stripNearWhiteBackground(canvas){
  const context=canvas.getContext('2d');
  const imageData=context.getImageData(0,0,canvas.width,canvas.height);
  const data=imageData.data,low=225,high=250;
  for(let i=0;i<data.length;i+=4){
    const brightness=Math.min(data[i],data[i+1],data[i+2]);
    if(brightness>=high)data[i+3]=0;
    else if(brightness>low)data[i+3]=Math.round(data[i+3]*(1-(brightness-low)/(high-low)));
  }
  context.putImageData(imageData,0,0);
}
async function compressImageTo100Kb(file){
  const image=await loadBrowserImage(file);
  let width=Math.min(1600,image.naturalWidth||image.width),height=Math.max(1,Math.round((image.naturalHeight||image.height)*(width/(image.naturalWidth||image.width))));
  const alreadyTransparent=imageHasTransparency(image,width,height);
  const sourceCanvas=document.createElement('canvas');
  sourceCanvas.width=Math.max(1,Math.round(width));sourceCanvas.height=Math.max(1,Math.round(height));
  const sourceContext=sourceCanvas.getContext('2d',{alpha:true});
  sourceContext.drawImage(image,0,0,sourceCanvas.width,sourceCanvas.height);
  if(!alreadyTransparent)stripNearWhiteBackground(sourceCanvas);
  for(let sizePass=0;sizePass<10;sizePass++){
    const canvas=document.createElement('canvas');
    canvas.width=Math.max(1,Math.round(width));canvas.height=Math.max(1,Math.round(height));
    const context=canvas.getContext('2d',{alpha:true});
    context.drawImage(sourceCanvas,0,0,canvas.width,canvas.height);
    for(let quality=.88;quality>=.3;quality-=.08){
      const blob=await canvasImageBlob(canvas,'image/webp',quality);
      if(blob.size<=100*1024)return blob;
    }
    width*=.78;height*=.78;
  }
  throw new Error('Could not reduce this image below 100 KB. Try a smaller source image.');
}
function openPromotionForm(promotionId=''){
  const store=activeStore(),promotion=state.promotions.find(row=>row.id===promotionId)||{};if(!store)return;
  if(!promotionId&&storePromotions(store.id).length>=promotionCardAllowance(store.id))return openBuyPromotionCardForm(store);
  const defaultEnd=indiaDateValue(new Date(Date.now()+7*86400000)),today=indiaDateValue();
  modal(promotionId?'Edit Promotion':'Create Promotion',`<form id="promotionForm"><div class="field"><label>Product name</label><input name="name" value="${html(promotion.name||'')}" placeholder="Organic Honey" maxlength="80" required></div><div class="field"><label>Offer line</label><input name="offerText" value="${html(promotion.offerText||'')}" placeholder="Pure 500g jar · limited stock" maxlength="120"></div><div class="field local-image-field"><label>Product image <small>(optional · auto-compressed to fit)</small></label><input name="imageFile" type="file" accept="image/jpeg,image/png,image/webp"><div class="image-preview promotion-image-preview" id="promotionImagePreview">${promotion.imageUrl?`<img src="${html(promotion.imageUrl)}" alt="">`:''}</div></div><div class="form-grid"><div class="field"><label>Offer price</label><input name="price" type="number" min="0" step="0.01" value="${Number(promotion.price)||''}" placeholder="299" required></div><div class="field"><label>Offer ends</label><input name="endsOn" type="date" min="${today}" value="${html(promotion.endsOn||defaultEnd)}" required></div></div><label class="option-toggle"><input name="active" type="checkbox" ${promotion.active===false?'':'checked'}><span><strong>Show to customers</strong><small>Paused promotions remain saved but disappear from the customer portal.</small></span></label><button class="btn full" style="margin-top:14px">${promotionId?'Save Promotion':'Publish Promotion'}</button></form>`,()=>{
    const form=$('#promotionForm'),imageFile=form.imageFile,imagePreview=$('#promotionImagePreview');
    let previewUrl='',compressedBlob=null;
    imageFile.onchange=async()=>{
      const file=imageFile.files[0];if(!file)return;
      compressedBlob=null;
      imagePreview.innerHTML=`<span class="muted" style="font-size:12px">Compressing image…</span>`;
      try{
        compressedBlob=await compressImageTo100Kb(file);
        if(previewUrl)URL.revokeObjectURL(previewUrl);
        previewUrl=URL.createObjectURL(compressedBlob);
        imagePreview.innerHTML=`<img src="${previewUrl}" alt="">`;
      }catch(error){imageFile.value='';imagePreview.innerHTML=promotion.imageUrl?`<img src="${html(promotion.imageUrl)}" alt="">`:'';toast(error.message)}
    };
    form.onsubmit=async event=>{
      event.preventDefault();
      const raw=Object.fromEntries(new FormData(event.target)),button=event.submitter,ownerId=cloudOwnerId();
      const values={name:raw.name.trim(),offerText:raw.offerText.trim(),price:Math.max(0,Number(raw.price)||0),endsOn:raw.endsOn,badge:'Special Offer',active:$('input[name="active"]',event.target).checked,updatedAt:now()};
      if(!values.name)return toast('Enter a product name');
      if(!values.endsOn||values.endsOn<today)return toast('Choose today or a future offer end date');
      button.disabled=true;
      try{
        if(compressedBlob){
          const oldFileId=promotion.imageFileId;
          const ext=compressedBlob.type==='image/webp'?'webp':'jpg';
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
function modal(title,body,ready){document.body.classList.add('modal-open');document.body.insertAdjacentHTML('beforeend',`<div class="modal-backdrop" id="modal"><section class="modal"><div class="section-head"><h2>${title}</h2><button class="btn small secondary" id="closeModal">✕</button></div>${body}</section></div>`);$('#closeModal').onclick=closeModal;ready?.()}
function closeModal(){
  document.body.classList.remove('modal-open');
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
  let linked;
  try{linked=await ensureCustomerLink(ownerId,storeId,account)}
  catch(error){
    app.innerHTML=`<main class="public-store"><section class="store-hero"><h1>${html(store.name)}</h1></section><div class="empty">Could not connect right now. ${html(error.message||'Please try again in a moment.')}<div class="actions" style="justify-content:center;margin-top:14px"><button class="btn small" id="retryCustomerLink" type="button">Try Again</button></div></div></main>${siteFooter(true)}`;
    (typeof bindAndroidAppFooter==='function'&&bindAndroidAppFooter());
    $('#retryCustomerLink').onclick=()=>renderPublicStore(hashParams);
    return;
  }
  customerStoreLinks=linked.stores?.length?linked.stores:[{ownerId,storeId,storeName:store.name,category:store.category,city:store.city}];
  await loadAndRenderCustomerView(store,linked.customer);
  startCustomerRealtime(store,linked.customer);
}
let activeCustomerContext=null,customerRenderPending=false;
function brandRequestAsPromotion(row){
  return {id:row.id,name:row.promotionName,offerText:row.offerText,price:row.price,imageUrl:row.imageUrl,endsOn:row.expiresAt?indiaDateValue(new Date(row.expiresAt)):'',active:true,isBrandCard:true};
}
async function loadAndRenderCustomerView(store,customer){
  activeCustomerContext={store,customer};
  const [cards,orders,promotions,courses,brandRequestsForStore]=await Promise.all([
    api.list(cardKind(store.ownerId)).catch(()=>[]),
    api.list(orderKind(store.ownerId)).catch(()=>[]),
    api.list(promotionKind(store.ownerId)).catch(()=>[]),
    isMedicalStore(store)?api.list(courseKind(store.ownerId)).catch(()=>[]):Promise.resolve([]),
    api.list(BRAND_REQUEST_KIND).catch(()=>[]),
  ]);
  const myCards=cards.filter(row=>row.storeId===store.id&&row.customerAccountId===customer.customerAccountId);
  const myOrders=orders.filter(row=>row.storeId===store.id&&row.customerAccountId===customer.customerAccountId);
  const liveBrandCards=brandRequestsForStore.filter(row=>row.storeId===store.id&&row.status==='Live'&&(!row.expiresAt||new Date(row.expiresAt).getTime()>Date.now())).map(brandRequestAsPromotion);
  const myPromotions=[...promotions.filter(row=>row.storeId===store.id&&row.active!==false&&!promotionIsExpired(row)),...liveBrandCards];
  const myCourses=courses.filter(row=>row.storeId===store.id&&row.customerAccountId===customer.customerAccountId);
  if($('.modal-backdrop')){customerRenderPending=true;return}
  customerRenderPending=false;
  renderCustomerCards(store,customer,myCards,myOrders,myPromotions,myCourses);
}
let customerOrdersUnsubscribe=null,customerCardsUnsubscribe=null,customerPromotionsUnsubscribe=null,customerCoursesUnsubscribe=null;
function startCustomerRealtime(store,customer){
  activeCustomerContext={store,customer};
  startMedicineAlarmTimer(store,customer);
  if(!api?.subscribeKind)return;
  customerOrdersUnsubscribe?.();
  customerOrdersUnsubscribe=api.subscribeKind(orderKind(store.ownerId),()=>loadAndRenderCustomerView(store,customer));
  customerCardsUnsubscribe?.();
  customerCardsUnsubscribe=api.subscribeKind(cardKind(store.ownerId),()=>loadAndRenderCustomerView(store,customer));
  customerPromotionsUnsubscribe?.();
  customerPromotionsUnsubscribe=api.subscribeKind(promotionKind(store.ownerId),()=>loadAndRenderCustomerView(store,customer));
  customerCoursesUnsubscribe?.();
  if(isMedicalStore(store))customerCoursesUnsubscribe=api.subscribeKind(courseKind(store.ownerId),()=>loadAndRenderCustomerView(store,customer));
}
function stopCustomerRealtime(){customerOrdersUnsubscribe?.();customerCardsUnsubscribe?.();customerPromotionsUnsubscribe?.();customerCoursesUnsubscribe?.();customerOrdersUnsubscribe=customerCardsUnsubscribe=customerPromotionsUnsubscribe=customerCoursesUnsubscribe=null;stopPromotionAutoScroll();clearTimeout(promotionAutoScrollResumeTimer);stopMedicineAlarmTimer();dueReminderRung.clear();pendingDueBeep=false;pendingOwnerOrderRung.clear();medicineAlarmRung.clear();activeCustomerContext=null;customerRenderPending=false;stopIncomingCallRing()}
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
const shownRejectedOrderIds=new Set();
function rejectedOrderSeenKey(order,customer){return `g58-rejected-order:${customer.customerAccountId}:${order.id}:${order.rejectedAt||order.updatedAt||''}`}
function rejectionWasSeen(order,customer){try{return localStorage.getItem(rejectedOrderSeenKey(order,customer))==='1'}catch{return false}}
function markRejectionSeen(order,customer){try{localStorage.setItem(rejectedOrderSeenKey(order,customer),'1')}catch{}}
function showNextRejectedOrder(orders,store,customer,promotions=[]){
  if($('.modal-backdrop')||$('.incoming-call-overlay'))return;
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
  return qty>0?`<div class="promotion-stepper" aria-label="Selected quantity"><button type="button" data-promotion-minus="${html(promotionId)}" aria-label="Remove one">−</button><strong>${qty}</strong><button type="button" data-promotion-plus="${html(promotionId)}" aria-label="Add one">+</button></div>`:`<button type="button" class="promotion-add" data-promotion-add="${html(promotionId)}"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/></svg>Add</button>`;
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
  return `<article class="promotion-ticket customer-ticket" ${decorative?'aria-hidden="true"':''}>${Number(promotion.price)>0?`<span class="promotion-ticket-ribbon">₹${Math.round(promotion.price)}</span>`:''}${promotion.imageUrl?`<div class="promotion-ticket-image"><img src="${html(promotion.imageUrl)}" alt="" loading="lazy"></div>`:''}<h3>${html(promotion.name)}</h3>${promotion.endsOn?`<small class="promotion-end-date">Offer ends ${html(formatPromotionEnd(promotion.endsOn))}</small>`:''}<div class="promotion-ticket-foot"><div class="promotion-control" data-promotion-control="${html(promotion.id)}">${promotionQuantityControl(promotion.id)}</div></div></article>`;
}
function bindCustomerPromotionActions(promotions){
  $$('[data-promotion-add]').forEach(button=>button.onclick=()=>adjustPromotionQuantity(promotions,button.dataset.promotionAdd,1));
  $$('[data-promotion-plus]').forEach(button=>button.onclick=()=>adjustPromotionQuantity(promotions,button.dataset.promotionPlus,1));
  $$('[data-promotion-minus]').forEach(button=>button.onclick=()=>adjustPromotionQuantity(promotions,button.dataset.promotionMinus,-1));
  refreshPromotionCartBar(promotions);
}
function renderCustomerCards(store,customer,cards,orders=[],promotions=[],courses=[]){
  if(activePromotionStoreId!==store.id){activePromotionStoreId=store.id;customerPromotionQuantities.clear()}
  ringDueReminders(cards);
  ringPendingOwnerOrders(store,customer,orders);
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
  app.innerHTML=`<main class="public-store">${customerStoreHub(store)}<div id="pushNotifyPrompt"></div><section class="store-hero"><span class="chip">${html(store.category||'Store')}</span>${store.highlightText?`<strong class="store-highlight-text">${html(store.highlightText)}</strong>`:''}<h1>${html(store.name)}</h1>${storeMinimum(store)?`<p class="store-minimum-order">Minimum new order ${money(storeMinimum(store))}</p>`:''}<p class="muted">${html(store.description||'')}${store.city?' · '+html(store.city):''}</p></section>
  ${promotions.length?`<section class="promotion-strip"><div class="promotion-strip-head"><div><span>Store offers</span><h2>Fresh deals for your next order</h2></div><small>Tap Buy to include an offer</small></div><div class="promotion-rail" id="promotionRail"><div class="promotion-track"><div class="promotion-sequence">${marqueePromotions.map((promotion,index)=>customerPromotionTicket(promotion,index>=promotions.length)).join('')}</div><div class="promotion-sequence" aria-hidden="true">${marqueePromotions.map(promotion=>customerPromotionTicket(promotion,true)).join('')}</div></div></div></section>`:''}
  <div class="section-head"><div><h2>Your orders</h2>${storeMinimum(store)?`<p class="muted">New orders must be at least ${money(storeMinimum(store))}. Refills and Reorders are exempt.</p>`:''}</div><button class="btn small" id="placeOrderBtn">+ Place New Order</button></div>
  <div class="grid card-grid">${active.map(order=>customerOrderMarkup(order,store)).join('')||'<div class="empty">No active orders. Place a new order to get started.</div>'}</div>
  <div class="section-head reminder-section-head"><div><h2>Your reminder cards</h2>${cards.length>1?'<p class="muted">Swipe to see the next card or switch to list view.</p>':''}</div>${cards.length>1?`<div class="reminder-view-toggle" role="group" aria-label="Reminder card view"><button type="button" class="${customerReminderView==='swipe'?'active':''}" data-reminder-view="swipe" aria-pressed="${customerReminderView==='swipe'}">Swipe</button><button type="button" class="${customerReminderView==='list'?'active':''}" data-reminder-view="list" aria-pressed="${customerReminderView==='list'}">List</button></div>`:''}</div>
  <div class="customer-reminder-view reminder-view-${customerReminderView}" id="customerCardGrid">${cards.map(customerCardCardMarkup).join('')||'<div class="empty">Your store will add reminder cards here after your first purchase.</div>'}</div>
  ${medical?`<div class="section-head"><div><h2>Medicine Courses</h2><p class="muted">Set patient, medicine, time and days from your prescription — you'll get a daily alarm.</p></div><button class="btn small" id="newCourseBtn">+ New Course</button></div><div class="grid card-grid">${activeCourseList.map(courseMarkup).join('')||'<div class="empty">No active medicine courses yet.</div>'}</div>${completedCourseList.length?`<section class="order-history-section" id="courseHistorySection"><div class="section-head"><div><h2>Course History</h2><p class="muted">Latest course per patient is shown by default. Pick dates to see more.</p></div></div><div class="date-filter-bar"><label>From<input id="courseHistoryFrom" type="date" value="${html(courseHistoryFrom)}"></label><label>To<input id="courseHistoryTo" type="date" value="${html(courseHistoryTo)}"></label><button class="btn small secondary" id="courseHistoryClear" type="button">Show Latest</button></div><div class="card table-wrap"><table><thead><tr><th>Patient</th><th>Medicines</th><th>Completed</th></tr></thead><tbody>${courseHistoryFiltered.map(courseHistoryRow).join('')||'<tr><td colspan="3">No courses in this period.</td></tr>'}</tbody></table></div></section>`:''}`:''}
  ${history.length?`<section class="order-history-section" id="customerOrderHistory"><div class="section-head"><div><h2>Order History</h2><p class="muted">Today's history is shown by default. Select another date period when needed.</p></div><button class="btn small secondary" id="exportCustomerHistory" ${filteredHistory.length?'':'disabled'}>Export CSV</button></div><div class="date-filter-bar"><label>From<input id="customerHistoryFrom" type="date" value="${html(historyFrom)}" max="${html(historyTo)}"></label><label>To<input id="customerHistoryTo" type="date" value="${html(historyTo)}" min="${html(historyFrom)}"></label><button class="btn small secondary" id="customerHistoryToday" type="button">Today</button></div><div class="card table-wrap"><table><thead><tr><th>Items</th><th>Reorder</th><th>Amount</th><th>Status</th><th>Date</th></tr></thead><tbody>${filteredHistory.map(customerOrderHistoryRow).join('')||'<tr><td colspan="5">No orders in this period.</td></tr>'}</tbody></table></div></section>`:''}
  <div class="actions" style="margin-top:20px"><button class="btn secondary" id="custLogout">Sign out</button></div></main><div class="promotion-cart-bar" id="promotionCartBar" hidden><div class="promotion-cart-items" id="promotionCartItems"></div><div class="promotion-cart-summary" id="promotionCartSummary"><div class="promotion-cart-info"><strong id="promotionCartCount">0 items selected</strong><span id="promotionCartTotal">₹0</span></div><button type="button" class="btn" id="promotionCartCheckout">Checkout</button></div></div>${siteFooter(true)}`;
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
  $('#customerHistoryFrom')?.addEventListener('change',()=>renderCustomerCards(store,customer,cards,orders,promotions,courses));
  $('#customerHistoryTo')?.addEventListener('change',()=>renderCustomerCards(store,customer,cards,orders,promotions,courses));
  $('#customerHistoryToday')?.addEventListener('click',()=>{$('#customerHistoryFrom').value=today;$('#customerHistoryTo').value=today;renderCustomerCards(store,customer,cards,orders,promotions,courses)});
  $('#exportCustomerHistory')?.addEventListener('click',()=>downloadOrderHistoryCsv(filteredHistory,{filePrefix:`${store.name||'store'}-my-orders`.toLowerCase().replace(/[^a-z0-9]+/g,'-'),storeName:store.name||'Store'}));
  $('#newCourseBtn')?.addEventListener('click',()=>openCreateCourseModal(store,customer));
  $$('[data-add-medicine]').forEach(button=>button.onclick=()=>{
    const course=courses.find(row=>row.id===button.dataset.addMedicine);
    if(course)openAddMedicineModal(store,customer,course);
  });
  $('#courseHistoryFrom')?.addEventListener('change',()=>renderCustomerCards(store,customer,cards,orders,promotions,courses));
  $('#courseHistoryTo')?.addEventListener('change',()=>renderCustomerCards(store,customer,cards,orders,promotions,courses));
  $('#courseHistoryClear')?.addEventListener('click',()=>{$('#courseHistoryFrom').value='';$('#courseHistoryTo').value='';renderCustomerCards(store,customer,cards,orders,promotions,courses)});
  bindOrderChatForms(active,'customer',()=>loadAndRenderCustomerView(store,customer));
  bindCardChatForms(cards,'customer',()=>loadAndRenderCustomerView(store,customer));
  initShakeDetection();
  initPushNotifications(store,customer);
  (typeof bindAndroidAppFooter==='function'&&bindAndroidAppFooter());
  setTimeout(()=>showNextRejectedOrder(orders,store,customer,promotions),0);
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
    ?`<div class="pending-acceptance-note"><p class="muted">The store started this order for you. Accept it to send it into the normal order queue.</p><button type="button" class="btn full green" data-accept-owner-order="${html(order.id)}">Accept Order</button><button type="button" class="btn full secondary" data-reject-owner-order="${html(order.id)}">Reject</button></div>`
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
        closeModal();toast('Reorder sent — the store will review the amount and send your payment QR');
        await loadAndRenderCustomerView(store,customer);
      }catch(error){button.disabled=false;toast(error.message||'Could not send reorder request')}
    };
  });
}
function orderItemRowMarkup(item={}){return `<div class="order-item-row"><input name="itemName[]" placeholder="Item name" value="${html(item.name||'')}" required><input name="itemQty[]" type="number" min="1" value="${Math.max(1,Number(item.qty)||1)}" aria-label="Quantity"><button type="button" class="btn small secondary remove-item-row" aria-label="Remove item">✕</button></div>`}
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
  const minimumBlock=minimum?`<div class="minimum-order-notice"><strong>Minimum new order: ${money(minimum)}</strong><p>Enter the estimated value of these items. If it is lower, you can request one-order approval from the store.</p><div class="field"><label>Estimated order value (₹)</label><input id="customerOrderValue" name="customerOrderValue" type="number" min="0" step="0.01" value="${draftValue||''}" placeholder="${minimum}" required></div></div>`:'';
  const rejectedNote=rejectedDraft?`<div class="rejection-revise-note"><strong>Update the rejected order</strong><p>${html(rejectedDraft.rejectionReason||'Change the items or details before resubmitting.')}</p></div>`:'';
  const hasSavedLocation=!!capturedLocation;
  modal(rejectedDraft?'Revise Rejected Order':'Place New Order',`<form id="placeOrderForm">${rejectedNote}${selectedPromotions.length&&!rejectedItems.length?`<div class="selected-offer-note">${selectedPromotions.length} promotional item${selectedPromotions.length===1?'':'s'} added. You can change quantities below.</div>`:''}${minimumBlock}<div id="orderItemRows">${startingItems.map(orderItemRowMarkup).join('')}</div><button type="button" class="btn small secondary" id="addItemRow" style="margin-top:8px">+ Add another item</button><div class="field" style="margin-top:14px"><label>Contact number</label><input name="phone" type="tel" value="${html(customer.phone||rejectedDraft?.phone||'')}" placeholder="10-digit mobile number" required></div><div class="field"><label>Delivery address</label><textarea name="address" rows="2" placeholder="House/flat no., street, landmark, city" required>${html(customer.address||'')}</textarea></div><div class="field"><button type="button" class="btn small secondary" id="shareLocationBtn">📍 ${hasSavedLocation?'Update Location':'Share My Location'}</button><p class="muted ${hasSavedLocation?'location-captured':''}" id="locationStatus" style="margin-top:6px">${hasSavedLocation?'📍 Using your saved location — it will be sent with your order.':'Optional — helps the store guide your delivery.'}</p></div><div class="field"><label>Prescription image <small>(optional)</small></label><input id="prescriptionFile" type="file" accept="image/jpeg,image/png,image/webp"></div><div class="minimum-order-actions"><button class="btn full" type="submit" style="margin-top:14px">${rejectedDraft?'Resubmit Order':'Submit Order'}</button>${minimum?'<button class="btn full secondary" type="submit" data-request-minimum-approval="true">Request Owner Approval</button>':''}</div></form>`,()=>{
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
