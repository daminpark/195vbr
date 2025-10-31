let chatbotContext = '';
let chatHistory = [];
// This will hold the resize handler function so we can remove it later
let visualViewportResizeHandler = null;

document.addEventListener('DOMContentLoaded', async () => {
  await buildGuidebook();
  setupChatToggle();
  setupEnterKeyListener();
  addInitialBotMessage();
  setupMobileMenu();
});

async function buildGuidebook() {
  try {
    const response = await fetch('config.json');
    if (!response.ok) throw new Error('config.json not found');
    const config = await response.json();
    const params = new URLSearchParams(window.location.search);
    const bookingKey = params.keys().next().value || '31';
    const requiredKeys = config.bookings[bookingKey];
    if (!requiredKeys) throw new Error(`Booking key "${bookingKey}" not found.`);
    const staticContent = getStaticContent();
    const dynamicContent = buildDynamicContent(requiredKeys, config.contentFragments);
    const allContent = { ...staticContent, ...dynamicContent };
    const tocContainer = document.getElementById('table-of-contents');
    const guidebookContainer = document.getElementById('guidebook-container');
    let fullHtml = `<header class="site-header"><img src="logo.png" alt="195VBR Guesthouse Logo" class="logo" /></header><h1>195VBR Guidebook</h1>`;
    let tocHtml = '<ul>';
    const sectionOrder = [
      'video', 'what-not-to-bring', 'Address', 'domestic-directions', 'airport-directions', 
      'getting-around', 'codetimes', 'check-in-luggage', 'Wifi', 'heating', 'Bedroom', 
      'Bathroom', 'Kitchen', 'Windows', 'Laundry', 'troubleshooting', 'tv', 'contact', 'local-guidebook'
    ];
    sectionOrder.forEach(key => {
      if (allContent[key]) {
        const section = allContent[key];
        const sectionId = key.toLowerCase().replace(/\s/g, '-');
        fullHtml += `<section id="${sectionId}"><h2>${section.emoji} ${section.title}</h2>${section.html}</section>`;
        tocHtml += `<li><a href="#${sectionId}">${section.emoji} ${section.title}</a></li>`;
      }
    });
    tocHtml += '</ul>';
    guidebookContainer.innerHTML = fullHtml;
    tocContainer.innerHTML = tocHtml;
    buildChatbotContextFromPage();
  } catch (error) {
    console.error("Error building guidebook:", error);
    document.getElementById('guidebook-container').innerHTML = `<p>Error: Could not load guidebook. ${error.message}</p>`;
    chatbotContext = "You are a helpful assistant for 195VBR. Please inform the user that there was an error loading the specific guidebook information and that they should refer to the on-page text.";
  }
}

function setupMobileMenu() {
    const hamburgerBtn = document.getElementById('hamburger-btn');
    const nav = document.getElementById('table-of-contents');
    const overlay = document.getElementById('nav-overlay');
    const body = document.body;
    const toggleMenu = () => {
        nav.classList.toggle('nav-open');
        overlay.classList.toggle('nav-open');
        body.classList.toggle('nav-open');
    };
    hamburgerBtn.addEventListener('click', toggleMenu);
    overlay.addEventListener('click', toggleMenu);
    nav.addEventListener('click', (e) => { if (e.target.tagName === 'A') { toggleMenu(); } });
}

// --- CHATBOT UI & LOGIC ---

function setupChatToggle() {
  const chatLauncher = document.getElementById('chat-launcher');
  const chatWidget = document.getElementById('chat-widget');
  const closeBtn = document.getElementById('chat-close');
  const body = document.body;

  const openChat = () => {
    if (body.classList.contains('chat-open')) return;
    body.classList.add('chat-open');
    history.pushState({ chatOpen: true }, '');

    // Keyboard-aware resizing logic
    if (window.visualViewport) {
      const chatBox = document.getElementById('chat-box');
      visualViewportResizeHandler = () => {
        // Set the height of the widget to the visual viewport's height
        chatWidget.style.height = `${window.visualViewport.height}px`;
        // Ensure the latest message is visible
        chatBox.scrollTop = chatBox.scrollHeight;
      };
      window.visualViewport.addEventListener('resize', visualViewportResizeHandler);
      // Run once immediately to set initial size
      visualViewportResizeHandler();
    }
  };

  const closeChat = () => {
    if (!body.classList.contains('chat-open')) return;
    body.classList.remove('chat-open');

    // Clean up keyboard listener and inline styles
    if (window.visualViewport && visualViewportResizeHandler) {
      window.visualViewport.removeEventListener('resize', visualViewportResizeHandler);
      chatWidget.style.height = ''; // Reset height so CSS can take over
    }

    if (history.state && history.state.chatOpen) {
      history.back();
    }
  };
  
  chatLauncher.addEventListener('click', openChat);
  closeBtn.addEventListener('click', closeChat);
  window.addEventListener('popstate', () => {
    if (body.classList.contains('chat-open')) {
      body.classList.remove('chat-open');
       if (window.visualViewport && visualViewportResizeHandler) {
          window.visualViewport.removeEventListener('resize', visualViewportResizeHandler);
          chatWidget.style.height = '';
       }
    }
  });
}

