// js/chat.js

/**
 * Replaces YouTube watch links in a string with embedded iframe HTML.
 * This function now correctly handles both raw URLs and Markdown links.
 * @param {string} text The text to process.
 * @returns {string} The text with YouTube links replaced by embeds.
 */
function processAndEmbedVideos(text) {
  const embedTemplate = (videoId) => `
      <div class="video-container">
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

  // Regex for full markdown links: [Text](youtube_url)
  const markdownYoutubeRegex = /\[[^\]]*\]\((?:https?:\/\/)?(?:www\.)?(?:youtube\.com\/watch\?v=|youtu\.be\/)([a-zA-Z0-9_-]{11})\)/g;
  
  // Regex for raw youtube links
  const rawYoutubeRegex = /(?:https?:\/\/)?(?:www\.)?(?:youtube\.com\/watch\?v=|youtu\.be\/)([a-zA-Z0-9_-]{11})/g;
  
  // First, replace all markdown links containing youtube URLs. This removes the whole [Text](link) structure.
  let processedText = text.replace(markdownYoutubeRegex, (match, videoId) => embedTemplate(videoId));
  
  // Then, replace any remaining raw youtube URLs.
  processedText = processedText.replace(rawYoutubeRegex, (match, videoId) => embedTemplate(videoId));

  return processedText;
}


let chatbotContext = '';
let chatHistory = [];

document.addEventListener('DOMContentLoaded', () => {
    // 1. Setup
    const searchParams = new URLSearchParams(window.location.search);
    const bookingKey = searchParams.get('booking');
    const backBtn = document.getElementById('chat-back-btn');
    backBtn.href = bookingKey ? `index.html?booking=${bookingKey}` : `index.html${window.location.search}`;

    chatbotContext = sessionStorage.getItem('chatbotContext');
    const storedHistory = sessionStorage.getItem('chatHistory');

    if (!chatbotContext || !storedHistory) {
        document.getElementById('chat-box').innerHTML = '<p style="padding: 1rem; text-align: center;">Could not load chat session.</p>';
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
            const processedContent = processAndEmbedVideos(msg.content);
            messageHtml = `<div class="message-bubble bot-message">${marked.parse(processedContent)}</div><div class="timestamp">${getTimeStamp(msg.timestamp)}</div>`;
        }
        chatBox.insertAdjacentHTML('afterbegin', messageHtml);
    });

    if (chatHistory.length === 1 && chatHistory[0].role === 'model') {
        const suggestionsHtml = `
            <div class="suggestions-container" id="suggestions-container">
                <button class="suggestion-chip">Can I check in early?</button>
                <button class="suggestion-chip">What room am I in?</button>
                <button class="suggestion-chip">How do I get in?</button>
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

    // 4. Set up event listeners
    const sendBtn = document.getElementById('send-btn');
    const userInputField = document.getElementById('user-input');

    sendBtn.addEventListener('mousedown', (e) => {
        e.preventDefault();
        sendMessageStandalone();
    });

    userInputField.addEventListener('keypress', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendMessageStandalone();
        }
    });

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
        
        const tempBotContainer = document.createElement('div');
        chatBox.insertAdjacentElement('afterbegin', tempBotContainer);

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let fullResponse = '';
        while (true) {
            const { value, done } = await reader.read();
            if (done) break;
            fullResponse += decoder.decode(value, { stream: true });
            tempBotContainer.innerHTML = `<div class="message-bubble bot-message">${marked.parse(fullResponse)}</div>`;
        }

        const processedResponse = processAndEmbedVideos(fullResponse);
        tempBotContainer.innerHTML = `<div class="message-bubble bot-message">${marked.parse(processedResponse)}</div>`;

        const botTimestamp = new Date();
        chatHistory.push({ role: 'model', content: fullResponse, timestamp: botTimestamp.toISOString() });
        sessionStorage.setItem('chatHistory', JSON.stringify(chatHistory));
        
        const timestampHtml = `<div class="timestamp">${botTimestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>`;
        tempBotContainer.insertAdjacentHTML('afterend', timestampHtml);
        
        while (tempBotContainer.firstChild) {
            chatBox.insertAdjacentElement('afterbegin', tempBotContainer.firstChild);
        }
        tempBotContainer.remove();

    } catch (error) {
        console.error('Fetch error:', error);
        const indicator = chatBox.querySelector('.typing-indicator');
        if (indicator) indicator.remove();
        
        const errorHtml = `<div class="message-bubble bot-message"><p>Sorry, I'm having trouble connecting.</p></div>`;
        chatBox.insertAdjacentHTML('afterbegin', errorHtml);
    } finally {
        inputContainer.classList.remove('loading');
        userInputField.focus();
    }
}