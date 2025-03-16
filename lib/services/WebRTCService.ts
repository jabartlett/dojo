// services/WebRTCService.ts
import { io, Socket } from 'socket.io-client';
import { SelfState, PeerState, Message, VideoFX } from '../types';

export class WebRTCService {
    private socket: Socket | null = null;
    private selfState: SelfState;
    private peerState: PeerState;
    private namespace: string;
    private chatLogElement: HTMLUListElement | null = null;

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

    joinCall(): void {
        const serverUrl = "https://verbose-couscous-g476v6r9pp5wcwx5x-3001.app.github.dev";

        this.socket = io(`${serverUrl}/${this.namespace}`, {
            path: '/api/socket',
            autoConnect: true,
            transports: ['websocket'], // Force WebSocket transport
        });

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

    sendTextMessage(text: string): void {
        const message: Message = {
            text: text,
            timestamp: Date.now(),
        };

        this.appendMessage('self', message);
        this.sendOrQueueMessage(message);
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

    // services/WebRTCService.ts (continued)
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
                // Prepare a response and append an incoming message
                const response = {
                    id: message.timestamp,
                    timestamp: Date.now(),
                };
                this.sendOrQueueMessage(response);
                this.appendMessage('peer', message);
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

    private appendMessage(sender: 'self' | 'peer', message: any, image?: Blob): void {
        if (!this.chatLogElement) return;

        const li = document.createElement('li');
        li.className = sender;
        li.innerText = message.text || '';
        li.dataset.timestamp = message.timestamp.toString();

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
        const featuresToShare: Record<string, any> = {};
        if (!this.peerState.featuresChannel) return;

        features.forEach(f => {
            featuresToShare[f] = this.selfState.features[f];
        });

        try {
            this.peerState.featuresChannel.send(JSON.stringify(featuresToShare));
        } catch (e) {
            console.error('Error sending features:', e);
        }
    }

    isPeerMicActive(): boolean {
        return !!this.peerState.features.audio;
    }
}