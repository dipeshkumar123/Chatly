import React from 'react';

const Message = ({ text, timestamp, username }) => {
    const formatTime = (timestamp) => {
        return new Date(timestamp).toLocaleTimeString();
    };

    return (
        <div className="message">
            <span className="message-time">{formatTime(timestamp)}</span>
            <span className="message-username">{username}: </span>
            <span className="message-text">{text}</span>
        </div>
    );
};

export default Message;
