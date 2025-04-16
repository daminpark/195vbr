document.addEventListener('DOMContentLoaded', () => {

  /* ----------------------------------------------
     1.  Show variation spans based on URL params
  ---------------------------------------------- */
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

  /* ----------------------------------------------
     2.  Build & control the accordion
  ---------------------------------------------- */
  const sections = document.querySelectorAll('main.container section');

  sections.forEach(sec=>{
    /* find the first <h2> and mark it as header */
    const header = sec.querySelector('h2');
    if(!header) return;
    header.classList.add('accordion-header');

    /* wrap everything AFTER the <h2> in .accordion-content */
    const content = document.createElement('div');
    content.className = 'accordion-content';
    while(header.nextSibling){
      content.appendChild(header.nextSibling);
    }
    sec.appendChild(content);

    /* start closed */
    sec.classList.add('collapsed');

    /* click logic */
    header.addEventListener('click',()=>{
      const currentlyOpen = !sec.classList.contains('collapsed');

      if(currentlyOpen){
        /* close it – leaving all sections closed */
        sec.classList.add('collapsed');
      }else{
        /* close others, open this one */
        sections.forEach(s=>s.classList.add('collapsed'));
        sec.classList.remove('collapsed');
      }
    });
  });
});
