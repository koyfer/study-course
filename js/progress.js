/* Progress tracking — stored in this browser only (localStorage).
   It does NOT sync between devices. */
(function () {
  var KEY = "htc-course-progress-v1";
  var memory = { done: {}, quiz: {} };

  function load() {
    try {
      var raw = window.localStorage.getItem(KEY);
      if (!raw) return { done: {}, quiz: {} };
      var data = JSON.parse(raw);
      return { done: data.done || {}, quiz: data.quiz || {} };
    } catch (e) {
      return memory;
    }
  }
  function save(data) {
    memory = data;
    try { window.localStorage.setItem(KEY, JSON.stringify(data)); } catch (e) { /* storage blocked: keep in memory */ }
  }

  var Progress = {
    isDone: function (id) { return !!load().done[id]; },
    setDone: function (id, value) {
      var d = load();
      if (value) d.done[id] = new Date().toISOString(); else delete d.done[id];
      save(d);
      document.dispatchEvent(new CustomEvent("progress:change", { detail: { id: id, done: value } }));
    },
    toggle: function (id) { var v = !this.isDone(id); this.setDone(id, v); return v; },
    saveQuiz: function (id, correct, total) { var d = load(); d.quiz[id] = { correct: correct, total: total }; save(d); },
    getQuiz: function (id) { return load().quiz[id] || null; },
    countDone: function (ids) { var d = load(); return ids.filter(function (i) { return d.done[i]; }).length; },
    reset: function () { save({ done: {}, quiz: {} }); document.dispatchEvent(new CustomEvent("progress:change", { detail: {} })); }
  };
  window.CourseProgress = Progress;
})();
