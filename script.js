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

    if (header.offsetParent === null){
      sec.style.display = 'none';
      return;
    }

    header.classList.add('accordion-header');

    const wrap = document.createElement('div');
    wrap.className = 'accordion-content';
    while (header.nextSibling){
      wrap.appendChild(header.nextSibling);
    }
    sec.appendChild(wrap);

    sec.classList.add('collapsed');

    header.addEventListener('click', () => {
      const oldHeight = document.documentElement.scrollHeight;
      const buffer    = 40;
      const atBottom  = window.scrollY + window.innerHeight >= oldHeight - buffer;

      const isOpen = !sec.classList.contains('collapsed');
      if (isOpen){
        sec.classList.add('collapsed');
      } else {
        sections.forEach(s => s.classList.add('collapsed'));
        sec.classList.remove('collapsed');
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
      const openSections = Array.from(document.querySelectorAll('section'))
                                .filter(sec => !sec.classList.contains('collapsed'));

      document.querySelectorAll('section.collapsed')
              .forEach(sec => sec.classList.remove('collapsed'));

      document.body.classList.add('print-mode');
      window.print();

      window.onafterprint = () => {
        document.body.classList.remove('print-mode');
        document.querySelectorAll('section')
                .forEach(sec => sec.classList.add('collapsed'));
        openSections.forEach(sec => sec.classList.remove('collapsed'));
      };
    });
  }

  /* -----------------------------------------------------------
     5.  CHAT POP-UP LOGIC
  ----------------------------------------------------------- */
  const chatLauncher = document.getElementById('chat-launcher');
  const chatWidget = document.getElementById('chat-widget');
  const chatIcon = document.getElementById('chat-icon');
  const closeIcon = document.getElementById('close-icon');

  if (chatLauncher && chatWidget && chatIcon && closeIcon) {
    chatLauncher.addEventListener('click', () => {
      chatWidget.classList.toggle('hidden');
      chatIcon.classList.toggle('hidden');
      closeIcon.classList.toggle('hidden');
    });
  }

  /* -----------------------------------------------------------
     6.  Allow sending message with the Enter key
  ----------------------------------------------------------- */
  document.querySelector('#chat-widget #user-input').addEventListener('keypress', function (e) {
    if (e.key === 'Enter') {
        sendMessage();
    }
  });

}); // <-- ✅ THIS IS THE MISSING LINE THAT FIXES THE SYNTAX ERROR.

/* -----------------------------------------------------------
   7.  SEND MESSAGE FUNCTION (This stays outside)
----------------------------------------------------------- */
async function sendMessage() {
    const userInputField = document.querySelector('#chat-widget #user-input');
    const userInput = userInputField.value;
    if (!userInput) return;

    const chatBox = document.getElementById('chat-box');
    chatBox.innerHTML += `<p><strong>You:</strong> ${userInput}</p>`;
    userInputField.value = '';
    chatBox.scrollTop = chatBox.scrollHeight;

    const serverlessFunctionUrl = 'https://guidebook-chatbot-backend.vercel.app/api/chatbot'; 

    try {
        const response = await fetch(serverlessFunctionUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ prompt: userInput })
        });

        if (response.status === 429) {
            chatBox.innerHTML += `<p><strong>Bot:</strong> You're sending messages too quickly. Please wait a moment.</p>`;
        } else if (!response.ok) {
            throw new Error('Network response was not ok.');
        } else {
            const data = await response.json();
            chatBox.innerHTML += `<p><strong>Bot:</strong> ${data.response}</p>`;
        }

    } catch (error) {
        console.error('Fetch error:', error);
        chatBox.innerHTML += `<p><strong>Bot:</strong> Sorry, I'm having trouble connecting. Please try again later.</p>`;
    }
    
    chatBox.scrollTop = chatBox.scrollHeight;
}
