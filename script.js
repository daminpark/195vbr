// This global variable will hold the final, assembled context for the chatbot.
let chatbotContext = '';

// This function runs once the entire page is loaded and ready.
document.addEventListener('DOMContentLoaded', async () => {
  try {
    // 1. Fetch the configuration "brain" file
    const response = await fetch('config.json');
    if (!response.ok) throw new Error('config.json not found');
    const configData = await response.json();

    // 2. Determine the current booking from the URL (e.g., '?31')
    const params = new URLSearchParams(window.location.search);
    const bookingKey = params.keys().next().value || '31'; // Default to '31' if no key is specified
    const booking = configData.bookings[bookingKey];
    
    if (!booking) {
      throw new Error(`Booking key "${bookingKey}" not found in config.json`);
    }

    // 3. Assemble the final configuration by merging base, groups, and specific booking info
    const finalVisibleElements = new Set(configData.base.visibleHtmlElements);
    const finalChatbotContext = [...configData.base.chatbotContext];

    // Add data from the booking's specified groups
    booking.groups.forEach(groupKey => {
      const group = configData.groups[groupKey];
      if (group) {
        group.visibleHtmlElements.forEach(id => finalVisibleElements.add(id));
        if (group.chatbotContext) finalChatbotContext.push(...group.chatbotContext);
      }
    });

    // Add data specific to this individual booking
    if (booking.visibleHtmlElements) {
        booking.visibleHtmlElements.forEach(id => finalVisibleElements.add(id));
    }
    if (booking.chatbotContext) {
        finalChatbotContext.push(...booking.chatbotContext);
    }

    // 4. Show the correct HTML elements on the page
    finalVisibleElements.forEach(id => {
      const element = document.getElementById(id);
      if (element) {
        element.style.display = 'block';
      }
    });

    // 5. Store the final assembled context for the chatbot to use later
    const systemPrompt = "You are a helpful assistant for the 195VBR guesthouse. Answer the user's question based ONLY on the detailed information provided below. Be concise, friendly, and use Markdown for formatting, especially for links like [Link Text](URL).";
    chatbotContext = `${systemPrompt}\n\nCONTEXT:\n- ${finalChatbotContext.join('\n- ')}`;

  } catch (error) {
    console.error("Error setting up guidebook:", error);
    // Optionally, display an error message on the page for the user
  }

  // Setup the interactive parts of the page now that the content is ready
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
    if (header.offsetParent === null) { sec.style.display = 'none'; return; }
    header.classList.add('accordion-header');
    const wrap = document.createElement('div');
    wrap.className = 'accordion-content';
    while (header.nextSibling) { wrap.appendChild(header.nextSibling); }
    sec.appendChild(wrap);
    sec.classList.add('collapsed');
    header.addEventListener('click', () => {
      const isOpen = !sec.classList.contains('collapsed');
      if (isOpen) {
        sec.classList.add('collapsed');
      } else {
        sections.forEach(s => s.classList.add('collapsed'));
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
    if (e.key === 'Enter') { sendMessage(); }
  });
}

// --- CHATBOT SEND MESSAGE FUNCTION ---

async function sendMessage() {
    const userInputField = document.querySelector('#chat-widget #user-input');
    const userInput = userInputField.value.trim();
    if (!userInput) return;

    const chatBox = document.getElementById('chat-box');
    const getTimeStamp = () => new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    // Display the user's message
    const userMessageHtml = `
      <div class="message-bubble user-message"><p>${userInput}</p></div>
      <div class="timestamp">${getTimeStamp()}</div>`;
    chatBox.insertAdjacentHTML('beforeend', userMessageHtml);
    userInputField.value = '';
    chatBox.scrollTop = chatBox.scrollHeight;

    // Call the server with the prompt and the pre-assembled context
    const serverlessFunctionUrl = 'https://guidebook-chatbot-backend.vercel.app/api/chatbot';

    try {
        const response = await fetch(serverlessFunctionUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              prompt: userInput,
              context: chatbotContext // Use the globally stored, perfectly assembled context!
            })
        });

        let botResponseText;
        if (response.status === 429) {
            botResponseText = "<p>You're sending messages too quickly. Please wait a moment.</p>";
        } else if (!response.ok) {
            throw new Error('Network response was not ok.');
        } else {
            const data = await response.json();
            botResponseText = marked.parse(data.response); // Convert Markdown to HTML
        }

        const botMessageHtml = `
          <div class="message-bubble bot-message">${botResponseText}</div>
          <div class="timestamp">${getTimeStamp()}</div>`;
        chatBox.insertAdjacentHTML('beforeend', botMessageHtml);

    } catch (error) {
        console.error('Fetch error:', error);
        const errorHtml = `
          <div class="message-bubble bot-message"><p>Sorry, I'm having trouble connecting. Please try again later.</p></div>
          <div class="timestamp">${getTimeStamp()}</div>`;
        chatBox.insertAdjacentHTML('beforeend', errorHtml);
    }
    
    chatBox.scrollTop = chatBox.scrollHeight;
}
