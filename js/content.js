// js/content.js

// This file contains all logic for generating and assembling guidebook content.

/**
 * Generates the final, combined content object for rendering.
 * @param {string[]} requiredKeys - Array of content keys for the specific booking.
 * @param {object} guestDetails - Details for the guest.
 * @param {object} contentFragments - All possible content fragments from config.json.
 * @param {string} bookingKey - The booking identifier.
 * @returns {object} The final content object.
 */
function generatePageContent(requiredKeys, guestDetails, contentFragments, bookingKey) {
  // **FIX: All content, including personalized sections, is now handled here.**
  const dynamicContent = buildDynamicContent(requiredKeys, contentFragments, guestDetails, bookingKey);
  const staticContent = getStaticContent();
  
  // Merge dynamic content over static content.
  return { ...staticContent, ...dynamicContent };
}

/**
 * Builds the content sections that are dynamically determined by the booking key.
 * This function now ALSO handles the personalized check-in/out sections.
 * @param {string[]} keys - The array of content fragment keys from config.json for the booking.
 * @param {object} fragments - The `contentFragments` object from config.json.
 * @param {object} guestDetails - The guest's details, including dates.
 * @param {string} bookingKey - The booking identifier.
 * @returns {object} The assembled dynamic content object.
 */
function buildDynamicContent(keys, fragments, guestDetails, bookingKey) {
  const content = {};
  
  // Prepare date-related replacements for personalized content
  const replacements = {};
  if (guestDetails.checkInDateISO) {
    const dateOptions = { weekday: 'long', month: 'long', day: 'numeric', timeZone: 'Europe/London' };
    const dayBeforeCheckIn = new Date(guestDetails.checkInDateISO);
    dayBeforeCheckIn.setDate(new Date(guestDetails.checkInDateISO).getDate() - 1);
    
    // **FIX: The missing calculation for dayBeforeCheckOut has been added.**
    const dayBeforeCheckOut = new Date(guestDetails.checkOutDateISO);
    dayBeforeCheckOut.setDate(new Date(guestDetails.checkOutDateISO).getDate() - 1);

    replacements.checkInDateFormatted = new Date(guestDetails.checkInDateISO).toLocaleDateString(I18nState.currentLanguage, dateOptions);
    replacements.dayBeforeCheckInFormatted = dayBeforeCheckIn.toLocaleDateString(I18nState.currentLanguage, dateOptions);
    replacements.checkOutDateFormatted = new Date(guestDetails.checkOutDateISO).toLocaleDateString(I18nState.currentLanguage, dateOptions);
    replacements.dayBeforeCheckOutFormatted = dayBeforeCheckOut.toLocaleDateString(I18nState.currentLanguage, dateOptions);
  }

  // **FIX: Manually add the personalized check-in and check-out sections to the list of keys to be processed.**
  // This is the core of the fix. We ensure they are always included for non-legacy bookings.
  if (guestDetails.guestFirstName) {
      const isWholeHome = bookingKey && bookingKey.includes('vbr');
      // Add the correct check-in key based on booking type
      keys.push(isWholeHome ? 'wholeHomeLuggage' : 'checkinStaticDetailed');
      // Always add the detailed check-out key
      keys.push('checkoutStaticDetailed');
  }

  keys.forEach(key => {
    const fragment = fragments[key];
    if (fragment) {
      if (!content[fragment.title]) {
        const emoji = { "Address": "🏘️", "Wifi": "🛜", "Bedroom": "🛏️", "Bathroom": "🛁", "Kitchen": "🍳", "Windows": "🪟", "Laundry": "🧺", "Check-in & Luggage": "🧳", "Rubbish Disposal": "🗑️", "Check-out": "👋", "Heating and Cooling": "🌡️", "A Note on Light Controls": "🔌"}[fragment.title] || 'ℹ️';
        content[fragment.title] = { title: fragment.title, emoji: emoji, html: '' };
      }
      content[fragment.title].html += t(fragment.html, replacements);
    }
  });
  return content;
}


/**
 * Builds the final context string for the AI chatbot in the user's language.
 * @param {object} content - The fully assembled page content.
 * @param {object} guestDetails - The guest's details.
 * @param {string} bookingKey - The booking identifier.
 * @returns {string} The complete context string for the AI.
 */
