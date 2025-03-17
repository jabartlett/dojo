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
        <Card className="media-controls-container">
            <CardBody>
                <div className="k-flex k-flex-row k-justify-content-center k-gap-4" style={{display: 'flex', justifyContent: 'center'}}>
                    <div className="k-flex k-flex-row k-align-items-center k-gap-2">
                        <Switch
                            checked={audioEnabled}
                            onChange={onToggleMic}
                        />
                        <span style={{marginLeft: '10px'}}>Mic</span>
                    </div>
                    <div className="k-flex k-flex-row k-align-items-center k-gap-2">
                        <Switch
                            checked={videoEnabled}
                            onChange={onToggleCam}
                        />
                        <span style={{marginLeft: '10px'}}>Camera</span>
                    </div>
                </div>
            </CardBody>
        </Card>
    );
};