// ثَمين — أكاديمية المشتركين (REST مباشر)
const SUPABASE_URL = "https://hwzpjxxfdqsjymxbjokv.supabase.co";
const SUPABASE_KEY = "sb_publishable_mcKOUcVtNy5BkLEd5UcRDA_foJbp3YK";
let TOKEN = null, USER = null;

// روابط التواصل بالفوتر (عدّلها هنا) — معرّفة بالأعلى لتفادي مشكلة الترتيب
const SOCIALS = [
  { n: "واتساب", u: "https://wa.me/9647518838203" },
  { n: "إنستقرام", u: "#" }, { n: "تيك توك", u: "#" }, { n: "يوتيوب", u: "#" },
  { n: "سناب شات", u: "#" }, { n: "ديسكورد", u: "#" }, { n: "X", u: "#" },
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
async function loadAcademy() {
  $("meName").textContent = (USER && (USER.user_metadata?.name || USER.email)) || "";
  renderSocials();
  const wrap = $("coursesCol");
  try {
    const sections = await dbGet("sections?select=*&order=sort.asc,created_at.asc");
    const lessons = await dbGet("lessons?select=*&order=sort.asc,created_at.asc");
    let progress = [], members = [];
    try { progress = await dbGet("progress?select=lesson_id"); } catch (_) {}
    try { members = await dbGet("members?select=calls_total,calls_used"); } catch (_) {}
    SECTIONS = sections || []; LESSONS = lessons || [];
    DONE = new Set((progress || []).map((p) => p.lesson_id));
    const m = members && members[0];
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
  if (ifr) ifr.addEventListener("load", () => subscribePlayer(ifr));
  $("lDesc").innerHTML = l.description ? `<h4>الروابط والمرفقات</h4><div class="desc-body">${linkify(l.description)}</div>` : "";
  const md = $("markDoneBtn");
  md.textContent = DONE.has(id) ? "✓ مكتمل — اضغط للإلغاء" : "✓ أكملت هذا الدرس";
  md.classList.toggle("is-done", DONE.has(id));
  md.onclick = () => toggleDone(id);
  renderPlaylist(LESSONS.filter((x) => x.section_id === CURSEC));
}

// اشتراك في أحداث مشغّل Bunny (player.js) لإكمال الدرس تلقائيًا
function subscribePlayer(ifr) {
  try {
    ["ended", "timeupdate"].forEach((ev) =>
      ifr.contentWindow.postMessage(JSON.stringify({ context: "player.js", method: "addEventListener", value: ev }), "*"));
  } catch (_) {}
}
window.addEventListener("message", (e) => {
  let d; try { d = typeof e.data === "string" ? JSON.parse(e.data) : e.data; } catch (_) { return; }
  if (!d || d.context !== "player.js" || !CURLESSON) return;
  if (d.event === "ended") autoComplete(CURLESSON);
  else if (d.event === "timeupdate" && d.value && d.value.duration) {
    if (d.value.seconds / d.value.duration >= 0.92) autoComplete(CURLESSON);
  }
});
async function autoComplete(id) {
  if (DONE.has(id)) return;
  DONE.add(id);
  try {
    await dbSend("POST", "progress?on_conflict=user_id,lesson_id",
      { user_id: USER.id, lesson_id: id, completed: true, updated_at: new Date().toISOString() },
      "resolution=merge-duplicates,return=minimal");
  } catch (_) { DONE.delete(id); return; }
  renderProgress();
  if (CURLESSON === id) {
    const md = $("markDoneBtn");
    if (md) { md.textContent = "✓ مكتمل — اضغط للإلغاء"; md.classList.add("is-done"); }
  }
  renderPlaylist(LESSONS.filter((x) => x.section_id === CURSEC));
  renderCourses();
}

async function toggleDone(id) {
  try {
    if (DONE.has(id)) {
      await dbSend("DELETE", `progress?lesson_id=eq.${id}&user_id=eq.${USER.id}`);
      DONE.delete(id);
    } else {
      await dbSend("POST", "progress?on_conflict=user_id,lesson_id",
        { user_id: USER.id, lesson_id: id, completed: true, updated_at: new Date().toISOString() },
        "resolution=merge-duplicates,return=minimal");
      DONE.add(id);
    }
    renderProgress();
    const md = $("markDoneBtn");
    md.textContent = DONE.has(id) ? "✓ مكتمل — اضغط للإلغاء" : "✓ أكملت هذا الدرس";
    md.classList.toggle("is-done", DONE.has(id));
    renderPlaylist(LESSONS.filter((x) => x.section_id === CURSEC));
    renderCourses();
  } catch (e) { alert("خطأ: " + e.message); }
}
