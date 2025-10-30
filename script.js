// --- This code runs once the entire page is loaded and ready ---
document.addEventListener('DOMContentLoaded', async () => {
  try {
    // 1. Fetch the configuration file (the "recipe book")
    const response = await fetch('config.json');
    if (!response.ok) throw new Error('config.json not found');
    const configData = await response.json();

    // 2. Determine the current booking from the URL (e.g., '31' from '/?31')
    const params = new URLSearchParams(window.location.search);
    const bookingKey = params.keys().next().value || '31'; // Default to '31' if no key is provided
    
    // 3. Find the "recipe" (the list of groups) for this booking
    const groupsToShow = configData.bookings[bookingKey];
    if (!groupsToShow) {
      throw new Error(`Booking key "${bookingKey}" not found in config.json`);
    }

    // 4. Add a 'show-[group]' class to the body for each group in the recipe.
    // The CSS will use these classes to reveal the correct content.
    groupsToShow.forEach(group => {
      document.body.classList.add(`show-${group}`);
    });

  } catch (error) {
    console.error("Error setting up guidebook:", error);
    // If setup fails, you might want to show a default view or an error message.
  }

  // 5. Setup all the interactive UI elements for the page
  setupAccordion();
  setupPrintButton();
  setupChatToggle();
  setupEnterKeyListener();
});


// --- UI SETUP FUNCTIONS (for organization) ---

function setupAccordion() {
  const sections = document.querySelectorAll('main.container section');
  sections.forEach(sec => {
    const header = sec.querySelector('h2');
    if (!header) return;
    
    // Check if the section is actually visible before making it an accordion
    if (window.getComputedStyle(sec).display === 'none') return;
    
    header.classList.add('accordion-header');
    const wrap = document.createElement('div');
    wrap.className = 'accordion-content';
    while (header.nextSibling) {
      wrap.appendChild(header.nextSibling);
    }
    sec.appendChild(wrap);
    sec.classList.add('collapsed');

    header.addEventListener('click', () => {
      const isOpen = !sec.classList.contains('collapsed');
      if (isOpen) {
        sec.classList.add('collapsed');
      } else {
        // Optional: close other accordions when one is opened
        // sections.forEach(s => s.classList.add('collapsed')); 
        sec.classList.remove('collapsed');
      }
    });
  });
}

function setupPrintButton() {
  const printBtn = document.getElementById('printBtn');
  if (printBtn) {
    printBtn.addEventListener('click', () => {
      const openSections = Array.from(document.querySelectorAll('section')).filter(sec => !sec.classList.contains('collapsed'));
      document.querySelectorAll('section.collapsed').forEach(sec => sec.classList.remove('collapsed'));
      document.body.classList.add('print-mode');
      window.print();
      window.onafterprint = () => {
        document.body.classList.remove('print-mode');
        document.querySelectorAll('section').forEach(sec => sec.classList.add('collapsed'));
        openSections.forEach(sec => sec.classList.remove('collapsed'));
      };
    });
  }
}

function setupChatToggle() {
  const chatLauncher = document.getElementById('chat-launcher');
  const chatWidget = document.getElementById('chat-widget');
  const chatIcon = document.getElementById('chat-icon');
  const closeIcon = document.getElementById('close-icon');
  if (chatLauncher && chatWidget && chatIcon && closeIcon) {
    chatLauncher.addEventListener('click', () => {
      chatWidget.classList.toggle('hidden');
      chatIcon.classList.toggle('hidden');
      closeIcon.classList.toggle('hidden');
    });
  }
}

function setupEnterKeyListener() {
  document.querySelector('#chat-widget #user-input').addEventListener('keypress', function (e) {
    if (e.key === 'Enter') { 
      e.preventDefault(); // Prevents form submission behavior
      sendMessage(); 
    }
  });
}


// --- THE CHATBOT LOGIC ---

/**
 * Scrapes all human-readable, VISIBLE text from the main guidebook container.
 * This becomes the dynamic context for the AI.
 * @returns {string} The visible text content of the guidebook.
 */
function scrapeVisibleGuidebookContent() {
  const mainContainer = document.querySelector('main.container');
  if (mainContainer) {
    // .innerText cleverly grabs only the content that is actually rendered and visible on the page.
    return mainContainer.innerText;
  }
  return '';
}

/**
 * Handles sending the message, scraping context, and displaying the response.
 */
async function sendMessage() {
    const userInputField = document.querySelector('#chat-widget #user-input');
    const userInput = userInputField.value.trim();
    if (!userInput) return;

    const chatBox = document.getElementById('chat-box');
    const getTimeStamp = () => new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    // Display the user's message
    const userMessageHtml = `<div class="message-bubble user-message"><p>${userInput}</p></div><div class="timestamp">${getTimeStamp()}</div>`;
    chatBox.insertAdjacentHTML('beforeend', userMessageHtml);
    userInputField.value = '';
    chatBox.scrollTop = chatBox.scrollHeight;

    // Scrape the live page content to build the context for the AI
    const guidebookText = scrapeVisibleGuidebookContent();
    const systemPrompt = "You are a helpful assistant for the 195VBR guesthouse. Answer the user's question based ONLY on the information provided below from the official guidebook. Do not make up answers or use external knowledge. Be concise and friendly, and use Markdown for formatting links like [Link Text](URL).";
    const fullContext = `${systemPrompt}\n\nGUIDEBOOK CONTENT:\n${guidebookText}`;

    // The URL for your Vercel serverless function
    const serverlessFunctionUrl = 'https://guidebook-chatbot-backend.vercel.app/api/chatbot';

    try {
        const response = await fetch(serverlessFunctionUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
              prompt: userInput,
              context: fullContext
            })
        });

        let botResponseText;
        if (response.status === 429) {
            botResponseText = "<p>You're sending messages too quickly. Please wait a moment.</p>";
        } else if (!response.ok) {
            throw new Error(`Network response was not ok. Status: ${response.status}`);
        } else {
            const data = await response.json();
            botResponseText = marked.parse(data.response); // Convert Markdown text from AI into HTML
        }

        const botMessageHtml = `<div class="message-bubble bot-message">${botResponseText}</div><div class="timestamp">${getTimeStamp()}</div>`;
        chatBox.insertAdjacentHTML('beforeend', botMessageHtml);

    } catch (error) {
        console.error('Fetch error:', error);
        const errorHtml = `<div class="message-bubble bot-message"><p>Sorry, I'm having trouble connecting. Please try again later.</p></div><div class="timestamp">${getTimeStamp()}</div>`;
        chatBox.insertAdjacentHTML('beforeend', errorHtml);
    }
    
    chatBox.scrollTop = chatBox.scrollHeight;
}