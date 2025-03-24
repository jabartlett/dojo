import { io, Socket } from 'socket.io-client';
import { SelfState, PeerState, Message, VideoFX } from '../types';

interface LLMResponse {
    response: string;
    metadata?: {
        timestamp: string;
        model: string;
    };
}

export class WebRTCService {
    private socket: Socket | null = null;
    private selfState: SelfState;
    private peerState: PeerState;
    private namespace: string;
    private chatLogElement: HTMLUListElement | null = null;
    // Add chat history for LLM context
    private chatHistory: Array<{ role: 'user' | 'assistant', content: string }> = [];
    // Track if we're waiting for an AI response
    private isWaitingForAI: boolean = false;
    // Audio recorder
    private mediaRecorder: MediaRecorder | null = null;
    private audioChunks: Blob[] = [];

    constructor(namespace: string) {
        this.namespace = namespace;

        // Initialize self state
        this.selfState = {
            rtcConfig: null,
            isPolite: false,
            isMakingOffer: false,
            isIgnoringOffer: false,
            isSettingRemoteAnswerPending: false,
            mediaConstraints: { audio: true, video: true },
            mediaStream: typeof window !== 'undefined' ? new MediaStream() : ({} as MediaStream),
            mediaTracks: {},
            features: {
                audio: false,
                video: true,
            },
            messageQueue: [],
            filters: new VideoFX()
        };

        // Initialize peer state
        this.peerState = {
            connection: typeof window !== 'undefined'
                ? new RTCPeerConnection(this.selfState.rtcConfig || undefined)
                : ({} as RTCPeerConnection),
            mediaStream: typeof window !== 'undefined' ? new MediaStream() : ({} as MediaStream),
            mediaTracks: {},
            features: {},
        };
    }

    setChatLogElement(element: HTMLUListElement) {
        this.chatLogElement = element;
    }

    getSelfStream(): MediaStream {
        return this.selfState.mediaStream;
    }

    getPeerStream(): MediaStream {
        return this.peerState.mediaStream;
    }

    async requestUserMedia(): Promise<void> {
        try {
            const media = await navigator.mediaDevices.getUserMedia(this.selfState.mediaConstraints);

            // Hold onto audio and video track references
            this.selfState.mediaTracks.audio = media.getAudioTracks()[0];
            this.selfState.mediaTracks.video = media.getVideoTracks()[0];

            // Mute the audio if `selfState.features.audio` evaluates to `false`
            this.selfState.mediaTracks.audio.enabled = !!this.selfState.features.audio;

            // Add audio and video tracks to mediaStream
            this.selfState.mediaStream.addTrack(this.selfState.mediaTracks.audio);
            this.selfState.mediaStream.addTrack(this.selfState.mediaTracks.video);
        } catch (err) {
            console.error('Error accessing media devices:', err);
        }
    }

    isAudioEnabled(): boolean {
        return !!this.selfState.features.audio;
    }

    isVideoEnabled(): boolean {
        return !!this.selfState.features.video;
    }

    toggleMic(): boolean {
        const audio = this.selfState.mediaTracks.audio;
        const enabled_state = audio.enabled = !audio.enabled;
        this.selfState.features.audio = enabled_state;
        this.shareFeatures('audio');
        return enabled_state;
    }

    toggleCam(): boolean {
        const video = this.selfState.mediaTracks.video;
        const enabled_state = video.enabled = !video.enabled;
        this.selfState.features.video = enabled_state;
        this.shareFeatures('video');

        if (enabled_state) {
            this.selfState.mediaStream.addTrack(this.selfState.mediaTracks.video);
        } else {
            this.selfState.mediaStream.removeTrack(this.selfState.mediaTracks.video);
        }

        return enabled_state;
    }

    // In your WebRTCService.ts file

