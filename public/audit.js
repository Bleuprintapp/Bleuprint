(function () {
  var form = document.getElementById("audit-form");
  if (!form) return;

  var steps = Array.prototype.slice.call(form.querySelectorAll(".aq-step"));
  var back = document.getElementById("aq-back");
  var next = document.getElementById("aq-next");
  var send = document.getElementById("aq-send");
  var err = document.getElementById("aq-err");
  var bar = document.getElementById("aq-bar");
  var status = document.getElementById("aq-status");
  var key = document.getElementById("aq-key");
  var done = document.getElementById("aq-done");
  var current = 0;
  var questions = steps.length - 2; // the opening and closing steps are not questions

  // Without this class every step shows as one long form, so the page still works without JavaScript.
  form.classList.add("is-stepped");

  function fieldsOf(step) {
    return Array.prototype.slice.call(step.querySelectorAll("input, textarea"));
  }

  function stepIsValid(step) {
    var radios = step.querySelectorAll('input[type="radio"][required]');
    if (radios.length) {
      var name = radios[0].name;
      if (!step.querySelector('input[name="' + CSS.escape(name) + '"]:checked')) return false;
    }
    return fieldsOf(step).every(function (el) {
      if (el.type === "radio") return true;
      if (el.required && !el.value.trim()) return false;
      return el.checkValidity();
    });
  }

  function render(direction) {
    steps.forEach(function (step, i) {
      step.classList.remove("is-on", "from-back");
      step.disabled = i !== current;
      if (i === current) {
        if (direction < 0) step.classList.add("from-back");
        step.classList.add("is-on");
      }
    });
    var last = current === steps.length - 1;
    back.hidden = current === 0;
    next.hidden = last;
    send.hidden = !last;
    key.hidden = last;
    err.classList.remove("is-on");

    var section = steps[current].getAttribute("data-section");
    if (current === 0) status.textContent = section;
    else if (last) status.textContent = section;
    else status.textContent = section + " — " + current + " of " + questions;
    bar.style.transform = "scaleX(" + current / (steps.length - 1) + ")";

    var focusTarget = steps[current].querySelector("input:not([type=radio]), textarea, input[type=radio]");
    if (focusTarget && direction !== 0) {
      window.setTimeout(function () { focusTarget.focus({ preventScroll: true }); }, 60);
    }
  }

  function go(direction) {
    if (direction > 0 && !stepIsValid(steps[current])) {
      err.textContent = current === 0
        ? "Please add your name, a valid email, and your business."
        : "Please answer this one to continue.";
      err.classList.add("is-on");
      var bad = fieldsOf(steps[current]).filter(function (el) { return !el.checkValidity() || (el.required && !el.value.trim()); })[0];
      if (bad) bad.focus();
      return;
    }
    current = Math.max(0, Math.min(steps.length - 1, current + direction));
    render(direction);
    var top = form.getBoundingClientRect().top + window.scrollY - 140;
    if (window.scrollY > top) window.scrollTo({ top: top, behavior: "smooth" });
  }

  next.addEventListener("click", function () { go(1); });
  back.addEventListener("click", function () { go(-1); });

  form.addEventListener("keydown", function (event) {
    if (event.key !== "Enter" || event.isComposing) return;
    // Shift+Enter keeps a new line inside an answer.
    if (event.target.tagName === "TEXTAREA" && event.shiftKey) return;
    event.preventDefault();
    if (current === steps.length - 1) form.requestSubmit();
    else go(1);
  });

  form.addEventListener("change", function (event) {
    if (event.target.type === "radio") {
      err.classList.remove("is-on");
      window.setTimeout(function () { go(1); }, 260);
    }
  });

  form.addEventListener("submit", function (event) {
    event.preventDefault();
    var payload = { _subject: "Bleuprint Diagnosis audit answers" };
    steps.forEach(function (step) { step.disabled = false; });
    var data = new FormData(form);
    // Unanswered radio groups are missing from FormData, so walk the named fields instead.
    Array.prototype.forEach.call(form.elements, function (el) {
      if (!el.name || el.name in payload) return;
      payload[el.name] = String(data.get(el.name) || "").trim() || "(skipped)";
    });
    payload._replyto = payload.Email;
    steps.forEach(function (step, i) { step.disabled = i !== current; });
    send.disabled = true;
    send.textContent = "Sending…";
    fetch("https://formsubmit.co/ajax/kalenagardner07@gmail.com", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Accept": "application/json" },
      body: JSON.stringify(payload)
    }).then(function (response) {
      if (!response.ok) throw new Error("Submission failed");
      form.hidden = true;
      document.querySelector(".aq-meter").hidden = true;
      status.hidden = true;
      done.classList.add("is-on");
      done.focus();
    }).catch(function () {
      send.disabled = false;
      send.textContent = "Send my answers";
      err.textContent = "Something interrupted the form. Please try again or reply to your booking email.";
      err.classList.add("is-on");
    });
  });

  render(0);
})();
