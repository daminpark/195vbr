// --- A SINGLE SOURCE OF TRUTH FOR THE BACKEND URL ---
// For testing the 'ical-auth' branch, we use the preview URL.
const BACKEND_API_BASE_URL = 'https://guidebook-chatbot-backend-git-ical-auth-pierre-parks-projects.vercel.app';
// For PRODUCTION, this will be changed to: 'https://guidebook-chatbot-backend.vercel.app'

let guestAccessLevel = null;
let chatbotContext = '';
let chatHistory = [];
// This will be populated after validation and used by HA functions
let currentBookingConfig = {}; 

document.addEventListener('DOMContentLoaded', async () => {
  const params = new URLSearchParams(window.location.search);
  const opaqueBookingKey = params.get('booking');

  if (!opaqueBookingKey) {
    displayErrorPage('missing');
    return;
  }
  
  const validationResult = await validateAccess(opaqueBookingKey);

  if (validationResult.success) {
    guestAccessLevel = validationResult.access;
    await buildGuidebook(opaqueBookingKey);
    setupChatToggle();
    setupEnterKeyListener();
    addInitialBotMessage();
    setupMobileMenu();
  } else {
    displayErrorPage('denied', validationResult.error);
  }
});

function displayErrorPage(type, message = '') {
  const guidebookContainer = document.getElementById('guidebook-container');
  const tocContainer = document.getElementById('table-of-contents');
  document.getElementById('chat-launcher').style.display = 'none';
  tocContainer.innerHTML = '';

  let errorHtml;
  if (type === 'missing') {
    errorHtml = `
      <header class="site-header"><img src="logo.png" alt="195VBR Guesthouse Logo" class="logo" /></header>
      <h1>Booking Not Found</h1>
      <section id="error-message"><h2><span style="color: #d9534f;">&#9888;</span> Invalid Access Link</h2><p>Your link is missing a booking code. Please use the exact link provided to you.</p></section>`;
  } else {
    errorHtml = `
      <header class="site-header"><img src="logo.png" alt="195VBR Guesthouse Logo" class="logo" /></header>
      <h1>Access Denied</h1>
      <section id="error-message"><h2><span style="color: #d9534f;">&#9888;</span> Validation Failed</h2><p>${message}</p><p>Please ensure you are using the correct, most recent link. If you continue to have trouble, please contact us through your booking platform.</p></section>`;
  }
  guidebookContainer.innerHTML = errorHtml;
}

async function validateAccess(opaqueBookingKey) {
  const guidebookContainer = document.getElementById('guidebook-container');
  guidebookContainer.innerHTML = `<h1>Validating Access...</h1><p>Please wait a moment.</p>`;

  const validationUrl = `${BACKEND_API_BASE_URL}/api/validate-booking?booking=${opaqueBookingKey}`;

  try {
    const response = await fetch(validationUrl);
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'Unknown validation error.');
    console.log('Access validation successful:', data);
    return { success: true, access: data.access };
  } catch (error) {
    console.error('Validation API call failed:', error);
    return { success: false, error: error.message };
  }
}

async function buildGuidebook(opaqueBookingKey) {
  const guidebookContainer = document.getElementById('guidebook-container');
  const tocContainer = document.getElementById('table-of-contents');

  try {
    const response = await fetch('config.json');
    if (!response.ok) throw new Error('config.json not found');
    const config = await response.json();
    const bookingKey = opaqueBookingKey.split('-')[0];
    
    currentBookingConfig = config.bookings[bookingKey]; // Store for later
    if (!currentBookingConfig) throw new Error(`Booking key "${bookingKey}" not found in config.json.`);
    
    const requiredKeys = currentBookingConfig.content;
    const staticContent = getStaticContent();
    const dynamicContent = buildDynamicContent(requiredKeys, config.contentFragments);
    const allContent = { ...staticContent, ...dynamicContent };
    
    let fullHtml = `<header class="site-header"><img src="logo.png" alt="195VBR Guesthouse Logo" class="logo" /></header><h1>195VBR Guidebook</h1><div id="ha-dashboard"></div>`;
    let tocHtml = '<ul>';
    const sectionOrder = ['video', 'what-not-to-bring', 'Address', 'domestic-directions', 'airport-directions', 'getting-around', 'codetimes', 'Check-in & Luggage', 'Wifi', 'heating', 'Bedroom', 'Bathroom', 'Kitchen', 'Rubbish Disposal', 'Windows', 'Laundry', 'ironing', 'troubleshooting', 'tv', 'contact', 'local-guidebook'];
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
    buildChatbotContextFromPage();

    if (currentBookingConfig.house && currentBookingConfig.entities) {
      createDashboardCards(currentBookingConfig);
      displayHomeAssistantStatus(currentBookingConfig);
      setInterval(() => displayHomeAssistantStatus(currentBookingConfig), 600000); 
    }
  } catch (error) {
    console.error("Error building guidebook:", error);
    displayErrorPage('denied', `Could not load guidebook configuration. ${error.message}`);
  }
}

