(function () {
  var answers = {
    q1: "",
    q2: "",
    name: "",
    business: "",
    email: "",
    q3: "", q4: "", q5: "", q6: "", q7: "", q8: "", q9: "", q10: ""
  };

  var order = ["q1", "q2", "email", "q3", "q4", "q5", "q6", "q7", "q8", "q9", "q10"];
  var step = 0;
  var err = document.getElementById("d-err");
  var progress = document.getElementById("progress");

  var q1 = document.getElementById("q1-choices");
  for (var i = 0; i <= 10; i++) {
    var b = document.createElement("button");
    b.type = "button";
    b.className = "choice";
    b.textContent = String(i);
    b.setAttribute("data-val", String(i));
    q1.appendChild(b);
  }

  var yn = ["Yes", "No", "Not yet"];
  document.querySelectorAll(".choices.yn").forEach(function (root) {
    var key = root.getAttribute("data-key");
    var labels = yn;
    if (key === "q7") labels = ["Situations", "Just budgets", "Not sure"];
    labels.forEach(function (lab) {
      var btn = document.createElement("button");
      btn.type = "button";
      btn.className = "choice";
      btn.textContent = lab;
      btn.setAttribute("data-val", lab);
      root.appendChild(btn);
    });
  });

  function bindChoices(root, onPick) {
    root.addEventListener("click", function (e) {
      var t = e.target.closest(".choice");
      if (!t || !root.contains(t)) return;
      root.querySelectorAll(".choice").forEach(function (c) {
        var on = c === t;
        c.classList.toggle("is-on", on);
        c.setAttribute("aria-pressed", on ? "true" : "false");
      });
      onPick(t.getAttribute("data-val"));
    });
  }

  bindChoices(q1, function (v) {
    answers.q1 = v;
    go(1);
  });
  bindChoices(document.getElementById("q2-choices"), function (v) {
    answers.q2 = v;
    go(2);
  });
  document.querySelectorAll(".choices.yn").forEach(function (root) {
    bindChoices(root, function (v) {
      answers[root.getAttribute("data-key")] = v;
      go(step + 1);
    });
  });

  document.getElementById("email-next").addEventListener("click", function () {
    answers.name = document.getElementById("d-name").value.trim();
    answers.business = document.getElementById("d-biz").value.trim();
    answers.email = document.getElementById("d-email").value.trim();
    if (!answers.name || !answers.business) {
      err.textContent = "Name, business, and email complete The Ten.";
      err.classList.add("is-on");
      return;
    }
    if (!answers.email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(answers.email)) {
      err.textContent = "An email is required to complete The Ten.";
      err.classList.add("is-on");
      document.getElementById("d-email").focus();
      return;
    }
    go(3);
  });

  function showStep(i) {
    step = i;
    document.querySelectorAll(".q").forEach(function (el) {
      el.classList.toggle("is-on", el.getAttribute("data-step") === order[i]);
    });
    err.classList.remove("is-on");
    var key = order[i];
    if (key === "email") {
      progress.textContent = "Email to complete The Ten";
    } else if (key.indexOf("q") === 0) {
      var n = parseInt(key.slice(1), 10);
      if (n <= 2) progress.textContent = "Question " + n + " of 2";
      else progress.textContent = "Question " + n + " of 10";
    }
    var flow = document.getElementById("flow");
    if (flow) window.scrollTo({ top: flow.offsetTop - 72, behavior: "smooth" });
  }

  function go(i) {
    if (i >= order.length) {
      finish();
      return;
    }
    showStep(i);
  }

  function weak(v) {
    return v === "No" || v === "Not yet" || v === "Just budgets" || v === "Not sure" || v === "I do not know";
  }

  function finish() {
    document.querySelectorAll(".q").forEach(function (el) { el.classList.remove("is-on"); });
    progress.textContent = "Complete";
    err.classList.remove("is-on");

    var q1n = parseInt(answers.q1, 10);
    var trust = trustCopy(answers.q3, answers.q4);
    var offer = offerCopy(answers.q5, answers.q6, answers.q7, answers.q8);
    var reach = reachCopy(q1n, answers.q2, answers.q9, answers.q10);
    var move = firstMove(q1n, answers);

    document.getElementById("bucket-trust").textContent = trust;
    document.getElementById("bucket-offer").textContent = offer;
    document.getElementById("bucket-reach").textContent = reach;
    document.getElementById("synthesis").textContent = move;
    document.getElementById("result").classList.add("is-on");

    var payload = {
      _subject: "Bleuprint diagnosis",
      name: answers.name,
      email: answers.email,
      business: answers.business,
      q1_customers_from_posts: answers.q1,
      q2_show_up_in_search: answers.q2,
      q3_documented_results: answers.q3,
      q4_public_vouch: answers.q4,
      q5_same_everywhere: answers.q5,
      q6_known_for_sentence: answers.q6,
      q7_price_tiers: answers.q7,
      q8_free_to_paid: answers.q8,
      q9_source_content: answers.q9,
      q10_first_three_seconds: answers.q10,
      diagnosis_trust_and_proof: trust,
      diagnosis_category_and_offer: offer,
      diagnosis_reach_and_engine: reach,
      first_move: move
    };

    try {
      localStorage.setItem("bleuprint-diagnosis", JSON.stringify(Object.assign({ at: new Date().toISOString() }, payload)));
    } catch (e) {}

    fetch("https://formsubmit.co/ajax/kalenagardner07@gmail.com", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Accept": "application/json" },
      body: JSON.stringify(payload)
    }).catch(function () {});

    var res = document.getElementById("result");
    window.scrollTo({ top: res.offsetTop - 80, behavior: "smooth" });
  }

  function trustCopy(q3, q4) {
    var a = weak(q3);
    var b = weak(q4);
    if (a && b) return "Proof is thin. Names and numbers are missing, and no one with standing has said it in public.";
    if (a && !b) return "Someone will vouch. The file of results is still missing.";
    if (!a && b) return "Results exist. They are not yet being said by anyone else.";
    return "Proof is in place. Put it where the next customer actually looks.";
  }

  function offerCopy(q5, q6, q7, q8) {
    var bits = [];
    if (weak(q6)) bits.push("A stranger could not say in one sentence what you are known for.");
    else bits.push("The category sentence is there.");
    if (weak(q5)) bits.push("You do not look and sound the same everywhere someone finds you.");
    else bits.push("The presence is consistent.");
    if (q7 === "Just budgets" || q7 === "Not sure") bits.push("Tiers read as budget rungs, not different situations.");
    else bits.push("Tiers map to situations.");
    if (weak(q8)) bits.push("A free try does not have a clear next step to pay.");
    else bits.push("The step from free to paid is named.");
    return bits.join(" ");
  }

  function reachCopy(n, q2, q9, q10) {
    var bits = [];
    if (n <= 2) bits.push("Almost none of the last ten customers came from something you posted.");
    else if (n <= 6) bits.push("Some customers came from posting. It is not yet the engine.");
    else bits.push("Most of the last ten customers came from something you posted.");
    if (q2 === "No") bits.push("You do not show up when someone searches your category in your city.");
    else if (q2 === "I do not know") bits.push("You do not yet know if you show up in search.");
    else bits.push("You show up in search.");
    if (weak(q9)) bits.push("There is no one piece of content everything else could be cut down from.");
    else bits.push("A source piece exists.");
    if (weak(q10)) bits.push("The first three seconds name the topic more than they name the change.");
    else bits.push("The opening says what changes for the viewer.");
    return bits.join(" ");
  }

  function firstMove(n, a) {
    if (weak(a.q6)) return "Write the one sentence a stranger can say. Until that exists, every post is a different business.";
    if (a.q2 === "No" || a.q2 === "I do not know") return "Get findable in the category and city you actually serve. Monday's move is the listing and the search result, not another post.";
    if (weak(a.q3)) return "Document one real result with a name, a number, and a before and after. That file is the first move.";
    if (weak(a.q8)) return "Name the step from free to paid. One next action, written where they finish the free thing.";
    if (n <= 3) return "Stop treating posting as the engine until you can name which posts produced customers. Monday's move is that count, not more volume.";
    if (weak(a.q10)) return "Open with what changes for the viewer. The first three seconds should not only name the topic.";
    if (weak(a.q5)) return "Make the next place they find you match the last one. Same words, same look.";
    if (a.q7 === "Just budgets" || a.q7 === "Not sure") return "Rebuild the tiers around situations, not budget rungs.";
    if (weak(a.q9)) return "Pick one piece of content everything else can be cut down from. That is the source. Cut from there.";
    if (weak(a.q4)) return "Ask one person with standing to say it in public.";
    return "The pieces are in place. Sequence one Monday instruction and watch what gets stuck.";
  }

  showStep(0);
})();
