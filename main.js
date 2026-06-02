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

  // ---- بناء بطاقات الشهادات من reviews.js ----
  const reviewsTrack = document.getElementById("reviewsTrack");
  const REVIEWS = Array.isArray(window.REVIEWS) ? window.REVIEWS : [];
  if (reviewsTrack && REVIEWS.length) {
    const esc = (s) =>
      String(s).replace(/[&<>"]/g, (c) =>
        ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c])
      );
    const card = (r, hidden) =>
      `<figure class="review"${hidden ? ' aria-hidden="true"' : ""}>` +
      `<div class="stars">${"★".repeat(Math.max(1, Math.min(5, r.stars || 5)))}</div>` +
      `<p>${esc(r.comment)}</p>` +
      `<figcaption>${esc(r.name)}</figcaption></figure>`;
    // نسختان للّف المستمر السلس
    reviewsTrack.innerHTML =
      REVIEWS.map((r) => card(r, false)).join("") +
      REVIEWS.map((r) => card(r, true)).join("");
  }

  // ---- سلايدر الشهادات: تمرير خفيف + سحب انسيابي (inertia) ----
  const marquee = document.querySelector(".reviews-marquee");
  const track = marquee && marquee.querySelector(".reviews-track");
  if (marquee && track) {
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const SPEED = 0.3; // تمرير تلقائي خفيف
    let hovered = false, isDown = false, moved = false;
    let startX = 0, startScroll = 0;
    let vel = 0, lastX = 0, lastT = 0, inertia = false;

    const wrap = () => {
      const half = track.scrollWidth / 2;
      if (half <= 0) return;
      if (marquee.scrollLeft >= half) marquee.scrollLeft -= half;
      else if (marquee.scrollLeft < 0) marquee.scrollLeft += half;
    };

    marquee.addEventListener("mouseenter", () => { hovered = true; });
    marquee.addEventListener("mouseleave", () => { hovered = false; });

    marquee.addEventListener("pointerdown", (e) => {
      isDown = true; moved = false; inertia = false; vel = 0;
      startX = lastX = e.clientX; startScroll = marquee.scrollLeft;
      lastT = e.timeStamp || 0;
      try { marquee.setPointerCapture(e.pointerId); } catch (_) {}
    });
    marquee.addEventListener("pointermove", (e) => {
      if (!isDown) return;
      const dx = e.clientX - startX;
      if (Math.abs(dx) > 3) moved = true;
      marquee.scrollLeft = startScroll - dx;
      const dt = (e.timeStamp || 0) - lastT;
      if (dt > 0) vel = (lastX - e.clientX) / dt; // بكسل/مللي ثانية
      lastX = e.clientX; lastT = e.timeStamp || 0;
    });
    const endDrag = () => {
      if (!isDown) return;
      isDown = false;
      // انسيابية بعد رفع الإصبع تتلاشى بنعومة
      if (Math.abs(vel) > 0.02) {
        inertia = true;
        const glide = () => {
          if (!inertia) return;
          marquee.scrollLeft += vel * 16;
          wrap();
          vel *= 0.92; // تباطؤ سموث
          if (Math.abs(vel) > 0.02) requestAnimationFrame(glide);
          else inertia = false;
        };
        requestAnimationFrame(glide);
      }
    };
    marquee.addEventListener("pointerup", endDrag);
    marquee.addEventListener("pointercancel", endDrag);
    marquee.addEventListener("click", (e) => { if (moved) { e.preventDefault(); e.stopPropagation(); } }, true);

    function step() {
      if (!hovered && !isDown && !inertia) {
        marquee.scrollLeft += SPEED;
        wrap();
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