    joinCall(): void {
        // Use the Heroku URL without specifying a port
        const serverUrl = "https://glacial-chamber-45902-8ad625a954fa.herokuapp.com";

        // Clean the namespace - ensure it's exactly 7 digits without any special characters
        let cleanNamespace = this.namespace;

        // Remove any non-digit characters (like #)
        cleanNamespace = cleanNamespace.replace(/\D/g, '');

        // If the namespace is not 7 digits, generate a new one
        if (cleanNamespace.length !== 7) {
            cleanNamespace = Math.floor(1000000 + Math.random() * 9000000).toString();
            console.log(`Generated new 7-digit namespace: ${cleanNamespace}`);
        }

        console.log(`Connecting to Socket.IO server at: ${serverUrl}/${cleanNamespace}`);

        // Create the socket connection with the proper configuration
        this.socket = io(`${serverUrl}/${cleanNamespace}`, {
            path: '/api/socket',
            autoConnect: true,
            transports: ['websocket'],
            reconnectionAttempts: 5,
            reconnectionDelay: 1000,
            timeout: 20000
        });

        // Add error handling for debugging
        this.socket.on('connect', () => {
            console.log('Successfully connected to Socket.IO server');
        });

        this.socket.on('connect_error', (error) => {
            console.error('Socket connection error:', error);
        });

        this.socket.on('connect_timeout', () => {
            console.error('Socket connection timeout');
        });

        this.socket.on('error', (error) => {
            console.error('Socket error:', error);
        });

        // Register the rest of your socket callbacks
        this.registerSocketCallbacks();
    }

    leaveCall(): void {
        this.selfState.isPolite = false;
        if (this.socket) {
            this.socket.close();
        }
        this.resetPeer();
    }

    cycleVideoFilter(): string {
        if (!this.selfState.filters) return 'none';
        return this.selfState.filters.cycleFilter();
    }

    applyFilterToPeer(filter: string): void {
        if (this.peerState.connection.connectionState !== 'connected') return;
        const filterName = `filter-${filter}`;
        const filter_channel = this.peerState.connection.createDataChannel(filterName);

        filter_channel.onclose = () => {
            console.log(`Remote peer has closed the ${filterName} data channel`);
        };
    }

    // Original sendTextMessage method
    sendTextMessage(text: string): void {
        const message: Message = {
            text: text,
            timestamp: Date.now(),
        };

        this.appendMessage('self', message);
        this.sendOrQueueMessage(message);
    }

    // Method to send message with LLM processing
    async sendMessageWithLLM(message: string): Promise<void> {
        try {
            // Set waiting flag to prevent multiple simultaneous requests
            if (this.isWaitingForAI) {
                console.log('Already waiting for AI response, ignoring this request');
                return;
            }

            this.isWaitingForAI = true;

            // First, send the user's message as normal
            this.sendTextMessage(message);

            // Store in chat history
            this.chatHistory.push({ role: 'user', content: message });

            // Keep chat history at a reasonable size (last 10 messages)
            if (this.chatHistory.length > 10) {
                this.chatHistory = this.chatHistory.slice(-10);
            }

            // Add a "thinking" indicator
            const thinkingId = Date.now();
            const thinkingMessage: Message = {
                text: 'AI assistant is thinking...',
                timestamp: thinkingId,
                isSystem: true
            };
            this.appendMessage('system', thinkingMessage);

            // Get LLM response
            const llmResponse = await this.fetchLLMResponse(message);

            // Remove the thinking indicator
            const thinkingElement = document.querySelector(`#chat-log *[data-timestamp="${thinkingId}"]`);
            if (thinkingElement) {
                thinkingElement.remove();
            }

            // Create a message object for the LLM response
            const llmMessage: Message = {
                text: llmResponse,
                timestamp: Date.now(),
                isLLM: true  // Add a flag to identify this as an LLM response
            };

            // Display LLM response locally
            this.appendMessage('llm', llmMessage);

            // Store in chat history
            this.chatHistory.push({ role: 'assistant', content: llmResponse });

            // Send LLM response to peer
            this.sendOrQueueMessage(llmMessage);

            // Reset waiting flag
            this.isWaitingForAI = false;
        } catch (error) {
            console.error('Error sending message with LLM:', error);
            // Handle failure - display error message
            const errorMessage: Message = {
                text: 'Failed to get AI response. Please try again.',
                timestamp: Date.now(),
                isSystem: true
            };
            this.appendMessage('system', errorMessage);
            // Reset waiting flag
            this.isWaitingForAI = false;
        }
    }

