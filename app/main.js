import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { CSS2DRenderer, CSS2DObject } from 'three/addons/renderers/CSS2DRenderer.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { TransformControls } from 'three/addons/controls/TransformControls.js';

// === RENDERER ===
const renderer = new THREE.WebGLRenderer();
renderer.setSize(window.innerWidth * 0.98, window.innerHeight * 0.98);
renderer.setPixelRatio(window.devicePixelRatio);
document.body.appendChild(renderer.domElement);

// === LABEL RENDERER ===
export const labelRenderer = new CSS2DRenderer();
labelRenderer.setSize(window.innerWidth, window.innerHeight);
labelRenderer.domElement.style.position = "absolute";
labelRenderer.domElement.style.left = '50%';
labelRenderer.domElement.style.top = '50%';
labelRenderer.domElement.style.transform = 'translate(-50%, -50%)';
labelRenderer.domElement.style.pointerEvents = "none";
document.body.appendChild(labelRenderer.domElement);

// === SCENE & CAMERA ===
const scene = new THREE.Scene();
scene.background = new THREE.Color(0xf5f5f5); // light, neutral background
const camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 1000);
camera.position.set(0, 5, -10);

// === LIGHTING ===
const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
scene.add(ambientLight);

const hemiLight = new THREE.HemisphereLight(0xffffff, 0x444444, 1.2);
hemiLight.position.set(0, 20, 0);
scene.add(hemiLight);

const directionalLight = new THREE.DirectionalLight(0xffffff, 1.5);
directionalLight.position.set(10, 20, 10);
directionalLight.castShadow = true;
directionalLight.target.position.set(0, 0, 0);
scene.add(directionalLight);
scene.add(directionalLight.target);

// === FLOOR WITH GRID ===
const floorGeometry = new THREE.PlaneGeometry(300, 300); // much larger floor
const floorMaterial = new THREE.MeshStandardMaterial({ color: 0xe0d7c6 }); // warm, house-like color
const floor = new THREE.Mesh(floorGeometry, floorMaterial);
floor.rotation.x = -Math.PI / 2;
floor.position.y = 0;
floor.receiveShadow = true;
scene.add(floor);

const grid = new THREE.GridHelper(300, 100, 'lightgray', 'black');
grid.position.y = 0.01; // Slightly above the floor to avoid z-fighting
scene.add(grid);
grid.visible = false; // Only show in edit mode

// === ORBIT CONTROLS ===
const orbit = new OrbitControls(camera, renderer.domElement);
orbit.enableDamping = true;
orbit.dampingFactor = 0.05;
orbit.maxDistance = 50;
orbit.minDistance = 5;
orbit.maxPolarAngle = Math.PI / 2;
orbit.minPolarAngle = Math.PI / 4;
orbit.target.set(0, 1, 0);
// Restore default mouse mapping for Unity-like experience
orbit.mouseButtons = {
    LEFT: THREE.MOUSE.ROTATE,
    MIDDLE: THREE.MOUSE.DOLLY,
    RIGHT: THREE.MOUSE.PAN
};
orbit.update();

// === TRANSFORM CONTROLS (Unity-like Gizmo) ===
const transformControls = new TransformControls(camera, renderer.domElement);
scene.add(transformControls);
transformControls.setMode('translate'); // Default to translate
transformControls.addEventListener('dragging-changed', function (event) {
    orbit.enabled = !event.value;
});
transformControls.addEventListener('objectChange', function (event) {
    if (mode === 'edit' && selectedWall) {
        if (selectedWall.userData.isWall) emitWallUpdate(selectedWall);
        if (selectedWall.userData.isTable) emitTableUpdate(selectedWall);
    }
});

// === MOVEMENT CONTROL ===
const keys = {};
let selectedWall = null;
let draggingWall = false;
document.addEventListener('keydown', e => {
    keys[e.key.toLowerCase()] = true;
    if (!selectedWall) return;
    switch (e.key.toLowerCase()) {
        case 't':
            transformControls.setMode('translate');
            break;
        case 'r':
            transformControls.setMode('rotate');
            break;
        case 'y':
            transformControls.setMode('scale');
            break;
    }
});
document.addEventListener('keyup', e => keys[e.key.toLowerCase()] = false);

let velocity = new THREE.Vector3();
let forward = new THREE.Vector3();
let right = new THREE.Vector3();

// === MODE TOGGLE ===
let mode = 'play'; // 'play' or 'edit'
const toggleModeBtn = document.getElementById('toggleModeBtn');
const addWallBtn = document.getElementById('addWallBtn');
const addTableBtn = document.getElementById('addTableBtn');

