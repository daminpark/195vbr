// js/ui.js

/**
 * Renders the complete guidebook HTML to the page.
 * Also initializes the language picker.
 */
function renderPage(allContent, guestDetails = {}, legacyTitle = null) {
  const guidebookContainer = document.getElementById('guidebook-container');
  // **FIX: Target the new list for ToC links, not the whole nav container**
  const tocListContainer = document.getElementById('toc-link-list'); 

  createLanguagePicker(); 
  
  document.title = "195VBR Guidebook"; 
  const chatHeader = document.querySelector("#chat-header span");
  if(chatHeader) chatHeader.textContent = t('chat.header');
  const chatInput = document.getElementById('user-input');
  if(chatInput) chatInput.placeholder = t('chat.input_placeholder');
  const chatCloseBtn = document.getElementById('chat-close');
  if(chatCloseBtn) chatCloseBtn.setAttribute('aria-label', 'Close chat'); 

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
    
    const welcomeHeader = t('welcome.header', { guestName: guestDetails.guestFirstName });
    const welcomeMessage = isDuringStay 
      ? t('welcome.during_stay')
      : t('welcome.confirmed_booking');

    const dateOptions = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
    const checkInDateFormatted = new Date(guestDetails.checkInDateISO).toLocaleDateString(I18nState.currentLanguage, dateOptions);
    const checkOutDateFormatted = new Date(guestDetails.checkOutDateISO).toLocaleDateString(I18nState.currentLanguage, dateOptions);
      
    welcomeHtml = `
      <section id="welcome">
        <h2>${welcomeHeader}</h2>
        <p><strong>${t('welcome.checkin_date')}:</strong> ${checkInDateFormatted}<br><strong>${t('welcome.checkout_date')}:</strong> ${checkOutDateFormatted}</p>
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
  let tocHtml = ''; // Build as a string
  
  const sectionOrder = ['what_not_to_bring', 'address', 'domestic_directions', 'airport_directions', 'getting_around', 'lock_info', 'checkin_luggage', 'checkout', 'wifi', 'heating_cooling', 'light_controls_note', 'bedroom', 'bathroom', 'kitchen', 'rubbish_disposal', 'windows', 'laundry', 'ironing', 'troubleshooting', 'tv', 'contact', 'local_guidebook'];
  
  sectionOrder.forEach(titleKey => {
    const englishTitleToFind = t('content_titles.' + titleKey, {}, 'en').toLowerCase();

    const sectionObjectKey = Object.keys(allContent).find(
      key => allContent[key].title && allContent[key].title.toLowerCase() === englishTitleToFind
    );

    if (sectionObjectKey && allContent[sectionObjectKey]) {
      const section = allContent[sectionObjectKey];
      const sectionId = section.title.toLowerCase().replace(/[^a-z0-9]+/g, '-');
      const translatedTitle = t('content_titles.' + titleKey);

      fullHtml += `<section id="${sectionId}"><h2>${section.emoji} ${translatedTitle}</h2>${section.html}</section>`;
      tocHtml += `<li><a href="#${sectionId}">${section.emoji} ${translatedTitle}</a></li>`;
    }
  });

  guidebookContainer.innerHTML = fullHtml;
  // **FIX: Populate the dedicated list, preserving the language picker**
  if (tocListContainer) {
    tocListContainer.innerHTML = tocHtml;
  }
}

/**
 * **FIX: Rewritten for robustness**
 * Creates and populates the language picker dropdown menus.
 */
async function createLanguagePicker() {
  const desktopContainer = document.getElementById('language-picker-desktop-container');
  const mobileContainer = document.getElementById('language-picker-mobile-container');
  if (!desktopContainer || !mobileContainer) return;

  const langNames = {};
  const promises = I18nState.supportedLanguages.map(async (lang) => {
    try {
      const response = await fetch(`/lang/${lang}.json`);
      if (response.ok) {
        const data = await response.json();
        langNames[lang] = data.langName;
      }
    } catch (e) {
      console.warn(`Could not fetch langName for ${lang}`);
    }
  });
  await Promise.all(promises);

  // **FIX: Create element programmatically instead of using innerHTML**
  const selectEl = document.createElement('select');
  selectEl.setAttribute('aria-label', 'Choose language');

  let optionsHtml = '';
  I18nState.supportedLanguages.forEach(lang => {
    const nativeName = langNames[lang] || lang;
    const selected = lang === I18nState.currentLanguage ? 'selected' : '';
    optionsHtml += `<option value="${lang}" ${selected}>${nativeName}</option>`;
  });
  selectEl.innerHTML = optionsHtml;

  const handleLanguageChange = (event) => {
    const newLang = event.target.value;
    localStorage.setItem('selectedLanguage', newLang);
    const url = new URL(window.location);
    url.searchParams.set('lang', newLang);
    window.location.href = url.toString();
  };
  
  // Clone for the mobile version
  const mobileSelectEl = selectEl.cloneNode(true);
  
  // Add listeners directly to the created elements (no need for getElementById)
  selectEl.addEventListener('change', handleLanguageChange);
  mobileSelectEl.addEventListener('change', handleLanguageChange);

  // Clear containers and append the new elements
  desktopContainer.innerHTML = '';
  mobileContainer.innerHTML = '';
  desktopContainer.appendChild(selectEl);
  mobileContainer.appendChild(mobileSelectEl);
}


/**
 * Displays an error message on the page.
 */
function displayErrorPage(type, message = '') {
  const guidebookContainer = document.getElementById('guidebook-container');
  const tocContainer = document.getElementById('table-of-contents');
  document.getElementById('chat-launcher').style.display = 'none';
  if(tocContainer) tocContainer.innerHTML = '';
  let errorHtml;

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
        content: t('chat.initial_message'),
        timestamp: new Date().toISOString()
    }];

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