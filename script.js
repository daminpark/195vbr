document.addEventListener('DOMContentLoaded', () => {

  /* -----------------------------------------------------------
     1.  Reveal any spans requested via URL parameters
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
     2.  Build the accordion
  ----------------------------------------------------------- */
  const sections = document.querySelectorAll('main.container section');

  sections.forEach(sec=>{
    const header = sec.querySelector('h2');
    if(!header) return;

    /* ignore sections whose heading is hidden (e.g. behind a variation) */
    const headerVisible = header.offsetParent !== null;   // fast & simple
    if(!headerVisible){
      sec.style.display = 'none';                         // removes extra line
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

    /* toggle logic: close others, or close itself if open */
    header.addEventListener('click',()=>{
      const isOpen = !sec.classList.contains('collapsed');
      if(isOpen){
        sec.classList.add('collapsed');        // all collapse, so zero open
      }else{
        sections.forEach(s=>s.classList.add('collapsed'));
        sec.classList.remove('collapsed');
      }
    });
  });
});