function createObject(type, modelPath, userDataKey, emitEvent, defaultProps = {}) {
    if (type === 'wall') {
        const geometry = new THREE.BoxGeometry(2, 2, 0.2);
        const material = new THREE.MeshStandardMaterial({ color: defaultProps.color || 0xffffff });
        const wall = new THREE.Mesh(geometry, material);
        wall.position.set(0, 1, 0);
        wall.castShadow = true;
        wall.userData[userDataKey] = true;
        scene.add(wall);
        selectWall(wall);
        if (typeof socket !== 'undefined') {
            socket.emit(emitEvent, {
                position: { x: wall.position.x, y: wall.position.y, z: wall.position.z },
                rotation: { x: wall.rotation.x, y: wall.rotation.y, z: wall.rotation.z },
                scale: { x: wall.scale.x, y: wall.scale.y, z: wall.scale.z },
                color: wall.material.color.getHex()
            });
        }
    } else {
        const loader = new GLTFLoader();
        loader.load(modelPath, gltf => {
            const obj = gltf.scene;
            obj.position.set(0, 1, 0);
            obj.userData[userDataKey] = true;
            scene.add(obj);
            selectWall(obj);
            if (typeof socket !== 'undefined') {
                socket.emit(emitEvent, {
                    position: { x: obj.position.x, y: obj.position.y, z: obj.position.z },
                    rotation: { x: obj.rotation.x, y: obj.rotation.y, z: obj.rotation.z },
                    scale: { x: obj.scale.x, y: obj.scale.y, z: obj.scale.z }
                });
            }
        });
    }
}

function addEditButton(id, text, onClick) {
    const btn = document.createElement('button');
    btn.id = id;
    btn.textContent = text;
    btn.className = 'edit-btn';
    btn.style.display = 'none';
    btn.addEventListener('click', onClick);
    document.getElementById('modeBar').appendChild(btn);
    return btn;
}

const addChairBtn = addEditButton('addChairBtn', 'Add Chair', () => createObject('chair', './model/chair/rustic_chair/scene.gltf', 'isChair', 'addChair'));
const deleteBtn = addEditButton('deleteBtn', 'Delete', function() {
    if (!selectedWall) return;
    if (selectedWall.userData.isWall) {
        if (selectedWall.userData.wallId) {
            socket.emit('deleteWall', { id: selectedWall.userData.wallId });
        }
    } else if (selectedWall.userData.isTable) {
        if (selectedWall.userData.tableId) {
            socket.emit('deleteTable', { id: selectedWall.userData.tableId });
        }
    } else if (selectedWall.userData.isChair) {
        if (selectedWall.userData.chairId) {
            socket.emit('deleteChair', { id: selectedWall.userData.chairId });
        }
    }
    scene.remove(selectedWall);
    transformControls.detach();
    selectedWall = null;
});
addWallBtn.classList.add('edit-btn');
addTableBtn.classList.add('edit-btn');
addWallBtn.onclick = () => createObject('wall', null, 'isWall', 'addWall', { color: 0xffffff });
addTableBtn.onclick = () => createObject('table', './model/table/scene.gltf', 'isTable', 'addTable');

function setMode(newMode) {
    mode = newMode;
    if (mode === 'edit') {
        toggleModeBtn.textContent = 'Switch to Play Mode';
        addWallBtn.style.display = '';
        addTableBtn.style.display = '';
        addChairBtn.style.display = '';
        deleteBtn.style.display = '';
        transformControls.enabled = true;
        grid.visible = true;
    } else {
        toggleModeBtn.textContent = 'Switch to Edit Mode';
        addWallBtn.style.display = 'none';
        addTableBtn.style.display = 'none';
        addChairBtn.style.display = 'none';
        deleteBtn.style.display = 'none';
        transformControls.detach();
        transformControls.enabled = false;
        selectedWall = null;
        grid.visible = false;
    }
}

toggleModeBtn.onclick = () => setMode(mode === 'play' ? 'edit' : 'play');
setMode('play');

// === TABLE CREATION AND MANIPULATION ===
function createTable() {
    const tableLoader = new GLTFLoader();
    tableLoader.load('./model/table/scene.gltf', gltf => {
        const table = gltf.scene;
        table.position.set(0, 1, 0);
        table.userData.isTable = true;
        scene.add(table);
        selectWall(table); // Use same transform logic as wall
        // Emit table creation to server
        if (typeof socket !== 'undefined') {
            socket.emit('addTable', {
                position: { x: table.position.x, y: table.position.y, z: table.position.z },
                rotation: { x: table.rotation.x, y: table.rotation.y, z: table.rotation.z },
                scale: { x: table.scale.x, y: table.scale.y, z: table.scale.z }
            });
        }
    });
}
addTableBtn.addEventListener('click', createTable);

