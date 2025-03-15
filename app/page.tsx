"use client";

import * as React from 'react';
import Image from "next/image";
import { Notification, NotificationGroup } from '@progress/kendo-react-notification';
import { Fade } from '@progress/kendo-react-animation';
import { Button } from '@progress/kendo-react-buttons';
import '@progress/kendo-theme-default/dist/all.css';
import WebRTCClient from '@/components/WebRTCClient';

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
      <WebRTCClient />

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




// // app/page.tsx
// import Link from 'next/link';

// export default function Home() {
//   return (
//     <div className="container mx-auto px-4 py-8">
//       <h1 className="text-3xl font-bold mb-6">WebRTC Video Chat Application</h1>
      
//       <div className="mb-8">
//         <p className="mb-4">
//           This application allows you to video chat with others, send text messages, and share images.
//         </p>
//         <Link href="/chat" className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded">
//           Start a chat
//         </Link>
//       </div>
      
//       <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
//         <div className="bg-white p-6 rounded shadow">
//           <h2 className="text-xl font-semibold mb-2">Video Chat</h2>
//           <p>High-quality video calls with filters and camera controls.</p>
//         </div>
        
//         <div className="bg-white p-6 rounded shadow">
//           <h2 className="text-xl font-semibold mb-2">Text Chat</h2>
//           <p>Send and receive text messages in real-time.</p>
//         </div>
        
//         <div className="bg-white p-6 rounded shadow">
//           <h2 className="text-xl font-semibold mb-2">Image Sharing</h2>
//           <p>Share images with your friends during the chat.</p>
//         </div>
//       </div>
      
//       <footer className="mt-12 text-center text-gray-500">
//         <p>© 2025 WebRTC Chat. All rights reserved.</p>
//       </footer>