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

  // ====== الشهادات + بوكس إضافة تعليق ======
  // إعداد Supabase (اختياري) — لمّا يجهّز عمر المشروع يحط القيمتين هنا:
  const SUPABASE_URL = "https://hwzpjxxfdqsjymxbjokv.supabase.co";
  const SUPABASE_KEY = "sb_publishable_mcKOUcVtNy5BkLEd5UcRDA_foJbp3YK";
  const SB_TABLE = "reviews";
  const sbReady = !!(SUPABASE_URL && SUPABASE_KEY);
  const sbHeaders = (extra) =>
    Object.assign({ apikey: SUPABASE_KEY, Authorization: "Bearer " + SUPABASE_KEY }, extra || {});

  const LS_LOCAL = "thameen_user_reviews";
  const LS_COUNT = "thameen_review_count";
  const getLocal = () => { try { return JSON.parse(localStorage.getItem(LS_LOCAL) || "[]"); } catch (_) { return []; } };
  const addLocal = (r) => { const a = getLocal(); a.unshift(r); localStorage.setItem(LS_LOCAL, JSON.stringify(a.slice(0, 5))); };
  const getCount = () => parseInt(localStorage.getItem(LS_COUNT) || "0", 10) || 0;
  const bumpCount = () => localStorage.setItem(LS_COUNT, String(getCount() + 1));

  const esc = (s) =>
    String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  function card(r, hidden) {
    const n = Math.max(1, Math.min(5, r.stars || 5));
    return `<figure class="review"${hidden ? ' aria-hidden="true"' : ""}>` +
      `<div class="stars">${"★".repeat(n)}</div>` +
      `<p>${esc(r.comment)}</p><figcaption>${esc(r.name)}</figcaption></figure>`;
  }
  const reviewsTrack = document.getElementById("reviewsTrack");
  const storeReviews = Array.isArray(window.REVIEWS) ? window.REVIEWS : [];
  let allReviews = (sbReady ? [] : getLocal()).concat(storeReviews);
  function rebuildReviews() {
    if (!reviewsTrack) return;
    const a = allReviews.map((r) => card(r, false)).join("");
    const b = allReviews.map((r) => card(r, true)).join("");
    reviewsTrack.innerHTML = a + b;
  }
  rebuildReviews();

  // عدّاد المراجعات (المتجر + تعليقات الزوّار)
  const ratingCountEl = document.getElementById("ratingCount");
  const BASE_REVIEWS = 27; // مراجعات المتجر الحقيقية
  let reviewCount = BASE_REVIEWS;
  const setRatingCount = () => { if (ratingCountEl) ratingCountEl.textContent = reviewCount + " مراجعة"; };
  setRatingCount();

  // جلب تعليقات المستخدمين من Supabase (إن وُجد) لتظهر للجميع
  if (sbReady) {
    fetch(`${SUPABASE_URL}/rest/v1/${SB_TABLE}?select=name,comment,stars,hidden&order=created_at.desc&limit=80`,
      { headers: sbHeaders() })
      .then((r) => (r.ok ? r.json() : []))
      .then((rows) => {
        if (Array.isArray(rows)) {
          const visible = rows.filter((r) => !r.hidden);   // المخفيّة من الداشبورد ما تظهر
          if (visible.length) { allReviews = visible.concat(storeReviews); rebuildReviews(); }
          reviewCount = BASE_REVIEWS + visible.length;
          setRatingCount();
        }
      })
      .catch(() => {});
  }

  // ---- عدّ تصاعدي للأرقام (0 ← الرقم) عند ظهورها ----
  const arDigits = (s) => s.replace(/[0-9]/g, (d) => "٠١٢٣٤٥٦٧٨٩"[+d]);
  function countTo(el, to, o) {
    o = o || {};
    const dec = o.decimals || 0, prefix = o.prefix || "", suffix = o.suffix || "";
    const ar = !!o.arabic, dur = o.duration || 1500, from = o.from || 0;
    const fmt = (v) => { let t = v.toFixed(dec); if (ar) t = arDigits(t); return prefix + t + suffix; };
    let s = null;
    function frame(t) {
      if (s === null) s = t;
      const p = Math.min(1, (t - s) / dur);
      const e = 1 - Math.pow(1 - p, 3); // easeOutCubic
      el.textContent = fmt(from + (to - from) * e);
      if (p < 1) requestAnimationFrame(frame);
      else el.textContent = fmt(to);
    }
    requestAnimationFrame(frame);
  }
  if ("IntersectionObserver" in window) {
    const io = new IntersectionObserver((ents) => {
      ents.forEach((en) => {
        if (!en.isIntersecting || en.target.dataset.counted) return;
        en.target.dataset.counted = "1";
        const el = en.target;
        if (el.id === "ratingCount") {
          countTo(el, reviewCount, { suffix: " مراجعة" });
        } else {
          countTo(el, parseFloat(el.dataset.to), {
            decimals: parseInt(el.dataset.decimals || "0", 10),
            prefix: el.dataset.prefix || "",
            suffix: el.dataset.suffix || "",
            arabic: el.dataset.arabic === "true",
          });
        }
        io.unobserve(el);
      });
    }, { threshold: 0.6 });
    document.querySelectorAll(".countup").forEach((el) => io.observe(el));
    if (ratingCountEl) io.observe(ratingCountEl);
  }

  // ---- بوكس إضافة تعليق ----
  const modal = document.getElementById("reviewModal");
  const openBtn = document.getElementById("openReview");
  if (modal && openBtn) {
    const closeBtn = document.getElementById("reviewClose");
    const form = document.getElementById("reviewForm");
    const nameI = document.getElementById("rName");
    const commentI = document.getElementById("rComment");
    const honey = document.getElementById("rHoney");
    const msg = document.getElementById("rMsg");
    const submitBtn = document.getElementById("rSubmit");
    const starsWrap = document.getElementById("rStars");
    let stars = 5;
    const paintStars = (v) => { stars = v; Array.from(starsWrap.children).forEach((b, i) => b.classList.toggle("on", i < v)); };
    if (starsWrap) {
      paintStars(5);
      starsWrap.addEventListener("click", (e) => { const b = e.target.closest("button[data-v]"); if (b) paintStars(parseInt(b.dataset.v, 10)); });
    }
    const setMsg = (t, kind) => { msg.textContent = t; msg.className = "rform-msg " + (kind || ""); };

    const open = () => {
      modal.classList.add("open"); modal.setAttribute("aria-hidden", "false"); document.body.style.overflow = "hidden";
      if (getCount() >= 2) { setMsg("وصلت الحد الأقصى (تعليقين). شكرًا لك! 🙏", "err"); submitBtn.disabled = true; }
      else { setMsg("", ""); submitBtn.disabled = false; }
      setTimeout(() => nameI && nameI.focus(), 100);
    };
    const close = () => { modal.classList.remove("open"); modal.setAttribute("aria-hidden", "true"); document.body.style.overflow = ""; };
    openBtn.addEventListener("click", open);
    closeBtn && closeBtn.addEventListener("click", close);
    modal.addEventListener("click", (e) => { if (e.target === modal) close(); });
    document.addEventListener("keydown", (e) => { if (e.key === "Escape" && modal.classList.contains("open")) close(); });

    form && form.addEventListener("submit", async (e) => {
      e.preventDefault();
      if (honey && honey.value) { close(); return; } // فخّ للبوتات
      if (getCount() >= 2) { setMsg("وصلت الحد الأقصى (تعليقين).", "err"); return; }
      const name = (nameI.value || "").trim();
      const comment = (commentI.value || "").trim();
      if (name.length < 2) { setMsg("اكتب اسمك من فضلك.", "err"); return; }
      if (comment.length < 5) { setMsg("اكتب تعليقك من فضلك.", "err"); return; }
      const obj = { name: name, comment: comment, stars: stars };
      submitBtn.disabled = true; setMsg("جارٍ النشر…", "");
      try {
        if (sbReady) {
          const res = await fetch(`${SUPABASE_URL}/rest/v1/${SB_TABLE}`,
            { method: "POST", headers: sbHeaders({ "Content-Type": "application/json", "Prefer": "return=minimal" }), body: JSON.stringify(obj) });
          if (!res.ok) throw new Error("insert failed");
        } else {
          addLocal(obj);
        }
        allReviews.unshift(obj); rebuildReviews(); bumpCount();
        reviewCount++; setRatingCount();
        setMsg("تم نشر تعليقك، شكرًا لك! 🎉", "ok");
        form.reset(); paintStars(5);
        setTimeout(close, 1300);
      } catch (_) {
        setMsg("صار خطأ، حاول مرة ثانية.", "err"); submitBtn.disabled = false;
      }
    });
  }

  // ---- سلايدر الشهادات: تمرير خفيف + سحب انسيابي (inertia) ----
  const marquee = document.querySelector(".reviews-marquee");
  const track = marquee && marquee.querySelector(".reviews-track");
  if (marquee && track) {
    const SPEED = 0.55; // تمرير تلقائي خفيف وواضح
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

    let pos = marquee.scrollLeft;
    function step() {
      if (!hovered && !isDown && !inertia) {
        const half = track.scrollWidth / 2;
        pos += SPEED;
        if (half > 0 && pos >= half) pos -= half;
        marquee.scrollLeft = pos; // تعيين مباشر (يتجاوز تقريب Safari)
      } else {
        pos = marquee.scrollLeft; // مزامنة أثناء السحب/التوقّف
      }
      requestAnimationFrame(step);
    }
    requestAnimationFrame(step);
  }

  // ---- مشغّل الفيديو المخصّص + فصول داخل الفيديو ----
  // عدّل التوقيتات والعناوين هنا لمّا يجي الفيديو الطويل.
  // t = ثانية البداية. الفصل يمتد حتى بداية الفصل اللي بعده (أو نهاية الفيديو).
  let CHAPTERS = [
    { t: 0,  label: "الانترو" },
    { t: 5,  label: "المحتوى" },
    { t: 10, label: "ابدأ" },
  ];
  const mainVideo = document.getElementById("mainVideo");
  const videoPlay = document.getElementById("videoPlay");
  const videoFrame = document.getElementById("videoFrame");
  const vcontrols = document.getElementById("vcontrols");
  const vcPlay = document.getElementById("vcPlay");
  const vcBar = document.getElementById("vcBar");
  const vcTime = document.getElementById("vcTime");
  const vcFull = document.getElementById("vcFull");

  if (mainVideo) {
    const fmt = (s) => {
      s = Math.max(0, Math.floor(s || 0));
      return Math.floor(s / 60) + ":" + String(s % 60).padStart(2, "0");
    };

    // الزر المركزي الكبير
    if (videoPlay) videoPlay.addEventListener("click", () => mainVideo.play());

    // بناء قطع الفصول على الشريط حسب مدّة الفيديو
    let segs = [];
    const buildBar = () => {
      const dur = mainVideo.duration;
      if (!vcBar || !dur || !isFinite(dur)) return;
      vcBar.innerHTML = "";
      segs = [];
      CHAPTERS.forEach((ch, i) => {
        const start = ch.t;
        const end = i + 1 < CHAPTERS.length ? CHAPTERS[i + 1].t : dur;
        const seg = document.createElement("div");
        seg.className = "vc-seg";
        seg.style.flex = Math.max(0.001, (end - start) / dur) + " 0 0";
        seg.innerHTML =
          '<span class="vc-fill"></span>' +
          '<span class="vc-seg-label">' + ch.label + "</span>";
        seg.addEventListener("click", (e) => {
          const r = seg.getBoundingClientRect();
          const frac = Math.min(1, Math.max(0, (e.clientX - r.left) / r.width));
          try { mainVideo.currentTime = start + frac * (end - start) + 0.001; } catch (x) {}
          mainVideo.play().catch(() => {});
        });
        vcBar.appendChild(seg);
        segs.push({ fill: seg.querySelector(".vc-fill"), seg, start, end });
      });
    };

    const update = () => {
      const cur = mainVideo.currentTime;
      segs.forEach((s) => {
        let f = 0;
        if (cur >= s.end) f = 100;
        else if (cur > s.start) f = ((cur - s.start) / (s.end - s.start)) * 100;
        s.fill.style.width = f + "%";
        s.seg.classList.toggle("on", cur >= s.start && cur < s.end);
      });
      if (vcTime) vcTime.textContent = fmt(cur) + " / " + fmt(mainVideo.duration);
    };

    mainVideo.addEventListener("loadedmetadata", () => { buildBar(); update(); });
    mainVideo.addEventListener("timeupdate", update);
    mainVideo.addEventListener("seeked", update);
    if (mainVideo.readyState >= 1) { buildBar(); update(); }

    // حالة التشغيل
    const setPlaying = (p) => { if (videoFrame) videoFrame.classList.toggle("playing", p); };
    mainVideo.addEventListener("play", () => { if (videoPlay) videoPlay.classList.add("hidden"); setPlaying(true); });
    mainVideo.addEventListener("pause", () => setPlaying(false));
    mainVideo.addEventListener("ended", () => { if (videoPlay) videoPlay.classList.remove("hidden"); setPlaying(false); });

    const toggle = () => { mainVideo.paused ? mainVideo.play() : mainVideo.pause(); };
    if (vcPlay) vcPlay.addEventListener("click", toggle);
    mainVideo.addEventListener("click", toggle);

    if (vcFull) vcFull.addEventListener("click", () => {
      const el = videoFrame || mainVideo;
      if (document.fullscreenElement) document.exitFullscreen();
      else if (el.requestFullscreen) el.requestFullscreen();
      else if (mainVideo.webkitEnterFullscreen) mainVideo.webkitEnterFullscreen(); // iOS
    });

    // تحميل الفيديو/الغلاف/الفصول من لوحة التحكّم (إن وُجدت)
    if (sbReady) {
      fetch(`${SUPABASE_URL}/rest/v1/site_content?key=eq.video&select=value`, { headers: sbHeaders() })
        .then((r) => (r.ok ? r.json() : []))
        .then((rows) => {
          const v = rows && rows[0] && rows[0].value;
          if (!v) return;
          if (Array.isArray(v.chapters) && v.chapters.length) CHAPTERS = v.chapters;
          if (v.poster) mainVideo.poster = v.poster;
          if (v.url) { mainVideo.pause(); mainVideo.src = v.url; mainVideo.load(); }
          if (mainVideo.readyState >= 1) { buildBar(); update(); }
        })
        .catch(() => {});
    }
  }

  // ---- إثبات بصري من لوحة التحكّم: قنوات + نماذج شغل ----
  const channelsRow = document.getElementById("channelsRow");
  const worksGrid = document.getElementById("worksGrid");
  const renderChannels = (list) => {
    if (!channelsRow || !list.length) return;
    channelsRow.innerHTML = list.map((c) =>
      `<div class="channel"><img src="${c.url}" alt="${esc(c.title || "")}" loading="lazy" />` +
      (c.title ? `<span>${esc(c.title)}</span>` : "") + `</div>`).join("");
    const blk = document.getElementById("proofChannels"); if (blk) blk.hidden = false;
  };
  const renderWorks = (list) => {
    if (!worksGrid || !list.length) return;
    worksGrid.innerHTML = "";
    list.forEach((w) => {
      const isVid = /\.(mp4|webm|mov)$/i.test(w.url);
      const d = document.createElement("div");
      d.className = "work";
      d.innerHTML =
        (isVid
          ? `<video src="${w.url}" muted loop playsinline preload="metadata"></video>`
          : `<img src="${w.url}" alt="" loading="lazy" />`) +
        (w.meta ? `<span class="work-views">▶ ${esc(w.meta)}</span>` : "");
      if (isVid) {
        const v = d.querySelector("video");
        d.addEventListener("mouseenter", () => v.play().catch(() => {}));
        d.addEventListener("mouseleave", () => { v.pause(); v.currentTime = 0; });
      }
      worksGrid.appendChild(d);
    });
    const blk = document.getElementById("proofWorks"); if (blk) blk.hidden = false;
  };
  if (sbReady) {
    fetch(`${SUPABASE_URL}/rest/v1/media?select=kind,url,title,meta,sort&order=sort.asc,created_at.asc`,
      { headers: sbHeaders() })
      .then((r) => (r.ok ? r.json() : []))
      .then((rows) => {
        if (!Array.isArray(rows)) return;
        renderChannels(rows.filter((m) => m.kind === "channel"));
        renderWorks(rows.filter((m) => m.kind === "work"));
      })
      .catch(() => {});
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

// ===== Scroll Reveal Animations =====
(function() {
  const reveals = document.querySelectorAll('.reveal, .reveal-left, .reveal-right, .reveal-scale');

  if (!reveals.length) return;

  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('visible');
      }
    });
  }, {
    threshold: 0.15,
    rootMargin: '0px 0px -50px 0px'
  });

  reveals.forEach(el => observer.observe(el));
})();

