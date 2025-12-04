import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';


import { getInitialVelocities, calcNextPos } from './throwPhysics.js';
import { getPoints } from './getPoints.js';


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


let mostRecentScore = 0
let isDouble 

export function canvasRenderSetUp() {
  renderer = new THREE.WebGLRenderer({antialias: true, canvas});
  renderer.setPixelRatio(window.devicePixelRatio);
  renderer.setSize(canvasWidth, canvasHeight, false);   // set to aspect of canvas not full window
  return renderer;
}
export function cameraSetUp() {
  // put a camera at 0,0,0, looking towards the board
  camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
  camera.position.set(dartCamStartPos.x, dartCamStartPos.y, dartCamStartPos.z);
  camera.lookAt(dartboardPosition);
  camera.aspect = canvasWidth / canvasHeight;
  camera.updateProjectionMatrix();


  return camera
  }
export function boardSetUp(gltfLoader, scene) {
  // import dart board and position it at 237,0,0
  gltfLoader.load(window.Dartboard_Path, (gltfScene) => {
    dartboard = gltfScene.scene;
    scene.add(dartboard);
    dartboard.scale.set(100, 100, 100);
    dartboard.rotation.set(Math.PI/2, 0, Math.PI/2);
    dartboard.position.set(dartboardPosition.x, dartboardPosition.y, dartboardPosition.z);
  });
  
  // create a cirlce to go behind the board 
  const circleGeometry = new THREE.CircleGeometry(28, 64);
  const circleMaterial = new THREE.MeshBasicMaterial({ color: 0xE4080A, side: THREE.DoubleSide });
  const boardPadding = new THREE.Mesh(circleGeometry, circleMaterial);
  boardPadding.position.set(dartboardPosition.x+0.5, dartboardPosition.y, dartboardPosition.z);
  boardPadding.rotation.y = Math.PI / 2;
  scene.add(boardPadding);
  
}
export function addDart(gltfLoader, scene) {
  // import dart and position it at 1,0,0
  gltfLoader.load(window.Dart_Path, (gltfScene) => {
    dart = gltfScene.scene;
    dartWrapper.add(dart); // Add dart to dartWrapper
    scene.add(dartWrapper);
    dartWrapper.scale.set(0.1, 0.1, 0.1);
    dart.rotation.set(Math.PI/2, 0, Math.PI/2);
    
    // set the dart's relative position to be it's tip
    dartWrapper.traverse((child) => {
      if (child.isMesh) {
        child.geometry.computeBoundingBox();
        const bbox = child.geometry.boundingBox;
        // Find the minimum x (tip of dart in local space)
        const tipOffset = bbox.min.x;
        // Offset the dart so its tip is at the origin
        child.geometry.translate(tipOffset, 0, 0);
      }
    });
    dartWrapper.position.set(dartThrowingPosition.x, dartThrowingPosition.y, dartThrowingPosition.z);
    dartWrapper.lookAt(dartboardPosition.x,dartboardPosition.y,dartboardPosition.z); // Make dart look at the board



  });
  }
export function roomSetUp(scene) {
  // back wall AS DEFINED AT TOP 
  const backWallGeometry = new THREE.PlaneGeometry(600, dartboardPosition.y*2.2);
  const backWallMaterial = new THREE.MeshBasicMaterial({ color: 0xCFE5FF, side: THREE.DoubleSide });
  backWall = new THREE.Mesh(backWallGeometry, backWallMaterial);
  backWall.position.set(dartboardPosition.x+1, dartboardPosition.y, dartboardPosition.z);
  backWall.rotation.y = Math.PI / 2; // Rotate to face the camera
  scene.add(backWall)

  // side walls 
  const sideWallGeometry = new THREE.PlaneGeometry(500, dartboardPosition.y*2.2)
  const sideWallMaterial = new THREE.MeshBasicMaterial({ color: 0x8FC1FF, side: THREE.DoubleSide });
  let leftWall = new THREE.Mesh(sideWallGeometry, sideWallMaterial);
  leftWall.position.set(dartboardPosition.x/2,dartboardPosition.y,-300)
  leftWall.rotation.z = Math.PI / 2;
  scene.add(leftWall)
  let rightWall = new THREE.Mesh(sideWallGeometry, sideWallMaterial);
  rightWall.position.set(dartboardPosition.x/2,dartboardPosition.y,300)
  rightWall.rotation.z = Math.PI / 2;
  scene.add(rightWall)


  // floor and ceiling
  const floorGeometry = new THREE.PlaneGeometry(500, 600);
  const floorMaterial = new THREE.MeshBasicMaterial({ color: 0x5281BA, side: THREE.DoubleSide });
  const floor = new THREE.Mesh(floorGeometry, floorMaterial);
  floor.position.set(0, 0, 0);
  floor.rotation.x = -Math.PI / 2; // Rotate to face upwards
  scene.add(floor);
  const celing = new THREE.Mesh(floorGeometry, floorMaterial);
  celing.position.set(0, 365, 0);
  celing.rotation.x = -Math.PI / 2; // Rotate to face upwards
  scene.add(celing);

  }
export function calcCameraOffset(pos) {
  // figure out this bastard
  // something must be done with the z coord... figure out the maths!!!
}