function buildChatbotContext(content, guestDetails, bookingKey) {
  let contextText = '';
  const tempDiv = document.createElement('div');

  if (guestDetails && guestDetails.guestName) {
    contextText += `--- GUEST INFORMATION ---\n`;
    contextText += `Name: ${guestDetails.guestName}\n`;
    const dateOptions = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
    const checkInDateFormatted = new Date(guestDetails.checkInDateISO).toLocaleDateString('en-GB', dateOptions);
    const checkOutDateFormatted = new Date(guestDetails.checkOutDateISO).toLocaleDateString('en-GB', dateOptions);
    contextText += `Check-in Date: ${checkInDateFormatted}\n`;
    contextText += `Check-out Date: ${checkOutDateFormatted}\n\n`;
  }

  contextText += getChatbotOnlyContext(bookingKey) + "\n\n";

  const sectionOrder = ['what_not_to_bring', 'address', 'domestic_directions', 'airport_directions', 'getting_around', 'lock_info', 'checkin_luggage', 'checkout', 'wifi', 'heating_cooling', 'light_controls_note', 'bedroom', 'bathroom', 'kitchen', 'rubbish_disposal', 'windows', 'laundry', 'ironing', 'troubleshooting', 'tv', 'contact', 'local_guidebook'];

  sectionOrder.forEach(titleKey => {
    const englishTitle = t('content_titles.' + titleKey, {}, 'en').toLowerCase();
    const sectionObjectKey = Object.keys(content).find(
      k => content[k].title && content[k].title.toLowerCase() === englishTitle
    );
    
    if (sectionObjectKey && content[sectionObjectKey]) {
      const section = content[sectionObjectKey];
      tempDiv.innerHTML = section.html; 
      
      const iframes = tempDiv.querySelectorAll('iframe');
      iframes.forEach(iframe => {
        const title = iframe.title || 'Instructional Video';
        const src = iframe.src;
        const videoUrl = src.replace('/embed/', '/watch?v='); 
        const videoInfoNode = document.createElement('p');
        videoInfoNode.textContent = `(A video guide for "${title}" is available at this URL: ${videoUrl})`;
        tempDiv.appendChild(videoInfoNode);
      });
      
      const translatedTitle = t('content_titles.' + titleKey);
      contextText += `--- Section: ${translatedTitle} ---\n`;
      const plainText = tempDiv.textContent || tempDiv.innerText || "";
      contextText += plainText.replace(/(\s\s)\s+/g, '$1').trim() + "\n\n";
    }
  });

  const systemPrompt = `You are 'Victoria', a friendly AI assistant for the 195VBR guesthouse. You MUST base your answer ONLY on the detailed guidebook information provided below, which is in the user's language (${I18nState.langName}). This includes the guest's specific booking details and the special hidden context. IMPORTANT: When a user asks for a video, you MUST provide the direct URL to the specific video if one is mentioned in the context for that topic. For all other questions, you should use your general knowledge. Be concise, friendly, and use Markdown for formatting links like [Link Text](URL).`;
  
  return `${systemPrompt}\n\nRELEVANT GUIDEBOOK CONTENT:\n${contextText}`;
}

/**
 * Returns the sections of the guidebook that are static for all bookings.
 * The HTML content is now a key that will be translated.
 * @returns {object} The static content object.
 */
function getStaticContent() {
  return {
    'what-not-to-bring': { title: 'What not to bring', emoji: '🚫', html: t('static_html.what_not_to_bring') },
    'domestic-directions': { title: 'Domestic directions', emoji: '🚶', html: t('static_html.domestic_directions') },
    'airport-directions': { title: 'Airport directions', emoji: '✈️', html: t('static_html.airport_directions') },
    'getting-around': { title: 'Getting around', emoji: '🚇', html: t('static_html.getting_around') },
    'codetimes': { title: 'Lock info', emoji: '*️⃣', html: t('static_html.codetimes') },
    'ironing': { title: 'Iron & Ironing Mat', emoji: '👕', html: t('static_html.ironing') },
    'troubleshooting': { title: 'Troubleshooting', emoji: '🛠️', html: t('static_html.troubleshooting') },
    'contact': { title: 'Contact', emoji: '☎️', html: t('static_html.contact') },
    'tv': { title: 'TV', emoji: '📺', html: t('static_html.tv') },
    'local-guidebook': { title: 'Local Guidebook', emoji: '📍', html: t('static_html.local_guidebook') }
  };
}