function buildDynamicContent(keys, fragments) {
  const content = {};
  keys.forEach(key => {
    const fragment = fragments[key];
    if (fragment) {
      if (!content[fragment.title]) {
        const emoji = { "Address": "🏘️", "Wifi": "🛜", "Bedroom": "🛏️", "Bathroom": "🛁", "Kitchen": "🍳", "Windows": "🪟", "Laundry": "🧺" }[fragment.title] || 'ℹ️';
        content[fragment.title] = { title: fragment.title, emoji: emoji, html: '' };
      }
      content[fragment.title].html += fragment.html;
    }
  });
  return content;
}

function getStaticContent() { return { 'video': { title: 'Instructional Video Playlist', emoji: '🎬', html: `<p>This playlist contains all the instructional videos from this guide in one convenient location.</p><a href="https://www.youtube.com/playlist?list=PL7olRlH5yDt4Zk92CIS9fRnkYmC9gkcDh" target="_blank" rel="noopener noreferrer">Link to Full YouTube Playlist</a>` }, 'what-not-to-bring': { title: 'What not to bring', emoji: '🚫', html: `<p>We provide a variety of amenities so you can pack light! Here are some things you <em>don’t</em> need to bring:</p><ul><li><strong>Towels & Linens:</strong> Fresh bath towels and bed linens are provided.</li><li><strong>Toiletries:</strong> Shampoo, conditioner, body wash, and hand soap are available.</li><li><strong>Hair Dryers:</strong> Each bedroom has a hairdryer.</li><li><strong>Adapters:</strong> Rooms have universal adapters on each side of the bed.</li><li><strong>Extra Blankets:</strong> All beds include an electric under-blanket.</li></ul>` }, 'domestic-directions': { title: 'Domestic directions', emoji: '🚶', html: `<p><strong>By Train/Tube:</strong> We are ~7 minutes from <strong>London Victoria Station</strong>. Exit towards Victoria Street/Vauxhall Bridge Road, turn left, and walk ~5–7 minutes. The house will be on your left.</p><p><strong>By Coach:</strong> From Victoria Coach Station, it’s a ~10 minute walk.</p><p><strong>By Car/Taxi:</strong> We do not have on-site parking. Please check <a href="https://en.parkopedia.com/" target="_blank" rel="noopener noreferrer">Parkopedia</a> for public garages.</p>` }, 'airport-directions': { title: 'Airport directions', emoji: '✈️', html: `<p>Book buses at <a href="https://www.nationalexpress.com" target="_blank" rel="noopener noreferrer">National Express</a> and trains at <a href="https://www.thetrainline.com" target="_blank" rel="noopener noreferrer">The Trainline</a>.</p><p><strong>Gatwick (LGW):</strong> Take a Southern Rail train directly to Victoria (~35 mins). It's cheaper and only slightly slower than the Gatwick Express.</p><p><strong>Heathrow (LHR):</strong> Take the Piccadilly line (dark blue) and change at Hammersmith for a District line (green) train to Victoria (~50 mins total).</p><p><strong>Stansted (STN):</strong> Take the train to Tottenham Hale, then switch to the Victoria line (light blue) to Victoria Station. You cannot use contactless from Stansted.</p><p><strong>Luton (LTN):</strong> Take the train from Luton Airport Parkway to London St. Pancras (~40 mins), then the Victoria line to Victoria (~15 mins).</p>` }, 'getting-around': { title: 'Getting around', emoji: '🚇', html: `<p>Public transport is excellent. Victoria Station is ~7 minutes away. The <strong>24 bus</strong> stop near the house offers a scenic route through central London.</p><p>Use a contactless card for Tube/bus fares (they cap daily). London is very walkable, and you can also take a <strong>Thames river bus</strong> from Westminster Pier.</p>` }, 'codetimes': { title: 'Lock info', emoji: '*️⃣', html: `<p><strong>How to unlock:</strong> Press your palm to the black screen to activate the keypad. See the video playlist for a demonstration.</p><p><strong>Front door & Luggage (Cupboard V):</strong> Your code is valid from 11:00 on check-in day until 14:00 on check-out day.</p><p><strong>Bedroom/Bathroom/Kitchen:</strong> Your code is valid from 15:00 on check-in day until 11:00 on check-out day.</p><p><strong>Locking from inside:</strong> This video shows how to lock your bedroom door from the inside for privacy.</p><div class="video-container"><iframe src="https://www.youtube.com/embed/7orX7Wh_g1U" title="How to lock door from inside" allowfullscreen></iframe></div>` }, 'check-in-luggage': { title: 'Check-in & Luggage', emoji: '🧳', html: `<p><strong>Self Check-in:</strong> From 15:00 onwards.</p><p><strong>Early Luggage Drop-off:</strong> From 11:00, you can use your front door code to access Cupboard V downstairs.</p><p><strong>Luggage Storage After Check-out:</strong> Until 14:00, you can store bags in Cupboard V.</p><p>This video shows the full process:</p><div class="video-container"><iframe src="https://www.youtube.com/embed/rlUbHfWcN0s" title="Luggage drop-off process" allowfullscreen></iframe></div>` }, 'heating': { title: 'Heating and Cooling', emoji: '🌡️', html: `<p>The central heating is on an automatic schedule:</p><ul><li><strong>Morning (07:00 – 10:00):</strong> Rises to <strong>20.0°C</strong>.</li><li><strong>Daytime (10:00 – 17:00):</strong> Enters a cool, energy-saving mode at <strong>18.0°C</strong>.</li><li><strong>Evening (17:00 – 22:30):</strong> Warms to a comfortable <strong>21.0°C</strong>.</li><li><strong>Overnight:</strong> Lowers to <strong>17.0°C</strong>.</li></ul><p>You can boost the temperature at any time using the valve (TRV) on your radiator.</p><p><strong>Cooling:</strong> We do not have air conditioning. We recommend keeping the window and curtains closed during sunny days and opening them in the evening.</p>` }, 'troubleshooting': { title: 'Troubleshooting', emoji: '🛠️', html: `<p>If your digital door lock runs out of batteries, this video shows the simple replacement process:</p><div class="video-container"><iframe src="https://www.youtube.com/embed/8Zofre6A7ns" title="How to replace door lock batteries" allowfullscreen></iframe></div>` }, 'contact': { title: 'Contact', emoji: '☎️', html: `<p>For any questions, please check with our AI assistant, Vicky, first. For other matters, message us through your booking platform.</p><p><strong>*FOR EMERGENCIES ONLY*</strong>, please WhatsApp call +44 7443 618207. If there is no answer, try +44 7383 298999.</p>` }, 'tv': { title: 'TV', emoji: '📺', html: `<p>Each bedroom has a Smart 4K TV with Disney+, Apple TV+, Amazon Prime Video, BBC iPlayer, and more. If a service is logged out or malfunctions, please contact us and we can log you in remotely.</p>` }, 'local-guidebook': { title: 'Local Guidebook', emoji: '📍', html: `<h3>Food</h3><ul><li><a href="https://www.google.com/maps/search/?api=1&query=Regency+Cafe+London" target="_blank">Regency Cafe</a> – Classic English breakfast.</li><li><a href="https://www.google.com/maps/search/?api=1&query=Jugged+Hare+London" target="_blank">Jugged Hare</a> – Great pub across the road.</li><li><a href="https://www.google.com/maps/search/?api=1&query=Tachbrook+Street+Market+London" target="_blank">Tachbrook Street Market</a> – Weekday lunch market.</li><li><a href="https://www.google.com/maps/search/?api=1&query=A+Wong+70+Wilton+Road+London" target="_blank">A. Wong</a> – Michelin-starred Chinese food.</li><li><a href="https://www.google.com/maps/search/?api=1&query=Sainsbury%27s+Victoria+Station" target="_blank">Sainsbury's</a> – Large supermarket in Victoria Station.</li></ul><h3>Sights</h3><ul><li>Wicked and Hamilton – Two of the world's best musicals are right on our doorstep.</li><li>St James's Park – A beautiful royal park, perfect for a stroll.</li><li>A great walk: Start at Big Ben, cross Westminster Bridge, and walk along the scenic South Bank to Tower Bridge.</li></ul>` } }; }

