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
  else if (params.has('wholehome') || params.has('sharedb') || params.has('sharedk')) {
    await buildLegacyGuidebook(params);
    setupChatInterface();
  }
  else if (searchString.length > 1 && !searchString.includes('=')) {
    const simpleBookingKey = searchString.substring(1);
    await buildSimpleGuidebook(simpleBookingKey);
    setupChatInterface();
  } 
  else {
    displayErrorPage('missing');
  }

  if (document.getElementById('guidebook-container').innerHTML.trim()) {
    setupMobileMenu();
  }
});

function setupChatInterface() {
  const sendBtn = document.getElementById('send-btn');
  if (sendBtn) {
    sendBtn.addEventListener('mousedown', (e) => { e.preventDefault(); sendMessage(); });
  }
  setupChatToggle();
  setupEnterKeyListener();
  addInitialBotMessage();
}

// --- GUIDEBOOK BUILDER FUNCTIONS ---

async function buildGuidebook(opaqueBookingKey, guestDetails) {
  try {
    const config = await getConfig();
    const bookingKey = opaqueBookingKey.split('-')[0];
    AppState.currentBookingConfig = config.bookings[bookingKey];
    if (!AppState.currentBookingConfig) throw new Error(`Booking key "${bookingKey}" not found.`);
    const allContent = generatePageContent(AppState.currentBookingConfig.content, guestDetails, config.contentFragments);
    AppState.chatbotContext = buildChatbotContext(allContent, guestDetails, bookingKey);
    renderPage(allContent, guestDetails);
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

async function buildSimpleGuidebook(bookingKey) {
  try {
    const config = await getConfig();
    AppState.currentBookingConfig = config.bookings[bookingKey];
    if (!AppState.currentBookingConfig) throw new Error(`Public booking key "${bookingKey}" not found.`);
    const allContent = generatePageContent(AppState.currentBookingConfig.content, {}, config.contentFragments);
    AppState.chatbotContext = buildChatbotContext(allContent, {}, bookingKey);
    renderPage(allContent);
    // MODIFICATION: Simply hide the dashboard for these links.
    const dashboard = document.getElementById('ha-dashboard');
    if (dashboard) dashboard.style.display = 'none';
  } catch (error) {
    console.error("Error building simple guidebook:", error);
    displayErrorPage('denied', `Could not load guidebook. ${error.message}`);
  }
}

async function buildLegacyGuidebook(params) {
  try {
    const config = await getConfig();
    let pageTitle = "Guidebook";
    const staticContent = getStaticContent();
    let legacyContentKeys = new Set(Object.keys(staticContent));

    if (params.has('wholehome')) {
      pageTitle = "Whole Home Guide";
      ['house193', 'house195', 'wifi193', 'wifi195', 'wholeHomeLuggage', 'wholeHomeRubbish', 'hasLaundry', 'kitchenBase', 'windowsStandard', 'windowsTiltTurn'].forEach(item => legacyContentKeys.add(item));
    } else {
      pageTitle = "Private Room Guide";
      ['house193', 'wifi193', 'guestLuggage'].forEach(item => legacyContentKeys.add(item));
      if (params.has('sharedk')) { ['kitchenShared', 'kitchenBase', 'noLaundry'].forEach(item => legacyContentKeys.add(item)); }
      if (params.has('sharedb')) { ['bathroomShared'].forEach(item => legacyContentKeys.add(item)); }
    }
    
    const allContent = generatePageContent(Array.from(legacyContentKeys), {}, config.contentFragments, true);
    AppState.chatbotContext = buildChatbotContext(allContent, {}, 'legacy');
    renderPage(allContent, {}, pageTitle);
    
    // MODIFICATION: Explicitly hide the dashboard for old legacy links too.
    const dashboard = document.getElementById('ha-dashboard');
    if (dashboard) dashboard.style.display = 'none';

  } catch (error) {
    console.error("Error building legacy guidebook:", error);
    displayErrorPage('denied', `Could not load guidebook. ${error.message}`);
  }
}