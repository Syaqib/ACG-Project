import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { CSS2DRenderer, CSS2DObject } from 'three/addons/renderers/CSS2DRenderer.js';

// renderer
const renderer = new THREE.WebGLRenderer();
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1)); // cap pixel ratio
renderer.setSize(window.innerWidth * 98 / 100, window.innerHeight * 98 / 100);
document.body.appendChild(renderer.domElement);
renderer.domElement.style.display = "block";
// document.body.style.display = "block"

window.addEventListener('resize', function() {
    camera.aspect = window.innerWidth * 98 / 100 / window.innerHeight * 98 / 100;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth * 98 / 100, window.innerHeight * 98 / 100);
});

// gui renderer
export const labelRenderer = new CSS2DRenderer();
labelRenderer.setSize(window.innerWidth, window.innerHeight);
labelRenderer.domElement.style.position = "absolute";
labelRenderer.domElement.style.left = '50%';
labelRenderer.domElement.style.top = '50%';
labelRenderer.domElement.style.transform = 'translate(-50%, -50%)';
labelRenderer.domElement.style.pointerEvents = "none";
document.body.appendChild(labelRenderer.domElement);

// scene
const scene = new THREE.Scene();

// camera
const camera = new THREE.PerspectiveCamera( 45, window.innerWidth * 98 / 100 / window.innerHeight * 98 / 100, 0.1, 1000 );
camera.position.set(0, 20, -30);

// orbitcontrol
const orbit = new OrbitControls(camera, renderer.domElement);
orbit.enableDamping = true;
orbit.dampingFactor = 0.05;
orbit.maxDistance = 50 // max zoom distance, 200 if want zoom in
orbit.minDistance = 25 // min zoom distance, 50 if want zoom out
orbit.maxPolarAngle = Math.PI / 2 // max vertical rotation 90
orbit.minPolarAngle = Math.PI / 4; // min vertical rotation -90
orbit.mouseButtons = {
    LEFT: THREE.MOUSE.ROTATE,  // Left button rotates
    MIDDLE: THREE.MOUSE.DOLLY, // Middle button zooms
    RIGHT: '',
};

// player
function createCube(color) {
    const geometry = new THREE.BoxGeometry();
    const material = new THREE.MeshBasicMaterial({ color: new THREE.Color(color[0], color[1], color[2]) });
    return new THREE.Mesh(geometry, material);
}

// player control
const keys = {};
document.addEventListener('keydown', e => keys[e.key] = true);
document.addEventListener('keyup', e => keys[e.key] = false);

let velocity = new THREE.Vector3();
let forward = new THREE.Vector3();
let right = new THREE.Vector3();

function move(){
    if (scene.getObjectByName(socket.id)) {

        orbit.target.copy(scene.getObjectByName(socket.id).position); // change camera orbit target to player
        orbit.update();

        velocity = new THREE.Vector3();

        forward = new THREE.Vector3();
        right = new THREE.Vector3();

        camera.getWorldDirection(forward);     
        forward.y = 0;
        forward.normalize();

        right.copy(forward).cross(camera.up);
        right.normalize();

        if (keys['w']) velocity.add(forward);
        if (keys['s']) velocity.sub(forward);
        if (keys['a']) velocity.sub(right);
        if (keys['d']) velocity.add(right);

        if (velocity.lengthSq() > 0) {
            velocity.normalize().multiplyScalar(0.05); // movement speed
            scene.getObjectByName(socket.id).position.add(velocity);

            // Send position to server
            socket.emit('move', {
                id: socket.id,
                position: scene.getObjectByName(socket.id).position
            });
        }

    }
}

// update
function animate() {
    renderer.render(scene, camera);
    labelRenderer.render(scene, camera)

    move()
}

renderer.setAnimationLoop(animate);

// socket.io
const socket = io('http://localhost:3000');
let currentUser;

socket.on('userList', (userList) => {

    scene.children.forEach((child) => {
        if(!userList.map(user => user.id).some(keyword =>child.name.includes(keyword))){
            scene.getObjectByName(child.name).geometry.dispose();
            scene.getObjectByName(child.name).material.dispose();
            scene.remove(scene.getObjectByName(child.name));
            // console.log(userList.map(user => user.id).some(keyword =>child.name.includes(keyword)))
            // console.log("removed " + child.name)
        }
    });

    const ul = document.getElementById('users');
    ul.innerHTML = '';
    userList.forEach((user, i) => {
        const li = document.createElement('li');
        li.textContent = "User " + user.index + ( user.id == socket.id ? " (You) " : " " );
        ul.appendChild(li);

        if (!scene.getObjectByName(user.id)) {
            const cube = createCube(user.color.toString(2).padStart(3, '0'));
            cube.name = user.id
            scene.add(cube);
            // console.log(user.index.toString(2).padStart(3, '0'))
            // console.log("added " + user.id)
        }else{
            scene.getObjectByName(user.id).position.set(user.position.x, user.position.y, user.position.z);
        }

        if(user.id == socket.id){
            currentUser = "User " + user.index

            let div = document.createElement('div');
            div.id = "gui";
            div.style.color = 'white';
            div.textContent = "You"
            // div.innerHTML = "<p style='color:white'>You</p>"
            let divLabel = new CSS2DObject(div)
            divLabel.position.set(0, -6, 0)
            divLabel.name = '"gui'
            scene.getObjectByName(socket.id).add(divLabel);
        }
    });

    socket.on('userMoved', ({ id, position }) => {
        if (scene.getObjectByName(id)) {
            scene.getObjectByName(id).position.set(position.x, position.y, position.z);
        }
    });
});

socket.on('connect', () => {
    console.log('Connected to server');
});

function sendMessage() {
    const msg = document.getElementById('msg').value;
    if(!msg){
        document.getElementById('error').textContent = "Please enter your message";
        return
    }
    document.getElementById('error').textContent = "";
    document.getElementById('msg').value = ""
    socket.emit('message', {
        text: msg,
        sender: currentUser
    });

    const li = document.createElement('li');
    li.textContent = "You said : " + msg;
    document.getElementById('messages').appendChild(li);
}

window.sendMessage = sendMessage; // ✅ expose globally

socket.on('message', (msg) => {
    const li = document.createElement('li');
    li.textContent = msg.sender + " said " + msg.text;
    document.getElementById('messages').appendChild(li);
});
