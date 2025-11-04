// js/content.js

// This file contains all logic for generating and assembling guidebook content.

/**
 * Combines static, dynamic, and personalized content into a single object.
 * @param {string[]} requiredKeys - Array of content keys for the specific booking.
 * @param {object} guestDetails - Details for the guest.
 * @param {object} contentFragments - All possible content fragments from config.json.
 * @param {string} bookingKey - The booking identifier.
 * @param {boolean} [isLegacy=false] - Flag for old legacy guidebook versions.
 * @returns {object} The final, combined content object for rendering.
 */
function generatePageContent(requiredKeys, guestDetails, contentFragments, bookingKey, isLegacy = false) {
  const staticContent = getStaticContent();
  const dynamicPersonalizedContent = isLegacy ? {} : getDynamicPersonalizedContent(guestDetails, bookingKey);
  const dynamicConfigContent = buildDynamicContent(requiredKeys, contentFragments);
  
  return { ...staticContent, ...dynamicPersonalizedContent, ...dynamicConfigContent };
}

/**
 * Builds the final context string for the AI chatbot.
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

function buildDynamicContent(keys, fragments) {
  const content = {};
  keys.forEach(key => {
    const fragment = fragments[key];
    if (fragment) {
      if (!content[fragment.title]) {
        const emoji = { "Address": "🏘️", "Wifi": "🛜", "Bedroom": "🛏️", "Bathroom": "🛁", "Kitchen": "🍳", "Windows": "🪟", "Laundry": "🧺", "Check-in & Luggage": "🧳", "Rubbish Disposal": "🗑️", "Check-out": "👋", "Heating and Cooling": "🌡️", "A Note on Light Controls": "🔌"}[fragment.title] || 'ℹ️';
        content[fragment.title] = { title: fragment.title, emoji: emoji, html: '' };
      }
      content[fragment.title].html += fragment.html;
    }
  });
  return content;
}

// --- THIS IS THE MISSING FUNCTION THAT HAS BEEN RESTORED ---
function getDynamicPersonalizedContent(guestDetails, bookingKey) {
    if (!guestDetails || !guestDetails.checkInDateISO) return {};
    
    const personalizedContent = {};
    const checkInDate = new Date(guestDetails.checkInDateISO);
    const checkOutDate = new Date(guestDetails.checkOutDateISO);
    const dayBeforeCheckIn = new Date(checkInDate);
    dayBeforeCheckIn.setDate(checkInDate.getDate() - 1);
    const dayBeforeCheckOut = new Date(checkOutDate);
    dayBeforeCheckOut.setDate(checkOutDate.getDate() - 1);
    const dateOptions = { weekday: 'long', month: 'long', day: 'numeric' };
    const dayBeforeCheckInFormatted = dayBeforeCheckIn.toLocaleDateString('en-GB', dateOptions);
    const dayBeforeCheckOutFormatted = dayBeforeCheckOut.toLocaleDateString('en-GB', dateOptions);

    const isWholeHome = bookingKey && bookingKey.includes('vbr');
    let luggageHtml = '';

    if (isWholeHome) {
        luggageHtml = `<p><strong>Self Check-in:</strong> From 15:00 onwards on ${guestDetails.checkInDateFormatted}.</p><p><strong>Luggage Storage:</strong> If you require luggage storage outside of check-in/out times, please message us. Depending on availability, you may be able to store bags in the front room (Room 1).</p>`;
    } else {
        luggageHtml = `<p><strong>Self Check-in:</strong> From 15:00 onwards on ${guestDetails.checkInDateFormatted}.</p><p><strong>Early Luggage Drop-off:</strong> From 11:00, you can use your front door code to access Cupboard V downstairs.</p><p>If you need to store bags before 11:00, please send us a message at the earliest the day before your arrival (on ${dayBeforeCheckInFormatted}), and if we can accommodate it, we're happy to.</p><p><strong>Early Check-in:</strong> While you are welcome to check if the room is ready from midday onwards, please only leave your belongings inside if it is completely finished. If it's not ready, please use Cupboard V.</p><p>This video shows the full process:</p><div class="video-container"><iframe src="https://www.youtube.com/embed/rlUbHfWcN0s" title="Luggage drop-off process" allowfullscreen></iframe></div>`;
    }

    personalizedContent['guestLuggage'] = {
        title: "Check-in & Luggage", emoji: "🧳",
        html: luggageHtml
    };
    
    personalizedContent['checkout'] = {
        title: "Check-out", emoji: "👋",
        html: `<p>Check-out is at <strong>11:00 AM on ${guestDetails.checkOutDateFormatted}</strong>.</p><p>You don't need to worry about any cleaning; our team will handle everything.</p><p>If you need to store your luggage 🧳 after you check out, you are welcome to use Cupboard V downstairs. Your existing entry code will continue to work for the front door and the cupboard until 14:00. If you need to arrange a later pick-up, please send us a message (ideally by ${dayBeforeCheckOutFormatted}) to check for availability. We need to confirm because the house may be privately booked by a new group from 15:00, and for their privacy and security, access won't be possible after their check-in time.</p><p>⚠️ <strong>A quick but important request:</strong> Please be sure to take all your belongings from the room by 11am. Our cleaning team works on a tight schedule and will clear the room completely for our next guests.</p>`
    };

    return personalizedContent;
}
// --- END OF RESTORED FUNCTION ---

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

function getStaticContent() {
  return {
    'video': { title: 'Instructional Video Playlist', emoji: '🎬', html: `<p>This playlist contains all the instructional videos from this guide in one convenient location.</p><a href="https://www.youtube.com/playlist?list=PL7olRlH5yDt4Zk_2CIS9fRnkYmC9gkcDh" target="_blank" rel="noopener noreferrer">Link to Full YouTube Playlist</a>` },
    'what-not-to-bring': { title: 'What not to bring', emoji: '🚫', html: `<p>We provide a variety of amenities so you can pack light! Here are some things you <em>don’t</em> need to bring:</p><ul><li><strong>Towels & Linens:</strong> Fresh bath towels and bed linens are provided.</li><li><strong>Toiletries:</strong> Shampoo, conditioner, body wash, and hand soap are available.</li><li><strong>Hair Dryers:</strong> Each bedroom has a hairdryer.</li><li><strong>Adapters:</strong> Rooms have universal adapters on each side of the bed.</li><li><strong>Extra Blankets:</strong> All beds include an electric under-blanket.</li></ul>` },
    'domestic-directions': { title: 'Domestic directions', emoji: '🚶', html: `<p><strong>By Train/Tube:</strong> We are ~7 minutes from <strong>London Victoria Station</strong>. Exit towards Victoria Street/Vauxhall Bridge Road, turn left, and walk ~5–7 minutes. The house will be on your left.</p><p><strong>By Coach:</strong> From Victoria Coach Station, it’s a ~10 minute walk.</p><p><strong>By Car/Taxi:</strong> We do not have on-site parking. Please check <a href="https://en.parkopedia.com/" target="_blank" rel="noopener noreferrer">Parkopedia</a> for public garages.</p>` },
    'airport-directions': { title: 'Airport directions', emoji: '✈️', html: `<p>Book buses at <a href="https://www.nationalexpress.com" target="_blank" rel="noopener noreferrer">National Express</a> and trains at <a href="https://www.thetrainline.com" target="_blank" rel="noopener noreferrer">The Trainline</a>.</p><p><strong>Gatwick (LGW):</strong> Take a Southern Rail train directly to Victoria (~35 mins). It's cheaper and only slightly slower than the Gatwick Express.</p><p><strong>Heathrow (LHR):</strong> Take the Piccadilly line (dark blue) and change at Hammersmith for a District line (green) train to Victoria (~50 mins total).</p><p><strong>Stansted (STN):</strong> Take the train to Tottenham Hale, then switch to the Victoria line (light blue) to Victoria Station. You cannot use contactless from Stansted.</p><p><strong>Luton (LTN):</strong> Take the train from Luton Airport Parkway to London St. Pancras (~40 mins), then the Victoria line to Victoria (~15 mins).</p>` },
    'getting-around': { title: 'Getting around', emoji: '🚇', html: `<p>Public transport is excellent. Victoria Station is ~7 minutes away. The <strong>24 bus</strong> stop near the house offers a scenic route through central London.</p><p>Use a contactless card for Tube/bus fares (they cap daily). London is very walkable, and you can also take a <strong>Thames river bus</strong> from Westminster Pier.</p>` },
    'codetimes': { title: 'Lock info', emoji: '*️⃣', html: `<p><strong>How to unlock:</strong> Press your palm to the black screen to activate the keypad. See the video playlist for a demonstration.</p><p><strong>Front door & Luggage (Cupboard V):</strong> Your code is valid from 11:00 on check-in day until 14:00 on check-out day.</p><p><strong>Bedroom/Bathroom/Kitchen:</strong> Your code is valid from 15:00 on check-in day until 11:00 on check-out day.</p><p><strong>Locking from inside:</strong> This video shows how to lock your bedroom door from the inside for privacy.</p><div class="video-container"><iframe src="https://www.youtube.com/embed/7orX7Wh_g1U" title="How to lock door from inside" allowfullscreen></iframe></div>` },
    'ironing': { title: 'Iron & Ironing Mat', emoji: '👕', html: `<p>An iron and a portable ironing mat can be found in the kitchen. The mat can be placed on a table or other firm surface for use. Please return both items to the kitchen when you are finished.</p>` },
    'troubleshooting': { title: 'Troubleshooting', emoji: '🛠️', html: `<p>If your digital door lock runs out of batteries, this video shows the simple replacement process:</p><div class="video-container"><iframe src="https://www.youtube.com/embed/8Zofre6A7ns" title="How to replace door lock batteries" allowfullscreen></iframe></div>` },
    'contact': { title: 'Contact', emoji: '☎️', html: `<p>For any questions, please check with our AI assistant, Victoria, first. For other matters, message us through your booking platform.</p><p><strong>*FOR EMERGENCIES ONLY*</strong>, please WhatsApp call +44 7443 618207. If there is no answer, try +44 7383 298999.</p>` },
    'tv': { title: 'TV', emoji: '📺', html: `<p>Each bedroom has a Smart 4K TV with Disney+, Apple TV+, Amazon Prime Video, BBC iPlayer, and more. If a service is logged out or malfunctions, please contact us and we can log you in remotely.</p>` },
    'local-guidebook': { title: 'Local Guidebook', emoji: '📍', html: `<h3>Food</h3><ul><li><a href="https://www.google.com/maps/search/?api=1&query=Regency+Cafe+London" target="_blank" rel="noopener">Regency Cafe</a> – traditional full English breakfast</li><li><a href="https://www.google.com/maps/search/?api=1&query=Jugged+Hare+London" target="_blank" rel="noopener">Jugged Hare</a> – great pub across the road</li><li><a href="https://www.google.com/maps/search/?api=1&query=Tachbrook+Street+Market+London" target="_blank" rel="noopener">Tachbrook Street Market</a> – local market for lunch on weekdays</li><li><a href="https://www.google.com/maps/search/?api=1&query=Kimchimama+London" target="_blank" rel="noopener">Kimchimama</a> – casual Korean food (especially fried chicken)</li><li><a href="https://www.google.com/maps/search/?api=1&query=Ben+Venuti+London" target="_blank" rel="noopener">Ben Venuti</a> – amazing Italian cafe around the corner</li><li><a href="https://www.google.com/maps/search/?api=1&query=Tozi+London" target="_blank" rel="noopener">Tozi</a> – upscale Italian restaurant nearby</li><li><a href="https://www.google.com/maps/search/?api=1&query=A+Wong+70+Wilton+Road+London" target="_blank" rel="noopener">A. Wong</a> – Michelin-starred Chinese restaurant behind the house</li><li><a href="https://www.google.com/maps/search/?api=1&query=Little+Waitrose+London" target="_blank" rel="noopener">Little Waitrose</a> – closest upmarket supermarket</li><li><a href="https://www.google.com/maps/search/?api=1&query=Sainsbury%27s+Victoria+Station" target="_blank" rel="noopener">Sainsbury's</a> – big supermarket</li><li><a href="https://www.google.com/maps/search/?api=1&query=Rippon+Cheese+London" target="_blank" rel="noopener">Rippon Cheese</a> – famous cheese store nearby</li><li><a href="https://www.google.com/maps/search/?api=1&query=Dishoom+London" target="_blank" rel="noopener">Dishoom</a> – famous Indian food (further away, book in advance)</li><li><a href="https://www.google.com/maps/search/?api=1&query=Gold+Mine+London" target="_blank" rel="noopener">Gold Mine</a> – great Peking duck (further away)</li></ul><h3>Sights</h3><ul><li>Wicked and Hamilton – Two of the world's best musicals are right on our doorstep.</li><li>St James's Park – A beautiful royal park, perfect for a stroll.</li><li>A great walk: Start at Big Ben, cross Westminster Bridge, and walk along the scenic South Bank to Tower Bridge.</li></ul>` }
  };
}