// components/ChatInterface.tsx
import React, { useRef, useState } from 'react';
import { Input } from '@progress/kendo-react-inputs';
import { Button } from '@progress/kendo-react-buttons';
import { Card, CardBody } from '@progress/kendo-react-layout';

interface ChatInterfaceProps {
  onSendMessage: (message: string) => void;
  onSendImage: () => void;
}

export const ChatInterface: React.FC<ChatInterfaceProps> = ({
  onSendMessage,
  onSendImage
}) => {
  const chatInputRef = useRef<any>(null);
  const [isTyping, setIsTyping] = useState(false);

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    if (!chatInputRef.current) return;

    const message = chatInputRef.current.value;
    if (message.trim() === '') return;

    setIsTyping(true);
    
    // Send the message
    onSendMessage(message);
    
    // Clear the input
    chatInputRef.current.value = '';
    
    // Reset typing indicator after a short delay
    setTimeout(() => setIsTyping(false), 500);
  };

  return (
    <Card className="chat-interface-container" style={{ width: '100%' }}>
      <CardBody>
        <form id="chat-form" onSubmit={handleSubmit}>
          <div className="k-flex k-flex-col k-flex-md-row k-gap-2" style={{ display: 'flex' }}>
            <div className="k-flex k-flex-row k-gap-2 k-flex-grow" style={{ display: 'flex' }}>
              <Input
                ref={chatInputRef}
                className="k-flex-grow"
                placeholder="Ask the AI assistant..."
                disabled={isTyping}
              />
              <Button 
                type="submit" 
                disabled={isTyping}
                themeColor="primary"
              >
                {isTyping ? 'Sending...' : 'Send'}
              </Button>
              <Button
                id="chat-img-btn"
                type="button"
                onClick={onSendImage}
                themeColor="info"
                disabled={isTyping}
              >
                Image
              </Button>
            </div>
          </div>
        </form>
      </CardBody>
    </Card>
  );
};

export const ChatLog: React.FC<{ chatLogRef: React.RefObject<HTMLUListElement> }> = ({ chatLogRef }) => {
  return (
    <div className="chat-log-container" style={{ marginBottom: '80px', overflowY: 'auto' }}>
      <ul 
        id="chat-log" 
        ref={chatLogRef} 
        className="chat-messages"
        style={{ 
          listStyleType: 'none', 
          padding: '0',
          margin: '0'
        }}
      ></ul>
    </div>
  );
};