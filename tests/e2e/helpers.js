import { expect } from "@playwright/test";

export const emptyConfigScript = `
window.GRAVITY58_CONFIG={testMode:true,gravity58Url:'http://127.0.0.1:4173/',adBookingPortalUrl:'/advertise/',appwrite:{}};
window.GRAVITY58_AD_BOOKING_CONFIG=window.GRAVITY58_CONFIG;
window.GRAVITY58_AD_ADMIN_CONFIG=window.GRAVITY58_CONFIG;
`;

export const externalLibraryMocks = `
window.Appwrite={};
window.QRCode=class QRCode{constructor(target,options={}){target.dataset.qrText=options.text||'';target.innerHTML='<div data-testid="qr-rendered">QR</div>'}};
window.QRCode.CorrectLevel={H:'H'};
window.jspdf={jsPDF:class{setFont(){} setFontSize(){} text(){} line(){} setDrawColor(){} addPage(){} save(name){window.__lastDownload=name} output(){return new Blob(['pdf'],{type:'application/pdf'})}}};
`;

export async function prepareOffline(page, { state = "Telangana", blockSiteAuth = false } = {}) {
  await page.route(/cdn\.jsdelivr\.net\/npm\/appwrite|cdnjs\.cloudflare\.com\/ajax\/libs\/qrcodejs|cdnjs\.cloudflare\.com\/ajax\/libs\/jspdf|cdn\.jsdelivr\.net\/npm\/qrcodejs/, (route) =>
    route.fulfill({ contentType: "application/javascript", body: externalLibraryMocks }),
  );
  await page.route(/\/(?:js|advertise|digital-menu|team-admin)\/config\.js(?:\?.*)?$/, (route) =>
    route.fulfill({ contentType: "application/javascript", body: emptyConfigScript }),
  );
  if (blockSiteAuth) {
    await page.route(/\/js\/site-auth\.js(?:\?.*)?$/, (route) =>
      route.fulfill({ contentType: "application/javascript", body: "window.G58SiteUser={id:'test-user',email:'test@example.com',phone:'9876543210'};" }),
    );
  }
  if (state) {
    await page.addInitScript((selectedState) => localStorage.setItem("g58SelectedState", selectedState), state);
  }
}

