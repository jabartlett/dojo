// components/WebRTCClient.tsx
'use client';

import React, { useEffect, useRef, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import { Button } from '@progress/kendo-react-buttons';
import { Notification, NotificationGroup } from '@progress/kendo-react-notification';
import { Popup } from '@progress/kendo-react-popup';
import { Input } from '@progress/kendo-react-inputs';
import { Chat } from '@progress/kendo-react-conversational-ui';
import '@progress/kendo-theme-default/dist/all.css';

// Define the Message interface
interface Message {
    text?: string;
    timestamp: number;
    id?: number;
    metadata?: {
        kind: string;
        name: string;
        size: number;
        timestamp: number;
        type: string;
    };
    file?: File | Blob;
}

// Define features interface
interface Features {
    audio: boolean;
    video: boolean;
    binaryType?: string;
    [key: string]: any; // Add index signature for dynamic properties
}

type SelfState = {
    rtcConfig: RTCConfiguration | null;
    isPolite: boolean;
    isMakingOffer: boolean;
    isIgnoringOffer: boolean;
    isSettingRemoteAnswerPending: boolean;
    mediaConstraints: { audio: boolean; video: boolean };
    mediaStream: MediaStream;
    mediaTracks: Record<string, MediaStreamTrack>;
    features: Features;
    messageQueue: Message[]; // Now properly typed
    filters?: VideoFX; // Add the filters property
};

type PeerState = {
    connection: RTCPeerConnection;
    mediaStream: MediaStream;
    mediaTracks: Record<string, MediaStreamTrack>;
    features: Record<string, unknown>;
    featuresChannel?: RTCDataChannel; // Add featuresChannel property
    chatChannel?: RTCDataChannel; // Add chatChannel property
};

// Notification interface
interface NotificationMessage {
    id: number;
    type: 'info' | 'success' | 'warning' | 'error';
    message: string;
    visible: boolean;
}

/***
 * Inspired by concepts from "Programming WebRTC"
 * This is original code written for Next.js 15 with app router
 * Copyright (c) 2025 Your Name
 * License: MIT
 */

// VideoFX class for applying filters to video
class VideoFX {
    filters: string[];

    constructor() {
        this.filters = ['grayscale', 'sepia', 'noir', 'psychedelic', 'none'];
    }

    cycleFilter() {
        const filter = this.filters.shift()!;
        this.filters.push(filter);
        return filter;
    }
}

export default function WebRTCClient() {
    const socketRef = useRef<Socket | null>(null);
    const selfVideoRef = useRef<HTMLVideoElement>(null);
    const peerVideoRef = useRef<HTMLVideoElement>(null);
    const chatLogRef = useRef<HTMLUListElement>(null);
    const chatInputRef = useRef<HTMLInputElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const [inCall, setInCall] = useState(false);
    const [namespace, setNamespace] = useState('');
    const [notifications, setNotifications] = useState<NotificationMessage[]>([]);
    const [micEnabled, setMicEnabled] = useState(false);
    const [cameraEnabled, setCameraEnabled] = useState(true);
    const [connectionState, setConnectionState] = useState('new');

    // Initialize self and peer states
    const $self = useRef<SelfState>({
        rtcConfig: null,
        isPolite: false,
        isMakingOffer: false,
        isIgnoringOffer: false,
        isSettingRemoteAnswerPending: false,
        mediaConstraints: { audio: true, video: true },
        mediaStream: typeof window !== 'undefined' ? new MediaStream() : ({} as MediaStream), // Safe check for client-side
        mediaTracks: {},
        features: {
            audio: false,
            video: true,
        },
        messageQueue: [],
    });

    const $peer = useRef<PeerState>({
        connection:
            typeof window !== 'undefined' ? new RTCPeerConnection($self.current.rtcConfig || undefined) : ({} as RTCPeerConnection), // Safe check for client-side
        mediaStream: typeof window !== 'undefined' ? new MediaStream() : ({} as MediaStream), // Client-side check
        mediaTracks: {},
        features: {},
    });

    // Add notification
    const addNotification = (type: 'info' | 'success' | 'warning' | 'error', message: string) => {
        const newNotification: NotificationMessage = {
            id: Date.now(),
            type,
            message,
            visible: true
        };
        setNotifications(prev => [...prev, newNotification]);
        
        // Auto-dismiss after 5 seconds
        setTimeout(() => {
            setNotifications(prev => 
                prev.map(n => n.id === newNotification.id ? {...n, visible: false} : n)
            );
            
            // Remove from DOM after fade animation
            setTimeout(() => {
                setNotifications(prev => prev.filter(n => n.id !== newNotification.id));
            }, 500);
        }, 5000);
    };

    // Initialize the video effects
    useEffect(() => {
        $self.current.filters = new VideoFX();
    }, []);

    // Prepare namespace from URL hash or create a new one
    useEffect(() => {
        const prepareNamespace = (hash: string, setLocation: boolean): string => {
            let ns = hash.replace(/^#/, ''); // remove # from the hash
            if (/^[0-9]{7}$/.test(ns)) {
                console.log('Checked existing namespace', ns);
                addNotification('info', `Joined existing room: ${ns}`);
                return ns;
            }
            ns = Math.random().toString().substring(2, 9);
            console.log('Created new namespace', ns);
            addNotification('success', `Created new room: ${ns}`);
            if (setLocation) window.location.hash = ns;
            return ns;
        };

        setNamespace(prepareNamespace(window.location.hash, true));
    }, []);

    // Request user media
    useEffect(() => {
        const requestUserMedia = async (constraints: MediaStreamConstraints) => {
            try {
                const media = await navigator.mediaDevices.getUserMedia(constraints);
                addNotification('success', 'Camera and microphone access granted');

                // Hold onto audio and video track references
                $self.current.mediaTracks.audio = media.getAudioTracks()[0];
                $self.current.mediaTracks.video = media.getVideoTracks()[0];

                // Mute the audio if `$self.features.audio` evaluates to `false`
                $self.current.mediaTracks.audio.enabled = !!$self.current.features.audio;
                setMicEnabled(!!$self.current.features.audio);

                // Add audio and video tracks to mediaStream
                $self.current.mediaStream.addTrack($self.current.mediaTracks.audio);
                $self.current.mediaStream.addTrack($self.current.mediaTracks.video);

                // Display the stream
                if (selfVideoRef.current) {
                    selfVideoRef.current.srcObject = $self.current.mediaStream;
                }
            } catch (err) {
                console.error('Error accessing media devices:', err);
                addNotification('error', 'Failed to access camera or microphone');
            }
        };

        requestUserMedia($self.current.mediaConstraints);

        // Cleanup function
        return () => {
            Object.values($self.current.mediaTracks).forEach(track => {
                track.stop();
            });
        };
    }, []);

    // Add features channel
    const addFeaturesChannel = (peer: PeerState) => {
        const featureFunctions: Record<string, () => void> = {
            audio: () => {
                const status = document.querySelector('#mic-status');
                status?.setAttribute('aria-hidden', peer.features.audio ? 'true' : 'false');
            },
            video: () => {
                if (peer.mediaTracks.video) {
                    if (peer.features.video) {
                        peer.mediaStream.addTrack(peer.mediaTracks.video);
                    } else {
                        peer.mediaStream.removeTrack(peer.mediaTracks.video);
                        if (peerVideoRef.current) {
                            peerVideoRef.current.srcObject = peer.mediaStream;
                        }
                    }
                }
            },
        };

        peer.featuresChannel = peer.connection.createDataChannel('features', {
            negotiated: true,
            id: 110,
        });

        peer.featuresChannel.onopen = () => {
            console.log('Features channel opened.');
            addNotification('info', 'Features channel established');
            ($self.current.features as Features).binaryType = peer.featuresChannel?.binaryType;
            // Send features information as soon as the channel opens
            peer.featuresChannel?.send(JSON.stringify($self.current.features));
        };

        peer.featuresChannel.onmessage = (event: MessageEvent) => {
            const features = JSON.parse(event.data);
            Object.keys(features).forEach(f => {
                // Update the corresponding features field on $peer
                peer.features[f] = features[f];
                // If there's a corresponding function, run it
                if (typeof featureFunctions[f] === 'function') {
                    featureFunctions[f]();
                }
            });
        };
    };

    // Queue message
    const queueMessage = (message: Message, push = true) => {
        if (push) {
            $self.current.messageQueue.push(message); // Queue at the end
        } else {
            $self.current.messageQueue.unshift(message); // Queue at the start
        }
    };

    // Handle response from peer
    const handleResponse = (response: { id: number; timestamp: number }) => {
        const sent_item = document.querySelector(`#chat-log *[data-timestamp="${response.id}"]`);

        if (!sent_item) return;

        const classes = ['received'];
        if (response.timestamp - response.id > 1000) {
            classes.push('delayed');
        }

        sent_item.classList.add(...classes);
    };

    // Receive file
    const receiveFile = (file_channel: RTCDataChannel) => {
        const chunks: Blob[] | ArrayBuffer[] = [];
        let metadata: any;
        let bytes_received = 0;

        file_channel.onmessage = ({ data }) => {
            // Receive the metadata
            if (typeof data === 'string' && data.startsWith('{')) {
                metadata = JSON.parse(data);
                addNotification('info', `Receiving ${metadata.name}...`);
            } else {
                // Receive and store chunks
                bytes_received += data.size ? data.size : data.byteLength;
                chunks.push(data);

                // Until the bytes received equal the file size
                if (bytes_received === metadata.size) {
                    const image = new Blob(chunks as BlobPart[], { type: metadata.type });
                    const response = {
                        id: metadata.timestamp,
                        timestamp: Date.now(),
                    };

                    appendMessage('peer', metadata, image);
                    addNotification('success', `Received ${metadata.name}`);

                    // Send an acknowledgement
                    try {
                        file_channel.send(JSON.stringify(response));
                    } catch (e) {
                        queueMessage(response);
                    }
                }
            }
        };
    };

    // Send file
    const sendFile = (peer: PeerState, payload: Message) => {
        if (!payload.metadata || !payload.file) return;

        const { metadata, file } = payload;
        const file_channel = peer.connection.createDataChannel(`${metadata.kind}-${metadata.name}`);
        const chunk = 16 * 1024; // 16KiB chunks

        file_channel.onopen = async () => {
            if (!peer.features ||
                (($self.current.features as Features).binaryType !== (peer.features as Features).binaryType)) {
                file_channel.binaryType = 'arraybuffer';
            }

            addNotification('info', `Sending ${metadata.name}...`);

            // Prepare data according to the binaryType in use
            const data = file_channel.binaryType === 'blob'
                ? file
                : await (file as File).arrayBuffer();

            // Send the metadata
            file_channel.send(JSON.stringify(metadata));

            // Send the prepared data in chunks
            for (let i = 0; i < metadata.size; i += chunk) {
                file_channel.send(data.slice(i, i + chunk));
            }
        };

        file_channel.onmessage = ({ data }) => {
            // Sending side will only ever receive a response
            handleResponse(JSON.parse(data));
            addNotification('success', `${metadata.name} delivered successfully`);
            file_channel.close();
        };
    };

    // Send message or queue it
    const sendOrQueueMessage = (peer: PeerState, message: Message, push = true) => {
        const chat_channel = peer.chatChannel;
        if (!chat_channel || chat_channel.readyState !== 'open') {
            queueMessage(message, push);
            return;
        }

        if (message.file) {
            sendFile(peer, message);
        } else {
            try {
                chat_channel.send(JSON.stringify(message));
            } catch (e) {
                console.error('Error sending message:', e);
                addNotification('error', 'Failed to send message');
                queueMessage(message, push);
            }
        }
    };

    // Append message to chat log
    const appendMessage = (sender: 'self' | 'peer', message: any, image?: Blob) => {
        if (!chatLogRef.current) return;

        const li = document.createElement('li');
        li.className = sender;
        li.innerText = message.text || '';
        li.dataset.timestamp = message.timestamp.toString();

        if (image) {
            const img = document.createElement('img');
            img.src = URL.createObjectURL(image);
            img.onload = function () {
                URL.revokeObjectURL(img.src);
                scrollToEnd(chatLogRef.current!);
            };
            li.innerText = ''; // undefined on images
            li.classList.add('img');
            li.appendChild(img);
        }

        chatLogRef.current.appendChild(li);
        scrollToEnd(chatLogRef.current);
    };

    // Scroll chat log to the end
    const scrollToEnd = (el: HTMLElement) => {
        if (el.scrollTo) {
            el.scrollTo({
                top: el.scrollHeight,
                behavior: 'smooth',
            });
        } else {
            el.scrollTop = el.scrollHeight;
        }
    };

// Share features
const shareFeatures = (...features: string[]) => {
    const featuresToShare: Record<string, any> = {};

    // Don't try to share features before joining the call or
    // before the features channel is available
    if (!$peer.current.featuresChannel) return;

    features.forEach(f => {
        featuresToShare[f] = ($self.current.features as Features)[f];
    });

    try {
        $peer.current.featuresChannel.send(JSON.stringify(featuresToShare));
    } catch (e) {
        console.error('Error sending features:', e);
        addNotification('warning', 'Could not share media preferences');
        // No need to queue; contents of `$self.features` will send
        // as soon as the features channel opens
    }
};

// Toggle microphone
const toggleMic = () => {
    const audio = $self.current.mediaTracks.audio;
    const enabled_state = audio.enabled = !audio.enabled;

    $self.current.features.audio = enabled_state;
    setMicEnabled(enabled_state);

    shareFeatures('audio');
    addNotification(enabled_state ? 'success' : 'info', enabled_state ? 'Microphone unmuted' : 'Microphone muted');
};

// Toggle camera
const toggleCam = () => {
    const video = $self.current.mediaTracks.video;
    const enabled_state = video.enabled = !video.enabled;

    $self.current.features.video = enabled_state;
    setCameraEnabled(enabled_state);

    shareFeatures('video');
    addNotification(enabled_state ? 'success' : 'info', enabled_state ? 'Camera enabled' : 'Camera disabled');

    if (enabled_state) {
        $self.current.mediaStream.addTrack($self.current.mediaTracks.video);
    } else {
        $self.current.mediaStream.removeTrack($self.current.mediaTracks.video);
        if (selfVideoRef.current) {
            selfVideoRef.current.srcObject = $self.current.mediaStream;
        }
    }
};

// Add chat channel
const addChatChannel = (peer: PeerState) => {
    peer.chatChannel = peer.connection.createDataChannel('text chat', {
        negotiated: true,
        id: 100,
    });

    peer.chatChannel.onmessage = (event: MessageEvent) => {
        const message = JSON.parse(event.data);
        if (!message.id) {
            // Prepare a response and append an incoming message
            const response = {
                id: message.timestamp,
                timestamp: Date.now(),
            };
            sendOrQueueMessage(peer, response);
            appendMessage('peer', message);
        } else {
            // Handle an incoming response
            handleResponse(message);
        }
    };

    peer.chatChannel.onclose = () => {
        console.log('Chat channel closed.');
        addNotification('warning', 'Chat connection closed');
    };

    peer.chatChannel.onopen = () => {
        console.log('Chat channel opened.');
        addNotification('success', 'Chat connection established');
        // Process any queued messages
        while ($self.current.messageQueue.length > 0) {
            const message = $self.current.messageQueue.shift();
            if (message) {
                sendOrQueueMessage(peer, message, false);
            }
        }
    };
};

// Add streaming media
const addStreamingMedia = (peer: PeerState) => {
    Object.values($self.current.mediaTracks).forEach(track => {
        peer.connection.addTrack(track);
    });
};

// Register RTC callbacks
const registerRtcCallbacks = (peer: PeerState) => {
    peer.connection.onconnectionstatechange = () => {
        const connection_state = peer.connection.connectionState;
        console.log(`The connection state is now ${connection_state}`);
        setConnectionState(connection_state);
        addNotification('info', `Connection state: ${connection_state}`);
    };

    peer.connection.ondatachannel = ({ channel }) => {
        const label = channel.label;
        console.log(`Data channel added for ${label}`);

        if (label.startsWith('filter-')) {
            const peerVideo = document.querySelector('#peer');
            if (peerVideo) {
                peerVideo.className = label;
            }
            channel.onopen = () => {
                channel.close();
            };
        }

        if (label.startsWith('image-')) {
            receiveFile(channel);
        }
    };

    peer.connection.onnegotiationneeded = async () => {
        $self.current.isMakingOffer = true;
        console.log('Attempting to make an offer...');
        await peer.connection.setLocalDescription();
        socketRef.current?.emit('signal', { description: peer.connection.localDescription });
        $self.current.isMakingOffer = false;
    };

    peer.connection.onicecandidate = ({ candidate }) => {
        console.log('Attempting to handle an ICE candidate...');
        socketRef.current?.emit('signal', { candidate });
    };

    peer.connection.ontrack = ({ track }) => {
        console.log(`Handle incoming ${track.kind} track...`);
        addNotification('info', `Received peer ${track.kind} stream`);
        peer.mediaTracks[track.kind] = track;
        peer.mediaStream.addTrack(track);

        if (peerVideoRef.current) {
            peerVideoRef.current.srcObject = peer.mediaStream;
        }
    };
};

// Establish call features
const establishCallFeatures = (peer: PeerState) => {
    registerRtcCallbacks(peer);
    addFeaturesChannel(peer);
    addChatChannel(peer);
    addStreamingMedia(peer);
};

// Reset peer connection
const resetPeer = (peer: PeerState) => {
    if (peerVideoRef.current) {
        peerVideoRef.current.srcObject = null;
    }

    document.querySelector('#mic-status')?.setAttribute('aria-hidden', 'true');

    peer.connection.close();
    // Fix: Use undefined instead of null for RTCConfiguration
    peer.connection = new RTCPeerConnection($self.current.rtcConfig || undefined);
    peer.mediaStream = new MediaStream();
    peer.mediaTracks = {};
    peer.features = {};
};

// Handle signal
const handleSignal = async ({ description, candidate }: { description?: RTCSessionDescription, candidate?: RTCIceCandidate }) => {
    if (description) {
        const ready_for_offer =
            !$self.current.isMakingOffer &&
            ($peer.current.connection.signalingState === 'stable' ||
                $self.current.isSettingRemoteAnswerPending);

        const offer_collision = description.type === 'offer' && !ready_for_offer;

        $self.current.isIgnoringOffer = !$self.current.isPolite && offer_collision;

        if ($self.current.isIgnoringOffer) {
            return;
        }

        $self.current.isSettingRemoteAnswerPending = description.type === 'answer';
        await $peer.current.connection.setRemoteDescription(description);
        $self.current.isSettingRemoteAnswerPending = false;

        if (description.type === 'offer') {
            await $peer.current.connection.setLocalDescription();
            socketRef.current?.emit('signal', { description: $peer.current.connection.localDescription });
        }
    } else if (candidate) {
        try {
            await $peer.current.connection.addIceCandidate(candidate);
        } catch (e) {
            if (!$self.current.isIgnoringOffer && candidate.candidate.length > 1) {
                console.error('Unable to add ICE candidate for peer:', e);
                addNotification('error', 'Connection issue: Failed to add ICE candidate');
            }
        }
    }
};

// Register socket callbacks
const registerSocketCallbacks = () => {
    if (!socketRef.current) return;

    socketRef.current.on('connect', () => {
        console.log('Successfully connected to the signaling server!');
        addNotification('success', 'Connected to signaling server');
        establishCallFeatures($peer.current);
    });

    socketRef.current.on('connected peer', () => {
        $self.current.isPolite = true;
        addNotification('success', 'Peer connected to call');
    });

    socketRef.current.on('disconnected peer', () => {
        addNotification('warning', 'Peer disconnected from call');
        resetPeer($peer.current);
        establishCallFeatures($peer.current);
    });

    socketRef.current.on('signal', async ({ description, candidate }) => {
        await handleSignal({ description, candidate });
    });

    socketRef.current.on('connect_error', (error) => {
        console.error('Socket connection error:', error);
        addNotification('error', 'Failed to connect to server');
    });
};

// Handle call button click
const handleCallButton = () => {
    if (!inCall) {
        console.log('Joining the call...');
        joinCall();
        setInCall(true);
        addNotification('info', 'Joining call...');
    } else {
        console.log('Leaving the call...');
        leaveCall();
        setInCall(false);
        addNotification('info', 'Left the call');
    }
};

// Join call function
const joinCall = () => {
    // Use the GitHub Codespace URL with port 3001
    const serverUrl = "https://verbose-couscous-g476v6r9pp5wcwx5x-3001.app.github.dev";

    socketRef.current = io(`${serverUrl}/${namespace}`, {
        path: '/api/socket',
        autoConnect: true,
        transports: ['websocket'], // Force WebSocket transport
    });

    registerSocketCallbacks();
};

// Leave call function
const leaveCall = () => {
    $self.current.isPolite = false;
    if (socketRef.current) {
        socketRef.current.close();
    }
    resetPeer($peer.current);
};

// Handle self video click (for filters)
const handleSelfVideo = () => {
    if ($peer.current.connection.connectionState !== 'connected') return;
    // Fix: Check if filters exist before accessing
    const filter = `filter-${$self.current.filters?.cycleFilter() || 'none'}`;
    const filter_channel = $peer.current.connection.createDataChannel(filter);
    filter_channel.onclose = () => {
        console.log(`Remote peer has closed the ${filter} data channel`);
    };

    // Apply the filter to self video
    if (selfVideoRef.current) {
        selfVideoRef.current.className = filter;
    }
    
    addNotification('info', `Applied ${filter.replace('filter-', '')} filter`);
};

// Handle message form submission
const handleMessageForm = (event: React.FormEvent) => {
    event.preventDefault();
    if (!chatInputRef.current) return;

    const message: Message = {
        text: chatInputRef.current.value,
        timestamp: Date.now(),
    };

    if (message.text === '') return;

    appendMessage('self', message);
    sendOrQueueMessage($peer.current, message);

    chatInputRef.current.value = '';
};

// Handle image button click
const handleImageButton = () => {
    if (!fileInputRef.current) return;
    
    fileInputRef.current.click();
};

// Handle image input change
const handleImageInput = (event: React.ChangeEvent<HTMLInputElement>) => {
    event.preventDefault();
    const image = event.target.files?.[0];

    if (!image) return;

    const metadata = {
        kind: 'image',
        name: image.name,
        size: image.size,
        timestamp: Date.now(),
        type: image.type,
    };

    // Fix: Add required timestamp property to the payload
    const payload: Message = {
        metadata,
        file: image,
        timestamp: metadata.timestamp
    };

    appendMessage('self', metadata, image);
    addNotification('info', `Sending image: ${image.name}`);

    // Send or queue the file
    sendOrQueueMessage($peer.current, payload);
    
    // Reset the file input
    if (fileInputRef.current) {
        fileInputRef.current.value = '';
    }
};

// Copy room link to clipboard
const copyRoomLink = () => {
    const url = window.location.href;
    navigator.clipboard.writeText(url)
        .then(() => {
            addNotification('success', 'Room link copied to clipboard');
        })
        .catch(() => {
            addNotification('error', 'Failed to copy room link');
        });
};

// Render the component
return (
    <div className="webrtc-container">
        <header className="k-header k-hstack k-justify-content-between k-align-items-center p-3">
            <h1 className="k-h1">Room #{namespace}</h1>
            <div className="k-hstack gap-2">
                <Button
                    className="k-button-md"
                    icon="link"
                    onClick={copyRoomLink}
                    title="Copy room link"
                >
                    Share
                </Button>
                <Button
                    className="k-button-md"
                    // primary={!inCall}
                    // look={inCall ? "outline" : "solid"}
                    onClick={handleCallButton}
                    icon={inCall ? "close-circle" : "phone"}
                >
                    {inCall ? "Leave Call" : "Join Call"}
                </Button>
            </div>
        </header>

        <main className={`k-vstack gap-4 p-3 ${connectionState}`}>
            <div className="k-flex-row k-responsive-container">
                <div className="k-flex-col video-container k-m-2 k-shadow">
                    <div className="k-card k-rounded-md">
                        <div className="k-card-header">
                            <h2 className="k-card-title">Your Video</h2>
                        </div>
                        <div className="k-card-body p-0 position-relative">
                            <video
                                id="self"
                                ref={selfVideoRef}
                                autoPlay
                                playsInline
                                muted
                                onClick={handleSelfVideo}
                                className="k-rounded-md k-width-100"
                            />
                            {!cameraEnabled && (
                                <div className="camera-off-overlay k-p-4 k-text-center">
                                    <span className="k-icon k-i-video-camera-slash k-font-size-xl"></span>
                                    <p>Camera is off</p>
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                <div className="k-flex-col video-container k-m-2 k-shadow">
                        <div className="k-card k-rounded-md">
                            <div className="k-card-header">
                                <h2 className="k-card-title">Peer Video</h2>
                            </div>
                            <div className="k-card-body p-0 position-relative">
                                <video
                                    id="peer"
                                    ref={peerVideoRef}
                                    autoPlay
                                    playsInline
                                    className="k-rounded-md k-width-100"
                                />
                                <div 
                                    id="mic-status" 
                                    aria-hidden="true" 
                                    className="k-badge k-badge-solid k-badge-md k-badge-primary k-position-absolute k-top-0 k-end-0 k-m-2"
                                >
                                    <span className="k-icon k-i-microphone"></span>
                                </div>
                                {connectionState !== 'connected' && (
                                    <div className="peer-waiting-overlay k-p-4 k-text-center">
                                        <span className="k-icon k-i-user-circle k-font-size-xl"></span>
                                        <p>Waiting for peer to connect...</p>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>

                <div className="k-card k-rounded-md k-shadow">
                    <div className="k-card-header">
                        <h2 className="k-card-title">Chat</h2>
                    </div>
                    <div className="k-card-body p-2">
                        <ul id="chat-log" ref={chatLogRef} className="k-chat-list k-mb-4"></ul>
                        <form id="chat-form" onSubmit={handleMessageForm} className="k-form k-form-horizontal">
                            <div className="k-form-field k-display-flex k-gap-2">
                                <Input
                                    id="chat-msg"
                                    ref={chatInputRef}
                                    placeholder="Type a message..."
                                    className="k-input k-input-md k-rounded-md k-width-100"
                                    disabled={!inCall || connectionState !== 'connected'}
                                />
                                <Button
                                    type="submit"
                                    // primary
                                    icon="send"
                                    className="k-button-md"
                                    disabled={!inCall || connectionState !== 'connected'}
                                >
                                    Send
                                </Button>
                                <Button
                                    id="chat-img-btn"
                                    type="button"
                                    icon="image"
                                    className="k-button-md"
                                    onClick={handleImageButton}
                                    disabled={!inCall || connectionState !== 'connected'}
                                >
                                    Image
                                </Button>
                                <input
                                    type="file"
                                    ref={fileInputRef}
                                    className="k-hidden"
                                    accept=".gif, .jpg, .jpeg, .png"
                                    onChange={handleImageInput}
                                />
                            </div>
                        </form>
                    </div>
                </div>
            </main>

            <footer className="k-footer k-hstack k-justify-content-center k-gap-4 k-p-3">
                <Button
                    id="toggle-mic"
                    icon={micEnabled ? "microphone" : "microphone-mute"}
                    rounded="full"
                    size="large"
                    themeColor={micEnabled ? "primary" : "base"}
                    fillMode={micEnabled ? "solid" : "flat"}
                    onClick={toggleMic}
                    disabled={!inCall}
                    title={micEnabled ? "Mute microphone" : "Unmute microphone"}
                />
                <Button
                    id="toggle-cam"
                    icon={cameraEnabled ? "video-camera" : "video-camera-slash"}
                    rounded="full"
                    size="large"
                    themeColor={cameraEnabled ? "primary" : "base"}
                    fillMode={cameraEnabled ? "solid" : "flat"}
                    onClick={toggleCam}
                    disabled={!inCall}
                    title={cameraEnabled ? "Turn off camera" : "Turn on camera"}
                />
                <Button
                    id="apply-filter"
                    icon="filter"
                    rounded="full"
                    size="large"
                    onClick={handleSelfVideo}
                    disabled={!inCall || connectionState !== 'connected'}
                    title="Apply video filter"
                />
            </footer>

            <NotificationGroup
                className="k-notification-container k-position-fixed k-bottom-0 k-end-0 k-p-4"
                style={{ zIndex: 9999 }}
            >
                {notifications.map((notification) => (
                    notification.visible && (
                        <Notification
                            key={notification.id}
                            type={{ style: notification.type, icon: true }}
                            closable={true}
                            onClose={() => {
                                setNotifications(prev => 
                                    prev.map(n => n.id === notification.id ? {...n, visible: false} : n)
                                );
                            }}
                        >
                            <span>{notification.message}</span>
                        </Notification>
                    )
                ))}
            </NotificationGroup>
            
            {/* Custom CSS for the component */}
            <style jsx>{`
                .webrtc-container {
                    display: flex;
                    flex-direction: column;
                    height: 100vh;
                }
                
                main {
                    flex: 1;
                    overflow-y: auto;
                }
                
                .video-container {
                    flex: 1;
                    min-width: 300px;
                }
                
                video {
                    width: 100%;
                    height: auto;
                    background-color: #000;
                    object-fit: cover;
                }
                
                .camera-off-overlay, .peer-waiting-overlay {
                    position: absolute;
                    top: 0;
                    left: 0;
                    right: 0;
                    bottom: 0;
                    display: flex;
                    flex-direction: column;
                    justify-content: center;
                    align-items: center;
                    background-color: rgba(0, 0, 0, 0.7);
                    color: white;
                    border-radius: 4px;
                }
                
                #chat-log {
                    min-height: 200px;
                    max-height: 300px;
                    overflow-y: auto;
                    padding: 0;
                    margin: 0;
                    list-style: none;
                }
                
                #chat-log li {
                    margin-bottom: 8px;
                    padding: 8px 12px;
                    border-radius: 8px;
                    max-width: 75%;
                    word-break: break-word;
                }
                
                #chat-log li.self {
                    background-color: #ff6358;
                    color: white;
                    align-self: flex-end;
                    margin-left: auto;
                }
                
                #chat-log li.peer {
                    background-color: #f5f5f5;
                    color: #333;
                    align-self: flex-start;
                    margin-right: auto;
                }
                
                #chat-log li.img {
                    padding: 4px;
                }
                
                #chat-log li.img img {
                    max-width: 100%;
                    border-radius: 4px;
                }
                
                /* Video filter classes */
                video.filter-grayscale {
                    filter: grayscale(100%);
                }
                
                video.filter-sepia {
                    filter: sepia(100%);
                }
                
                video.filter-noir {
                    filter: grayscale(100%) contrast(160%);
                }
                
                video.filter-psychedelic {
                    filter: saturate(200%) hue-rotate(45deg);
                }
                
                /* Connection state styles */
                main.connected {
                    background-color: rgba(0, 128, 0, 0.05);
                }
                
                main.disconnected {
                    background-color: rgba(255, 0, 0, 0.05);
                }
                
                main.connecting {
                    background-color: rgba(255, 165, 0, 0.05);
                }
                
                .k-notification-container {
                    max-width: 400px;
                }
                
                /* Responsive design */
                @media (max-width: 768px) {
                    .k-responsive-container {
                        flex-direction: column;
                    }
                    
                    #chat-log li {
                        max-width: 90%;
                    }
                }
            `}</style>
        </div>
    );
}