function createDashboardCards(bookingConfig) {
    const { house, entities } = bookingConfig;
    const dashboard = document.getElementById('ha-dashboard');
    if (!dashboard) return;
    let cardsHtml = '';
    const entityKeys = Object.keys(entities).sort((a, b) => a === 'weather' ? -1 : b === 'weather' ? 1 : 0);
    entityKeys.forEach(key => {
        if (key === 'weather') {
            cardsHtml += `<div class="ha-card weather-card" id="ha-card-weather"><div class="weather-top-row" id="ha-weather-top-row">Loading Weather...</div><div class="weather-forecast" id="ha-weather-daily"></div></div>`;
        } else if (key === 'climate' && guestAccessLevel === 'full') {
            const climateEntities = entities[key];
            let climateHtml = '';
            climateEntities.forEach(entityId => {
                const entityName = entityId.replace('climate.', '').replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
                climateHtml += `<div class="climate-entity" id="climate-${entityId}"><span class="climate-icon material-symbols-outlined">thermostat</span><div class="climate-name">${entityName}</div><div class="climate-temp-display">Current: --° | Mode: --</div><div class="climate-controls"><button class="temp-down" data-entity="${entityId}">-</button><div class="climate-set-temp">--°</div><button class="temp-up" data-entity="${entityId}">+</button></div></div>`;
            });
            cardsHtml += `<div class="ha-card climate-card">${climateHtml}</div>`;
        } else if (guestAccessLevel === 'full') {
            cardsHtml += `<div class="ha-card"><div class="ha-card-title">${formatCardTitle(key, house)}</div><div class="ha-card-status" id="ha-status-${key}">Loading...</div></div>`;
        }
    });
    if (!cardsHtml.trim()) {
        dashboard.style.display = 'none';
    } else {
        dashboard.innerHTML = cardsHtml;
    }
    document.querySelectorAll('.temp-down, .temp-up').forEach(button => {
        button.addEventListener('click', handleTemperatureChange);
    });
}

async function fetchHAData(entityId, house, type = 'state') {
  const proxyUrl = `${BACKEND_API_BASE_URL}/api/ha-proxy`;
  const response = await fetch(`${proxyUrl}?house=${house}&entity=${entityId}&type=${type}`);
  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(`Proxy API Error for type '${type}': ${errorData.error || response.statusText}`);
  }
  return response.json();
}

async function setTemperature(entityId, newTemp, house) {
    const proxyUrl = `${BACKEND_API_BASE_URL}/api/ha-proxy`;
    try {
        const response = await fetch(proxyUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ house, entity: entityId, type: 'set_temperature', temperature: newTemp })
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || 'Failed to set temperature.');
        console.log('Successfully set temperature:', data);
        displayHomeAssistantStatus(currentBookingConfig); 
    } catch (error) {
        console.error('Error setting temperature:', error);
    }
}

function handleTemperatureChange(event) {
    const button = event.currentTarget;
    const entityId = button.dataset.entity;
    const container = document.getElementById(`climate-${entityId}`);
    const setTempEl = container.querySelector('.climate-set-temp');
    let currentSetTemp = parseFloat(setTempEl.textContent);
    if (isNaN(currentSetTemp)) return;
    let newTemp = button.classList.contains('temp-up') ? Math.min(currentSetTemp + 0.5, 25) : Math.max(currentSetTemp - 0.5, 7);
    container.querySelectorAll('button').forEach(b => b.disabled = true);
    setTempEl.textContent = `${newTemp.toFixed(1)}°`;
    setTemperature(entityId, newTemp, currentBookingConfig.house);
}