function getChatbotOnlyContext(bookingId) {
    const groundFloorLuggageQuirk = "The guest is in a ground floor room. While their room is easily accessible, they should be aware that the luggage storage cupboard (Cupboard V) is downstairs, reached by a narrow staircase. This is something to keep in mind if they plan to store heavy bags.";
    const quirks = {
        '31': groundFloorLuggageQuirk, '32': groundFloorLuggageQuirk + " This room also has a private patio.", '33': "The guest is in Room 3 on the first floor. It has a private en-suite bathroom. The shared kitchen is downstairs. The room is reached by a narrow staircase, which is relevant for heavy luggage.", '34': "The guest is in Room 4 on the second floor. The shared bathroom for this room is located 1.5 floors downstairs. The kitchen is also downstairs. Everything is reached via a narrow staircase. This is a key detail for mobility or heavy luggage.", '35': "The guest is in Room 5 on the second floor. The shared bathroom for this room is located 1.5 floors downstairs. The kitchen is also downstairs. Everything is reached via a narrow staircase. This is a key detail for mobility or heavy luggage.", '36': "The guest is in Room 6, a cozy top-floor loft with some low, sloping ceilings. The shared bathroom is 2.5 floors downstairs. This is a key detail for taller guests, mobility concerns, or heavy luggage.", '3a': "The guest has booked Rooms 1 & 2 on the ground floor. Their private bathroom for the group is located half a floor downstairs. This is reached via a narrow staircase, which is also something to keep in mind if using the downstairs luggage storage cupboard with heavy bags.", '3b': "The guest has booked Rooms 4, 5 & 6, a private suite on the top two floors. One bedroom is a loft with low ceilings. Their private bathroom is multiple floors downstairs on the upper ground level, reached via a narrow staircase. This layout is not a good fit for anyone with mobility concerns or heavy luggage.", '193vbr': "The guest has booked the entire house. The house has an original narrow staircase connecting all floors, which is relevant for groups with heavy luggage or mobility concerns. The common area is cozy and centered around the kitchen, rather than a large living room.",
        '51': groundFloorLuggageQuirk, '52': groundFloorLuggageQuirk + " This room also has a private patio.", '53': "The guest is in Room 3 on the first floor. It has a private en-suite bathroom. The shared kitchen is downstairs. The room is reached by a narrow staircase, which is relevant for heavy luggage.", '54': "The guest is in Room 4 on the second floor. The shared bathroom for this room is located 1.5 floors downstairs. The kitchen is also downstairs. Everything is reached via a narrow staircase. This is a key detail for mobility or heavy luggage.", '55': "The guest is in Room 5 on the second floor. The shared bathroom for this room is located 1.5 floors downstairs. The kitchen is also downstairs. Everything is reached via a narrow staircase. This is a key detail for mobility or heavy luggage.", '56': "The guest is in Room 6, a cozy top-floor loft with some low, sloping ceilings. The shared bathroom is 2.5 floors downstairs. This is a key detail for taller guests, mobility concerns, or heavy luggage.", '5a': "The guest has booked Rooms 1 & 2 on the ground floor. Their private bathroom for the group is located half a floor downstairs. This is reached via a narrow staircase, which is also something to keep in mind if using the downstairs luggage storage cupboard with heavy bags.", '5b': "The guest has booked Rooms 4, 5 & 6, a private suite on the top two floors. One bedroom is a loft with low ceilings. Their private bathroom is multiple floors downstairs on the upper ground level, reached via a narrow staircase. This layout is not a good fit for anyone with mobility concerns or heavy luggage.", '195vbr': "The guest has booked the entire house. The house has an original narrow staircase connecting all floors, which is relevant for groups with heavy luggage or mobility concerns. The common area is cozy and centered around the kitchen, rather than a large living room.",
    };
    const isWholeHome = bookingId.includes('vbr');
    const isLegacy = bookingId === 'legacy';
    const sharedBathroomBookings = new Set(['31', '32', '34', '35', '36', '51', '52', '54', '55', '56']);
    let context = `--- HIDDEN CONTEXT FOR AI ONLY --- **Safety Commitment:** Our property has annual gas and electrical safety certificates. There are interlinked, mains-powered smoke alarms in every room. A fire extinguisher, fire blanket, and first aid kit are provided. Security cameras are in the entrance for safety. **General Check-in Information:** Check-in is anytime from 15:00. The primary method is self check-in with a personalized keypad code, so no keys are needed. **Bedroom Amenities:** All bedrooms include a high-quality firm mattress, an electric underblanket, full blackout curtains, a 4K Smart TV (with Disney+, Apple TV+, etc.), dimmable lighting, a powerful fan, a desk with chairs, a hairdryer, a full-length mirror, and universal adapters. **Wi-Fi:** The entire property has exceptionally fast Fibre 1Gbps Wi-Fi 6. **House Rules & Policies:** - No extra guests, parties, smoking, or pets. - Be respectful of our neighbours.`;
    if (!isWholeHome) { context += `- **Quiet hours are strictly enforced from 10:00 PM to 8:00 AM.** This is our most important rule for shared spaces.\n`; }
    if (isWholeHome) { context += `- **Complimentary housekeeping** (towel refresh, bathroom/kitchen tidy) is available on request for whole-home bookings. The guest must message at least one day in advance. Service is between 11am - 3pm.\n`; }
    if (!isLegacy) { context += `**Room/Booking Specific Quirks:** ${quirks[bookingId] || "No specific quirks for this booking."}\n`; }
    if (!isWholeHome) { context += `**Shared Kitchen:** Located in the basement, it's cleaned to a high standard daily. Each room has a private, labeled compartment in the fridge and cupboard. Complimentary tea and instant coffee are provided. It is fully equipped with an induction hob, oven, microwave, dishwasher, and all cookware.`; }
    if (sharedBathroomBookings.has(bookingId)) { context += `**Shared Bathroom:** Professionally cleaned daily. Features a superior shower with strong, hot water pressure and sustainable toiletries.`; }
    context += `--- END HIDDEN CONTEXT ---`;
    return context;
}