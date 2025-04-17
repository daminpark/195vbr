document.addEventListener('DOMContentLoaded', () => {

  /* -----------------------------------------------------------
     1.  Reveal spans requested via URL parameters
  ----------------------------------------------------------- */
  const params = new URLSearchParams(window.location.search);
  [
    '193','195',
    'room1','room2','room3','room4','room5','room6',
    'rooma','roomb','wholehome','sharedb','sharedk'
  ].forEach(key=>{
    if (params.has(key)){
      document.querySelectorAll('.variation-'+key)
              .forEach(el => { el.style.display = 'inline'; });
    }
  });

  /* -----------------------------------------------------------
     2.  One reusable bottom spacer to prevent “jump”
  ----------------------------------------------------------- */
  const spacer = document.createElement('div');
  spacer.id = 'accordion-spacer';
  spacer.style.height = '0px';
  document.body.appendChild(spacer);

  window.addEventListener('scroll', () => {
    const buffer = 40;
    const nearBottom = window.scrollY + window.innerHeight
                       >= document.documentElement.scrollHeight - buffer;
    if (!nearBottom) spacer.style.height = '0px';
  });

  /* -----------------------------------------------------------
     3.  Build the accordion
  ----------------------------------------------------------- */
  const sections = document.querySelectorAll('main.container section');

  sections.forEach(sec => {
    const header = sec.querySelector('h2');
    if (!header) return;

    /* hide whole section if heading was filtered out */
    if (header.offsetParent === null){
      sec.style.display = 'none';
      return;
    }

    header.classList.add('accordion-header');

    /* wrap everything after the header into .accordion-content */
    const wrap = document.createElement('div');
    wrap.className = 'accordion-content';
    while (header.nextSibling){
      wrap.appendChild(header.nextSibling);
    }
    sec.appendChild(wrap);

    /* start closed */
    sec.classList.add('collapsed');

    header.addEventListener('click', () => {

      /* capture pre‑toggle page height and bottom status */
      const oldHeight = document.documentElement.scrollHeight;
      const buffer    = 40;
      const atBottom  = window.scrollY + window.innerHeight >= oldHeight - buffer;

      /* toggle */
      const isOpen = !sec.classList.contains('collapsed');
      if (isOpen){
        sec.classList.add('collapsed');              // close this (→ none open)
      } else {
        sections.forEach(s => s.classList.add('collapsed'));
        sec.classList.remove('collapsed');           // open this one
      }

      /* if page shrank while user was at bottom → add spacer */
      const newHeight = document.documentElement.scrollHeight;
      const diff      = oldHeight - newHeight;
      if (atBottom && diff > 0){
        spacer.style.height = `${diff + buffer}px`;
        window.scrollTo({ top: newHeight - window.innerHeight, left: 0 });
      }
    });
  });

  /* -----------------------------------------------------------
     SAVE‑AS‑PDF BUTTON  (force–black inline colour)
  ----------------------------------------------------------- */
  const pdfBtn = document.getElementById('pdfBtn');
  if (pdfBtn){
    pdfBtn.addEventListener('click', () => {
  
      /* 1 | remember which sections are open */
      const openSections = Array.from(document.querySelectorAll('section'))
                                .filter(sec => !sec.classList.contains('collapsed'));
  
      /* 2 | expand everything so PDF shows the full guide */
      document.querySelectorAll('section.collapsed')
              .forEach(sec => sec.classList.remove('collapsed'));
  
      /* 3 | enter print‑mode (hides spacer) */
      document.body.classList.add('print-mode');
  
      /* 4 | clone the body for capture */
      const clone = document.body.cloneNode(true);
      clone.querySelector('#pdfBtn')?.remove();          // drop button
      clone.querySelector('#accordion-spacer')?.remove();// drop spacer
  
      /* 5 | INLINE‑force every element’s colour to pure black */
      clone.querySelectorAll('*').forEach(el => {
        el.style.color = '#000';
      });
  
      /* 6 | generate PDF: honour page‑break rules */
      const opt = {
        margin:      10,
        filename:    '195VBR-guidebook.pdf',
        image:       { type: 'jpeg', quality: 0.98 },
        html2canvas: { scale: 2, scrollY: 0 },
        pagebreak:   { mode: ['avoid-all', 'css'] },
        jsPDF:       { unit: 'mm', format: 'a4', orientation: 'portrait' }
      };
      html2pdf().set(opt).from(clone).save().then(() => {
  
        /* 7 | restore UI */
        document.body.classList.remove('print-mode');
        document.querySelectorAll('section').forEach(sec => sec.classList.add('collapsed'));
        openSections.forEach(sec => sec.classList.remove('collapsed'));
      });
    });
  }
});
