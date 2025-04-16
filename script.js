document.addEventListener('DOMContentLoaded', () => {

  /* -----------------------------------------------------------
     1.  Show variation spans based on URL parameters
  ----------------------------------------------------------- */
  const params = new URLSearchParams(window.location.search);
  [
    '193','195',
    'room1','room2','room3','room4','room5','room6',
    'rooma','roomb','wholehome','sharedb','sharedk'
  ].forEach(key=>{
    if(params.has(key)){
      document.querySelectorAll('.variation-'+key)
              .forEach(el=>{ el.style.display='inline'; });
    }
  });

  /* -----------------------------------------------------------
     2.  Create one reusable bottom spacer
  ----------------------------------------------------------- */
  const spacer = document.createElement('div');
  spacer.id = 'accordion-spacer';
  spacer.style.height = '0px';
  document.body.appendChild(spacer);

  /* remove spacer once user scrolls up */
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

  sections.forEach(sec=>{
    const header = sec.querySelector('h2');
    if(!header) return;

    /* hide section if its heading is filtered out */
    if (header.offsetParent === null){
      sec.style.display = 'none';
      return;
    }

    header.classList.add('accordion-header');

    /* wrap everything after the header */
    const wrap = document.createElement('div');
    wrap.className = 'accordion-content';
    while(header.nextSibling){
      wrap.appendChild(header.nextSibling);
    }
    sec.appendChild(wrap);

    /* start closed */
    sec.classList.add('collapsed');

    header.addEventListener('click',()=>{

      /* remember page height & “at‑bottom” status */
      const oldHeight   = document.documentElement.scrollHeight;
      const buffer      = 40;
      const wasAtBottom = window.scrollY + window.innerHeight >= oldHeight - buffer;

      const isOpen = !sec.classList.contains('collapsed');
      if(isOpen){
        sec.classList.add('collapsed');              // close it
      }else{
        sections.forEach(s=>s.classList.add('collapsed'));
        sec.classList.remove('collapsed');           // open this one
      }

      /* add spacer if height shrank while user was at bottom */
      const newHeight   = document.documentElement.scrollHeight;
      const diff        = oldHeight - newHeight;
      if (wasAtBottom && diff > 0){
        spacer.style.height = `${diff + buffer}px`;
        window.scrollTo({top: newHeight - window.innerHeight, left: 0});
      }
    });
  });

  /* -----------------------------------------------------------
     4.  SAVE‑AS‑PDF BUTTON
  ----------------------------------------------------------- */
  const pdfBtn = document.getElementById('pdfBtn');
  if (pdfBtn){
    pdfBtn.addEventListener('click', () => {

      /* a) remember which sections are open */
      const openSections = Array.from(document.querySelectorAll('section'))
                                .filter(sec => !sec.classList.contains('collapsed'));

      /* b) expand ALL sections so the PDF includes everything */
      document.querySelectorAll('section.collapsed')
              .forEach(sec => sec.classList.remove('collapsed'));

      /* c) clone the body for a clean capture */
      const clone = document.body.cloneNode(true);

      /* remove the PDF button and spacer from the clone */
      clone.querySelector('#pdfBtn')?.remove();
      clone.querySelector('#accordion-spacer')?.remove();

      /* d) generate PDF */
      const options = {
        margin:      10,
        filename:    '195VBR-guidebook.pdf',
        image:       { type: 'jpeg', quality: 0.98 },
        html2canvas: { scale: 2, scrollY: 0 },
        jsPDF:       { unit: 'mm', format: 'a4', orientation: 'portrait' }
      };
      html2pdf().set(options).from(clone).save().then(() => {
        /* e) restore previous accordion state */
        document.querySelectorAll('section').forEach(sec => sec.classList.add('collapsed'));
        openSections.forEach(sec => sec.classList.remove('collapsed'));
      });
    });
  }
});
