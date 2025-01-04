const WebSocket = require('ws');
const mongoose = require('mongoose');
const Message = require('./models/Message');

// In-memory message store as fallback
const messageStore = {
    messages: [],
    addMessage: function(message) {
        this.messages.push({
            ...message,
            timestamp: new Date(),
            _id: Date.now()
        });
        return this.messages[this.messages.length - 1];
    },
    getMessages: function(room) {
        return this.messages.filter(msg => msg.room === room)
            .slice(-50);
    }
};

let useDatabase = false;

// Try to connect to MongoDB
mongoose.connect('mongodb://localhost:27017/chat')
    .then(() => {
        console.log('Connected to MongoDB');
        useDatabase = true;
    })
    .catch((err) => {
        console.warn('MongoDB connection failed, using in-memory storage:', err.message);
    });

const wss = new WebSocket.Server({ 
    port: 5000,
    clientTracking: true,
    handleProtocols: () => 'chat' 
});

function heartbeat() {
    this.isAlive = true;
}

wss.on('connection', (ws) => {
    ws.isAlive = true;
    ws.on('pong', heartbeat);

    // Set a unique ID for the connection
    ws.id = Date.now();
    console.log(`Client connected with ID: ${ws.id}`);

    ws.on('message', async (data) => {
        try {
            const message = JSON.parse(data.toString());
            
            if (message.type === 'join') {
                ws.room = message.room;
                ws.username = message.username;
                
                // Get room history
                let roomMessages;
                if (useDatabase) {
                    roomMessages = await Message.find({ room: message.room })
                        .sort({ timestamp: -1 })
                        .limit(50);
                } else {
                    roomMessages = messageStore.getMessages(message.room);
                }
                
                ws.send(JSON.stringify({ type: 'history', messages: roomMessages }));
                return;
            }

            // Handle new message
            let newMessage;
            if (useDatabase) {
                newMessage = await Message.create({
                    username: message.username,
                    text: message.text,
                    room: message.room,
                });
            } else {
                newMessage = messageStore.addMessage({
                    username: message.username,
                    text: message.text,
                    room: message.room,
                });
            }

            // Broadcast to clients in the same room
            wss.clients.forEach((client) => {
                if (client.readyState === WebSocket.OPEN && client.room === message.room) {
                    client.send(JSON.stringify({ type: 'message', message: newMessage }));
                }
            });
        } catch (error) {
            console.error('Error processing message:', error);
            ws.send(JSON.stringify({ type: 'error', message: 'Failed to process message' }));
        }
    });

    ws.on('close', () => {
        ws.isAlive = false;
        console.log(`Client disconnected: ${ws.id}`);
    });

    ws.on('error', (error) => {
        console.error(`WebSocket error for client ${ws.id}:`, error);
        ws.terminate();
    });
});

// Modify the interval for connection checking
const interval = setInterval(() => {
    wss.clients.forEach((ws) => {
        if (ws.isAlive === false) {
            console.log(`Terminating inactive client: ${ws.id}`);
            return ws.terminate();
        }
        ws.isAlive = false;
        ws.ping(() => {});
    });
}, 30000);

wss.on('close', () => {
    clearInterval(interval);
});

// Handle server shutdown gracefully
process.on('SIGTERM', () => {
    wss.close(() => {
        console.log('WebSocket server shutdown');
        process.exit(0);
    });
});
