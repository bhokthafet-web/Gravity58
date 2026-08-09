import { expect } from "@playwright/test";

export const emptyConfigScript = `
window.GRAVITY58_CONFIG={demoMode:true,gravity58Url:'http://127.0.0.1:4173/',adBookingPortalUrl:'/advertise/',appwrite:{}};
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
    const store=clone(${JSON.stringify({ profiles: [], bookings: [], advertisements: [], slots: [], posts: [], ...seed })});
    let user=${JSON.stringify(initialUser)};
    let serial=0;
    const clean=row=>({...row,id:row.id||row.$id,$id:row.$id||row.id});
    const notify=(kind,row)=>window.dispatchEvent(new CustomEvent('g58-ad-data-changed',{detail:{kind,row}}));
    window.__g58Mock={store,get user(){return user},recoveries:[]};
    window.Gravity58Ads={
      configured:true,config:{adminTeamId:'test-team'},collections:{},client:null,account:null,databases:null,tables:null,
      list:async(kind,filters={})=>(store[kind]||[]).filter(row=>Object.entries(filters).every(([key,value])=>value===''||value===undefined||row[key]===value)).map(clean),
      create:async(kind,data,documentId)=>{const row=clean({id:documentId||kind+'-'+(++serial),...clone(data),$createdAt:new Date().toISOString(),$updatedAt:new Date().toISOString()});(store[kind]||=[]).unshift(row);notify(kind,row);return row},
      update:async(kind,id,data)=>{const row=(store[kind]||[]).find(item=>(item.id||item.$id)===id);if(!row)throw new Error('Record not found');Object.assign(row,clone(data),{$updatedAt:new Date().toISOString()});notify(kind,row);return clean(row)},
      remove:async(kind,id)=>{store[kind]=(store[kind]||[]).filter(item=>(item.id||item.$id)!==id);notify(kind,{id});return true},
      upsertSlot:async(slot)=>{const existing=(store.slots||[]).find(row=>row.restaurantKey===slot.restaurantKey);if(existing){Object.assign(existing,slot);return clean(existing)}const row=clean({id:slot.id||'slot-'+(++serial),...slot});store.slots.unshift(row);return row},
      register:async(email,password,name,phone='')=>{user={\$id:'user-'+(++serial),email,name};const profile=clean({id:'profile-'+serial,userId:user.\$id,email,name,phone,accountType:'customer',state:'',district:'',blocked:false});store.profiles.unshift(profile);return clone(user)},
      login:async(email,password)=>{if(!email||!password)throw new Error('Email and password are required');user={\$id:'mock-user',email,name:email.split('@')[0]};return {\$id:'session'}},
      logout:async()=>{user=null;return true},
      currentUser:async()=>user?clone(user):null,
      forgotPassword:async(email,url)=>{window.__g58Mock.recoveries.push({email,url});return true},
      completeRecovery:async()=>true,
      isTeamAdmin:async()=>${admin ? "true" : "false"},
      validateMediaFile:(file)=>{if(!file||!file.size)throw new Error('Select a file first')},
      uploadAdMedia:async(file)=>({fileId:'mock-file-'+(++serial),mediaUrl:'https://example.com/'+encodeURIComponent(file.name),mediaType:file.type,mediaName:file.name}),
      removeAdMedia:async()=>true,
      permissionSet:()=>[],
      subscribeAdvertisements:()=>()=>{},
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
