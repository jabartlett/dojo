// types/next.ts
import { Server as NetServer } from 'http';
import { NextApiResponse } from 'next';
import { Socket, Server as SocketIOServer } from 'socket.io'; // Import the correct type


export type NextApiResponseServerIO = NextApiResponse & {
  socket: Socket & {
    server: NetServer & {
      io: SocketIOServer;
    };
  };
};

// types/webrtc.ts
export interface SelfState {
  rtcConfig: RTCConfiguration | null;
  isPolite: boolean;
  isMakingOffer: boolean;
  isIgnoringOffer: boolean;
  isSettingRemoteAnswerPending: boolean;
  mediaConstraints: MediaStreamConstraints;
  mediaStream: MediaStream;
  mediaTracks: Record<string, MediaStreamTrack>;
  features: {
    audio: boolean;
    video?: boolean;
    binaryType?: string;
  };
  filters?: any;
  messageQueue: any[];
}

export interface PeerState {
  connection: RTCPeerConnection;
  mediaStream: MediaStream;
  mediaTracks: Record<string, MediaStreamTrack>;
  features: Record<string, any>;
  chatChannel?: RTCDataChannel;
  featuresChannel?: RTCDataChannel;
}

export interface Message {
  text?: string;
  timestamp: number;
  id?: number;
  file?: File;
  metadata?: {
    kind: string;
    name: string;
    size: number;
    timestamp: number;
    type: string;
  };
}