"use client";

import * as React from 'react';
import Image from "next/image";
import { Notification, NotificationGroup } from '@progress/kendo-react-notification';
import { Fade } from '@progress/kendo-react-animation';
import { Button } from '@progress/kendo-react-buttons';
import '@progress/kendo-theme-default/dist/all.css';
import WebRTCClient from '@/components/WebRTCClient';
import AppHeader from '@/components/AppHeader';
import { ProgressBar } from '@progress/kendo-react-progressbars';

export default function Home() {
  const [loading, setLoading] = React.useState(true);
  const [progress, setProgress] = React.useState(0);

  React.useEffect(() => {
    // Simulate loading process
    let value = 0;
    const interval = setInterval(() => {
      value += 5;
      setProgress(value);
      
      if (value >= 100) {
        clearInterval(interval);
        setTimeout(() => {
          setLoading(false);
        }, 500); // Short delay after reaching 100% before hiding
      }
    }, 100);

    return () => {
      clearInterval(interval);
    };
  }, []);

  return (
    <div>
      <AppHeader />
      
      {loading ? (
        <div className="loading-container" style={{ 
          padding: '2rem', 
          maxWidth: '600px', 
          margin: '5rem auto',
          textAlign: 'center' 
        }}>
          <h2>Loading Video Chat Application</h2>
          <p>Please wait while we set up your communication environment...</p>
          <div style={{ margin: '2rem 0' }}>
            <ProgressBar value={progress} />
          </div>
          <p>{progress}% complete</p>
        </div>
      ) : (
        <WebRTCClient />
      )}
    </div>
  );
}