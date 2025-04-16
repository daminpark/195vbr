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

    /* hide entire section if its heading is invisible (variation not selected) */
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

    /* toggle logic */
    header.addEventListener('click',()=>{
      /* ---- keep the header glued to its current viewport position ---- */
      const startTop = header.getBoundingClientRect().top;

      const isOpen = !sec.classList.contains('collapsed');
      if(isOpen){
        sec.classList.add('collapsed');      // close it: zero open sections
      }else{
        sections.forEach(s=>s.classList.add('collapsed'));
        sec.classList.remove('collapsed');   // open this one
      }

      /* after layout shift, scroll back by the exact delta (if possible) */
      const endTop = header.getBoundingClientRect().top;
      const delta  = endTop - startTop;

      if (delta !== 0){
        const maxScroll = document.documentElement.scrollHeight - window.innerHeight;
        const targetY   = Math.min(maxScroll, window.scrollY + delta);
        window.scrollTo({top: targetY, left: 0, behavior: 'instant'});   // no animation
      }
    });
  });
});
