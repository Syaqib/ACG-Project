import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { CSS2DRenderer, CSS2DObject } from 'three/addons/renderers/CSS2DRenderer.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { TransformControls } from 'three/addons/controls/TransformControls.js';
// Remove: import dat from 'dat.gui';

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
const camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 1000);
camera.position.set(0, 5, -10);

// === SKY ===
const skyGeometry = new THREE.SphereGeometry(500, 32, 32);
const skyMaterial = new THREE.ShaderMaterial({
    uniforms: {
        topColor: { value: new THREE.Color(0x0077ff) }, // Sky blue
        bottomColor: { value: new THREE.Color(0xffffff) }, // White
        offset: { value: 33 },
        exponent: { value: 0.6 }
    },
    vertexShader: `
        varying vec3 vWorldPosition;
        void main() {
            vec4 worldPosition = modelMatrix * vec4(position, 1.0);
            vWorldPosition = worldPosition.xyz;
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
    `,
    fragmentShader: `
        uniform vec3 topColor;
        uniform vec3 bottomColor;
        uniform float offset;
        uniform float exponent;
        varying vec3 vWorldPosition;
        void main() {
            float h = normalize(vWorldPosition + offset).y;
            gl_FragColor = vec4(mix(bottomColor, topColor, max(pow(max(h, 0.0), exponent), 0.0)), 1.0);
        }
    `,
    side: THREE.BackSide
});
const sky = new THREE.Mesh(skyGeometry, skyMaterial);
scene.add(sky);

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

// === LIGHTING GUI CONTROLS ===
const gui = new window.dat.GUI();
const ambientFolder = gui.addFolder('Ambient Light');
ambientFolder.add(ambientLight, 'intensity', 0, 2, 0.01).name('Intensity');
ambientFolder.addColor({ color: ambientLight.color.getHex() }, 'color').name('Color').onChange(v => ambientLight.color.set(v));
ambientFolder.open();

const hemiFolder = gui.addFolder('Hemisphere Light');
hemiFolder.add(hemiLight, 'intensity', 0, 2, 0.01).name('Intensity');
hemiFolder.addColor({ color: hemiLight.color.getHex() }, 'color').name('Sky Color').onChange(v => hemiLight.color.set(v));
hemiFolder.addColor({ color: hemiLight.groundColor.getHex() }, 'color').name('Ground Color').onChange(v => hemiLight.groundColor.set(v));
hemiFolder.open();

const dirFolder = gui.addFolder('Directional Light');
dirFolder.add(directionalLight, 'intensity', 0, 3, 0.01).name('Intensity');
dirFolder.addColor({ color: directionalLight.color.getHex() }, 'color').name('Color').onChange(v => directionalLight.color.set(v));
dirFolder.add(directionalLight.position, 'x', -50, 50, 0.1).name('Pos X');
dirFolder.add(directionalLight.position, 'y', 0, 50, 0.1).name('Pos Y');
dirFolder.add(directionalLight.position, 'z', -50, 50, 0.1).name('Pos Z');
dirFolder.open();

// After dat.GUI is created (usually: const gui = new dat.GUI();)
if (gui && gui.domElement) {
    // Position GUI next to chat panel
    gui.domElement.style.position = 'absolute';
    gui.domElement.style.top = '80px'; // align with chat panel
    gui.domElement.style.right = '1600px'; // place to the left of chat panel (adjust as needed)
    gui.domElement.style.zIndex = '1200';
}
if (gui && gui.closed === false && typeof gui.close === 'function') {
    gui.close();
}
// === TEXTURE LOADER & TEXTURE CYCLING ===
const textureLoader = new THREE.TextureLoader();
const textureFiles = ['model/floor.jpg', 'model/rug.jpg', 'model/rug1.png', 'model/tiles.png'];
let floorTextureIndex = 0;
let wallTextureIndex = 0;

function loadTexture(path, repeatX = 1, repeatY = 1) {
    const tex = textureLoader.load(path);
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(repeatX, repeatY);
    return tex;
}

// Initial textures
let floorTexture = loadTexture(textureFiles[floorTextureIndex], 10, 10);
let wallTexture = loadTexture(textureFiles[wallTextureIndex], 1, 1);

// === FLOOR WITH TEXTURE ===
const floorGeometry = new THREE.PlaneGeometry(100, 100);
let floorMaterial = new THREE.MeshStandardMaterial({
    map: floorTexture,
    side: THREE.DoubleSide
});
const floor = new THREE.Mesh(floorGeometry, floorMaterial);
floor.rotation.x = -Math.PI / 2;
floor.position.y = 0;
floor.receiveShadow = true;
scene.add(floor);

const grid = new THREE.GridHelper(100, 100, 'lightgray', 'black');
grid.position.y = 0.01;
scene.add(grid);
grid.visible = false;

// === WALL TEXTURE UPDATE FUNCTION ===
function updateWallTextures() {
    scene.children.forEach(obj => {
        if (obj.userData && obj.userData.isWall) {
            // Clone the wall texture for each wall
            const tex = loadTexture(textureFiles[wallTextureIndex], 1, 1);
            obj.material.map = tex;
            obj.material.needsUpdate = true;
        }
    });
}

// === FLOOR TEXTURE UPDATE FUNCTION ===
function updateFloorTexture() {
    floorTexture = loadTexture(textureFiles[floorTextureIndex], 10, 10);
    floorMaterial.map = floorTexture;
    floorMaterial.needsUpdate = true;
}

// === BUTTON EVENT LISTENERS ===
document.getElementById('floorTextureBtn').onclick = function() {
    floorTextureIndex = (floorTextureIndex + 1) % textureFiles.length;
    updateFloorTexture();
};
document.getElementById('wallTextureBtn').onclick = function() {
    wallTextureIndex = (wallTextureIndex + 1) % textureFiles.length;
    updateWallTextures();
};

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
        if (selectedWall.userData.isChair) emitChairUpdate(selectedWall);
    }
});

// === AUDIO STATE ===
let isMuted = false;
let backgroundMusic = null;

