// ثَمين — أكاديمية المشتركين (REST مباشر)
const SUPABASE_URL = "https://hwzpjxxfdqsjymxbjokv.supabase.co";
const SUPABASE_KEY = "sb_publishable_mcKOUcVtNy5BkLEd5UcRDA_foJbp3YK";
let TOKEN = null, USER = null, AVATARS = {};

// روابط التواصل بالفوتر (عدّلها هنا) — معرّفة بالأعلى لتفادي مشكلة الترتيب
const SOCIALS = [
  { n: "📷 إنستقرام", u: "https://www.instagram.com/thameen.j/" },
  { n: "▶️ يوتيوب", u: "https://www.youtube.com/channel/UCMeR85JgB5jXCZTQy1C69pA" },
];

const $ = (id) => document.getElementById(id);
const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const setMsg = (el, t, ok) => { el.textContent = t; el.className = "msg " + (ok ? "ok" : "err"); };
const linkify = (t) => esc(t || "").replace(/(https?:\/\/[^\s]+)/g, '<a href="$1" target="_blank" rel="noopener">$1</a>').replace(/\n/g, "<br>");

function fetchT(url, opts = {}, ms = 15000) {
  const c = new AbortController(); const id = setTimeout(() => c.abort(), ms);
  return fetch(url, { ...opts, signal: c.signal }).finally(() => clearTimeout(id));
}
const authHeaders = (extra) => Object.assign({ apikey: SUPABASE_KEY, Authorization: "Bearer " + (TOKEN || SUPABASE_KEY) }, extra || {});
async function dbGet(path) {
  const r = await fetchT(`${SUPABASE_URL}/rest/v1/${path}`, { headers: authHeaders() });
  if (!r.ok) { if (r.status === 401) logout(); throw new Error(await r.text()); }
  return r.json();
}
async function dbSend(method, path, body, prefer) {
  const r = await fetchT(`${SUPABASE_URL}/rest/v1/${path}`, {
    method, headers: authHeaders({ "Content-Type": "application/json", Prefer: prefer || "return=minimal" }),
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!r.ok) { if (r.status === 401) logout(); throw new Error(await r.text()); }
  return r.status === 204 ? null : r.json().catch(() => null);
}

// ====== المصادقة (مع حفظ جلسة للمشترك) ======
const loginView = $("loginView"), appView = $("appView");
function showApp(on) { loginView.hidden = on; appView.hidden = !on; if (on) loadAcademy(); }
function saveSession(d) {
  TOKEN = d.access_token; USER = d.user;
  localStorage.setItem("thameen_acad", JSON.stringify({
    at: d.access_token, rt: d.refresh_token, exp: Date.now() + (d.expires_in || 3600) * 1000, user: d.user,
  }));
}
function logout() { TOKEN = null; USER = null; localStorage.removeItem("thameen_acad"); showApp(false); }

$("loginForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const btn = $("loginBtn"); btn.disabled = true; setMsg($("loginMsg"), "جارٍ الدخول…", true);
  try {
    const r = await fetchT(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
      method: "POST", headers: { apikey: SUPABASE_KEY, "Content-Type": "application/json" },
      body: JSON.stringify({ email: $("email").value.trim(), password: $("password").value }),
    });
    const d = await r.json();
    if (!r.ok) { setMsg($("loginMsg"), "فشل الدخول: " + (d.msg || d.error_description || d.error || ""), false); btn.disabled = false; return; }
    saveSession(d); setMsg($("loginMsg"), "", true); showApp(true);
  } catch (err) { setMsg($("loginMsg"), "خطأ: " + (err.message || err), false); btn.disabled = false; }
});
$("logoutBtn").addEventListener("click", logout);

async function refresh(rt) {
  try {
    const r = await fetchT(`${SUPABASE_URL}/auth/v1/token?grant_type=refresh_token`, {
      method: "POST", headers: { apikey: SUPABASE_KEY, "Content-Type": "application/json" },
      body: JSON.stringify({ refresh_token: rt }),
    });
    if (!r.ok) return false;
    saveSession(await r.json()); return true;
  } catch (_) { return false; }
}
(async function restore() {
  let s; try { s = JSON.parse(localStorage.getItem("thameen_acad") || "null"); } catch (_) { s = null; }
  if (!s) { showApp(false); return; }
  if (s.exp > Date.now() + 60000) { TOKEN = s.at; USER = s.user; showApp(true); }
  else if (s.rt && await refresh(s.rt)) { showApp(true); }
  else { showApp(false); }
})();

// ====== الفوتر: روابط التواصل ======
function renderSocials() {
  const el = $("footSocials"); if (!el) return;
  el.innerHTML = SOCIALS.map((s) => `<a href="${s.u}"${s.u !== "#" ? ' target="_blank" rel="noopener"' : ""}>${s.n}</a>`).join("");
}

