(() => {
  "use strict";
  window.openG58ContactModal = () => document.getElementById("g58ContactModal")?.classList.add("open");
  window.closeG58ContactModal = () => document.getElementById("g58ContactModal")?.classList.remove("open");
  window.openG58ContactSuccessModal = () => document.getElementById("g58ContactSuccessModal")?.classList.add("show");
  window.closeG58ContactSuccessModal = () => document.getElementById("g58ContactSuccessModal")?.classList.remove("show");

  window.toggleMobileNav = () => {
    const panel = document.getElementById("mobileNavPanel");
    const overlay = document.getElementById("mobileNavOverlay");
    const toggle = document.getElementById("mobileNavToggle");
    const open = panel?.classList.toggle("open") || false;
    overlay?.classList.toggle("open", open);
    toggle?.classList.toggle("active", open);
    toggle?.setAttribute("aria-expanded", String(open));
  };

  window.closeMobileNav = () => {
    document.getElementById("mobileNavPanel")?.classList.remove("open");
    document.getElementById("mobileNavOverlay")?.classList.remove("open");
    document.getElementById("mobileNavToggle")?.classList.remove("active");
    document.getElementById("mobileNavToggle")?.setAttribute("aria-expanded", "false");
  };

  function scheduleHeroFlowDots() {
    const heading = document.getElementById("heroHeading");
    if (!heading || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const run = () => {
      heading.classList.remove("result-active");
      heading.classList.add("dots-active");
      setTimeout(() => {
        heading.classList.remove("dots-active");
        heading.classList.add("result-active");
      }, 6250);
      setTimeout(() => heading.classList.remove("result-active"), 10000);
      setTimeout(run, 11875);
    };
    setTimeout(run, 1750);
  }

  document.addEventListener("DOMContentLoaded", () => {
    const reduceMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    const revealTargets = document.querySelectorAll(".reveal");
    if (reduceMotion || !("IntersectionObserver" in window)) {
      revealTargets.forEach((element) => element.classList.add("in-view"));
    } else {
      const observer = new IntersectionObserver((entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          entry.target.classList.add("in-view");
          observer.unobserve(entry.target);
        });
      }, { threshold: 0.15 });
      revealTargets.forEach((element) => observer.observe(element));
    }

    document.querySelectorAll(".nav-mega-trigger").forEach((trigger) => {
      trigger.addEventListener("click", (event) => {
        event.stopPropagation();
        const wrap = trigger.closest(".nav-mega-wrap");
        const open = wrap?.classList.toggle("touch-open") || false;
        trigger.setAttribute("aria-expanded", String(open));
      });
    });
    document.addEventListener("click", () => {
      document.querySelectorAll(".nav-mega-wrap.touch-open").forEach((wrap) => {
        wrap.classList.remove("touch-open");
        wrap.querySelector(".nav-mega-trigger")?.setAttribute("aria-expanded", "false");
      });
    });

    scheduleHeroFlowDots();

    document.getElementById("g58ContactCancel")?.addEventListener("click", window.closeG58ContactModal);
    document.getElementById("g58ContactSuccessClose")?.addEventListener("click", window.closeG58ContactSuccessModal);
    document.getElementById("g58ContactForm")?.addEventListener("submit", async (event) => {
      event.preventDefault();
      const form = event.currentTarget;
      const api = window.Gravity58Ads;
      const button = document.getElementById("g58ContactSubmit");
      const name = document.getElementById("g58ContactName")?.value.trim();
      const phone = document.getElementById("g58ContactPhone")?.value.trim();
      const interest = document.getElementById("g58ContactInterest")?.value;
      if (!name || !phone || !interest) return;
      if (!api?.configured) return alert("Contact service is temporarily unavailable. Please try again shortly.");
      button.disabled = true;
      button.textContent = "Sending…";
      try {
        const activeUser = await api.ensureUser();
        if (!activeUser) throw new Error("Could not start a secure session.");
        await api.create("g58_contact_requests", { name, phone, interest, createdAt: new Date().toISOString() });
        window.closeG58ContactModal();
        form.reset();
        window.openG58ContactSuccessModal();
      } catch (error) {
        alert(error.message || "Could not send your message. Please try again.");
      } finally {
        button.disabled = false;
        button.textContent = "Send";
      }
    });
  });
})();
