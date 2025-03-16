"use client";

import * as React from 'react';
import { Button } from '@progress/kendo-react-buttons';
import { AppBar, AppBarSection, AppBarSpacer } from '@progress/kendo-react-layout';
import { menuIcon } from '@progress/kendo-svg-icons';
import { Popup } from '@progress/kendo-react-popup';

const AppHeader = () => {
    const [show, setShow] = React.useState(false);
    const anchor = React.useRef<HTMLDivElement>(null);

    const handleClick = () => {
        setShow(!show);
    };
    return (
        <React.Fragment>
            <AppBar themeColor="primary">
                <AppBarSection className="title">
                    <h1 className="title">Dojo</h1>
                </AppBarSection>
            </AppBar>
            <style>{`
            
            .title {
                font-size: 18px;
                margin: 0;
            }
           
            `}</style>
        </React.Fragment>
    );
};

export default AppHeader;