// ====== تحميل المنصّة ======
let SECTIONS = [], LESSONS = [], DONE = new Set(), CURSEC = null, CURLESSON = null;
let PCT = {}, lastSaved = {}, MEMBER = null;
async function loadAcademy() {
  $("meName").textContent = (USER && (USER.user_metadata?.name || USER.email)) || "";
  renderSocials();
  loadAvatars();
  const wrap = $("coursesCol");
  try {
    const sections = await dbGet("sections?select=*&order=sort.asc,created_at.asc");
    const lessons = await dbGet("lessons?select=*&order=sort.asc,created_at.asc");
    let progress = [], members = [];
    try { progress = await dbGet("progress?select=lesson_id,percent,completed"); }
    catch (_) { try { progress = await dbGet("progress?select=lesson_id,completed"); } catch (_) {} }
    try { members = await dbGet("members?select=calls_total,calls_used,created_at"); }
    catch (_) { try { members = await dbGet("members?select=calls_total,calls_used"); } catch (_) {} }
    SECTIONS = sections || []; LESSONS = lessons || [];
    PCT = {}; DONE = new Set();
    (progress || []).forEach((p) => { PCT[p.lesson_id] = p.percent != null ? p.percent : (p.completed ? 100 : 0); if (p.completed) DONE.add(p.lesson_id); });
    MEMBER = (members && members[0]) || null;
    const m = MEMBER;
    $("callsLeft").textContent = m ? Math.max(0, (m.calls_total || 3) - (m.calls_used || 0)) : 3;
    renderProgress();
    renderCourses();
    if (SECTIONS.length) {
      const firstSec = SECTIONS.find((s) => LESSONS.some((l) => l.section_id === s.id)) || SECTIONS[0];
      openCourse(firstSec.id);
    } else {
      const dbg = `توكن:${TOKEN ? "موجود ✓" : "مفقود ✗"} · أقسام:${SECTIONS.length} · دروس:${LESSONS.length}`;
      wrap.innerHTML = `<p class="hint" style="padding:14px">لا توجد دورات.<br><b style="color:#ffb84d">${dbg}</b></p>`;
      $("lTitle").textContent = "تشخيص v8 — " + dbg;
    }
  } catch (e) {
    wrap.innerHTML = `<p class="hint" style="padding:14px">خطأ التحميل:<br><b style="color:#ff8f8f">${esc(e.message)}</b></p>`;
    $("lTitle").textContent = "خطأ v8 — توكن:" + (TOKEN ? "موجود" : "مفقود");
  }
}

function renderProgress() {
  const total = LESSONS.length || 1;
  $("progPct").textContent = Math.round((DONE.size / total) * 100) + "%";
}

// ====== عمود دوراتي ======
function renderCourses() {
  const wrap = $("coursesCol");
  if (!SECTIONS.length) { wrap.innerHTML = '<p class="hint">لا دورات بعد.</p>'; return; }
  wrap.innerHTML = SECTIONS.map((sec) => {
    const ls = LESSONS.filter((l) => l.section_id === sec.id);
    const done = ls.filter((l) => DONE.has(l.id)).length;
    const pct = ls.length ? Math.round((done / ls.length) * 100) : 0;
    const full = ls.length && done === ls.length;
    const cover = sec.cover_url ? `<img src="${esc(sec.cover_url)}" alt="">` : `<span class="crs-ph">📚</span>`;
    return `<button class="crs-card ${sec.id === CURSEC ? "on" : ""}" data-sid="${sec.id}">
      <div class="crs-cover">${cover}${full ? '<span class="crs-badge full">✓</span>' : ""}</div>
      <div class="crs-info">
        <b>${esc(sec.title)}</b>
        <div class="crs-line">🎬 ${ls.length} درس · ${done}/${ls.length} مكتمل</div>
        <div class="crs-bar"><span style="width:${pct}%"></span></div>
      </div>
    </button>`;
  }).join("");
  wrap.querySelectorAll(".crs-card").forEach((b) => b.addEventListener("click", () => openCourse(b.dataset.sid)));
}

function openCourse(sid) {
  CURSEC = sid;
  renderCourses();
  const ls = LESSONS.filter((l) => l.section_id === sid);
  if (ls.length) { playLesson((ls.find((l) => !DONE.has(l.id)) || ls[0]).id); }
  else { CURLESSON = null; renderPlaylist([]); $("lTitle").textContent = "—"; $("playerHost").innerHTML = '<p class="hint" style="padding:30px;text-align:center">لا دروس في هذا القسم بعد.</p>'; $("lDesc").innerHTML = ""; }
}

