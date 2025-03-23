"use client";

import * as React from 'react';
import { Button } from '@progress/kendo-react-buttons';
import { AppBar, AppBarSection, AppBarSpacer, Avatar } from '@progress/kendo-react-layout';
import { SvgIcon } from '@progress/kendo-react-common';
import { menuIcon, checkIcon } from '@progress/kendo-svg-icons';
import { Badge, BadgeContainer } from '@progress/kendo-react-indicators';
import { Popup } from '@progress/kendo-react-popup';

const AppHeader = () => {
    const [show, setShow] = React.useState(false);
    const [isOnline, setIsOnline] = React.useState(true);
    const anchor = React.useRef<HTMLDivElement>(null);

    // Monitor online status
    React.useEffect(() => {
        const handleOnline = () => setIsOnline(true);
        const handleOffline = () => setIsOnline(false);
        
        window.addEventListener('online', handleOnline);
        window.addEventListener('offline', handleOffline);
        
        return () => {
            window.removeEventListener('online', handleOnline);
            window.removeEventListener('offline', handleOffline);
        };
    }, []);

    const handleClick = () => {
        setShow(!show);
    };
    
    return (
        <React.Fragment>
            <AppBar themeColor="primary">
                <AppBarSection className="title">
                    <h1 className="title">Dojo</h1>
                </AppBarSection>
                
                <AppBarSpacer />
                
                <AppBarSection>
                    <BadgeContainer>
                        <Avatar type="image" style={{ cursor: 'pointer' }}>
                            <img 
                                src="https://randomuser.me/api/portraits/men/1.jpg" 
                                alt="User Avatar" 
                            />
                        </Avatar>
                        {isOnline && (
                            <Badge
                                size="small"
                                align={{ vertical: 'bottom', horizontal: 'end' }}
                                themeColor="success"
                                cutoutBorder={true}
                                rounded={'full'}
                            >
                                <SvgIcon icon={checkIcon} size={'xsmall'} />
                            </Badge>
                        )}
                    </BadgeContainer>
                </AppBarSection>
            </AppBar>
            <style>{`
            .title {
                font-size: 18px;
                margin: 0;
            }
            .k-badge .k-svg-icon {
                color: white;
            }
            .k-avatar {
                margin-right: 10px;
            }
            `}</style>
        </React.Fragment>
    );
};

export default AppHeader;