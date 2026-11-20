(() => {
  "use strict";
  // One-tap WhatsApp flyer section on the home page.
  // - "Chat on WhatsApp" opens a chat with G58 with a ready-made message for the chosen business type.
  // - "Send the flyer" shares the PDF through the phone's share sheet (WhatsApp is listed there),
  //   or falls back to a WhatsApp message containing the flyer link.
  const FLYER_PATH = "/assets/flyer/GRAVITY58_Flyer.pdf";
  const WAVE = "\u{1F44B}";
  const MESSAGES = {
    refills: {
      label: "Store owner",
      sub: "Refills",
      text: "I run a store and want customers to reorder their regular items in one tap with Refills.",
    },
    booking: {
      label: "Salon, clinic or studio",
      sub: "Booking",
      text: "I take appointments and want customers to pre-book and pay in advance with Booking.",
    },
    menu: {
      label: "Restaurant or café",
      sub: "Digital Menu",
      text: "I run a restaurant and want a live digital menu with table QR codes and order tracking.",
    },
  };

  function cleanName(value) {
    return String(value || "").replace(/\s+/g, " ").trim().slice(0, 60);
  }

  function buildMessage(kind, name) {
    const choice = MESSAGES[kind] || MESSAGES.refills;
    const who = cleanName(name);
    const lines = [
      `Hi Gravity58! ${WAVE}`,
      `I saw your flyer – "Turn any store online in seconds." ${choice.text}`,
      "Please share the 1 month free trial details (₹699, no hidden charges) and arrange a free demo.",
    ];
    if (who) lines.push(`My name / business: ${who}`);
    return lines.join("\n\n");
  }

  function chatUrl(number, message) {
    return `https://wa.me/${number}?text=${encodeURIComponent(message)}`;
  }

  function forwardMessage(origin) {
    return `GRAVITY58 – turn any store online in seconds. Refills, Booking and Digital Menu with one QR code. 1 month free trial.\n\nFlyer: ${origin}${FLYER_PATH}\nWebsite: ${origin}/`;
  }

  function init() {
    const root = document.getElementById("flyerShare");
    if (!root || root.dataset.ready) return;
    const number = window.G58WhatsAppNumber;
    if (!/^\d{11,15}$/.test(String(number || ""))) return; // no valid number: keep the section simple (download only)
    root.dataset.ready = "1";
    root.classList.add("is-live");

    const chips = Array.from(root.querySelectorAll("[data-kind]"));
    const nameInput = root.querySelector("#flyerName");
    const bubble = root.querySelector("#flyerBubbleText");
    const chatLink = root.querySelector("#flyerChatLink");
    const sendBtn = root.querySelector("#flyerSendBtn");
    const note = root.querySelector("#flyerNote");
    const pages = Array.from(root.querySelectorAll(".flyer-page"));
    const tabs = Array.from(root.querySelectorAll("[data-page]"));
    let kind = "refills";

    function render() {
      const message = buildMessage(kind, nameInput?.value);
      if (bubble) bubble.textContent = message;
      if (chatLink) chatLink.href = chatUrl(number, message);
      chips.forEach((chip) => {
        const active = chip.dataset.kind === kind;
        chip.setAttribute("aria-checked", active ? "true" : "false");
        chip.tabIndex = active ? 0 : -1;
      });
    }

    chips.forEach((chip) => {
      chip.addEventListener("click", () => { kind = chip.dataset.kind; render(); });
      chip.addEventListener("keydown", (event) => {
        const step = event.key === "ArrowRight" || event.key === "ArrowDown" ? 1 : event.key === "ArrowLeft" || event.key === "ArrowUp" ? -1 : 0;
        if (!step) return;
        event.preventDefault();
        const next = chips[(chips.indexOf(chip) + step + chips.length) % chips.length];
        kind = next.dataset.kind;
        render();
        next.focus();
      });
    });
    nameInput?.addEventListener("input", render);

    function showPage(index) {
      pages.forEach((page, i) => page.classList.toggle("is-front", i === index));
      tabs.forEach((tab, i) => tab.setAttribute("aria-pressed", i === index ? "true" : "false"));
    }
    tabs.forEach((tab, i) => tab.addEventListener("click", () => showPage(i)));
    pages.forEach((page, i) => page.addEventListener("click", () => {
      if (!page.classList.contains("is-front")) showPage(i);
    }));

    function say(text) { if (note) note.textContent = text; }

    sendBtn?.addEventListener("click", async () => {
      const origin = location.origin;
      const text = forwardMessage(origin);
      try {
        if (navigator.canShare && navigator.share) {
          say("Preparing the flyer…");
          const response = await fetch(FLYER_PATH);
          if (!response.ok) throw new Error("flyer unavailable");
          const file = new File([await response.blob()], "GRAVITY58_Flyer.pdf", { type: "application/pdf" });
          if (navigator.canShare({ files: [file] })) {
            await navigator.share({ files: [file], title: "GRAVITY58 flyer", text });
            say("Pick WhatsApp in the share sheet to send the flyer.");
            return;
          }
        }
      } catch (error) {
        if (error && error.name === "AbortError") { say(""); return; }
        // Any other problem falls through to the WhatsApp link below.
      }
      window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, "_blank", "noopener");
      say("WhatsApp opened – choose who to send it to.");
    });

    render();
    showPage(0);
  }

  window.G58FlyerShare = Object.freeze({ buildMessage, chatUrl, forwardMessage, FLYER_PATH });
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init, { once: true });
  else init();
})();
