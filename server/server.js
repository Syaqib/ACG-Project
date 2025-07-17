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

// Function to create a 5x5 wall
function create5x5Wall() {
    if (walls.length > 0) return; // Only create once
    const wallId = generateWallId();
    const wallSize = 2; // Size of each wall segment
    const wallHeight = 2;
    const wallThickness = 0.2;
    // Center the grid at (0,0)
    for (let x = 0; x < 5; x++) {
        for (let z = 0; z < 5; z++) {
            const wallData = {
                id: `${wallId}_${x}_${z}`,
                position: {
                    x: (x - 2) * wallSize, // Centered at 0
                    y: wallHeight / 2,
                    z: (z - 2) * wallSize
                },
                rotation: { x: 0, y: 0, z: 0 },
                scale: { x: 1, y: 1, z: 1 },
                color: 0xcccccc // Light gray color
            };
            walls.push(wallData);
        }
    }
}

// Function to get random spawn position
function getRandomSpawnPosition() {
    // Spawn players in a larger area to avoid conflicts
    const minX = -20;
    const maxX = 20;
    const minZ = -20;
    const maxZ = 20;
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

    // Create a 5x5 wall when a player connects
    create5x5Wall();

    // Add to user list with random spawn position
    users[socket.id] = { 
        id: socket.id,
        name: name,
        position: getRandomSpawnPosition(),
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
            // Broadcast with name
            socket.broadcast.emit('userMoved', { id: data.id, position: data.position, name: users[data.id].name });
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