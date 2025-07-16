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
const camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 1000);
camera.position.set(0, 5, -10);

// === LIGHTING ===
const ambientLight = new THREE.AmbientLight(0xffffff, 2);
scene.add(ambientLight);

const directionalLight = new THREE.DirectionalLight(0xffffff, 1);
directionalLight.position.set(5, 10, 7.5);
scene.add(directionalLight);

// === FLOOR WITH GRID ===
const floorGeometry = new THREE.PlaneGeometry(100, 100);
const floorMaterial = new THREE.MeshStandardMaterial({ color: 'gray' });
const floor = new THREE.Mesh(floorGeometry, floorMaterial);
floor.rotation.x = -Math.PI / 2;
floor.position.y = 0;
floor.receiveShadow = true;
scene.add(floor);

const grid = new THREE.GridHelper(100, 100, 'lightgray', 'black');
grid.position.y = 0.01; // Slightly above the floor to avoid z-fighting
scene.add(grid);

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

// === MOVEMENT CONTROL ===
const keys = {};
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

// === WALL CREATION AND MANIPULATION ===
let selectedWall = null;
let draggingWall = false;

function snapToGrid(value, gridSize = 1) {
    return Math.round(value / gridSize) * gridSize;
}

function createWall() {
    const geometry = new THREE.BoxGeometry(2, 2, 0.2); // default wall size
    const material = new THREE.MeshStandardMaterial({ color: 0xffffff });
    const wall = new THREE.Mesh(geometry, material);
    wall.position.set(0, 1, 0); // y=1 so it sits on floor
    wall.castShadow = true;
    wall.userData.isWall = true;
    scene.add(wall);
    selectWall(wall);
}

function selectWall(wall) {
    if (selectedWall) {
        selectedWall.material.emissive?.set(0x000000);
    }
    selectedWall = wall;
    if (selectedWall && selectedWall.material.emissive) {
        selectedWall.material.emissive.set(0x2222ff); // highlight selected
    }
    // Attach Unity-like gizmo
    transformControls.attach(wall);
    transformControls.visible = true;
}

document.getElementById('addWallBtn').addEventListener('click', createWall);

document.addEventListener('pointerdown', (event) => {
    // Raycast to select wall
    const mouse = new THREE.Vector2(
        (event.clientX / window.innerWidth) * 2 - 1,
        -(event.clientY / window.innerHeight) * 2 + 1
    );
    const raycaster = new THREE.Raycaster();
    raycaster.setFromCamera(mouse, camera);
    const intersects = raycaster.intersectObjects(scene.children, false);
    for (let i = 0; i < intersects.length; i++) {
        if (intersects[i].object.userData.isWall) {
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
    if (!draggingWall || !selectedWall) return;
    const mouse = new THREE.Vector2(
        (event.clientX / window.innerWidth) * 2 - 1,
        -(event.clientY / window.innerHeight) * 2 + 1
    );
    const raycaster = new THREE.Raycaster();
    raycaster.setFromCamera(mouse, camera);
    // Intersect with floor
    const intersects = raycaster.intersectObject(floor);
    if (intersects.length > 0) {
        const pt = intersects[0].point;
        selectedWall.position.x = snapToGrid(pt.x, 1);
        selectedWall.position.z = snapToGrid(pt.z, 1);
    }
});

// document.addEventListener('keydown', (event) => {
//     if (!selectedWall) return;
//     let moved = false;
//     let gridSize = 1;
//     switch(event.key) {
//         case 'ArrowUp':
//             selectedWall.position.z -= gridSize; moved = true; break;
//         case 'ArrowDown':
//             selectedWall.position.z += gridSize; moved = true; break;
//         case 'ArrowLeft':
//             selectedWall.position.x -= gridSize; moved = true; break;
//         case 'ArrowRight':
//             selectedWall.position.x += gridSize; moved = true; break;
//         case 'r': // rotate 90 deg
//             selectedWall.rotation.y += Math.PI/2; break;
//         case 'R': // rotate -90 deg
//             selectedWall.rotation.y -= Math.PI/2; break;
//         case 't': // scale up
//             selectedWall.scale.x += 0.1; selectedWall.scale.y += 0.1; break;
//         case 'T': // scale down
//             selectedWall.scale.x = Math.max(0.1, selectedWall.scale.x - 0.1);
//             selectedWall.scale.y = Math.max(0.1, selectedWall.scale.y - 0.1); break;
//     }
//     if (moved) {
//         selectedWall.position.x = snapToGrid(selectedWall.position.x, gridSize);
//         selectedWall.position.z = snapToGrid(selectedWall.position.z, gridSize);
//     }
// });

// === LOAD GLB PLAYER MODEL ===
const loader = new GLTFLoader();

function createPlayerModel(userId, position, onLoaded) {
    loader.load('./model/male.glb', gltf => {
        const model = gltf.scene;
        model.name = userId;
        model.scale.set(0.01, 0.01, 0.01);
        model.position.set(position.x, 0, position.z);
        scene.add(model);
        console.log("Model loaded:", model);
        onLoaded?.(model);
    }, undefined, error => {
        console.error("Failed to load GLB model:", error);
    });
}

// === SOCKET.IO CONNECTION ===
const socket = io('http://localhost:3000');
let currentUser = "";

socket.on('connect', () => {
    console.log('Connected to server as:', socket.id);
});

socket.on('userList', (userList) => {
    scene.children.forEach(obj => {
        if (!userList.some(user => obj.name === obj.name)) {
            scene.remove(obj);
        }
    });

    const ul = document.getElementById('users');
    ul.innerHTML = '';

    userList.forEach(user => {
        const li = document.createElement('li');
        li.textContent = "User " + user.index + (user.id === socket.id ? " (You)" : "");
        ul.appendChild(li);

        const existing = scene.getObjectByName(user.id);
        if (!existing) {
            createPlayerModel(user.id, user.position, model => {
                if (user.id === socket.id) {
                    currentUser = "User " + user.index;

                    const labelDiv = document.createElement('div');
                    labelDiv.textContent = "You";
                    labelDiv.style.color = 'white';

                    const labelObj = new CSS2DObject(labelDiv);
                    labelObj.position.set(0, -1.5, 0);
                    labelObj.name = "label";
                    model.add(labelObj);
                }
            });
        } else {
            existing.position.set(user.position.x, 0, user.position.z);
        }
    });
});

socket.on('userMoved', ({ id, position }) => {
    const player = scene.getObjectByName(id);
    if (player) {
        player.position.set(position.x, 0, position.z);
    }
});

// === PLAYER MOVEMENT ===
function move() {
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
    move();
}
renderer.setAnimationLoop(animate);

// === CHAT FUNCTIONALITY ===
function sendMessage() {
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
        sender: currentUser
    });

    const li = document.createElement('li');
    li.textContent = "You said: " + msg;
    document.getElementById('messages').appendChild(li);
}
window.sendMessage = sendMessage;

socket.on('message', (msg) => {
    const li = document.createElement('li');
    li.textContent = `${msg.sender} said: ${msg.text}`;
    document.getElementById('messages').appendChild(li);
});
