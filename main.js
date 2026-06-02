/* ثَمين — منطق الصفحة: بناء المعرض + Lightbox */
(function () {
  "use strict";

  const grid = document.getElementById("gallery-grid");
  const images = Array.isArray(window.GALLERY) ? window.GALLERY : [];

  // ---- بناء شبكة المعرض (إن وُجد القسم) ----
  if (grid) {
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

  // ---- أزرار الكشف بأنميشن (قائمة التعلّم + الأسئلة) ----
  document.querySelectorAll(".js-toggle").forEach((btn) => {
    const target = document.getElementById(btn.getAttribute("aria-controls"));
    if (!target) return;
    const label = btn.querySelector(".js-toggle-label");
    btn.addEventListener("click", () => {
      const open = target.classList.toggle("open");
      btn.setAttribute("aria-expanded", open ? "true" : "false");
      if (label) {
        label.textContent = open ? btn.dataset.openText : btn.dataset.closeText;
      }
    });
  });

  // ---- سلايدر الشهادات: تمرير بطيء + إيقاف + سحب ----
  const marquee = document.querySelector(".reviews-marquee");
  const track = marquee && marquee.querySelector(".reviews-track");
  if (marquee && track) {
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let paused = false;
    let resumeTimer;
    const pause = () => { paused = true; clearTimeout(resumeTimer); };
    const scheduleResume = () => {
      clearTimeout(resumeTimer);
      resumeTimer = setTimeout(() => { paused = false; }, 1800);
    };

    // إيقاف عند المرور أو اللمس، واستئناف بعد توقّف التفاعل
    marquee.addEventListener("mouseenter", pause);
    marquee.addEventListener("mouseleave", scheduleResume);
    ["touchstart", "wheel"].forEach((ev) =>
      marquee.addEventListener(ev, () => { pause(); scheduleResume(); }, { passive: true })
    );

    // سحب بالماوس/الإصبع لتصفّح التعليقات
    let isDown = false, startX = 0, startScroll = 0, moved = false;
    marquee.addEventListener("pointerdown", (e) => {
      isDown = true; moved = false;
      startX = e.clientX; startScroll = marquee.scrollLeft;
      pause();
      try { marquee.setPointerCapture(e.pointerId); } catch (_) {}
    });
    marquee.addEventListener("pointermove", (e) => {
      if (!isDown) return;
      const dx = e.clientX - startX;
      if (Math.abs(dx) > 3) moved = true;
      marquee.scrollLeft = startScroll - dx;
    });
    const endDrag = () => { if (isDown) { isDown = false; scheduleResume(); } };
    marquee.addEventListener("pointerup", endDrag);
    marquee.addEventListener("pointercancel", endDrag);
    // امنع فتح الرابط لو كان السحب فعليًا
    marquee.addEventListener("click", (e) => { if (moved) { e.preventDefault(); e.stopPropagation(); } }, true);

    // التمرير التلقائي البطيء (نصف بكسل بالفريم ≈ قراءة مريحة)
    function step() {
      if (!paused && !isDown) {
        marquee.scrollLeft += 0.4;
        const half = track.scrollWidth / 2;
        if (half > 0 && marquee.scrollLeft >= half) marquee.scrollLeft -= half;
      }
      requestAnimationFrame(step);
    }
    if (!reduce) requestAnimationFrame(step);
  }

  // ---- زر تشغيل الفيديو المخصّص ----
  const mainVideo = document.getElementById("mainVideo");
  const videoPlay = document.getElementById("videoPlay");
  if (mainVideo && videoPlay) {
    videoPlay.addEventListener("click", () => mainVideo.play());
    mainVideo.addEventListener("play", () => videoPlay.classList.add("hidden"));
    mainVideo.addEventListener("ended", () => videoPlay.classList.remove("hidden"));
  }

  // ---- توهّج يتبع المؤشّر على الكروت ----
  const glowSelector =
    ".course-card, .stack-card, .offer, .review, .hl, .bonus, .ba-col, #faq details";
  document.querySelectorAll(glowSelector).forEach((el) => {
    el.classList.add("glow");
    el.addEventListener("pointermove", (e) => {
      const r = el.getBoundingClientRect();
      el.style.setProperty("--mx", e.clientX - r.left + "px");
      el.style.setProperty("--my", e.clientY - r.top + "px");
    });
  });

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
