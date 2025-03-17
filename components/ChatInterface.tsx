// components/ChatInterface.tsx
import React, { useRef } from 'react';
import { Input } from '@progress/kendo-react-inputs';
import { Button } from '@progress/kendo-react-buttons';
import { Card, CardBody } from '@progress/kendo-react-layout';
import { Message } from '@/lib/types';

interface ChatInterfaceProps {
    onSendMessage: (message: string) => void;
    onSendImage: () => void;
}

export const ChatInterface: React.FC<ChatInterfaceProps> = ({
    onSendMessage,
    onSendImage
}) => {
    const chatInputRef = useRef<any>(null);

    const handleSubmit = (event: React.FormEvent) => {
        event.preventDefault();
        if (!chatInputRef.current) return;

        const message = chatInputRef.current.value;
        if (message.trim() === '') return;

        onSendMessage(message);
        chatInputRef.current.value = '';
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
                                placeholder="Type a message..."
                            />
                            <Button type="submit">Send</Button>
                            <Button
                                id="chat-img-btn"
                                type="button"
                                onClick={onSendImage}
                                themeColor="info"
                            >
                                Send an Image 📷
                            </Button>
                        </div>
                        {/* <Button
                            id="chat-img-btn"
                            type="button"
                            onClick={onSendImage}
                            themeColor="info"
                        >
                            Send an Image 📷
                        </Button> */}
                    </div>
                </form>
            </CardBody>
        </Card>
    );
};

export const ChatLog: React.FC<{ chatLogRef: React.RefObject<HTMLUListElement> }> = ({ chatLogRef }) => {
    return (
        <div className="chat-log-container" style={{ marginBottom: '80px', overflowY: 'auto' }}>
            <ul id="chat-log" ref={chatLogRef}></ul>
        </div>
    );
};