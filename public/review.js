(function () {
  var form = document.getElementById("review-form");
  if (!form) return;
  form.addEventListener("submit", function (event) {
    event.preventDefault();
    var name = document.getElementById("r-name").value.trim();
    var email = document.getElementById("r-email").value.trim();
    var review = document.getElementById("r-review").value.trim();
    var error = document.getElementById("r-err");
    if (!name || !email || !review) {
      error.classList.add("is-on");
      return;
    }
    error.classList.remove("is-on");
    var payload = {
      _subject: "Bleuprint client review",
      name: name,
      email: email,
      business: document.getElementById("r-business").value.trim(),
      business_url: document.getElementById("r-url").value.trim(),
      review: review,
      permission_to_quote: document.getElementById("r-quote").checked ? "Yes" : "No",
      permission_to_link: document.getElementById("r-link").checked ? "Yes" : "No"
    };
    fetch("https://formsubmit.co/ajax/kalenagardner07@gmail.com", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Accept": "application/json" },
      body: JSON.stringify(payload)
    }).then(function (response) {
      if (!response.ok) throw new Error("Submission failed");
      document.getElementById("r-ok").classList.add("is-on");
      form.reset();
    }).catch(function () {
      error.textContent = "Something interrupted the form. Please try again or email Kalena directly.";
      error.classList.add("is-on");
    });
  });
})();
