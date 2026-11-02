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
  function initQuiz() {
    var host = document.querySelector(".quiz[data-quiz]");
    var dataEl = document.getElementById("quiz-data");
    if (!host || !dataEl) return;
    var lectureId = host.getAttribute("data-quiz");
    var qs;
    try { qs = JSON.parse(dataEl.textContent); } catch (e) { return; }
    var answered = 0, correct = 0;
    var scoreBox = document.createElement("div");
    scoreBox.className = "quiz-score";
    scoreBox.setAttribute("aria-live", "polite");

    qs.forEach(function (q, qi) {
      var box = document.createElement("div");
      var multi = Array.isArray(q.answer);
      box.className = multi ? "q multi" : "q";
      var head = '<div class="q-head"><span class="q-n">' + (qi + 1) + '.</span><span>' + q.q + (multi ? ' <span class="q-tag">кілька відповідей</span>' : "") + "</span></div>";
      box.innerHTML = head + '<div class="q-opts" role="group" aria-label="Варіанти відповіді"></div><div class="q-explain" aria-live="polite"></div>';
      var opts = box.querySelector(".q-opts");
      if (multi) { buildMulti(q, box, opts); host.appendChild(box); return; }
      q.options.forEach(function (o, oi) {
        var b = document.createElement("button");
        b.type = "button"; b.className = "q-opt"; b.innerHTML = o;
        b.addEventListener("click", function () {
          if (box.classList.contains("answered")) return;
          box.classList.add("answered");
          var good = oi === q.answer;
          answered++; if (good) correct++;
          opts.querySelectorAll("button").forEach(function (x, xi) {
            x.disabled = true;
            if (xi === q.answer) x.classList.add("correct");
            else if (xi === oi) x.classList.add("wrong");
          });
          box.querySelector(".q-explain").innerHTML = (good ? '<b class="ok">Правильно.</b> ' : '<b class="bad">Не зовсім.</b> ') + q.explain;
          updateScore();
        });
        opts.appendChild(b);
      });
      host.appendChild(box);
    });
    host.appendChild(scoreBox);

    function buildMulti(q, box, opts) {
      var picked = {};
      var buttons = q.options.map(function (o, oi) {
        var b = document.createElement("button");
        b.type = "button"; b.className = "q-opt"; b.innerHTML = o;
        b.setAttribute("aria-pressed", "false");
        b.addEventListener("click", function () {
          if (box.classList.contains("answered")) return;
          picked[oi] = !picked[oi];
          b.classList.toggle("picked", picked[oi]);
          b.setAttribute("aria-pressed", picked[oi] ? "true" : "false");
          check.disabled = !Object.keys(picked).some(function (k) { return picked[k]; });
        });
        opts.appendChild(b);
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
        box.querySelector(".q-explain").innerHTML = (good ? '<b class="ok">Правильно.</b> ' : '<b class="bad">Не зовсім.</b> Правильних варіантів: ' + q.answer.length + ' (пунктиром — ті, що ви пропустили). ') + q.explain;
        updateScore();
      });
      opts.after(check);
    }

    function updateScore() {
      if (answered < qs.length) {
        scoreBox.innerHTML = "<span>Відповіли: " + answered + " з " + qs.length + "</span><span>Правильно: " + correct + "</span>";
      } else {
        if (window.CourseProgress) CourseProgress.saveQuiz(lectureId, correct, qs.length);
        var msg = correct === qs.length ? "Чудово — усе правильно!" : (correct >= Math.ceil(qs.length * 0.7) ? "Добрий результат. Перечитайте розділи з помилками." : "Варто повторити лекцію і пройти ще раз.");
        scoreBox.innerHTML = "<span>Результат: " + correct + " з " + qs.length + ". " + msg + '</span><button type="button" class="btn">Пройти ще раз</button>';
        scoreBox.querySelector("button").addEventListener("click", function () { host.innerHTML = ""; initQuiz(); });
      }
    }
    var prev = window.CourseProgress && CourseProgress.getQuiz(lectureId);
    scoreBox.innerHTML = prev ? "<span>Минулий результат: " + prev.correct + " з " + prev.total + "</span><span>Оберіть відповіді, щоб пройти знову</span>" : "<span>Оберіть відповідь у кожному питанні</span><span>" + qs.length + " питань</span>";
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

  document.addEventListener("DOMContentLoaded", function () { initSearch(); initQuiz(); initComplete(); });
})();
