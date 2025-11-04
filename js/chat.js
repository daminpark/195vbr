// js/chat.js

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

    // --- BUG FIX: Populate chat box in chronological order ---
    chatHistory.forEach(msg => {
        let messageHtml = '';
        if (msg.role === 'user') {
            messageHtml = `<div class="message-bubble user-message"><p>${msg.content}</p></div><div class="timestamp">${getTimeStamp(msg.timestamp)}</div>`;
        } else if (msg.role === 'model') {
            messageHtml = `<div class="message-bubble bot-message">${marked.parse(msg.content)}</div><div class="timestamp">${getTimeStamp(msg.timestamp)}</div>`;
        }
        chatBox.insertAdjacentHTML('beforeend', messageHtml);
    });
    chatBox.scrollTop = chatBox.scrollHeight;

    // 3. If it's a new chat, add the suggestion buttons
    if (chatHistory.length === 1 && chatHistory[0].role === 'model') {
        const suggestionsHtml = `
            <div class="suggestions-container" id="suggestions-container">
                <button class="suggestion-chip">Can I check in early?</button>
                <button class="suggestion-chip">What room am I in?</button>
                <button class="suggestion-chip">How do I get in?</button>
            </div>
        `;
        chatBox.insertAdjacentHTML('beforeend', suggestionsHtml);
        chatBox.scrollTop = chatBox.scrollHeight;

        const suggestionsContainer = document.getElementById('suggestions-container');
        if (suggestionsContainer) {
            suggestionsContainer.addEventListener('click', (e) => {
                if (e.target.classList.contains('suggestion-chip')) {
                    const userInputField = document.getElementById('user-input');
                    userInputField.value = e.target.textContent;
                    sendMessageStandalone(); // Call send function directly
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

/**
 * Sends a message from the standalone chat page.
 */
async function sendMessageStandalone() {
    const userInputField = document.getElementById('user-input');
    const inputContainer = document.getElementById('chat-input-container');
    const userInput = userInputField.value.trim();

    if (!userInput || inputContainer.classList.contains('loading')) return;

    // Always hide suggestions when a message is sent
    const suggestionsContainer = document.getElementById('suggestions-container');
    if (suggestionsContainer) {
        suggestionsContainer.style.display = 'none';
    }

    const chatBox = document.getElementById('chat-box');
    const now = new Date();
    const getTimeStamp = () => now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    
    // --- BUG FIX: Add message to the end and scroll ---
    const userMessageHtml = `<div class="message-bubble user-message"><p>${userInput}</p></div><div class="timestamp">${getTimeStamp()}</div>`;
    chatBox.insertAdjacentHTML('beforeend', userMessageHtml);
    chatBox.scrollTop = chatBox.scrollHeight;
    
    chatHistory.push({ role: 'user', content: userInput, timestamp: now.toISOString() });
    sessionStorage.setItem('chatHistory', JSON.stringify(chatHistory));
    userInputField.value = '';
    
    inputContainer.classList.add('loading');

    // --- BUG FIX: Add indicator to the end and scroll ---
    const typingIndicatorHtml = `<div class="message-bubble bot-message typing-indicator"><span></span><span></span><span></span></div>`;
    chatBox.insertAdjacentHTML('beforeend', typingIndicatorHtml);
    chatBox.scrollTop = chatBox.scrollHeight;

    try {
        const response = await fetch(`${BACKEND_API_BASE_URL}/api/chatbot`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ history: chatHistory, context: chatbotContext })
        });
        if (!response.ok) throw new Error('Network response was not ok.');

        const indicator = chatBox.querySelector('.typing-indicator');
        if (indicator) indicator.remove();
        
        // --- BUG FIX: Append a new container for the bot message ---
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
            botMessageContainer.innerHTML = marked.parse(fullResponse);
            // Scroll as new content streams in
            chatBox.scrollTop = chatBox.scrollHeight;
        }

        const botTimestamp = new Date();
        chatHistory.push({ role: 'model', content: fullResponse, timestamp: botTimestamp.toISOString() });
        sessionStorage.setItem('chatHistory', JSON.stringify(chatHistory));
        
        // --- BUG FIX: Add timestamp to the end and scroll ---
        const timestampHtml = `<div class="timestamp">${botTimestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>`;
        chatBox.insertAdjacentHTML('beforeend', timestampHtml);
        chatBox.scrollTop = chatBox.scrollHeight;

    } catch (error) {
        console.error('Fetch error:', error);
        const indicator = chatBox.querySelector('.typing-indicator');
        if (indicator) indicator.remove();

        const errorHtml = `<div class="message-bubble bot-message"><p>Sorry, I'm having trouble connecting.</p></div>`;
        chatBox.insertAdjacentHTML('beforeend', errorHtml);
        chatBox.scrollTop = chatBox.scrollHeight;
    } finally {
        inputContainer.classList.remove('loading');
        userInputField.focus();
    }
}