export function mockApiScript({ initialUser = null, admin = false, seed = {} } = {}) {
  return `(() => {
    const clone=value=>JSON.parse(JSON.stringify(value));
    const store=clone(${JSON.stringify({ profiles: [], bookings: [], advertisements: [], slots: [], posts: [], digital_menus: [], ...seed })});
    let user=${JSON.stringify(initialUser)};
    let serial=0;
    const clean=row=>({...row,id:row.id||row.$id,$id:row.$id||row.id});
    const notify=(kind,row)=>window.dispatchEvent(new CustomEvent('g58-ad-data-changed',{detail:{kind,row}}));
    window.__g58Mock={store,get user(){return user},setUser(next){user=next?clone(next):null},recoveries:[],permissionCalls:[],createAttempts:[],removedMedia:[]};
    window.Gravity58Ads={
      configured:true,config:{adminTeamId:'test-team'},collections:{},client:null,account:null,databases:null,tables:null,
      list:async(kind,filters={})=>(store[kind]||[]).filter(row=>Object.entries(filters).every(([key,value])=>value===''||value===undefined||row[key]===value)).map(clean),
      get:async(kind,id)=>{const row=(store[kind]||[]).find(item=>(item.id||item.$id)===id);if(!row)throw new Error('Record not found');return clean(row)},
      create:async(kind,data,documentId,permissions)=>{const id=documentId||kind+'-'+(++serial);window.__g58Mock.createAttempts.push({kind,id,permissions:clone(permissions||[])});if((store[kind]||[]).some(item=>(item.id||item.$id)===id)){const error=new Error(kind.startsWith('digital_order_')?'Permissions must be one of the roles available to this restaurant account':'Record already exists');error.code=kind.startsWith('digital_order_')?401:409;throw error}const row=clean({id,...clone(data),$createdAt:new Date().toISOString(),$updatedAt:new Date().toISOString()});(store[kind]||=[]).unshift(row);window.__g58Mock.permissionCalls.push({action:'create',kind,id,permissions:clone(permissions||[])});notify(kind,row);return row},
      update:async(kind,id,data,permissions)=>{const row=(store[kind]||[]).find(item=>(item.id||item.$id)===id);if(!row)throw new Error('Record not found');Object.assign(row,clone(data),{$updatedAt:new Date().toISOString()});window.__g58Mock.permissionCalls.push({action:'update',kind,id,permissions:clone(permissions||[])});notify(kind,row);return clean(row)},
      remove:async(kind,id)=>{store[kind]=(store[kind]||[]).filter(item=>(item.id||item.$id)!==id);notify(kind,{id});return true},
      upsertSlot:async(slot)=>{const existing=(store.slots||[]).find(row=>row.restaurantKey===slot.restaurantKey);if(existing){Object.assign(existing,slot);return clean(existing)}const row=clean({id:slot.id||'slot-'+(++serial),...slot});store.slots.unshift(row);return row},
      register:async(email,password,name,phone='')=>{user={\$id:'user-'+(++serial),email,name};const profile=clean({id:'profile-'+serial,userId:user.\$id,email,name,phone,accountType:'customer',state:'',district:'',blocked:false});store.profiles.unshift(profile);return clone(user)},
      login:async(email,password)=>{if(!email||!password)throw new Error('Email and password are required');user={\$id:'mock-user',email,name:email.split('@')[0]};return {\$id:'session'}},
      logout:async()=>{user=null;return true},
      currentUser:async()=>user?clone(user):null,
      ensureUser:async()=>{if(!user)user={\$id:'anon-'+(++serial),email:'',name:'Guest'};return clone(user)},
      executeFunction:async(functionId,payload={})=>{
        const action=payload.action||'';
        if(action==='digit58-link-customer'){
          const kind='digit58_customer_'+String(payload.ownerId||'').replace(/[^a-zA-Z0-9._-]/g,'-').slice(0,36);
          let customer=(store[kind]||[]).find(row=>row.storeId===payload.storeId&&row.customerAccountId===user?.\$id);
          if(!customer){customer=clean({id:'customer-'+(++serial),ownerId:payload.ownerId,storeId:payload.storeId,customerAccountId:user?.\$id,customerName:payload.customerName,customerEmail:payload.customerEmail,phone:''});(store[kind]||=[]).unshift(customer)}
          const links=Object.entries(store).filter(([candidateKind])=>candidateKind.startsWith('digit58_customer_')).flatMap(([,rows])=>rows.filter(row=>row.customerAccountId===user?.\$id&&row.storeId).map(row=>({ownerId:row.ownerId,storeId:row.storeId,customerId:row.id})));
          const stores=[...new Map(links.map(link=>[link.ownerId+':'+link.storeId,link])).values()].map(link=>{const storeKind='digit58_store_'+String(link.ownerId||'').replace(/[^a-zA-Z0-9._-]/g,'-').slice(0,40),live=(store[storeKind]||[]).find(row=>(row.id||row.\$id)===link.storeId);return live?{ownerId:link.ownerId,storeId:link.storeId,storeName:live.name||'Store',category:live.category||'',city:live.city||'',suspended:Boolean(live.suspended),customerId:link.customerId}:null}).filter(Boolean).sort((a,b)=>a.storeName.localeCompare(b.storeName));
          return {ok:true,customer:clone(customer),stores:clone(stores)};
        }
        if(action==='digit58-reorder'){
          const kind='digit58_order_'+String(payload.ownerId||'').replace(/[^a-zA-Z0-9._-]/g,'-').slice(0,40);
          const source=(store[kind]||[]).find(row=>(row.id||row.\$id)===payload.orderId);
          if(!source||source.customerAccountId!==user?.\$id)throw new Error('Only this order customer can reorder these items.');
          const row=clean({...clone(source),id:'reorder-'+(++serial),status:'Requested',previousAmount:Number(source.amount)||0,amount:0,upiId:'',upiUri:'',reorderedFrom:source.id,phone:String(payload.phone||source.phone||'').replace(/\D/g,''),createdAt:new Date().toISOString(),updatedAt:new Date().toISOString()});
          (store[kind]||=[]).unshift(row);notify(kind,row);return {ok:true,order:clone(row)};
        }
        if(action==='digit58-create-order'){
          const kind='digit58_order_'+String(payload.ownerId||'').replace(/[^a-zA-Z0-9._-]/g,'-').slice(0,40);
          const storeKind='digit58_store_'+String(payload.ownerId||'').replace(/[^a-zA-Z0-9._-]/g,'-').slice(0,40),selectedStore=(store[storeKind]||[]).find(row=>(row.id||row.\$id)===payload.storeId);
          if(!selectedStore)throw new Error('Store details are missing.');
          const minimum=selectedStore.minimumOrderEnabled===false?0:Math.max(0,Number(selectedStore.minimumOrderValue)||0),customerOrderValue=Math.max(0,Number(payload.customerOrderValue)||0),belowMinimum=minimum>0&&customerOrderValue<minimum;
          if(belowMinimum&&!payload.requestMinimumApproval)throw new Error('Minimum new order value is ₹'+minimum.toLocaleString('en-IN')+'. Ask the store owner for approval if needed.');
          const status=belowMinimum?'Minimum Approval Requested':'Requested';
          const row=clean({id:'order-'+(++serial),ownerId:payload.ownerId,storeId:payload.storeId,customerAccountId:user?.\$id,customerName:payload.customerName,customerEmail:payload.customerEmail,phone:String(payload.phone||'').replace(/\D/g,''),items:clone(payload.items||[]),customerOrderValue,minimumOrderValueAtOrder:minimum,minimumApprovalStatus:belowMinimum?'Requested':'',amount:0,previousAmount:0,upiUri:'',status,messages:[],createdAt:new Date().toISOString(),updatedAt:new Date().toISOString()});
          (store[kind]||=[]).unshift(row);notify(kind,row);return {ok:true,order:clone(row)};
        }
        if(action==='digit58-create-refill-order'){
          const cardKind='digit58_card_'+String(payload.ownerId||'').replace(/[^a-zA-Z0-9._-]/g,'-').slice(0,40);
          const orderKind='digit58_order_'+String(payload.ownerId||'').replace(/[^a-zA-Z0-9._-]/g,'-').slice(0,40);
          const card=(store[cardKind]||[]).find(row=>(row.id||row.\$id)===payload.cardId);
          if(!card||card.customerAccountId!==user?.\$id)throw new Error('Only this card customer can request its refill.');
          const existing=(store[orderKind]||[]).find(row=>row.refillCardId===card.id&&!['Delivered','Rejected'].includes(row.status));
          if(existing)return {ok:true,order:clone(existing)};
          const createdAt=new Date().toISOString(),row=clean({id:'refill-order-'+(++serial),ownerId:payload.ownerId,storeId:card.storeId,customerAccountId:user?.\$id,customerName:payload.customerName,customerEmail:payload.customerEmail,phone:String(payload.phone||card.phone||'').replace(/\D/g,''),items:[{name:card.productName,qty:1}],amount:0,previousAmount:Number(card.price)||0,refillCardId:card.id,upiUri:'',status:'Requested',messages:[],createdAt,updatedAt:createdAt});
          (store[orderKind]||=[]).unshift(row);Object.assign(card,{status:'Refill Requested',refillRequestedAt:createdAt,activeOrderId:row.id,phone:row.phone,updatedAt:createdAt});notify(orderKind,row);notify(cardKind,card);return {ok:true,order:clone(row)};
        }
        if(action==='digit58-set-store-suspended'){
          if(!${admin ? "true" : "false"})throw new Error('Only G58 administrators can manage store status.');
          const kind='digit58_store_'+String(payload.ownerId||'').replace(/[^a-zA-Z0-9._-]/g,'-').slice(0,40);
          const row=(store[kind]||[]).find(item=>(item.id||item.\$id)===payload.storeId);
          if(!row)throw new Error('Store details are missing.');
          Object.assign(row,{suspended:Boolean(payload.suspended),suspendedAt:payload.suspended?new Date().toISOString():''});
          const summary=(store.digit58_owners||[]).find(item=>item.ownerId===payload.ownerId&&(item.storeId||item.id)===payload.storeId);
          if(summary)summary.suspended=row.suspended;
          notify(kind,row);return {ok:true,store:clone(row)};
        }
        throw new Error('Unsupported secure test action: '+action);
      },
      forgotPassword:async(email,url)=>{window.__g58Mock.recoveries.push({email,url});return true},
      completeRecovery:async()=>true,
      createJWT:async()=>"mock-g58-jwt",
      isTeamAdmin:async()=>${admin ? "true" : "false"},
      validateMediaFile:(file)=>{if(!file||!file.size)throw new Error('Select a file first')},
      uploadAdMedia:async(file)=>({fileId:'mock-file-'+(++serial),mediaUrl:'https://example.com/'+encodeURIComponent(file.name),mediaType:file.type,mediaName:file.name}),
      uploadPaymentReceipt:async(file)=>{await window.Gravity58Ads.ensureUser();return {fileId:'mock-receipt-'+(++serial),mediaUrl:'https://example.com/'+encodeURIComponent(file.name),mediaType:file.type,mediaName:file.name}},
      removeAdMedia:async(fileId)=>{window.__g58Mock.removedMedia.push(fileId);return true},
      validateMenuImage:(file)=>{if(!file?.size)throw new Error('Select a restaurant or menu image first');if(file.size>100*1024)throw new Error('Restaurant and menu images must be 100 KB or smaller')},
      uploadMenuMedia:async(file)=>({fileId:'mock-menu-'+(++serial),path:'mock-menu-'+serial,mediaUrl:'https://media.example.com/'+encodeURIComponent(file.name),mediaType:file.type,mediaName:file.name}),
      removeMenuMedia:async()=>true,
      permissionSet:(kind,userId)=>['read:any','read:user:'+userId,'update:user:'+userId,'delete:user:'+userId],
      userPermissionSet:(userIds=[])=>userIds.filter(Boolean).flatMap(id=>['read:user:'+id,'update:user:'+id,'delete:user:'+id]),
      collaborativePermissionSet:(userId)=>['read:users','update:users','read:user:'+userId,'update:user:'+userId,'delete:user:'+userId],
      subscribeAdvertisements:(onChange)=>{const handler=event=>{if(!event.detail?.kind||event.detail.kind==='advertisements')onChange?.(event.detail?.row||null,event)};window.addEventListener('g58-ad-data-changed',handler);return()=>window.removeEventListener('g58-ad-data-changed',handler)},
      subscribeKind:(kind,onChange)=>{const handler=event=>{if(!event.detail?.kind||event.detail.kind===kind)onChange?.(event.detail?.row||null,event)};window.addEventListener('g58-ad-data-changed',handler);return()=>window.removeEventListener('g58-ad-data-changed',handler)},
    };
  })();`;
}

export async function prepareMockApi(page, options = {}) {
  await prepareOffline(page, { state: options.state ?? "Telangana" });
  await page.route(/\/js\/appwrite-ads\.js(?:\?.*)?$/, (route) =>
    route.fulfill({ contentType: "application/javascript", body: mockApiScript(options) }),
  );
}

export function monitorPageErrors(page) {
  const failures = [];
  page.on("pageerror", (error) => failures.push(error.message));
  return async () => expect(failures, `Unexpected page errors:\n${failures.join("\n")}`).toEqual([]);
}
