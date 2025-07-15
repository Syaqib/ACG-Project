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

    // Add to user list
    users[socket.id] = { 
        id: socket.id,
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
            socket.broadcast.emit('userMoved', data); // only send to others
        }
    });

    socket.on('message', msg => {
        console.log('Message received:', msg);
        // Broadcast to others
        socket.broadcast.emit('message', msg);
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