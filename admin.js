// ثَمين — لوحة التحكّم (اتصال REST مباشر، بدون مكتبات خارجية)
const SUPABASE_URL = "https://hwzpjxxfdqsjymxbjokv.supabase.co";
const SUPABASE_KEY = "sb_publishable_mcKOUcVtNy5BkLEd5UcRDA_foJbp3YK";
let TOKEN = null;

const $ = (id) => document.getElementById(id);
const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const setMsg = (el, text, ok) => { el.textContent = text; el.className = "msg " + (ok ? "ok" : "err"); };

// fetch بمهلة (ما يعلّق أبدًا)
function fetchT(url, opts = {}, ms = 15000) {
  const ctrl = new AbortController();
  const id = setTimeout(() => ctrl.abort(), ms);
  return fetch(url, { ...opts, signal: ctrl.signal }).finally(() => clearTimeout(id));
}
const authHeaders = (extra) => Object.assign(
  { apikey: SUPABASE_KEY, Authorization: "Bearer " + (TOKEN || SUPABASE_KEY) }, extra || {});

async function dbGet(path) {
  const r = await fetchT(`${SUPABASE_URL}/rest/v1/${path}`, { headers: authHeaders() });
  if (!r.ok) { if (r.status === 401) logout(); throw new Error(await r.text()); }
  return r.json();
}
async function dbSend(method, path, body, prefer) {
  const r = await fetchT(`${SUPABASE_URL}/rest/v1/${path}`, {
    method, headers: authHeaders({ "Content-Type": "application/json", Prefer: prefer || "return=representation" }),
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!r.ok) { if (r.status === 401) logout(); throw new Error(await r.text()); }
  return r.status === 204 ? null : r.json().catch(() => null);
}

// رفع ملف للتخزين وإرجاع الرابط العام
async function uploadFile(file) {
  const ext = (file.name.split(".").pop() || "bin").toLowerCase();
  const path = `${crypto.randomUUID()}.${ext}`;
  const r = await fetchT(`${SUPABASE_URL}/storage/v1/object/media/${path}`, {
    method: "POST",
    headers: { apikey: SUPABASE_KEY, Authorization: "Bearer " + TOKEN, "x-upsert": "true", "Content-Type": file.type || "application/octet-stream" },
    body: file,
  }, 180000);
  if (!r.ok) throw new Error(await r.text());
  return `${SUPABASE_URL}/storage/v1/object/public/media/${path}`;
}

// ====== المصادقة ======
const loginView = $("loginView"), dashView = $("dashView");
function showDash(on) { loginView.hidden = on; dashView.hidden = !on; if (on) loadAll(); }
function logout() {
  TOKEN = null;
  showDash(false);
}

$("loginForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const btn = $("loginBtn"); btn.disabled = true;
  setMsg($("loginMsg"), "جارٍ الدخول…", true);
  try {
    const r = await fetchT(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
      method: "POST",
      headers: { apikey: SUPABASE_KEY, "Content-Type": "application/json" },
      body: JSON.stringify({ email: $("email").value.trim(), password: $("password").value }),
    });
    const data = await r.json();
    if (!r.ok) {
      const m = data.msg || data.error_description || data.error || "بيانات غير صحيحة";
      setMsg($("loginMsg"), "فشل الدخول: " + m, false); btn.disabled = false; return;
    }
    TOKEN = data.access_token;            // في الذاكرة فقط — يضيع عند الإغلاق/التحديث
    setMsg($("loginMsg"), "", true);
    showDash(true);
  } catch (err) {
    setMsg($("loginMsg"), "خطأ بالاتصال: " + (err && err.message ? err.message : err), false);
    btn.disabled = false;
  }
});

$("logoutBtn").addEventListener("click", logout);

// لا حفظ للجلسة — يطلب كلمة السر كل مرة (أقصى حماية)
(function noPersist() {
  try { localStorage.removeItem("thameen_admin_token"); localStorage.removeItem("thameen_admin_exp"); } catch (_) {}
  showDash(false);
})();