// Audio initialization and control functions
function initializeAudio() {
    backgroundMusic = document.getElementById('backgroundMusic');
    
    // Set initial volume
    backgroundMusic.volume = 0.2; // 20% volume
    
    // Set up mute button
    const muteBtn = document.getElementById('muteBtn');
    const muteIcon = document.getElementById('muteIcon');
    
    muteBtn.addEventListener('click', () => {
        if (isMuted) {
            // Unmute
            backgroundMusic.muted = false;
            muteIcon.textContent = '🔊';
            isMuted = false;
        } else {
            // Mute
            backgroundMusic.muted = true;
            muteIcon.textContent = '🔇';
            isMuted = true;
        }
    });
    
    // Remove volume slider logic
    // const volumeSlider = document.getElementById('volumeSlider');
    // volumeSlider.addEventListener('input', (e) => {
    //     const volume = e.target.value / 100;
    //     backgroundMusic.volume = volume;
    //     if (volume === 0) {
    //         muteIcon.textContent = '🔇';
    //         isMuted = true;
    //     } else if (isMuted) {
    //         muteIcon.textContent = '🔊';
    //         isMuted = false;
    //     }
    // });
}

function startBackgroundMusic() {
    if (backgroundMusic) {
        // Try to play the music
        backgroundMusic.play().catch(error => {
            console.log('Audio autoplay was prevented or file not found:', error);
            // This is normal - browsers block autoplay until user interaction
            // or the audio file might not be available
        });
        
        // Show audio controls
        document.getElementById('audioControls').style.display = 'block';
        
        // Add error handling for audio loading
        backgroundMusic.addEventListener('error', (e) => {
            console.log('Audio file could not be loaded:', e);
            // Could implement fallback audio generation here if needed
        });
    }
}

// Chat minimize functionality
function initializeChatMinimize() {
    const chatContainer = document.getElementById('chatContainer');
    const minimizeBtn = document.getElementById('minimizeChatBtn');
    const chatHeader = document.getElementById('chatHeader');
    
    if (minimizeBtn && chatContainer) {
        // Toggle minimize state
        minimizeBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            chatContainer.classList.toggle('minimized');
            
            // Update button text
            if (chatContainer.classList.contains('minimized')) {
                minimizeBtn.textContent = '+';
                minimizeBtn.title = 'Expand Chat';
            } else {
                minimizeBtn.textContent = '−';
                minimizeBtn.title = 'Minimize Chat';
            }
        });
        
        // Allow clicking header to expand if minimized
        chatHeader.addEventListener('click', () => {
            if (chatContainer.classList.contains('minimized')) {
                chatContainer.classList.remove('minimized');
                minimizeBtn.textContent = '−';
                minimizeBtn.title = 'Minimize Chat';
            }
        });
    }
}



// === BUILD MODE STATE ===
let buildMode = false;
let draggedItem = null;
let draggedItemRotation = 0;
let dragPosition = null;
let canDrop = false;
let dragPreview = null; // Visual preview of dragged item
let guiSelectedObject = null; // Object selected via GUI
let originalTransform = null; // Store original transform for reset

// === MOVEMENT CONTROL ===
const keys = {};
let selectedWall = null;
let draggingWall = false;
let hoveredObject = null;
const HIGHLIGHT_COLOR = 0x00ff00; // Green
const SELECTED_COLOR = 0x2222ff;  // Blue
const NORMAL_EMISSIVE = 0x000000;
const DRAG_HIGHLIGHT = 0xffaa00; // Orange for drag preview

