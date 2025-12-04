import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { canvasRenderSetUp, cameraSetUp, boardSetUp, addDart, roomSetUp, calcCameraOffset, getLookAtPos, handleMousemove, handleMouseclick, respawn, resetDartPos } from './graphics.js'


const dartboardPosition = new THREE.Vector3(237, 173, 0);
const dartThrowingPosition = new THREE.Vector3(0, 170, 0);
const dartCamStartPos = new THREE.Vector3(dartThrowingPosition.x - 10, dartThrowingPosition.y + 3, dartThrowingPosition.z) // (-10,173,0)
const startingspeed = 2000;
const timeInterval = 0.001; 
let target = new THREE.Vector3(237,173,0); // Initialize mouse target
let dartboard; // define dartboard globally 
let dartWrapper = new THREE.Object3D(); // dart and dartWrapper aswell 
let dart; 
let backWall; // backwall declared globally as required for raycasting
const canvas = document.querySelector('#c');
const canvasWidth = canvas.clientWidth;
const canvasHeight = canvas.clientHeight;
let camera
let renderer
const scene = new THREE.Scene();
let mouse = new THREE.Vector2();
const raycaster = new THREE.Raycaster();
renderer = canvasRenderSetUp();
camera = cameraSetUp();
const gltfLoader = new GLTFLoader();

let mostRecentScore = 0

// create two lights that sit behind the camera
{
    const color = 0xFFFFFF;
    const intensity = 5;
    const light = new THREE.DirectionalLight( color, intensity );
    light.position.set( -5, 0, 0);
    scene.add( light );
}
{
    const color = 0xFFFFFF;
    const intensity = 5;
    const light = new THREE.DirectionalLight( color, intensity );
    light.position.set(dartboardPosition.x+5, dartboardPosition.y, dartboardPosition.z);
    scene.add( light );
}

boardSetUp(gltfLoader, scene)
addDart(gltfLoader, scene);
roomSetUp(scene)

// look out for window resizing 
window.addEventListener('resize', () => {
    const width = canvas.clientWidth;
    const height = canvas.clientHeight;
    renderer.setSize(width, height, false);
    renderer.setPixelRatio(window.devicePixelRatio);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
});


// temp M and L keys for testing
document.addEventListener('keydown', (event) => {
    switch (event.code) {
    case 'Space':
        respawn()
    }
});





let rotateRight = true
renderer.render(scene, camera);
function render(time) {
    renderer.render(scene, camera);


    // rotate animation while waiting for mouse to be on screen ?? 
    // if (target.z > 100) {
    //   rotateRight = false; // Stop rotating when target is too far
    // } else if (target.z < -100) {
    //   rotateRight = true; // Reverse direction when target is too close
    // }

    // if (rotateRight) {
    //   target.z += 1; // Rotate the dart to the right
    // } else {
    //   target.z -= 1; // Rotate the dart to the left
    // }
    
    // dartWrapper.lookAt(target);


    requestAnimationFrame(render);
}

requestAnimationFrame(render);









// !!! ALL THINGS SOCKETIO 
// Connect to Flask Socket.IO
// const socket = io("http://192.168.0.233:5000");
const socket = io("http://127.0.0.1:5000");

// const gameCode : global variable passed through room.html page
// const username : global variable passed through room.html page

socket.on('connect', () => {
    socket.emit('joinRoom', {'gameCode': gameCode, 'username': username})
})

// all things input button
const startGameButton = document.getElementById('startGame')
const scoreInput = document.getElementById("scoreInput")
const sendScoreBtn = document.getElementById("sendScoreBtn")
const scoreDisplaySpan = document.getElementById("scoreDisplaySpan")
const player1ScoreSpan = document.getElementById("player1ScoreSpan")
const player2ScoreSpan = document.getElementById("player2ScoreSpan")
const playerTurnSpan = document.getElementById("playerTurnSpan")
const playerTurnDiv = document.getElementById("playerTurnDiv")
const mostRecentScoreSpan = document.getElementById('mostRecentScoreSpan')
const resetDartPosBtn = document.getElementById('resetDartPos')
let isDouble
let resultsArray 

startGameButton.addEventListener("click", startGame)
sendScoreBtn.addEventListener("click", sendScore)



function handleMouseclickEventHandler(e) {
    disableDartThrow()
    disableDartResetPosBtn()
    resultsArray = handleMouseclick(e)
    mostRecentScore = resultsArray[0]
    isDouble = resultsArray[1]
    mostRecentScoreSpan.innerHTML = mostRecentScore, isDouble
    socket.emit('sendThrowForOtherUser', {'e': e, 'gameCode': gameCode})
    socket.emit('sendScore', {'score': mostRecentScore, 'gameCode': gameCode, 'isDouble':isDouble})
}

function enableDartResetPosBtn() {
    // calls reset dart pos function from graphics.js
    resetDartPosBtn.addEventListener("click", resetDartPosHandler)
    resetDartPosBtn.style.display = "block"

}

function disableDartResetPosBtn() {
    resetDartPosBtn.removeEventListener("click", resetDartPosHandler)
    resetDartPosBtn.style.display = "none"
}

function resetDartPosHandler() {
    console.log('youve just pressed me and now im resetting dart and letting you aim')
    resetDartPos()
    enableDartThrow()
}

function enableDartThrow() {
    console.log('throw enabled through enableDartThrow')
    canvas.addEventListener('mousemove', handleMousemove)
    canvas.addEventListener('mousedown', handleMouseclickEventHandler)
}

function disableDartThrow() {
    console.log('disabled')
    canvas.removeEventListener('mousemove', handleMousemove)
    canvas.removeEventListener('mousedown', handleMouseclickEventHandler)
}

function startGame() {
    socket.emit('startGame', {'gameCode': gameCode})
}

function sendScore() {
    console.log(`Sending score ${scoreInput.value} for user ${username} in game ${gameCode}`)
    socket.emit('sendScore', {'score': scoreInput.value, 'gameCode': gameCode, 'isDouble':true})
}



socket.on('beginGameFrontEnd', (data) => {
    player1ScoreSpan.innerText = data.player1Info
    player2ScoreSpan.innerText = data.player2Info
    playerTurnSpan.innerText = data.playerTurn
    startGameButton.style.display = "none"
    playerTurnDiv.style.display = "block"
})

socket.on('scoreUpdate', (data) => {
    player1ScoreSpan.innerText = data.player1Info
    player2ScoreSpan.innerText = data.player2Info
    playerTurnSpan.innerText = data.playerTurn
})

socket.on('enableDartResetPosBtn', (data) => {
    console.log('enabling the button')
    enableDartResetPosBtn()
})

socket.on('enableThrow', (data) => {
    enableDartThrow()
})
socket.on('disableThrow', (data) => {
    disableDartThrow()
})
socket.on('terminateGame', (data) => {
    disableDartThrow()
    console.log(data.winner, 'is the winner!')
})

socket.on('receiveOtherUserThrow', (data) => {
    console.log('receiving the other user throw')
    console.log(data.e)
})