function renderPlaylist(ls) {
  const wrap = $("plList");
  if (!wrap) return;
  wrap.innerHTML = ls.length ? ls.map((l, i) => `
    <button class="pl-item ${l.id === CURLESSON ? "on" : ""}" data-lid="${l.id}">
      <span class="pl-num ${DONE.has(l.id) ? "done" : ""}">${DONE.has(l.id) ? "✓" : i + 1}</span>
      <span class="pl-name">${esc(l.title)}</span>
    </button>`).join("") : '<p class="hint" style="padding:14px">لا دروس بعد.</p>';
  wrap.querySelectorAll(".pl-item").forEach((b) => b.addEventListener("click", () => playLesson(b.dataset.lid)));
}

function playLesson(id) {
  const l = LESSONS.find((x) => x.id === id); if (!l) return;
  CURLESSON = id;
  $("lTitle").textContent = l.title;
  const host = $("playerHost");
  host.innerHTML = l.embed_url
    ? `<iframe src="${esc(l.embed_url)}" loading="lazy" allow="autoplay; fullscreen; picture-in-picture" allowfullscreen></iframe>`
    : '<p class="hint" style="padding:30px;text-align:center">لا يوجد فيديو لهذا الدرس.</p>';
  const ifr = host.querySelector("iframe");
  if (ifr && window.playerjs) attachPlayer(ifr, id);
  $("lDesc").innerHTML = l.description ? `<h4>الروابط والمرفقات</h4><div class="desc-body">${linkify(l.description)}</div>` : "";
  updateWatchUI(id);
  renderPlaylist(LESSONS.filter((x) => x.section_id === CURSEC));
}

// تحديث شريط المشاهدة
function updateWatchUI(id) {
  const done = DONE.has(id);
  const pct = done ? 100 : (PCT[id] || 0);
  const fill = $("watchFill"), label = $("watchLabel");
  if (fill) { fill.style.width = pct + "%"; fill.classList.toggle("done", done); }
  if (label) {
    label.classList.toggle("done", done);
    label.textContent = done ? "✓ أكملت هذا الدرس" : `شاهدت ${Math.round(pct)}% · يكتمل تلقائيًا عند ٩٠٪`;
  }
}

// مشغّل Bunny عبر مكتبة player.js + عدّاد مشاهدة مضاد للتخطّي
function attachPlayer(ifr, id) {
  const player = new playerjs.Player(ifr);
  let lastT = null, watched = null, dur = 0;
  player.on("ready", () => {
    // كمّل من مكان ما وقف (لو فيه تقدّم محفوظ بين ١٪ و٩٠٪)
    const savedPct = PCT[id] || 0;
    if (savedPct > 1 && savedPct < 90) {
      try { player.getDuration((d) => { if (d > 0) player.setCurrentTime(Math.max(0, (savedPct / 100) * d - 2)); }); } catch (_) {}
    }
    player.on("timeupdate", (e) => {
      const t = (e && e.seconds) || 0;
      const d = (e && e.duration) || dur; dur = d;
      if (watched === null) watched = ((PCT[id] || 0) / 100) * (d || 0); // ابدأ من المحفوظ
      // احسب فقط المشاهدة الطبيعية (تقدّم ≤ ثانيتين) — السكِب ما ينحسب
      if (lastT !== null && t > lastT && (t - lastT) <= 2) watched += (t - lastT);
      lastT = t;
      if (d > 0) recordWatch(id, Math.min(100, (watched / d) * 100));
    });
    // ملاحظة: ما نعتمد على حدث "ended" — الإكمال فقط من الثواني المُشاهَدة فعليًا (يمنع السكِب للآخر)
  });
}

// تسجيل نسبة المشاهدة (تنمو فقط) + إكمال تلقائي عند ٩٠٪
async function recordWatch(id, pct) {
  pct = Math.round(pct);
  if (pct <= (PCT[id] || 0)) return;
  PCT[id] = pct;
  const completed = pct >= 90;
  const wasDone = DONE.has(id);
  if (completed && !wasDone) {
    DONE.add(id);
    renderProgress(); renderCourses();
    renderPlaylist(LESSONS.filter((x) => x.section_id === CURSEC));
  }
  if (id === CURLESSON) updateWatchUI(id);
  // حفظ مخفّف: كل +٥٪ أو عند الإكمال
  if (completed !== wasDone || pct - (lastSaved[id] || 0) >= 5) {
    lastSaved[id] = pct;
    const base = { user_id: USER.id, lesson_id: id, completed, updated_at: new Date().toISOString() };
    try {
      await dbSend("POST", "progress?on_conflict=user_id,lesson_id",
        { ...base, percent: pct }, "resolution=merge-duplicates,return=minimal");
    } catch (_) {
      // لو عمود percent مو موجود، احفظ الإكمال على الأقل
      try { await dbSend("POST", "progress?on_conflict=user_id,lesson_id", base, "resolution=merge-duplicates,return=minimal"); } catch (_) {}
    }
  }
}

