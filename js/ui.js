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

  let welcomeHtml = '';
  if (legacyTitle) {
    welcomeHtml = `<h1>${legacyTitle}</h1>`;
  } else if (guestDetails.guestFirstName) {
    const now = new Date();
    const checkInDate = new Date(guestDetails.checkInDateISO);
    const isDuringStay = now >= checkInDate;
    const welcomeHeader = isDuringStay ? `Welcome, ${guestDetails.guestFirstName}'s group!` : `Hi ${guestDetails.guestFirstName}'s group!`;
    const welcomeMessage = isDuringStay 
      ? `Welcome to our guidebook, where you can find information, chat with our AI assistant, and see and control your room's heating.`
      : `Your booking is confirmed for these dates. Please have a look through the guidebook, where you'll find key information and our AI assistant. During your stay, this page will also let you see and control your room's heating.`;
      
    welcomeHtml = `
      <section id="welcome">
        <h2>${welcomeHeader}</h2>
        <p><strong>Check-in:</strong> ${guestDetails.checkInDateFormatted}<br><strong>Check-out:</strong> ${guestDetails.checkOutDateFormatted}</p>
        <p>${welcomeMessage}</p>
      </section>`;
  } else {
     welcomeHtml = `
      <section id="welcome">
        <h2>Welcome to the Guidebook!</h2>
        <p>This guide provides helpful information for your stay. You can also ask our AI assistant, Victoria, any questions you may have.</p>
      </section>`;
  }

  let fullHtml = `${welcomeHtml}<div id="ha-dashboard"></div>`;
  let tocHtml = '<ul>';
  const sectionOrder = ['video', 'what-not-to-bring', 'Address', 'domestic-directions', 'airport-directions', 'getting-around', 'codetimes', 'Check-in & Luggage', 'checkout', 'Wifi', 'heating', 'lights-note', 'Bedroom', 'Bathroom', 'Kitchen', 'Rubbish Disposal', 'Windows', 'Laundry', 'ironing', 'troubleshooting', 'tv', 'contact', 'local-guidebook'];
  
  sectionOrder.forEach(key => {
    const sectionObjectKey = Object.keys(allContent).find(k => k.toLowerCase() === key.toLowerCase());
    if (sectionObjectKey && allContent[sectionObjectKey]) {
      const section = allContent[sectionObjectKey];
      const sectionId = section.title.toLowerCase().replace(/[^a-z0-9]+/g, '-');
      fullHtml += `<section id="${sectionId}"><h2>${section.emoji} ${section.title}</h2>${section.html}</section>`;
      tocHtml += `<li><a href="#${sectionId}">${section.emoji} ${section.title}</a></li>`;
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
  if (type === 'missing') {
    errorHtml = `<h1>Booking Not Found</h1><section id="error-message"><h2><span style="color: #d9534f;">&#9888;</span> Invalid Access Link</h2><p>Your link is missing a booking code. Please use the exact link provided to you.</p></section>`;
  } else {
    errorHtml = `<h1>Access Denied</h1><section id="error-message"><h2><span style="color: #d9534f;">&#9888;</span> Validation Failed</h2><p>${message}</p><p>Please ensure you are using the correct, most recent link. If you continue to have trouble, please contact us through your booking platform.</p></section>`;
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
    
    const welcomeMessageHtml = `<div class="message-bubble bot-message"><p>Welcome! I'm Victoria, your AI assistant. Ask me anything about the guesthouse or your London trip.</p></div>`;
    const suggestionsHtml = `
        <div class="suggestions-container" id="suggestions-container">
            <button class="suggestion-chip">What's the Wi-Fi password?</button>
            <button class="suggestion-chip">How do I check out?</button>
            <button class="suggestion-chip">How does the heating work?</button>
        </div>
    `;

    chatBox.innerHTML = welcomeMessageHtml + suggestionsHtml;

    AppState.chatHistory = [{
        role: 'model',
        content: "Welcome! I'm Victoria, your AI assistant. Ask me anything about the guesthouse or your London trip.",
        timestamp: new Date().toISOString()
    }];

    // Add a listener to handle clicks on the suggestion chips
    const suggestionsContainer = document.getElementById('suggestions-container');
    if (suggestionsContainer) {
        suggestionsContainer.addEventListener('click', (e) => {
            if (e.target.classList.contains('suggestion-chip')) {
                // The only job of the click handler is to get the text and send it.
                sendMessage(e.target.textContent);
            }
        });
    }
}