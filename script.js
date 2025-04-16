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
     2.  Prepare a single, reusable bottom spacer
  ----------------------------------------------------------- */
  const spacer = document.createElement('div');
  spacer.id = 'accordion-spacer';
  spacer.style.height = '0px';
  document.body.appendChild(spacer);

  /* helper to clear spacer when no longer needed */
  const clearSpacerIfAwayFromBottom = () => {
    const buffer = 40;                               // px
    const atBottom = window.scrollY + window.innerHeight
                     >= document.documentElement.scrollHeight - buffer;
    if (!atBottom) spacer.style.height = '0px';
  };
  window.addEventListener('scroll', clearSpacerIfAwayFromBottom);

  /* -----------------------------------------------------------
     3.  Build the accordion
  ----------------------------------------------------------- */
  const sections = document.querySelectorAll('main.container section');

  sections.forEach(sec=>{
    const header = sec.querySelector('h2');
    if(!header) return;

    /* hide entire section if its heading is invisible (variation filtered) */
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

      /* -- record page height and “at‑bottom” status BEFORE the change -- */
      const oldHeight = document.documentElement.scrollHeight;
      const bottomBuffer = 40;
      const wasAtBottom = window.scrollY + window.innerHeight
                          >= oldHeight - bottomBuffer;

      const isOpen = !sec.classList.contains('collapsed');
      if(isOpen){
        sec.classList.add('collapsed');          // close it (so none open)
      }else{
        sections.forEach(s=>s.classList.add('collapsed'));
        sec.classList.remove('collapsed');       // open this one
      }

      /* -- after layout: if page height shrank while user was at bottom,
            add a temporary spacer equal to the lost height -------------- */
      const newHeight = document.documentElement.scrollHeight;
      const heightDiff = oldHeight - newHeight;

      if (wasAtBottom && heightDiff > 0){
        spacer.style.height = `${heightDiff + bottomBuffer}px`;
        // ensure user still feels at bottom
        window.scrollTo({top: newHeight - window.innerHeight, left: 0});
      }else{
        spacer.style.height = '0px';             // no spacer needed
      }
    });
  });
});