// (The full, correct displayHomeAssistantStatus function is included here)
async function displayHomeAssistantStatus(bookingConfig) {
  const { house, entities } = bookingConfig;
  if (!house || !entities) return;

  for (const [key, entityValue] of Object.entries(entities)) {
    if (key === 'weather') {
      try {
        const [currentState, hourlyForecast, dailyForecast] = await Promise.all([
            fetchHAData(entityValue, house, 'state'),
            fetchHAData(entityValue, house, 'hourly_forecast'),
            fetchHAData(entityValue, house, 'daily_forecast')
        ]);
        const topRowContainer = document.getElementById('ha-weather-top-row');
        if (topRowContainer) {
            let topRowHtml = `<div class="weather-item current-weather-item"><div class="weather-item-label">Now</div><span class="weather-item-icon material-symbols-outlined">${weatherIconMap[currentState.state] || 'sunny'}</span><div class="weather-item-temp">${Math.round(currentState.attributes.temperature)}°</div></div>`;
            hourlyForecast.slice(1, 5).forEach(hour => {
                const time = new Date(hour.datetime).toLocaleTimeString('en-US', { hour: 'numeric', hour12: false });
                topRowHtml += `<div class="weather-item"><div class="weather-item-label">${time}</div><span class="weather-item-icon material-symbols-outlined">${weatherIconMap[hour.condition] || 'sunny'}</span><div class="weather-item-temp">${Math.round(hour.temperature)}°</div></div>`;
            });
            topRowContainer.innerHTML = topRowHtml;
        }
        const dailyContainer = document.getElementById('ha-weather-daily');
        if (dailyContainer) {
            let dailyHtml = '';
            dailyForecast.slice(0, 4).forEach((day, index) => {
                const dayName = index === 0 ? 'Today' : new Date(day.datetime).toLocaleDateString('en-US', { weekday: 'short' });
                dailyHtml += `<div class="forecast-day"><div class="forecast-day-name">${dayName}</div><span class="forecast-day-icon material-symbols-outlined">${weatherIconMap[day.condition] || 'sunny'}</span><div class="forecast-day-temp">${Math.round(day.temperature)}°<span class="forecast-day-temp-low">${Math.round(day.templow)}°</span></div></div>`;
            });
            dailyContainer.innerHTML = dailyHtml;
        }
      } catch (error) {
        console.error('Full weather fetch error:', error);
        const topRowContainer = document.getElementById('ha-weather-top-row');
        const dailyContainer = document.getElementById('ha-weather-daily');
        const errorMessage = '<p style="font-size: 0.8rem; color: gray; text-align: center; width: 100%;">Weather data unavailable.</p>';
        if (dailyContainer) dailyContainer.innerHTML = errorMessage;
        if (topRowContainer) topRowContainer.innerHTML = '';
      }
    } else if (key === 'climate' && guestAccessLevel === 'full') {
        const climateEntities = entityValue;
        climateEntities.forEach(async (entityId) => {
            const container = document.getElementById(`climate-${entityId}`);
            if (container) {
                try {
                    const state = await fetchHAData(entityId, house);
                    const { current_temperature, temperature, hvac_mode } = state.attributes;
                    const modeText = hvac_mode.charAt(0).toUpperCase() + hvac_mode.slice(1);
                    container.querySelector('.climate-temp-display').textContent = `Current: ${current_temperature.toFixed(1)}° | Mode: ${modeText}`;
                    container.querySelector('.climate-set-temp').textContent = `${temperature.toFixed(1)}°`;
                    container.querySelectorAll('button').forEach(b => b.disabled = false);
                } catch (error) {
                    console.error(`Climate fetch error for ${entityId}:`, error);
                    container.querySelector('.climate-temp-display').textContent = 'Status unavailable';
                }
            }
        });
    } else if (guestAccessLevel === 'full') {
        const statusElement = document.getElementById(`ha-status-${key}`);
        if (statusElement) {
          try {
            const state = await fetchHAData(entityValue, house);
            const statusText = state.state === 'on' ? 'Occupied' : 'Vacant';
            const statusColor = state.state === 'on' ? '#d9534f' : '#5cb85c';
            statusElement.textContent = statusText;
            statusElement.style.color = statusColor;
          } catch (error) {
            console.error(`Occupancy fetch error for ${key}:`, error);
            statusElement.textContent = 'Unavailable';
            statusElement.style.color = 'gray';
          }
        }
    }
  }
}

