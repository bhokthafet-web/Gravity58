(() => {
  "use strict";
  // The WhatsApp number customers chat with, in international format without "+" or spaces.
  // If this is ever empty or malformed the icon simply stays hidden.
  const WHATSAPP_NUMBER = "919391523275";
  const GREETING = "Hi Gravity58, I would like to know more about your business tools.";

  if (window.G58WhatsApp || !/^\d{11,15}$/.test(WHATSAPP_NUMBER)) return;
  window.G58WhatsAppNumber = WHATSAPP_NUMBER; // shared with other sales widgets (e.g. the flyer section)

  const STYLE_ID = "g58WhatsAppStyles";

  function mount() {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement("style");
    style.id = STYLE_ID;
    style.textContent = `
      .g58-wa-float{position:fixed;left:max(16px,env(safe-area-inset-left));bottom:max(16px,env(safe-area-inset-bottom));z-index:9000;width:60px;height:60px;border-radius:50%;display:grid;place-items:center;background:#fff;color:#F97316;border:2px solid #FDBA74;box-shadow:0 10px 26px rgba(249,115,22,.30),0 2px 6px rgba(0,0,0,.16);text-decoration:none;transition:transform .18s ease,box-shadow .18s ease}
      .g58-wa-float:hover{transform:translateY(-2px) scale(1.05)}
      .g58-wa-float:focus-visible{outline:3px solid #1D4ED8;outline-offset:3px}
      .g58-wa-float svg{width:34px;height:34px}
      .g58-wa-float::after{content:"";position:absolute;inset:0;border-radius:50%;border:2px solid #F97316;animation:g58WaPulse 2.4s ease-out infinite;pointer-events:none}
      @keyframes g58WaPulse{0%{transform:scale(1);opacity:.55}100%{transform:scale(1.55);opacity:0}}
      @media(prefers-reduced-motion:reduce){.g58-wa-float::after{display:none}.g58-wa-float{transition:none}}
      @media print{.g58-wa-float{display:none}}
    `;
    document.head.appendChild(style);

    const link = document.createElement("a");
    link.className = "g58-wa-float";
    link.href = `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(GREETING)}`;
    link.target = "_blank";
    link.rel = "noopener";
    link.setAttribute("aria-label", "Chat with Gravity58 on WhatsApp");
    link.title = "Chat on WhatsApp";
    // The G58 three-ring logo; clicking it opens the flyer popup with the WhatsApp button.
    link.innerHTML = '<svg viewBox="0 0 120 120" fill="none" stroke="currentColor" stroke-width="9" aria-hidden="true" focusable="false"><circle cx="60" cy="28" r="16"/><circle cx="28" cy="84" r="16"/><circle cx="92" cy="84" r="16"/></svg>';
    document.body.appendChild(link);

    // Clicking the icon opens the flyer popup (loaded on demand). If anything goes wrong, or the
    // visitor opens the link in a new tab, it simply opens the WhatsApp chat as before.
    let loading = false;
    link.addEventListener("click", (event) => {
      if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      event.preventDefault();
      if (window.G58FlyerPopup) { if (!window.G58FlyerPopup.open(link)) window.open(link.href, "_blank", "noopener"); return; }
      if (loading) return;
      loading = true;
      const fallback = () => { loading = false; window.open(link.href, "_blank", "noopener"); };
      const sheet = document.createElement("link");
      sheet.rel = "stylesheet";
      sheet.href = "/css/flyer-share.css?v=3";
      document.head.appendChild(sheet);
      const script = document.createElement("script");
      script.src = "/js/flyer-share.js?v=2";
      script.onload = () => { loading = false; if (!window.G58FlyerPopup?.open(link)) fallback(); };
      script.onerror = fallback;
      document.head.appendChild(script);
    });
  }

  window.G58WhatsApp = true;
  if (document.body) mount();
  else document.addEventListener("DOMContentLoaded", mount, { once: true });
})();
