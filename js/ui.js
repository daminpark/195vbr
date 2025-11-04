// js/ui.js

/**
 * Renders the complete guidebook HTML to the page.
 * @param {object} allContent - The combined content object.
 * @param {object} [guestDetails={}] - Guest details for personalized welcome.
 * @param {string|null} [legacyTitle=null] - An override title for legacy pages.
 */
function renderPage(allContent, guestDetails = {}, legacyTitle = null) {
  const guidebookContainer = document.getElementById('guidebook-container');
  const tocContainer = document.getElementById('table-of-contents');

  // **MODIFICATION: Set static UI text using t() function**
  document.title = "195VBR Guidebook"; // This can remain static or be translated if needed
  const chatHeader = document.querySelector("#chat-header span");
  if(chatHeader) chatHeader.textContent = t('chat.header');
  const chatInput = document.getElementById('user-input');
  if(chatInput) chatInput.placeholder = t('chat.input_placeholder');
  const chatCloseBtn = document.getElementById('chat-close');
  if(chatCloseBtn) chatCloseBtn.setAttribute('aria-label', 'Close chat'); // Can be translated

  let welcomeHtml = '';
  if (legacyTitle) {
    welcomeHtml = `
      <h1>${legacyTitle}</h1>
      <p>This is a general guidebook. It contains helpful information for your stay. You can also ask our AI assistant, Victoria, any questions you may have.</p>
    `;
  } else if (guestDetails.guestFirstName) {
    const now = new Date();
    const checkInDate = new Date(guestDetails.checkInDateISO);
    const isDuringStay = now >= checkInDate;
    
    // **MODIFICATION: Use t() for translations**
    const welcomeHeader = t('welcome.header', { guestName: guestDetails.guestFirstName });
    const welcomeMessage = isDuringStay 
      ? t('welcome.during_stay')
      : t('welcome.confirmed_booking');
      
    welcomeHtml = `
      <section id="welcome">
        <h2>${welcomeHeader}</h2>
        <p><strong>${t('welcome.checkin_date')}:</strong> ${guestDetails.checkInDateFormatted}<br><strong>${t('welcome.checkout_date')}:</strong> ${guestDetails.checkOutDateFormatted}</p>
        <p>${welcomeMessage}</p>
      </section>`;
  } else {
     welcomeHtml = `
      <section id="welcome">
        <h2>${t('welcome.header_nouser')}</h2>
        <p>This guide provides helpful information for your stay. You can also ask our AI assistant, Victoria, any questions you may have.</p>
      </section>`;
  }

  let fullHtml = `${welcomeHtml}<div id="ha-dashboard"></div>`;
  let tocHtml = '<ul>';
  
  // **MODIFICATION: Use translation keys instead of English titles**
  const sectionOrder = ['what_not_to_bring', 'address', 'domestic_directions', 'airport_directions', 'getting_around', 'lock_info', 'checkin_luggage', 'checkout', 'wifi', 'heating_cooling', 'light_controls_note', 'bedroom', 'bathroom', 'kitchen', 'rubbish_disposal', 'windows', 'laundry', 'ironing', 'troubleshooting', 'tv', 'contact', 'local_guidebook'];
  
  sectionOrder.forEach(titleKey => {
    // Find the corresponding object key in allContent based on its title property
    // We check against the English title, as that's what's in the config object
    const sectionObjectKey = Object.keys(allContent).find(
      key => allContent[key].title && allContent[key].title.toLowerCase() === t('content_titles.' + titleKey, {}, 'en').toLowerCase()
    );

    if (sectionObjectKey && allContent[sectionObjectKey]) {
      const section = allContent[sectionObjectKey];
      const sectionId = section.title.toLowerCase().replace(/[^a-z0-9]+/g, '-');
      const translatedTitle = t('content_titles.' + titleKey); // Get title in current language

      fullHtml += `<section id="${sectionId}"><h2>${section.emoji} ${translatedTitle}</h2>${section.html}</section>`;
      tocHtml += `<li><a href="#${sectionId}">${section.emoji} ${translatedTitle}</a></li>`;
    }
  });


  tocHtml += '</ul>';
  guidebookContainer.innerHTML = fullHtml;
  tocContainer.innerHTML = tocHtml;
}

/**
 * Displays an error message on the page.
 * @param {string} type - 'missing' or 'denied'.
 * @param {string} [message=''] - A specific error message to display.
 */
