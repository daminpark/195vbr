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
/* -----------------------------------------------------------
     4.  PRINT / SAVE‑AS‑PDF (native dialog)
  ----------------------------------------------------------- */
  // ... (your existing print button code is here) ...

  /* ========================================================= */
  /* ===== PASTE THE NEW CHATBOT JAVASCRIPT LOGIC HERE ======= */
  /* ========================================================= */

  /* -----------------------------------------------------------
     5.  CHAT POP-UP LOGIC
  ----------------------------------------------------------- */
/* -----------------------------------------------------------
     5.  CHAT POP-UP LOGIC (with Toggle and Click-Away)
  ----------------------------------------------------------- */
/* -----------------------------------------------------------
     5.  CHAT POP-UP LOGIC (Proper Toggle)
  ----------------------------------------------------------- */
  const chatLauncher = document.getElementById('chat-launcher');
  const chatWidget = document.getElementById('chat-widget');
  const chatIcon = document.getElementById('chat-icon');
  const closeIcon = document.getElementById('close-icon');

  if (chatLauncher && chatWidget && chatIcon && closeIcon) {
    chatLauncher.addEventListener('click', () => {
      // Toggle the visibility of the main chat widget
      chatWidget.classList.toggle('hidden');
      
      // Toggle which icon is shown inside the button
      chatIcon.classList.toggle('hidden');
      closeIcon.classList.toggle('hidden');
    });
  }
}); // <-- THIS IS THE CLOSING BRACKET OF THE DOMContentLoaded LISTENER

/* -----------------------------------------------------------
   6.  SEND MESSAGE FUNCTION (Place this OUTSIDE the DOMContentLoaded listener)
----------------------------------------------------------- */
async function sendMessage() {
    const userInputField = document.querySelector('#chat-widget #user-input');
    const userInput = userInputField.value;
    if (!userInput) return;

    // Display user's message in the chat box
    const chatBox = document.getElementById('chat-box');
    chatBox.innerHTML += `<p><strong>You:</strong> ${userInput}</p>`;
    userInputField.value = ''; // Clear the input field
    chatBox.scrollTop = chatBox.scrollHeight; // Scroll to the bottom

    // IMPORTANT: Replace this with the actual URL of your deployed serverless function
    const serverlessFunctionUrl = 'YOUR_SERVERLESS_FUNCTION_URL'; 

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
    
    chatBox.scrollTop = chatBox.scrollHeight; // Scroll to the bottom again after response
}

// Allow sending message with the Enter key
document.querySelector('#chat-widget #user-input').addEventListener('keypress', function (e) {
    if (e.key === 'Enter') {
        sendMessage();
    }
});
