// --- A SINGLE SOURCE OF TRUTH FOR THE BACKEND URL ---
const BACKEND_API_BASE_URL = 'https://guidebook-chatbot-backend-git-ical-auth-pierre-parks-projects.vercel.app';

let chatbotContext = '';
let chatHistory = [];

document.addEventListener('DOMContentLoaded', () => {
    // 1. Retrieve data from sessionStorage
    chatbotContext = sessionStorage.getItem('chatbotContext');
    const storedHistory = sessionStorage.getItem('chatHistory');

    if (!chatbotContext || !storedHistory) {
        // Handle error if user lands here directly
        document.getElementById('chat-box').innerHTML = 
            '<p style="padding: 1rem; text-align: center;">Could not load chat session. Please return to the guidebook and try again.</p>';
        document.getElementById('chat-input-container').style.display = 'none';
        return;
    }

    chatHistory = JSON.parse(storedHistory);

    // 2. Populate the chat box with existing history
    const chatBox = document.getElementById('chat-box');
    let messagesHtml = '';
    const getTimeStamp = (date) => new Date(date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    chatHistory.forEach(msg => {
        if (msg.role === 'user') {
            messagesHtml += `<div class="message-bubble user-message"><p>${msg.content}</p></div><div class="timestamp">${getTimeStamp(msg.timestamp)}</div>`;
        } else if (msg.role === 'model') {
            messagesHtml += `<div class="message-bubble bot-message">${marked.parse(msg.content)}</div><div class="timestamp">${getTimeStamp(msg.timestamp)}</div>`;
        }
    });
    chatBox.innerHTML = messagesHtml;
    chatBox.scrollTop = chatBox.scrollHeight;


    // 3. Set up event listeners
    const sendBtn = document.getElementById('send-btn');
    const userInputField = document.getElementById('user-input');

    sendBtn.addEventListener('mousedown', (e) => {
        e.preventDefault();
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
    chatBox.insertAdjacentHTML('beforeend', userMessageHtml);
    chatHistory.push({ role: 'user', content: userInput, timestamp: now.toISOString() });
    sessionStorage.setItem('chatHistory', JSON.stringify(chatHistory)); // Save updated history
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
            body: JSON.stringify({ history: chatHistory, context: chatbotContext })
        });
        if (!response.ok) throw new Error('Network response was not ok.');

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
            botMessageContainer.innerHTML = marked.parse(fullResponse);
            chatBox.scrollTop = chatBox.scrollHeight;
        }

        const botTimestamp = new Date();
        chatHistory.push({ role: 'model', content: fullResponse, timestamp: botTimestamp.toISOString() });
        sessionStorage.setItem('chatHistory', JSON.stringify(chatHistory)); // Save updated history
        
        const timestampHtml = `<div class="timestamp">${botTimestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>`;
        chatBox.insertAdjacentHTML('beforeend', timestampHtml);

    } catch (error) {
        console.error('Fetch error:', error);
        typingIndicator.remove();
        const errorHtml = `<div class="message-bubble bot-message"><p>Sorry, I'm having trouble connecting.</p></div>`;
        chatBox.insertAdjacentHTML('beforeend', errorHtml);
    } finally {
        inputContainer.classList.remove('loading');
        userInputField.focus();
        chatBox.scrollTop = chatBox.scrollHeight;
    }
}