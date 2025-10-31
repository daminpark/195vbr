// --- GLOBAL CONFIGURATION ---
// IMPORTANT: This is the URL of your BACKEND.
// For testing, use your backend's preview URL.
const API_BASE_URL = 'https://guidebook-chatbot-backend-git-pwprotected-pierre-parks-projects.vercel.app';

// --- GLOBAL STATE VARIABLES ---
let chatbotContext = '';
let chatHistory = [];

// --- INITIALIZATION ---
document.addEventListener('DOMContentLoaded', async () => {
  // We will now call the real authentication function again.
  await initializeAndAuthenticate();
  
  setupChatToggle();
  setupEnterKeyListener();
  addInitialBotMessage();
  setupMobileMenu();
});

/**
 * Handles authentication by parsing a single opaque URL parameter.
 */
async function initializeAndAuthenticate() {
  const guidebookContainer = document.getElementById('guidebook-container');
  const tocContainer = document.getElementById('table-of-contents');
  const params = new URLSearchParams(window.location.search);

  const bookingCode = params.get('booking');

  if (!bookingCode) {
    displayAuthError(guidebookContainer, tocContainer);
    return;
  }

  guidebookContainer.innerHTML = '<h1><span class="material-symbols-outlined">lock</span> Verifying Access...</h1>';
  
  let authSucceeded = false;
  let accessLevel = 'none';

  console.log(`Attempting to authenticate with booking code: ${bookingCode}`);
  
  try {
    const response = await fetch(`${API_BASE_URL}/api/auth`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ bookingCode })
    });

    if (response.ok) {
      const data = await response.json();
      accessLevel = data.accessLevel;
      authSucceeded = (accessLevel === 'full' || accessLevel === 'partial');
      console.log(`Authentication successful. Access level: ${accessLevel}`);
    } else {
      console.error('Authentication failed with status:', response.status);
      authSucceeded = false;
    }
  } catch (error) {
    console.error('Authentication request failed with error:', error);
    authSucceeded = false;
  }

  if (!authSucceeded) {
    displayAuthError(guidebookContainer, tocContainer);
    return;
  }

  const bookingKey = bookingCode.split('-', 1)[0];
  await buildGuidebook(bookingKey, accessLevel);
}

/**
 * Displays a generic "Booking Not Found" or "Invalid Link" error.
 */
function displayAuthError(guidebookContainer, tocContainer) {
  const errorHtml = `
    <header class="site-header"><img src="logo.png" alt="195VBR Guesthouse Logo" class="logo" /></header>
    <h1>Access Denied</h1>
    <section id="error-message">
      <h2><span style="color: #d9534f;">&#9888;</span> Invalid or Expired Link</h2>
      <p>The link you have used is not valid or has expired.</p>
      <p><strong>Please use the exact link provided in your booking confirmation.</strong></p>
    </section>
  `;
  guidebookContainer.innerHTML = errorHtml;
  tocContainer.innerHTML = '';
  document.getElementById('chat-launcher').style.display = 'none';
}

// ... ALL OTHER FUNCTIONS (buildGuidebook, getStaticContent, etc.) ARE IDENTICAL TO YOUR ORIGINAL FILE ...
// ... YOU CAN PASTE THEM HERE, OR USE THE ONES FROM OUR PREVIOUS CONVERSATIONS ...
// ... I will include them below for completeness ...

async function buildGuidebook(bookingKey, accessLevel) {
  const guidebookContainer = document.getElementById('guidebook-container');
  const tocContainer = document.getElementById('table-of-contents');

  try {
    const response = await fetch('config.json');
    if (!response.ok) throw new Error('config.json not found');
    const config = await response.json();

    const bookingConfig = config.bookings[bookingKey];
    if (!bookingConfig) throw new Error(`Booking key "${bookingKey}" not found after auth.`);
    
    const requiredKeys = bookingConfig.content;
    const staticContent = getStaticContent();
    const dynamicContent = buildDynamicContent(requiredKeys, config.contentFragments);
    const allContent = { ...staticContent, ...dynamicContent };
    
    let fullHtml = `<header class="site-header"><img src="logo.png" alt="195VBR Guesthouse Logo" class="logo" /></header><h1>195VBR Guidebook</h1><div id="ha-dashboard"></div>`;
    let tocHtml = '<ul>';
    
    const sectionOrder = [
      'video', 'what-not-to-bring', 'Address', 'domestic-directions', 'airport-directions', 
      'getting-around', 'codetimes', 'Check-in & Luggage', 'Wifi', 'heating', 'Bedroom', 
      'Bathroom', 'Kitchen', 'Rubbish Disposal', 'Windows', 'Laundry', 'ironing', 'troubleshooting', 'tv', 'contact', 'local-guidebook'
    ];

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

    if (bookingConfig.house && bookingConfig.entities) {
      createDashboardCards(bookingConfig);
      displayHomeAssistantStatus(bookingConfig);
      setInterval(() => displayHomeAssistantStatus(bookingConfig), 600000); 

      if (accessLevel === 'full') {
        const controlsContainer = document.getElementById('smart-home-controls');
        if (controlsContainer) {
            createSmartHomeControlCards(controlsContainer, bookingConfig);
            controlsContainer.style.display = 'block';
        }
      }
    }

  } catch (error) {
    console.error("Error building guidebook:", error);
    guidebookContainer.innerHTML = `<p>Error: Could not load guidebook configuration. ${error.message}</p>`;
  }
}

