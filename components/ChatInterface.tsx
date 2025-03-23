import React, { useState, useRef } from 'react';
import { Input } from '@progress/kendo-react-inputs';
import { Button } from '@progress/kendo-react-buttons';
import { Card, CardBody } from '@progress/kendo-react-layout';
import { SvgIcon } from '@progress/kendo-react-common';
import { circleIcon, stopIcon, imageIcon } from '@progress/kendo-svg-icons';


interface ChatInterfaceProps {
  onSendMessage: (message: string) => void;
  onSendImage: () => void;
  onStartRecording?: () => void;
  onStopRecording?: () => void;
  isRecording?: boolean;
  isProcessing?: boolean;
}

export const ChatInterface: React.FC<ChatInterfaceProps> = ({
  onSendMessage,
  onSendImage,
  onStartRecording,
  onStopRecording,
}) => {
  const [inputValue, setInputValue] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

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

  const startRecording = async () => {
    try {
      // Get audio from the existing WebRTC stream (assuming it's accessible)
      // This should ideally come from the WebRTCService
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        await transcribeAudio(audioBlob);
      };

      mediaRecorder.start();
      setIsRecording(true);
    } catch (error) {
      console.error('Error starting recording:', error);
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  // ... existing code ...

  const transcribeAudio = async (audioBlob: Blob) => {
    try {
      setIsTyping(true);

      // Create a FormData object to send the audio file
      const formData = new FormData();
      formData.append('audio', audioBlob);

      // Send to our API endpoint - use the correct path
      const response = await fetch('/api/transcribe', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        throw new Error(`Transcription failed: ${response.status}`);
      }

      const data = await response.json();
      if (data.text) {
        setInputValue(data.text);
      }
    } catch (error) {
      console.error('Error transcribing audio:', error);
      // Add user feedback for transcription errors
      setInputValue('Error transcribing audio. Please try again or type your message.');
    } finally {
      setIsTyping(false);
    }
  };

  return (
    <Card id="chat-form">
      <CardBody>
        <form onSubmit={handleFormSubmit} className="k-form k-d-flex k-gap-4">
          <div className="k-d-flex k-gap-2 k-flex-grow w-full">
            <Button
              type="button"
              className="k-button-md"
              themeColor={isRecording ? "error" : "primary"}
              onClick={isRecording ? stopRecording : startRecording}
              title={isRecording ? "Stop recording" : "Start recording"}
              disabled={isTyping}
            >
              <SvgIcon icon={isRecording ? cancelIcon : circleIcon} />
              {isRecording ? "Stop Recording" : "Start Recording"}
            </Button>
            <Input 
              value={inputValue}
              onChange={(e:any) => setInputValue(e.target.value)}
              className="k-flex-grow w-full"
              placeholder="Ask the AI assistant..."
              disabled={isTyping || isRecording}
            />
            <Button 
              type="submit" 
              themeColor="primary" 
              disabled={isTyping || isRecording || inputValue.trim() === ''}
            >
              {isTyping ? 'Sending...' : 'Send'}
            </Button>
            <Button 
              type="button"
              onClick={onSendImage}
              disabled={isTyping || isRecording}
            >
              <SvgIcon icon={imageIcon} />
              Upload Image
            </Button>
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