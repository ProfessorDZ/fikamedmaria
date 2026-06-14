// Fika med Maria — light interactions

// Current year in footer
document.getElementById("year").textContent = new Date().getFullYear();

// Signup form handling.
// NOTE: This is a front-end-only demo. To actually collect emails, point the
// form at a provider (Mailchimp, Buttondown, Formspree, etc.) or your own API.
// See README.md → "Hooking up the signup form".
const form = document.getElementById("signup-form");
const msg = document.getElementById("form-msg");

form.addEventListener("submit", (event) => {
  event.preventDefault();
  const email = form.email.value.trim();

  const valid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  if (!valid) {
    msg.textContent = "Hmm, kolla e-postadressen en gång till ☕";
    msg.style.color = "#3a2e26";
    return;
  }

  // Demo: store locally so nothing is lost before a backend is wired up.
  try {
    const saved = JSON.parse(localStorage.getItem("fika-signups") || "[]");
    if (!saved.includes(email)) saved.push(email);
    localStorage.setItem("fika-signups", JSON.stringify(saved));
  } catch (_) { /* localStorage may be unavailable; ignore */ }

  form.reset();
  msg.textContent = "Tack! Vi ses på nästa fika 🫶";
  msg.style.color = "#fffaf2";
});
