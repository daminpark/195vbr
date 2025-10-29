

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

    /* hide entire section if its heading is filtered out */
    if (header.offsetParent === null){
      sec.style.display = 'none';
      return;
    }

    header.classList.add('accordion-header');

    /* wrap everything after header */
    const wrap = document.createElement('div');
    wrap.className = 'accordion-content';
    while (header.nextSibling){
      wrap.appendChild(header.nextSibling);
    }
    sec.appendChild(wrap);

    /* start collapsed */
    sec.classList.add('collapsed');

    header.addEventListener('click', () => {

      const oldHeight = document.documentElement.scrollHeight;
      const buffer    = 40;
      const atBottom  = window.scrollY + window.innerHeight >= oldHeight - buffer;

      const isOpen = !sec.classList.contains('collapsed');
      if (isOpen){
        sec.classList.add('collapsed');  /* close it */
      } else {
        sections.forEach(s => s.classList.add('collapsed'));
        sec.classList.remove('collapsed'); /* open this one */
      }

      const newHeight = document.documentElement.scrollHeight;
      const diff = oldHeight - newHeight;
      if (atBottom && diff > 0){
        spacer.style.height = `${diff + buffer}px`;
        window.scrollTo({ top: newHeight - window.innerHeight, left: 0 });
      }
    });
  });

  /* -----------------------------------------------------------
     4.  PRINT / SAVE‑AS‑PDF (native dialog)
  ----------------------------------------------------------- */
  const printBtn = document.getElementById('printBtn') || document.getElementById('pdfBtn');
  if (printBtn){
    printBtn.addEventListener('click', () => {

      /* remember which sections are open */
      const openSections = Array.from(document.querySelectorAll('section'))
                                .filter(sec => !sec.classList.contains('collapsed'));

      /* open every section for printing */
      document.querySelectorAll('section.collapsed')
              .forEach(sec => sec.classList.remove('collapsed'));

      /* enter print‑mode so spacer disappears */
      document.body.classList.add('print-mode');

      /* native print dialog – user picks "Save as PDF" */
      window.print();

      /* restore UI after dialog closes */
      window.onafterprint = () => {
        document.body.classList.remove('print-mode');
        document.querySelectorAll('section')
                .forEach(sec => sec.classList.add('collapsed'));
        openSections.forEach(sec => sec.classList.remove('collapsed'));
      };
    });
  }
});
