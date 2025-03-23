'use client';

import React, { useEffect, useRef, useState } from 'react';
import { Card, CardHeader, CardTitle, StackLayout } from '@progress/kendo-react-layout';
import { Button } from '@progress/kendo-react-buttons';
import { MediaControls } from './MediaControls';
import { ChatInterface, ChatLog } from './ChatInterface';
import { WebRTCService } from '@/lib/services/WebRTCService';
import { Notification, NotificationGroup } from '@progress/kendo-react-notification';
import { Fade } from '@progress/kendo-react-animation';
import { Dialog, DialogActionsBar } from '@progress/kendo-react-dialogs';



export default function WebRTCClient() {
    const selfVideoRef = useRef<HTMLVideoElement>(null!);
    const peerVideoRef = useRef<HTMLVideoElement>(null!);
    const chatLogRef = useRef<HTMLUListElement>(null!);
    const [inCall, setInCall] = useState(false);
    const [namespace, setNamespace] = useState('');
    const [audioEnabled, setAudioEnabled] = useState(false);
    const [videoEnabled, setVideoEnabled] = useState(true);
    const [peerMicActive, setPeerMicActive] = useState(false);
    const [isMounted, setIsMounted] = useState(false);
    const [isProcessingMessage, setIsProcessingMessage] = useState(false);
    const [isRecording, setIsRecording] = useState(false);
    const [showSuccessNotification, setShowSuccessNotification] = useState(false);
    const [showErrorNotification, setShowErrorNotification] = useState(false);
    const [notificationMessage, setNotificationMessage] = useState('');
    const [showLeaveDialog, setShowLeaveDialog] = useState(false);



    // Reference to our WebRTC service
    const webRTCServiceRef = useRef<WebRTCService | null>(null);

    // Handle client-side mounting
    useEffect(() => {
        setIsMounted(true);

        // Add CSS for responsive layout
        const style = document.createElement('style');
        style.textContent = `
            /* Default (mobile) */
            .video-column {
                width: 100% !important;
            }
            .chat-column {
                width: 100% !important;
            }
            .layout-container {
                flex-direction: column !important;
            }
            
            /* Mobile video layout - two columns with 20px gutter */
            @media (max-width: 767px) {
                .video-column .k-vstack {
                    flex-direction: row;
                    flex-wrap: wrap;
                    justify-content: space-between;
                }
                .video-container {
                    width: calc(50% - 10px);
                    display: inline-block;
                    vertical-align: top;
                }
                .video-container:first-child {
                    margin-right: 0px;
                }
            }
            
            /* Tablet */
            @media (min-width: 768px) {
                .video-column {
                    width: 33% !important;
                }
                .chat-column {
                    width: 67% !important;
                }
                .layout-container {
                    flex-direction: row !important;
                }
            }
            
            /* Desktop */
            @media (min-width: 1024px) {
                .video-column {
                    width: 25% !important;
                }
                .chat-column {
                    width: 75% !important;
                }
            }
            
            /* Chat message styling */
            #chat-log {
                padding: 10px;
            }
            #chat-log li {
                margin-bottom: 10px;
                padding: 10px;
                border-radius: 8px;
                max-width: 80%;
                word-wrap: break-word;
            }
            #chat-log li.system-message {
                background-color: #f5f5f5;
                color: #666;
                font-style: italic;
                margin: 5px auto;
                text-align: center;
                max-width: 90%;
            }
            #chat-log li.img {
                padding: 5px;
            }
            #chat-log li.img img {
                max-width: 100%;
                border-radius: 6px;
            }
        `;
        document.head.appendChild(style);

        return () => {
            document.head.removeChild(style);
        };
    }, []);

    // Prepare namespace from URL hash or create a new one
    useEffect(() => {
        if (!isMounted) return;

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
    }, [isMounted]);

    // Initialize WebRTC service and request user media
    useEffect(() => {
        if (!isMounted || !webRTCServiceRef.current) return;

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
    }, [isMounted]);

    const handleCallButton = () => {
        if (!webRTCServiceRef.current) return;

        if (!inCall) {
            console.log('Joining the call...');
            webRTCServiceRef.current.joinCall();
            setInCall(true);
            // Show success notification
            setNotificationMessage('Successfully joined the call!');
            setShowSuccessNotification(true);
            // Auto-hide notification after 5 seconds
            setTimeout(() => {
                setShowSuccessNotification(false);
            }, 5000);
        } else {
            // Show confirmation dialog instead of immediately leaving
            setShowLeaveDialog(true);
        }
    };

    // Handle confirmed leave call
    const handleLeaveCall = () => {
        if (!webRTCServiceRef.current) return;

        console.log('Leaving the call...');
        webRTCServiceRef.current.leaveCall();
        setInCall(false);
        setShowLeaveDialog(false);

        // Show success notification for leaving
        setNotificationMessage('Successfully left the call!');
        setShowSuccessNotification(true);
        // Auto-hide notification after 5 seconds
        setTimeout(() => {
            setShowSuccessNotification(false);
        }, 5000);
    };

    // Handle cancel leave call
    const handleCancelLeave = () => {
        setShowLeaveDialog(false);
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

    // Handle sending text message
    const handleSendMessage = async (message: string) => {
        if (!webRTCServiceRef.current || !message.trim()) return;

        setIsProcessingMessage(true);

        try {
            // Send the message through WebRTC with LLM processing
            await webRTCServiceRef.current.sendMessageWithLLM(message);
        } catch (error) {
            console.error('Error sending message:', error);
            // Handle error if needed
        } finally {
            setIsProcessingMessage(false);
        }
    };

    // Handle start recording
    const handleStartRecording = () => {
        if (!webRTCServiceRef.current) return;

        try {
            webRTCServiceRef.current.startRecording();
            setIsRecording(true);
        } catch (error) {
            console.error('Error starting recording:', error);
        }
    };

    // Handle stop recording
    const handleStopRecording = async () => {
        if (!webRTCServiceRef.current) return;

        setIsProcessingMessage(true);

        try {
            await webRTCServiceRef.current.transcribeAndSendToLLM();
        } catch (error) {
            console.error('Error processing recording:', error);
        } finally {
            setIsRecording(false);
            setIsProcessingMessage(false);
        }
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
                            style={{ marginLeft: "10px" }}
                        >
                            {inCall ? "Leave Call" : "Join Call"}
                        </Button>
                    </CardTitle>
                </CardHeader>
            </Card>

            {/* Leave Call Confirmation Dialog */}
            {showLeaveDialog && (
                <Dialog title={'Leave Call'} onClose={handleCancelLeave}>
                    <p style={{ margin: '25px', textAlign: 'center' }}>
                        Are you sure you would like to leave this call?
                    </p>
                    <DialogActionsBar>
                        <Button type="button" onClick={handleCancelLeave}>
                            Cancel
                        </Button>
                        <Button type="button" themeColor="error" onClick={handleLeaveCall}>
                            Leave Call
                        </Button>
                    </DialogActionsBar>
                </Dialog>
            )}

            {/* Notification Group */}
            <NotificationGroup
                style={{
                    position: 'fixed',
                    right: 20,
                    bottom: 20,
                    alignItems: 'flex-start',
                    flexWrap: 'wrap-reverse',
                    zIndex: 9999
                }}
            >
                <Fade>
                    {showSuccessNotification && (
                        <Notification
                            type={{ style: 'success', icon: true }}
                            closable={true}
                            onClose={() => setShowSuccessNotification(false)}
                        >
                            <span>{notificationMessage}</span>
                        </Notification>
                    )}
                </Fade>
                <Fade>
                    {showErrorNotification && (
                        <Notification
                            type={{ style: 'error', icon: true }}
                            closable={true}
                            onClose={() => setShowErrorNotification(false)}
                        >
                            <span>Error: {notificationMessage}</span>
                        </Notification>
                    )}
                </Fade>
            </NotificationGroup>

            <div className="k-my-4">
                <div className="layout-container" style={{ display: 'flex', gap: '20px' }}>
                    {/* Video streams column */}
                    <div className="video-column">
                        <StackLayout orientation="vertical" gap={20}>
                            {/* Peer video */}
                            <div className="video-container">
                                <video
                                    ref={peerVideoRef}
                                    id="peer"
                                    autoPlay
                                    playsInline
                                    muted={false}
                                    style={{ width: '100%', height: 'auto' }}
                                />
                                {peerMicActive && (
                                    <div className="mic-indicator" style={{
                                        position: 'absolute',
                                        bottom: '10px',
                                        left: '10px',
                                        backgroundColor: 'rgba(0,0,0,0.5)',
                                        color: 'white',
                                        padding: '5px',
                                        borderRadius: '50%'
                                    }}>
                                        <span className="k-icon k-i-microphone"></span>
                                    </div>
                                )}
                            </div>

                            {/* Self video */}
                            <div className="video-container" style={{ position: 'relative' }}>
                                <video
                                    ref={selfVideoRef}
                                    id="self"
                                    autoPlay
                                    playsInline
                                    muted={true}
                                    onClick={handleSelfVideoClick}
                                    style={{ width: '100%', height: 'auto' }}
                                />
                                <div style={{ position: 'absolute', left: 0, right: 0, bottom: '-30px' }}>
                                    <MediaControls
                                        audioEnabled={audioEnabled}
                                        videoEnabled={videoEnabled}
                                        onToggleMic={handleToggleMic}
                                        onToggleCam={handleToggleCam}
                                    />
                                </div>
                            </div>
                        </StackLayout>
                    </div>

                    {/* Chat column */}
                    <div className="chat-column">
                        <div className="chat-container" style={{ height: 'calc(100vh - 160px)', minHeight: '500px', display: 'flex', flexDirection: 'column' }}>
                            <div style={{ flex: 1, overflowY: 'auto', marginBottom: '20px' }}>
                                <ChatLog chatLogRef={chatLogRef} />
                            </div>
                            <div>
                                <ChatInterface
                                    onSendMessage={handleSendMessage}
                                    onSendImage={handleSendImage}
                                    onStartRecording={handleStartRecording}
                                    onStopRecording={handleStopRecording}
                                    isRecording={isRecording}
                                    isProcessing={isProcessingMessage}
                                />
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}