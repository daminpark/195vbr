// --- A SINGLE SOURCE OF TRUTH FOR THE BACKEND URL ---
const BACKEND_API_BASE_URL = 'https://guidebook-chatbot-backend-git-ical-auth-pierre-parks-projects.vercel.app';

let guestAccessLevel = null;
let chatbotContext = '';
let chatHistory = [];
let currentBookingConfig = {};
let opaqueBookingKey = null; 
let guestInfo = {};

document.addEventListener('DOMContentLoaded', async () => {
  const params = new URLSearchParams(window.location.search);
  opaqueBookingKey = params.get('booking');

  // Event listener for the chat send button (for desktop widget)
  const sendBtn = document.getElementById('send-btn');
  if (sendBtn) {
    sendBtn.addEventListener('mousedown', (e) => {
      e.preventDefault();
      sendMessage();
    });
  }

  if (params.has('wholehome') || params.has('sharedb') || params.has('sharedk')) {
    await buildLegacyGuidebook(params);
    setupMobileMenu();
  } 
  else if (opaqueBookingKey) {
    const validationResult = await validateAccess(opaqueBookingKey);
    if (validationResult.success) {
      guestAccessLevel = validationResult.access;
      guestInfo = validationResult; // Store all guest info globally
      
      await buildGuidebook(opaqueBookingKey, guestInfo);
      setupChatToggle();
      setupEnterKeyListener();
      addInitialBotMessage();
      setupMobileMenu();
    } else {
      displayErrorPage('denied', validationResult.error);
    }
  } 
  else {
    displayErrorPage('missing');
  }
});

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

async function validateAccess(opaqueBookingKey) {
  const guidebookContainer = document.getElementById('guidebook-container');
  guidebookContainer.innerHTML = `<h1>Validating Access...</h1><p>Please wait a moment.</p>`;
  const validationUrl = `${BACKEND_API_BASE_URL}/api/validate-booking?booking=${opaqueBookingKey}`;
  try {
    const response = await fetch(validationUrl);
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'Unknown validation error.');
    console.log('Access validation successful:', data);
    return { success: true, ...data };
  } catch (error) {
    console.error('Validation API call failed:', error);
    return { success: false, error: error.message };
  }
}

