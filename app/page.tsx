"use client";

import * as React from 'react';
import Image from "next/image";
import { Notification, NotificationGroup } from '@progress/kendo-react-notification';
import { Fade } from '@progress/kendo-react-animation';
import { Button } from '@progress/kendo-react-buttons';
import '@progress/kendo-theme-default/dist/all.css';

interface NotificationState {
  success: boolean,
  error: boolean,
  warning: boolean,
  info: boolean,
  none: boolean
}

export default function Home() {
  const [notificationState, setNotificationState] = React.useState<NotificationState>({ success: false, error: false, warning: false, info: false, none: false });

  type NotificationKeys = keyof NotificationState;

  const onToggle = (flag: NotificationKeys) => setNotificationState({ 
    ...notificationState, 
    [flag]: !notificationState[flag] 
  });
  
  const { success, error, warning, info, none } = notificationState;
  return (
    <div>
      <h1>Kendo WebRTC</h1>
      <Button
        type="button"
        onClick={() => onToggle('success')}
      >
        {(success ? 'hide ' : 'show ') + 'Success'}
      </Button>
      &nbsp;
      <Button
        type="button"
        onClick={() => onToggle('error')}
      >
        {(error ? 'hide ' : 'show ') + 'Error'}
      </Button>
      &nbsp;
      <Button
        type="button"
        onClick={() => onToggle('warning')}
      >
        {(warning ? 'hide ' : 'show ') + 'Warning'}
      </Button>
      &nbsp;
      <Button
        type="button"
        onClick={() => onToggle('info')}
      >
        {(info ? 'hide ' : 'show ') + 'Info'}
      </Button>
      &nbsp;
      <Button
        type="button"
        onClick={() => onToggle('none')}
      >
        {(none ? 'hide ' : 'show ') + 'Unstyled'}
      </Button>
      <NotificationGroup
        style={{
          right: 0,
          bottom: 0,
          alignItems: 'flex-start',
          flexWrap: 'wrap-reverse'
        }}
      >
        <Fade>
          {success && <Notification
            type={{ style: 'success', icon: true }}
            closable={true}
            onClose={() => setNotificationState({ ...notificationState, success: false })}
          >
            <span>Your data has been saved.</span>
          </Notification>}
        </Fade>
        <Fade>
          {error && <Notification
            type={{ style: 'error', icon: true }}
            closable={true}
            onClose={() => setNotificationState({ ...notificationState, error: false })}
          >
            <span>Oops! Something went wrong ...</span>
          </Notification>}
        </Fade>
        <Fade>
          {warning && <Notification
            type={{ style: 'warning', icon: true }}
            closable={true}
            onClose={() => setNotificationState({ ...notificationState, warning: false })}
          >
            <span>Your password will expire in 2 days!</span>
          </Notification>}
        </Fade>
        <Fade>
          {info && <Notification
            type={{ style: 'info', icon: true }}
            closable={true}
            onClose={() => setNotificationState({ ...notificationState, info: false })}
          >
            <span>You have 1 new message!</span>
          </Notification>}
        </Fade>
        <Fade>
          {none && <Notification
            type={{ style: 'none', icon: false }}
            closable={true}
            onClose={() => setNotificationState({ ...notificationState, none: false })}
            style={{ overflow: 'visible' }}
          >
            <span>Hanna Moos likes your status.</span>
          </Notification>}
        </Fade>
      </NotificationGroup>

    </div>
  );
}