// ====== المجتمع ======
let commTimer = null, CURCHAN = "general", commSearch = "", pendingFile = null, MSGS = [], lastSig = "";
const CHAN_INFO = {
  general: { t: "العام", d: "شارك، اسأل، وتفاعل مع باقي المتدربين" },
  achievements: { t: "الإنجازات", d: "اعرض شغلك وإنجازاتك وارفع فيديوهاتك 🚀" },
  jobs: { t: "فرص عمل", d: "فرص ومشاريع مونتاج — للجادّين ✦" },
};
const EMOJIS = "😀 😂 🤣 😊 😍 😎 🥳 🔥 👍 👏 🙏 💪 🎬 🎥 ✨ ⭐ 💯 ❤️ 🎉 ✅ 👀 🤔 😅 🥰 😱 💎 🚀 📈 🏆 🎯 👌 🤝 💡 ⚡ 🌟 😭 🙌 💥 🤩 😏".split(" ");

function myName() {
  if (USER && USER.user_metadata && USER.user_metadata.name) return USER.user_metadata.name;
  return USER && USER.email ? USER.email.split("@")[0] : "متدرب";
}
function avColor(s) { let h = 0; s = s || ""; for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) % 360; return `linear-gradient(135deg,hsl(${h},70%,55%),hsl(${(h + 40) % 360},65%,42%))`; }
function initialOf(n) { return (n || "؟").trim().charAt(0) || "؟"; }
// صورة البروفايل: img لو موجودة، وإلا أول حرف بخلفية ملوّنة
function avInner(uid, nm) { const u = AVATARS[uid]; return u ? `<img src="${esc(u)}" alt="" class="av-img" loading="lazy">` : esc(initialOf(nm)); }
function avStyle(uid, nm) { return AVATARS[uid] ? "" : `background:${avColor(uid || nm)}`; }
async function loadAvatars() {
  try { const ps = await dbGet("profiles?select=user_id,avatar_url&limit=500"); AVATARS = {}; (ps || []).forEach((p) => { if (p.avatar_url) AVATARS[p.user_id] = p.avatar_url; }); }
  catch (_) {}
}
function fmtTime(iso) { try { const d = new Date(iso); let h = d.getHours(); const ap = h < 12 ? "ص" : "م"; h = h % 12 || 12; return `${h}:${String(d.getMinutes()).padStart(2, "0")} ${ap}`; } catch (_) { return ""; } }

// رفع ملف للمجتمع
async function uploadCommFile(file) {
  const ext = (file.name.split(".").pop() || "bin").toLowerCase();
  const path = `community/${crypto.randomUUID()}.${ext}`;
  const r = await fetchT(`${SUPABASE_URL}/storage/v1/object/media/${path}`, {
    method: "POST",
    headers: { apikey: SUPABASE_KEY, Authorization: "Bearer " + TOKEN, "x-upsert": "true", "Content-Type": file.type || "application/octet-stream" },
    body: file,
  }, 180000);
  if (!r.ok) throw new Error(await r.text());
  return `${SUPABASE_URL}/storage/v1/object/public/media/${path}`;
}

async function registerProfile() {
  if (!USER) return;
  try { await dbSend("POST", "profiles?on_conflict=user_id", { user_id: USER.id, name: myName() }, "resolution=merge-duplicates,return=minimal"); } catch (_) {}
}
async function loadMembers() {
  const el = $("memList"); if (!el) return;
  let ps; try { ps = await dbGet("profiles?select=user_id,name,avatar_url&order=created_at.asc&limit=300"); }
  catch (_) { try { ps = await dbGet("profiles?select=user_id,name&order=created_at.asc&limit=300"); } catch (_) { return; } }
  ps.forEach((p) => { if (p.avatar_url) AVATARS[p.user_id] = p.avatar_url; });
  const c = $("memCount"); if (c) c.textContent = `(${ps.length})`;
  el.innerHTML = ps.map((p) => `<div class="mem"><div class="mem-av" style="${avStyle(p.user_id, p.name)}">${avInner(p.user_id, p.name)}</div><span class="mem-name">${esc(p.name || "متدرب")}</span></div>`).join("");
}

