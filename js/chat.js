// js/chat.js

// This file is the self-contained controller for the standalone chat.html page.

let chatbotContext = '';
let chatHistory = [];

/**
 * Main function that runs when the chat page loads.
 */
document.addEventListener('DOMContentLoaded', async () => {
    // 1. Load translations first and set the page language
    await loadTranslations();
    document.documentElement.lang = I18nState.currentLanguage;

    // 2. Translate all static UI elements
    translateChatUI();

    // 3. Set up page navigation and load chat data
    const searchParams = new URLSearchParams(window.location.search);
    const backBtn = document.getElementById('chat-back-btn');
    
    // **FIX:** Reliably construct the back button URL to preserve the booking key
    backBtn.href = `index.html${window.location.search}`;

    chatbotContext = sessionStorage.getItem('chatbotContext');
    const storedHistory = sessionStorage.getItem('chatHistory');

    // 4. Handle cases where chat data is missing
    if (!chatbotContext || !storedHistory) {
        document.getElementById('chat-box').innerHTML = `<p style="padding: 1rem; text-align: center;">${t('chat.session_load_error')}</p>`;
        document.getElementById('chat-input-container').style.display = 'none';
        return;
    }

    // 5. Populate the chat history
    chatHistory = JSON.parse(storedHistory);
    populateChatHistory();
    
    // 6. Set up user input event listeners
    setupEventListeners();
});

/**
 * Translates all the static text elements on the chat page.
 */
function translateChatUI() {
    document.title = t('chat.header');
    document.querySelector('#chat-header span').textContent = t('chat.header');
    document.getElementById('chat-back-btn').setAttribute('aria-label', t('chat.back_button_aria'));
    document.getElementById('user-input').placeholder = t('chat.input_placeholder');
    document.getElementById('send-btn').setAttribute('aria-label', t('chat.send_button_aria'));
}

/**
 * Renders the chat history from sessionStorage into the chat box.
 */
function populateChatHistory() {
    const chatBox = document.getElementById('chat-box');
    chatBox.innerHTML = ''; // Clear the chatbox before populating
    const getTimeStamp = (date) => new Date(date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    chatHistory.forEach(msg => {
        let messageHtml = '';
        if (msg.role === 'user') {
            messageHtml = `<div class="message-bubble user-message"><p>${msg.content}</p></div><div class="timestamp">${getTimeStamp(msg.timestamp)}</div>`;
        } else if (msg.role === 'model') {
            // Video stripping logic can be added here if needed, similar to sendMessage
            messageHtml = `<div class="message-bubble bot-message">${marked.parse(msg.content)}</div><div class="timestamp">${getTimeStamp(msg.timestamp)}</div>`;
        }
        chatBox.insertAdjacentHTML('afterbegin', messageHtml);
    });

    // **FIX:** Show initial suggestions if it's a new chat
    if (chatHistory.length === 1 && chatHistory[0].role === 'model') {
        const suggestionsHtml = `
            <div class="suggestions-container" id="suggestions-container">
                <button class="suggestion-chip">${t('chat.suggestion_checkin')}</button>
                <button class="suggestion-chip">${t('chat.suggestion_room')}</button>
                <button class="suggestion-chip">${t('chat.suggestion_entry')}</button>
            </div>
        `;
        chatBox.insertAdjacentHTML('afterbegin', suggestionsHtml);
    }
}

/**
 * Sets up event listeners for the send button, suggestion chips, and Enter key.
 */
function setupEventListeners() {
    const sendBtn = document.getElementById('send-btn');
    const userInputField = document.getElementById('user-input');
    const suggestionsContainer = document.getElementById('suggestions-container');

    sendBtn.addEventListener('mousedown', (e) => { 
        e.preventDefault(); // Prevents focus loss on mobile
        sendMessage(); 
    });

    userInputField.addEventListener('keypress', (e) => { 
        if (e.key === 'Enter' && !e.shiftKey) { 
            e.preventDefault(); 
            sendMessage(); 
        } 
    });
    
    if (suggestionsContainer) {
        suggestionsContainer.addEventListener('click', (e) => {
            if (e.target.classList.contains('suggestion-chip')) {
                userInputField.value = e.target.textContent;
                sendMessage();
            }
        });
    }

    userInputField.focus();
}


/**
 * Handles sending a message to the backend and streaming the response.
 */
async function sendMessage() {
    const userInputField = document.getElementById('user-input');
    const inputContainer = document.getElementById('chat-input-container');
    const userInput = userInputField.value.trim();

    if (!userInput || inputContainer.classList.contains('loading')) return;

    // Hide suggestions once the user starts talking
    const suggestionsContainer = document.getElementById('suggestions-container');
    if (suggestionsContainer) {
        suggestionsContainer.style.display = 'none';
    }

    const chatBox = document.getElementById('chat-box');
    const now = new Date();
    const getTimeStamp = () => now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    
    // Add user message to UI and history
    const userMessageHtml = `<div class="message-bubble user-message"><p>${userInput}</p></div><div class="timestamp">${getTimeStamp()}</div>`;
    chatBox.insertAdjacentHTML('afterbegin', userMessageHtml);
    
    chatHistory.push({ role: 'user', content: userInput, timestamp: now.toISOString() });
    sessionStorage.setItem('chatHistory', JSON.stringify(chatHistory));
    userInputField.value = '';
    
    inputContainer.classList.add('loading');

    // Add typing indicator
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
        
        const tempBubbleContainer = document.createElement('div');
        tempBubbleContainer.className = 'message-bubble bot-message';
        chatBox.insertAdjacentElement('afterbegin', tempBubbleContainer);

        while (true) {
            const { value, done } = await reader.read();
            if (done) break;
            fullResponse += decoder.decode(value, { stream: true });
            tempBubbleContainer.innerHTML = marked.parse(fullResponse);
        }
        
        const botTimestamp = new Date();
        chatHistory.push({ role: 'model', content: fullResponse, timestamp: botTimestamp.toISOString() });
        sessionStorage.setItem('chatHistory', JSON.stringify(chatHistory));
        
        const timestampHtml = `<div class="timestamp">${botTimestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>`;
        tempBubbleContainer.insertAdjacentHTML('afterend', timestampHtml);
        
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