// === WALL CREATION AND MANIPULATION (update for mode) ===
function createWall() {
    console.log('createWall called');
    const geometry = new THREE.BoxGeometry(2, 2, 0.2);
    const material = new THREE.MeshStandardMaterial({ color: 0xffffff });
    const wall = new THREE.Mesh(geometry, material);
    wall.position.set(0, 1, 0);
    wall.castShadow = true;
    wall.userData.isWall = true;
    scene.add(wall);
    selectWall(wall);
    if (typeof socket !== 'undefined') {
        console.log('Emitting addWall to server', socket && socket.connected);
        socket.emit('addWall', {
            position: { x: wall.position.x, y: wall.position.y, z: wall.position.z },
            rotation: { x: wall.rotation.x, y: wall.rotation.y, z: wall.rotation.z },
            scale: { x: wall.scale.x, y: wall.scale.y, z: wall.scale.z },
            color: 0xffffff
        });
    }
}
addWallBtn.onclick = createWall;

function createChair() {
    const chairLoader = new GLTFLoader();
    chairLoader.load('./model/chair/rustic_chair/scene.gltf', gltf => {
        const chair = gltf.scene;
        chair.position.set(0, 1, 0);
        chair.userData.isChair = true;
        scene.add(chair);
        selectWall(chair); // Use same transform logic as wall/table
        // Emit chair creation to server
        if (typeof socket !== 'undefined') {
            socket.emit('addChair', {
                position: { x: chair.position.x, y: chair.position.y, z: chair.position.z },
                rotation: { x: chair.rotation.x, y: chair.rotation.y, z: chair.rotation.z },
                scale: { x: chair.scale.x, y: chair.scale.y, z: chair.scale.z }
            });
        }
    });
}
addChairBtn.addEventListener('click', createChair);

function selectWall(wall) {
    if (mode !== 'edit') return;
    if (selectedWall) {
        selectedWall.material?.emissive?.set(0x000000);
    }
    selectedWall = wall;
    if (selectedWall.material?.emissive) {
        selectedWall.material.emissive.set(0x2222ff);
    }
    transformControls.attach(wall);
    transformControls.visible = true;
}

// Update pointer events for edit mode
function isMoveableObject(obj) {
    return obj.userData.isWall || obj.userData.isTable || obj.userData.isChair;
}

document.addEventListener('pointerdown', (event) => {
    if (mode !== 'edit') return;
    const mouse = new THREE.Vector2(
        (event.clientX / window.innerWidth) * 2 - 1,
        -(event.clientY / window.innerHeight) * 2 + 1
    );
    const raycaster = new THREE.Raycaster();
    raycaster.setFromCamera(mouse, camera);
    const intersects = raycaster.intersectObjects(scene.children, false);
    for (let i = 0; i < intersects.length; i++) {
        if (isMoveableObject(intersects[i].object)) {
            selectWall(intersects[i].object);
            draggingWall = true;
            break;
        }
    }
});

document.addEventListener('pointerup', () => {
    draggingWall = false;
});

document.addEventListener('mousemove', (event) => {
    if (mode !== 'edit' || !draggingWall || !selectedWall) return;
    const mouse = new THREE.Vector2(
        (event.clientX / window.innerWidth) * 2 - 1,
        -(event.clientY / window.innerHeight) * 2 + 1
    );
    const raycaster = new THREE.Raycaster();
    raycaster.setFromCamera(mouse, camera);
    const intersects = raycaster.intersectObject(floor);
    if (intersects.length > 0) {
        const pt = intersects[0].point;
        selectedWall.position.x = snapToGrid(pt.x, 1);
        selectedWall.position.z = snapToGrid(pt.z, 1);
    }
});

// === LOAD GLB PLAYER MODEL ===
const loader = new GLTFLoader();

function createPlayerModel(userId, position, onLoaded) {
    loader.load('./model/male.glb', gltf => {
        const model = gltf.scene;
        model.name = userId;
        model.isPlayerModel = true; // Mark as player model
        model.scale.set(0.01, 0.01, 0.01);
        model.position.set(position.x, 0, position.z);
        scene.add(model);
        console.log("Model loaded:", model);
        onLoaded?.(model);
    }, undefined, error => {
        console.error("Failed to load GLB model:", error);
    });
}

let socket; // Global socket variable
let tables = []; // Store all tables

function generateTableId() {
    return 'table_' + Math.random().toString(36).substr(2, 9);
}

