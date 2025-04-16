document.addEventListener('DOMContentLoaded', () => {

  /* ------------------------------------------------------------------
     1. Show variation spans based on URL parameters  (unchanged logic)
  ------------------------------------------------------------------ */
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

  /* ------------------------------------------------------------------
     2. Build & control the accordion
  ------------------------------------------------------------------ */
  const sections = document.querySelectorAll('main.container section');

  sections.forEach(sec=>{
    /* locate first <h2> */
    const header = sec.querySelector('h2');
    if(!header) return;
    header.classList.add('accordion-header');

    /* wrap everything after the header */
    const content = document.createElement('div');
    content.className = 'accordion-content';
    while(header.nextSibling){
      content.appendChild(header.nextSibling);
    }
    sec.appendChild(content);

    /* start closed */
    sec.classList.add('collapsed');

    /* click handler */
    header.addEventListener('click',()=>{
      /* remember where the header sits before anything moves */
      const startY = header.getBoundingClientRect().top;

      const wasOpen = !sec.classList.contains('collapsed');
      if(wasOpen){
        /* just close it – no sections open */
        sec.classList.add('collapsed');
      }else{
        /* close others, open this one */
        sections.forEach(s=>s.classList.add('collapsed'));
        sec.classList.remove('collapsed');
      }

      /* after layout shift, compensate scroll so header stays in place */
      const endY = header.getBoundingClientRect().top;
      window.scrollBy({top:endY - startY, left:0, behavior:'instant'});
    });
  });
});
