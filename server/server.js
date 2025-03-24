const { createServer } = require("http");
const { Server } = require("socket.io");

// Environment variables
const hostname = process.env.HOST || "localhost";
const port = process.env.PORT || 3001;

// Create the HTTP server
const server = createServer((req, res) => {
    res.writeHead(200, { "Content-Type": "text/plain" });
    res.end("Socket.IO server is running");
});

// Initialize Socket.IO
const io = new Server(server, {
    path: "/api/socket",
    addTrailingSlash: false,
});

// Handle room-based namespaces (7-digit IDs)
const namespaces = io.of(/^\/[0-9]{7}$/);
namespaces.on("connect", (socket) => {
    const namespace = socket.nsp;
    console.log(`Socket namespace: ${namespace.name}`);

    socket.broadcast.emit("connected peer");

    socket.on("signal", (data) => {
        socket.broadcast.emit("signal", data);
    });

    socket.on("disconnect", () => {
        namespace.emit("disconnected peer");
    });
});

// Handle multi-party namespaces (format: xxxx-xxxx-xxxx)
const mp_namespaces = io.of(/^\/[a-z]{4}-[a-z]{4}-[a-z]{4}$/);
mp_namespaces.on("connect", (socket) => {
    const namespace = socket.nsp;
    const peers = [...namespace.sockets.keys()];

    console.log(`Socket namespace: ${namespace.name}`);

    // Send the array of connected-peer IDs to the connecting peer
    socket.emit("connected peers", peers);

    // Send the connecting peer ID to all connected peers
    socket.broadcast.emit("connected peer", socket.id);

    socket.on("signal", ({ recipient, sender, signal }) => {
        socket.to(recipient).emit("signal", { recipient, sender, signal });
    });

    socket.on("disconnect", () => {
        namespace.emit("disconnected peer", socket.id);
    });
});

// Start the server
server.listen(port, (err) => {
    if (err) throw err;
    console.log(`> Server ready on http://${hostname}:${port}`);
});