async function sendMessage() {
    // ... existing function ...
    // --- THIS IS THE ONLY LINE THAT CHANGES ---
    const serverlessFunctionUrl = `${BACKEND_API_BASE_URL}/api/chatbot`;
    // ... rest of the function ...
    try {
        const response = await fetch(serverlessFunctionUrl, {
            // ...
        });
        // ...
    } catch (error) {
        // ...
    } finally {
        // ...
    }
}


// --- PASTE ALL REMAINING ORIGINAL/UNCHANGED FUNCTIONS HERE ---
// e.g., formatCardTitle, weatherIconMap, setupMobileMenu, setupChatToggle, etc.
// The only function you need to make sure is updated is `sendMessage` as shown below.

function formatCardTitle(key, houseNumber) {
    const title = key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
    return `House ${houseNumber} ${title}`;
}

const weatherIconMap = {
    'clear-night': 'clear_night', 'cloudy': 'cloudy', 'fog': 'foggy', 'hail': 'weather_hail',
    'lightning': 'thunderstorm', 'lightning-rainy': 'thunderstorm', 'partlycloudy': 'partly_cloudy_day',
    'pouring': 'rainy', 'rainy': 'rainy', 'snowy': 'weather_snowy', 'snowy-rainy': 'weather_snowy',
    'sunny': 'sunny', 'windy': 'windy', 'windy-variant': 'windy', 'exceptional': 'warning'
};

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

function setupChatToggle() {
  const htmlEl = document.documentElement;
  const closeBtn = document.getElementById('chat-close');
  const chatLauncher = document.getElementById('chat-launcher');

  const openChat = () => {
    if (htmlEl.classList.contains('chat-open')) return;
    htmlEl.classList.add('chat-open');
    history.pushState({ chatOpen: true }, '');
  };

  const closeChat = () => {
    if (!htmlEl.classList.contains('chat-open')) return;
    htmlEl.classList.remove('chat-open');
    if (history.state && history.state.chatOpen) {
      history.back();
    }
  };

  chatLauncher.addEventListener('click', openChat);
  closeBtn.addEventListener('click', closeChat);

  window.addEventListener('popstate', () => {
    if (htmlEl.classList.contains('chat-open')) {
      htmlEl.classList.remove('chat-open');
    }
  });
}

function buildDynamicContent(keys, fragments) {
  const content = {};
  keys.forEach(key => {
    const fragment = fragments[key];
    if (fragment) {
      if (!content[fragment.title]) {
        const emoji = { "Address": "🏘️", "Wifi": "🛜", "Bedroom": "🛏️", "Bathroom": "🛁", "Kitchen": "🍳", "Windows": "🪟", "Laundry": "🧺", "Check-in & Luggage": "🧳", "Rubbish Disposal": "🗑️"}[fragment.title] || 'ℹ️';
        content[fragment.title] = { title: fragment.title, emoji: emoji, html: '' };
      }
      content[fragment.title].html += fragment.html;
    }
  });
  return content;
}

