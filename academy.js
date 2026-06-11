// ثَمين — أكاديمية المشتركين (REST مباشر)
const SUPABASE_URL = "https://hwzpjxxfdqsjymxbjokv.supabase.co";
const SUPABASE_KEY = "sb_publishable_mcKOUcVtNy5BkLEd5UcRDA_foJbp3YK";
let TOKEN = null, USER = null;

const $ = (id) => document.getElementById(id);
const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const setMsg = (el, t, ok) => { el.textContent = t; el.className = "msg " + (ok ? "ok" : "err"); };

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

// ====== تحميل الدورة ======
let LESSONS = [], DONE = new Set();
async function loadAcademy() {
  const main = $("academyMain");
  $("meName").textContent = (USER && (USER.user_metadata?.name || USER.email)) || "";
  try {
    const safe = (p) => p.then((v) => v).catch(() => null);
    const [sections, lessons, progress, members] = await Promise.all([
      safe(dbGet("sections?select=*&order=sort.asc,created_at.asc")),
      safe(dbGet("lessons?select=*&order=sort.asc,created_at.asc")),
      safe(dbGet("progress?select=lesson_id")),
      safe(dbGet("members?select=calls_total,calls_used")),
    ]);
    if (sections === null && lessons === null) {
      main.innerHTML = '<p class="empty" style="margin:40px">لم يتم تجهيز قاعدة بيانات المنصّة بعد.<br>شغّل ملف <b>academy-setup.sql</b> في Supabase.</p>';
      return;
    }
    LESSONS = lessons || [];
    DONE = new Set((progress || []).map((p) => p.lesson_id));
    // المكالمات
    const m = members && members[0];
    $("callsLeft").textContent = m ? Math.max(0, (m.calls_total || 3) - (m.calls_used || 0)) : 3;
    renderProgress();
    if (!sections || !sections.length) { main.innerHTML = '<p class="empty" style="margin:40px">لا توجد دروس بعد. تابعنا قريبًا 🚀</p>'; return; }
    main.innerHTML = sections.map((sec) => {
      const ls = lessons.filter((l) => l.section_id === sec.id);
      return `<section class="acad-section">
        <h2 class="acad-sec-title">${esc(sec.title)} <span>${ls.filter((l)=>DONE.has(l.id)).length}/${ls.length}</span></h2>
        <div class="lesson-grid">${ls.map((l) => `
          <button class="lesson-card ${DONE.has(l.id) ? "done" : ""}" data-lid="${l.id}">
            <div class="lc-thumb">${l.thumb_url ? `<img src="${esc(l.thumb_url)}" alt="" loading="lazy">` : "🎬"}
              <span class="lc-play">▶</span>${DONE.has(l.id) ? '<span class="lc-done">✓</span>' : ""}</div>
            <div class="lc-title">${esc(l.title)}</div>
            <div class="lc-meta">${(l.chapters || []).length} فصل</div>
          </button>`).join("")}</div>
      </section>`;
    }).join("");
    main.querySelectorAll(".lesson-card").forEach((b) =>
      b.addEventListener("click", () => openLesson(b.dataset.lid)));
  } catch (e) {
    main.innerHTML = `<p class="empty" style="margin:40px">خطأ في التحميل: ${esc(e.message)}</p>`;
  }
}

function renderProgress() {
  const total = LESSONS.length || 1;
  const pct = Math.round((DONE.size / total) * 100);
  $("progPct").textContent = pct + "%";
  $("progFill").style.width = pct + "%";
}

// ====== مشغّل الدرس ======
let curIframe = null;
function openLesson(id) {
  const l = LESSONS.find((x) => x.id === id);
  if (!l) return;
  $("lessonTitle").textContent = l.title;
  $("lessonMsg").textContent = "";
  const host = $("playerHost");
  if (l.embed_url) {
    host.innerHTML = `<iframe src="${esc(l.embed_url)}" loading="lazy" allow="autoplay; fullscreen; picture-in-picture" allowfullscreen></iframe>`;
    curIframe = host.querySelector("iframe");
  } else { host.innerHTML = '<p class="hint" style="padding:30px;text-align:center">لا يوجد فيديو لهذا الدرس بعد.</p>'; curIframe = null; }

  const chs = l.chapters || [];
  $("lessonChapters").innerHTML = chs.length
    ? `<p class="ch-h">الفصول</p>` + chs.map((c) => {
        const m = Math.floor(c.t / 60), s = String(Math.floor(c.t % 60)).padStart(2, "0");
        return `<button class="ch-btn" data-t="${c.t}"><span>${m}:${s}</span> ${esc(c.label)}</button>`;
      }).join("")
    : "";
  $("lessonChapters").querySelectorAll(".ch-btn").forEach((b) =>
    b.addEventListener("click", () => seekTo(parseFloat(b.dataset.t))));

  const md = $("markDoneBtn");
  md.textContent = DONE.has(id) ? "✓ مكتمل — اضغط للإلغاء" : "✓ أكملت هذا الدرس";
  md.onclick = () => toggleDone(id);

  const modal = $("lessonModal"); modal.hidden = false;
  document.body.style.overflow = "hidden";
}
function closeLesson() {
  $("lessonModal").hidden = true;
  $("playerHost").innerHTML = ""; curIframe = null;
  document.body.style.overflow = "";
}
$("lessonClose").addEventListener("click", closeLesson);
$("lessonModal").addEventListener("click", (e) => { if (e.target === $("lessonModal")) closeLesson(); });

// التنقّل لفصل عبر بروتوكول player.js (يدعمه مشغّل Bunny)
function seekTo(sec) {
  if (!curIframe || !curIframe.contentWindow) return;
  curIframe.contentWindow.postMessage(JSON.stringify({
    context: "player.js", version: "0.0.1", method: "setCurrentTime", value: sec,
  }), "*");
  curIframe.contentWindow.postMessage(JSON.stringify({
    context: "player.js", version: "0.0.1", method: "play",
  }), "*");
}

async function toggleDone(id) {
  const msg = $("lessonMsg");
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
    $("markDoneBtn").textContent = DONE.has(id) ? "✓ مكتمل — اضغط للإلغاء" : "✓ أكملت هذا الدرس";
    // حدّث البطاقة بالخلفية
    const card = document.querySelector(`.lesson-card[data-lid="${id}"]`);
    if (card) card.classList.toggle("done", DONE.has(id));
  } catch (e) { setMsg(msg, "خطأ: " + e.message, false); }
}
