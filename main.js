/* ثَمين — منطق الصفحة: بناء المعرض + Lightbox */
(function () {
  "use strict";

  const grid = document.getElementById("gallery-grid");
  const images = Array.isArray(window.GALLERY) ? window.GALLERY : [];

  // ---- بناء شبكة المعرض ----
  if (!images.length) {
    grid.innerHTML =
      '<div class="gallery-empty">ضع صورك في <b>assets/images/</b> ثم شغّل <b>update-gallery.command</b> وحدّث الصفحة.</div>';
  } else {
    images.forEach((src, i) => {
      const item = document.createElement("button");
      item.className = "gallery-item";
      item.type = "button";
      item.setAttribute("aria-label", "عرض الصورة " + (i + 1));

      const img = document.createElement("img");
      img.src = src;
      img.alt = "صورة " + (i + 1);
      img.loading = "lazy";
      img.decoding = "async";

      item.appendChild(img);
      item.addEventListener("click", () => openLightbox(i));
      grid.appendChild(item);
    });
  }

  // ---- Lightbox ----
  const box = document.getElementById("lightbox");
  const boxImg = box.querySelector(".lightbox-img");
  const btnClose = box.querySelector(".lightbox-close");
  const btnPrev = box.querySelector(".lightbox-prev");
  const btnNext = box.querySelector(".lightbox-next");
  let current = 0;

  function show(i) {
    current = (i + images.length) % images.length;
    boxImg.src = images[current];
    boxImg.alt = "صورة " + (current + 1);
  }
  function openLightbox(i) {
    show(i);
    box.classList.add("open");
    box.setAttribute("aria-hidden", "false");
    document.body.style.overflow = "hidden";
  }
  function closeLightbox() {
    box.classList.remove("open");
    box.setAttribute("aria-hidden", "true");
    document.body.style.overflow = "";
  }

  btnClose.addEventListener("click", closeLightbox);
  btnPrev.addEventListener("click", () => show(current + 1)); // RTL: السابق = +1
  btnNext.addEventListener("click", () => show(current - 1));
  box.addEventListener("click", (e) => { if (e.target === box) closeLightbox(); });

  document.addEventListener("keydown", (e) => {
    if (!box.classList.contains("open")) return;
    if (e.key === "Escape") closeLightbox();
    else if (e.key === "ArrowRight") show(current + 1);
    else if (e.key === "ArrowLeft") show(current - 1);
  });

  // ---- كشف "شنو راح تتعلّم" بأنميشن ----
  const learnToggle = document.getElementById("learnToggle");
  const learnReveal = document.getElementById("learnReveal");
  if (learnToggle && learnReveal) {
    learnToggle.addEventListener("click", () => {
      const open = learnReveal.classList.toggle("open");
      learnToggle.setAttribute("aria-expanded", open ? "true" : "false");
      const label = learnToggle.querySelector("span:first-child");
      if (label) label.textContent = open ? "إخفاء القائمة" : "شنو راح تتعلّم وتاخذ؟ افتح القائمة الكاملة";
    });
  }

  // سحب أفقي على الجوال للتنقّل
  let touchX = null;
  box.addEventListener("touchstart", (e) => { touchX = e.changedTouches[0].clientX; }, { passive: true });
  box.addEventListener("touchend", (e) => {
    if (touchX === null) return;
    const dx = e.changedTouches[0].clientX - touchX;
    if (Math.abs(dx) > 50) show(current + (dx > 0 ? 1 : -1)); // RTL
    touchX = null;
  }, { passive: true });
})();