async function buildGuidebook(opaqueBookingKey, guestDetails) {
  const guidebookContainer = document.getElementById('guidebook-container');
  const tocContainer = document.getElementById('table-of-contents');
  try {
    const response = await fetch('config.json');
    if (!response.ok) throw new Error('config.json not found');
    const config = await response.json();
    const bookingKey = opaqueBookingKey.split('-')[0];
    currentBookingConfig = config.bookings[bookingKey];
    if (!currentBookingConfig) throw new Error(`Booking key "${bookingKey}" not found in config.json.`);
    
    const requiredKeys = currentBookingConfig.content;
    const staticContent = getStaticContent();
    const dynamicPersonalizedContent = getDynamicPersonalizedContent(guestDetails);
    const dynamicConfigContent = buildDynamicContent(requiredKeys, config.contentFragments);
    const allContent = { ...staticContent, ...dynamicPersonalizedContent, ...dynamicConfigContent };

    chatbotContext = buildChatbotContextFromConfig(allContent, guestDetails, bookingKey);
    
    // Dynamic Welcome Message Logic
    const now = new Date();
    const checkInDate = new Date(guestDetails.checkInDateISO);
    const isDuringStay = now >= checkInDate;
    
    let welcomeHeader, welcomeMessage;
    if (isDuringStay) {
      welcomeHeader = `Welcome, ${guestDetails.guestFirstName}'s group!`;
      welcomeMessage = `Welcome to our guidebook, where you can find information, chat with our AI assistant, and see and control your room's heating.`;
    } else {
      welcomeHeader = `Hi ${guestDetails.guestFirstName}'s group!`;
      welcomeMessage = `Your booking is confirmed for these dates. Please have a look through the guidebook, where you'll find key information and our AI assistant. During your stay, this page will also let you see and control your room's heating.`;
    }
    
    let welcomeHtml = `
      <section id="welcome">
        <h2>${welcomeHeader}</h2>
        <p><strong>Check-in:</strong> ${guestDetails.checkInDateFormatted}<br><strong>Check-out:</strong> ${guestDetails.checkOutDateFormatted}</p>
        <p>${welcomeMessage}</p>
      </section>
    `;

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

async function buildLegacyGuidebook(params) {
  const guidebookContainer = document.getElementById('guidebook-container');
  const tocContainer = document.getElementById('table-of-contents');

  try {
    const response = await fetch('config.json');
    if (!response.ok) throw new Error('config.json not found');
    const config = await response.json();

    let pageTitle = "Guidebook";
    const staticContent = getStaticContent();
    const baseContentKeys = Object.keys(staticContent);
    let legacyContentKeys = new Set(baseContentKeys);

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
    
    const dynamicContent = buildDynamicContent(Array.from(legacyContentKeys), config.contentFragments);
    const allContent = { ...staticContent, ...dynamicContent };
    
    chatbotContext = buildChatbotContextFromConfig(allContent, {}, 'legacy');
    
    let fullHtml = `<h1>${pageTitle}</h1><div id="ha-dashboard" style="display: none;"></div>`;
    let tocHtml = '<ul>';
    const sectionOrder = ['video', 'what-not-to-bring', 'Address', 'domestic-directions', 'airport-directions', 'getting-around', 'codetimes', 'Check-in & Luggage', 'checkout', 'Wifi', 'heating', 'Bedroom', 'Bathroom', 'Kitchen', 'Rubbish Disposal', 'Windows', 'Laundry', 'ironing', 'troubleshooting', 'tv', 'contact', 'local-guidebook'];
    
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

    setupChatToggle();
    setupEnterKeyListener();
    addInitialBotMessage();
    
  } catch (error) {
    console.error("Error building legacy guidebook:", error);
    displayErrorPage('denied', `Could not load guidebook configuration. ${error.message}`);
  }
}

function getDynamicPersonalizedContent(guestDetails) {
    if (!guestDetails || !guestDetails.checkInDateISO) return {};

    const checkInDate = new Date(guestDetails.checkInDateISO);
    const checkOutDate = new Date(guestDetails.checkOutDateISO);
    
    const dayBeforeCheckIn = new Date(checkInDate);
    dayBeforeCheckIn.setDate(checkInDate.getDate() - 1);

    const dayBeforeCheckOut = new Date(checkOutDate);
    dayBeforeCheckOut.setDate(checkOutDate.getDate() - 1);

    const dateOptions = { weekday: 'long', month: 'long', day: 'numeric' };
    const dayBeforeCheckInFormatted = dayBeforeCheckIn.toLocaleDateString('en-GB', dateOptions);
    const dayBeforeCheckOutFormatted = dayBeforeCheckOut.toLocaleDateString('en-GB', dateOptions);

    return {
        'guestLuggage': {
            title: "Check-in & Luggage", emoji: "🧳",
            html: `<p><strong>Self Check-in:</strong> From 15:00 onwards.</p>
                   <p><strong>Early Luggage Drop-off:</strong> From 11:00, you can use your front door code to access Cupboard V downstairs.</p>
                   <p>If you need to store bags before 11:00, please send us a message at the earliest the day before your arrival (on ${dayBeforeCheckInFormatted}), and if we can accommodate it, we're happy to.</p>
                   <p><strong>Early Check-in:</strong> While you are welcome to check if the room is ready from midday onwards, please only leave your belongings inside if it is completely finished. If it's not ready, please use Cupboard V.</p>
                   <p>This video shows the full process:</p>
                   <div class="video-container"><iframe src="https://www.youtube.com/embed/rlUbHfWcN0s" title="Luggage drop-off process" allowfullscreen></iframe></div>`
        },
        'checkout': {
            title: "Check-out", emoji: "👋",
            html: `<p>Check-out is at <strong>11:00 AM on ${guestDetails.checkOutDateFormatted}</strong>.</p>
                   <p>You don't need to worry about any cleaning; our team will handle everything.</p>
                   <p>If you need to store your luggage 🧳 after you check out, you are welcome to use Cupboard V downstairs. Your existing entry code will continue to work for the front door and the cupboard until 14:00. If you need to arrange a later pick-up, please send us a message (ideally by ${dayBeforeCheckOutFormatted}) to check for availability. We need to confirm because the house may be privately booked by a new group from 15:00, and for their privacy and security, access won't be possible after their check-in time.</p>
                   <p>⚠️ <strong>A quick but important request:</strong> Please be sure to take all your belongings from the room by 11am. Our cleaning team works on a tight schedule and will clear the room completely for our next guests.</p>`
        }
    };
}

function getChatbotOnlyContext(bookingId) {
    const groundFloorLuggageQuirk = "The guest is in a ground floor room. While their room is easily accessible, they should be aware that the luggage storage cupboard (Cupboard V) is downstairs, reached by a narrow staircase. This is something to keep in mind if they plan to store heavy bags.";
    
    const quirks = {
        '31': groundFloorLuggageQuirk,
        '32': groundFloorLuggageQuirk + " This room also has a private patio.",
        '33': "The guest is in Room 3 on the first floor. It has a private en-suite bathroom. The shared kitchen is downstairs. The room is reached by a narrow staircase, which is relevant for heavy luggage.",
        '34': "The guest is in Room 4 on the second floor. The shared bathroom for this room is located 1.5 floors downstairs. The kitchen is also downstairs. Everything is reached via a narrow staircase. This is a key detail for mobility or heavy luggage.",
        '35': "The guest is in Room 5 on the second floor. The shared bathroom for this room is located 1.5 floors downstairs. The kitchen is also downstairs. Everything is reached via a narrow staircase. This is a key detail for mobility or heavy luggage.",
        '36': "The guest is in Room 6, a cozy top-floor loft with some low, sloping ceilings. The shared bathroom is 2.5 floors downstairs. This is a key detail for taller guests, mobility concerns, or heavy luggage.",
        '3a': "The guest has booked Rooms 1 & 2 on the ground floor. Their private bathroom for the group is located half a floor downstairs. This is reached via a narrow staircase, which is also something to keep in mind if using the downstairs luggage storage cupboard with heavy bags.",
        '3b': "The guest has booked Rooms 4, 5 & 6, a private suite on the top two floors. One bedroom is a loft with low ceilings. Their private bathroom is multiple floors downstairs on the upper ground level, reached via a narrow staircase. This layout is not a good fit for anyone with mobility concerns or heavy luggage.",
        '193vbr': "The guest has booked the entire house. The house has an original narrow staircase connecting all floors, which is relevant for groups with heavy luggage or mobility concerns. The common area is cozy and centered around the kitchen, rather than a large living room.",
        '51': groundFloorLuggageQuirk,
        '52': groundFloorLuggageQuirk + " This room also has a private patio.",
        '53': "The guest is in Room 3 on the first floor. It has a private en-suite bathroom. The shared kitchen is downstairs. The room is reached by a narrow staircase, which is relevant for heavy luggage.",
        '54': "The guest is in Room 4 on the second floor. The shared bathroom for this room is located 1.5 floors downstairs. The kitchen is also downstairs. Everything is reached via a narrow staircase. This is a key detail for mobility or heavy luggage.",
        '55': "The guest is in Room 5 on the second floor. The shared bathroom for this room is located 1.5 floors downstairs. The kitchen is also downstairs. Everything is reached via a narrow staircase. This is a key detail for mobility or heavy luggage.",
        '56': "The guest is in Room 6, a cozy top-floor loft with some low, sloping ceilings. The shared bathroom is 2.5 floors downstairs. This is a key detail for taller guests, mobility concerns, or heavy luggage.",
        '5a': "The guest has booked Rooms 1 & 2 on the ground floor. Their private bathroom for the group is located half a floor downstairs. This is reached via a narrow staircase, which is also something to keep in mind if using the downstairs luggage storage cupboard with heavy bags.",
        '5b': "The guest has booked Rooms 4, 5 & 6, a private suite on the top two floors. One bedroom is a loft with low ceilings. Their private bathroom is multiple floors downstairs on the upper ground level, reached via a narrow staircase. This layout is not a good fit for anyone with mobility concerns or heavy luggage.",
        '195vbr': "The guest has booked the entire house. The house has an original narrow staircase connecting all floors, which is relevant for groups with heavy luggage or mobility concerns. The common area is cozy and centered around the kitchen, rather than a large living room.",
    };
    
    const isWholeHome = bookingId.includes('vbr');
    const isLegacy = bookingId === 'legacy';
    const sharedBathroomBookings = new Set(['31', '32', '34', '35', '36', '51', '52', '54', '55', '56']);

    let context = `
--- HIDDEN CONTEXT FOR AI ONLY ---

**Safety Commitment:**
Our property has annual gas and electrical safety certificates. There are interlinked, mains-powered smoke alarms in every room. A fire extinguisher, fire blanket, and first aid kit are provided. Security cameras are in the entrance for safety.

**General Check-in Information:**
Check-in is anytime from 15:00. The primary method is self check-in with a personalized keypad code, so no keys are needed.

**Bedroom Amenities:**
All bedrooms include a high-quality firm mattress, an electric underblanket, full blackout curtains, a 4K Smart TV (with Disney+, Apple TV+, etc.), dimmable lighting, a powerful fan, a desk with chairs, a hairdryer, a full-length mirror, and universal adapters.

**Wi-Fi:**
The entire property has exceptionally fast Fibre 1Gbps Wi-Fi 6.

**House Rules & Policies:**
- No extra guests, parties, smoking, or pets.
- Be respectful of our neighbours.
`;

    if (!isWholeHome) {
        context += `- **Quiet hours are strictly enforced from 10:00 PM to 8:00 AM.** This is our most important rule for shared spaces.\n`;
    }

    if (isWholeHome) {
        context += `- **Complimentary housekeeping** (towel refresh, bathroom/kitchen tidy) is available on request for whole-home bookings. The guest must message at least one day in advance. Service is between 11am - 3pm.\n`;
    }

    if (!isLegacy) {
        context += `
**Room/Booking Specific Quirks:**
${quirks[bookingId] || "No specific quirks for this booking."}
`;
    }

    if (!isWholeHome) {
        context += `
**Shared Kitchen:** Located in the basement, it's cleaned to a high standard daily. Each room has a private, labeled compartment in the fridge and cupboard. Complimentary tea and instant coffee are provided. It is fully equipped with an induction hob, oven, microwave, dishwasher, and all cookware.
`;
    }

    if (sharedBathroomBookings.has(bookingId)) {
        context += `
**Shared Bathroom:** Professionally cleaned daily. Features a superior shower with strong, hot water pressure and sustainable toiletries.
`;
    }
    
    context += `--- END HIDDEN CONTEXT ---`;
    return context;
}

function buildChatbotContextFromConfig(content, guestDetails, bookingKey) {
  let contextText = '';
  const tempDiv = document.createElement('div');

  if (guestDetails && guestDetails.guestName) {
    contextText += `--- GUEST INFORMATION ---\n`;
    contextText += `Name: ${guestDetails.guestName}\n`;
    contextText += `Check-in Date: ${guestDetails.checkInDateFormatted}\n`;
    contextText += `Check-out Date: ${guestDetails.checkOutDateFormatted}\n\n`;
  }

  contextText += getChatbotOnlyContext(bookingKey) + "\n\n";

  const sectionOrder = ['video', 'what-not-to-bring', 'Address', 'domestic-directions', 'airport-directions', 'getting-around', 'codetimes', 'Check-in & Luggage', 'checkout', 'Wifi', 'heating', 'Bedroom', 'Bathroom', 'Kitchen', 'Rubbish Disposal', 'Windows', 'Laundry', 'ironing', 'troubleshooting', 'tv', 'contact', 'local-guidebook'];

  sectionOrder.forEach(key => {
    const sectionObjectKey = Object.keys(content).find(k => k.toLowerCase() === key.toLowerCase());
    if (sectionObjectKey && content[sectionObjectKey]) {
      const section = content[sectionObjectKey];
      contextText += `--- Section: ${section.title} ---\n`;
      tempDiv.innerHTML = section.html;
      const plainText = tempDiv.textContent || tempDiv.innerText || "";
      contextText += plainText.replace(/(\s\s)\s+/g, '$1').trim() + "\n\n";
    }
  });

  const systemPrompt = "You are 'Victoria', a friendly AI assistant for the 195VBR guesthouse. You MUST base your answer ONLY on the detailed guidebook information provided below, including the guest's specific booking details and the special hidden context. For all other questions, you should use your general knowledge. Be concise, friendly, and use Markdown for formatting links like [Link Text](URL).";
  
  return `${systemPrompt}\n\nRELEVANT GUIDEBOOK CONTENT:\n${contextText}`;
}

function debounce(func, delay) {
  let timeout;
  return function(...args) {
    const context = this;
    clearTimeout(timeout);
    timeout = setTimeout(() => func.apply(context, args), delay);
  };
}

// --- In script.js ---

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
            for (const [entityId, friendlyName] of Object.entries(climateEntities)) {
                climateHtml += `<div class="climate-entity" id="climate-${entityId}"><div class="climate-name">${friendlyName}</div><div class="climate-current-temp">Current: --°</div><div class="climate-set-temp-display">--°</div><div class="climate-slider-container"><input type="range" min="14" max="24" step="0.5" class="climate-slider" data-entity="${entityId}" disabled></div></div>`;
            }
            cardsHtml += `<div class="ha-card climate-card">${climateHtml}</div>`;
        } else if (key === 'lights' && guestAccessLevel === 'full') {
            for (const [entityId, friendlyName] of Object.entries(entities[key])) {
                cardsHtml += `
                    <div class="ha-card light-control-card" id="light-card-${entityId.replace(/\./g, '-')}">
                        <div class="light-controls-wrapper">
                            <div class="light-control-header">
                                <span class="light-control-name">${friendlyName}</span>
                                <label class="switch">
                                    <input type="checkbox" class="light-switch" data-entity="${entityId}" disabled>
                                    <span class="slider"></span>
                                </label>
                            </div>
                            <div class="light-slider-group" data-controls-for="${entityId}">
                                <div class="light-slider-row" data-control="brightness">
                                    <span class="material-symbols-outlined">brightness_medium</span>
                                    <input type="range" class="light-slider" data-type="brightness" min="0" max="255" data-entity="${entityId}" disabled>
                                    <span class="light-slider-value" data-value-for="brightness">--%</span>
                                </div>
                                <div class="light-slider-row" data-control="color_temp">
                                    <span class="material-symbols-outlined">wb_sunny</span>
                                    <input type="range" class="light-slider" data-type="color_temp" min="250" max="454" data-entity="${entityId}" disabled>
                                    <span class="light-slider-value" data-value-for="color_temp">--K</span>
                                </div>
                            </div>
                        </div>
                        <div class="light-unavailable-notice">
                            <span class="material-symbols-outlined">power_off</span>
                            <span>Power is off at the wall switch.</span>
                        </div>
                    </div>
                `;
            }
        } else if (guestAccessLevel === 'full') {
            cardsHtml += `<div class="ha-card"><div class="ha-card-title">${formatCardTitle(key, house)}</div><div class="ha-card-status" id="ha-status-${key}">Loading...</div></div>`;
        }
    });

    if (!cardsHtml.trim()) {
        dashboard.style.display = 'none';
    } else {
        dashboard.innerHTML = cardsHtml;
    }

    // --- FIX FOR TEMPERATURE SLIDER ---
    document.querySelectorAll('.climate-slider').forEach(slider => {
        slider.addEventListener('input', handleSliderInput);
        // Pass values directly to the debounced function instead of the event object
        slider.addEventListener('change', (event) => {
            const currentSlider = event.currentTarget;
            const newTemp = parseFloat(currentSlider.value);
            debouncedSetTemperature(currentSlider.dataset.entity, newTemp, currentBookingConfig.house);
        });
    });
    // --- END FIX ---

    document.querySelectorAll('.light-switch').forEach(toggle => {
        toggle.addEventListener('change', handleLightToggle);
    });
    
    document.querySelectorAll('.light-slider').forEach(slider => {
        slider.addEventListener('input', (e) => {
             const card = e.target.closest('.light-control-card');
             const type = e.target.dataset.type;
             const valueDisplay = card.querySelector(`[data-value-for="${type}"]`);
             if (type === 'brightness') {
                 valueDisplay.textContent = `${Math.round(e.target.value / 2.55)}%`;
             } else {
                 valueDisplay.textContent = `${Math.round(1000000 / e.target.value)}K`;
             }
        });
        slider.addEventListener('change', handleLightSlider);
    });
}