    // Method to fetch response from LLM API endpoint
    private async fetchLLMResponse(message: string): Promise<string> {
        try {
            const response = await fetch('/api/chat', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    message,
                    chatHistory: this.chatHistory,
                }),
            });

            if (!response.ok) {
                throw new Error(`API error: ${response.status}`);
            }

            const data: LLMResponse = await response.json();
            return data.response;
        } catch (error) {
            console.error('Error fetching LLM response:', error);
            throw error;
        }
    }

    sendImageFile(file: File): void {
        const metadata = {
            kind: 'image',
            name: file.name,
            size: file.size,
            timestamp: Date.now(),
            type: file.type,
        };

        const payload: Message = {
            metadata,
            file: file,
            timestamp: metadata.timestamp
        };

        this.appendMessage('self', metadata, file);
        this.sendOrQueueMessage(payload);
    }

    // New method to start recording audio
    startRecording(): void {
        if (!this.selfState.mediaStream) {
            console.error('No media stream available for recording');
            return;
        }

        // Get the audio track from the existing stream
        const audioTracks = this.selfState.mediaStream.getAudioTracks();
        if (audioTracks.length === 0) {
            console.error('No audio track available in the stream');
            return;
        }

        // Create a new MediaStream with just the audio track
        const audioStream = new MediaStream([audioTracks[0]]);

        try {
            this.mediaRecorder = new MediaRecorder(audioStream);
            this.audioChunks = [];

            this.mediaRecorder.ondataavailable = (event) => {
                if (event.data.size > 0) {
                    this.audioChunks.push(event.data);
                }
            };

            this.mediaRecorder.start();
            console.log('Recording started');
        } catch (error) {
            console.error('Error starting recording:', error);
        }
    }

    // New method to stop recording and transcribe
    async stopRecording(): Promise<string> {
        return new Promise((resolve, reject) => {
            if (!this.mediaRecorder) {
                reject('No active recording');
                return;
            }

            this.mediaRecorder.onstop = async () => {
                try {
                    const audioBlob = new Blob(this.audioChunks, { type: 'audio/webm' });
                    const transcription = await this.transcribeAudio(audioBlob);
                    resolve(transcription);
                } catch (error) {
                    reject(error);
                }
            };

            this.mediaRecorder.stop();
            console.log('Recording stopped');
        });
    }

    // ... existing code ...

    private async transcribeAudio(audioBlob: Blob): Promise<string> {
        try {
            // Create a FormData object to send the audio file
            const formData = new FormData();
            formData.append('audio', audioBlob);

            // Send to our API endpoint - corrected path
            const response = await fetch('/api/transcribe', {
                method: 'POST',
                body: formData,
            });

            if (!response.ok) {
                throw new Error(`Transcription failed: ${response.status}`);
            }

            const data = await response.json();
            return data.text || '';
        } catch (error) {
            console.error('Error transcribing audio:', error);
            throw error;
        }
    }

    // Method to send transcribed audio directly to LLM
    async transcribeAndSendToLLM(): Promise<void> {
        try {
            if (!this.mediaRecorder) {
                throw new Error('No active recording');
            }

            const transcription = await this.stopRecording();
            if (transcription.trim()) {
                // If we got a transcription, send it to the LLM
                await this.sendMessageWithLLM(transcription);
            }
        } catch (error) {
            console.error('Error with transcription or sending to LLM:', error);
            throw error;
        }
    }

    // Private methods
    private registerSocketCallbacks(): void {
        if (!this.socket) return;

        this.socket.on('connect', () => {
            console.log('Successfully connected to the signaling server!');
            this.establishCallFeatures();
        });

        this.socket.on('connected peer', () => {
            this.selfState.isPolite = true;
        });

        this.socket.on('disconnected peer', () => {
            this.resetPeer();
            this.establishCallFeatures();
        });

        this.socket.on('signal', async ({ description, candidate }) => {
            await this.handleSignal({ description, candidate });
        });
    }

    private establishCallFeatures(): void {
        this.registerRtcCallbacks();
        this.addFeaturesChannel();
        this.addChatChannel();
        this.addStreamingMedia();
    }

    private registerRtcCallbacks(): void {
        this.peerState.connection.onconnectionstatechange = () => {
            const connection_state = this.peerState.connection.connectionState;
            console.log(`The connection state is now ${connection_state}`);
            document.querySelector('body')?.setAttribute('class', connection_state);
        };

        this.peerState.connection.ondatachannel = ({ channel }) => {
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
                this.receiveFile(channel);
            }
        };

        this.peerState.connection.onnegotiationneeded = async () => {
            this.selfState.isMakingOffer = true;
            console.log('Attempting to make an offer...');
            await this.peerState.connection.setLocalDescription();
            this.socket?.emit('signal', { description: this.peerState.connection.localDescription });
            this.selfState.isMakingOffer = false;
        };

        this.peerState.connection.onicecandidate = ({ candidate }) => {
            console.log('Attempting to handle an ICE candidate...');
            this.socket?.emit('signal', { candidate });
        };

        this.peerState.connection.ontrack = ({ track }) => {
            console.log(`Handle incoming ${track.kind} track...`);
            this.peerState.mediaTracks[track.kind] = track;
            this.peerState.mediaStream.addTrack(track);
        };
    }

    private addFeaturesChannel(): void {
        const featureFunctions: Record<string, () => void> = {
            audio: () => {
                const status = document.querySelector('#mic-status');
                status?.setAttribute('aria-hidden', this.peerState.features.audio ? 'true' : 'false');
            },
            video: () => {
                if (this.peerState.mediaTracks.video) {
                    if (this.peerState.features.video) {
                        this.peerState.mediaStream.addTrack(this.peerState.mediaTracks.video);
                    } else {
                        this.peerState.mediaStream.removeTrack(this.peerState.mediaTracks.video);
                    }
                }
            },
        };

        this.peerState.featuresChannel = this.peerState.connection.createDataChannel('features', {
            negotiated: true,
            id: 110,
        });

        this.peerState.featuresChannel.onopen = () => {
            console.log('Features channel opened.');
            this.selfState.features.binaryType = this.peerState.featuresChannel?.binaryType;
            // Send features information as soon as the channel opens
            this.peerState.featuresChannel?.send(JSON.stringify(this.selfState.features));
        };

        this.peerState.featuresChannel.onmessage = (event: MessageEvent) => {
            const features = JSON.parse(event.data);
            Object.keys(features).forEach(f => {
                // Update the corresponding features field on peerState
                this.peerState.features[f] = features[f];
                // If there's a corresponding function, run it
                if (typeof featureFunctions[f] === 'function') {
                    featureFunctions[f]();
                }
            });
        };
    }

    private addChatChannel(): void {
        this.peerState.chatChannel = this.peerState.connection.createDataChannel('text chat', {
            negotiated: true,
            id: 100,
        });

        this.peerState.chatChannel.onmessage = (event: MessageEvent) => {
            const message = JSON.parse(event.data);
            if (!message.id) {
                // Check if it's an LLM message
                if (message.isLLM) {
                    this.appendMessage('peer-llm', message);
                    // Add to chat history
                    this.chatHistory.push({ role: 'assistant', content: message.text });
                } else if (message.isSystem) {
                    this.appendMessage('system', message);
                } else {
                    // Regular peer message
                    this.appendMessage('peer', message);
                    // Add to chat history
                    this.chatHistory.push({ role: 'user', content: message.text });
                }

                // Prepare a response and append an incoming message
                const response = {
                    id: message.timestamp,
                    timestamp: Date.now(),
                };
                this.sendOrQueueMessage(response);
            } else {
                // Handle an incoming response
                this.handleResponse(message);
            }
        };

        this.peerState.chatChannel.onclose = () => {
            console.log('Chat channel closed.');
        };

        this.peerState.chatChannel.onopen = () => {
            console.log('Chat channel opened.');
            // Process any queued messages
            while (this.selfState.messageQueue.length > 0) {
                const message = this.selfState.messageQueue.shift();
                if (message) {
                    this.sendOrQueueMessage(message, false);
                }
            }
        };
    }

    private addStreamingMedia(): void {
        Object.values(this.selfState.mediaTracks).forEach(track => {
            this.peerState.connection.addTrack(track);
        });
    }

    private resetPeer(): void {
        this.peerState.connection.close();
        this.peerState.connection = new RTCPeerConnection(this.selfState.rtcConfig || undefined);
        this.peerState.mediaStream = new MediaStream();
        this.peerState.mediaTracks = {};
        this.peerState.features = {};
    }

    private async handleSignal({ description, candidate }: { description?: RTCSessionDescription, candidate?: RTCIceCandidate }): Promise<void> {
        if (description) {
            const ready_for_offer =
                !this.selfState.isMakingOffer &&
                (this.peerState.connection.signalingState === 'stable' ||
                    this.selfState.isSettingRemoteAnswerPending);

            const offer_collision = description.type === 'offer' && !ready_for_offer;

            this.selfState.isIgnoringOffer = !this.selfState.isPolite && offer_collision;

            if (this.selfState.isIgnoringOffer) {
                return;
            }

            this.selfState.isSettingRemoteAnswerPending = description.type === 'answer';
            await this.peerState.connection.setRemoteDescription(description);
            this.selfState.isSettingRemoteAnswerPending = false;

            if (description.type === 'offer') {
                await this.peerState.connection.setLocalDescription();
                this.socket?.emit('signal', { description: this.peerState.connection.localDescription });
            }
        } else if (candidate) {
            try {
                await this.peerState.connection.addIceCandidate(candidate);
            } catch (e) {
                if (!this.selfState.isIgnoringOffer && candidate.candidate.length > 1) {
                    console.error('Unable to add ICE candidate for peer:', e);
                }
            }
        }
    }

    private queueMessage(message: Message, push = true): void {
        if (push) {
            this.selfState.messageQueue.push(message); // Queue at the end
        } else {
            this.selfState.messageQueue.unshift(message); // Queue at the start
        }
    }

    private sendOrQueueMessage(message: Message, push = true): void {
        const chat_channel = this.peerState.chatChannel;
        if (!chat_channel || chat_channel.readyState !== 'open') {
            this.queueMessage(message, push);
            return;
        }

        if (message.file) {
            this.sendFile(message);
        } else {
            try {
                chat_channel.send(JSON.stringify(message));
            } catch (e) {
                console.error('Error sending message:', e);
                this.queueMessage(message, push);
            }
        }
    }

    private sendFile(payload: Message): void {
        if (!payload.metadata || !payload.file) return;

        const { metadata, file } = payload;
        const file_channel = this.peerState.connection.createDataChannel(`${metadata.kind}-${metadata.name}`);
        const chunk = 16 * 1024; // 16KiB chunks

        file_channel.onopen = async () => {
            if (!this.peerState.features ||
                (this.selfState.features.binaryType !== this.peerState.features.binaryType)) {
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
            this.handleResponse(JSON.parse(data));
            file_channel.close();
        };
    }

    private receiveFile(file_channel: RTCDataChannel): void {
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

                    this.appendMessage('peer', metadata, image);

                    // Send an acknowledgement
                    try {
                        file_channel.send(JSON.stringify(response));
                    } catch (e) {
                        this.queueMessage(response);
                    }
                }
            }
        };
    }

    private handleResponse(response: { id: number; timestamp: number }): void {
        const sent_item = document.querySelector(`#chat-log *[data-timestamp="${response.id}"]`);

        if (!sent_item) return;

        const classes = ['received'];
        if (response.timestamp - response.id > 1000) {
            classes.push('delayed');
        }

        sent_item.classList.add(...classes);
    }

    private appendMessage(sender: 'self' | 'peer' | 'llm' | 'peer-llm' | 'system', message: any, image?: Blob): void {
        if (!this.chatLogElement) return;

        const li = document.createElement('li');
        li.className = sender;
        li.innerText = message.text || '';
        li.dataset.timestamp = message.timestamp.toString();

        // Add specific styling for LLM responses
        if (sender === 'llm' || sender === 'peer-llm') {
            li.classList.add('ai-response');
        }

        // Add specific styling for system messages
        if (sender === 'system') {
            li.classList.add('system-message');
        }

        if (image) {
            const img = document.createElement('img');
            img.src = URL.createObjectURL(image);
            img.onload = () => {
                URL.revokeObjectURL(img.src);
                this.scrollToEnd(this.chatLogElement!);
            };
            li.innerText = ''; // undefined on images
            li.classList.add('img');
            li.appendChild(img);
        }

        this.chatLogElement.appendChild(li);
        this.scrollToEnd(this.chatLogElement);
    }

    private scrollToEnd(el: HTMLElement): void {
        if (el.scrollTo) {
            el.scrollTo({
                top: el.scrollHeight,
                behavior: 'smooth',
            });
        } else {
            el.scrollTop = el.scrollHeight;
        }
    }

    private shareFeatures(...features: string[]): void {
        const featureFunctions: Record<string, any> = {};
        if (!this.peerState.featuresChannel) return;

        features.forEach(f => {
            featureFunctions[f] = this.selfState.features[f];
        });

        try {
            this.peerState.featuresChannel.send(JSON.stringify(featureFunctions));
        } catch (e) {
            console.error('Error sending features:', e);
        }
    }

    isPeerMicActive(): boolean {
        return !!this.peerState.features.audio;
    }
}