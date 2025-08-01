const http = require('http');
const socketIO = require('socket.io');

const server = http.createServer();
const io = socketIO(server, {
    cors: {
        origin: "*",  // Allow all for dev
    }
});

let users = {}; // Store users by socket ID
let color_number = 1;
let walls = []; // Store all walls
let tables = [];
let chairs = [];

function generateWallId() {
    return 'wall_' + Math.random().toString(36).substr(2, 9);
}
function generateTableId() {
    return 'table_' + Math.random().toString(36).substr(2, 9);
}
function generateChairId() {
    return 'chair_' + Math.random().toString(36).substr(2, 9);
}

// Function to get random spawn position, avoiding overlap with existing users
function getRandomSpawnPosition(existingUsers) {
    const minX = -20;
    const maxX = 20;
    const minZ = -20;
    const maxZ = 20;
    const minDistance = 3; // Minimum distance between spawns
    let attempt = 0;
    while (attempt < 20) {
        const pos = {
            x: Math.random() * (maxX - minX) + minX,
            y: 0,
            z: Math.random() * (maxZ - minZ) + minZ
        };
        let tooClose = false;
        for (const user of Object.values(existingUsers)) {
            const dx = user.position.x - pos.x;
            const dz = user.position.z - pos.z;
            if (Math.sqrt(dx*dx + dz*dz) < minDistance) {
                tooClose = true;
                break;
            }
        }
        if (!tooClose) return pos;
        attempt++;
    }
    // If we can't find a free spot, just return the last one
    return {
        x: Math.random() * (maxX - minX) + minX,
        y: 0,
        z: Math.random() * (maxZ - minZ) + minZ
    };
}

io.on('connection', socket => {
    console.log('A user connected:', socket.id);

    // Get name from handshake query
    const name = socket.handshake.query && socket.handshake.query.name ? String(socket.handshake.query.name) : `User`;

    // Add to user list with random spawn position
    users[socket.id] = { 
        id: socket.id,
        name: name,
        position: getRandomSpawnPosition(users),
        color: color_number
    };

    color_number > 7 ? color_number = 1 : color_number++;

    Object.keys(users).forEach((id, index) => {
        users[id].index = index + 1;
    });

    // Send updated list to all clients
    io.emit('userList', Object.values(users));

    // Send current wall and table lists to the new client
    socket.emit('wallList', walls);
    socket.emit('tableList', tables);
    socket.emit('chairList', chairs);

    // Wall creation
    socket.on('addWall', (wallData) => {
        wallData.id = generateWallId();
        walls.push(wallData);
        io.emit('wallList', walls);
    });
    // Wall deletion
    socket.on('deleteWall', ({ id }) => {
        walls = walls.filter(w => w.id !== id);
        io.emit('wallList', walls);
    });

    // Wall update
    socket.on('updateWall', (wallData) => {
        const idx = walls.findIndex(w => w.id === wallData.id);
        if (idx !== -1) {
            walls[idx] = wallData;
            io.emit('wallList', walls);
        }
    });

    // Table creation
    socket.on('addTable', (tableData) => {
        tableData.id = generateTableId();
        tables.push(tableData);
        io.emit('tableList', tables);
    });
    // Table deletion
    socket.on('deleteTable', ({ id }) => {
        tables = tables.filter(t => t.id !== id);
        io.emit('tableList', tables);
    });
    // Chair creation
    socket.on('addChair', (chairData) => {
        chairData.id = generateChairId();
        chairs.push(chairData);
        io.emit('chairList', chairs);
    });
    // Chair deletion
    socket.on('deleteChair', ({ id }) => {
        chairs = chairs.filter(c => c.id !== id);
        io.emit('chairList', chairs);
    });

    // Table update
    socket.on('updateTable', (tableData) => {
        const idx = tables.findIndex(t => t.id === tableData.id);
        if (idx !== -1) {
            tables[idx] = tableData;
            io.emit('tableList', tables);
        }
    });
    // Chair update
    socket.on('updateChair', (chairData) => {
        const idx = chairs.findIndex(c => c.id === chairData.id);
        if (idx !== -1) {
            chairs[idx] = chairData;
            io.emit('chairList', chairs);
        }
    });

    socket.on('move', (data) => {
        if (users[data.id]) {
            users[data.id].position = data.position;
            users[data.id].rotation = data.rotation;
            users[data.id].animation = data.animation;
            // Broadcast with name, rotation, and animation
            socket.broadcast.emit('userMoved', {
                id: data.id,
                position: data.position,
                rotation: data.rotation,
                animation: data.animation,
                name: users[data.id].name
            });
        }
    });

    socket.on('message', msg => {
        console.log('Message received:', msg);
        // Broadcast to others, include sender's name
        socket.broadcast.emit('message', { ...msg, sender: users[socket.id]?.name || msg.sender });
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