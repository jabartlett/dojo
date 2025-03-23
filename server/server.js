const { createServer } = require("node:http");
const { Server } = require('socket.io');
const next = require("next");

const dev = process.env.NODE_ENV !== "production";
const hostname = process.env.HOST || "localhost";
const port = process.env.PORT || 3001;

const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

app.prepare().then(() => {
  // Create the HTTP server
  const server = createServer((req, res) => {
    handle(req, res);
  });

  // Initialize Socket.IO
  const io = new Server(server, {
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

  // Start the server
  server.listen(port, (err) => {
    if (err) throw err;
    console.log(`> Ready on http://${hostname}:${port}`);
  });
});
