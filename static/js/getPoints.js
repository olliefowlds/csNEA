import * as THREE from 'three';
const dartboardPosition = new THREE.Vector3(237, 173, 0);
let isDouble

function cartesianToPolar(x,y) {
    const r = Math.sqrt(x**2 + y**2);           // find radius 
    let theta = Math.atan2(y, x);               // find angle in radians
    theta = theta * (180 / Math.PI);            // convet to degree 
    theta = (theta + 360) % 360;                // put in range 0-360

    return [r,theta];
}

function getPoints(finalPos) {
    isDouble = false;  // default value
    const posWhenBullIsOrigin = new THREE.Vector3(finalPos.x - dartboardPosition.x, finalPos.y - dartboardPosition.y, finalPos.z - dartboardPosition.z) // translate so bull is origin
    const [r,theta] = cartesianToPolar(posWhenBullIsOrigin.z, posWhenBullIsOrigin.y);  // convert to polar coordinates in y-z 

    let score = 0
    if (r<0.635) {                                  // bullseye
        score = 50;                                                                    
    } else if (r<1.59) {                            // outer bull                                         
        score = 25;
    } else if (r<17) {                              // within rest of board
        const sector = Math.floor((theta+9)/18)     // take angle and find which sector it lands in 
        const number = [6,13,4,18,1,20,5,12,9,14,11,8,16,7,19,3,17,2,15,10][sector];
        if (r>=9.9 && r<=10.7) {                    // treble ring 
            score = number * 3;
        } else if (r>=16.2 && r<=17) {              // double ring 
            score = number * 2; 
            isDouble = true 
        } else {
            score = number;
        }
    } 
    return [score, isDouble];
}

export { getPoints };
