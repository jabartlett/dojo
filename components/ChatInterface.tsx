import React, { useState } from 'react';
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
  const [inputValue, setInputValue] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  
  const handleFormSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (inputValue.trim() === '') return;

    setIsTyping(true);
    
    try {
      // Send the message through the WebRTC service
      await onSendMessage(inputValue);
    } catch (error) {
      console.error('Error sending message:', error);
    } finally {
      // Clear the input field after sending
      setInputValue('');
      setIsTyping(false);
    }
  };

  return (
    <Card className="chat-interface-container" style={{ width: '100%' }}>
      <CardBody>
        <form id="chat-form" onSubmit={handleFormSubmit}>
          <div className="k-flex k-flex-col k-flex-md-row k-gap-2" style={{ display: 'flex' }}>
            <div className="k-flex k-flex-row k-gap-2 k-flex-grow" style={{ display: 'flex' }}>
              <Input
                value={inputValue}
                onChange={(e: any) => setInputValue(e.target.value)}
                className="k-flex-grow"
                placeholder="Ask the AI assistant..."
                disabled={isTyping}
              />
              <Button 
                type="submit" 
                disabled={isTyping || inputValue.trim() === ''}
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
    <div className="chat-log-container" style={{ height: '100%', overflowY: 'auto' }}>
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