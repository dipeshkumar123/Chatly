import React, { useState, useEffect, useRef } from 'react';
import Message from './Message';
import MessageInput from './MessageInput';

const Chat = () => {
    const [messages, setMessages] = useState([]);
    const [username, setUsername] = useState('');
    const [room, setRoom] = useState('General');
    const [connected, setConnected] = useState(false);
    const [reconnectAttempt, setReconnectAttempt] = useState(0);
    const [isConnecting, setIsConnecting] = useState(false);
    const wsRef = useRef(null);
    const reconnectTimeoutRef = useRef(null);
    const maxReconnectAttempts = 5;

    useEffect(() => {
        const connectWebSocket = () => {
            if (isConnecting || wsRef.current?.readyState === WebSocket.OPEN) {
                return;
            }

            setIsConnecting(true);
            wsRef.current = new WebSocket('ws://localhost:5000');

            wsRef.current.onopen = () => {
                setConnected(true);
                setIsConnecting(false);
                setReconnectAttempt(0);
                console.log('Connected to WebSocket');
            };

            wsRef.current.onmessage = (event) => {
                const data = JSON.parse(event.data);
                switch(data.type) {
                    case 'history':
                        setMessages(data.messages);
                        break;
                    case 'message':
                        setMessages(prev => [...prev, data.message]);
                        break;
                    case 'error':
                        console.error(data.message);
                        break;
                }
            };

            wsRef.current.onerror = (error) => {
                console.error('WebSocket error:', error);
                wsRef.current?.close();
            };

            wsRef.current.onclose = () => {
                if (connected) {
                    setConnected(false);
                }
                setIsConnecting(false);

                // Only attempt reconnect if we haven't reached max attempts
                if (reconnectAttempt < maxReconnectAttempts) {
                    reconnectTimeoutRef.current = setTimeout(() => {
                        setReconnectAttempt(prev => prev + 1);
                        connectWebSocket();
                    }, 5000);
                }
            };
        };

        connectWebSocket();

        return () => {
            if (reconnectTimeoutRef.current) {
                clearTimeout(reconnectTimeoutRef.current);
            }
            if (wsRef.current) {
                wsRef.current.close();
                wsRef.current = null;
            }
            setConnected(false);
            setIsConnecting(false);
        };
    }, [connected, reconnectAttempt]);

    useEffect(() => {
        if (connected && username && room) {
            wsRef.current.send(JSON.stringify({
                type: 'join',
                username,
                room
            }));
        }
    }, [connected, username, room]);

    const sendMessage = (message) => {
        if (username && room && wsRef.current?.readyState === WebSocket.OPEN) {
            wsRef.current.send(JSON.stringify({
                type: 'message',
                username,
                text: message,
                room
            }));
        }
    };

    return (
        <div className="chat-container">
            {!connected && <div className="connection-error">Connecting...</div>}
            <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Enter username"
                className="username-input"
            />
            <select value={room} onChange={(e) => setRoom(e.target.value)}>
                <option value="General">General</option>
                <option value="Random">Random</option>
            </select>
            <div className="messages">
                {messages.map((msg, index) => (
                    <Message 
                        key={index}
                        text={msg.text}
                        username={msg.username}
                        timestamp={msg.timestamp}
                    />
                ))}
            </div>
            <MessageInput onSendMessage={sendMessage} disabled={!connected || !username} />
        </div>
    );
};

export default Chat;
