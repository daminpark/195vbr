// js/main.js

// --- GLOBAL STATE ---
const AppState = {
  guestAccessLevel: null,
  chatbotContext: '',
  chatHistory: [],
  currentBookingConfig: {},
  opaqueBookingKey: null, 
  guestInfo: {},
  pusher: null,
  channel: null
};

// --- PRIMARY EVENT LISTENER ---
document.addEventListener('DOMContentLoaded', async () => {
  const params = new URLSearchParams(window.location.search);
  const searchString = window.location.search;
  AppState.opaqueBookingKey = params.get('booking');

  // --- LOGIC ROUTER (Corrected Order) ---

  // 1. Check for the most specific and secure key first: ?booking=...
  if (AppState.opaqueBookingKey) {
    const validationResult = await validateAccess(AppState.opaqueBookingKey);
    if (validationResult.success) {
      AppState.guestAccessLevel = validationResult.access;
      AppState.guestInfo = validationResult;
      await buildGuidebook(AppState.opaqueBookingKey, AppState.guestInfo);
      setupChatInterface();
    } else {
      displayErrorPage('denied', validationResult.error);
    }
  } 
  // 2. Next, check for the old, specific legacy keys: ?wholehome, ?sharedb, ?sharedk
  else if (params.has('wholehome') || params.has('sharedb') || params.has('sharedk')) {
    await buildLegacyGuidebook(params);
    setupChatInterface();
  }
  // 3. Finally, check for the new generic legacy key pattern: ?{key} (e.g., ?31)
  // This checks if there is a query string that does NOT contain an "=" sign.
  else if (searchString.length > 1 && !searchString.includes('=')) {
    const simpleBookingKey = searchString.substring(1);
    await buildSimpleGuidebook(simpleBookingKey);
    setupChatInterface();
  } 
  // 4. If none of the above match, it's an invalid link.
  else {
    displayErrorPage('missing');
  }

  // Common UI setup for all guidebook versions that successfully render
  if (document.getElementById('guidebook-container').innerHTML.trim()) {
    setupMobileMenu();
  }
});


/**
 * Initializes all chatbot-related UI elements and event listeners.
 */
function setupChatInterface() {
  const sendBtn = document.getElementById('send-btn');
  if (sendBtn) {
    sendBtn.addEventListener('mousedown', (e) => {
      e.preventDefault(); // Prevents focus loss on mobile
      sendMessage();
    });
  }
  setupChatToggle();
  setupEnterKeyListener();
  addInitialBotMessage();
}

// --- GUIDEBOOK BUILDER FUNCTIONS ---

/**
 * Builds the full, secure guidebook for validated guests.
 * @param {string} opaqueBookingKey - The secure, validated booking key.
 * @param {object} guestDetails - The details returned from the validation API.
 */
async function buildGuidebook(opaqueBookingKey, guestDetails) {
  try {
    const config = await getConfig();
    const bookingKey = opaqueBookingKey.split('-')[0];
    AppState.currentBookingConfig = config.bookings[bookingKey];
    if (!AppState.currentBookingConfig) throw new Error(`Booking key "${bookingKey}" not found.`);

    const allContent = generatePageContent(AppState.currentBookingConfig.content, guestDetails, config.contentFragments);
    AppState.chatbotContext = buildChatbotContext(allContent, guestDetails, bookingKey);
    
    renderPage(allContent, guestDetails); // Renders HTML to the page
    
    // Initialize Home Assistant dashboard and real-time updates
    if (AppState.currentBookingConfig.house && AppState.currentBookingConfig.entities) {
      initializePusher(AppState.currentBookingConfig.house);
      createDashboardCards(AppState.currentBookingConfig);
      displayHomeAssistantStatus(AppState.currentBookingConfig);
    }
  } catch (error) {
    console.error("Error building secure guidebook:", error);
    displayErrorPage('denied', `Could not load guidebook. ${error.message}`);
  }
}

/**
 * Builds a simplified, public version of the guidebook with weather but no controls.
 * @param {string} bookingKey - The simple booking key (e.g., "31").
 */
async function buildSimpleGuidebook(bookingKey) {
  try {
    const config = await getConfig();
    AppState.currentBookingConfig = config.bookings[bookingKey];
    if (!AppState.currentBookingConfig) throw new Error(`Public booking key "${bookingKey}" not found.`);

    // Generate content without personalized details
    const allContent = generatePageContent(AppState.currentBookingConfig.content, {}, config.contentFragments);
    AppState.chatbotContext = buildChatbotContext(allContent, {}, bookingKey);

    renderPage(allContent); // Render with a generic welcome

    // Initialize only the weather part of the dashboard
    const dashboard = document.getElementById('ha-dashboard');
    if (AppState.currentBookingConfig.house && AppState.currentBookingConfig.entities.weather) {
      dashboard.innerHTML = createWeatherCardHtml();
      fetchWeatherData(AppState.currentBookingConfig.entities.weather, AppState.currentBookingConfig.house, null);
    } else if (dashboard) {
      dashboard.style.display = 'none';
    }
  } catch (error) {
    console.error("Error building simple guidebook:", error);
    displayErrorPage('denied', `Could not load guidebook. ${error.message}`);
  }
}

/**
 * Builds the oldest legacy guidebook based on URL parameters.
 * @param {URLSearchParams} params - The URL search parameters.
 */
async function buildLegacyGuidebook(params) {
  try {
    const config = await getConfig();
    let pageTitle = "Guidebook";
    const staticContent = getStaticContent();
    let legacyContentKeys = new Set(Object.keys(staticContent));

    if (params.has('wholehome')) {
      pageTitle = "Whole Home Guide";
      ['house193', 'house195', 'wifi193', 'wifi195', 'wholeHomeLuggage', 'wholeHomeRubbish', 'hasLaundry', 'kitchenBase', 'windowsStandard', 'windowsTiltTurn']
        .forEach(item => legacyContentKeys.add(item));
    } else {
      pageTitle = "Private Room Guide";
      ['house193', 'wifi193', 'guestLuggage'].forEach(item => legacyContentKeys.add(item));
      if (params.has('sharedk')) {
        ['kitchenShared', 'kitchenBase', 'noLaundry'].forEach(item => legacyContentKeys.add(item));
      }
      if (params.has('sharedb')) {
        ['bathroomShared'].forEach(item => legacyContentKeys.add(item));
      }
    }
    
    const allContent = generatePageContent(Array.from(legacyContentKeys), {}, config.contentFragments, true);
    AppState.chatbotContext = buildChatbotContext(allContent, {}, 'legacy');
    renderPage(allContent, {}, pageTitle);
    
  } catch (error) {
    console.error("Error building legacy guidebook:", error);
    displayErrorPage('denied', `Could not load guidebook. ${error.message}`);
  }
}