// === UTILITY ===
function snapToGrid(value, gridSize = 1) {
    return Math.round(value / gridSize) * gridSize;
}

document.addEventListener('DOMContentLoaded', function() {
    // Splash screen logic
    const splash = document.getElementById('splashScreen');
    const mainMenu = document.getElementById('mainMenu');
    mainMenu.style.display = 'none';
    setTimeout(() => {
        splash.style.display = 'none';
        mainMenu.style.display = 'flex';
    }, 1000);
    // === MAIN MENU LOGIN ===
    let playerName = '';
    let gameStarted = false;

    function showMainMenu() {
        document.getElementById('mainMenu').style.display = 'flex';
    }
    function hideMainMenu() {
        document.getElementById('mainMenu').style.display = 'none';
    }

    showMainMenu();

    // Wait for user to enter name and click 'Enter Game'
    document.getElementById('enterGameBtn').onclick = function() {
        const input = document.getElementById('playerNameInput');
        const name = input.value.trim();
        if (!name) {
            document.getElementById('loginError').textContent = 'Please enter your name.';
            return;
        }
        playerName = name;
        hideMainMenu();
        gameStarted = true;
        // Now connect to socket and start game logic
        startGame();
    };

    // --- Socket/game logic moved to a function ---
    function startGame() {
        socket = io('http://localhost:3000', { query: { name: playerName } });
        let currentUser = "";
        window._socket = socket; // for debugging

        socket.on('connect', () => {
            console.log('Connected to server as:', socket.id, 'with name', playerName);
        });

        socket.on('userList', (userList) => {
            // Only remove player models, not static scene objects
            scene.children
                .filter(obj => obj.isPlayerModel)
                .forEach(obj => {
                    if (!userList.some(user => user.id === obj.name)) {
                        scene.remove(obj);
                    }
                });
            const ul = document.getElementById('users');
            ul.innerHTML = '';
            userList.forEach(user => {
                const isCurrentUser = user.id === socket.id;
                const displayName = isCurrentUser ? 'You' : (user.name || `User`);
                const li = document.createElement('li');
                li.textContent = displayName;
                ul.appendChild(li);
                const existing = scene.getObjectByName(user.id);
                if (!existing) {
                    createPlayerModel(user.id, user.position, model => {
                        const labelDiv = document.createElement('div');
                        labelDiv.textContent = displayName;
                        labelDiv.style.color = 'white';
                        const labelObj = new CSS2DObject(labelDiv);
                        labelObj.position.set(0, -1.5, 0);
                        labelObj.name = "label";
                        model.add(labelObj);
                    });
                } else {
                    existing.position.set(user.position.x, 0, user.position.z);
                    // Update label if name changed
                    const label = existing.getObjectByName('label');
                    if (label && label.element.textContent !== displayName) {
                        label.element.textContent = displayName;
                    }
        }
    });
});

        socket.on('userMoved', ({ id, position }) => {
            const player = scene.getObjectByName(id);
            if (player) {
                player.position.set(position.x, 0, position.z);
            }
        });

        // Wall sync: always render the full wall list
        console.log('Registering wallList handler');
        socket.on('wallList', (wallList) => {
            console.log('wallList event received:', wallList);
            scene.children
                .filter(obj => obj.userData && obj.userData.isWall)
                .forEach(obj => {
                    if (selectedWall === obj) {
                        transformControls.detach();
                        selectedWall = null;
                    }
                    scene.remove(obj);
                });
            wallList.forEach(wallData => {
                console.log('Wall from server:', wallData);
                const geometry = new THREE.BoxGeometry(2, 2, 0.2);
                const material = new THREE.MeshStandardMaterial({ color: wallData.color || 0xffffff });
                const wall = new THREE.Mesh(geometry, material);
                wall.position.set(wallData.position.x, wallData.position.y, wallData.position.z);
                wall.rotation.set(wallData.rotation.x, wallData.rotation.y, wallData.rotation.z);
                wall.scale.set(wallData.scale.x, wallData.scale.y, wallData.scale.z);
                wall.castShadow = true;
                wall.userData.isWall = true;
                wall.userData.wallId = wallData.id;
                scene.add(wall);
            });
        });

        // Table sync: always render the full table list
        console.log('Registering tableList handler');
        socket.on('tableList', (tableList) => {
            console.log('tableList event received:', tableList);
            scene.children
                .filter(obj => obj.userData && obj.userData.isTable)
                .forEach(obj => {
                    if (selectedWall === obj) {
                        transformControls.detach();
                        selectedWall = null;
                    }
                    scene.remove(obj);
                });
            tableList.forEach(tableData => {
                console.log('Table from server:', tableData);
                const tableLoader = new GLTFLoader();
                tableLoader.load('./model/table/scene.gltf', gltf => {
                    const table = gltf.scene;
                    table.position.set(tableData.position.x, tableData.position.y, tableData.position.z);
                    table.rotation.set(tableData.rotation.x, tableData.rotation.y, tableData.rotation.z);
                    table.scale.set(tableData.scale.x, tableData.scale.y, tableData.scale.z);
                    table.userData.isTable = true;
                    table.userData.tableId = tableData.id;
                    scene.add(table);
                });
            });
        });

        socket.on('addTable', (tableData) => {
            const tableLoader = new GLTFLoader();
            tableLoader.load('./model/table/table.glb', gltf => {
                const table = gltf.scene;
                table.position.set(tableData.position.x, tableData.position.y, tableData.position.z);
                table.rotation.set(tableData.rotation.x, tableData.rotation.y, tableData.rotation.z);
                table.scale.set(tableData.scale.x, tableData.scale.y, tableData.scale.z);
                table.userData.isTable = true;
                scene.add(table);
            });
        });

        // === PLAYER MOVEMENT ===
        function move() {
            if (mode !== 'play') return;
            const player = scene.getObjectByName(socket.id);
            if (!player) return;
            orbit.target.copy(player.position);
            orbit.update();
            velocity.set(0, 0, 0);
            forward.set(0, 0, 0);
            right.set(0, 0, 0);
            camera.getWorldDirection(forward);
            forward.y = 0;
            forward.normalize();
            right.copy(forward).cross(camera.up).normalize();
            if (keys['w']) velocity.add(forward);
            if (keys['s']) velocity.sub(forward);
            if (keys['a']) velocity.sub(right);
            if (keys['d']) velocity.add(right);
            if (velocity.lengthSq() > 0) {
                velocity.normalize().multiplyScalar(0.05);
                player.position.add(velocity);
                socket.emit('move', {
                    id: socket.id,
                    position: player.position
                });
            }
        }

        // === ANIMATION LOOP ===
        function animate() {
            renderer.render(scene, camera);
            labelRenderer.render(scene, camera);
            if (gameStarted) move();
        }
        renderer.setAnimationLoop(animate);

        // === CHAT FUNCTIONALITY ===
        window.sendMessage = function sendMessage() {
            const input = document.getElementById('msg');
            const msg = input.value;
            if (!msg) {
        document.getElementById('error').textContent = "Please enter your message";
                return;
    }
            input.value = "";
    document.getElementById('error').textContent = "";
    socket.emit('message', {
        text: msg,
                sender: playerName
    });
    const li = document.createElement('li');
            li.textContent = `You said: ${msg}`;
    document.getElementById('messages').appendChild(li);
        };
socket.on('message', (msg) => {
    const li = document.createElement('li');
            li.textContent = `${msg.sender} said: ${msg.text}`;
    document.getElementById('messages').appendChild(li);
        });
    }
});