function getStaticContent() { return { 'video': { title: 'Instructional Video Playlist', emoji: '🎬', html: `<p>This playlist contains all the instructional videos from this guide in one convenient location.</p><a href="https://www.youtube.com/playlist?list=PL7olRlH5yDt4Zk_2CIS9fRnkYmC9gkcDh" target="_blank" rel="noopener noreferrer">Link to Full YouTube Playlist</a>` }, 'what-not-to-bring': { title: 'What not to bring', emoji: '🚫', html: `<p>We provide a variety of amenities so you can pack light! Here are some things you <em>don’t</em> need to bring:</p><ul><li><strong>Towels & Linens:</strong> Fresh bath towels and bed linens are provided.</li><li><strong>Toiletries:</strong> Shampoo, conditioner, body wash, and hand soap are available.</li><li><strong>Hair Dryers:</strong> Each bedroom has a hairdryer.</li><li><strong>Adapters:</strong> Rooms have universal adapters on each side of the bed.</li><li><strong>Extra Blankets:</strong> All beds include an electric under-blanket.</li></ul>` }, 'domestic-directions': { title: 'Domestic directions', emoji: '🚶', html: `<p><strong>By Train/Tube:</strong> We are ~7 minutes from <strong>London Victoria Station</strong>. Exit towards Victoria Street/Vauxhall Bridge Road, turn left, and walk ~5–7 minutes. The house will be on your left.</p><p><strong>By Coach:</strong> From Victoria Coach Station, it’s a ~10 minute walk.</p><p><strong>By Car/Taxi:</strong> We do not have on-site parking. Please check <a href="https://en.parkopedia.com/" target="_blank" rel="noopener noreferrer">Parkopedia</a> for public garages.</p>` }, 'airport-directions': { title: 'Airport directions', emoji: '✈️', html: `<p>Book buses at <a href="https://www.nationalexpress.com" target="_blank" rel="noopener noreferrer">National Express</a> and trains at <a href="https://www.thetrainline.com" target="_blank" rel="noopener noreferrer">The Trainline</a>.</p><p><strong>Gatwick (LGW):</strong> Take a Southern Rail train directly to Victoria (~35 mins). It's cheaper and only slightly slower than the Gatwick Express.</p><p><strong>Heathrow (LHR):</strong> Take the Piccadilly line (dark blue) and change at Hammersmith for a District line (green) train to Victoria (~50 mins total).</p><p><strong>Stansted (STN):</strong> Take the train to Tottenham Hale, then switch to the Victoria line (light blue) to Victoria Station. You cannot use contactless from Stansted.</p><p><strong>Luton (LTN):</strong> Take the train from Luton Airport Parkway to London St. Pancras (~40 mins), then the Victoria line to Victoria (~15 mins).</p>` }, 'getting-around': { title: 'Getting around', emoji: '🚇', html: `<p>Public transport is excellent. Victoria Station is ~7 minutes away. The <strong>24 bus</strong> stop near the house offers a scenic route through central London.</p><p>Use a contactless card for Tube/bus fares (they cap daily). London is very walkable, and you can also take a <strong>Thames river bus</strong> from Westminster Pier.</p>` }, 'codetimes': { title: 'Lock info', emoji: '*️⃣', html: `<p><strong>How to unlock:</strong> Press your palm to the black screen to activate the keypad. See the video playlist for a demonstration.</p><p><strong>Front door & Luggage (Cupboard V):</strong> Your code is valid from 11:00 on check-in day until 14:00 on check-out day.</p><p><strong>Bedroom/Bathroom/Kitchen:</strong> Your code is valid from 15:00 on check-in day until 11:00 on check-out day.</p><p><strong>Locking from inside:</strong> This video shows how to lock your bedroom door from the inside for privacy.</p><div class="video-container"><iframe src="https://www.youtube.com/embed/7orX7Wh_g1U" title="How to lock door from inside" allowfullscreen></iframe></div>` }, 'heating': { title: 'Heating and Cooling', emoji: '🌡️', html: `<p>The central heating is on an automatic schedule:</p><ul><li><strong>Morning (07:00 – 10:00):</strong> Rises to <strong>20.0°C</strong>.</li><li><strong>Daytime (10:00 – 17:00):</strong> Enters a cool, energy-saving mode at <strong>18.0°C</strong>.</li><li><strong>Evening (17:00 – 22:30):</strong> Warms to a comfortable <strong>21.0°C</strong>.</li><li><strong>Overnight:</strong> Lowers to <strong>17.0°C</strong>.</li></ul><p>You can boost the temperature at any time using the valve (TRV) on your radiator.</p><p><strong>Cooling:</strong> We do not have air conditioning. We recommend keeping the window and curtains closed during sunny days and opening them in the evening.</p>` }, 'ironing': { title: 'Iron & Ironing Mat', emoji: '👕', html: `<p>An iron and a portable ironing mat can be found in the kitchen. The mat can be placed on a table or other firm surface for use. Please return both items to the kitchen when you are finished.</p>` }, 'troubleshooting': { title: 'Troubleshooting', emoji: '🛠️', html: `<p>If your digital door lock runs out of batteries, this video shows the simple replacement process:</p><div class="video-container"><iframe src="https://www.youtube.com/embed/8Zofre6A7ns" title="How to replace door lock batteries" allowfullscreen></iframe></div>` }, 'contact': { title: 'Contact', emoji: '☎️', html: `<p>For any questions, please check with our AI assistant, Victoria, first. For other matters, message us through your booking platform.</p><p><strong>*FOR EMERGENCIES ONLY*</strong>, please WhatsApp call +44 7443 618207. If there is no answer, try +44 7383 298999.</p>` }, 'tv': { title: 'TV', emoji: '📺', html: `<p>Each bedroom has a Smart 4K TV with Disney+, Apple TV+, Amazon Prime Video, BBC iPlayer, and more. If a service is logged out or malfunctions, please contact us and we can log you in remotely.</p>` }, 'local-guidebook': { title: 'Local Guidebook', emoji: '📍', html: `<h3>Food</h3><ul><li><a href="https://www.google.com/maps/search/?api=1&query=Regency+Cafe+London" target="_blank" rel="noopener">Regency Cafe</a> – traditional full English breakfast</li><li><a href="https://www.google.com/maps/search/?api=1&query=Jugged+Hare+London" target="_blank" rel="noopener">Jugged Hare</a> – great pub across the road</li><li><a href="https://www.google.com/maps/search/?api=1&query=Tachbrook+Street+Market+London" target="_blank" rel="noopener">Tachbrook Street Market</a> – local market for lunch on weekdays</li><li><a href="https://www.google.com/maps/search/?api=1&query=Kimchimama+London" target="_blank" rel="noopener">Kimchimama</a> – casual Korean food (especially fried chicken)</li><li><a href="https://www.google.com/maps/search/?api=1&query=Ben+Venuti+London" target="_blank" rel="noopener">Ben Venuti</a> – amazing Italian cafe around the corner</li><li><a href="https://www.google.com/maps/search/?api=1&query=Tozi+London" target="_blank" rel="noopener">Tozi</a> – upscale Italian restaurant nearby</li><li><a href="https://www.google.com/maps/search/?api=1&query=A+Wong+70+Wilton+Road+London" target="_blank" rel="noopener">A. Wong</a> – Michelin-starred Chinese restaurant behind the house</li><li><a href="https://www.google.com/maps/search/?api=1&query=Little+Waitrose+London" target="_blank" rel="noopener">Little Waitrose</a> – closest upmarket supermarket</li><li><a href="https://www.google.com/maps/search/?api=1&query=Sainsbury%27s+Victoria+Station" target="_blank" rel="noopener">Sainsbury's</a> – big supermarket</li><li><a href="https://www.google.com/maps/search/?api=1&query=Rippon+Cheese+London" target="_blank" rel="noopener">Rippon Cheese</a> – famous cheese store nearby</li><li><a href="https://www.google.com/maps/search/?api=1&query=Dishoom+London" target="_blank" rel="noopener">Dishoom</a> – famous Indian food (further away, book in advance)</li><li><a href="https://www.google.com/maps/search/?api=1&query=Gold+Mine+London" target="_blank" rel="noopener">Gold Mine</a> – great Peking duck (further away)</li></ul><h3>Sights</h3><ul><li>Wicked and Hamilton – Two of the world's best musicals are right on our doorstep.</li><li>St James's Park – A beautiful royal park, perfect for a stroll.</li><li>A great walk: Start at Big Ben, cross Westminster Bridge, and walk along the scenic South Bank to Tower Bridge.</li></ul>` } }; }

function buildChatbotContextFromPage() {
  const mainContainer = document.querySelector('main.container');
  if (mainContainer) {
    const guidebookText = mainContainer.innerText;
    const cleanedText = guidebookText.replace(/(\s\s)\s+/g, '$1').trim();
    const systemPrompt = "You are 'Victoria', a friendly AI assistant for the 195VBR guesthouse. You MUST base your answer ONLY on the detailed guidebook information provided below. For all other questions, you should use your general knowledge. Be concise, friendly, and use Markdown for formatting links like [Link Text](URL).";
    chatbotContext = `${systemPrompt}\n\nRELEVANT GUIDEBOOK CONTENT:\n${cleanedText}`;
  }
}

function setupEnterKeyListener() {
  const userInputField = document.querySelector('#chat-widget #user-input');
  if (userInputField) { userInputField.addEventListener('keypress', (e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); } }); }
}

function addInitialBotMessage() {
    const chatBox = document.getElementById('chat-box');
    const welcomeMessage = `<div class="message-bubble bot-message"><p>Welcome to 195VBR! I'm Victoria, your AI assistant. Ask me anything about the guesthouse or your London trip.</p></div>`;
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
    const serverlessFunctionUrl = `${BACKEND_API_BASE_URL}/api/chatbot`;
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