async function handleLightToggle(event) {
    const toggle = event.currentTarget;
    const entityId = toggle.dataset.entity;
    toggle.disabled = true;

    try {
        await fetch(`${BACKEND_API_BASE_URL}/api/ha-proxy`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ house: currentBookingConfig.house, entity: entityId, type: 'light_toggle', opaqueBookingKey: opaqueBookingKey })
        });
        // We re-fetch the full status shortly, so no need to update state manually
    } catch (error) {
        console.error('Error toggling light:', error);
        toggle.checked = !toggle.checked; // Revert on failure
    } finally {
        setTimeout(() => displayHomeAssistantStatus(currentBookingConfig), 500); // Refresh state after a moment
        toggle.disabled = false;
    }
}

const handleLightSlider = debounce(async (event) => {
    const slider = event.currentTarget;
    const entityId = slider.dataset.entity;
    const type = slider.dataset.type;
    const value = slider.value;
    
    const apiType = type === 'brightness' ? 'light_set_brightness' : 'light_set_color_temp';

    try {
        await fetch(`${BACKEND_API_BASE_URL}/api/ha-proxy`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ house: currentBookingConfig.house, entity: entityId, type: apiType, value: value, opaqueBookingKey: opaqueBookingKey })
        });
    } catch (error) {
        console.error(`Error setting light ${type}:`, error);
    } finally {
        setTimeout(() => displayHomeAssistantStatus(currentBookingConfig), 500);
    }
}, 500);


