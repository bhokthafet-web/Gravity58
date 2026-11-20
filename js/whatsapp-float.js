(() => {
  "use strict";
  // The WhatsApp number customers chat with, in international format without "+" or spaces.
  // If this is ever empty or malformed the icon simply stays hidden.
  const WHATSAPP_NUMBER = "919391523275";
  const GREETING = "Hi Gravity58, I would like to know more about your business tools.";

  if (window.G58WhatsApp || !/^\d{11,15}$/.test(WHATSAPP_NUMBER)) return;

  const STYLE_ID = "g58WhatsAppStyles";
  const ICON = "M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z";

  function mount() {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement("style");
    style.id = STYLE_ID;
    style.textContent = `
      .g58-wa-float{position:fixed;left:max(16px,env(safe-area-inset-left));bottom:max(16px,env(safe-area-inset-bottom));z-index:9000;width:58px;height:58px;border-radius:50%;display:grid;place-items:center;background:#25D366;color:#fff;box-shadow:0 10px 26px rgba(18,140,70,.38),0 2px 6px rgba(0,0,0,.18);text-decoration:none;transition:transform .18s ease,box-shadow .18s ease}
      .g58-wa-float:hover{transform:translateY(-2px) scale(1.05)}
      .g58-wa-float:focus-visible{outline:3px solid #fff;outline-offset:3px;box-shadow:0 0 0 6px #128C7E}
      .g58-wa-float svg{width:30px;height:30px;fill:currentColor}
      .g58-wa-float::after{content:"";position:absolute;inset:0;border-radius:50%;border:2px solid #25D366;animation:g58WaPulse 2.4s ease-out infinite;pointer-events:none}
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
    link.innerHTML = `<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="${ICON}"/></svg>`;
    document.body.appendChild(link);
  }

  window.G58WhatsApp = true;
  if (document.body) mount();
  else document.addEventListener("DOMContentLoaded", mount, { once: true });
})();
