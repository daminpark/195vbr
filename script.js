/* ---------------------------------------------------
   URL‑Parameter‑Variationen  (unverändert)
--------------------------------------------------- */
document.addEventListener('DOMContentLoaded', () => {
  const params = new URLSearchParams(window.location.search);
  const keys = [
    '193', '195',
    'room1', 'room2', 'room3', 'room4', 'room5', 'room6',
    'rooma', 'roomb',
    'wholehome', 'sharedb', 'sharedk'
  ];

  keys.forEach(key => {
    if (params.has(key)) {
      document.querySelectorAll('.variation-' + key).forEach(el => {
        el.style.display = 'inline';
      });
    }
  });

  /* -------------------------------------------------
     Akkordeon‑Logik  (nur ein Abschnitt offen)
  ------------------------------------------------- */
  const sections = document.querySelectorAll('main.container section');

  sections.forEach(sec => {
    const header = sec.querySelector('h2');
    if (!header) return;

    /* Klick‑Cursor & Pfeil anbringen */
    header.classList.add('accordion-header');
    /* Start: alles zugeklappt */
    sec.classList.add('collapsed');

    header.addEventListener('click', () => {
      /* zuerst alle schließen … */
      sections.forEach(s => s.classList.add('collapsed'));
      /* … dann geklickten Abschnitt umschalten */
      sec.classList.toggle('collapsed');
    });
  });

  /* Optional: ersten Abschnitt offen lassen */
  if (sections.length) {
    sections[0].classList.remove('collapsed');
  }

  /* ---- Mehrere Abschnitte gleichzeitig offen?
         -> die Zeile   sections.forEach(s => …)
         einfach entfernen. ---- */
});
