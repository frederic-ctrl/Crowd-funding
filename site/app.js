// Wachtlijstformulieren: valideren en versturen naar /api/waitlist.
(function () {
  "use strict";

  var EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

  function setStatus(form, kind, text) {
    var el = form.querySelector(".form-status");
    el.className = "form-status" + (kind ? " " + kind : "");
    el.textContent = text;
  }

  function onSubmit(event) {
    event.preventDefault();
    var form = event.currentTarget;
    var email = form.elements.email.value.trim();
    var consent = form.elements.consent.checked;
    var honeypot = form.elements.website.value;
    var button = form.querySelector('button[type="submit"]');

    if (!EMAIL_RE.test(email)) {
      setStatus(form, "err", "Vul een geldig e-mailadres in.");
      form.elements.email.focus();
      return;
    }
    if (!consent) {
      setStatus(form, "err", "Vink aan dat je e-mails over de community-ronde wil ontvangen.");
      form.elements.consent.focus();
      return;
    }

    button.disabled = true;
    setStatus(form, "", "Even geduld...");

    fetch("/api/waitlist", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: email, consent: true, lang: "nl", website: honeypot })
    })
      .then(function (res) {
        if (res.ok || res.status === 409) {
          form.reset();
          setStatus(form, "ok", "Je staat op de wachtlijst. We mailen je bij elke belangrijke stap.");
        } else if (res.status === 503) {
          setStatus(form, "err", "De wachtlijst is nog niet geactiveerd. Probeer het binnenkort opnieuw.");
        } else if (res.status === 400) {
          setStatus(form, "err", "Controleer je e-mailadres en probeer opnieuw.");
        } else {
          setStatus(form, "err", "Er ging iets mis aan onze kant. Probeer het later opnieuw.");
        }
      })
      .catch(function () {
        setStatus(form, "err", "Geen verbinding. Controleer je internet en probeer opnieuw.");
      })
      .then(function () {
        button.disabled = false;
      });
  }

  var forms = document.querySelectorAll("form[data-waitlist]");
  for (var i = 0; i < forms.length; i++) {
    forms[i].addEventListener("submit", onSubmit);
  }
})();