function emitWallUpdate(wall) {
    if (!wall.userData.wallId) return; // Only update if wall has an id
    socket.emit('updateWall', {
        id: wall.userData.wallId,
        position: { x: wall.position.x, y: wall.position.y, z: wall.position.z },
        rotation: { x: wall.rotation.x, y: wall.rotation.y, z: wall.rotation.z },
        scale: { x: wall.scale.x, y: wall.scale.y, z: wall.scale.z },
        color: wall.material.color.getHex()
    });
}

function emitTableUpdate(table) {
    if (!table.userData.tableId) return;
    socket.emit('updateTable', {
        id: table.userData.tableId,
        position: { x: table.position.x, y: table.position.y, z: table.position.z },
        rotation: { x: table.rotation.x, y: table.rotation.y, z: table.rotation.z },
        scale: { x: table.scale.x, y: table.scale.y, z: table.scale.z }
    });
}

deleteBtn.addEventListener('click', function() {
    if (!selectedWall) return;
    if (selectedWall.userData.isWall) {
        if (selectedWall.userData.wallId) {
            socket.emit('deleteWall', { id: selectedWall.userData.wallId });
        }
    } else if (selectedWall.userData.isTable) {
        if (selectedWall.userData.tableId) {
            socket.emit('deleteTable', { id: selectedWall.userData.tableId });
        }
    } else if (selectedWall.userData.isChair) {
        if (selectedWall.userData.chairId) {
            socket.emit('deleteChair', { id: selectedWall.userData.chairId });
        }
    }
    scene.remove(selectedWall);
    transformControls.detach();
    selectedWall = null;
});
