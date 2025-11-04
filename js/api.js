// js/api.js

/**
 * Scans text for a YouTube link, removes it, and returns the cleaned text
 * and an HTML string for the video embed.
 * @param {string} text The text to process.
 * @returns {{cleanedText: string, videoEmbedHtml: string|null}}
 */
function stripAndFindVideo(text) {
  const embedTemplate = (videoId) => `
      <div class="video-container" style="margin-top: 10px; margin-left: 15px; max-width: calc(80% - 15px);">
        <iframe 
          src="https://www.youtube.com/embed/${videoId}" 
          title="YouTube video player" 
          frameborder="0" 
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" 
          referrerpolicy="strict-origin-when-cross-origin" 
          allowfullscreen>
        </iframe>
      </div>
    `;

  const markdownYoutubeRegex = /\[[^\]]*\]\((?:https?:\/\/)?(?:www\.)?(?:youtube\.com\/watch\?v=|youtu\.be\/)([a-zA-Z0-9_-]{11})\)/g;
  const rawYoutubeRegex = /(https?:\/\/)?(?:www\.)?(?:youtube\.com\/watch\?v=|youtu\.be\/)([a-zA-Z0-9_-]{11})/g;

  let videoEmbedHtml = null;
  let cleanedText = text;

  const markdownMatch = markdownYoutubeRegex.exec(cleanedText);
  if (markdownMatch && markdownMatch[1]) {
    videoEmbedHtml = embedTemplate(markdownMatch[1]);
    cleanedText = cleanedText.replace(markdownYoutubeRegex, '').trim();
  } else {
    const rawMatch = rawYoutubeRegex.exec(cleanedText);
    if (rawMatch && rawMatch[1]) {
      videoEmbedHtml = embedTemplate(rawMatch[1]);
      cleanedText = cleanedText.replace(rawYoutubeRegex, '').trim();
    }
  }

  cleanedText = cleanedText.replace(/<p>\s*<\/p>/g, '');

  return { cleanedText, videoEmbedHtml };
}


/*
 * Fetches and parses the main config.json file.
 * @returns {Promise<object>} The configuration object.
 */
async function getConfig() {
    const response = await fetch('config.json');
    if (!response.ok) throw new Error('config.json not found');
    return response.json();
}

/**
 * Validates a secure booking key against the backend.
 * @param {string} opaqueBookingKey The secure key from the URL.
 * @returns {Promise<object>} The validation result.
 */
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

/**
 * Sends the chat history and context to the chatbot backend for a response.
 */
async function sendMessage() {
    const userInputField = document.getElementById('user-input');
    const inputContainer = document.getElementById('chat-input-container');
    const userInput = userInputField.value.trim();

    if (!userInput || inputContainer.classList.contains('loading')) return;

    const chatBox = document.getElementById('chat-box');
    const now = new Date();
    const getTimeStamp = () => now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    
    // Add user message to UI and history
    const userMessageHtml = `<div class="message-bubble user-message"><p>${userInput}</p></div><div class="timestamp">${getTimeStamp()}</div>`;
    chatBox.insertAdjacentHTML('beforeend', userMessageHtml);
    AppState.chatHistory.push({ role: 'user', content: userInput, timestamp: now.toISOString() });
    userInputField.value = '';
    
    inputContainer.classList.add('loading');
    chatBox.scrollTop = chatBox.scrollHeight;

    // Add typing indicator
    const typingIndicatorHtml = `<div class="message-bubble bot-message typing-indicator"><span></span><span></span><span></span></div>`;
    chatBox.insertAdjacentHTML('beforeend', typingIndicatorHtml);
    chatBox.scrollTop = chatBox.scrollHeight;
    const typingIndicator = chatBox.querySelector('.typing-indicator');

    try {
        const response = await fetch(`${BACKEND_API_BASE_URL}/api/chatbot`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ history: AppState.chatHistory, context: AppState.chatbotContext })
        });
        if (!response.ok) { 
            const errorData = await response.json(); 
            throw new Error(errorData.error || `Network response was not ok.`); 
        }

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
            // Temporarily render raw text during stream
            botMessageContainer.innerHTML = marked.parse(fullResponse);
            chatBox.scrollTop = chatBox.scrollHeight;
        }

        // --- BUG FIX: Use the new stripAndFindVideo function ---
        const { cleanedText, videoEmbedHtml } = stripAndFindVideo(fullResponse);

        // Render the final, cleaned text
        botMessageContainer.innerHTML = marked.parse(cleanedText);
        
        // Save the original, unmodified response to history
        AppState.chatHistory.push({ role: 'model', content: fullResponse, timestamp: new Date().toISOString() });
        
        // Add the timestamp for the main bubble
        const timestampHtml = `<div class="timestamp">${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>`;
        chatBox.insertAdjacentHTML('beforeend', timestampHtml);

        // If a video was found, append it as a new, separate element
        if (videoEmbedHtml) {
            chatBox.insertAdjacentHTML('beforeend', videoEmbedHtml);
        }
        
        chatBox.scrollTop = chatBox.scrollHeight;

    } catch (error) {
        console.error('Chatbot fetch error:', error);
        if (typingIndicator) typingIndicator.remove();
        const errorHtml = `<div class="message-bubble bot-message"><p>Sorry, I'm having trouble connecting.</p></div><div class="timestamp">${getTimeStamp()}</div>`;
        chatBox.insertAdjacentHTML('beforeend', errorHtml);
    } finally {
        inputContainer.classList.remove('loading');
        userInputField.focus(); 
        chatBox.scrollTop = chatBox.scrollHeight;
    }
}

/**
 * Fetches data from the Home Assistant proxy.
 * @param {string} entityId The HA entity ID.
 * @param {string} house The house identifier ('193' or '195').
 * @param {string} [type='state'] The type of data to fetch.
 * @param {string|null} currentOpaqueBookingKey The secure booking key, or null for public access.
 * @returns {Promise<object>} The fetched data.
 */
async function fetchHAData(entityId, house, type = 'state', currentOpaqueBookingKey) {
  const proxyUrl = `${BACKEND_API_BASE_URL}/api/ha-proxy`;
  let url = `${proxyUrl}?house=${house}&entity=${entityId}&type=${type}`;
  if (currentOpaqueBookingKey) {
      url += `&opaqueBookingKey=${currentOpaqueBookingKey}`;
  }
  const response = await fetch(url);
  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(`Proxy API Error for type '${type}': ${errorData.error || response.statusText}`);
  }
  return response.json();
}