// components/WebRTCClient.tsx
'use client';

import React, { useEffect, useRef, useState } from 'react';
import { io, Socket } from 'socket.io-client';

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

    const [inCall, setInCall] = useState(false);
    const [namespace, setNamespace] = useState('');

    // Initialize self and peer states
    const $self = useRef<SelfState>({
        rtcConfig: null,
        isPolite: false,
        isMakingOffer: false,
        isIgnoringOffer: false,
        isSettingRemoteAnswerPending: false,
        mediaConstraints: { audio: true, video: true },
        mediaStream: new MediaStream(),
        mediaTracks: {},
        features: {
            audio: false,
            video: true,
        },
        messageQueue: [],
    });

    const $peer = useRef<PeerState>({
        connection: new RTCPeerConnection($self.current.rtcConfig || undefined),
        mediaStream: new MediaStream(),
        mediaTracks: {},
        features: {},
    });

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
                return ns;
            }
            ns = Math.random().toString().substring(2, 9);
            console.log('Created new namespace', ns);
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

                // Hold onto audio and video track references
                $self.current.mediaTracks.audio = media.getAudioTracks()[0];
                $self.current.mediaTracks.video = media.getVideoTracks()[0];

                // Mute the audio if `$self.features.audio` evaluates to `false`
                $self.current.mediaTracks.audio.enabled = !!$self.current.features.audio;

                // Add audio and video tracks to mediaStream
                $self.current.mediaStream.addTrack($self.current.mediaTracks.audio);
                $self.current.mediaStream.addTrack($self.current.mediaTracks.video);

                // Display the stream
                if (selfVideoRef.current) {
                    selfVideoRef.current.srcObject = $self.current.mediaStream;
                }
            } catch (err) {
                console.error('Error accessing media devices:', err);
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
            // No need to queue; contents of `$self.features` will send
            // as soon as the features channel opens
        }
    };

    // Toggle microphone
    const toggleMic = () => {
        const audio = $self.current.mediaTracks.audio;
        const enabled_state = audio.enabled = !audio.enabled;

        $self.current.features.audio = enabled_state;

        const button = document.querySelector('#toggle-mic');
        button?.setAttribute('aria-checked', enabled_state ? 'true' : 'false');

        shareFeatures('audio');
    };

    // Toggle camera
    const toggleCam = () => {
        const video = $self.current.mediaTracks.video;
        const enabled_state = video.enabled = !video.enabled;

        $self.current.features.video = enabled_state;

        const button = document.querySelector('#toggle-cam');
        button?.setAttribute('aria-checked', enabled_state ? 'true' : 'false');

        shareFeatures('video');

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
        };

        peer.chatChannel.onopen = () => {
            console.log('Chat channel opened.');
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
            document.querySelector('body')?.setAttribute('class', connection_state);
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
                }
            }
        }
    };

    // Register socket callbacks
    const registerSocketCallbacks = () => {
        if (!socketRef.current) return;

        socketRef.current.on('connect', () => {
            console.log('Successfully connected to the signaling server!');
            establishCallFeatures($peer.current);
        });

        socketRef.current.on('connected peer', () => {
            $self.current.isPolite = true;
        });

        socketRef.current.on('disconnected peer', () => {
            resetPeer($peer.current);
            establishCallFeatures($peer.current);
        });

        socketRef.current.on('signal', async ({ description, candidate }) => {
            await handleSignal({ description, candidate });
        });
    };

    // Handle call button click
    const handleCallButton = () => {
        if (!inCall) {
            console.log('Joining the call...');
            joinCall();
            setInCall(true);
        } else {
            console.log('Leaving the call...');
            leaveCall();
            setInCall(false);
        }
    };

    // Join call function
    const joinCall = () => {
        socketRef.current = io(`/${namespace}`, {
            path: '/api/socket',
            autoConnect: true,
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
        let input = document.querySelector('input.temp') as HTMLInputElement;
        input = input || document.createElement('input');
        input.className = 'temp';
        input.type = 'file';
        input.accept = '.gif, .jpg, .jpeg, .png';
        input.setAttribute('aria-hidden', 'true');

        // Safari/iOS requires appending the file input to the DOM
        document.querySelector('#chat-form')?.appendChild(input);

        input.addEventListener('change', handleImageInput);
        input.click();
    };

    // Handle image input change
    const handleImageInput = (event: Event) => {
        event.preventDefault();
        const target = event.target as HTMLInputElement;
        const image = target.files?.[0];

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

        // Remove appended file input element
        target.remove();

        // Send or queue the file
        sendOrQueueMessage($peer.current, payload);
    };

    // Handle media buttons
    const handleMediaButtons = (event: React.MouseEvent) => {
        const target = event.target as HTMLElement;
        if (target.tagName !== 'BUTTON') return;

        switch (target.id) {
            case 'toggle-mic':
                toggleMic();
                break;
            case 'toggle-cam':
                toggleCam();
                break;
        }
    };

    // Render the component
    return (
        <div className="webrtc-container">
            <header id="header">
                <h1>Welcome to Room #{namespace}</h1>
                <button
                    id="call-button"
                    className={inCall ? "leave" : "join"}
                    onClick={handleCallButton}
                >
                    {inCall ? "Leave Call" : "Join Call"}
                </button>
            </header>

            <main>
                <div className="video-container">
                    <video
                        id="self"
                        ref={selfVideoRef}
                        autoPlay
                        playsInline
                        muted
                        onClick={handleSelfVideo}
                    />
                    <video
                        id="peer"
                        ref={peerVideoRef}
                        autoPlay
                        playsInline
                    />
                    <div id="mic-status" aria-hidden="true">🎤</div>
                </div>

                <div className="chat-container">
                    <ul id="chat-log" ref={chatLogRef}></ul>
                    <form id="chat-form" onSubmit={handleMessageForm}>
                        <input
                            id="chat-msg"
                            ref={chatInputRef}
                            type="text"
                            placeholder="Type a message..."
                        />
                        <button type="submit">Send</button>
                        <button
                            id="chat-img-btn"
                            type="button"
                            onClick={handleImageButton}
                        >
                            📷
                        </button>
                    </form>
                </div>
            </main>

            <footer id="footer" onClick={handleMediaButtons}>
                <button
                    id="toggle-mic"
                    aria-checked={$self.current.features.audio}
                >
                    🎤
                </button>
                <button
                    id="toggle-cam"
                    aria-checked={$self.current.features.video}
                >
                    📹
                </button>
            </footer>
        </div>
    )};