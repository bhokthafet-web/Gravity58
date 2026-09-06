(() => {
  "use strict";
  window.openG58ContactModal = () => document.getElementById("g58ContactModal")?.classList.add("open");
  window.closeG58ContactModal = () => document.getElementById("g58ContactModal")?.classList.remove("open");

  document.addEventListener("DOMContentLoaded", () => {
    [
      "contentArea",
      "reqDetailOverlay",
      "reqDetailPanel",
      "floatingBusinessWrap",
      "businessEditSuccessModal",
      "stateSelectionModal",
      "browseGuideModal",
      "createModal",
      "publishSuccessModal",
      "bidModal",
      "bidSuccessModal",
      "businessManageModal",
      "myPostsModal",
      "businessRatingModal",
      "businessQrModal",
      "cardUnlockModal",
    ].forEach((id) => document.getElementById(id)?.remove());

    document.getElementById("g58ContactCancel")?.addEventListener("click", window.closeG58ContactModal);
    document.getElementById("g58ContactForm")?.addEventListener("submit", async (event) => {
      event.preventDefault();
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
        event.currentTarget.reset();
        alert("Thanks! Your message has been sent to the G58 team.");
      } catch (error) {
        alert(error.message || "Could not send your message. Please try again.");
      } finally {
        button.disabled = false;
        button.textContent = "Send";
      }
    });
  });
})();
