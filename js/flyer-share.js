(() => {
  "use strict";
  // Flyer popup opened from the floating WhatsApp icon. One WhatsApp button opens a chat with G58
  // and a ready-made message that includes the link to the flyer PDF (WhatsApp links cannot attach files).
  if (window.G58FlyerPopup) return;

  const FLYER_PDF = "/assets/flyer/GRAVITY58_Flyer.pdf";
  const WAVE = "\u{1F44B}";
  const KINDS = {
    refills: "I run a store and want customers to reorder their regular items in one tap with Refills.",
    booking: "I take appointments and want customers to pre-book and pay in advance with Booking.",
    menu: "I run a restaurant and want a live digital menu with table QR codes and order tracking.",
  };

  function cleanName(value) {
    return String(value || "").replace(/\s+/g, " ").trim().slice(0, 60);
  }

  function buildMessage(kind, name, origin) {
    const who = cleanName(name);
    const lines = [
      `Hi Gravity58! ${WAVE}`,
      `I saw your flyer – "Turn any store online in seconds." ${KINDS[kind] || KINDS.refills}`,
      "Please share the 1 month free trial details (₹699, no hidden charges) and arrange a free demo.",
    ];
    if (who) lines.push(`My name / business: ${who}`);
    lines.push(`Flyer: ${origin}${FLYER_PDF}`);
    return lines.join("\n\n");
  }

  function chatUrl(number, message) {
    return `https://wa.me/${number}?text=${encodeURIComponent(message)}`;
  }

  const WA_ICON = "M17.47 14.38c-.3-.15-1.76-.87-2.03-.97-.27-.1-.47-.15-.67.15-.2.3-.77.97-.94 1.16-.17.2-.35.22-.65.07-.3-.15-1.26-.46-2.39-1.48-.88-.79-1.48-1.76-1.65-2.06-.17-.3-.02-.46.13-.6.13-.13.3-.35.45-.52.15-.17.2-.3.3-.5.1-.2.05-.37-.02-.52-.08-.15-.67-1.61-.92-2.2-.24-.58-.49-.5-.67-.51h-.57c-.2 0-.52.07-.79.37-.27.3-1.04 1.02-1.04 2.48s1.07 2.88 1.21 3.07c.15.2 2.1 3.2 5.08 4.49.71.3 1.26.49 1.69.63.71.23 1.36.2 1.87.12.57-.09 1.76-.72 2-1.41.25-.7.25-1.29.17-1.41-.07-.12-.27-.2-.57-.35M12.05 21.78h-.01a9.87 9.87 0 0 1-5.03-1.38l-.36-.21-3.74.98 1-3.65-.24-.37a9.86 9.86 0 0 1-1.51-5.26c0-5.45 4.44-9.88 9.89-9.88 2.64 0 5.12 1.03 6.99 2.9a9.82 9.82 0 0 1 2.89 6.99c0 5.45-4.44 9.88-9.88 9.88m8.41-18.3A11.82 11.82 0 0 0 12.05 0C5.5 0 .16 5.34.16 11.89c0 2.1.55 4.14 1.59 5.95L.06 24l6.3-1.65a11.88 11.88 0 0 0 5.68 1.45h.01c6.55 0 11.89-5.34 11.89-11.89 0-3.18-1.24-6.17-3.48-8.41z";

  let overlay = null;
  let opener = null;
  let kind = "refills";

  function build() {
    overlay = document.createElement("div");
    overlay.className = "g58-flyer-overlay";
    overlay.hidden = true;
    overlay.innerHTML = `
      <div class="g58-flyer-dialog" role="dialog" aria-modal="true" aria-labelledby="g58FlyerTitle">
        <button type="button" class="g58-flyer-close" aria-label="Close">✕</button>
        <div class="g58-flyer-stage">
          <div class="g58-flyer-stack">
            <img class="g58-flyer-page is-front" src="/assets/flyer/flyer-page-1.jpg" width="900" height="1273" alt="GRAVITY58 flyer, front: Turn any store online in seconds. Refills, Booking and Digital Menu. 1 month free trial, just 699 rupees.">
            <img class="g58-flyer-page" src="/assets/flyer/flyer-page-2.jpg" width="900" height="1273" alt="GRAVITY58 flyer, back: the old way versus the G58 way, 5 steps down to 3 steps.">
          </div>
          <div class="g58-flyer-tabs" role="group" aria-label="Flyer side">
            <button type="button" data-page="0" aria-pressed="true">Front</button>
            <button type="button" data-page="1" aria-pressed="false">Back</button>
          </div>
        </div>
        <div class="g58-flyer-body">
          <span class="g58-flyer-eyebrow"><i aria-hidden="true"></i>Chat with us</span>
          <h2 id="g58FlyerTitle">Get the GRAVITY58 flyer on WhatsApp</h2>
          <p class="g58-flyer-lead">1 month free trial, just ₹699, no hidden charges. Tap the button and WhatsApp opens with your message and the flyer PDF link.</p>
          <p class="g58-flyer-label" id="g58FlyerKindLabel">I run a…</p>
          <div class="g58-flyer-chips" role="radiogroup" aria-labelledby="g58FlyerKindLabel">
            <button type="button" role="radio" aria-checked="true" data-kind="refills">Store</button>
            <button type="button" role="radio" aria-checked="false" data-kind="booking" tabindex="-1">Salon / clinic</button>
            <button type="button" role="radio" aria-checked="false" data-kind="menu" tabindex="-1">Restaurant</button>
          </div>
          <label class="g58-flyer-label" for="g58FlyerName">Your name or business <span>(optional)</span></label>
          <input id="g58FlyerName" class="g58-flyer-input" type="text" maxlength="60" autocomplete="organization" placeholder="e.g. Sri Sai Medicals">
          <a class="g58-flyer-wa" id="g58FlyerChat" href="https://wa.me/" target="_blank" rel="noopener">
            <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="${WA_ICON}"/></svg><span>Open WhatsApp</span>
          </a>
          <a class="g58-flyer-download" href="${FLYER_PDF}" download>Download the flyer (PDF)</a>
        </div>
      </div>`;
    document.body.appendChild(overlay);

    const number = window.G58WhatsAppNumber;
    const nameInput = overlay.querySelector("#g58FlyerName");
    const chatLink = overlay.querySelector("#g58FlyerChat");
    const chips = Array.from(overlay.querySelectorAll("[data-kind]"));
    const pages = Array.from(overlay.querySelectorAll(".g58-flyer-page"));
    const tabs = Array.from(overlay.querySelectorAll("[data-page]"));

    function render() {
      chatLink.href = chatUrl(number, buildMessage(kind, nameInput.value, location.origin));
      chips.forEach((chip) => {
        const active = chip.dataset.kind === kind;
        chip.setAttribute("aria-checked", active ? "true" : "false");
        chip.tabIndex = active ? 0 : -1;
      });
    }
    function showPage(index) {
      pages.forEach((page, i) => page.classList.toggle("is-front", i === index));
      tabs.forEach((tab, i) => tab.setAttribute("aria-pressed", i === index ? "true" : "false"));
    }

    chips.forEach((chip) => {
      chip.addEventListener("click", () => { kind = chip.dataset.kind; render(); });
      chip.addEventListener("keydown", (event) => {
        const step = /^Arrow(Right|Down)$/.test(event.key) ? 1 : /^Arrow(Left|Up)$/.test(event.key) ? -1 : 0;
        if (!step) return;
        event.preventDefault();
        const next = chips[(chips.indexOf(chip) + step + chips.length) % chips.length];
        kind = next.dataset.kind;
        render();
        next.focus();
      });
    });
    nameInput.addEventListener("input", render);
    tabs.forEach((tab, i) => tab.addEventListener("click", () => showPage(i)));
    pages.forEach((page, i) => page.addEventListener("click", () => showPage(i)));
    chatLink.addEventListener("click", () => setTimeout(close, 250));

    overlay.querySelector(".g58-flyer-close").addEventListener("click", close);
    overlay.addEventListener("click", (event) => { if (event.target === overlay) close(); });
    overlay.addEventListener("keydown", (event) => {
      if (event.key === "Escape") { event.stopPropagation(); close(); return; }
      if (event.key !== "Tab") return;
      // Keep keyboard focus inside the popup while it is open.
      const focusable = Array.from(overlay.querySelectorAll("button,a[href],input")).filter((node) => node.tabIndex >= 0 && node.offsetParent !== null);
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    });
    render();
    showPage(0);
  }

  function open(trigger) {
    if (!/^\d{11,15}$/.test(String(window.G58WhatsAppNumber || ""))) return false;
    if (!overlay) build();
    opener = trigger || document.activeElement;
    overlay.hidden = false;
    document.documentElement.classList.add("g58-flyer-lock");
    overlay.querySelector(".g58-flyer-close").focus({ preventScroll: true });
    return true;
  }

  function close() {
    if (!overlay || overlay.hidden) return;
    overlay.hidden = true;
    document.documentElement.classList.remove("g58-flyer-lock");
    try { opener?.focus?.({ preventScroll: true }); } catch {}
    opener = null;
  }

  window.G58FlyerPopup = Object.freeze({ open, close, buildMessage, chatUrl, FLYER_PDF, isOpen: () => Boolean(overlay && !overlay.hidden) });
})();
