// js/chat.js

/**
 * Scans text for a YouTube link, removes it, and returns the cleaned text
 * and an HTML string for the video embed.
 * @param {string} text The text to process.
 * @returns {{cleanedText: string, videoEmbedHtml: string|null}}
 */
function stripAndFindVideo(text) {
  const embedTemplate = (videoId) => `
      <div class="video-container" style="margin-bottom: 10px; max-width: 80%;">
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
    if (rawMatch && rawMatch[1]) { // Note: The capture group is 1 for raw regex
      videoEmbedHtml = embedTemplate(rawMatch[1]);
      cleanedText = cleanedText.replace(rawYoutubeRegex, '').trim();
    }
  }

  cleanedText = cleanedText.replace(/<p>\s*<\/p>/g, '');

  return { cleanedText, videoEmbedHtml };
}


let chatbotContext = '';
let chatHistory = [];

document.addEventListener('DOMContentLoaded', async () => {
    // **MODIFICATION: Load translations first**
    await loadTranslations();
    document.documentElement.lang = I18nState.currentLanguage;

    // **MODIFICATION: Translate static UI elements**
    document.title = t('chat.header');
    document.querySelector('#chat-header span').textContent = t('chat.header');
    document.getElementById('chat-back-btn').setAttribute('aria-label', t('chat.back_button_aria'));
    document.getElementById('user-input').placeholder = t('chat.input_placeholder');
    document.getElementById('send-btn').setAttribute('aria-label', t('chat.send_button_aria'));

    // 1. Setup
    const searchParams = new URLSearchParams(window.location.search);
    const bookingKey = searchParams.get('booking');
    const backBtn = document.getElementById('chat-back-btn');
    backBtn.href = bookingKey ? `index.html?booking=${bookingKey}` : `index.html${window.location.search}`;

    chatbotContext = sessionStorage.getItem('chatbotContext');
    const storedHistory = sessionStorage.getItem('chatHistory');

    if (!chatbotContext || !storedHistory) {
        document.getElementById('chat-box').innerHTML = `<p style="padding: 1rem; text-align: center;">${t('chat.session_load_error')}</p>`;
        document.getElementById('chat-input-container').style.display = 'none';
        return;
    }

    chatHistory = JSON.parse(storedHistory);
    const chatBox = document.getElementById('chat-box');
    chatBox.innerHTML = ''; // Clear the chatbox before populating
    const getTimeStamp = (date) => new Date(date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    chatHistory.forEach(msg => {
        let messageHtml = '';
        if (msg.role === 'user') {
            messageHtml = `<div class="message-bubble user-message"><p>${msg.content}</p></div><div class="timestamp">${getTimeStamp(msg.timestamp)}</div>`;
        } else if (msg.role === 'model') {
            const { cleanedText, videoEmbedHtml } = stripAndFindVideo(msg.content);
            messageHtml = `<div class="message-bubble bot-message">${marked.parse(cleanedText)}</div><div class="timestamp">${getTimeStamp(msg.timestamp)}</div>`;
            if (videoEmbedHtml) {
                // In reversed layout, video comes before the bubble in the DOM
                messageHtml = videoEmbedHtml + messageHtml;
            }
        }
        chatBox.insertAdjacentHTML('afterbegin', messageHtml);
    });

    if (chatHistory.length === 1 && chatHistory[0].role === 'model') {
        const suggestionsHtml = `
            <div class="suggestions-container" id="suggestions-container">
                <button class="suggestion-chip">${t('chat.suggestion_checkin')}</button>
                <button class="suggestion-chip">${t('chat.suggestion_room')}</button>
                <button class="suggestion-chip">${t('chat.suggestion_entry')}</button>
            </div>
        `;
        chatBox.insertAdjacentHTML('afterbegin', suggestionsHtml);

        const suggestionsContainer = document.getElementById('suggestions-container');
        if (suggestionsContainer) {
            suggestionsContainer.addEventListener('click', (e) => {
                if (e.target.classList.contains('suggestion-chip')) {
                    const userInputField = document.getElementById('user-input');
                    userInputField.value = e.target.textContent;
                    sendMessageStandalone();
                }
            });
        }
    }

    const sendBtn = document.getElementById('send-btn');
    const userInputField = document.getElementById('user-input');
    sendBtn.addEventListener('mousedown', (e) => { e.preventDefault(); sendMessageStandalone(); });
    userInputField.addEventListener('keypress', (e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessageStandalone(); } });
    userInputField.focus();
});

async function sendMessageStandalone() {
    const userInputField = document.getElementById('user-input');
    const inputContainer = document.getElementById('chat-input-container');
    const userInput = userInputField.value.trim();

    if (!userInput || inputContainer.classList.contains('loading')) return;

    const suggestionsContainer = document.getElementById('suggestions-container');
    if (suggestionsContainer) {
        suggestionsContainer.style.display = 'none';
    }

    const chatBox = document.getElementById('chat-box');
    const now = new Date();
    const getTimeStamp = () => now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    
    const userMessageHtml = `<div class="message-bubble user-message"><p>${userInput}</p></div><div class="timestamp">${getTimeStamp()}</div>`;
    chatBox.insertAdjacentHTML('afterbegin', userMessageHtml);
    
    chatHistory.push({ role: 'user', content: userInput, timestamp: now.toISOString() });
    sessionStorage.setItem('chatHistory', JSON.stringify(chatHistory));
    userInputField.value = '';
    
    inputContainer.classList.add('loading');

    const typingIndicatorHtml = `<div class="message-bubble bot-message typing-indicator"><span></span><span></span><span></span></div>`;
    chatBox.insertAdjacentHTML('afterbegin', typingIndicatorHtml);

    try {
        const response = await fetch(`${BACKEND_API_BASE_URL}/api/chatbot`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ history: chatHistory, context: chatbotContext })
        });
        if (!response.ok) throw new Error('Network response was not ok.');

        const indicator = chatBox.querySelector('.typing-indicator');
        if (indicator) indicator.remove();
        
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let fullResponse = '';
        
        // Create containers for streaming
        const tempBubbleContainer = document.createElement('div');
        tempBubbleContainer.className = 'message-bubble bot-message';
        chatBox.insertAdjacentElement('afterbegin', tempBubbleContainer);

        while (true) {
            const { value, done } = await reader.read();
            if (done) break;
            fullResponse += decoder.decode(value, { stream: true });
            tempBubbleContainer.innerHTML = marked.parse(fullResponse);
        }

        const { cleanedText, videoEmbedHtml } = stripAndFindVideo(fullResponse);
        
        // Re-render the bubble with cleaned text
        tempBubbleContainer.innerHTML = marked.parse(cleanedText);

        const botTimestamp = new Date();
        chatHistory.push({ role: 'model', content: fullResponse, timestamp: botTimestamp.toISOString() });
        sessionStorage.setItem('chatHistory', JSON.stringify(chatHistory));
        
        const timestampHtml = `<div class="timestamp">${botTimestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>`;
        tempBubbleContainer.insertAdjacentHTML('afterend', timestampHtml);
        
        if (videoEmbedHtml) {
            // Because the layout is reversed, the video goes in last to appear at the bottom
            chatBox.insertAdjacentHTML('afterbegin', videoEmbedHtml);
        }

    } catch (error) {
        console.error('Fetch error:', error);
        const indicator = chatBox.querySelector('.typing-indicator');
        if (indicator) indicator.remove();
        
        const errorHtml = `<div class="message-bubble bot-message"><p>${t('chat.connection_error')}</p></div>`;
        chatBox.insertAdjacentHTML('afterbegin', errorHtml);
    } finally {
        inputContainer.classList.remove('loading');
        userInputField.focus();
    }
}