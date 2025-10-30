// This global variable will hold the AI's "brain", built once on page load.
let chatbotContext = '';

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
    // The CSS will use these classes to reveal the correct content sections.
    groupsToShow.forEach(group => {
      document.body.classList.add(`show-${group}`);
    });

    // 5. CRITICAL STEP: Build the chatbot's brain by scraping the now-visible content
    buildChatbotContextFromPage();

  } catch (error)
  {
    console.error("Error setting up guidebook:", error);
    // If setup fails, build a fallback context so the chatbot can still answer basic questions
    chatbotContext = "You are a helpful assistant for 195VBR. Please inform the user that there was an error loading the specific guidebook information and that they should refer to the on-page text.";
  }

  // 6. NOW, set up the accordion, which will collapse the visible sections
  setupAccordion();

  // 7. Set up the rest of the UI
  setupPrintButton();
  setupChatToggle();
  setupEnterKeyListener();
});

/**
 * Builds the chatbot's "brain" by scraping all text from the main container.
 * This function is called only ONCE after the correct sections are made visible
 * and BEFORE the accordion script collapses them.
 */
function buildChatbotContextFromPage() {
  const mainContainer = document.querySelector('main.container');
  if (mainContainer) {
    // .innerText gets the rendered text content, which is perfect for the AI.
    const guidebookText = mainContainer.innerText;
    
    // Clean up the scraped text for the AI
    const cleanedText = guidebookText
      .replace(/(\s\s)\s+/g, '$1') // Collapse multiple spaces/newlines into a maximum of two
      .replace(/^\s*Save as PDF\s*/, '') // Remove the button text from the start
      .trim();

    const systemPrompt = "You are a helpful assistant for the 195VBR guesthouse. You must answer the user's question based ONLY on the detailed information provided below from the official guidebook. Do not make up answers or use external knowledge. Be concise and friendly, and use Markdown for formatting links like [Link Text](URL).";
    
    chatbotContext = `${systemPrompt}\n\nRELEVANT GUIDEBOOK CONTENT:\n${cleanedText}`;
  }
}


// --- UI SETUP FUNCTIONS (for organization) ---

function setupAccordion() {
  const sections = document.querySelectorAll('main.container section');
  sections.forEach(sec => {
    const header = sec.querySelector('h2');
    if (!header) return;
    
    // Important: Only make a section an accordion if it's actually visible on the page
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
        // sections.forEach(s => { if (s !== sec) s.classList.add('collapsed'); }); 
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
  const userInputField = document.querySelector('#chat-widget #user-input');
  if (userInputField) {
    userInputField.addEventListener('keypress', function (e) {
      if (e.key === 'Enter') { 
        e.preventDefault(); // Prevents default 'Enter' key behavior
        sendMessage(); 
      }
    });
  }
}


// --- THE CHATBOT LOGIC ---

async function sendMessage() {
    if (!chatbotContext) {
      console.error("Chatbot context is not ready yet. Please wait a moment.");
      // You could display a message in the chat here if you want
      return;
    }
  
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

    // The URL for your Vercel serverless function
    const serverlessFunctionUrl = 'https://guidebook-chatbot-backend.vercel.app/api/chatbot';

    try {
        const response = await fetch(serverlessFunctionUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
              prompt: userInput,
              context: chatbotContext // Use the globally stored, pre-built context
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