// ====== التبويبات ======
document.querySelectorAll(".tab").forEach((t) => {
  t.addEventListener("click", () => {
    document.querySelectorAll(".tab").forEach((x) => x.classList.remove("on"));
    document.querySelectorAll(".panel").forEach((p) => { p.classList.remove("on"); p.hidden = true; });
    t.classList.add("on");
    const p = $("tab-" + t.dataset.tab); p.classList.add("on"); p.hidden = false;
  });
});

function loadAll() { loadComments(); loadVideo(); loadMedia("channel"); loadMedia("work"); loadCourses(); }

// ====== التعليقات ======
async function loadComments() {
  const rows = $("commentsRows");
  rows.innerHTML = '<p class="hint">جارٍ التحميل…</p>';
  try {
    const data = await dbGet("reviews?select=*&order=created_at.desc");
    $("commentsCount").textContent = (data?.length || 0) + " تعليق";
    if (!data || !data.length) { rows.innerHTML = '<p class="empty">لا توجد تعليقات بعد.</p>'; return; }
    rows.innerHTML = data.map((r) => {
      const n = Math.max(1, Math.min(5, r.stars || 5));
      return `<div class="crow ${r.hidden ? "hidden-row" : ""}" data-id="${r.id}">
        <div class="c-main">
          <div class="c-stars">${"★".repeat(n)}</div>
          <div class="c-name">${esc(r.name)}</div>
          <div class="c-text">${esc(r.comment)}</div>
        </div>
        <div class="c-actions">
          <button class="btn btn-ghost btn-sm act-hide">${r.hidden ? "إظهار" : "إخفاء"}</button>
          <button class="btn btn-danger btn-sm act-del">حذف</button>
        </div>
      </div>`;
    }).join("");
    rows.querySelectorAll(".crow").forEach((row) => {
      const id = row.dataset.id;
      row.querySelector(".act-hide").addEventListener("click", async (e) => {
        const hide = e.target.textContent === "إخفاء";
        e.target.disabled = true;
        try { await dbSend("PATCH", `reviews?id=eq.${id}`, { hidden: hide }); loadComments(); }
        catch (x) { e.target.disabled = false; alert("خطأ: " + x.message); }
      });
      row.querySelector(".act-del").addEventListener("click", async () => {
        if (!confirm("حذف هذا التعليق نهائيًا؟")) return;
        try { await dbSend("DELETE", `reviews?id=eq.${id}`); loadComments(); }
        catch (x) { alert("خطأ: " + x.message); }
      });
    });
  } catch (x) { rows.innerHTML = `<p class="empty">خطأ: ${esc(x.message)}</p>`; }
}

// ====== الفيديو ======
async function getContent(key) {
  const rows = await dbGet(`site_content?key=eq.${key}&select=value`);
  return rows && rows[0] ? rows[0].value : null;
}
async function setContent(key, value) {
  return dbSend("POST", "site_content?on_conflict=key",
    { key, value, updated_at: new Date().toISOString() },
    "resolution=merge-duplicates,return=minimal");
}

let videoVal = {};
async function loadVideo() {
  try { videoVal = (await getContent("video")) || {}; } catch (_) { videoVal = {}; }
  if (videoVal.url) { $("videoPreview").src = videoVal.url; $("videoUrlNow").textContent = videoVal.url; }
  else $("videoUrlNow").textContent = "يُستخدم الفيديو الافتراضي بالموقع.";
  if (videoVal.poster) { $("posterPreview").src = videoVal.poster; $("posterPreview").hidden = false; }
  renderChapters(videoVal.chapters || [{ t: 0, label: "الانترو" }]);
}

$("saveVideoBtn").addEventListener("click", async () => {
  const btn = $("saveVideoBtn"), msg = $("videoMsg"); btn.disabled = true;
  try {
    let url = $("videoUrl").value.trim();
    const file = $("videoFile").files[0];
    if (file) { setMsg(msg, "جارٍ رفع الفيديو… قد ياخذ وقت", true); url = await uploadFile(file); }
    if (!url) { setMsg(msg, "اختر ملف أو الصق رابط.", false); btn.disabled = false; return; }
    videoVal.url = url;
    await setContent("video", videoVal);
    setMsg(msg, "تم حفظ الفيديو ✅", true); loadVideo();
  } catch (e) { setMsg(msg, "خطأ: " + e.message, false); }
  btn.disabled = false;
});