function buildChatbotContextFromPage() {
  const mainContainer = document.querySelector('main.container');
  if (mainContainer) {
    const guidebookText = mainContainer.innerText;
    const cleanedText = guidebookText.replace(/(\s\s)\s+/g, '$1').trim();
    const systemPrompt = "You are 'Vicky', a friendly AI assistant for the 195VBR guesthouse. You MUST base your answer ONLY on the detailed guidebook information provided below. For all other questions, you should use your general knowledge. Be concise, friendly, and use Markdown for formatting links like [Link Text](URL).";
    chatbotContext = `${systemPrompt}\n\nRELEVANT GUIDEBOOK CONTENT:\n${cleanedText}`;
  }
}

function setupEnterKeyListener() {
  const userInputField = document.querySelector('#chat-widget #user-input');
  if (userInputField) { userInputField.addEventListener('keypress', (e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); } }); }
}

function addInitialBotMessage() {
    const chatBox = document.getElementById('chat-box');
    const welcomeMessage = `<div class="message-bubble bot-message"><p>Welcome to 195VBR! I'm Vicky, your AI assistant. Ask me anything about the guesthouse or your London trip.</p></div>`;
    chatBox.innerHTML = welcomeMessage;
}

async function sendMessage() {
    const userInputField = document.getElementById('user-input');
    const sendBtn = document.getElementById('send-btn');
    const userInput = userInputField.value.trim();
    if (!userInput || sendBtn.disabled) return;
    const chatBox = document.getElementById('chat-box');
    const getTimeStamp = () => new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const userMessageHtml = `<div class="message-bubble user-message"><p>${userInput}</p></div><div class="timestamp">${getTimeStamp()}</div>`;
    chatBox.insertAdjacentHTML('beforeend', userMessageHtml);
    chatHistory.push({ role: 'user', content: userInput });
    userInputField.value = '';
    userInputField.disabled = true;
    sendBtn.disabled = true;
    chatBox.scrollTop = chatBox.scrollHeight;
    const typingIndicatorHtml = `<div class="message-bubble bot-message typing-indicator"><span></span><span></span><span></span></div>`;
    chatBox.insertAdjacentHTML('beforeend', typingIndicatorHtml);
    chatBox.scrollTop = chatBox.scrollHeight;
    const typingIndicator = chatBox.querySelector('.typing-indicator');
    const serverlessFunctionUrl = 'https://guidebook-chatbot-backend.vercel.app/api/chatbot';
    try {
        const response = await fetch(serverlessFunctionUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ history: chatHistory, context: chatbotContext })
        });
        if (!response.ok) { const errorData = await response.json(); throw new Error(errorData.error || `Network response was not ok.`); }
        typingIndicator.remove();
        const botMessageContainer = document.createElement('div');
        botMessageContainer.className = 'message-bubble bot-message';
        chatBox.appendChild(botMessageContainer);
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let fullResponse = '';
        while (true) {
            const { value, done } = await reader.read();
            if (done) break;
            fullResponse += decoder.decode(value, { stream: true });
            botMessageContainer.innerHTML = marked.parse(fullResponse);
            chatBox.scrollTop = chatBox.scrollHeight;
        }
        chatHistory.push({ role: 'model', content: fullResponse });
        const timestampHtml = `<div class="timestamp">${getTimeStamp()}</div>`;
        chatBox.insertAdjacentHTML('beforeend', timestampHtml);
    } catch (error) {
        console.error('Fetch error:', error);
        typingIndicator.remove();
        const errorHtml = `<div class="message-bubble bot-message"><p>Sorry, I'm having trouble connecting. Please try again later.</p></div><div class="timestamp">${getTimeStamp()}</div>`;
        chatBox.insertAdjacentHTML('beforeend', errorHtml);
    } finally {
        userInputField.disabled = false;
        sendBtn.disabled = false;
        userInputField.focus();
        chatBox.scrollTop = chatBox.scrollHeight;
    }
}