// --- Fix for keydown/keyup event handlers ---
document.addEventListener('keydown', e => {
    if (!e.key) return;
    keys[e.key.toLowerCase()] = true;
    
    // Global keyboard shortcuts
    if (e.key.toLowerCase() === 'm') {
        // Toggle mute with 'M' key
        const muteBtn = document.getElementById('muteBtn');
        if (muteBtn) {
            muteBtn.click();
        }
        return;
    }
    
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
document.addEventListener('keyup', e => {
    if (!e.key) return;
    keys[e.key.toLowerCase()] = false;
});

let velocity = new THREE.Vector3();
let forward = new THREE.Vector3();
let right = new THREE.Vector3();

// === MODE TOGGLE ===
let mode = 'play'; // 'play' or 'edit'
const toggleModeBtn = document.getElementById('toggleModeBtn');
const addWallBtn = document.getElementById('addWallBtn');
const addTableBtn = document.getElementById('addTableBtn');

// Maintain a list of selectable objects for easier raycasting
const selectableObjects = [];

// Grid utility functions
function vector3ToGrid(vector3) {
    return [
        Math.round(vector3.x / 2) * 2,
        Math.round(vector3.z / 2) * 2
    ];
}

function gridToVector3(gridPos) {
    return new THREE.Vector3(gridPos[0], 1, gridPos[1]);
}

// Collision detection
function checkCollision(item, position, rotation, items) {
    const width = rotation === 1 || rotation === 3 ? item.size[1] : item.size[0];
    const height = rotation === 1 || rotation === 3 ? item.size[0] : item.size[1];
    
    // Check bounds
    if (position[0] < -50 || position[0] + width > 50 || 
        position[1] < -50 || position[1] + height > 50) {
        return true;
    }
    
    // Check collision with other items
    for (let otherItem of items) {
        if (otherItem === item) continue;
        
        const otherWidth = otherItem.rotation === 1 || otherItem.rotation === 3 ? otherItem.size[1] : otherItem.size[0];
        const otherHeight = otherItem.rotation === 1 || otherItem.rotation === 3 ? otherItem.size[0] : otherItem.size[1];
        
        if (position[0] < otherItem.gridPosition[0] + otherWidth &&
            position[0] + width > otherItem.gridPosition[0] &&
            position[1] < otherItem.gridPosition[1] + otherHeight &&
            position[1] + height > otherItem.gridPosition[1]) {
            return true;
        }
    }
    
    return false;
}

// Create invisible selection box for better object selection
function createSelectionBox(object, size = [2, 2, 2]) {
    const geometry = new THREE.BoxGeometry(size[0], size[1], size[2]);
    const material = new THREE.MeshBasicMaterial({ 
        transparent: true, 
        opacity: 0,
        side: THREE.DoubleSide
    });
    const selectionBox = new THREE.Mesh(geometry, material);
    selectionBox.userData.isSelectionBox = true;
    selectionBox.userData.parentObject = object;
    object.add(selectionBox);
    return selectionBox;
}

// Create selection outline for walls
function createWallOutline(wall) {
    const geometry = new THREE.BoxGeometry(2.2, 2.2, 0.3);
    const material = new THREE.MeshBasicMaterial({ 
        transparent: true, 
        opacity: 0,
        side: THREE.DoubleSide
    });
    const outline = new THREE.Mesh(geometry, material);
    outline.userData.isSelectionBox = true;
    outline.userData.parentObject = wall;
    wall.add(outline);
    return outline;
}

// Unified object creation - only for walls and tables (chairs handled by server)
function createObject({ type, modelPath, userDataKey, emitEvent, defaultProps = {} }) {
    if (type === 'wall') {
        const wallWidth = 2;
        const wallHeight = 2;
        const wallDepth = 0.2;
        const geometry = new THREE.BoxGeometry(wallWidth, wallHeight, wallDepth);
        const material = new THREE.MeshStandardMaterial({ color: defaultProps.color || 0xffffff });
        const wall = new THREE.Mesh(geometry, material);
        wall.position.set(0, 1, 0);
        wall.castShadow = true;
        wall.userData[userDataKey] = true;
        wall.userData.size = [wallWidth, wallHeight]; // Grid size
        wall.userData.gridPosition = vector3ToGrid(wall.position);

        // Add selection outline for walls
        createWallOutline(wall);

        scene.add(wall);
        selectableObjects.push(wall);
        selectWall(wall);

        // Update GUI
        if (buildMode) {
            updateObjectList();
        }

        if (socket) {
            socket.emit(emitEvent, {
                position: { x: wall.position.x, y: wall.position.y, z: wall.position.z },
                rotation: { x: wall.rotation.x, y: wall.rotation.y, z: wall.rotation.z },
                scale: { x: wallWidth, y: wallHeight, z: wallDepth },
                color: wall.material.color.getHex()
            });
        }
    } else if (type === 'table') {
        const loader = new GLTFLoader();
        loader.load(modelPath, gltf => {
            const obj = gltf.scene;
            obj.position.set(0, 1, 0);
            obj.userData[userDataKey] = true;
            obj.scale.set(0.3, 0.3, 0.3); // Make table more realistic size
            obj.userData.size = [2, 2]; // Grid size
            obj.userData.gridPosition = vector3ToGrid(obj.position);
            
            // Add invisible selection box for better selection
            createSelectionBox(obj, [3, 2, 3]);
            
            scene.add(obj);
            selectableObjects.push(obj);
            selectWall(obj);
            
            // Update GUI
            if (buildMode) {
                updateObjectList();
            }
            
            if (socket) {
                socket.emit(emitEvent, {
                    position: { x: obj.position.x, y: obj.position.y, z: obj.position.z },
                    rotation: { x: obj.rotation.x, y: obj.rotation.y, z: obj.rotation.z },
                    scale: { x: obj.scale.x, y: obj.scale.y, z: obj.scale.z }
                });
            }
        });
    }
}

// Remove from selectableObjects when deleted
function removeFromSelectable(obj) {
    const idx = selectableObjects.indexOf(obj);
    if (idx !== -1) selectableObjects.splice(idx, 1);
}

// Unified button creation
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

// Button setup
const addChairBtn = addEditButton('addChairBtn', 'Add Chair', () => {
    if (socket) {
        socket.emit('addChair', {
            position: { x: 0, y: 1, z: 0 },
            rotation: { x: 0, y: 0, z: 0 },
            scale: { x: 1, y: 1, z: 1 }
        });
    }
});

const deleteBtn = addEditButton('deleteBtn', 'Delete', function() {
    if (!selectedWall) return;
    transformControls.detach();
    if (selectedWall.userData.isWall && selectedWall.userData.wallId) {
        socket.emit('deleteWall', { id: selectedWall.userData.wallId });
    } else if (selectedWall.userData.isTable && selectedWall.userData.tableId) {
        socket.emit('deleteTable', { id: selectedWall.userData.tableId });
    } else if (selectedWall.userData.isChair && selectedWall.userData.chairId) {
        socket.emit('deleteChair', { id: selectedWall.userData.chairId });
    }
    scene.remove(selectedWall);
    removeFromSelectable(selectedWall);
    
    // Clear GUI selection if this was the selected object
    if (selectedWall === guiSelectedObject) {
        guiSelectedObject = null;
        originalTransform = null;
        document.getElementById('transformPanel').style.display = 'none';
    }
    
    selectedWall = null;
    
    // Update GUI
    if (buildMode) {
        updateObjectList();
    }
});

// Add rotation and scale buttons
const rotateBtn = addEditButton('rotateBtn', 'Rotate', () => {
    if (selectedWall) {
        transformControls.setMode('rotate');
    }
});

const scaleBtn = addEditButton('scaleBtn', 'Scale', () => {
    if (selectedWall) {
        transformControls.setMode('scale');
    }
});

addWallBtn.classList.add('edit-btn');
addTableBtn.classList.add('edit-btn');
addWallBtn.onclick = () => createObject({ type: 'wall', userDataKey: 'isWall', emitEvent: 'addWall', defaultProps: { color: 0xffffff } });
addTableBtn.onclick = () => createObject({ type: 'table', modelPath: './model/table/scene.gltf', userDataKey: 'isTable', emitEvent: 'addTable' });

function setMode(newMode) {
    mode = newMode;
    const objectListPanel = document.getElementById('objectListPanel');
    const transformPanel = document.getElementById('transformPanel');
    
    if (mode === 'edit') {
        toggleModeBtn.textContent = 'Switch to Play Mode';
        addWallBtn.style.display = '';
        addTableBtn.style.display = '';
        addChairBtn.style.display = '';
        deleteBtn.style.display = '';
        rotateBtn.style.display = '';
        scaleBtn.style.display = '';
        transformControls.enabled = true;
        grid.visible = true;
        buildMode = true;
        
        // Enable orbit controls for edit mode
        orbit.enabled = true;
        
        // Show all panels and add build mode class
        objectListPanel.style.display = 'block';
        document.body.classList.add('build-mode');
        document.getElementById('modeBar').classList.add('build-mode-active');
        
        // Update object list
        updateObjectList();
        // Restore default mouse mapping for edit mode (LMB = rotate)
        orbit.mouseButtons = {
            LEFT: THREE.MOUSE.ROTATE,
            MIDDLE: THREE.MOUSE.DOLLY,
            RIGHT: THREE.MOUSE.PAN
        };
        orbit.update();
    } else {
        toggleModeBtn.textContent = 'Switch to Edit Mode';
        addWallBtn.style.display = 'none';
        addTableBtn.style.display = 'none';
        addChairBtn.style.display = 'none';
        deleteBtn.style.display = 'none';
        rotateBtn.style.display = 'none';
        scaleBtn.style.display = 'none';
        transformControls.detach();
        transformControls.enabled = false;
        selectedWall = null;
        grid.visible = false;
        buildMode = false;
        
        // Disable orbit controls for play mode (camera follows player)
        orbit.enabled = false;
        
        // Hide all panels and remove build mode class
        objectListPanel.style.display = 'none';
        transformPanel.style.display = 'none';
        document.body.classList.remove('build-mode', 'dragging');
        document.getElementById('modeBar').classList.remove('build-mode-active');
        
        // Clear GUI state
        guiSelectedObject = null;
        originalTransform = null;
        
        // Clear drag state
        draggedItem = null;
        dragPosition = null;
        canDrop = false;
        if (dragPreview) {
            scene.remove(dragPreview);
            dragPreview = null;
        }
        // In play mode, set LMB to pan (drag camera)
        orbit.mouseButtons = {
            LEFT: THREE.MOUSE.PAN,
            MIDDLE: THREE.MOUSE.DOLLY,
            RIGHT: THREE.MOUSE.ROTATE
        };
        orbit.update();
    }
}

toggleModeBtn.onclick = () => setMode(mode === 'play' ? 'edit' : 'play');
setMode('play');

// Improved object selection
function selectWall(wall) {
    if (mode !== 'edit') return;
    
    // Clear previous selection
    if (selectedWall) {
        selectedWall.material?.emissive?.set(NORMAL_EMISSIVE);
        // Remove selection outline from previous object
        selectedWall.children.forEach(child => {
            if (child.userData.isSelectionBox) {
                child.material.opacity = 0;
            }
        });
    }
    
    selectedWall = wall;
    
    // Highlight selected object
    if (selectedWall.material?.emissive) {
        selectedWall.material.emissive.set(SELECTED_COLOR);
    }
    
    // Show selection outline
    selectedWall.children.forEach(child => {
        if (child.userData.isSelectionBox) {
            child.material.opacity = 0.3;
            child.material.color.setHex(SELECTED_COLOR);
    }
    });
    
    // Attach transform controls
    if (scene.children.includes(wall)) {
    transformControls.attach(wall);
    transformControls.visible = true;
    } else {
        transformControls.detach();
}

    console.log('Selected:', wall.userData);
}

// Enhanced pointer events for build mode
document.addEventListener('pointerdown', (event) => {
    if (mode !== 'edit') return;
    
    const mouse = new THREE.Vector2(
        (event.clientX / window.innerWidth) * 2 - 1,
        -(event.clientY / window.innerHeight) * 2 + 1
    );
    const raycaster = new THREE.Raycaster();
    raycaster.setFromCamera(mouse, camera);
    
    // Check for floor click first
    const floorIntersects = raycaster.intersectObject(floor);
    if (floorIntersects.length > 0) {
        const point = floorIntersects[0].point;
        const gridPos = vector3ToGrid(point);
        
        if (draggedItem !== null) {
            if (canDrop) {
                // Place the dragged item
                const item = selectableObjects[draggedItem];
                if (item) {
                    const newPos = gridToVector3(gridPos);
                    item.position.copy(newPos);
                    item.userData.gridPosition = gridPos;
                    item.rotation.y = draggedItemRotation * Math.PI / 2;
                    
                    // Update server
                    if (item.userData.isWall) emitWallUpdate(item);
                    if (item.userData.isTable) emitTableUpdate(item);
                    if (item.userData.isChair) emitChairUpdate(item);
                }
            }
            draggedItem = null;
            dragPosition = null;
            canDrop = false;
            document.body.classList.remove('dragging');
            // Clean up drag preview
            if (dragPreview) {
                scene.remove(dragPreview);
                dragPreview = null;
            }
            return;
        }
    }
    
    // Improved object selection with better raycasting
    let selectedObject = null;
    let closestDistance = Infinity;
    
    // First try: raycast against selectable objects directly
    for (let obj of selectableObjects) {
        if (obj.userData.isWall || obj.userData.isTable || obj.userData.isChair) {
            const intersects = raycaster.intersectObject(obj, true);
            if (intersects.length > 0) {
                const distance = intersects[0].distance;
                if (distance < closestDistance) {
                    closestDistance = distance;
                    selectedObject = obj;
                }
            }
        }
    }
    
    // Also check for selection box hits
    if (!selectedObject) {
        const allIntersects = raycaster.intersectObjects(scene.children, true);
        for (let intersect of allIntersects) {
            if (intersect.object.userData.isSelectionBox && intersect.object.userData.parentObject) {
                const parentObj = intersect.object.userData.parentObject;
                if (parentObj.userData.isWall || parentObj.userData.isTable || parentObj.userData.isChair) {
                    const distance = intersect.distance;
                    if (distance < closestDistance) {
                        closestDistance = distance;
                        selectedObject = parentObj;
                    }
                }
            }
        }
    }
    
    // Second try: if no direct hit, check for proximity (larger selection area)
    if (!selectedObject) {
        const mouseWorldPos = new THREE.Vector3();
        raycaster.ray.at(10, mouseWorldPos); // Get a point 10 units along the ray
        
        for (let obj of selectableObjects) {
            if (obj.userData.isWall || obj.userData.isTable || obj.userData.isChair) {
                const distance = obj.position.distanceTo(mouseWorldPos);
                if (distance < 3) { // 3 unit selection radius
                    if (distance < closestDistance) {
                        closestDistance = distance;
                        selectedObject = obj;
                    }
                }
            }
        }
    }
    
    if (selectedObject) {
        if (buildMode) {
            // Start dragging in build mode
            draggedItem = selectableObjects.indexOf(selectedObject);
            if (draggedItem !== -1) {
                draggedItemRotation = Math.round(selectedObject.rotation.y / (Math.PI / 2)) % 4;
                if (draggedItemRotation < 0) draggedItemRotation += 4;
                document.body.classList.add('dragging');
            }
        } else {
            selectWall(selectedObject);
        }
        draggingWall = true;
    }
});

document.addEventListener('pointerup', () => {
    draggingWall = false;
});

// Enhanced mouse move for drag preview
document.addEventListener('mousemove', (event) => {
    if (mode !== 'edit') return;
    
    const mouse = new THREE.Vector2(
        (event.clientX / window.innerWidth) * 2 - 1,
        -(event.clientY / window.innerHeight) * 2 + 1
    );
    const raycaster = new THREE.Raycaster();
    raycaster.setFromCamera(mouse, camera);
    
    // Check floor hover
    const floorIntersects = raycaster.intersectObject(floor);
    if (floorIntersects.length > 0) {
        if (draggedItem !== null) {
            const point = floorIntersects[0].point;
            const newGridPos = vector3ToGrid(point);
            if (!dragPosition || newGridPos[0] !== dragPosition[0] || newGridPos[1] !== dragPosition[1]) {
                dragPosition = newGridPos;
                // Update collision check
                const item = selectableObjects[draggedItem];
                if (item) {
                    canDrop = !checkCollision(item, dragPosition, draggedItemRotation, selectableObjects);
                    
                    // Update drag preview
                    updateDragPreview(item, dragPosition, draggedItemRotation, canDrop);
                }
            }
        }
    }
    
    // Hover effect for non-dragged objects
    if (!draggingWall) {
        // Restore previous hover
        if (hoveredObject && hoveredObject !== selectedWall && hoveredObject.material?.emissive) {
            hoveredObject.material.emissive.set(NORMAL_EMISSIVE);
        }
        hoveredObject = null;
        
        // Improved hover detection
        let closestHoverObject = null;
        let closestHoverDistance = Infinity;
        
        // Check for direct raycast hits
        for (let obj of selectableObjects) {
            if (obj.userData.isWall || obj.userData.isTable || obj.userData.isChair) {
                const intersects = raycaster.intersectObject(obj, true);
    if (intersects.length > 0) {
                    const distance = intersects[0].distance;
                    if (distance < closestHoverDistance) {
                        closestHoverDistance = distance;
                        closestHoverObject = obj;
                    }
                }
            }
        }
        
        // Also check for selection box hover
        if (!closestHoverObject) {
            const allIntersects = raycaster.intersectObjects(scene.children, true);
            for (let intersect of allIntersects) {
                if (intersect.object.userData.isSelectionBox && intersect.object.userData.parentObject) {
                    const parentObj = intersect.object.userData.parentObject;
                    if (parentObj.userData.isWall || parentObj.userData.isTable || parentObj.userData.isChair) {
                        const distance = intersect.distance;
                        if (distance < closestHoverDistance) {
                            closestHoverDistance = distance;
                            closestHoverObject = parentObj;
                        }
                    }
                }
            }
        }
        
        // If no direct hit, check proximity
        if (!closestHoverObject) {
            const mouseWorldPos = new THREE.Vector3();
            raycaster.ray.at(10, mouseWorldPos);
            
            for (let obj of selectableObjects) {
                if (obj.userData.isWall || obj.userData.isTable || obj.userData.isChair) {
                    const distance = obj.position.distanceTo(mouseWorldPos);
                    if (distance < 2) { // Smaller hover radius for better precision
                        if (distance < closestHoverDistance) {
                            closestHoverDistance = distance;
                            closestHoverObject = obj;
                        }
                    }
                }
            }
        }
        
        // Apply hover effect
        if (closestHoverObject && 
            closestHoverObject !== selectedWall && 
            closestHoverObject.material?.emissive && 
            selectableObjects.indexOf(closestHoverObject) !== draggedItem) {
            closestHoverObject.material.emissive.set(HIGHLIGHT_COLOR);
            hoveredObject = closestHoverObject;
        }
    }
});

// Keyboard shortcuts for rotation
document.addEventListener('keydown', (e) => {
    if (mode === 'edit' && draggedItem !== null) {
        if (e.key === 'r' || e.key === 'R') {
            draggedItemRotation = (draggedItemRotation + 1) % 4;
            e.preventDefault();
        }
    }
});

// === LOAD GLB PLAYER MODEL WITH ANIMATION ===
const loader = new GLTFLoader();
const playerMixers = {}; // { [userId]: AnimationMixer }
const playerActions = {}; // { [userId]: { idle: AnimationAction, walk: AnimationAction, current: AnimationAction, isWalking: boolean } }

function createPlayerModel(userId, position, onLoaded) {
    loader.load('./model/Animated Woman.glb', gltf => {
        const model = gltf.scene;
        model.name = userId;
        model.isPlayerModel = true;
        model.scale.set(1, 1, 1);
        model.position.set(position.x, 0, position.z);
        scene.add(model);

        // Animation
        if (gltf.animations && gltf.animations.length > 22) {
            const mixer = new THREE.AnimationMixer(model);
            playerMixers[userId] = mixer;
            const idle = mixer.clipAction(gltf.animations[8]);
            const walk = mixer.clipAction(gltf.animations[22]);
            idle.play();
            playerActions[userId] = { idle, walk, current: idle, isWalking: false };
        }
        onLoaded?.(model);
    });
}

let socket; // Global socket variable

// Helper to play animation for a player
function setPlayerAnimation(userId, animation) {
    const actions = playerActions[userId];
    if (!actions) return;
    if (animation === 'walk' && !actions.isWalking) {
        if (actions.current) actions.current.fadeOut(0.2);
        actions.walk.reset().fadeIn(0.2).play();
        actions.current = actions.walk;
        actions.isWalking = true;
    } else if (animation === 'idle' && actions.isWalking) {
        if (actions.current) actions.current.fadeOut(0.2);
        actions.idle.reset().fadeIn(0.2).play();
        actions.current = actions.idle;
        actions.isWalking = false;
    }
}

// Update drag preview
function updateDragPreview(item, gridPos, rotation, canDrop) {
    // Remove existing preview
    if (dragPreview) {
        scene.remove(dragPreview);
        dragPreview = null;
    }
    
    if (!gridPos) return;
    
    const previewPos = gridToVector3(gridPos);
    
    // Create preview based on item type
    if (item.userData.isWall) {
        const geometry = new THREE.BoxGeometry(2, 2, 0.2);
        const material = new THREE.MeshStandardMaterial({ 
            color: canDrop ? 0x00ff00 : 0xff0000,
            transparent: true,
            opacity: 0.6
        });
        dragPreview = new THREE.Mesh(geometry, material);
        dragPreview.position.copy(previewPos);
        dragPreview.rotation.y = rotation * Math.PI / 2;
    } else if (item.userData.isTable || item.userData.isChair) {
        // Create a simple box preview for 3D models
        const size = item.userData.size || [2, 2];
        const geometry = new THREE.BoxGeometry(size[0], 1, size[1]);
        const material = new THREE.MeshStandardMaterial({ 
            color: canDrop ? 0x00ff00 : 0xff0000,
            transparent: true,
            opacity: 0.6
        });
        dragPreview = new THREE.Mesh(geometry, material);
        dragPreview.position.copy(previewPos);
        dragPreview.rotation.y = rotation * Math.PI / 2;
    }
    
    if (dragPreview) {
        scene.add(dragPreview);
    }
}



// Update object list in GUI
function updateObjectList() {
    const objectList = document.getElementById('objectList');
    if (!objectList) return;
    
    objectList.innerHTML = '';
    
    selectableObjects.forEach((obj, index) => {
        const objectItem = document.createElement('div');
        objectItem.className = 'object-item';
        if (obj === guiSelectedObject) {
            objectItem.classList.add('selected');
        }
        
        const objectName = document.createElement('div');
        objectName.className = 'object-name';
        objectName.textContent = `${obj.userData.isWall ? 'Wall' : obj.userData.isTable ? 'Table' : 'Chair'} ${index + 1}`;
        
        const objectInfo = document.createElement('div');
        objectInfo.className = 'object-info';
        objectInfo.textContent = `Pos: (${obj.position.x.toFixed(1)}, ${obj.position.y.toFixed(1)}, ${obj.position.z.toFixed(1)})`;
        
        objectItem.appendChild(objectName);
        objectItem.appendChild(objectInfo);
        
        objectItem.addEventListener('click', () => {
            selectObjectFromGUI(obj);
        });
        
        objectList.appendChild(objectItem);
    });
}

// Select object from GUI
function selectObjectFromGUI(obj) {
    guiSelectedObject = obj;
    originalTransform = {
        position: obj.position.clone(),
        rotation: obj.rotation.clone(),
        scale: obj.scale.clone()
    };
    
    // Update transform controls
    updateTransformInputs();
    
    // Update visual selection
    selectWall(obj);
    
    // Update object list highlighting
    updateObjectList();
    
    // Show transform panel
    document.getElementById('transformPanel').style.display = 'block';
}

// Update transform input fields
function updateTransformInputs() {
    if (!guiSelectedObject) return;

    const posX = document.getElementById('posX');
    const posY = document.getElementById('posY');
    const posZ = document.getElementById('posZ');
    const rotX = document.getElementById('rotX');
    const rotY = document.getElementById('rotY');
    const rotZ = document.getElementById('rotZ');
    const scaleX = document.getElementById('scaleX');
    const scaleY = document.getElementById('scaleY');
    const scaleZ = document.getElementById('scaleZ');

    if (posX) posX.value = guiSelectedObject.position.x.toFixed(2);
    if (posY) posY.value = guiSelectedObject.position.y.toFixed(2);
    if (posZ) posZ.value = guiSelectedObject.position.z.toFixed(2);
    if (rotX) rotX.value = (guiSelectedObject.rotation.x * 180 / Math.PI).toFixed(1);
    if (rotY) rotY.value = (guiSelectedObject.rotation.y * 180 / Math.PI).toFixed(1);
    if (rotZ) rotZ.value = (guiSelectedObject.rotation.z * 180 / Math.PI).toFixed(1);
    if (scaleX && scaleY && scaleZ) {
        if (guiSelectedObject.userData && guiSelectedObject.userData.isWall &&
            guiSelectedObject.geometry && guiSelectedObject.geometry.parameters) {
            // Set to initial wall geometry size
            scaleX.value = guiSelectedObject.geometry.parameters.width?.toFixed(2) || '2.2';
            scaleY.value = guiSelectedObject.geometry.parameters.height?.toFixed(2) || '2.2';
            scaleZ.value = guiSelectedObject.geometry.parameters.depth?.toFixed(2) || '0.3';
        } else {
            scaleX.value = guiSelectedObject.scale.x.toFixed(2);
            scaleY.value = guiSelectedObject.scale.y.toFixed(2);
            scaleZ.value = guiSelectedObject.scale.z.toFixed(2);
        }
    }
}

// Apply transform from GUI inputs
function applyTransformFromGUI() {
    if (!guiSelectedObject) return;
    
    const posX = parseFloat(document.getElementById('posX').value) || 0;
    const posY = parseFloat(document.getElementById('posY').value) || 0;
    const posZ = parseFloat(document.getElementById('posZ').value) || 0;
    const rotX = (parseFloat(document.getElementById('rotX').value) || 0) * Math.PI / 180;
    const rotY = (parseFloat(document.getElementById('rotY').value) || 0) * Math.PI / 180;
    const rotZ = (parseFloat(document.getElementById('rotZ').value) || 0) * Math.PI / 180;
    const scaleX = parseFloat(document.getElementById('scaleX').value) || 1;
    const scaleY = parseFloat(document.getElementById('scaleY').value) || 1;
    const scaleZ = parseFloat(document.getElementById('scaleZ').value) || 1;
    
    guiSelectedObject.position.set(posX, posY, posZ);
    guiSelectedObject.rotation.set(rotX, rotY, rotZ);
    guiSelectedObject.scale.set(scaleX, scaleY, scaleZ);
    
    // Update grid position for walls and tables
    if (guiSelectedObject.userData.isWall || guiSelectedObject.userData.isTable || guiSelectedObject.userData.isChair) {
        guiSelectedObject.userData.gridPosition = vector3ToGrid(guiSelectedObject.position);
    }
}

// Reset transform to original values
function resetTransform() {
    if (!guiSelectedObject || !originalTransform) return;
    
    guiSelectedObject.position.copy(originalTransform.position);
    guiSelectedObject.rotation.copy(originalTransform.rotation);
    guiSelectedObject.scale.copy(originalTransform.scale);
    
    updateTransformInputs();
}

// Confirm changes and sync to server
function confirmTransformChanges() {
    if (!guiSelectedObject) return;
    
    // Apply current GUI values
    applyTransformFromGUI();
    
    // Sync to server
    if (guiSelectedObject.userData.isWall) {
        emitWallUpdate(guiSelectedObject);
    } else if (guiSelectedObject.userData.isTable) {
        emitTableUpdate(guiSelectedObject);
    } else if (guiSelectedObject.userData.isChair) {
        emitChairUpdate(guiSelectedObject);
    }
    
    // Update original transform
    originalTransform = {
        position: guiSelectedObject.position.clone(),
        rotation: guiSelectedObject.rotation.clone(),
        scale: guiSelectedObject.scale.clone()
    };
    
    // Update object list
    updateObjectList();
    
    console.log('Transform changes confirmed and synced to server');
}

document.addEventListener('DOMContentLoaded', function() {
    // Initialize audio
    initializeAudio();
    
    // Initialize chat minimize functionality
    initializeChatMinimize();
    
    // Splash screen logic
    const splash = document.getElementById('splashScreen');
    const mainMenu = document.getElementById('mainMenu');
    mainMenu.style.display = 'none';
    setTimeout(() => {
        splash.style.display = 'none';
        mainMenu.style.display = 'flex';
    }, 1200);
    
    // Set up transform control event listeners
    document.getElementById('confirmTransform')?.addEventListener('click', confirmTransformChanges);
    document.getElementById('resetTransform')?.addEventListener('click', resetTransform);
    
            // Set up real-time transform updates
        const transformInputs = ['posX', 'posY', 'posZ', 'rotX', 'rotY', 'rotZ', 'scaleX', 'scaleY', 'scaleZ'];
        transformInputs.forEach(id => {
            const input = document.getElementById(id);
            if (input) {
                input.addEventListener('input', () => {
                    if (guiSelectedObject) {
                        applyTransformFromGUI();
                    }
                });
            }
        });
        
        // Add Enter key support for chat
        const msgInput = document.getElementById('msg');
        if (msgInput) {
            msgInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') {
                    sendMessage();
                }
            });
        }
    
    // === MAIN MENU LOGIN ===
    let playerName = '';
    let gameStarted = false;

    function showMainMenu() {
        document.getElementById('mainMenu').style.display = 'flex';
        // Hide chat elements in main menu
        document.getElementById('msg').style.display = 'none';
        document.querySelector('button[onclick="sendMessage()"]').style.display = 'none';
        document.getElementById('error').style.display = 'none';
        document.getElementById('messages').style.display = 'none';
        document.getElementById('users').style.display = 'none';
        document.querySelector('button[onclick="window.open(window.location.href, \'_blank\')"]').style.display = 'none';
    }
    function hideMainMenu() {
        document.getElementById('mainMenu').style.display = 'none';
        // Show chat elements when game starts
        document.getElementById('msg').style.display = 'block';
        document.querySelector('button[onclick="sendMessage()"]').style.display = 'block';
        document.getElementById('error').style.display = 'block';
        document.getElementById('messages').style.display = 'block';
        document.getElementById('users').style.display = 'block';
        document.querySelector('button[onclick="window.open(window.location.href, \'_blank\')"]').style.display = 'block';
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
        startGame();
        // Start background music when game starts
        startBackgroundMusic();
    };

    // --- Socket/game logic moved to a function ---
    function startGame() {
        socket = io('http://localhost:3000', { query: { name: playerName } });

        socket.on('connect', () => {
            console.log('Connected to server as:', socket.id, 'with name', playerName);
        });

        socket.on('userList', (userList) => {
            // Only remove player models, not static scene objects
            scene.children
                .filter(obj => obj.isPlayerModel)
                .forEach(obj => {
                    if (!userList.some(user => user.id === obj.name)) {
                        // Remove name label if present
                        const label = obj.getObjectByName('label');
                        if (label) obj.remove(label);
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
                // Animate remote players based on their moving state if available
                setPlayerAnimation(user.id, user.moving);
    });
});

        socket.on('userMoved', ({ id, position, rotation, animation }) => {
            const player = scene.getObjectByName(id);
            if (player) {
                player.position.set(position.x, 0, position.z);
                player.rotation.y = rotation; // Apply rotation
                setPlayerAnimation(id, animation); // Use animation string
            }
        });

        // Wall sync: always render the full wall list
        socket.on('wallList', (wallList) => {
            console.log('wallList event received:', wallList);
            // Remove all walls
            scene.children.filter(obj => obj.userData?.isWall).forEach(obj => {
                if (selectedWall === obj) transformControls.detach();
                    scene.remove(obj);
                removeFromSelectable(obj);
                });
            
            // Add all walls from server
            wallList.forEach(wallData => {
                console.log('Wall from server:', wallData);
                const geometry = new THREE.BoxGeometry(wallData.scale.x, wallData.scale.y, wallData.scale.z);
                // Clone the current wall texture for each wall
                const tex = loadTexture(textureFiles[wallTextureIndex], 1, 1);
                const material = new THREE.MeshStandardMaterial({ map: tex });
                const wall = new THREE.Mesh(geometry, material);
                wall.position.set(wallData.position.x, wallData.position.y, wallData.position.z);
                wall.rotation.set(wallData.rotation.x, wallData.rotation.y, wallData.rotation.z);
                wall.castShadow = true;
                wall.userData.isWall = true;
                wall.userData.wallId = wallData.id;
                wall.userData.size = [wallData.scale.x, wallData.scale.z];
                wall.userData.gridPosition = vector3ToGrid(wall.position);
                createWallOutline(wall);
                scene.add(wall);
                selectableObjects.push(wall);
            });
            
            // Update GUI after loading walls
            if (buildMode) {
                updateObjectList();
            }
        });

        // Table sync: always render the full table list
        socket.on('tableList', (tableList) => {
            console.log('tableList event received:', tableList);
            // Remove all tables
            scene.children.filter(obj => obj.userData?.isTable).forEach(obj => {
                if (selectedWall === obj) transformControls.detach();
                    scene.remove(obj);
                removeFromSelectable(obj);
                });
            
            // Add all tables from server
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
                    table.userData.size = [2, 2];
                    table.userData.gridPosition = vector3ToGrid(table.position);
                    
                    // Add invisible selection box for better selection
                    createSelectionBox(table, [3, 2, 3]);
                    
                    scene.add(table);
                    selectableObjects.push(table);
                });
            });
            
            // Update GUI after loading tables
            if (buildMode) {
                updateObjectList();
            }
        });

        // Chair sync: always render the full chair list
        socket.on('chairList', (chairList) => {
            console.log('chairList event received:', chairList);
            // Remove all chairs
            scene.children.filter(obj => obj.userData?.isChair).forEach(obj => {
                if (selectedWall === obj) transformControls.detach();
                scene.remove(obj);
                removeFromSelectable(obj);
            });
            
            // Add all chairs from server
            chairList.forEach(chairData => {
                console.log('Chair from server:', chairData);
                const chairLoader = new GLTFLoader();
                chairLoader.load('./model/chair/rustic_chair/scene.gltf', gltf => {
                    const chair = gltf.scene;
                    chair.position.set(chairData.position.x, chairData.position.y, chairData.position.z);
                    chair.rotation.set(chairData.rotation.x, chairData.rotation.y, chairData.rotation.z);
                    chair.scale.set(chairData.scale.x, chairData.scale.y, chairData.scale.z);
                    chair.userData.isChair = true;
                    chair.userData.chairId = chairData.id;
                    chair.userData.size = [1, 1];
                    chair.userData.gridPosition = vector3ToGrid(chair.position);
                    
                    // Add invisible selection box for better selection
                    createSelectionBox(chair, [2, 2, 2]);
                    
                    scene.add(chair);
                    selectableObjects.push(chair);
            });
            });
            
            // Update GUI after loading chairs
            if (buildMode) {
                updateObjectList();
            }
        });

        // === PLAYER MOVEMENT ===
        function move() {
            if (mode !== 'play') return;
            const player = scene.getObjectByName(socket.id);
            if (!player) return;
            let moving = false;

            // WASD movement in world space
            const moveSpeed = 0.1;
            let moveX = 0, moveZ = 0;
            if (keys['w']) { moveZ += moveSpeed; moving = true; } // forward
            if (keys['s']) { moveZ -= moveSpeed; moving = true; } // backward
            if (keys['a']) { moveX += moveSpeed; moving = true; } // left
            if (keys['d']) { moveX -= moveSpeed; moving = true; } // right
            if (moveX !== 0 || moveZ !== 0) {
                player.position.x += moveX;
                player.position.z += moveZ;
                // Set player rotation to face movement direction (fix left/right)
                const angle = Math.atan2(moveX, moveZ);
                player.rotation.y = angle;
                socket.emit('move', {
                    id: socket.id,
                    position: player.position,
                    rotation: player.rotation.y,
                    animation: 'walk',
                    moving: true
                });
            } else {
                // Emit idle state if not moving
                socket.emit('move', {
                    id: socket.id,
                    position: player.position,
                    rotation: player.rotation.y,
                    animation: 'idle',
                    moving: false
                });
            }

            // Camera always at fixed offset
            const cameraOffset = new THREE.Vector3(0, 5, -10);
            camera.position.copy(player.position).add(cameraOffset);
            camera.lookAt(player.position);
            
            // Animation switching for local player
            setPlayerAnimation(socket.id, moving ? 'walk' : 'idle');
        }

        // === ANIMATION LOOP ===
        function animate() {
            renderer.render(scene, camera);
            labelRenderer.render(scene, camera);
            if (gameStarted) move();
            const delta = 1/60;
            for (const id in playerMixers) {
                playerMixers[id].update(delta);
            }
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

// Update functions for server sync
function emitWallUpdate(wall) {
    if (!wall.userData.wallId) return;
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

function emitChairUpdate(chair) {
    if (!chair.userData.chairId) return;
    socket.emit('updateChair', {
        id: chair.userData.chairId,
        position: { x: chair.position.x, y: chair.position.y, z: chair.position.z },
        rotation: { x: chair.rotation.x, y: chair.rotation.y, z: chair.rotation.z },
        scale: { x: chair.scale.x, y: chair.scale.y, z: chair.scale.z }
    });
}