// تضمين الروابط داخل الرسالة (يوتيوب/إنستقرام/تيك توك/فيديو مباشر)
function embedFor(text) {
  if (!text) return "";
  const url = (text.match(/https?:\/\/[^\s]+/) || [])[0];
  if (!url) return "";
  let m = url.match(/(?:youtube\.com\/(?:watch\?v=|shorts\/)|youtu\.be\/)([\w-]{11})/);
  if (m) return `<div class="embed16"><iframe src="https://www.youtube.com/embed/${m[1]}" allow="encrypted-media;picture-in-picture;fullscreen" allowfullscreen loading="lazy"></iframe></div>`;
  m = url.match(/instagram\.com\/(reel|p|tv)\/([\w-]+)/);
  if (m) return `<div class="embed-ig"><iframe src="https://www.instagram.com/${m[1]}/${m[2]}/embed" loading="lazy" scrolling="no"></iframe></div>`;
  m = url.match(/tiktok\.com\/.*\/video\/(\d+)/);
  if (m) return `<div class="embed-tt"><iframe src="https://www.tiktok.com/embed/v2/${m[1]}" loading="lazy" allowfullscreen></iframe></div>`;
  if (/\.(mp4|webm|mov)(\?|$)/i.test(url)) return `<video src="${esc(url)}" controls preload="metadata"></video>`;
  return "";
}
function renderMessages(forceScroll) {
  const box = $("commMessages"); if (!box) return;
  let list = MSGS;
  if (commSearch) { const q = commSearch.toLowerCase(); list = list.filter((m) => (m.text || "").toLowerCase().includes(q) || (m.name || "").toLowerCase().includes(q)); }
  if (!list.length) { box.innerHTML = `<p class="comm-empty">${commSearch ? "لا نتائج للبحث" : "لا رسائل بعد — كن أول من يبدأ 👋"}</p>`; return; }
  const isAdmin = USER && USER.email === "omarthamen@gmail.com";
  const atBottom = box.scrollHeight - box.scrollTop - box.clientHeight < 90;
  const fn = CURCHAN === "jobs" ? jobCard : CURCHAN === "achievements" ? achCard : bubbleHtml;
  box.innerHTML = list.map((m) => fn(m, isAdmin)).join("");
  if (isAdmin) box.querySelectorAll(".del-msg").forEach((b) => b.addEventListener("click", async (e) => {
    const el = e.target.closest("[data-id]"); if (!el) return;
    if (!confirm("حذف؟")) return;
    try { await dbSend("DELETE", `community_messages?id=eq.${el.dataset.id}`); loadMessages(false); } catch (_) {}
  }));
  if (forceScroll || atBottom) box.scrollTop = box.scrollHeight;
}
function mediaHtml(m) {
  if (!m.media_url) return "";
  return m.media_type === "video" ? `<video src="${esc(m.media_url)}" controls preload="metadata"></video>` : `<img src="${esc(m.media_url)}" alt="" loading="lazy">`;
}
function bubbleHtml(m, isAdmin) {
  const me = m.user_id === (USER && USER.id), nm = m.name || "متدرب";
  return `<div class="cmsg ${me ? "me" : ""}" data-id="${m.id}">
    <div class="cmsg-av" style="${avStyle(m.user_id, nm)}">${avInner(m.user_id, nm)}</div>
    <div class="cmsg-body">
      <div class="cmsg-meta"><span class="cmsg-name">${me ? "أنت" : esc(nm)}</span><span class="cmsg-time">${fmtTime(m.created_at)}</span>${isAdmin ? '<button class="del-msg" type="button">حذف</button>' : ""}</div>
      <div class="cmsg-bubble">${m.text ? linkify(m.text) : ""}${mediaHtml(m)}${embedFor(m.text)}</div>
    </div></div>`;
}
function achCard(m, isAdmin) {
  const nm = m.name || "متدرب";
  return `<div class="ach-card" data-id="${m.id}">${isAdmin ? '<button class="del-msg" type="button">حذف</button>' : ""}
    <div class="ach-head"><div class="ach-av" style="${avStyle(m.user_id, nm)}">${avInner(m.user_id, nm)}</div><div><b>${esc(nm)}</b><small>🏆 إنجاز · ${fmtTime(m.created_at)}</small></div></div>
    ${mediaHtml(m)}${embedFor(m.text)}
    ${m.text ? `<div class="ach-text">${linkify(m.text)}</div>` : ""}</div>`;
}
function normLink(s) { s = (s || "").trim(); if (!s) return ""; if (/^https?:\/\//i.test(s)) return s; if (/^\+?[\d\s-]{7,}$/.test(s)) return "https://wa.me/" + s.replace(/[^\d]/g, ""); return "https://" + s; }
function jobCard(m, isAdmin) {
  const nm = m.name || "متدرب", meta = m.meta || {};
  const ch = normLink(meta.channel), ct = normLink(meta.contact);
  return `<div class="job-card" data-id="${m.id}">${isAdmin ? '<button class="del-msg" type="button">حذف</button>' : ""}
    <div class="job-top"><div class="job-av" style="${avStyle(m.user_id, nm)}">${avInner(m.user_id, nm)}</div><div><b>${esc(nm)}</b><small>✦ فرصة عمل · ${fmtTime(m.created_at)}</small></div></div>
    <div class="job-desc">${linkify(m.text || "")}</div>
    ${meta.price ? `<span class="job-price">💰 ${esc(meta.price)}</span>` : ""}
    <div class="job-actions">${ch ? `<a class="job-btn" href="${esc(ch)}" target="_blank" rel="noopener">معرض الأعمال</a>` : ""}${ct ? `<a class="job-btn primary" href="${esc(ct)}" target="_blank" rel="noopener">📞 تواصل مباشر</a>` : ""}</div></div>`;
}
function applyChannelUI() {
  const isJobs = CURCHAN === "jobs";
  const cf = $("commForm"), jf = $("jobForm");
  if (cf) cf.hidden = isJobs;
  if (jf) jf.hidden = !isJobs;
  const inp = $("commInput");
  if (inp) inp.placeholder = CURCHAN === "achievements" ? "اكتب إنجازك وأرفق عملك… 🏆" : "اكتب رسالتك…";
}
async function loadMessages(forceScroll) {
  const box = $("commMessages"); if (!box) return;
  try { MSGS = await dbGet(`community_messages?select=*&channel=eq.${CURCHAN}&order=created_at.asc&limit=200`); }
  catch (e) { box.innerHTML = `<p class="comm-empty">تعذّر التحميل:<br>${esc(e.message)}</p>`; return; }
  // وقّع البيانات — لا تعيد الرسم إلا إذا فيه تغيير فعلي (يمنع وميض الروابط وقفز التمرير)
  const last = MSGS[MSGS.length - 1];
  const sig = CURCHAN + ":" + MSGS.length + ":" + (last ? last.id : "");
  if (!forceScroll && sig === lastSig) return;
  lastSig = sig;
  renderMessages(forceScroll);
}
function startCommPoll() { stopCommPoll(); commTimer = setInterval(() => loadMessages(false), 4000); }
function stopCommPoll() { if (commTimer) { clearInterval(commTimer); commTimer = null; } }

function switchView(view) {
  document.querySelectorAll(".nav-tab").forEach((t) => t.classList.toggle("on", t.dataset.view === view));
  const vc = $("viewCourses"), vm = $("viewCommunity"), va = $("viewAccount");
  if (vc) vc.hidden = view !== "courses";
  if (vm) vm.hidden = view !== "community";
  if (va) va.hidden = view !== "account";
  if (view === "community") { registerProfile(); loadMembers(); loadMessages(true); startCommPoll(); } else stopCommPoll();
  if (view === "account") loadAccount();
}
document.querySelectorAll(".nav-tab").forEach((t) => t.addEventListener("click", () => switchView(t.dataset.view)));

// القنوات
document.querySelectorAll("#commChannels .chan").forEach((c) => c.addEventListener("click", () => {
  CURCHAN = c.dataset.ch;
  document.querySelectorAll("#commChannels .chan").forEach((x) => x.classList.toggle("on", x === c));
  const info = CHAN_INFO[CURCHAN]; $("chanTitle").textContent = info.t; $("chanDesc").textContent = info.d;
  commSearch = ""; if ($("commSearch")) $("commSearch").value = "";
  applyChannelUI();
  loadMessages(true);
}));

// البحث
(function () { const s = $("commSearch"); if (s) s.addEventListener("input", (e) => { commSearch = e.target.value.trim(); renderMessages(false); }); })();

// نشر فرصة عمل
(function () {
  const f = $("jobForm"); if (!f) return;
  f.addEventListener("submit", async (e) => {
    e.preventDefault();
    const desc = $("jobDesc").value.trim();
    if (!desc) { alert("اكتب وصف العمل / الفرصة أولاً."); return; }
    const meta = { channel: $("jobChannel").value.trim() || null, price: $("jobPrice").value.trim() || null, contact: $("jobContact").value.trim() || null };
    const btn = $("jobSend"); btn.disabled = true;
    try {
      await dbSend("POST", "community_messages", { user_id: USER.id, name: myName(), text: desc, channel: "jobs", meta }, "return=minimal");
      $("jobDesc").value = ""; $("jobChannel").value = ""; $("jobPrice").value = ""; $("jobContact").value = "";
      await loadMessages(true);
    } catch (err) { alert("خطأ: " + err.message); }
    btn.disabled = false;
  });
})();

// الإيموجي
(function () {
  const p = $("emojiPanel"); if (!p) return;
  p.innerHTML = EMOJIS.map((e) => `<button type="button">${e}</button>`).join("");
  p.querySelectorAll("button").forEach((b) => b.addEventListener("click", () => { const inp = $("commInput"); inp.value += b.textContent; inp.focus(); }));
  const eb = $("emojiBtn"); if (eb) eb.addEventListener("click", () => { p.hidden = !p.hidden; });
})();

// الإرفاق
(function () {
  const ab = $("attachBtn"), fi = $("commFile"); if (!ab || !fi) return;
  ab.addEventListener("click", () => fi.click());
  fi.addEventListener("change", (e) => {
    const f = e.target.files[0]; if (!f) return;
    const MAX = 45 * 1024 * 1024; // ٤٥ م.ب (حد Supabase المجاني)
    if (f.size > MAX) {
      alert(`الملف كبير (${(f.size / 1048576).toFixed(0)} م.ب).\nالحد الأقصى ٤٥ م.ب.\n\nللفيديوهات الكبيرة: ارفعها على يوتيوب/درايف والصق الرابط كرسالة.`);
      fi.value = ""; return;
    }
    pendingFile = f; showPending(f);
  });
})();
function showPending(f) {
  const pv = $("filePreview"); if (!pv) return;
  pv.hidden = false;
  const url = URL.createObjectURL(f);
  pv.innerHTML = `${f.type.startsWith("video") ? `<video src="${url}" muted></video>` : `<img src="${url}">`}<span class="fp-name">${esc(f.name)}</span><button type="button" class="fp-x">✕</button>`;
  pv.querySelector(".fp-x").addEventListener("click", clearPending);
}
function clearPending() { pendingFile = null; const pv = $("filePreview"); if (pv) { pv.hidden = true; pv.innerHTML = ""; } const fi = $("commFile"); if (fi) fi.value = ""; }

// الإرسال
(function wireCommForm() {
  const f = $("commForm"); if (!f) return;
  f.addEventListener("submit", async (e) => {
    e.preventDefault();
    const inp = $("commInput"), btn = $("commSend");
    const t = inp.value.trim();
    if (!t && !pendingFile) return;
    btn.disabled = true;
    const ep = $("emojiPanel"); if (ep) ep.hidden = true;
    try {
      let media_url = null, media_type = null;
      if (pendingFile) {
        btn.textContent = "جارٍ الرفع…";
        media_url = await uploadCommFile(pendingFile);
        media_type = pendingFile.type.startsWith("video") ? "video" : "image";
      }
      await dbSend("POST", "community_messages", { user_id: USER.id, name: myName(), text: t || null, channel: CURCHAN, media_url, media_type }, "return=minimal");
      inp.value = ""; clearPending();
      await loadMessages(true);
    } catch (err) { alert("خطأ: " + err.message); }
    btn.disabled = false; btn.textContent = "إرسال"; inp.focus();
  });
})();

// ====== حسابي ======
function addMonths(d, n) { const x = new Date(d.getTime()); const day = x.getDate(); x.setMonth(x.getMonth() + n); if (x.getDate() < day) x.setDate(0); return x; }
function fmtDate(d) {
  const months = ["يناير", "فبراير", "مارس", "أبريل", "مايو", "يونيو", "يوليو", "أغسطس", "سبتمبر", "أكتوبر", "نوفمبر", "ديسمبر"];
  return `${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}`;
}

async function loadAccount() {
  await loadAvatars();
  const name = myName();
  const av = $("accAvatar");
  if (av) {
    const myUrl = AVATARS[USER && USER.id];
    if (myUrl) { av.style.background = ""; av.innerHTML = `<img src="${esc(myUrl)}" alt="" class="av-img">`; }
    else { av.textContent = initialOf(name); av.style.background = avColor((USER && USER.id) || name); }
  }
  $("accName").textContent = name;
  $("accEmail").textContent = (USER && USER.email) || "";

  // تاريخ الاشتراك
  const subRaw = (MEMBER && MEMBER.created_at) || (USER && USER.created_at) || null;
  const sub = subRaw ? new Date(subRaw) : null;
  $("accSince").textContent = sub ? "مشترك منذ " + fmtDate(sub) : "";

  // التقدّم العام
  const total = LESSONS.length, done = DONE.size;
  const pct = total ? Math.round((done / total) * 100) : 0;
  $("accPct").textContent = pct + "%";
  $("accDone").textContent = done;
  $("accTotal").textContent = total;
  const ring = $("accRing");
  if (ring) ring.style.background = `conic-gradient(#5BB8E8 ${pct * 3.6}deg, rgba(255,255,255,.1) 0deg)`;

  // تفصيل الدورات
  $("accCourses").innerHTML = SECTIONS.map((sec) => {
    const ls = LESSONS.filter((l) => l.section_id === sec.id);
    const d = ls.filter((l) => DONE.has(l.id)).length;
    const p = ls.length ? Math.round((d / ls.length) * 100) : 0;
    return `<div class="acc-crow"><span class="acc-cname">${esc(sec.title)}</span>
      <div class="acc-cbar"><span style="width:${p}%"></span></div>
      <span class="acc-cpct">${d}/${ls.length}</span></div>`;
  }).join("") || '<p class="hint">لا دورات بعد.</p>';

  // المكالمات الشهرية (٣ أشهر من تاريخ الاشتراك)
  const callsTotal = (MEMBER && MEMBER.calls_total) || 3;
  const callsUsed = (MEMBER && MEMBER.calls_used) || 0;
  const now = new Date();
  const ord = ["الأولى", "الثانية", "الثالثة", "الرابعة", "الخامسة", "السادسة"];
  let calls = "";
  for (let i = 0; i < callsTotal; i++) {
    const date = sub ? addMonths(sub, i + 1) : null;
    let state, cls;
    if (i < callsUsed) { state = "تمّت ✓"; cls = "used"; }
    else if (date && date <= now) { state = "متاحة الآن"; cls = "ready"; }
    else { state = "قادمة"; cls = "soon"; }
    calls += `<div class="acc-call ${cls}">
      <div class="acc-call-n">${i + 1}</div>
      <div class="acc-call-body"><b>المكالمة ${ord[i] || i + 1}</b><small>${date ? fmtDate(date) : "—"}</small></div>
      <span class="acc-call-tag">${state}</span></div>`;
  }
  $("accCalls").innerHTML = calls;

  // شارات الإنجاز
  const fullCourses = SECTIONS.filter((s) => { const ls = LESSONS.filter((l) => l.section_id === s.id); return ls.length && ls.every((l) => DONE.has(l.id)); }).length;
  const badges = [];
  if (done >= 1) badges.push("🎬 أول درس");
  if (done >= 5) badges.push("⚡ ٥ دروس");
  if (done >= 10) badges.push("🔥 ١٠ دروس");
  if (fullCourses >= 1) badges.push("🏅 أكملت دورة");
  if (pct === 100 && total) badges.push("👑 أكملت كل الدورات");
  $("accBadges").innerHTML = badges.length ? badges.map((b) => `<span class="acc-badge">${b}</span>`).join("") : '<p class="hint">ابدأ بمشاهدة الدروس لتفتح إنجازاتك 🚀</p>';

  // إنجازاتي المنشورة بالمجتمع
  try {
    const posts = await dbGet(`community_messages?select=text,created_at,media_url&channel=eq.achievements&user_id=eq.${USER.id}&order=created_at.desc&limit=20`);
    $("accAchPosts").innerHTML = (posts && posts.length)
      ? `<h4 class="acc-sub">إنجازاتك المنشورة (${posts.length})</h4>` + posts.map((p) => `<div class="acc-post">${p.media_url ? "📎 " : "🏆 "}${esc((p.text || "مرفق").slice(0, 90))}<small>${fmtDate(new Date(p.created_at))}</small></div>`).join("")
      : "";
  } catch (_) { $("accAchPosts").innerHTML = ""; }
}

// تغيير كلمة السر
(function () {
  const btn = $("accPassBtn"); if (!btn) return;
  btn.addEventListener("click", async () => {
    const p1 = $("accPass1").value, p2 = $("accPass2").value, msg = $("accPassMsg");
    if (p1.length < 6) { setMsg(msg, "كلمة السر قصيرة — ٦ أحرف على الأقل.", false); return; }
    if (p1 !== p2) { setMsg(msg, "الكلمتان غير متطابقتين.", false); return; }
    btn.disabled = true; setMsg(msg, "جارٍ الحفظ…", true);
    try {
      const r = await fetchT(`${SUPABASE_URL}/auth/v1/user`, {
        method: "PUT", headers: authHeaders({ "Content-Type": "application/json" }),
        body: JSON.stringify({ password: p1 }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.msg || d.error_description || d.error || "تعذّر الحفظ");
      setMsg(msg, "تم تغيير كلمة السر ✅", true);
      $("accPass1").value = ""; $("accPass2").value = "";
    } catch (e) { setMsg(msg, "خطأ: " + e.message, false); }
    btn.disabled = false;
  });
})();

// تغيير صورة البروفايل
(function () {
  const btn = $("accAvBtn"), fi = $("accAvFile"); if (!btn || !fi) return;
  btn.addEventListener("click", () => fi.click());
  fi.addEventListener("change", async (e) => {
    const f = e.target.files[0]; if (!f) return;
    const msg = $("accAvMsg");
    if (!f.type.startsWith("image")) { setMsg(msg, "اختر صورة فقط.", false); fi.value = ""; return; }
    if (f.size > 5 * 1024 * 1024) { setMsg(msg, "الصورة كبيرة — الحد ٥ م.ب.", false); fi.value = ""; return; }
    setMsg(msg, "جارٍ رفع الصورة…", true);
    try {
      const url = await uploadCommFile(f);
      await dbSend("POST", "profiles?on_conflict=user_id",
        { user_id: USER.id, name: myName(), avatar_url: url }, "resolution=merge-duplicates,return=minimal");
      AVATARS[USER.id] = url;
      const av = $("accAvatar"); if (av) { av.style.background = ""; av.innerHTML = `<img src="${esc(url)}" alt="" class="av-img">`; }
      setMsg(msg, "تم تحديث صورتك ✅", true);
    } catch (err) {
      const m = String(err.message || err);
      setMsg(msg, /avatar_url/.test(m) ? "لازم تضيف عمود avatar_url بقاعدة البيانات أول (راجع الخطوة)." : "خطأ: " + m, false);
    }
    fi.value = "";
  });
})();
