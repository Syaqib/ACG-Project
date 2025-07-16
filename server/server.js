const http = require('http');
const socketIO = require('socket.io');

const server = http.createServer();
const io = socketIO(server, {
    cors: {
        origin: "*",  // Allow all for dev
    }
});

let users = {}; // Store users by socket ID
let color_number = 1

io.on('connection', socket => {
    console.log('A user connected:', socket.id);

    // Get name from handshake query
    const name = socket.handshake.query && socket.handshake.query.name ? String(socket.handshake.query.name) : `User`;

    // Add to user list
    users[socket.id] = { 
        id: socket.id,
        name: name,
        position: { x: 0, y: 0, z: 0 },
        color: color_number
    };

    color_number > 7 ? color_number = 1 : color_number++

    Object.keys(users).forEach((id, index) => {
        users[id].index = index + 1;
    });

    // Send updated list to all clients
    io.emit('userList', Object.values(users));

    socket.on('move', (data) => {
        if (users[data.id]) {
            users[data.id].position = data.position;
            // Broadcast with name
            socket.broadcast.emit('userMoved', { id: data.id, position: data.position, name: users[data.id].name });
        }
    });

    socket.on('message', msg => {
        console.log('Message received:', msg);
        // Broadcast to others, include sender's name
        socket.broadcast.emit('message', { ...msg, sender: users[socket.id]?.name || msg.sender });
    });

    socket.on('addWall', (wallData) => {
        // Broadcast to all clients, including the sender
        io.emit('addWall', wallData);
    });

    socket.on('disconnect', () => {
        console.log('User disconnected:', socket.id);
        delete users[socket.id];
        io.emit('userList', Object.values(users));
    });
});

server.listen(3000, () => {
    console.log('Socket.IO server running at http://localhost:3000/');
});