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
      .g58-wa-float{position:fixed;left:max(16px,env(safe-area-inset-left));bottom:max(16px,env(safe-area-inset-bottom));z-index:9000;width:60px;height:60px;border-radius:50%;display:grid;place-items:center;background:#fff;color:#F97316;border:2px solid #FDBA74;box-shadow:0 10px 26px rgba(249,115,22,.30),0 2px 6px rgba(0,0,0,.16);text-decoration:none;transition:transform .18s ease,box-shadow .18s ease;animation:g58WaBody 9s ease-in-out infinite}
      .g58-wa-float:hover{transform:translateY(-2px) scale(1.05)}
      .g58-wa-float:focus-visible{outline:3px solid #1D4ED8;outline-offset:3px}
      .g58-wa-face{grid-area:1/1;display:block;width:34px;height:34px;transform-origin:50% 50%}
      .g58-wa-face-logo{animation:g58WaLogo 9s ease-in-out infinite}
      .g58-wa-face-chat{width:30px;height:30px;opacity:0;animation:g58WaChat 9s ease-in-out infinite}
      .g58-wa-float::after{content:"";position:absolute;inset:0;border-radius:50%;border:2px solid #F97316;animation:g58WaPulse 2.4s ease-out infinite,g58WaRing 9s ease-in-out infinite;pointer-events:none}
      @keyframes g58WaPulse{0%{transform:scale(1);opacity:.55}100%{transform:scale(1.55);opacity:0}}
      /* 9s loop: logo for ~3.5s, spins into the WhatsApp button for ~3.5s, spins back to the logo */
      @keyframes g58WaBody{0%,36%{background:#fff;border-color:#FDBA74;color:#F97316;box-shadow:0 10px 26px rgba(249,115,22,.30),0 2px 6px rgba(0,0,0,.16)}44%,84%{background:#25D366;border-color:#25D366;color:#fff;box-shadow:0 10px 26px rgba(18,140,70,.38),0 2px 6px rgba(0,0,0,.18)}92%,100%{background:#fff;border-color:#FDBA74;color:#F97316;box-shadow:0 10px 26px rgba(249,115,22,.30),0 2px 6px rgba(0,0,0,.16)}}
      @keyframes g58WaRing{0%,36%{border-color:#F97316}44%,84%{border-color:#25D366}92%,100%{border-color:#F97316}}
      @keyframes g58WaLogo{0%,36%{opacity:1;transform:rotate(0) scale(1)}44%,84%{opacity:0;transform:rotate(360deg) scale(.3)}92%,100%{opacity:1;transform:rotate(720deg) scale(1)}}
      @keyframes g58WaChat{0%,36%{opacity:0;transform:rotate(-360deg) scale(.3)}44%,84%{opacity:1;transform:rotate(0) scale(1)}92%,100%{opacity:0;transform:rotate(360deg) scale(.3)}}
      @media(prefers-reduced-motion:reduce){.g58-wa-float,.g58-wa-face{animation:none!important}.g58-wa-float::after{display:none}.g58-wa-float{transition:none}.g58-wa-face-chat{display:none}}
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
    // Two faces that take turns: the G58 three-ring logo and the WhatsApp button. Clicking opens the flyer popup.
    link.innerHTML = '<svg class="g58-wa-face g58-wa-face-logo" viewBox="0 0 120 120" fill="none" stroke="currentColor" stroke-width="9" aria-hidden="true" focusable="false"><circle cx="60" cy="28" r="16"/><circle cx="28" cy="84" r="16"/><circle cx="92" cy="84" r="16"/></svg>'
      + '<svg class="g58-wa-face g58-wa-face-chat" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" focusable="false"><path d="M17.47 14.38c-.3-.15-1.76-.87-2.03-.97-.27-.1-.47-.15-.67.15-.2.3-.77.97-.94 1.16-.17.2-.35.22-.65.07-.3-.15-1.26-.46-2.39-1.48-.88-.79-1.48-1.76-1.65-2.06-.17-.3-.02-.46.13-.6.13-.13.3-.35.45-.52.15-.17.2-.3.3-.5.1-.2.05-.37-.02-.52-.08-.15-.67-1.61-.92-2.2-.24-.58-.49-.5-.67-.51h-.57c-.2 0-.52.07-.79.37-.27.3-1.04 1.02-1.04 2.48s1.07 2.88 1.21 3.07c.15.2 2.1 3.2 5.08 4.49.71.3 1.26.49 1.69.63.71.23 1.36.2 1.87.12.57-.09 1.76-.72 2-1.41.25-.7.25-1.29.17-1.41-.07-.12-.27-.2-.57-.35M12.05 21.78h-.01a9.87 9.87 0 0 1-5.03-1.38l-.36-.21-3.74.98 1-3.65-.24-.37a9.86 9.86 0 0 1-1.51-5.26c0-5.45 4.44-9.88 9.89-9.88 2.64 0 5.12 1.03 6.99 2.9a9.82 9.82 0 0 1 2.89 6.99c0 5.45-4.44 9.88-9.88 9.88m8.41-18.3A11.82 11.82 0 0 0 12.05 0C5.5 0 .16 5.34.16 11.89c0 2.1.55 4.14 1.59 5.95L.06 24l6.3-1.65a11.88 11.88 0 0 0 5.68 1.45h.01c6.55 0 11.89-5.34 11.89-11.89 0-3.18-1.24-6.17-3.48-8.41z"/></svg>';
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
