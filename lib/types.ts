// types.ts - Shared types
export interface Message {
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
    isLLM?: boolean;
    isSystem?: boolean;
}

export interface Features {
    audio: boolean;
    video: boolean;
    binaryType?: string;
    [key: string]: any;
}

export type SelfState = {
    rtcConfig: RTCConfiguration | null;
    isPolite: boolean;
    isMakingOffer: boolean;
    isIgnoringOffer: boolean;
    isSettingRemoteAnswerPending: boolean;
    mediaConstraints: { audio: boolean; video: boolean };
    mediaStream: MediaStream;
    mediaTracks: Record<string, MediaStreamTrack>;
    features: Features;
    messageQueue: Message[];
    filters?: VideoFX;
};

export type PeerState = {
    connection: RTCPeerConnection;
    mediaStream: MediaStream;
    mediaTracks: Record<string, MediaStreamTrack>;
    features: Record<string, unknown>;
    featuresChannel?: RTCDataChannel;
    chatChannel?: RTCDataChannel;
};

export class VideoFX {
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