$("savePosterBtn").addEventListener("click", async () => {
  const btn = $("savePosterBtn"), msg = $("posterMsg"); btn.disabled = true;
  try {
    const file = $("posterFile").files[0];
    if (!file) { setMsg(msg, "اختر صورة غلاف.", false); btn.disabled = false; return; }
    setMsg(msg, "جارٍ الرفع…", true);
    videoVal.poster = await uploadFile(file);
    await setContent("video", videoVal);
    setMsg(msg, "تم حفظ الغلاف ✅", true); loadVideo();
  } catch (e) { setMsg(msg, "خطأ: " + e.message, false); }
  btn.disabled = false;
});

$("delPosterBtn").addEventListener("click", async () => {
  const msg = $("posterMsg");
  if (!confirm("حذف صورة الغلاف؟")) return;
  try {
    videoVal.poster = null;
    await setContent("video", videoVal);
    $("posterPreview").hidden = true; $("posterPreview").src = "";
    setMsg(msg, "تم حذف الغلاف ✅", true);
  } catch (e) { setMsg(msg, "خطأ: " + e.message, false); }
});

// الفصول
function renderChapters(chs) { $("chaptersRows").innerHTML = ""; chs.forEach((ch) => addChapterRow(ch.label, ch.t)); }
function addChapterRow(label = "", t = 0) {
  const div = document.createElement("div");
  div.className = "chapter-row";
  div.innerHTML = `<input class="fld ch-l" placeholder="اسم الفصل" value="${esc(label)}" />
    <input class="fld ch-t" type="number" min="0" placeholder="ثانية" value="${t}" />
    <button class="x" title="حذف">✕</button>`;
  div.querySelector(".x").addEventListener("click", () => div.remove());
  $("chaptersRows").appendChild(div);
}
$("addChapterBtn").addEventListener("click", () => addChapterRow());
$("saveChaptersBtn").addEventListener("click", async () => {
  const msg = $("chaptersMsg");
  const chapters = [...document.querySelectorAll(".chapter-row")].map((r) => ({
    label: r.querySelector(".ch-l").value.trim(),
    t: parseFloat(r.querySelector(".ch-t").value) || 0,
  })).filter((c) => c.label).sort((a, b) => a.t - b.t);
  videoVal.chapters = chapters;
  try { await setContent("video", videoVal); setMsg(msg, "تم حفظ الفصول ✅", true); }
  catch (e) { setMsg(msg, "خطأ: " + e.message, false); }
});

// ====== الصور (قنوات + نماذج شغل) ======
async function loadMedia(kind) {
  const grid = kind === "channel" ? $("channelsGrid") : $("worksGrid");
  grid.innerHTML = '<p class="hint">جارٍ التحميل…</p>';
  try {
    const data = await dbGet(`media?kind=eq.${kind}&select=*&order=sort.asc,created_at.asc`);
    if (!data || !data.length) { grid.innerHTML = `<p class="empty">لا توجد عناصر بعد.</p>`; return; }
    grid.innerHTML = data.map((m) => {
      const isVid = /\.(mp4|webm|mov)$/i.test(m.url);
      const media = isVid ? `<video src="${esc(m.url)}" muted></video>` : `<img src="${esc(m.url)}" alt="" />`;
      const cap = kind === "channel" ? (m.title || "") : (m.meta ? "▶ " + m.meta : "");
      return `<div class="media-item ${kind === "work" ? "work-item" : ""}" data-id="${m.id}">
        ${media}${cap ? `<span class="cap">${esc(cap)}</span>` : ""}
        <button class="del" title="حذف">✕</button></div>`;
    }).join("");
    grid.querySelectorAll(".media-item").forEach((it) => {
      it.querySelector(".del").addEventListener("click", async () => {
        if (!confirm("حذف هذا العنصر؟")) return;
        try { await dbSend("DELETE", `media?id=eq.${it.dataset.id}`); loadMedia(kind); }
        catch (x) { alert("خطأ: " + x.message); }
      });
    });
  } catch (x) { grid.innerHTML = `<p class="empty">خطأ: ${esc(x.message)}</p>`; }
}

