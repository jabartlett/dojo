// components/MediaControls.tsx
import React from 'react';
import { Switch } from '@progress/kendo-react-inputs';
import { Card, CardBody } from '@progress/kendo-react-layout';

interface MediaControlsProps {
    audioEnabled: boolean;
    videoEnabled: boolean;
    onToggleMic: () => void;
    onToggleCam: () => void;
}

export const MediaControls: React.FC<MediaControlsProps> = ({
    audioEnabled,
    videoEnabled,
    onToggleMic,
    onToggleCam
}) => {
    return (
        <Card className="media-controls-container" style={{ margin: '0 10px'}}>
            <CardBody>
                <div className="k-flex k-flex-row k-justify-content-center k-gap-4" style={{display: 'flex', justifyContent: 'center'}}>
                    <div className="k-flex k-flex-row k-align-items-center k-gap-2">
                        <Switch
                            size = "small"
                            aria-label="Microphone"
                            checked={audioEnabled}
                            onChange={onToggleMic}
                        />
                        <span style={{marginLeft: '5px'}}>Mic</span>
                    </div>
                    <div className="k-flex k-flex-row k-align-items-center k-gap-2">
                        <Switch
                            size = "small"
                            aria-label="Camera"
                            checked={videoEnabled}
                            onChange={onToggleCam}
                        />
                        <span style={{marginLeft: '5px'}}>Cam</span>
                    </div>
                </div>
            </CardBody>
        </Card>
    );
};