// ===== تأثير الإضاءة للكروت =====
(function() {
  if (window.matchMedia('(pointer: coarse)').matches) return;

  const cards = document.querySelectorAll('.stage');

  cards.forEach(card => {
    card.addEventListener('mousemove', (e) => {
      const rect = card.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      card.style.setProperty('--glow-x', x + 'px');
      card.style.setProperty('--glow-y', y + 'px');
    });
  });
})();

// ===== الماوس التفاعلي =====
(function() {
  if (window.matchMedia('(pointer: coarse)').matches) return;

  const cursor = document.getElementById('customCursor');
  const dot = document.getElementById('cursorDot');
  if (!cursor || !dot) return;

  let mouseX = 0, mouseY = 0, cursorX = 0, cursorY = 0;

  document.addEventListener('mousemove', (e) => {
    mouseX = e.clientX;
    mouseY = e.clientY;
    dot.style.left = mouseX + 'px';
    dot.style.top = mouseY + 'px';
  });

  function animateCursor() {
    cursorX += (mouseX - cursorX) * 0.12;
    cursorY += (mouseY - cursorY) * 0.12;
    cursor.style.left = cursorX + 'px';
    cursor.style.top = cursorY + 'px';
    requestAnimationFrame(animateCursor);
  }
  animateCursor();

  const hoverElements = document.querySelectorAll('a, button, .btn, .stage, .course-card, .review, details summary, .video-play, input, textarea');
  hoverElements.forEach(el => {
    el.addEventListener('mouseenter', () => cursor.classList.add('hover'));
    el.addEventListener('mouseleave', () => cursor.classList.remove('hover'));
  });

  document.addEventListener('mousedown', () => cursor.classList.add('click'));
  document.addEventListener('mouseup', () => cursor.classList.remove('click'));
})();

// ===== FAQ Smooth Close Animation =====
(function() {
  const allDetails = document.querySelectorAll('.faq details');

  allDetails.forEach(details => {
    const summary = details.querySelector('summary');
    const answer = details.querySelector('.faq-answer');

    summary.addEventListener('click', (e) => {
      if (details.open) {
        e.preventDefault();
        details.classList.add('closing');

        setTimeout(() => {
          details.open = false;
          details.classList.remove('closing');
        }, 300);
      }
    });
  });
})();
