/* Navigation: mobile drawer, theme toggle, table-of-contents scrollspy,
   completion indicators in sidebar and cards. */
(function () {
  var root = document.documentElement;
  var THEME_KEY = "htc-theme";

  // ----- Theme -----
  function applyStoredTheme() {
    try { var t = localStorage.getItem(THEME_KEY); if (t === "light" || t === "dark") root.setAttribute("data-theme", t); } catch (e) {}
  }
  applyStoredTheme();
  function currentTheme() {
    var t = root.getAttribute("data-theme");
    if (t) return t;
    return window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  }

  document.addEventListener("DOMContentLoaded", function () {
    var themeBtn = document.querySelector(".theme-btn");
    if (themeBtn) {
      var sync = function () { themeBtn.setAttribute("aria-label", currentTheme() === "dark" ? "Увімкнути світлу тему" : "Увімкнути темну тему"); };
      if (!root.getAttribute("data-theme")) root.setAttribute("data-theme", currentTheme());
      sync();
      themeBtn.addEventListener("click", function () {
        var next = currentTheme() === "dark" ? "light" : "dark";
        root.setAttribute("data-theme", next);
        try { localStorage.setItem(THEME_KEY, next); } catch (e) {}
        sync();
      });
    }

    // ----- Mobile drawer -----
    var menuBtn = document.querySelector(".menu-btn");
    var backdrop = document.querySelector(".backdrop");
    function closeNav() { document.body.classList.remove("nav-open"); if (menuBtn) menuBtn.setAttribute("aria-expanded", "false"); }
    if (menuBtn) {
      menuBtn.addEventListener("click", function () {
        var open = document.body.classList.toggle("nav-open");
        menuBtn.setAttribute("aria-expanded", open ? "true" : "false");
      });
    }
    if (backdrop) backdrop.addEventListener("click", closeNav);
    document.addEventListener("keydown", function (e) { if (e.key === "Escape") closeNav(); });
    document.querySelectorAll(".sidebar a").forEach(function (a) { a.addEventListener("click", closeNav); });

    // Keep the current lecture visible in the sidebar
    var cur = document.querySelector('.sidebar [aria-current="page"]');
    if (cur && cur.scrollIntoView) { var sb = document.querySelector(".sidebar"); if (sb) sb.scrollTop = Math.max(0, cur.offsetTop - 160); }

    // ----- TOC scrollspy -----
    var tocLinks = Array.prototype.slice.call(document.querySelectorAll(".toc a"));
    if (tocLinks.length && "IntersectionObserver" in window) {
      var map = {};
      tocLinks.forEach(function (a) { map[a.getAttribute("href").slice(1)] = a; });
      var visible = {};
      var obs = new IntersectionObserver(function (entries) {
        entries.forEach(function (en) { visible[en.target.id] = en.isIntersecting; });
        var heads = document.querySelectorAll(".content h2[id]");
        var active = null;
        for (var i = 0; i < heads.length; i++) {
          var r = heads[i].getBoundingClientRect();
          if (r.top < window.innerHeight * 0.35) active = heads[i].id;
        }
        if (!active && heads.length) active = heads[0].id;
        tocLinks.forEach(function (a) { a.classList.toggle("active", a.getAttribute("href") === "#" + active); });
      }, { rootMargin: "0px 0px -60% 0px", threshold: [0, 1] });
      document.querySelectorAll(".content h2[id]").forEach(function (h) { obs.observe(h); });
    }

    // ----- Completion indicators -----
    function paint() {
      if (!window.CourseProgress) return;
      document.querySelectorAll("[data-check]").forEach(function (el) {
        var done = CourseProgress.isDone(el.getAttribute("data-check"));
        el.classList.toggle("done", done);
        el.setAttribute("aria-label", done ? "Опрацьовано" : "Не опрацьовано");
      });
      document.querySelectorAll("[data-week-progress]").forEach(function (el) {
        var ids = el.getAttribute("data-week-progress").split(",");
        var n = CourseProgress.countDone(ids);
        var txt = el.querySelector(".wp-text"); if (txt) txt.textContent = n + " з " + ids.length;
        var bar = el.querySelector(".bar > i"); if (bar) bar.style.width = (ids.length ? (100 * n / ids.length) : 0) + "%";
      });
      var ring = document.querySelector(".ring .fg");
      if (ring && window.COURSE) {
        var all = COURSE.lectures.map(function (l) { return l.id; });
        var done = CourseProgress.countDone(all);
        var pct = Math.round(100 * done / all.length);
        var c = 2 * Math.PI * 70;
        ring.style.strokeDasharray = c;
        ring.style.strokeDashoffset = c * (1 - done / all.length);
        var t = document.querySelector(".ring .pct"); if (t) t.textContent = pct + "%";
        var l = document.querySelector(".ring-count"); if (l) l.textContent = done + " з " + all.length + " лекцій";
      }
    }
    paint();
    document.addEventListener("progress:change", paint);
    window.addEventListener("storage", paint);

    var resetBtn = document.querySelector("[data-reset-progress]");
    if (resetBtn) resetBtn.addEventListener("click", function () {
      if (window.confirm("Скинути позначки прогресу в цьому браузері?")) CourseProgress.reset();
    });
  });
})();
