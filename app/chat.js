// chat.js
export function initializeChat(socket, playerName) {
    // Send message function
    function sendMessage() {
        const input = document.getElementById('msg');
        const msg = input.value;
        if (!msg) {
            document.getElementById('error').textContent = "Please enter your message";
            return;
        }
        input.value = "";
        document.getElementById('error').textContent = "";
        socket.emit('message', {
            text: msg,
            sender: playerName
        });
        const li = document.createElement('li');
        li.textContent = `You said: ${msg}`;
        document.getElementById('messages').appendChild(li);
    }

    // Attach to window for button onclick compatibility
    window.sendMessage = sendMessage;

    // Enter key support for chat input
    const msgInput = document.getElementById('msg');
    if (msgInput) {
        msgInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                sendMessage();
            }
        });
    }

    // Listen for incoming messages
    socket.on('message', (msg) => {
        const li = document.createElement('li');
        li.textContent = `${msg.sender} said: ${msg.text}`;
        document.getElementById('messages').appendChild(li);
    });
} 