async function addMedia(kind, fileInput, titleVal, metaVal, msgEl, titleInput, metaInput) {
  const file = fileInput.files[0];
  if (!file) { setMsg(msgEl, "اختر ملف أول.", false); return; }
  setMsg(msgEl, "جارٍ الرفع…", true);
  try {
    const url = await uploadFile(file);
    await dbSend("POST", "media", { kind, url, title: titleVal || null, meta: metaVal || null }, "return=minimal");
    setMsg(msgEl, "تمت الإضافة ✅", true);
    fileInput.value = ""; if (titleInput) titleInput.value = ""; if (metaInput) metaInput.value = "";
    loadMedia(kind);
  } catch (e) { setMsg(msgEl, "خطأ: " + e.message, false); }
}

$("addChannelBtn").addEventListener("click", () =>
  addMedia("channel", $("channelFile"), $("channelTitle").value.trim(), null, $("channelMsg"), $("channelTitle"), null));
$("addWorkBtn").addEventListener("click", () =>
  addMedia("work", $("workFile"), null, $("workMeta").value.trim(), $("workMsg"), null, $("workMeta")));

// ====== الدورات (أقسام + دروس) ======
function parseEmbed(s) {
  s = (s || "").trim();
  const m = s.match(/src=["']([^"']+)["']/i);
  return m ? m[1] : s; // لو لصق iframe كامل ناخذ src، وإلا الرابط نفسه
}
function parseChapters(text) {
  return (text || "").split("\n").map((l) => l.trim()).filter(Boolean).map((line) => {
    const m = line.match(/^(?:(\d+):)?(\d{1,2}(?:\.\d+)?)\s+(.+)$/); // «M:SS عنوان» أو «SS عنوان»
    if (!m) return null;
    const t = m[1] ? (+m[1]) * 60 + parseFloat(m[2]) : parseFloat(m[2]);
    return { t, label: m[3].trim() };
  }).filter(Boolean).sort((a, b) => a.t - b.t);
}

async function loadCourses() {
  const wrap = $("sectionsList");
  if (!wrap) return;
  wrap.innerHTML = '<p class="hint">جارٍ التحميل…</p>';
  try {
    const sections = await dbGet("sections?select=*&order=sort.asc,created_at.asc");
    const lessons = await dbGet("lessons?select=*&order=sort.asc,created_at.asc");
    if (!sections.length) { wrap.innerHTML = '<p class="empty">لا توجد أقسام بعد. أضف قسمًا من فوق.</p>'; return; }
    wrap.innerHTML = sections.map((sec) => {
      const ls = lessons.filter((l) => l.section_id === sec.id);
      return `<div class="card sec-card" data-sid="${sec.id}">
        <div class="sec-head"><h3>${esc(sec.title)}</h3><button class="btn btn-danger btn-sm sec-del">حذف القسم</button></div>
        <div class="lessons">${ls.map((l) => `<div class="lesson-row" data-lid="${l.id}">
          ${l.thumb_url ? `<img src="${esc(l.thumb_url)}" class="lesson-thumb" alt="">` : `<div class="lesson-thumb empty-thumb">🎬</div>`}
          <div class="lesson-info"><b>${esc(l.title)}</b><small>${(l.chapters || []).length} فصل · ${l.embed_url ? "فيديو ✔" : "بلا فيديو"}</small></div>
          <button class="btn btn-danger btn-sm lesson-del">حذف</button></div>`).join("") || '<p class="hint">لا دروس بعد.</p>'}</div>
        <details class="add-lesson">
          <summary>＋ إضافة درس</summary>
          <input type="text" class="fld l-title" placeholder="عنوان الدرس" />
          <input type="text" class="fld l-embed" placeholder="رابط Bunny (iframe embed) أو الصق كود iframe" />
          <label class="lbl">صورة مصغّرة (ثَمنيل)</label>
          <input type="file" class="fld l-thumb" accept="image/*" />
          <label class="lbl">الفصول — سطر لكل فصل: «1:30 عنوان الفصل»</label>
          <textarea class="fld l-chapters" rows="3" placeholder="0:00 المقدمة
1:30 الجزء الأول"></textarea>
          <button class="btn btn-primary btn-sm l-add">حفظ الدرس</button>
          <p class="msg l-msg"></p>
        </details></div>`;
    }).join("");

    wrap.querySelectorAll(".sec-card").forEach((card) => {
      const sid = card.dataset.sid;
      card.querySelector(".sec-del").addEventListener("click", async () => {
        if (!confirm("حذف القسم وكل دروسه؟")) return;
        try { await dbSend("DELETE", `sections?id=eq.${sid}`); loadCourses(); } catch (x) { alert("خطأ: " + x.message); }
      });
      card.querySelectorAll(".lesson-row").forEach((row) => {
        row.querySelector(".lesson-del").addEventListener("click", async () => {
          if (!confirm("حذف الدرس؟")) return;
          try { await dbSend("DELETE", `lessons?id=eq.${row.dataset.lid}`); loadCourses(); } catch (x) { alert("خطأ: " + x.message); }
        });
      });
      const addBtn = card.querySelector(".l-add");
      addBtn.addEventListener("click", async () => {
        const msg = card.querySelector(".l-msg");
        const title = card.querySelector(".l-title").value.trim();
        if (!title) { setMsg(msg, "اكتب عنوان الدرس.", false); return; }
        const embed = parseEmbed(card.querySelector(".l-embed").value);
        const chapters = parseChapters(card.querySelector(".l-chapters").value);
        const file = card.querySelector(".l-thumb").files[0];
        addBtn.disabled = true; setMsg(msg, "جارٍ الحفظ…", true);
        try {
          let thumb = null;
          if (file) thumb = await uploadFile(file);
          await dbSend("POST", "lessons", { section_id: sid, title, embed_url: embed || null, thumb_url: thumb, chapters }, "return=minimal");
          loadCourses();
        } catch (x) { setMsg(msg, "خطأ: " + x.message, false); addBtn.disabled = false; }
      });
    });
  } catch (x) { wrap.innerHTML = `<p class="empty">خطأ: ${esc(x.message)}</p>`; }
}

