(function(){
  "use strict";

  const stock={
    salon:"https://images.unsplash.com/photo-1560066984-138dadb4c035?auto=format&fit=crop&w=1600&q=88",
    clinic:"https://images.unsplash.com/photo-1631217868264-e5b90bb7e133?auto=format&fit=crop&w=1600&q=88",
    car:"https://images.unsplash.com/photo-1619642751034-765dfdf7c58e?auto=format&fit=crop&w=1600&q=88",
    home:"https://images.unsplash.com/photo-1581578731548-c64695cc6952?auto=format&fit=crop&w=1600&q=88",
    daycare:"https://images.unsplash.com/photo-1503454537195-1dcabb73ffb9?auto=format&fit=crop&w=1600&q=88",
    fashion:"https://images.unsplash.com/photo-1445205170230-053b83016050?auto=format&fit=crop&w=1600&q=88",
    grocery:"https://images.unsplash.com/photo-1542838132-92c53300491e?auto=format&fit=crop&w=1600&q=88",
    shoes:"https://images.unsplash.com/photo-1542291026-7eec264c27ff?auto=format&fit=crop&w=1600&q=88",
    bakery:"https://images.unsplash.com/photo-1509440159596-0249088772ff?auto=format&fit=crop&w=1600&q=88",
    food:"https://images.unsplash.com/photo-1555939594-58d7cb561ad1?auto=format&fit=crop&w=1600&q=88"
  };

  const templates=[
    {id:"salon-spa",name:"Luma Salon & Spa",category:"Service · Beauty",description:"Elegant bookings, treatments, team and testimonials.",kind:"service",accent:"#d95f8d",secondary:"#4d2033",bg:"#fff8fb",text:"#25141c",muted:"#78616b",image:stock.salon,hero:"Beauty that feels like you.",sub:"Thoughtful hair, skin and spa rituals in a calm, modern studio.",items:["Signature Hair Ritual","Glow Facial","Relaxing Spa Therapy"]},
    {id:"clinic",name:"Clarity Clinic",category:"Service · Healthcare",description:"Trusted clinic profile with doctors and appointment CTA.",kind:"service",accent:"#167a78",secondary:"#0d3f4a",bg:"#f4fbfa",text:"#102f35",muted:"#60777a",image:stock.clinic,hero:"Care built around you.",sub:"Experienced doctors, simple appointments and a calmer healthcare experience.",items:["General Consultation","Health Screening","Specialist Care"]},
    {id:"car-detailing",name:"Torque Auto Studio",category:"Service · Automotive",description:"Bold service catalogue for detailing and car care.",kind:"service",accent:"#ff5a1f",secondary:"#111827",bg:"#f7f7f5",text:"#121419",muted:"#69707d",image:stock.car,hero:"Your car. Restored.",sub:"Precision detailing, protection and maintenance for cars that deserve more.",items:["Premium Detailing","Ceramic Protection","Interior Renewal"]},
    {id:"home-services",name:"Fixora Home Services",category:"Service · Home",description:"Clear services, trust signals and instant booking.",kind:"service",accent:"#246bfd",secondary:"#172554",bg:"#f7f9ff",text:"#101a33",muted:"#69738a",image:stock.home,hero:"Home help, right on time.",sub:"Verified professionals for repairs, cleaning and everyday home care.",items:["Deep Cleaning","Electrical Repair","Plumbing Support"]},
    {id:"daycare",name:"Little Orbit Preschool",category:"Service · Education",description:"Warm admissions website for daycare and preschool.",kind:"service",accent:"#ff8a3d",secondary:"#5b3cc4",bg:"#fffaf2",text:"#2b2042",muted:"#796f87",image:stock.daycare,hero:"Big beginnings start here.",sub:"A safe, playful preschool where curiosity grows every day.",items:["Toddler Program","Preschool Program","Daycare"]},
    {id:"fashion-store",name:"Muse Fashion",category:"Product · Fashion",description:"Editorial storefront with collections and offers.",kind:"product",accent:"#e23658",secondary:"#1e1720",bg:"#fffafa",text:"#20161a",muted:"#77676d",image:stock.fashion,hero:"Wear what moves you.",sub:"New silhouettes, considered details and everyday statement pieces.",items:["Summer Edit","Workday Essentials","Weekend Collection"]},
    {id:"organic-grocery",name:"Root & Basket",category:"Product · Grocery",description:"Fresh, friendly catalogue for produce and essentials.",kind:"product",accent:"#4c8c39",secondary:"#294529",bg:"#fbfdf6",text:"#20321f",muted:"#687665",image:stock.grocery,hero:"Fresh from good soil.",sub:"Seasonal produce and everyday groceries sourced with care.",items:["Farm Fresh Fruits","Daily Vegetables","Kitchen Essentials"]},
    {id:"sneaker-store",name:"Stride Sneaker Co.",category:"Product · Footwear",description:"High-energy sneaker drops and product cards.",kind:"product",accent:"#6747ff",secondary:"#151129",bg:"#f8f7ff",text:"#17142b",muted:"#69647c",image:stock.shoes,hero:"Move different.",sub:"Curated sneakers for daily miles, weekend plans and everything between.",items:["Velocity One","Street Form","Cloud Runner"]},
    {id:"bakery-cafe",name:"Butter & Bloom Café",category:"Product · Bakery",description:"Inviting café menu, story and location layout.",kind:"menu",accent:"#d97931",secondary:"#4b2e20",bg:"#fffaf4",text:"#352117",muted:"#826b5d",image:stock.bakery,hero:"Baked slow. Served warm.",sub:"Fresh bread, small-batch pastries and coffee made for lingering.",items:["Sourdough Loaf","Butter Croissant","House Coffee"]},
    {id:"food-truck",name:"Street Ember Kitchen",category:"Product · Restaurant",description:"Vibrant food menu for trucks and quick-service brands.",kind:"menu",accent:"#ed3d25",secondary:"#27100d",bg:"#fff8f3",text:"#2d1814",muted:"#7f6962",image:stock.food,hero:"Big flavour. Wherever you are.",sub:"Fire-grilled favourites, fast pickup and a menu that travels.",items:["Smoky Chicken Bowl","Crispy Veg Wrap","Loaded Street Fries"]}
  ];

  const uid=(prefix="id")=>`${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2,8)}`;
  const clone=value=>JSON.parse(JSON.stringify(value));
  const escapeHtml=value=>String(value??"").replace(/[&<>'"]/g,char=>({"&":"&amp;","<":"&lt;",">":"&gt;","'":"&#39;",'"':"&quot;"}[char]));
  const slugify=value=>String(value||"page").trim().toLowerCase().replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,"")||"page";

  function textElement(type,text,extra={}){
    return {id:uid("el"),type,text,tag:type==="heading"?"h2":"p",link:{type:"custom",value:""},styles:{align:"left",color:"",fontSize:{desktop:"",tablet:"",mobile:""},spacing:16,...extra.styles},...extra};
  }
  function imageElement(src,alt="Business image",extra={}){
    return {id:uid("el"),type:"image",src,alt,link:{type:"custom",value:""},styles:{fit:"cover",position:"50% 50%",height:380,radius:28,shadow:true,zoom:100,...extra.styles},...extra};
  }
  function buttonElement(text,kind="primary",extra={}){
    return {id:uid("el"),type:"button",text,variant:kind,link:{type:"g58-orders",value:"",useGlobal:true},styles:{align:"left",...extra.styles},...extra};
  }
  function section(type,layout,elements,extra={}){
    return {id:uid("sec"),type,layout,hidden:false,styles:{background:"",padding:{desktop:76,tablet:58,mobile:42},columns:layout==="split"?2:1,align:"left",...extra.styles},elements,...extra};
  }
  function page(name,sections,extra={}){
    return {id:uid("page"),name,slug:extra.slug??slugify(name),home:Boolean(extra.home),hidden:false,seo:{title:`${name}`,description:"Professional business website built with G58.",ogImage:"",index:true},sections,...extra};
  }

  function makeProject(templateId="salon-spa"){
    const spec=templates.find(item=>item.id===templateId)||templates[0];
    const primaryCta=spec.kind==="service"?"Book an Appointment":spec.kind==="menu"?"View Our Menu":"Shop the Collection";
    const itemType=spec.kind==="service"?"service-card":spec.kind==="menu"?"menu-item":"product-card";
    const hero=section("hero","split",[
      textElement("eyebrow",spec.category.toUpperCase(),{styles:{color:spec.accent}}),
      textElement("heading",spec.hero,{tag:"h1",styles:{fontSize:{desktop:"68",tablet:"52",mobile:"38"},spacing:18}}),
      textElement("text",spec.sub,{styles:{fontSize:{desktop:"19",tablet:"18",mobile:"16"},spacing:26}}),
      buttonElement(primaryCta,"primary",{link:{type:spec.kind==="service"?"g58-booking":spec.kind==="menu"?"g58-menu":"g58-orders",value:"",useGlobal:true}}),
      imageElement(spec.image,`${spec.name} featured image`,{styles:{height:520,radius:36,fit:"cover",position:"50% 50%",shadow:true,zoom:100}})
    ],{styles:{background:spec.bg,padding:{desktop:84,tablet:64,mobile:44},columns:2,align:"left"}});
    const cards=section(spec.kind==="service"?"services":spec.kind==="menu"?"menu":"products","cards",spec.items.map((name,index)=>({id:uid("el"),type:itemType,name,description:["Our most-loved choice, thoughtfully made for everyday life.","A customer favourite with quality in every detail.","Simple, dependable and designed around your needs."][index],price:["₹499","₹799","₹299"][index],image:[spec.image,stock[spec.id?.split("-")[0]]||spec.image,spec.image][index],badge:index===0?"Popular":"",available:true,link:{type:spec.kind==="service"?"g58-booking":spec.kind==="menu"?"g58-menu":"g58-orders",value:"",useGlobal:true},styles:{}})),{styles:{background:"#ffffff",padding:{desktop:76,tablet:58,mobile:42},columns:3,align:"left"}});
    const home=page("Home",[
      hero,
      section("features","cards",[
        textElement("stat","4.9 / 5",{label:"Customer rating"}),
        textElement("stat","7 days",{label:"Open every week"}),
        textElement("stat","100%",{label:"Made with care"})
      ],{styles:{background:spec.secondary,padding:{desktop:34,tablet:30,mobile:26},columns:3,align:"center"}}),
      section("about","split",[
        imageElement(spec.image,`About ${spec.name}`,{styles:{height:420,radius:28,fit:"cover",position:"50% 50%",shadow:false,zoom:100}}),
        textElement("eyebrow","OUR STORY",{styles:{color:spec.accent}}),
        textElement("heading",`Local care, made remarkable.`,{tag:"h2"}),
        textElement("text",`${spec.name} combines warm service, thoughtful details and a simple way for customers to connect. Replace this copy with your own story.`),
        buttonElement("Learn More","outline",{link:{type:"internal",value:"about",useGlobal:false}})
      ],{styles:{background:spec.bg,padding:{desktop:76,tablet:58,mobile:42},columns:2,align:"left"}}),
      cards,
      section("testimonials","cards",[
        {id:uid("el"),type:"testimonial",quote:"The experience felt effortless from start to finish.",name:"Priya R.",role:"Verified customer",styles:{}},
        {id:uid("el"),type:"testimonial",quote:"Beautiful quality and genuinely friendly service.",name:"Arjun K.",role:"Local customer",styles:{}}
      ],{styles:{background:spec.bg,padding:{desktop:76,tablet:58,mobile:42},columns:2,align:"left"}}),
      section("contact","split",[
        textElement("eyebrow","VISIT OR CONTACT",{styles:{color:spec.accent}}),
        textElement("heading","Let’s make something good happen.",{tag:"h2"}),
        textElement("text","Add your address, business hours and the best way for customers to reach you."),
        buttonElement("WhatsApp Us","primary",{link:{type:"whatsapp",value:"",useGlobal:true}}),
        {id:uid("el"),type:"business-hours",title:"Business Hours",lines:["Monday–Saturday · 9:00 AM–8:00 PM","Sunday · 10:00 AM–5:00 PM"],styles:{}}
      ],{styles:{background:spec.secondary,padding:{desktop:76,tablet:58,mobile:42},columns:2,align:"left"}})
    ],{home:true,slug:"index",seo:{title:`${spec.name} — ${spec.category.replace(" · "," ")}`,description:spec.sub,ogImage:spec.image,index:true}});
    const about=page("About",[
      section("hero","centered",[textElement("eyebrow","ABOUT US",{styles:{color:spec.accent}}),textElement("heading",`The story behind ${spec.name}.`,{tag:"h1"}),textElement("text","Edit this page to share your purpose, people and the values behind your business."),imageElement(spec.image,`${spec.name} story`,{styles:{height:480,radius:32,fit:"cover",position:"50% 50%",shadow:true,zoom:100}})],{styles:{background:spec.bg,padding:{desktop:84,tablet:64,mobile:44},columns:1,align:"center"}}),
      section("team","cards",["Founder","Studio Lead","Customer Care"].map((role,index)=>({id:uid("el"),type:"team-profile",name:["Your Name","Team Member","Team Member"][index],role,image:spec.image,styles:{}})),{styles:{background:"#fff",padding:{desktop:76,tablet:58,mobile:42},columns:3,align:"left"}})
    ]);
    const contact=page("Contact",[
      section("contact","split",[textElement("heading","We’d love to hear from you.",{tag:"h1"}),textElement("text","Call, message or visit. Replace these details in Website Settings."),{id:uid("el"),type:"contact-block",showPhone:true,showEmail:true,showAddress:true,styles:{}},{id:uid("el"),type:"map",label:"Open in Google Maps",link:{type:"maps",value:"",useGlobal:true},styles:{}}],{styles:{background:spec.bg,padding:{desktop:84,tablet:64,mobile:44},columns:2,align:"left"}})
    ]);
    return {id:uid("project"),name:spec.name,template:spec.id,createdAt:new Date().toISOString(),updatedAt:new Date().toISOString(),website:{name:spec.name,pages:[home,about,contact],globalStyles:{primary:spec.accent,secondary:spec.secondary,accent:"#ffb020",background:spec.bg,text:spec.text,muted:spec.muted,headingFont:"Manrope",bodyFont:"Inter",buttonFont:"Inter",buttonRadius:999,cardRadius:26,cardBorder:"rgba(15,23,42,.10)",cardShadow:"0 20px 50px rgba(15,23,42,.10)"},integrations:{orders:"",booking:"",menu:"",refill:""},settings:{businessName:spec.name,logo:"",favicon:"",phone:"+91 90000 00000",email:"hello@example.com",address:"Your business address",whatsapp:"919000000000",instagram:"",facebook:"",youtube:"",maps:"",stickyHeader:true,transparentHeader:false,navCtaText:primaryCta,navCtaLink:spec.kind==="service"?"g58-booking":spec.kind==="menu"?"g58-menu":"g58-orders"},assets:[],products:spec.kind==="product"?clone(cards.elements):[],services:spec.kind==="service"?clone(cards.elements):[],menu:spec.kind==="menu"?clone(cards.elements):[]}};
  }

  function elementTitle(element){
    return element.name||element.text||element.title||({image:"Image",testimonial:"Testimonial","business-hours":"Business hours","contact-block":"Contact details",map:"Map","team-profile":"Team member",stat:"Statistic"}[element.type]||element.type);
  }
  function resolveLink(link,project){
    const l=link||{}; const settings=project.website.settings||{}; const integrations=project.website.integrations||{};
    const raw=l.useGlobal?({"g58-orders":integrations.orders,"g58-booking":integrations.booking,"g58-menu":integrations.menu,"g58-refill":integrations.refill,whatsapp:settings.whatsapp,instagram:settings.instagram,facebook:settings.facebook,youtube:settings.youtube,maps:settings.maps,phone:settings.phone,email:settings.email}[l.type]||l.value):l.value;
    if(!raw)return "#";
    if(l.type==="phone")return `tel:${String(raw).replace(/[^+\d]/g,"")}`;
    if(l.type==="email")return `mailto:${raw}`;
    if(l.type==="whatsapp")return /^https?:/.test(raw)?raw:`https://wa.me/${String(raw).replace(/\D/g,"")}`;
    if(l.type==="instagram"&&!/^https?:/.test(raw))return `https://instagram.com/${String(raw).replace(/^@/,"")}`;
    if(l.type==="internal")return raw==="index"||raw==="home"?"index.html":`${slugify(raw)}.html`;
    return raw;
  }

  function elementMarkup(element,project,editor=false){
    const styles=element.styles||{};
    const responsive=`${styles.fontSize?.desktop?`--fs-desktop:${Number(styles.fontSize.desktop)}px;`:""}${styles.fontSize?.tablet?`--fs-tablet:${Number(styles.fontSize.tablet)}px;`:""}${styles.fontSize?.mobile?`--fs-mobile:${Number(styles.fontSize.mobile)}px;`:""}`;
    const style=`text-align:${styles.align||"left"};${styles.color?`color:${styles.color};`:""}${styles.spacing!=null?`margin-bottom:${Number(styles.spacing)}px;`:""}${responsive}`;
    const select=editor?` data-element-id="${element.id}" tabindex="0"`:"";
    const editable=editor&&["heading","text","eyebrow","button"].includes(element.type)?` contenteditable="true" data-edit-text="${element.id}"`:"";
    if(["heading","text","eyebrow"].includes(element.type)){
      const tag=element.type==="heading"?(element.tag||"h2"):element.type==="eyebrow"?"span":"p";
      return `<${tag} class="wb-el wb-${element.type} ${styles.animation?`wb-animate-${styles.animation}`:""}"${select}${editable} style="${style}">${escapeHtml(element.text)}</${tag}>`;
    }
    if(element.type==="button")return `<div class="wb-el wb-button-wrap"${select} style="${style}"><a class="wb-button ${escapeHtml(element.variant||"primary")}" href="${escapeHtml(resolveLink(element.link,project))}"${editable}>${escapeHtml(element.text)}</a></div>`;
    if(element.type==="image"){
      const imageStyle=`height:${Number(styles.height||360)}px;object-fit:${styles.fit||"cover"};object-position:${styles.position||"50% 50%"};border-radius:${Number(styles.radius??24)}px;${styles.shadow?"box-shadow:var(--card-shadow);":""}transform:scale(${Number(styles.zoom||100)/100})`;
      return `<figure class="wb-el wb-image"${select}><img src="${escapeHtml(element.src)}" alt="${escapeHtml(element.alt||"")}" style="${imageStyle}"></figure>`;
    }
    if(["product-card","service-card","menu-item"].includes(element.type))return `<article class="wb-el wb-item-card"${select}><img src="${escapeHtml(element.image||"")}" alt="${escapeHtml(element.name||"")}"><div class="wb-item-copy">${element.badge?`<span class="wb-badge">${escapeHtml(element.badge)}</span>`:""}<h3>${escapeHtml(element.name)}</h3><p>${escapeHtml(element.description||"")}</p><div class="wb-price-row"><strong>${escapeHtml(element.price||"")}</strong>${element.available===false?'<span class="sold-out">Unavailable</span>':`<a href="${escapeHtml(resolveLink(element.link,project))}">Choose <span>→</span></a>`}</div></div></article>`;
    if(element.type==="testimonial")return `<blockquote class="wb-el wb-quote"${select}><p>“${escapeHtml(element.quote)}”</p><footer><strong>${escapeHtml(element.name)}</strong><span>${escapeHtml(element.role||"")}</span></footer></blockquote>`;
    if(element.type==="team-profile")return `<article class="wb-el wb-team"${select}><img src="${escapeHtml(element.image||"")}" alt="${escapeHtml(element.name)}"><h3>${escapeHtml(element.name)}</h3><p>${escapeHtml(element.role)}</p></article>`;
    if(element.type==="stat")return `<div class="wb-el wb-stat"${select}><strong>${escapeHtml(element.text)}</strong><span>${escapeHtml(element.label||"")}</span></div>`;
    if(element.type==="business-hours")return `<div class="wb-el wb-hours"${select}><h3>${escapeHtml(element.title||"Business Hours")}</h3>${(element.lines||[]).map(line=>`<p>${escapeHtml(line)}</p>`).join("")}</div>`;
    if(element.type==="contact-block")return `<div class="wb-el wb-contact"${select}>${element.showPhone!==false?`<a href="tel:${escapeHtml(project.website.settings.phone)}">${escapeHtml(project.website.settings.phone)}</a>`:""}${element.showEmail!==false?`<a href="mailto:${escapeHtml(project.website.settings.email)}">${escapeHtml(project.website.settings.email)}</a>`:""}${element.showAddress!==false?`<address>${escapeHtml(project.website.settings.address)}</address>`:""}</div>`;
    if(element.type==="map")return `<a class="wb-el wb-map"${select} href="${escapeHtml(resolveLink(element.link,project))}"><span>⌖</span><strong>${escapeHtml(element.label||"Open Map")}</strong></a>`;
    if(element.type==="divider")return `<hr class="wb-el wb-divider"${select}>`;
    if(element.type==="spacer")return `<div class="wb-el wb-spacer"${select} style="height:${Number(styles.height||40)}px"></div>`;
    if(element.type==="video")return `<div class="wb-el wb-video"${select}><iframe src="${escapeHtml(element.src||"about:blank")}" title="${escapeHtml(element.title||"Video")}" loading="lazy" allowfullscreen></iframe></div>`;
    if(element.type==="faq")return `<details class="wb-el wb-faq"${select}><summary>${escapeHtml(element.question||"Question")}</summary><p>${escapeHtml(element.answer||"Answer")}</p></details>`;
    if(element.type==="social-links")return `<div class="wb-el wb-social"${select}><a href="${escapeHtml(resolveLink({type:"instagram",value:"",useGlobal:true},project))}">Instagram</a><a href="${escapeHtml(resolveLink({type:"facebook",value:"",useGlobal:true},project))}">Facebook</a></div>`;
    if(element.type==="icon")return `<div class="wb-el wb-icon"${select}><span>${escapeHtml(element.icon||"✦")}</span><strong>${escapeHtml(element.label||"Feature")}</strong></div>`;
    if(element.type==="gallery")return `<div class="wb-el wb-gallery"${select}>${(element.images||[]).map((src,index)=>`<img src="${escapeHtml(src)}" alt="${escapeHtml(element.alt||`Gallery image ${index+1}`)}">`).join("")}</div>`;
    if(element.type==="price-card"||element.type==="offer")return `<article class="wb-el wb-offer-card"${select}>${element.badge?`<span class="wb-badge">${escapeHtml(element.badge)}</span>`:""}<h3>${escapeHtml(element.name||"Plan")}</h3><strong class="wb-offer-price">${escapeHtml(element.price||"₹999")}</strong><p>${escapeHtml(element.description||"")}</p><a class="wb-button" href="${escapeHtml(resolveLink(element.link,project))}">${escapeHtml(element.cta||"Choose Plan")}</a></article>`;
    return `<div class="wb-el wb-generic"${select}><strong>${escapeHtml(elementTitle(element))}</strong></div>`;
  }

  function sectionMarkup(section,project,editor=false){
    if(section.hidden&&!editor)return "";
    const s=section.styles||{};
    const bg=s.background||"transparent";
    const pad=s.padding||{desktop:70,tablet:52,mobile:40};
    const attrs=editor?` data-section-id="${section.id}" draggable="true" tabindex="0"`:"";
    const controls=editor?`<div class="wb-section-controls"><button type="button" data-move-section="up" title="Move up">↑</button><button type="button" data-move-section="down" title="Move down">↓</button><button type="button" data-duplicate-section title="Duplicate">⧉</button><button type="button" data-toggle-section title="${section.hidden?"Show":"Hide"}">${section.hidden?"◉":"◌"}</button><button type="button" data-delete-section title="Delete">×</button></div>`:"";
    const style=`--section-bg:${bg};--pad-desktop:${Number(pad.desktop||70)}px;--pad-tablet:${Number(pad.tablet||52)}px;--pad-mobile:${Number(pad.mobile||40)}px;--columns:${Number(s.columns||1)};min-height:${Number(s.minHeight||0)}px;text-align:${s.align||"left"}`;
    return `<section class="wb-section wb-layout-${escapeHtml(section.layout||"stack")} ${section.hidden?"is-hidden":""}"${attrs} style="${style}">${controls}<div class="wb-section-inner">${section.elements.map(el=>elementMarkup(el,project,editor)).join("")}</div></section>`;
  }

  function navMarkup(project,page,editor=false){
    const settings=project.website.settings||{};
    const pages=project.website.pages.filter(row=>!row.hidden);
    return `<header class="wb-nav ${settings.stickyHeader?"sticky":""} ${settings.transparentHeader?"transparent":""}"${editor?' data-editor-region="navigation" tabindex="0"':""}><a class="wb-brand" href="index.html">${settings.logo?`<img src="${escapeHtml(settings.logo)}" alt="${escapeHtml(settings.businessName)} logo">`:`<span>${escapeHtml((settings.businessName||"G").slice(0,1))}</span>`}<strong>${escapeHtml(settings.businessName||project.name)}</strong></a><nav>${pages.map(row=>`<a class="${row.id===page.id?"active":""}" href="${row.home?"index.html":`${escapeHtml(row.slug)}.html`}">${escapeHtml(row.name)}</a>`).join("")}</nav><a class="wb-nav-cta" href="${escapeHtml(resolveLink({type:settings.navCtaLink,value:"",useGlobal:true},project))}">${escapeHtml(settings.navCtaText||"Contact")}</a><button class="wb-mobile-menu" type="button" aria-label="Open menu">☰</button></header>`;
  }
  function floatingMarkup(project,editor=false){
    const s=project.website.settings; const integrations=project.website.integrations;
    const whatsappIcon=`<svg viewBox="0 0 32 32" aria-hidden="true"><path fill="currentColor" d="M16.04 3A12.7 12.7 0 0 0 5.1 22.12L3.3 29l7.04-1.84A12.74 12.74 0 1 0 16.04 3Zm0 22.86c-1.92 0-3.8-.52-5.43-1.5l-.39-.23-4.18 1.1 1.12-4.07-.25-.42a10.1 10.1 0 1 1 9.13 5.12Zm5.55-7.58c-.3-.15-1.8-.89-2.08-.99-.28-.1-.48-.15-.69.15-.2.3-.78.99-.96 1.2-.18.2-.35.23-.66.08-.3-.15-1.28-.47-2.44-1.5a9.17 9.17 0 0 1-1.69-2.1c-.18-.3-.02-.47.13-.62.14-.14.3-.35.46-.53.15-.18.2-.3.3-.5.1-.2.05-.38-.03-.53-.07-.15-.68-1.64-.94-2.25-.25-.6-.5-.52-.68-.53h-.59c-.2 0-.53.08-.81.38-.28.3-1.06 1.04-1.06 2.53 0 1.5 1.09 2.94 1.24 3.14.15.2 2.14 3.27 5.19 4.58.72.31 1.29.5 1.73.64.73.23 1.39.2 1.91.12.58-.09 1.8-.74 2.05-1.45.25-.71.25-1.32.18-1.45-.08-.13-.28-.2-.58-.36Z"/></svg>`;
    const instagramIcon=`<svg viewBox="0 0 32 32" aria-hidden="true"><rect x="5" y="5" width="22" height="22" rx="6" fill="none" stroke="currentColor" stroke-width="2.8"/><circle cx="16" cy="16" r="5.2" fill="none" stroke="currentColor" stroke-width="2.8"/><circle cx="23.1" cy="8.9" r="1.7" fill="currentColor"/></svg>`;
    return `<div class="wb-floating"${editor?' data-editor-region="floating" tabindex="0"':""}><a class="wa" href="${escapeHtml(resolveLink({type:"whatsapp",value:"",useGlobal:true},project))}" aria-label="WhatsApp">${whatsappIcon}</a><a class="ig" href="${escapeHtml(resolveLink({type:"instagram",value:"",useGlobal:true},project))}" aria-label="Instagram">${instagramIcon}</a></div>`;
  }
  function renderCanvas(project,pageId,editor=true){
    const page=project.website.pages.find(row=>row.id===pageId)||project.website.pages.find(row=>row.home)||project.website.pages[0];
    return `<div class="wb-site" data-page-id="${page.id}">${navMarkup(project,page,editor)}<main>${page.sections.map(row=>sectionMarkup(row,project,editor)).join("")}</main><footer class="wb-footer"${editor?' data-editor-region="footer" tabindex="0"':""}><strong>${escapeHtml(project.website.settings.businessName)}</strong><p>${escapeHtml(project.website.settings.address)}</p><small>© ${new Date().getFullYear()} ${escapeHtml(project.website.settings.businessName)}. All rights reserved.</small></footer>${floatingMarkup(project,editor)}</div>`;
  }

  function themeCss(project){
    const g=project.website.globalStyles;
    return `:root{--primary:${g.primary};--secondary:${g.secondary};--accent:${g.accent};--page-bg:${g.background};--text:${g.text};--muted:${g.muted};--heading-font:${JSON.stringify(g.headingFont||"Manrope")},sans-serif;--body-font:${JSON.stringify(g.bodyFont||"Inter")},sans-serif;--button-font:${JSON.stringify(g.buttonFont||"Inter")},sans-serif;--button-radius:${Number(g.buttonRadius||999)}px;--card-radius:${Number(g.cardRadius||26)}px;--card-border:${g.cardBorder};--card-shadow:${g.cardShadow}}`;
  }
  const baseCss=`*{box-sizing:border-box}html{scroll-behavior:smooth}body{margin:0;background:var(--page-bg);color:var(--text);font-family:var(--body-font);line-height:1.6}a{color:inherit}.wb-site{min-height:100vh;overflow:clip}.wb-nav{z-index:30;display:flex;align-items:center;gap:26px;min-height:76px;padding:14px max(5vw,24px);background:color-mix(in srgb,var(--page-bg) 94%,transparent);border-bottom:1px solid color-mix(in srgb,var(--text) 10%,transparent);backdrop-filter:blur(14px)}.wb-nav.sticky{position:sticky;top:0}.wb-nav.transparent{background:transparent;position:absolute;left:0;right:0;border:0}.wb-brand{display:flex;align-items:center;gap:10px;text-decoration:none;margin-right:auto}.wb-brand>span{display:grid;place-items:center;width:38px;height:38px;border-radius:12px;color:#fff;background:var(--primary);font:800 18px var(--heading-font)}.wb-brand img{width:42px;height:42px;object-fit:contain}.wb-brand strong{font:800 17px var(--heading-font)}.wb-nav nav{display:flex;align-items:center;gap:22px}.wb-nav nav a{text-decoration:none;font-size:14px;font-weight:700;color:var(--muted)}.wb-nav nav a:hover,.wb-nav nav a.active{color:var(--text)}.wb-nav-cta,.wb-button{display:inline-flex;align-items:center;justify-content:center;text-decoration:none;padding:12px 20px;border-radius:var(--button-radius);background:var(--primary);color:#fff;font:800 13px var(--button-font);border:1px solid var(--primary)}.wb-button.outline{background:transparent;color:var(--primary)}.wb-button.secondary{background:var(--secondary);border-color:var(--secondary)}.wb-mobile-menu{display:none;border:0;background:transparent;font-size:24px}.wb-section{position:relative;background:var(--section-bg);padding:var(--pad-desktop) max(5vw,24px)}.wb-section-inner{width:min(1180px,100%);margin:auto;display:grid;grid-template-columns:repeat(var(--columns),minmax(0,1fr));align-items:center;gap:clamp(24px,4vw,64px)}.wb-layout-centered .wb-section-inner,.wb-layout-stack .wb-section-inner{display:flex;flex-direction:column;align-items:center;max-width:900px;text-align:center}.wb-layout-cards .wb-section-inner{align-items:stretch}.wb-eyebrow{display:block;color:var(--primary);font-size:var(--fs-desktop,12px);font-weight:800;letter-spacing:.18em;text-transform:uppercase}.wb-heading{font-family:var(--heading-font);font-size:var(--fs-desktop,clamp(34px,5vw,68px));line-height:1.04;letter-spacing:-.045em;margin-top:0}.wb-text{font-size:var(--fs-desktop,18px);color:var(--muted);max-width:680px}.wb-image{margin:0;overflow:hidden;border-radius:28px}.wb-image img{width:100%;display:block}.wb-item-card,.wb-quote,.wb-team,.wb-hours,.wb-contact,.wb-map{background:#fff;border:1px solid var(--card-border);border-radius:var(--card-radius);box-shadow:var(--card-shadow);overflow:hidden}.wb-item-card img,.wb-team img{width:100%;height:220px;object-fit:cover}.wb-item-copy,.wb-quote,.wb-team,.wb-hours,.wb-contact{padding:24px}.wb-item-card h3,.wb-team h3,.wb-hours h3{font-family:var(--heading-font);margin:8px 0}.wb-item-card p,.wb-team p,.wb-hours p{color:var(--muted)}.wb-badge{font-size:10px;font-weight:800;color:var(--primary);letter-spacing:.12em;text-transform:uppercase}.wb-price-row{display:flex;align-items:center;gap:14px}.wb-price-row strong{font:800 19px var(--heading-font)}.wb-price-row a{margin-left:auto;text-decoration:none;color:var(--primary);font-weight:800}.sold-out{color:#b42318;font-weight:700}.wb-quote p{font:700 23px/1.45 var(--heading-font);margin:0 0 20px}.wb-quote footer{display:flex;flex-direction:column}.wb-quote footer span{color:var(--muted)}.wb-team{text-align:center}.wb-stat{color:#fff;text-align:center}.wb-stat strong{display:block;font:800 clamp(28px,4vw,48px) var(--heading-font)}.wb-stat span{color:rgba(255,255,255,.72)}.wb-contact{display:flex;flex-direction:column;gap:8px}.wb-contact address{font-style:normal;color:var(--muted)}.wb-map{display:grid;place-items:center;min-height:250px;text-decoration:none;background:linear-gradient(135deg,color-mix(in srgb,var(--primary) 15%,#fff),#fff)}.wb-map span{font-size:56px;color:var(--primary)}.wb-video iframe{width:100%;aspect-ratio:16/9;border:0;border-radius:var(--card-radius)}.wb-faq{width:100%;padding:18px;border-bottom:1px solid var(--card-border)}.wb-faq summary{font-weight:800;cursor:pointer}.wb-social{display:flex;gap:12px}.wb-divider{width:100%;border:0;border-top:1px solid var(--card-border)}.wb-footer{padding:42px max(5vw,24px);background:var(--secondary);color:#fff;text-align:center}.wb-footer p,.wb-footer small{color:rgba(255,255,255,.7)}.wb-floating{position:fixed;right:18px;bottom:18px;z-index:40;display:flex;flex-direction:column;gap:9px}.wb-floating a{display:grid;place-items:center;width:48px;height:48px;border-radius:50%;text-decoration:none;color:#fff;font-size:10px;font-weight:900;box-shadow:0 10px 30px rgba(0,0,0,.18)}.wb-floating .wa{background:#20b85a}.wb-floating .ig{background:linear-gradient(135deg,#7c3aed,#ef296f,#ff8b2d)}.wb-floating .g58{background:#07111f;color:#ff7419}.wb-floating svg{width:27px;height:27px}.wb-animate-fade{animation:wbFade .8s ease both}.wb-animate-rise{animation:wbRise .8s ease both}.wb-animate-scale{animation:wbScale .7s ease both}@keyframes wbFade{from{opacity:0}to{opacity:1}}@keyframes wbRise{from{opacity:0;transform:translateY(24px)}to{opacity:1;transform:none}}@keyframes wbScale{from{opacity:0;transform:scale(.94)}to{opacity:1;transform:none}}@media(max-width:900px){.wb-nav nav,.wb-nav-cta{display:none}.wb-mobile-menu{display:block}.wb-section{padding:var(--pad-tablet) 28px}.wb-section-inner{grid-template-columns:repeat(min(var(--columns),2),minmax(0,1fr))}.wb-layout-split .wb-section-inner{grid-template-columns:1fr}.wb-heading,.wb-text,.wb-eyebrow{font-size:var(--fs-tablet,var(--fs-desktop,revert))}}@media(max-width:600px){.wb-section{padding:var(--pad-mobile) 18px}.wb-section-inner{grid-template-columns:1fr}.wb-heading,.wb-text,.wb-eyebrow{font-size:var(--fs-mobile,var(--fs-tablet,var(--fs-desktop,revert)))}.wb-item-card img,.wb-team img{height:190px}.wb-floating{right:12px;bottom:12px}.wb-floating a{width:43px;height:43px}}@media(prefers-reduced-motion:reduce){.wb-animate-fade,.wb-animate-rise,.wb-animate-scale{animation:none}}`;
  const publicCss=baseCss+`.wb-icon{display:flex;align-items:center;gap:12px;padding:18px;border:1px solid var(--card-border);border-radius:var(--card-radius);background:#fff}.wb-icon span{display:grid;place-items:center;width:44px;height:44px;border-radius:14px;background:color-mix(in srgb,var(--primary) 12%,#fff);color:var(--primary);font-size:24px}.wb-gallery{display:grid;grid-template-columns:repeat(3,1fr);gap:12px}.wb-gallery img{width:100%;height:220px;object-fit:cover;border-radius:var(--card-radius)}.wb-offer-card{padding:28px;border:1px solid var(--card-border);border-radius:var(--card-radius);background:#fff;box-shadow:var(--card-shadow)}.wb-offer-card h3{font:800 24px var(--heading-font);margin:8px 0}.wb-offer-card p{color:var(--muted)}.wb-offer-price{display:block;margin:10px 0;font:800 36px var(--heading-font);color:var(--primary)}@media(max-width:600px){.wb-gallery{grid-template-columns:1fr}.wb-gallery img{height:190px}}`;

  function exportHtml(project,page){
    const title=page.seo?.title||`${page.name} — ${project.website.settings.businessName}`;
    const description=page.seo?.description||"Professional business website.";
    const favicon=project.website.settings.favicon||"assets/images/favicon.ico";
    return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(title)}</title><meta name="description" content="${escapeHtml(description)}"><meta name="robots" content="${page.seo?.index===false?"noindex,nofollow":"index,follow"}"><link rel="icon" href="${escapeHtml(favicon)}"><link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin><link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=Manrope:wght@600;700;800&display=swap" rel="stylesheet"><link rel="stylesheet" href="assets/css/style.css"></head><body>${renderCanvas(project,page.id,false)}<script src="assets/js/site.js"><\/script></body></html>`;
  }

  function dataUrlBytes(value){
    const parts=value.split(","); const meta=parts[0]; const body=parts[1]||"";
    const raw=meta.includes(";base64")?atob(body):decodeURIComponent(body);
    const bytes=new Uint8Array(raw.length); for(let i=0;i<raw.length;i++)bytes[i]=raw.charCodeAt(i); return bytes;
  }
  async function downloadableProject(project){
    const copy=clone(project); const files={}; let count=0;
    for(const page of copy.website.pages)for(const sec of page.sections)for(const el of sec.elements){
      for(const key of ["src","image"]){const src=el[key]; if(!src||(!src.startsWith("data:")&&!/^https?:\/\//.test(src)))continue;
        try{const response=src.startsWith("data:")?null:await fetch(src,{mode:"cors"}); const bytes=src.startsWith("data:")?dataUrlBytes(src):new Uint8Array(await response.arrayBuffer()); const contentType=src.startsWith("data:")?(src.match(/^data:([^;,]+)/)||[])[1]||"image/jpeg":response.headers.get("content-type")||"image/jpeg"; const ext=contentType.includes("png")?"png":contentType.includes("webp")?"webp":"jpg"; const path=`assets/images/image-${++count}.${ext}`; files[path]=bytes; el[key]=path;}catch(_error){}
      }
    }
    return {project:copy,files};
  }
  const encoder=new TextEncoder();
  let crcTable;
  function crc32(bytes){if(!crcTable){crcTable=Array.from({length:256},(_,n)=>{let c=n;for(let k=0;k<8;k++)c=(c&1)?0xedb88320^(c>>>1):c>>>1;return c>>>0;});}let crc=0xffffffff;for(const byte of bytes)crc=crcTable[(crc^byte)&255]^(crc>>>8);return (crc^0xffffffff)>>>0;}
  function zipBytes(fileMap){
    const local=[]; const central=[]; let offset=0; const now=new Date(); const dosTime=(now.getHours()<<11)|(now.getMinutes()<<5)|(now.getSeconds()>>1); const dosDate=((now.getFullYear()-1980)<<9)|((now.getMonth()+1)<<5)|now.getDate();
    const u16=n=>[n&255,(n>>>8)&255],u32=n=>[n&255,(n>>>8)&255,(n>>>16)&255,(n>>>24)&255];
    Object.entries(fileMap).forEach(([name,value])=>{const nameBytes=encoder.encode(name);const data=value instanceof Uint8Array?value:encoder.encode(String(value));const crc=crc32(data);const header=new Uint8Array([...u32(0x04034b50),...u16(20),...u16(0),...u16(0),...u16(dosTime),...u16(dosDate),...u32(crc),...u32(data.length),...u32(data.length),...u16(nameBytes.length),...u16(0),...nameBytes]);local.push(header,data);const ch=new Uint8Array([...u32(0x02014b50),...u16(20),...u16(20),...u16(0),...u16(0),...u16(dosTime),...u16(dosDate),...u32(crc),...u32(data.length),...u32(data.length),...u16(nameBytes.length),...u16(0),...u16(0),...u16(0),...u16(0),...u32(0),...u32(offset),...nameBytes]);central.push(ch);offset+=header.length+data.length;});
    const centralSize=central.reduce((sum,row)=>sum+row.length,0); const entries=Object.keys(fileMap).length; const end=new Uint8Array([...u32(0x06054b50),...u16(0),...u16(0),...u16(entries),...u16(entries),...u32(centralSize),...u32(offset),...u16(0)]); return new Blob([...local,...central,end],{type:"application/zip"});
  }
  function downloadBlob(blob,name){const a=document.createElement("a");a.href=URL.createObjectURL(blob);a.download=name;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(a.href),1500);}
  async function downloadWebsite(project){
    const prepared=await downloadableProject(project); const p=prepared.project; const files={...prepared.files};
    p.website.pages.forEach(page=>{files[page.home?"index.html":`${page.slug}.html`]=exportHtml(p,page);});
    files["assets/css/style.css"]=`${themeCss(p)}\n${publicCss}`;
    files["assets/js/site.js"]=`document.querySelectorAll('.wb-mobile-menu').forEach(button=>button.addEventListener('click',()=>{const nav=button.previousElementSibling?.previousElementSibling;nav?.classList.toggle('open')}));`;
    try{const favicon=await fetch("/assets/favicon-32.png?v=5");files["assets/images/favicon.ico"]=new Uint8Array(await favicon.arrayBuffer());}catch(_error){files["assets/images/favicon.ico"]="";}
    const base="https://example.com/"; files["sitemap.xml"]=`<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${p.website.pages.filter(row=>row.seo?.index!==false).map(row=>`<url><loc>${base}${row.home?"":`${row.slug}.html`}</loc></url>`).join("")}</urlset>`;
    files["robots.txt"]="User-agent: *\nAllow: /\nSitemap: https://example.com/sitemap.xml\n";
    files["README.md"]=`# ${p.website.settings.businessName}\n\nOpen index.html to view the website locally. Upload the complete folder to Netlify, GitHub Pages, Cloudflare Pages, shared hosting or a VPS.\n\nBefore publishing, replace example.com in sitemap.xml and robots.txt with your final domain.\n`;
    downloadBlob(zipBytes(files),`${slugify(p.name)}-website.zip`);
  }

  const DB_NAME="g58WebsiteBuilder",STORE="projects";
  function db(){return new Promise((resolve,reject)=>{const request=indexedDB.open(DB_NAME,1);request.onupgradeneeded=()=>request.result.createObjectStore(STORE,{keyPath:"id"});request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error);});}
  async function saveProject(project){project.updatedAt=new Date().toISOString();const database=await db();return new Promise((resolve,reject)=>{const tx=database.transaction(STORE,"readwrite");tx.objectStore(STORE).put(clone(project));tx.oncomplete=()=>resolve(project);tx.onerror=()=>reject(tx.error);});}
  async function getProject(id){const database=await db();return new Promise((resolve,reject)=>{const request=database.transaction(STORE).objectStore(STORE).get(id);request.onsuccess=()=>resolve(request.result||null);request.onerror=()=>reject(request.error);});}
  async function listProjects(){const database=await db();return new Promise((resolve,reject)=>{const request=database.transaction(STORE).objectStore(STORE).getAll();request.onsuccess=()=>resolve((request.result||[]).sort((a,b)=>new Date(b.updatedAt)-new Date(a.updatedAt)));request.onerror=()=>reject(request.error);});}
  async function deleteProject(id){const database=await db();return new Promise((resolve,reject)=>{const tx=database.transaction(STORE,"readwrite");tx.objectStore(STORE).delete(id);tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error);});}
  function exportProject(project){downloadBlob(new Blob([JSON.stringify(project,null,2)],{type:"application/json"}),`${slugify(project.name)}.g58project.json`);}

  window.G58Builder={templates,makeProject,clone,uid,slugify,escapeHtml,textElement,imageElement,buttonElement,section,page,renderCanvas,elementMarkup,sectionMarkup,resolveLink,themeCss,publicCss,exportHtml,downloadWebsite,downloadBlob,saveProject,getProject,listProjects,deleteProject,exportProject,elementTitle};
})();
