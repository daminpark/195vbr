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

  // **MODIFICATION: Set static UI text using t() function**
  document.title = "195VBR Guidebook"; // This can remain static or be translated if needed
  const chatHeader = document.querySelector("#chat-header span");
  if(chatHeader) chatHeader.textContent = t('chat.header');
  const chatInput = document.getElementById('user-input');
  if(chatInput) chatInput.placeholder = t('chat.input_placeholder');
  const chatCloseBtn = document.getElementById('chat-close');
  if(chatCloseBtn) chatCloseBtn.setAttribute('aria-label', 'Close chat'); // Can be translated

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
    
    // **MODIFICATION: Use t() for translations**
    const welcomeHeader = t('welcome.header', { guestName: guestDetails.guestFirstName });
    const welcomeMessage = isDuringStay 
      ? t('welcome.during_stay')
      : t('welcome.confirmed_booking');
      
    welcomeHtml = `
      <section id="welcome">
        <h2>${welcomeHeader}</h2>
        <p><strong>${t('welcome.checkin_date')}:</strong> ${guestDetails.checkInDateFormatted}<br><strong>${t('welcome.checkout_date')}:</strong> ${guestDetails.checkOutDateFormatted}</p>
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
  let tocHtml = '<ul>';
  
  // **MODIFICATION: Use translation keys instead of English titles**
  const sectionOrder = ['what_not_to_bring', 'address', 'domestic_directions', 'airport_directions', 'getting_around', 'lock_info', 'checkin_luggage', 'checkout', 'wifi', 'heating_cooling', 'light_controls_note', 'bedroom', 'bathroom', 'kitchen', 'rubbish_disposal', 'windows', 'laundry', 'ironing', 'troubleshooting', 'tv', 'contact', 'local_guidebook'];
  
  // Create a map from English title to translation key for easier lookup
  const titleToKeyMap = {};
  Object.keys(allContent).forEach(key => {
    if(allContent[key].title) {
        titleToKeyMap[allContent[key].title.toLowerCase()] = key;
    }
  });

  sectionOrder.forEach(titleKey => {
    // Find the corresponding object key in allContent based on its title property
    const sectionObjectKey = Object.keys(allContent).find(
      key => allContent[key].title && allContent[key].title.toLowerCase() === t('content_titles.' + titleKey).toLowerCase()
    );

    if (sectionObjectKey && allContent[sectionObjectKey]) {
      const section = allContent[sectionObjectKey];
      const sectionId = section.title.toLowerCase().replace(/[^a-z0-9]+/g, '-');
      const translatedTitle = t('content_titles.' + titleKey);

      fullHtml += `<section id="${sectionId}"><h2>${section.emoji} ${translatedTitle}</h2>${section.html}</section>`;
      tocHtml += `<li><a href="#${sectionId}">${section.emoji} ${translatedTitle}</a></li>`;
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