$("bulkBtn").addEventListener("click", async () => {
  const msg = $("bulkMsg");
  const lines = $("bulkBox").value.split("\n").map((l) => l.trim()).filter(Boolean);
  if (!lines.length) { setMsg(msg, "الصق الدروس أول.", false); return; }
  const btn = $("bulkBtn"); btn.disabled = true; setMsg(msg, "جارٍ الاستيراد…", true);
  try {
    let sections = await dbGet("sections?select=id,title");
    const findOrCreate = async (name) => {
      let s = sections.find((x) => x.title === name);
      if (s) return s.id;
      const created = await dbSend("POST", "sections", { title: name, sort: sections.length }, "return=representation");
      const id = created[0].id; sections.push({ id, title: name }); return id;
    };
    let count = 0;
    for (const line of lines) {
      const parts = line.split("|").map((p) => p.trim());
      if (parts.length < 3) continue;
      const sid = await findOrCreate(parts[0]);
      await dbSend("POST", "lessons", { section_id: sid, title: parts[1], embed_url: parseEmbed(parts[2]), description: parts[3] || null, sort: count }, "return=minimal");
      count++;
    }
    setMsg(msg, `تم استيراد ${count} درس ✅`, true);
    $("bulkBox").value = ""; loadCourses();
  } catch (e) { setMsg(msg, "خطأ: " + e.message, false); }
  btn.disabled = false;
});

$("addSectionBtn").addEventListener("click", async () => {
  const msg = $("sectionMsg");
  const title = $("newSectionTitle").value.trim();
  if (!title) { setMsg(msg, "اكتب اسم القسم.", false); return; }
  try {
    const n = await dbGet("sections?select=sort&order=sort.desc&limit=1");
    const sort = n && n[0] ? (n[0].sort || 0) + 1 : 0;
    await dbSend("POST", "sections", { title, sort }, "return=minimal");
    $("newSectionTitle").value = ""; setMsg(msg, "تمت الإضافة ✅", true); loadCourses();
  } catch (x) { setMsg(msg, "خطأ: " + x.message, false); }
});