async function fetchHAData(entityId, house, type = 'state') {
  const proxyUrl = `${BACKEND_API_BASE_URL}/api/ha-proxy`;
  const response = await fetch(`${proxyUrl}?house=${house}&entity=${entityId}&type=${type}&opaqueBookingKey=${opaqueBookingKey}`);
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
            body: JSON.stringify({ house, entity: entityId, type: 'set_temperature', temperature: newTemp, opaqueBookingKey: opaqueBookingKey })
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || 'Failed to set temperature.');
        console.log('Successfully set temperature:', data);
        displayHomeAssistantStatus(currentBookingConfig); 
    } catch (error) {
        console.error('Error setting temperature:', error);
    }
}

function handleSliderInput(event) {
    const slider = event.currentTarget;
    const entityId = slider.dataset.entity;
    const container = document.getElementById(`climate-${entityId}`);
    const display = container.querySelector('.climate-set-temp-display');
    display.textContent = `${parseFloat(slider.value).toFixed(1)}°`;
}

const debouncedSetTemperature = debounce((event) => {
    const slider = event.currentTarget;
    const newTemp = parseFloat(slider.value);
    setTemperature(slider.dataset.entity, newTemp, currentBookingConfig.house);
}, 500);

async function handleLightToggle(event) {
    const toggle = event.currentTarget;
    const entityId = toggle.dataset.entity;
    
    toggle.disabled = true;

    try {
        const response = await fetch(`${BACKEND_API_BASE_URL}/api/ha-proxy`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                house: currentBookingConfig.house,
                entity: entityId,
                type: 'toggle_light',
                opaqueBookingKey: opaqueBookingKey
            })
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || 'Failed to toggle light.');
        
        const newState = data.state.find(s => s.entity_id === entityId);
        if (newState) {
            toggle.checked = newState.state === 'on';
        }
    } catch (error) {
        console.error('Error toggling light:', error);
        toggle.checked = !toggle.checked; 
    } finally {
        toggle.disabled = false;
    }
}

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
        for (const [entityId, friendlyName] of Object.entries(climateEntities)) {
            const container = document.getElementById(`climate-${entityId}`);
            if (container) {
                try {
                    const state = await fetchHAData(entityId, house);
                    const { current_temperature, temperature } = state.attributes;
                    container.querySelector('.climate-current-temp').textContent = `Current: ${current_temperature.toFixed(1)}°`;
                    const display = container.querySelector('.climate-set-temp-display');
                    const slider = container.querySelector('.climate-slider');
                    display.textContent = `${temperature.toFixed(1)}°`;
                    slider.value = temperature;
                    slider.disabled = false;
                } catch (error) {
                    console.error(`Climate fetch error for ${entityId}:`, error);
                    container.querySelector('.climate-current-temp').textContent = 'Status unavailable';
                }
            }
        }
    } else if (key === 'lights' && guestAccessLevel === 'full') {
        for (const entityId of Object.keys(entityValue)) {
            const card = document.getElementById(`light-card-${entityId.replace(/\./g, '-')}`);
            if (!card) continue;
            
            try {
                const state = await fetchHAData(entityId, house);

                if (state.state === 'unavailable') {
                    card.classList.add('is-unavailable');
                } else {
                    card.classList.remove('is-unavailable');
                    
                    const { attributes, state: onOffState } = state;
                    
                    const toggle = card.querySelector('.light-switch');
                    toggle.checked = onOffState === 'on';
                    toggle.disabled = false;

                    const sliderGroup = card.querySelector('.light-slider-group');
                    const brightnessRow = card.querySelector('[data-control="brightness"]');
                    const colorTempRow = card.querySelector('[data-control="color_temp"]');

                    let hasControls = false;

                    // --- FIX FOR LIGHT SLIDERS ---
                    // This logic now correctly shows each slider independently.
                    
                    // Feature Detection: Brightness
                    if (attributes.supported_color_modes?.includes('brightness')) {
                        hasControls = true;
                        brightnessRow.style.display = 'flex';
                        const slider = brightnessRow.querySelector('.light-slider');
                        const valueDisplay = brightnessRow.querySelector('.light-slider-value');
                        const currentBrightness = attributes.brightness || 0;
                        slider.value = currentBrightness;
                        valueDisplay.textContent = `${Math.round(currentBrightness / 2.55)}%`;
                        slider.disabled = false;
                    } else {
                        brightnessRow.style.display = 'none';
                    }

                    // Feature Detection: Color Temp
                    if (attributes.supported_color_modes?.includes('color_temp')) {
                        hasControls = true;
                        colorTempRow.style.display = 'flex';
                        const slider = colorTempRow.querySelector('.light-slider');
                        const valueDisplay = colorTempRow.querySelector('.light-slider-value');
                        slider.min = attributes.min_mireds;
                        slider.max = attributes.max_mireds;
                        slider.style.direction = 'rtl';
                        const currentColorTemp = attributes.color_temp || attributes.min_mireds;
                        slider.value = currentColorTemp;
                        valueDisplay.textContent = `${Math.round(1000000 / currentColorTemp)}K`;
                        slider.disabled = false;
                    } else {
                        colorTempRow.style.display = 'none';
                    }
                    // --- END FIX ---
                    
                    if(hasControls) {
                        sliderGroup.style.display = 'flex';
                    } else {
                        sliderGroup.style.display = 'none';
                    }
                }
            } catch (error) {
                console.error(`Light fetch error for ${entityId}:`, error);
                card.classList.add('is-unavailable');
            }
        }
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
    const userInputField = document.getElementById('user-input');
    const inputContainer = document.getElementById('chat-input-container');
    const userInput = userInputField.value.trim();

    if (!userInput || inputContainer.classList.contains('loading')) return;

    const chatBox = document.getElementById('chat-box');
    const now = new Date();
    const getTimeStamp = () => now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const userMessageHtml = `<div class="message-bubble user-message"><p>${userInput}</p></div><div class="timestamp">${getTimeStamp()}</div>`;
    chatBox.insertAdjacentHTML('beforeend', userMessageHtml);
    chatHistory.push({ role: 'user', content: userInput, timestamp: now.toISOString() });
    userInputField.value = '';
    
    inputContainer.classList.add('loading');
    
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
        chatHistory.push({ role: 'model', content: fullResponse, timestamp: new Date().toISOString() });
        const timestampHtml = `<div class="timestamp">${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>`;
        chatBox.insertAdjacentHTML('beforeend', timestampHtml);
    } catch (error) {
        console.error('Fetch error:', error);
        typingIndicator.remove();
        const errorHtml = `<div class="message-bubble bot-message"><p>Sorry, I'm having trouble connecting. Please try again later.</p></div><div class="timestamp">${getTimeStamp()}</div>`;
        chatBox.insertAdjacentHTML('beforeend', errorHtml);
    } finally {
        inputContainer.classList.remove('loading');
        userInputField.focus(); 
        chatBox.scrollTop = chatBox.scrollHeight;
    }
}

