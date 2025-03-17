// components/VideoStreams.tsx
import React from 'react';

interface VideoStreamsProps {
    selfVideoRef: React.RefObject<HTMLVideoElement>;
    peerVideoRef: React.RefObject<HTMLVideoElement>;
    onSelfVideoClick: () => void;
    peerHasMic: boolean;
}

export const VideoStreams: React.FC<VideoStreamsProps> = ({
    selfVideoRef,
    peerVideoRef,
    onSelfVideoClick,
    peerHasMic
}) => {
    return (
        <div className="video-container" style={{ position: 'relative' }}>
            <video
                id="peer"
                ref={peerVideoRef}
                autoPlay
                playsInline
                style={{ width: '100%', height: 'auto' }}
            />
            <video
                id="self"
                ref={selfVideoRef}
                autoPlay
                playsInline
                muted
                onClick={onSelfVideoClick}
                style={{ 
                    width: '100%',
                    height: 'auto',
                    // position: 'absolute', 
                    // top: 0, 
                    // left: 0, 
                    // width: '20%', 
                    // height: 'auto',
                    // zIndex: 10
                }}
            />
            <div 
                id="mic-status" 
                aria-hidden={!peerHasMic} 
                style={{ 
                    position: 'absolute', 
                    bottom: '10px', 
                    right: '10px', 
                    backgroundColor: 'rgba(0,0,0,0.5)', 
                    color: 'white', 
                    padding: '5px', 
                    borderRadius: '50%',
                    display: peerHasMic ? 'block' : 'none'
                }}
            >
                🎤
            </div>
        </div>
    );
};