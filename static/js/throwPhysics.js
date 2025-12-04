import * as THREE from 'three';
const dartboardPosition = new THREE.Vector3(237, 0, 0);

function getInitialVelocities(startPos, target) {
    const x = target.x - startPos.x;
    const y = target.y - startPos.y;
    const z = target.z - startPos.z;

    // find angle theta 
    const theta = Math.atan2(y, x);

    // find azimuth angle phi
    const adjacent = Math.sqrt(x**2 + y**2);
    const phi = Math.atan2(z, adjacent);

    // define initial velocities, u in cm/s
    const u = 1200; // cm/s
    const ux = u * Math.cos(theta) * Math.cos(phi);
    const uy = u * Math.sin(theta);
    const uz = u * Math.cos(theta) * Math.sin(phi);

    return [ux, uy, uz];
}


function calcNextPos(startPos, velocities, t, positionsArr = []) {
    positionsArr.push(startPos.clone()); 

    let [ux, uy, uz] = velocities;
    let g = 981 // cm/s^2



    // if next iteration is to be at the dartboard
    if ((startPos.x + ux*t) >= dartboardPosition.x) {

        // find t time to reach board
        t = (dartboardPosition.x - startPos.x) / ux;

        // find sy, sz
        const sy = uy * t - (0.5 * g * (t ** 2));
        const sz = uz * t;

        positionsArr.push(new THREE.Vector3(
            dartboardPosition.x,
            startPos.y + sy,
            startPos.z + sz
        ))
        return positionsArr;

    } else {
        // calc new positions after time interval t 
        const sx = ux * t 
        const sy = uy * t - (0.5 * g * (t **2));
        const sz = uz * t
        
        const finalPos = new THREE.Vector3(
            startPos.x + sx,
            startPos.y + sy,
            startPos.z + sz
        )

        // calc new y velocity thats changed due to gravity 
        uy = uy - (g*t);
        return calcNextPos(finalPos, [ux, uy, uz], t, positionsArr);
    }

}





export { getInitialVelocities, calcNextPos };



