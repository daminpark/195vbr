// --- A SINGLE SOURCE OF TRUTH FOR THE BACKEND URL ---
const BACKEND_API_BASE_URL = 'https://guidebook-chatbot-backend-git-ical-auth-pierre-parks-projects.vercel.app';

let chatbotContext = '';
let chatHistory = [];

document.addEventListener('DOMContentLoaded', () => {
    // 1. Get the booking parameters from the URL
    const searchParams = new URLSearchParams(window.location.search);
    const bookingKey = searchParams.get('booking');

    // 2. Set the "Back to Guidebook" link
    const backBtn = document.getElementById('chat-back-btn');
    if (bookingKey) {
        // Construct the correct return URL
        backBtn.href = `index.html?booking=${bookingKey}`;
    } else {
        // Fallback if the URL is missing parameters
        backBtn.href = 'index.html'; 
    }

    // 3. Retrieve data from sessionStorage
    chatbotContext = sessionStorage.getItem('chatbotContext');
    const storedHistory = sessionStorage.getItem('chatHistory');

    if (!chatbotContext || !storedHistory) {
        document.getElementById('chat-box').innerHTML = 
            '<p style="padding: 1rem; text-align: center; position: absolute; bottom: 0;">Could not load chat session. Please return to the guidebook and try again.</p>';
        document.getElementById('chat-input-container').style.display = 'none';
        return;
    }

    chatHistory = JSON.parse(storedHistory);

    // 4. Populate the chat box with existing history (in REVERSE order)
    const chatBox = document.getElementById('chat-box');
    let messagesHtml = '';
    const getTimeStamp = (date) => new Date(date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    // Iterate backwards to add new messages to the top of the container
    for (let i = chatHistory.length - 1; i >= 0; i--) {
        const msg = chatHistory[i];
        if (msg.role === 'user') {
            messagesHtml += `<div class="message-bubble user-message"><p>${msg.content}</p></div><div class="timestamp">${getTimeStamp(msg.timestamp)}</div>`;
        } else if (msg.role === 'model') {
            messagesHtml += `<div class="message-bubble bot-message">${marked.parse(msg.content)}</div><div class="timestamp">${getTimeStamp(msg.timestamp)}</div>`;
        }
    }
    chatBox.innerHTML = messagesHtml;

    // 5. Set up event listeners
    const sendBtn = document.getElementById('send-btn');
    const userInputField = document.getElementById('user-input');

    sendBtn.addEventListener('mousedown', (e) => {
        e.preventDefault(); // Keep keyboard open
        sendMessage();
    });

    userInputField.addEventListener('keypress', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendMessage();
        }
    });

    userInputField.focus();
});


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
    // Use insertAdjacentHTML 'afterbegin' to add the new message to the top of the reversed flex container
    chatBox.insertAdjacentHTML('afterbegin', userMessageHtml);
    
    chatHistory.push({ role: 'user', content: userInput, timestamp: now.toISOString() });
    sessionStorage.setItem('chatHistory', JSON.stringify(chatHistory));
    userInputField.value = '';
    
    inputContainer.classList.add('loading');

    // Add typing indicator
    const typingIndicatorHtml = `<div class="message-bubble bot-message typing-indicator"><span></span><span></span><span></span></div>`;
    chatBox.insertAdjacentHTML('afterbegin', typingIndicatorHtml);
    const typingIndicator = chatBox.querySelector('.typing-indicator');

    try {
        const response = await fetch(`${BACKEND_API_BASE_URL}/api/chatbot`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ history: chatHistory, context: chatbotContext })
        });
        if (!response.ok) throw new Error('Network response was not ok.');

        typingIndicator.remove();
        
        // Create a temporary div to hold the incoming message parts
        const tempBotContainer = document.createElement('div');
        chatBox.insertAdjacentElement('afterbegin', tempBotContainer);

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let fullResponse = '';
        while (true) {
            const { value, done } = await reader.read();
            if (done) break;
            fullResponse += decoder.decode(value, { stream: true });
            // Update the temporary container as the stream comes in
            tempBotContainer.innerHTML = `<div class="message-bubble bot-message">${marked.parse(fullResponse)}</div>`;
        }

        const botTimestamp = new Date();
        chatHistory.push({ role: 'model', content: fullResponse, timestamp: botTimestamp.toISOString() });
        sessionStorage.setItem('chatHistory', JSON.stringify(chatHistory));
        
        const timestampHtml = `<div class="timestamp">${botTimestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>`;
        // Insert the final timestamp just after the message bubble
        tempBotContainer.insertAdjacentHTML('afterend', timestampHtml);
        
        // Unwrap the final message from the temporary container
        while (tempBotContainer.firstChild) {
            chatBox.insertAdjacentElement('afterbegin', tempBotContainer.firstChild);
        }
        tempBotContainer.remove();

    } catch (error) {
        console.error('Fetch error:', error);
        if (typingIndicator) typingIndicator.remove();
        const errorHtml = `<div class="message-bubble bot-message"><p>Sorry, I'm having trouble connecting.</p></div>`;
        chatBox.insertAdjacentHTML('afterbegin', errorHtml);
    } finally {
        inputContainer.classList.remove('loading');
        userInputField.focus();
    }
}