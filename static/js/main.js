import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { canvasRenderSetUp, cameraSetUp, handleMousemove, handleMouseclick, handleOtherUserThrow, resetDartPos, initGraphics } from './graphics.js'


// graphics side: define globals and invoke initGraphics
let target = new THREE.Vector3(237,173,0); // Initialize mouse target
const canvas = document.querySelector('#c');
let camera
let renderer
renderer = canvasRenderSetUp();
camera = cameraSetUp();
let mostRecentScore = 0

initGraphics() 


// SOCKETIO side: Connect to Flask Socket.IO
// const socket = io("http://192.168.68.111:5000");  // :: for local network
const socket = io("http://127.0.0.1:5000");         // :: for local host

// html elements 
const startGameButton = document.getElementById('startGame')
const scoreContainerDiv = document.getElementById("scoreContainerDiv")
const player1ScoreSpan = document.getElementById("player1ScoreSpan")
const player2ScoreSpan = document.getElementById("player2ScoreSpan")
const playerTurnSpan = document.getElementById("playerTurnSpan")
const playerTurnDiv = document.getElementById("playerTurnDiv")
const mostRecentScoreSpan = document.getElementById('mostRecentScoreSpan')
const roomCodeP = document.getElementById('roomCodeP')
const playerTurnP = document.getElementById('playerTurnP')
const errorMessageDiv = document.getElementById('errorMessage')
const resetDartPosBtn = document.getElementById('resetDartPos')
let isDouble
let resultsArray
let errorTimeout

startGameButton.addEventListener("click", startGame)

async function handleMouseclickEventHandler(e) {
    disableDartThrow()
    disableDartResetPosBtn()
    resultsArray = await handleMouseclick(e)
    // execute after handleMouseClick:
    mostRecentScore = resultsArray[0]
    isDouble = resultsArray[1]
    target = resultsArray[2]
    mostRecentScoreSpan.innerHTML = mostRecentScore, isDouble
    socket.emit('sendThrowForOtherUser', {'target': target, 'gameCode': gameCode})
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
    socket.emit('resetDartPos', {'gameCode': gameCode})
    resetDartPos()
    enableDartThrow()
}
function resetDartPosForOtherUser() {
    resetDartPos()
}
function enableDartThrow() {
    canvas.addEventListener('mousemove', handleMousemove)
    canvas.addEventListener('mousedown', handleMouseclickEventHandler)
}
function disableDartThrow() {
    canvas.removeEventListener('mousemove', handleMousemove)
    canvas.removeEventListener('mousedown', handleMouseclickEventHandler)
}
function startGame() {
    socket.emit('startGame', {'gameCode': gameCode})
}

// socket event handlers 
socket.on("connect", () => {
    socket.emit('joinRoom', {'gameCode': gameCode, 'username': username})
    resetDartPosBtn.style.display = "none"
});
socket.on('beginGameFrontEnd', (data) => {
    roomCodeP.style.display = "none"
    playerTurnP.style.display = "block"
    playerTurnSpan.innerText = data.playerTurn
    player1ScoreSpan.innerText = data.player1Info
    player2ScoreSpan.innerText = data.player2Info
    scoreContainerDiv.style.display = "block"
    startGameButton.style.display = "none"
    playerTurnDiv.style.display = "block"
})
socket.on('scoreUpdate', (data) => {
    player1ScoreSpan.innerText = data.player1Info
    player2ScoreSpan.innerText = data.player2Info
    playerTurnSpan.innerText = data.playerTurn
})
socket.on('enableDartResetPosBtn', (data) => {
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
    disableDartResetPosBtn() 
})
socket.on('receiveOtherUserThrow', (data) => {
    handleOtherUserThrow(data.target)
})
socket.on('resetDartPosForOtherUser', (data) => {
    resetDartPosForOtherUser()
})
socket.on('clientError', (data) => {
    clearTimeout(errorTimeout)
    errorMessageDiv.style.display = "block";
    errorMessageDiv.innerHTML = '<p>' + data.errorMessage + '</p>'
    errorTimeout = setTimeout(() => {
        errorMessageDiv.style.display = "none";
    }, 2000);
});