// makes dart look at where mouse is pointing using raycasting and this video 
// https://www.youtube.com/watch?v=Zia-0PRgFPc
// explain raycasting in document. 
export function getLookAtPos(event) {

  // RELATIVE TO WHOLE WINDOW NOT RELATIVE TO JUST THE CANVAS
  // mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
  // mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;

  // raycaster.setFromCamera(mouse, camera);
  // const intersects = raycaster.intersectObject(backWall, true);
  // if (intersects.length > 0) {
  //   const point = intersects[0].point;
  //   target.x = point.x;
  //   target.y = point.y;
  //   target.z = point.z;
  // }
  // return target



  const rect = canvas.getBoundingClientRect(); // get canvas position and size
  const x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
  const y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

  mouse.x = x;
  mouse.y = y;

  raycaster.setFromCamera(mouse, camera);
  const intersects = raycaster.intersectObject(backWall, true);
  if (intersects.length > 0) {
      const point = intersects[0].point;
      target.copy(point);
  }
  return target
}

export function handleMousemove(event) {
  target = getLookAtPos(event);
  dartWrapper.lookAt(target);
}

export function handleMouseclick(event) {
  target = getLookAtPos(event)
  canvas.removeEventListener('mousemove', handleMousemove); // Remove previous mouse move listener

  // get flight path using throwPhysics.js
  let path, finalPos
  [path, finalPos] = getFlightInfo(target);
  
  // get score using getPoints.js
  [mostRecentScore, isDouble] = getPoints(finalPos);

  // DART FOLLOWS SIDE OF DART METHOD 
  const cameraOffset = new THREE.Vector3(-10, 3, 0); // Offset of camera relative to dart
  let i = 0;
  animatePath(i, path, cameraOffset, finalPos);

  return [mostRecentScore, isDouble, target]
}  // score is for server, target is for other user to see 

function getFlightInfo(target) {
  // using throwPhysics.js, calc the initial velocities based off mouse pos and then find the flight path. 
  const initialVelocities = getInitialVelocities(dartThrowingPosition, target);
  let path = calcNextPos(dartThrowingPosition, initialVelocities, 0.01);
  let finalPos = path[path.length - 1];
  return [path, finalPos]
}

function animatePath(i, path, cameraOffset, finalPos) {
  if (i < path.length) {

    // Move the dart
    dartWrapper.position.copy(path[i]);

    // if not at wall yet
    if (i < path.length - 1) {
      const nextPos = path[i + 1];

      // Rotate the dart to face its path
      dartWrapper.lookAt(nextPos);

      // find camera position relative to dart's orientation
      const offset = cameraOffset.clone().applyQuaternion(dartWrapper.quaternion);
      const targetCamPos = dartWrapper.position.clone().add(offset);
      camera.position.lerp(targetCamPos, 0.4);      // THE HIGHER THE NUMBER THE CLOSER THE DART. THIS COULD BE CHANGED THROUGH SETTINGS

      // Always look at the dart itself (not nextPos)
      camera.lookAt(dartWrapper.position);
    } else {
      // final camera transition (gsap makes it smooth!)
      camera.lookAt(finalPos.x, finalPos.y, finalPos.z)
      gsap.to(camera.position, {
        x: finalPos.x - 50,
        y: finalPos.y,
        z: finalPos.z,
        duration: 1.5,
        ease: "power2.out",
        onUpdate: () => {
          camera.lookAt(finalPos);
        }
      });
    }

    renderer.render(scene, camera);
    i++;
    setTimeout(() => animatePath(i, path, cameraOffset, finalPos), 20);
  }
}

export function handleOtherUserThrow(target) {
  // get flight path using throwPhysics.js
  let path, finalPos
  [path, finalPos] = getFlightInfo(target);

  // DART FOLLOWS SIDE OF DART METHOD 
  const cameraOffset = new THREE.Vector3(-10, 3, 0); // Offset of camera relative to dart
  let i = 0;
  animatePath(i, path, cameraOffset, finalPos);
}


export function respawn() {
  console.log('resetting')
  dartWrapper.position.set(dartThrowingPosition.x, dartThrowingPosition.y, dartThrowingPosition.z);
  dartWrapper.lookAt(dartboardPosition.x,dartboardPosition.y,dartboardPosition.z); // Make dart look at the board
  console.log(dartWrapper.position)
  
  camera.position.set(dartCamStartPos.x, dartCamStartPos.y, dartCamStartPos.z);
  camera.lookAt(dartboardPosition);
  console.log(dartCamStartPos)
  console.log('vs')
  console.log(camera.position)
}

export function resetDartPos() {
  // this is triggered by button press 
  // reset dart and point it at board
  dartWrapper.position.set(dartThrowingPosition.x, dartThrowingPosition.y, dartThrowingPosition.z);
  dartWrapper.lookAt(dartboardPosition.x,dartboardPosition.y,dartboardPosition.z); 

  // reset camera
  camera.position.set(dartCamStartPos.x, dartCamStartPos.y, dartCamStartPos.z);
  camera.lookAt(dartboardPosition);
}




export function initGraphics() {
    renderer = canvasRenderSetUp();
    camera = cameraSetUp();
    
    const gltfLoader = new GLTFLoader();

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
        case 'KeyM':
          camera.position.set(dartCamStartPos.x, dartCamStartPos.y, dartCamStartPos.z);
          camera.lookAt(dartboardPosition.x, camera.position.y, camera.position.z)
          break;
        case 'KeyL':
          camera.position.set(dartWrapper.position.x - 50, dartWrapper.position.y, dartWrapper.position.z);
          camera.lookAt(dartboardPosition.x, camera.position.y, camera.position.z)
          break;
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




}





