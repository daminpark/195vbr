// This global variable will hold the AI's "brain", built once on page load.
let chatbotContext = '';

// --- This code runs once the entire page is loaded and ready ---
document.addEventListener('DOMContentLoaded', async () => {
  try {
    const response = await fetch('config.json');
    if (!response.ok) throw new Error('config.json not found');
    const configData = await response.json();

    const params = new URLSearchParams(window.location.search);
    const bookingKey = params.keys().next().value || '31';
    
    const groupsToShow = configData.bookings[bookingKey];
    if (!groupsToShow) {
      throw new Error(`Booking key "${bookingKey}" not found in config.json`);
    }

    groupsToShow.forEach(group => {
      document.body.classList.add(`show-${group}`);
    });

    buildChatbotContextFromPage();

  } catch (error) {
    console.error("Error setting up guidebook:", error);
    chatbotContext = "You are a helpful assistant for 195VBR. Please inform the user that there was an error loading the specific guidebook information and that they should refer to the on-page text.";
  }

  setupAccordion();
  setupPrintButton();
  setupChatToggle();
  setupEnterKeyListener();
  addInitialBotMessage();
});

function buildChatbotContextFromPage() {
  const mainContainer = document.querySelector('main.container');
  if (mainContainer) {
    const guidebookText = mainContainer.innerText;
    const cleanedText = guidebookText
      .replace(/(\s\s)\s+/g, '$1')
      .replace(/^\s*Save as PDF\s*/, '')
      .trim();

    const systemPrompt = "You are 'Vicky', a friendly and helpful AI assistant for the 195VBR guesthouse in London. Your primary role is to assist guests. For questions specifically about the guesthouse (e.g., check-in, WiFi, heating), you MUST base your answer ONLY on the detailed guidebook information provided below. For all other questions (e.g., London travel, restaurant recommendations, tourism), you should use your general knowledge to be a helpful local guide. Be concise, friendly, and use Markdown for formatting links like [Link Text](URL).";
    
    chatbotContext = `${systemPrompt}\n\nRELEVANT GUIDEBOOK CONTENT:\n${cleanedText}`;
  }
}

// --- UI SETUP FUNCTIONS ---

function setupAccordion() {
  const sections = document.querySelectorAll('main.container section');
  sections.forEach(sec => {
    const header = sec.querySelector('h2');
    if (!header || window.getComputedStyle(sec).display === 'none') return;
    
    header.classList.add('accordion-header');
    const wrap = document.createElement('div');
    wrap.className = 'accordion-content';
    while (header.nextSibling) wrap.appendChild(header.nextSibling);
    sec.appendChild(wrap);
    sec.classList.add('collapsed');

    header.addEventListener('click', () => {
      sec.classList.toggle('collapsed');
    });
  });
}

function setupPrintButton() {
  const printBtn = document.getElementById('printBtn');
  if (printBtn) {
    printBtn.addEventListener('click', () => {
      window.print();
    });
  }
}

function setupChatToggle() {
  const chatLauncher = document.getElementById('chat-launcher');
  const chatWidget = document.getElementById('chat-widget');
  const chatIcon = document.getElementById('chat-icon');
  const closeIcon = document.getElementById('close-icon');
  if (chatLauncher && chatWidget) {
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
    userInputField.addEventListener('keypress', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) { 
        e.preventDefault();
        sendMessage(); 
      }
    });
  }
}

function addInitialBotMessage() {
    const chatBox = document.getElementById('chat-box');
    const welcomeMessage = `<div class="message-bubble bot-message"><p>Welcome to 195VBR! I'm Vicky, your AI assistant. Ask me anything about the guesthouse or your London trip.</p></div>`;
    chatBox.innerHTML = welcomeMessage;
}

// --- THE CHATBOT LOGIC ---

async function sendMessage() {
    const userInputField = document.getElementById('user-input');
    const sendBtn = document.getElementById('send-btn');
    const userInput = userInputField.value.trim();
    if (!userInput || sendBtn.disabled) return;

    const chatBox = document.getElementById('chat-box');
    const getTimeStamp = () => new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    // Disable input while processing
    userInputField.value = '';
    userInputField.disabled = true;
    sendBtn.disabled = true;

    // Display user's message
    const userMessageHtml = `<div class="message-bubble user-message"><p>${userInput}</p></div><div class="timestamp">${getTimeStamp()}</div>`;
    chatBox.insertAdjacentHTML('beforeend', userMessageHtml);
    chatBox.scrollTop = chatBox.scrollHeight;

    // Display typing indicator and create bot message container
    const typingIndicatorHtml = `<div class="message-bubble bot-message typing-indicator"><span></span><span></span><span></span></div>`;
    chatBox.insertAdjacentHTML('beforeend', typingIndicatorHtml);
    chatBox.scrollTop = chatBox.scrollHeight;
    
    const typingIndicator = chatBox.querySelector('.typing-indicator');
    
    const serverlessFunctionUrl = 'https://guidebook-chatbot-backend.vercel.app/api/chatbot';

    try {
        const response = await fetch(serverlessFunctionUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ prompt: userInput, context: chatbotContext })
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || `Network response was not ok. Status: ${response.status}`);
        }

        // Prepare for streaming
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
            botMessageContainer.innerHTML = marked.parse(fullResponse); // Render markdown in real-time
            chatBox.scrollTop = chatBox.scrollHeight;
        }
        
        // Add timestamp after message is complete
        const timestampHtml = `<div class="timestamp">${getTimeStamp()}</div>`;
        chatBox.insertAdjacentHTML('beforeend', timestampHtml);

    } catch (error) {
        console.error('Fetch error:', error);
        typingIndicator.remove();
        const errorHtml = `<div class="message-bubble bot-message"><p>Sorry, I'm having trouble connecting. Please try again later.</p></div><div class="timestamp">${getTimeStamp()}</div>`;
        chatBox.insertAdjacentHTML('beforeend', errorHtml);
    } finally {
        // Re-enable input
        userInputField.disabled = false;
        sendBtn.disabled = false;
        userInputField.focus();
        chatBox.scrollTop = chatBox.scrollHeight;
    }
}