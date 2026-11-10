/* App: search across lectures, knowledge-check quizzes, "mark as completed". */
(function () {
  var ROOT = document.body ? document.body.getAttribute("data-root") || "" : "";

  function esc(s) { return String(s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
  function norm(s) { return String(s || "").toLowerCase().replace(/ё/g, "е").replace(/[’'`ʼ]/g, ""); }

  /* ---------------- Search ---------------- */
  function initSearch() {
    var modal = document.querySelector(".search-modal");
    if (!modal || !window.COURSE) return;
    var input = modal.querySelector("input");
    var list = modal.querySelector(".search-results");
    var openers = document.querySelectorAll("[data-open-search]");
    var sel = -1;
    var docs = window.COURSE.search || [];

    function open() { modal.classList.add("open"); modal.setAttribute("aria-hidden", "false"); input.value = ""; render(""); setTimeout(function () { input.focus(); }, 10); }
    function close() { modal.classList.remove("open"); modal.setAttribute("aria-hidden", "true"); }
    openers.forEach(function (b) { b.addEventListener("click", open); });
    modal.addEventListener("click", function (e) { if (e.target === modal) close(); });
    document.addEventListener("keydown", function (e) {
      var tag = (e.target && e.target.tagName) || "";
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") { e.preventDefault(); open(); }
      else if (e.key === "/" && !/INPUT|TEXTAREA/.test(tag) && !modal.classList.contains("open")) { e.preventDefault(); open(); }
      else if (e.key === "Escape" && modal.classList.contains("open")) close();
    });

    function highlight(text, terms) {
      var out = esc(text);
      terms.forEach(function (t) {
        if (t.length < 2) return;
        var re = new RegExp("(" + t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + ")", "ig");
        out = out.replace(re, "<mark>$1</mark>");
      });
      return out;
    }
    function snippet(text, term) {
      var i = norm(text).indexOf(term);
      if (i < 0) return text.slice(0, 140);
      var s = Math.max(0, i - 50);
      return (s > 0 ? "…" : "") + text.slice(s, s + 150) + "…";
    }
    function render(q) {
      var terms = norm(q).split(/\s+/).filter(Boolean);
      list.innerHTML = "";
      sel = -1;
      if (!terms.length) {
        list.innerHTML = '<li class="search-empty">Введіть слово: наприклад <b>chmod</b>, <b>NAT</b>, <b>Dockerfile</b>, <b>IaaS</b>, <b>terraform plan</b></li>';
        return;
      }
      var scored = [];
      docs.forEach(function (d) {
        var hay = norm(d.title + " " + d.section + " " + d.text);
        var ok = terms.every(function (t) { return hay.indexOf(t) >= 0; });
        if (!ok) return;
        var score = 0;
        terms.forEach(function (t) {
          if (norm(d.section).indexOf(t) >= 0) score += 6;
          if (norm(d.title).indexOf(t) >= 0) score += 3;
          score += Math.min(5, hay.split(t).length - 1);
        });
        scored.push({ d: d, s: score });
      });
      scored.sort(function (a, b) { return b.s - a.s; });
      if (!scored.length) { list.innerHTML = '<li class="search-empty">Нічого не знайдено</li>'; return; }
      scored.slice(0, 30).forEach(function (r) {
        var li = document.createElement("li");
        li.innerHTML = '<a href="' + ROOT + r.d.url + '"><div class="r-path">' + esc(r.d.title) + '</div><div class="r-title">' + highlight(r.d.section, terms) + '</div><div class="r-snip">' + highlight(snippet(r.d.text, terms[0]), terms) + "</div></a>";
        li.querySelector("a").addEventListener("click", close);
        list.appendChild(li);
      });
    }
    input.addEventListener("input", function () { render(input.value); });
    input.addEventListener("keydown", function (e) {
      var links = list.querySelectorAll("a");
      if (!links.length) return;
      if (e.key === "ArrowDown") { e.preventDefault(); sel = Math.min(links.length - 1, sel + 1); }
      else if (e.key === "ArrowUp") { e.preventDefault(); sel = Math.max(0, sel - 1); }
      else if (e.key === "Enter") { e.preventDefault(); (links[sel < 0 ? 0 : sel]).click(); window.location.href = links[sel < 0 ? 0 : sel].href; return; }
      else return;
      links.forEach(function (a, i) { a.classList.toggle("sel", i === sel); });
      if (links[sel]) links[sel].scrollIntoView({ block: "nearest" });
    });
  }

  /* ---------------- Quiz ---------------- */
  // Every question is "Select one or more": the number of correct options is not shown in advance.
  function shuffled(q) {
    var idx = q.options.map(function (_, i) { return i; });
    for (var i = idx.length - 1; i > 0; i--) { var j = Math.floor(Math.random() * (i + 1)); var t = idx[i]; idx[i] = idx[j]; idx[j] = t; }
    var ans = Array.isArray(q.answer) ? q.answer : [q.answer];
    return { q: q.q, explain: q.explain, src: q.src, options: idx.map(function (i) { return q.options[i]; }),
             answer: ans.map(function (a) { return idx.indexOf(a); }).sort(function (a, b) { return a - b; }) };
  }

  function renderQuiz(host, list, opts) {
    opts = opts || {};
    var qs = list.map(shuffled);
    var answered = 0, correct = 0;
    host.innerHTML = "";
    var scoreBox = document.createElement("div");
    scoreBox.className = "quiz-score";
    scoreBox.setAttribute("aria-live", "polite");

    qs.forEach(function (q, qi) {
      var box = document.createElement("div");
      box.className = "q multi";
      var src = q.src ? '<a class="q-src" href="' + ROOT + q.src.url + '">' + esc(q.src.label) + "</a>" : "";
      box.innerHTML = '<div class="q-head"><span class="q-n">' + (qi + 1) + '.</span><span>' + q.q + ' <span class="q-tag">Select one or more</span>' + src + "</span></div>" +
        '<div class="q-opts" role="group" aria-label="Варіанти відповіді"></div><div class="q-explain" aria-live="polite"></div>';
      var optsEl = box.querySelector(".q-opts");
      var picked = {};
      var buttons = q.options.map(function (o, oi) {
        var b = document.createElement("button");
        b.type = "button"; b.className = "q-opt"; b.innerHTML = '<span class="q-letter">' + String.fromCharCode(97 + oi) + '.</span> ' + o;
        b.setAttribute("aria-pressed", "false");
        b.addEventListener("click", function () {
          if (box.classList.contains("answered")) return;
          picked[oi] = !picked[oi];
          b.classList.toggle("picked", picked[oi]);
          b.setAttribute("aria-pressed", picked[oi] ? "true" : "false");
          check.disabled = !Object.keys(picked).some(function (k) { return picked[k]; });
        });
        optsEl.appendChild(b);
        return b;
      });
      var check = document.createElement("button");
      check.type = "button"; check.className = "btn primary q-check"; check.textContent = "Перевірити"; check.disabled = true;
      check.addEventListener("click", function () {
        if (box.classList.contains("answered")) return;
        box.classList.add("answered");
        var good = true;
        buttons.forEach(function (x, xi) {
          x.disabled = true;
          var should = q.answer.indexOf(xi) !== -1;
          if (should && picked[xi]) x.classList.add("correct");
          else if (should) { x.classList.add("correct", "missed"); good = false; }
          else if (picked[xi]) { x.classList.add("wrong"); good = false; }
        });
        check.remove();
        answered++; if (good) correct++;
        var letters = q.answer.map(function (a) { return String.fromCharCode(97 + a); }).join(", ");
        box.querySelector(".q-explain").innerHTML = (good ? '<b class="ok">Правильно.</b> ' : '<b class="bad">Не зовсім.</b> Правильні варіанти: <b>' + letters + '</b> (пунктиром — ті, що ви пропустили). ') + q.explain;
        updateScore();
      });
      optsEl.after(check);
      host.appendChild(box);
    });
    host.appendChild(scoreBox);

    function updateScore() {
      if (answered < qs.length) {
        scoreBox.innerHTML = "<span>Відповіли: " + answered + " з " + qs.length + "</span><span>Правильно: " + correct + "</span>";
      } else {
        if (opts.onFinish) opts.onFinish(correct, qs.length);
        var pct = Math.round(correct / qs.length * 100);
        var msg = correct === qs.length ? "Чудово — усе правильно!" : (pct >= 70 ? "Добрий результат. Перечитайте розділи з помилками." : "Варто повторити матеріал і пройти ще раз.");
        scoreBox.innerHTML = "<span>Результат: " + correct + " з " + qs.length + " (" + pct + "%). " + msg + '</span><button type="button" class="btn">Пройти ще раз</button>';
        scoreBox.querySelector("button").addEventListener("click", function () { (opts.again || function () { renderQuiz(host, list, opts); })(); });
      }
    }
    scoreBox.innerHTML = opts.intro || ("<span>Позначте всі правильні варіанти і натисніть «Перевірити»</span><span>" + qs.length + " питань</span>");
  }

  function initQuiz() {
    var host = document.querySelector(".quiz[data-quiz]");
    var dataEl = document.getElementById("quiz-data");
    if (!host || !dataEl) return;
    var lectureId = host.getAttribute("data-quiz");
    var qs;
    try { qs = JSON.parse(dataEl.textContent); } catch (e) { return; }
    var prev = window.CourseProgress && CourseProgress.getQuiz(lectureId);
    renderQuiz(host, qs, {
      onFinish: function (c, t) { if (window.CourseProgress) CourseProgress.saveQuiz(lectureId, c, t); },
      intro: prev ? "<span>Минулий результат: " + prev.correct + " з " + prev.total + "</span><span>Порядок варіантів змінюється з кожною спробою</span>" : null
    });
  }

  /* ---------------- Practice exam ---------------- */
  function initPractice() {
    var root = document.querySelector(".practice");
    if (!root || !window.QUIZ_BANK) return;
    var form = root.querySelector(".practice-form");
    var host = root.querySelector(".quiz");
    var bank = window.QUIZ_BANK;
    var boxes = form.querySelector(".practice-lectures");
    bank.forEach(function (l) {
      var lab = document.createElement("label");
      lab.className = "pr-item";
      lab.innerHTML = '<input type="checkbox" value="' + l.id + '" checked> <span><b>' + l.num + '.</b> ' + esc(l.short) + ' <small>(' + l.questions.length + ')</small></span>';
      boxes.appendChild(lab);
    });
    form.querySelector("[data-all]").addEventListener("click", function () { boxes.querySelectorAll("input").forEach(function (i) { i.checked = true; }); });
    form.querySelector("[data-none]").addEventListener("click", function () { boxes.querySelectorAll("input").forEach(function (i) { i.checked = false; }); });
    function start() {
      var ids = [].slice.call(boxes.querySelectorAll("input:checked")).map(function (i) { return i.value; });
      var pool = [];
      bank.forEach(function (l) {
        if (ids.indexOf(l.id) === -1) return;
        l.questions.forEach(function (q, qi) { pool.push(Object.assign({}, q, { src: { url: l.url + "#quiz", label: "Лекція " + l.num } })); });
      });
      if (!pool.length) { host.innerHTML = '<p class="note-small">Оберіть хоча б одну лекцію.</p>'; return; }
      for (var i = pool.length - 1; i > 0; i--) { var j = Math.floor(Math.random() * (i + 1)); var t = pool[i]; pool[i] = pool[j]; pool[j] = t; }
      var n = form.querySelector("select").value;
      if (n !== "all") pool = pool.slice(0, +n);
      renderQuiz(host, pool, {
        again: start,
        intro: "<span>Випадкові питання з обраних лекцій</span><span>" + pool.length + " питань</span>",
        onFinish: function (c, t) { try { localStorage.setItem("htc-practice-last", JSON.stringify({ c: c, t: t, at: Date.now() })); } catch (e) {} }
      });
      host.scrollIntoView({ behavior: "smooth", block: "start" });
    }
    form.addEventListener("submit", function (e) { e.preventDefault(); start(); });
    try {
      var last = JSON.parse(localStorage.getItem("htc-practice-last") || "null");
      if (last) root.querySelector(".practice-last").textContent = "Останній тренувальний тест: " + last.c + " з " + last.t + " (" + Math.round(last.c / last.t * 100) + "%).";
    } catch (e) {}
  }

  /* ---------------- Mark as completed ---------------- */
  function initComplete() {
    var btns = document.querySelectorAll("[data-complete]");
    if (!btns.length || !window.CourseProgress) return;
    function paint() {
      btns.forEach(function (b) {
        var done = CourseProgress.isDone(b.getAttribute("data-complete"));
        b.classList.toggle("is-done", done);
        b.classList.toggle("primary", !done);
        b.setAttribute("aria-pressed", done ? "true" : "false");
        b.querySelector(".lbl").textContent = done ? "Опрацьовано ✓ (зняти позначку)" : "Позначити як опрацьовану";
      });
      var chip = document.querySelector(".chip[data-status]");
      if (chip) {
        var d = CourseProgress.isDone(chip.getAttribute("data-status"));
        chip.classList.toggle("done", d);
        chip.querySelector(".lbl").textContent = d ? "Опрацьовано" : "Не опрацьовано";
      }
    }
    btns.forEach(function (b) { b.addEventListener("click", function () { CourseProgress.toggle(b.getAttribute("data-complete")); }); });
    document.addEventListener("progress:change", paint);
    paint();
  }

  document.addEventListener("DOMContentLoaded", function () { initSearch(); initQuiz(); initPractice(); initComplete(); });
})();
