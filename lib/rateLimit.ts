const usageStore: {
    [sessionId: string]: {
      transcriptionCount: number;
      chatCount: number;
    };
  } = {};
  
  export function checkTranscriptionLimit(sessionId: string, limit = 1): boolean {
    // Initialize if not exists
    if (!usageStore[sessionId]) {
      usageStore[sessionId] = { transcriptionCount: 0, chatCount: 0 };
    }
    
    // Check if limit reached
    if (usageStore[sessionId].transcriptionCount >= limit) {
      return false;
    }
    
    // Increment usage
    usageStore[sessionId].transcriptionCount++;
    return true;
  }
  
  export function checkChatLimit(sessionId: string, limit = 1): boolean {
    // Initialize if not exists
    if (!usageStore[sessionId]) {
      usageStore[sessionId] = { transcriptionCount: 0, chatCount: 0 };
    }
    
    // Check if limit reached
    if (usageStore[sessionId].chatCount >= limit) {
      return false;
    }
    
    // Increment usage
    usageStore[sessionId].chatCount++;
    return true;
  }