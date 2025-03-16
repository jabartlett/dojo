// components/WebRTCClient.tsx
'use client';

import React, { useEffect, useRef, useState } from 'react';
import { Card, CardHeader, CardTitle } from '@progress/kendo-react-layout';
import { Button } from '@progress/kendo-react-buttons';
import { MediaControls } from './MediaControls';
import { ChatInterface, ChatLog } from './ChatInterface';
import { VideoStreams } from './VideoStreams';
import { WebRTCService } from '@/lib/services/WebRTCService';

export default function WebRTCClient() {
    const selfVideoRef = useRef<HTMLVideoElement>(null!);
    const peerVideoRef = useRef<HTMLVideoElement>(null!);
    const chatLogRef = useRef<HTMLUListElement>(null!);
    const [inCall, setInCall] = useState(false);
    const [namespace, setNamespace] = useState('');
    const [audioEnabled, setAudioEnabled] = useState(false);
    const [videoEnabled, setVideoEnabled] = useState(true);
    const [peerMicActive, setPeerMicActive] = useState(false);
    
    // Reference to our WebRTC service
    const webRTCServiceRef = useRef<WebRTCService | null>(null);

    // Prepare namespace from URL hash or create a new one
    useEffect(() => {
        const prepareNamespace = (hash: string, setLocation: boolean): string => {
            let ns = hash.replace(/^#/, ''); // remove # from the hash
            if (/^[0-9]{7}$/.test(ns)) {
                console.log('Checked existing namespace', ns);
                return ns;
            }
            ns = Math.random().toString().substring(2, 9);
            console.log('Created new namespace', ns);
            if (setLocation) window.location.hash = ns;
            return ns;
        };

        const ns = prepareNamespace(window.location.hash, true);
        setNamespace(ns);
        webRTCServiceRef.current = new WebRTCService(ns);
    }, []);

  // components/WebRTCClient.tsx (continued)
    // Initialize WebRTC service and request user media
    useEffect(() => {
        if (!webRTCServiceRef.current) return;
        
        const webRTCService = webRTCServiceRef.current;
        
        // Request media access
        webRTCService.requestUserMedia().then(() => {
            // Display self video
            if (selfVideoRef.current) {
                selfVideoRef.current.srcObject = webRTCService.getSelfStream();
            }

            // Update audio/video state
            setAudioEnabled(webRTCService.isAudioEnabled());
            setVideoEnabled(webRTCService.isVideoEnabled());
        });

        // Set chat log element
        if (chatLogRef.current) {
            webRTCService.setChatLogElement(chatLogRef.current);
        }

        // Setup interval to check peer mic status
        const statusCheckInterval = setInterval(() => {
            if (webRTCServiceRef.current) {
                setPeerMicActive(webRTCServiceRef.current.isPeerMicActive());
            }
        }, 1000);

        // Set the peer video stream
        if (peerVideoRef.current && webRTCServiceRef.current) {
            peerVideoRef.current.srcObject = webRTCServiceRef.current.getPeerStream();
        }

        return () => {
            clearInterval(statusCheckInterval);
        };
    }, []);

    // Handle call button click
    const handleCallButton = () => {
        if (!webRTCServiceRef.current) return;

        if (!inCall) {
            console.log('Joining the call...');
            webRTCServiceRef.current.joinCall();
            setInCall(true);
        } else {
            console.log('Leaving the call...');
            webRTCServiceRef.current.leaveCall();
            setInCall(false);
        }
    };

    // Handle toggling microphone
    const handleToggleMic = () => {
        if (!webRTCServiceRef.current) return;
        
        const newState = webRTCServiceRef.current.toggleMic();
        setAudioEnabled(newState);
    };

    // Handle toggling camera
    const handleToggleCam = () => {
        if (!webRTCServiceRef.current) return;
        
        const newState = webRTCServiceRef.current.toggleCam();
        setVideoEnabled(newState);
    };

    // Handle self video click for filters
    const handleSelfVideoClick = () => {
        if (!webRTCServiceRef.current) return;
        
        const filter = webRTCServiceRef.current.cycleVideoFilter();
        
        // Apply filter to self video
        if (selfVideoRef.current) {
            selfVideoRef.current.className = `filter-${filter}`;
        }
        
        // Send filter to peer
        webRTCServiceRef.current.applyFilterToPeer(filter);
    };

    // Handle sending text message
    const handleSendMessage = (message: string) => {
        if (!webRTCServiceRef.current) return;
        webRTCServiceRef.current.sendTextMessage(message);
    };

    // Handle sending image
    const handleSendImage = () => {
        let input = document.querySelector('input.temp') as HTMLInputElement;
        input = input || document.createElement('input');
        input.className = 'temp';
        input.type = 'file';
        input.accept = '.gif, .jpg, .jpeg, .png';
        input.setAttribute('aria-hidden', 'true');

        // Safari/iOS requires appending the file input to the DOM
        document.querySelector('#chat-form')?.appendChild(input);

        input.addEventListener('change', (event: Event) => {
            event.preventDefault();
            const target = event.target as HTMLInputElement;
            const image = target.files?.[0];

            if (!image || !webRTCServiceRef.current) return;

            webRTCServiceRef.current.sendImageFile(image);

            // Remove appended file input element
            target.remove();
        });
        
        input.click();
    };

    return (
        <div className="webrtc-container">
            <Card>
                <CardHeader>
                    <CardTitle>
                        Room #{namespace}
                        <Button
                            className="k-float-right"
                            themeColor={inCall ? "error" : "success"}
                            onClick={handleCallButton}
                        >
                            {inCall ? "Leave Call" : "Join Call"}
                        </Button>
                    </CardTitle>
                </CardHeader>
            </Card>

            <div className="k-my-4">
                <VideoStreams
                    selfVideoRef={selfVideoRef}
                    peerVideoRef={peerVideoRef}
                    onSelfVideoClick={handleSelfVideoClick}
                    peerHasMic={peerMicActive}
                />
            </div>

            <MediaControls
                audioEnabled={audioEnabled}
                videoEnabled={videoEnabled}
                onToggleMic={handleToggleMic}
                onToggleCam={handleToggleCam}
            />

            <div className="chat-container k-mt-4" style={{ position: 'relative', height: '300px' }}>
                <ChatLog chatLogRef={chatLogRef} />
                <ChatInterface
                    onSendMessage={handleSendMessage}
                    onSendImage={handleSendImage}
                />
            </div>
        </div>
    );
}