function displayErrorPage(type, message = '') {
  const guidebookContainer = document.getElementById('guidebook-container');
  const tocContainer = document.getElementById('table-of-contents');
  document.getElementById('chat-launcher').style.display = 'none';
  tocContainer.innerHTML = '';
  let errorHtml;

  // **MODIFICATION: Use t() for translations**
  if (type === 'missing') {
    errorHtml = `<h1>${t('error_page.booking_not_found')}</h1><section id="error-message"><h2><span style="color: #d9534f;">&#9888;</span> ${t('error_page.invalid_link')}</h2><p>${t('error_page.missing_code_message')}</p></section>`;
  } else {
    errorHtml = `<h1>${t('error_page.access_denied')}</h1><section id="error-message"><h2><span style="color: #d9534f;">&#9888;</span> ${t('error_page.validation_failed')}</h2><p>${message}</p><p>${t('error_page.contact_message')}</p></section>`;
  }
  guidebookContainer.innerHTML = errorHtml;
}

/**
 * Sets up the hamburger menu for mobile devices.
 */
function setupMobileMenu() {
    const hamburgerBtn = document.getElementById('hamburger-btn');
    const nav = document.getElementById('table-of-contents');
    const overlay = document.getElementById('nav-overlay');
    const body = document.body;
    const toggleMenu = () => { nav.classList.toggle('nav-open'); overlay.classList.toggle('nav-open'); body.classList.toggle('nav-open'); };
    hamburgerBtn.addEventListener('click', toggleMenu);
    overlay.addEventListener('click', toggleMenu);
    nav.addEventListener('click', (e) => { if (e.target.tagName === 'A') { toggleMenu(); } });
}

/**
 * Configures the chat launcher to either open the widget or navigate to the chat page.
 */
function setupChatToggle() {
  const chatLauncher = document.getElementById('chat-launcher');
  const isMobile = () => window.innerWidth <= 768;

  const launchChat = (e) => {
    e.preventDefault();
    if (isMobile()) {
      const currentSearchParams = window.location.search;
      sessionStorage.setItem('chatbotContext', AppState.chatbotContext);
      sessionStorage.setItem('chatHistory', JSON.stringify(AppState.chatHistory));
      window.location.href = `chat.html${currentSearchParams}`;
    } else {
      document.documentElement.classList.add('chat-open');
      document.getElementById('user-input').focus();
    }
  };

  chatLauncher.addEventListener('click', launchChat);

  const closeBtn = document.getElementById('chat-close');
  if(closeBtn) {
    closeBtn.addEventListener('click', () => {
      document.documentElement.classList.remove('chat-open');
    });
  }
}

/**
 * Adds an event listener to the chat input field to send a message on Enter key press.
 */
function setupEnterKeyListener() {
  const userInputField = document.querySelector('#chat-widget #user-input');
  if (userInputField) { 
    userInputField.addEventListener('keypress', (e) => { 
      if (e.key === 'Enter' && !e.shiftKey) { 
        e.preventDefault(); 
        sendMessage(); 
      } 
    }); 
  }
}

/**
 * Adds the initial welcome message and suggestion chips to the chatbox.
 */
function addInitialBotMessage() {
    const chatBox = document.getElementById('chat-box');
    
    // **MODIFICATION: Use t() for translations**
    const welcomeMessageHtml = `<div class="message-bubble bot-message"><p>${t('chat.initial_message')}</p></div>`;
    
    const suggestionsHtml = `
        <div class="suggestions-container" id="suggestions-container">
            <button class="suggestion-chip">${t('chat.suggestion_checkin')}</button>
            <button class="suggestion-chip">${t('chat.suggestion_room')}</button>
            <button class="suggestion-chip">${t('chat.suggestion_entry')}</button>
        </div>
    `;

    chatBox.innerHTML = welcomeMessageHtml + suggestionsHtml;

    AppState.chatHistory = [{
        role: 'model',
        content: t('chat.initial_message'), // Store the translated message in history
        timestamp: new Date().toISOString()
    }];

    // ROBUST CLICK HANDLER
    const suggestionsContainer = document.getElementById('suggestions-container');
    if (suggestionsContainer) {
        suggestionsContainer.addEventListener('click', (e) => {
            if (e.target.classList.contains('suggestion-chip')) {
                const promptText = e.target.textContent;
                const userInputField = document.getElementById('user-input');
                const sendBtn = document.getElementById('send-btn');
                userInputField.value = promptText;
                sendBtn.click();
            }
        });
    }
}