function createSmartHomeControlCards(container, bookingConfig) {
    let controlsHtml = `
        <div class="ha-card">
            <div class="ha-card-title">Main Thermostat</div>
            <div class="ha-card-controls"><span id="thermostat-temp">21°C</span></div>
        </div>
        <div class="ha-card">
            <div class="ha-card-title">Room Light</div>
            <div class="ha-card-controls"><button>Toggle</button></div>
        </div>
    `;
    container.querySelector('#smart-home-dashboard').innerHTML = controlsHtml;
}

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

function createDashboardCards(bookingConfig) {
    const { house, entities } = bookingConfig;
    const dashboard = document.getElementById('ha-dashboard');
    if (!dashboard) return;

    let cardsHtml = '';
    const entityKeys = Object.keys(entities).sort((a, b) => a === 'weather' ? -1 : b === 'weather' ? 1 : 0);

    entityKeys.forEach(key => {
        if (key === 'weather') {
            cardsHtml += `<div class="ha-card weather-card" id="ha-card-weather"><div class="weather-top-row" id="ha-weather-top-row"></div><div class="weather-forecast" id="ha-weather-daily"></div></div>`;
        } else {
            cardsHtml += `<div class="ha-card"><div class="ha-card-title">${formatCardTitle(key, house)}</div><div class="ha-card-status" id="ha-status-${key}">Loading...</div></div>`;
        }
    });
    dashboard.innerHTML = cardsHtml;
}

async function fetchHAData(entityId, house, type = 'state') {
  const proxyUrl = `${API_BASE_URL}/api/ha-proxy`; // Use the global constant
  const response = await fetch(`${proxyUrl}?house=${house}&entity=${entityId}&type=${type}`);
  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(`Proxy API Error for type '${type}': ${errorData.error || response.statusText}`);
  }
  return response.json();
}

async function displayHomeAssistantStatus(bookingConfig) {
  const { house, entities } = bookingConfig;
  if (!house || !entities) return;

  for (const [key, entityId] of Object.entries(entities)) {
    if (key === 'weather') {
      try {
        const [currentState, hourlyForecast, dailyForecast] = await Promise.all([
            fetchHAData(entityId, house, 'state'),
            fetchHAData(entityId, house, 'hourly_forecast'),
            fetchHAData(entityId, house, 'daily_forecast')
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
        console.error('Weather fetch error:', error);
      }
    } else {
      const statusElement = document.getElementById(`ha-status-${key}`);
      if (statusElement) {
        try {
          const state = await fetchHAData(entityId, house);
          statusElement.textContent = state.state === 'on' ? 'Occupied' : 'Vacant';
          statusElement.style.color = state.state === 'on' ? '#d9534f' : '#5cb85c';
        } catch (error) {
          console.error(`Occupancy fetch error for ${key}:`, error);
          statusElement.textContent = 'Unavailable';
        }
      }
    }
  }
}

// All other utility functions (setupMobileMenu, setupChatToggle, etc.) go here...
function setupMobileMenu(){/*...*/}
function setupChatToggle(){/*...*/}
function buildDynamicContent(keys, fragments){/*...*/}
function getStaticContent(){/*...*/}
function buildChatbotContextFromPage(){/*...*/}
function setupEnterKeyListener(){/*...*/}
function addInitialBotMessage(){/*...*/}
async function sendMessage(){/*...*/}

// NOTE: You will need to copy over the full function bodies for these helpers from your original file.