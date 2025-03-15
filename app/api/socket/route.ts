import { NextRequest } from 'next/server';
import { Server as SocketIOServer } from 'socket.io';

// Create a global variable for the Socket.IO instance to prevent duplicate initialization
let io: SocketIOServer | undefined;

export async function GET(req: NextRequest) {
  // Safely access the Node.js server instance
  const httpServer = (globalThis as any).__NEXT_HTTP_SERVER__;
  if (!httpServer) {
    throw new Error('HTTP server is unavailable.');
  }

  if (!io) {
    io = new SocketIOServer(httpServer, {
      path: '/api/socket',
      addTrailingSlash: false,
    });

    // Handle room-based namespaces (7-digit IDs)
    const namespaces = io.of(/^\/[0-9]{7}$/);
    namespaces.on('connect', (socket) => {
      const namespace = socket.nsp;
      console.log(`Socket namespace: ${namespace.name}`);

      socket.broadcast.emit('connected peer');

      socket.on('signal', (data) => {
        socket.broadcast.emit('signal', data);
      });

      socket.on('disconnect', () => {
        namespace.emit('disconnected peer');
      });
    });

    // Handle multi-party namespaces (format: xxxx-xxxx-xxxx)
    const mp_namespaces = io.of(/^\/[a-z]{4}-[a-z]{4}-[a-z]{4}$/);
    mp_namespaces.on('connect', (socket) => {
      const namespace = socket.nsp;
      const peers = [...namespace.sockets.keys()];
      
      console.log(`Socket namespace: ${namespace.name}`);

      // Send the array of connected-peer IDs to the connecting peer
      socket.emit('connected peers', peers);

      // Send the connecting peer ID to all connected peers
      socket.broadcast.emit('connected peer', socket.id);

      socket.on('signal', ({ recipient, sender, signal }) => {
        socket.to(recipient).emit('signal', { recipient, sender, signal });
      });

      socket.on('disconnect', () => {
        namespace.emit('disconnected peer', socket.id);
      });
    });
  }

  return new Response('Socket.io server is running', { status: 200 });
}