function formatCardTitle(key, houseNumber) {
    const title = key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
    return `House ${houseNumber} ${title}`;
}

const weatherIconMap = { 'clear-night':'clear_night', 'cloudy':'cloudy', 'fog':'foggy', 'hail':'weather_hail', 'lightning':'thunderstorm', 'lightning-rainy':'thunderstorm', 'partlycloudy':'partly_cloudy_day', 'pouring':'rainy', 'rainy':'rainy', 'snowy':'weather_snowy', 'snowy-rainy':'weather_snowy', 'sunny':'sunny', 'windy':'windy', 'windy-variant':'windy', 'exceptional':'warning' };

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

function setupChatToggle() {
  const chatLauncher = document.getElementById('chat-launcher');
  const isMobile = () => window.innerWidth <= 768;

  const launchChat = (e) => {
    e.preventDefault();
    if (isMobile()) {
      const currentSearchParams = window.location.search;
      sessionStorage.setItem('chatbotContext', chatbotContext);
      sessionStorage.setItem('chatHistory', JSON.stringify(chatHistory));
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

function getStaticContent() {
  return {
    'video': {
      title: 'Instructional Video Playlist', emoji: '🎬',
      html: `<p>This playlist contains all the instructional videos from this guide in one convenient location.</p><a href="https://www.youtube.com/playlist?list=PL7olRlH5yDt4Zk_2CIS9fRnkYmC9gkcDh" target="_blank" rel="noopener noreferrer">Link to Full YouTube Playlist</a>`
    },
    'what-not-to-bring': {
      title: 'What not to bring', emoji: '🚫',
      html: `<p>We provide a variety of amenities so you can pack light! Here are some things you <em>don’t</em> need to bring:</p><ul><li><strong>Towels & Linens:</strong> Fresh bath towels and bed linens are provided.</li><li><strong>Toiletries:</strong> Shampoo, conditioner, body wash, and hand soap are available.</li><li><strong>Hair Dryers:</strong> Each bedroom has a hairdryer.</li><li><strong>Adapters:</strong> Rooms have universal adapters on each side of the bed.</li><li><strong>Extra Blankets:</strong> All beds include an electric under-blanket.</li></ul>`
    },
    'domestic-directions': {
      title: 'Domestic directions', emoji: '🚶',
      html: `<p><strong>By Train/Tube:</strong> We are ~7 minutes from <strong>London Victoria Station</strong>. Exit towards Victoria Street/Vauxhall Bridge Road, turn left, and walk ~5–7 minutes. The house will be on your left.</p><p><strong>By Coach:</strong> From Victoria Coach Station, it’s a ~10 minute walk.</p><p><strong>By Car/Taxi:</strong> We do not have on-site parking. Please check <a href="https://en.parkopedia.com/" target="_blank" rel="noopener noreferrer">Parkopedia</a> for public garages.</p>`
    },
    'airport-directions': {
        title: 'Airport directions', emoji: '✈️',
        html: `<p>Book buses at <a href="https://www.nationalexpress.com" target="_blank" rel="noopener noreferrer">National Express</a> and trains at <a href="https://www.thetrainline.com" target="_blank" rel="noopener noreferrer">The Trainline</a>.</p><p><strong>Gatwick (LGW):</strong> Take a Southern Rail train directly to Victoria (~35 mins). It's cheaper and only slightly slower than the Gatwick Express.</p><p><strong>Heathrow (LHR):</strong> Take the Piccadilly line (dark blue) and change at Hammersmith for a District line (green) train to Victoria (~50 mins total).</p><p><strong>Stansted (STN):</strong> Take the train to Tottenham Hale, then switch to the Victoria line (light blue) to Victoria Station. You cannot use contactless from Stansted.</p><p><strong>Luton (LTN):</strong> Take the train from Luton Airport Parkway to London St. Pancras (~40 mins), then the Victoria line to Victoria (~15 mins).</p>`
    },
    'getting-around': {
        title: 'Getting around', emoji: '🚇',
        html: `<p>Public transport is excellent. Victoria Station is ~7 minutes away. The <strong>24 bus</strong> stop near the house offers a scenic route through central London.</p><p>Use a contactless card for Tube/bus fares (they cap daily). London is very walkable, and you can also take a <strong>Thames river bus</strong> from Westminster Pier.</p>`
    },
    'codetimes': {
        title: 'Lock info', emoji: '*️⃣',
        html: `<p><strong>How to unlock:</strong> Press your palm to the black screen to activate the keypad. See the video playlist for a demonstration.</p><p><strong>Front door & Luggage (Cupboard V):</strong> Your code is valid from 11:00 on check-in day until 14:00 on check-out day.</p><p><strong>Bedroom/Bathroom/Kitchen:</strong> Your code is valid from 15:00 on check-in day until 11:00 on check-out day.</p><p><strong>Locking from inside:</strong> This video shows how to lock your bedroom door from the inside for privacy.</p><div class="video-container"><iframe src="https://www.youtube.com/embed/7orX7Wh_g1U" title="How to lock door from inside" allowfullscreen></iframe></div>`
    },
     'heating': {
        title: 'Heating and Cooling', emoji: '🌡️',
        html: `<p>You can control the temperature in your room using the valve (TRV) on your radiator. For bookings with smart home controls, you can also adjust this from the dashboard on this page.</p><p><strong>Cooling:</strong> We do not have air conditioning. We recommend keeping the window and curtains closed during sunny days and opening them in the evening.</p>`
    },
    'lights-note': {
        title: "A Note on Light Controls", emoji: "🔌",
        html: `<p>Please note that these smart lights can only be controlled from this app when the physical light switch on the wall is in the 'ON' position. If a light is unresponsive, please check that its corresponding wall switch is turned on first.</p>`
    },
    'ironing': {
        title: 'Iron & Ironing Mat', emoji: '👕',
        html: `<p>An iron and a portable ironing mat can be found in the kitchen. The mat can be placed on a table or other firm surface for use. Please return both items to the kitchen when you are finished.</p>`
    },
    'troubleshooting': {
        title: 'Troubleshooting', emoji: '🛠️',
        html: `<p>If your digital door lock runs out of batteries, this video shows the simple replacement process:</p><div class="video-container"><iframe src="https://www.youtube.com/embed/8Zofre6A7ns" title="How to replace door lock batteries" allowfullscreen></iframe></div>`
    },
    'contact': {
        title: 'Contact', emoji: '☎️',
        html: `<p>For any questions, please check with our AI assistant, Victoria, first. For other matters, message us through your booking platform.</p><p><strong>*FOR EMERGENCIES ONLY*</strong>, please WhatsApp call +44 7443 618207. If there is no answer, try +44 7383 298999.</p>`
    },
    'tv': {
        title: 'TV', emoji: '📺',
        html: `<p>Each bedroom has a Smart 4K TV with Disney+, Apple TV+, Amazon Prime Video, BBC iPlayer, and more. If a service is logged out or malfunctions, please contact us and we can log you in remotely.</p>`
    },
    'local-guidebook': {
        title: 'Local Guidebook', emoji: '📍',
        html: `<h3>Food</h3><ul><li><a href="https://www.google.com/maps/search/?api=1&query=Regency+Cafe+London" target="_blank" rel="noopener">Regency Cafe</a> – traditional full English breakfast</li><li><a href="https://www.google.com/maps/search/?api=1&query=Jugged+Hare+London" target="_blank" rel="noopener">Jugged Hare</a> – great pub across the road</li><li><a href="https://www.google.com/maps/search/?api=1&query=Tachbrook+Street+Market+London" target="_blank" rel="noopener">Tachbrook Street Market</a> – local market for lunch on weekdays</li><li><a href="https://www.google.com/maps/search/?api=1&query=Kimchimama+London" target="_blank" rel="noopener">Kimchimama</a> – casual Korean food (especially fried chicken)</li><li><a href="https://www.google.com/maps/search/?api=1&query=Ben+Venuti+London" target="_blank" rel="noopener">Ben Venuti</a> – amazing Italian cafe around the corner</li><li><a href="https://www.google.com/maps/search/?api=1&query=Tozi+London" target="_blank" rel="noopener">Tozi</a> – upscale Italian restaurant nearby</li><li><a href="https://www.google.com/maps/search/?api=1&query=A+Wong+70+Wilton+Road+London" target="_blank" rel="noopener">A. Wong</a> – Michelin-starred Chinese restaurant behind the house</li><li><a href="https://www.google.com/maps/search/?api=1&query=Little+Waitrose+London" target="_blank" rel="noopener">Little Waitrose</a> – closest upmarket supermarket</li><li><a href="https://www.google.com/maps/search/?api=1&query=Sainsbury%27s+Victoria+Station" target="_blank" rel="noopener">Sainsbury's</a> – big supermarket</li><li><a href="https://www.google.com/maps/search/?api=1&query=Rippon+Cheese+London" target="_blank" rel="noopener">Rippon Cheese</a> – famous cheese store nearby</li><li><a href="https://www.google.com/maps/search/?api=1&query=Dishoom+London" target="_blank" rel="noopener">Dishoom</a> – famous Indian food (further away, book in advance)</li><li><a href="https://www.google.com/maps/search/?api=1&query=Gold+Mine+London" target="_blank" rel="noopener">Gold Mine</a> – great Peking duck (further away)</li></ul><h3>Sights</h3><ul><li>Wicked and Hamilton – Two of the world's best musicals are right on our doorstep.</li><li>St James's Park – A beautiful royal park, perfect for a stroll.</li><li>A great walk: Start at Big Ben, cross Westminster Bridge, and walk along the scenic South Bank to Tower Bridge.</li></ul>`
    }
  };
}

function setupEnterKeyListener() {
  const userInputField = document.querySelector('#chat-widget #user-input');
  if (userInputField) { userInputField.addEventListener('keypress', (e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); } }); }
}

function addInitialBotMessage() {
    const chatBox = document.getElementById('chat-box');
    const welcomeMessage = `<div class="message-bubble bot-message"><p>Welcome to 195VBR! I'm Victoria, your AI assistant. Ask me anything about the guesthouse or your London trip.</p></div>`;
    chatBox.innerHTML = welcomeMessage;

    chatHistory = [{
        role: 'model',
        content: "Welcome to 195VBR! I'm Victoria, your AI assistant. Ask me anything about the guesthouse or your London trip.",
        timestamp: new Date().toISOString()
    }];
}