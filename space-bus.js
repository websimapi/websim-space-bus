import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { PointerLockControls } from 'three/addons/controls/PointerLockControls.js';

class SpaceBus {
  constructor() {
    this.room = new WebsimSocket();
    this.isFirstPerson = false;
    this.setupScene();
    this.setupLighting();
    this.createStarfield();
    this.createDetailedBus();
    this.setupPassengerList();
    this.setupViewToggle();
    
    // Initialize movement parameters
    this.busPath = new THREE.CatmullRomCurve3([
      new THREE.Vector3(0, 0, 0),
      new THREE.Vector3(100, 50, -100),
      new THREE.Vector3(-100, -30, -200),
      new THREE.Vector3(50, 80, -300),
      new THREE.Vector3(-50, -50, -400),
    ]);
    this.pathProgress = 0;
    this.movementSpeed = 0.0001;
    
    // Create a chase camera rig
    this.cameraRig = new THREE.Object3D();
    this.scene.add(this.cameraRig);
    
    // Set up both camera positions
    this.thirdPersonPosition = new THREE.Vector3(0, 8, 30);
    this.firstPersonPosition = new THREE.Vector3(0, 0.5, 6); // Inside the bus, near the front
    
    this.camera.position.copy(this.thirdPersonPosition);
    this.cameraRig.add(this.camera);
    
    // Add first-person movement variables
    this.moveForward = false;
    this.moveBackward = false;
    this.moveLeft = false;
    this.moveRight = false;
    this.canJump = false;
    this.velocity = new THREE.Vector3();
    this.direction = new THREE.Vector3();
    this.fpControls = null;
    this.walkingSpeed = 5.0;
    this.controlsInfo = document.getElementById('controls-info');
    
    // Create collision boundaries
    this.createCollisionBoundaries();
    
    this.setupFirstPersonControls();
    this.setupMovementControls();
    
    this.animate();
    
    this.room.party.subscribe((peers) => {
      this.updatePassengerList(peers);
    });
  }

  setupScene() {
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    document.body.appendChild(this.renderer.domElement);

    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.05;
    this.controls.target.set(0, 0, 0);
    
    window.addEventListener('resize', () => {
      this.camera.aspect = window.innerWidth / window.innerHeight;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(window.innerWidth, window.innerHeight);
    });
  }

  setupLighting() {
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.7);
    this.scene.add(ambientLight);

    const directionalLight = new THREE.DirectionalLight(0xffffff, 1);
    directionalLight.position.set(5, 5, 5);
    this.scene.add(directionalLight);

    // Add interior lights
    const interiorLight1 = new THREE.PointLight(0xffffcc, 0.5, 20);
    interiorLight1.position.set(0, 3, 0);
    this.scene.add(interiorLight1);

    const interiorLight2 = new THREE.PointLight(0xffffcc, 0.5, 20);
    interiorLight2.position.set(0, 3, 5);
    this.scene.add(interiorLight2);
  }

  createStarfield() {
    const starGeometry = new THREE.BufferGeometry();
    const starMaterial = new THREE.PointsMaterial({
      color: 0xFFFFFF,
      size: 0.3,
      sizeAttenuation: true
    });

    const starVertices = [];
    for(let i = 0; i < 20000; i++) {
      const x = (Math.random() - 0.5) * 4000;
      const y = (Math.random() - 0.5) * 4000;
      const z = (Math.random() - 0.5) * 4000;
      starVertices.push(x, y, z);
    }

    starGeometry.setAttribute('position', new THREE.Float32BufferAttribute(starVertices, 3));
    this.starfield = new THREE.Points(starGeometry, starMaterial);
    this.scene.add(this.starfield);

    // Create distant nebulae for visual interest
    this.createNebula();
  }

  createNebula() {
    const nebulaCount = 5;
    this.nebulae = [];
    
    for(let i = 0; i < nebulaCount; i++) {
      const geometry = new THREE.SphereGeometry(100, 32, 32);
      const material = new THREE.MeshPhongMaterial({
        color: new THREE.Color().setHSL(Math.random(), 0.8, 0.5),
        transparent: true,
        opacity: 0.2,
        side: THREE.DoubleSide
      });
      
      const nebula = new THREE.Mesh(geometry, material);
      nebula.position.set(
        (Math.random() - 0.5) * 2000,
        (Math.random() - 0.5) * 2000,
        (Math.random() - 0.5) * 2000
      );
      nebula.scale.setScalar(Math.random() * 5 + 5);
      this.scene.add(nebula);
      this.nebulae.push(nebula);
    }
  }

  createDetailedBus() {
    this.bus = new THREE.Group();
    
    // Main bus body - now larger
    const bodyGeometry = new THREE.BoxGeometry(8, 4, 16);
    const busMaterial = new THREE.MeshPhongMaterial({ 
      color: 0x3366ff,
      side: THREE.DoubleSide // Render both sides of faces
    });
    const busBody = new THREE.Mesh(bodyGeometry, busMaterial);
    
    // Make the body hollow by creating an inner box
    const innerGeometry = new THREE.BoxGeometry(7.5, 3.5, 15.5);
    const innerMaterial = new THREE.MeshPhongMaterial({
      color: 0x222244,
      side: THREE.BackSide
    });
    const innerBody = new THREE.Mesh(innerGeometry, innerMaterial);
    this.bus.add(innerBody);

    // Floor
    const floorGeometry = new THREE.BoxGeometry(7.5, 0.2, 15.5);
    const floorMaterial = new THREE.MeshPhongMaterial({
      color: 0x333333,
      side: THREE.DoubleSide
    });
    const floor = new THREE.Mesh(floorGeometry, floorMaterial);
    floor.position.y = -1.9;
    this.bus.add(floor);

    // Add seats (3 rows on each side)
    const seatGeometry = new THREE.BoxGeometry(1, 1.5, 1);
    const seatMaterial = new THREE.MeshPhongMaterial({ color: 0x990000 });
    
    for(let side of [-1, 1]) { // Left and right sides
      for(let z = -6; z <= 6; z += 3) { // Front to back
        const seat = new THREE.Mesh(seatGeometry, seatMaterial);
        seat.position.set(side * 3, -1, z);
        this.bus.add(seat);
        
        // Add seat back
        const seatBack = new THREE.Mesh(
          new THREE.BoxGeometry(1, 2, 0.3),
          seatMaterial
        );
        seatBack.position.set(side * 3, -0.5, z - 0.5);
        this.bus.add(seatBack);
      }
    }

    // Windows
    const windowMaterial = new THREE.MeshPhongMaterial({
      color: 0x88ccff,
      transparent: true,
      opacity: 0.3
    });
    
    // Side windows
    for(let side of [-1, 1]) {
      for(let z = -6; z <= 6; z += 2) {
        const window = new THREE.Mesh(
          new THREE.BoxGeometry(0.1, 2, 1.5),
          windowMaterial
        );
        window.position.set(side * 4, 0, z);
        this.bus.add(window);
      }
    }

    // Windshield
    const windshield = new THREE.Mesh(
      new THREE.BoxGeometry(7, 2.5, 0.1),
      windowMaterial
    );
    windshield.position.set(0, 0.5, 7.95);
    this.bus.add(windshield);

    // Control panel
    const controlPanelGeometry = new THREE.BoxGeometry(4, 1, 0.5);
    const controlPanelMaterial = new THREE.MeshPhongMaterial({ color: 0x333333 });
    const controlPanel = new THREE.Mesh(controlPanelGeometry, controlPanelMaterial);
    controlPanel.position.set(0, -0.5, 7);
    this.bus.add(controlPanel);

    // Add some details to the control panel
    const buttonGeometry = new THREE.CylinderGeometry(0.1, 0.1, 0.1, 16);
    const buttonMaterial = new THREE.MeshPhongMaterial({ color: 0xff0000 });
    for(let x = -1.5; x <= 1.5; x += 0.5) {
      const button = new THREE.Mesh(buttonGeometry, buttonMaterial);
      button.rotation.x = Math.PI / 2;
      button.position.set(x, -0.2, 7.3);
      this.bus.add(button);
    }

    // Add screen to control panel
    const screenGeometry = new THREE.BoxGeometry(2, 0.8, 0.1);
    const screenMaterial = new THREE.MeshPhongMaterial({ color: 0x00ff00 });
    const screen = new THREE.Mesh(screenGeometry, screenMaterial);
    screen.position.set(0, 0, 7.3);
    this.bus.add(screen);

    // Add roof details
    const roofDetailGeometry = new THREE.CylinderGeometry(0.2, 0.2, 14, 8);
    const roofDetailMaterial = new THREE.MeshPhongMaterial({ color: 0x666666 });
    for(let x = -2; x <= 2; x += 2) {
      const roofDetail = new THREE.Mesh(roofDetailGeometry, roofDetailMaterial);
      roofDetail.rotation.z = Math.PI / 2;
      roofDetail.position.set(x, 1.8, 0);
      this.bus.add(roofDetail);
    }

    // Add transparent roof
    const roofGeometry = new THREE.BoxGeometry(7.8, 0.2, 15.8);
    const roofMaterial = new THREE.MeshPhongMaterial({
      color: 0x88ccff,
      transparent: true,
      opacity: 0.3,
      side: THREE.DoubleSide
    });
    const roof = new THREE.Mesh(roofGeometry, roofMaterial);
    roof.position.y = 1.9;
    this.bus.add(roof);

    // Add roof support beams
    const beamGeometry = new THREE.BoxGeometry(0.2, 4, 0.2);
    const beamMaterial = new THREE.MeshPhongMaterial({ color: 0x666666 });
    
    // Add beams at corners and middle
    const beamPositions = [
      [-3.8, 0, 7.8], [3.8, 0, 7.8],   // Front
      [-3.8, 0, -7.8], [3.8, 0, -7.8], // Back
      [-3.8, 0, 0], [3.8, 0, 0]        // Middle
    ];
    
    beamPositions.forEach(pos => {
      const beam = new THREE.Mesh(beamGeometry, beamMaterial);
      beam.position.set(pos[0], pos[1], pos[2]);
      this.bus.add(beam);
    });

    this.scene.add(this.bus);
  }

  setupPassengerList() {
    this.passengerListEl = document.getElementById('passengers');
  }

  updatePassengerList(peers) {
    this.passengerListEl.innerHTML = '';
    Object.values(peers).forEach(peer => {
      const li = document.createElement('li');
      li.innerHTML = `
        <img src="${peer.avatarUrl}" width="32" height="32" style="border-radius: 50%; vertical-align: middle">
        ${peer.username}
      `;
      this.passengerListEl.appendChild(li);
    });
  }

  setupViewToggle() {
    const button = document.createElement('button');
    button.id = 'viewToggle';
    button.textContent = 'Toggle View (Third/First Person)';
    button.style.position = 'fixed';
    button.style.bottom = '20px';
    button.style.left = '50%';
    button.style.transform = 'translateX(-50%)';
    button.style.padding = '10px 20px';
    button.style.background = '#88ccff';
    button.style.border = 'none';
    button.style.borderRadius = '5px';
    button.style.cursor = 'pointer';
    button.style.zIndex = '1000';
    
    button.addEventListener('click', () => this.toggleView());
    document.body.appendChild(button);
  }

  createCollisionBoundaries() {
    // Create invisible boundaries for collision detection
    this.boundaries = [];
    
    // Bus interior boundaries (slightly smaller than visible walls)
    const boundaryGeometry = new THREE.BoxGeometry(7.3, 3.3, 15.3);
    const boundaryMaterial = new THREE.MeshBasicMaterial({
      visible: false
    });
    this.mainBoundary = new THREE.Mesh(boundaryGeometry, boundaryMaterial);
    this.bus.add(this.mainBoundary);
    
    // Add seat collision boxes
    for(let side of [-1, 1]) {
      for(let z = -6; z <= 6; z += 3) {
        const seatBoundary = new THREE.Box3();
        const seatSize = new THREE.Vector3(1.2, 1.7, 1.2);
        const seatPos = new THREE.Vector3(side * 3, -1, z);
        seatBoundary.setFromCenterAndSize(seatPos, seatSize);
        this.boundaries.push(seatBoundary);
      }
    }
  }

  setupFirstPersonControls() {
    this.fpControls = new PointerLockControls(this.camera, document.body);
    
    this.fpControls.addEventListener('lock', () => {
      this.controlsInfo.style.display = 'none';
    });

    this.fpControls.addEventListener('unlock', () => {
      if (this.isFirstPerson) {
        this.controlsInfo.style.display = 'block';
      }
    });
  }

  setupMovementControls() {
    const onKeyDown = (event) => {
      if (!this.isFirstPerson) return;
      
      switch (event.code) {
        case 'ArrowUp':
        case 'KeyW':
          this.moveForward = true;
          break;
        case 'ArrowDown':
        case 'KeyS':
          this.moveBackward = true;
          break;
        case 'ArrowLeft':
        case 'KeyA':
          this.moveLeft = true;
          break;
        case 'ArrowRight':
        case 'KeyD':
          this.moveRight = true;
          break;
      }
    };

    const onKeyUp = (event) => {
      if (!this.isFirstPerson) return;
      
      switch (event.code) {
        case 'ArrowUp':
        case 'KeyW':
          this.moveForward = false;
          break;
        case 'ArrowDown':
        case 'KeyS':
          this.moveBackward = false;
          break;
        case 'ArrowLeft':
        case 'KeyA':
          this.moveLeft = false;
          break;
        case 'ArrowRight':
        case 'KeyD':
          this.moveRight = false;
          break;
      }
    };

    document.addEventListener('keydown', onKeyDown);
    document.addEventListener('keyup', onKeyUp);
  }

  toggleView() {
    this.isFirstPerson = !this.isFirstPerson;
    
    if (this.isFirstPerson) {
      this.controls.enabled = false;
      this.fpControls.lock();
      this.controlsInfo.style.display = 'block';
      
      // Position the camera at head height inside the bus
      this.camera.position.set(0, 0.5, 6);
      this.camera.rotation.set(0, Math.PI, 0);
    } else {
      this.controls.enabled = true;
      this.fpControls.unlock();
      this.controlsInfo.style.display = 'none';
      
      // Return to third-person view
      new TWEEN.Tween(this.camera.position)
        .to({
          x: this.thirdPersonPosition.x,
          y: this.thirdPersonPosition.y,
          z: this.thirdPersonPosition.z
        }, 1000)
        .easing(TWEEN.Easing.Cubic.InOut)
        .start();
    }
  }

  updateBusPosition() {
    // Update the path progress
    this.pathProgress += this.movementSpeed;
    if (this.pathProgress >= 1) {
      this.pathProgress = 0;
      
      // Generate new path points when we complete a cycle
      const lastPoint = this.busPath.getPoint(1);
      const newPoints = [
        lastPoint,
        new THREE.Vector3(
          lastPoint.x + (Math.random() - 0.5) * 200,
          lastPoint.y + (Math.random() - 0.5) * 200,
          lastPoint.z - 300
        ),
        new THREE.Vector3(
          lastPoint.x + (Math.random() - 0.5) * 200,
          lastPoint.y + (Math.random() - 0.5) * 200,
          lastPoint.z - 600
        )
      ];
      this.busPath = new THREE.CatmullRomCurve3(newPoints);
    }

    // Get the current position on the path
    const currentPos = this.busPath.getPoint(this.pathProgress);
    this.bus.position.copy(currentPos);

    // Calculate direction and orient the bus
    const tangent = this.busPath.getTangent(this.pathProgress);
    const lookAtPoint = currentPos.clone().add(tangent);
    this.bus.lookAt(lookAtPoint);
    
    // Add some gentle rolling motion
    this.bus.rotation.z = Math.sin(Date.now() * 0.001) * 0.1;

    // Update camera rig position to follow the bus more smoothly
    const cameraTarget = this.isFirstPerson ? this.bus.position : this.bus.position.clone().add(new THREE.Vector3(0, 5, 20));
    this.cameraRig.position.lerp(cameraTarget, 0.1);
    
    // In first person mode, match bus rotation exactly
    if (this.isFirstPerson) {
      this.cameraRig.quaternion.copy(this.bus.quaternion);
    } else {
      // In third person mode, smoothly look at the bus
      const lookAtPoint = this.bus.position.clone().add(tangent.multiplyScalar(20));
      this.cameraRig.lookAt(lookAtPoint);
    }
  }

  updateFirstPersonMovement(delta) {
    if (!this.isFirstPerson || !this.fpControls.isLocked) return;

    // Calculate movement direction
    this.direction.z = Number(this.moveForward) - Number(this.moveBackward);
    this.direction.x = Number(this.moveRight) - Number(this.moveLeft);
    this.direction.normalize();

    // Calculate new position
    const moveX = this.direction.x * this.walkingSpeed * delta;
    const moveZ = this.direction.z * this.walkingSpeed * delta;

    // Test new position
    const newPosition = this.camera.position.clone();
    newPosition.x += moveX;
    newPosition.z += moveZ;

    // Check if new position is within bus boundaries
    const busBox = new THREE.Box3().setFromObject(this.mainBoundary);
    const margin = 0.3; // Distance to keep from walls
    
    // Shrink the boundary box by the margin
    busBox.min.add(new THREE.Vector3(margin, margin, margin));
    busBox.max.sub(new THREE.Vector3(margin, margin, margin));

    // Only update position if it's within bounds and not colliding with seats
    let canMove = true;
    
    // Check seat collisions
    const playerBox = new THREE.Box3();
    const playerSize = new THREE.Vector3(0.4, 1.7, 0.4);
    playerBox.setFromCenterAndSize(newPosition, playerSize);
    
    for (const boundary of this.boundaries) {
      if (playerBox.intersectsBox(boundary)) {
        canMove = false;
        break;
      }
    }

    if (canMove && busBox.containsPoint(newPosition)) {
      this.camera.position.x += moveX;
      this.camera.position.z += moveZ;
    }
  }

  animate() {
    requestAnimationFrame(() => this.animate());
    
    const delta = 0.016; // Assuming ~60fps
    
    this.updateBusPosition();
    this.updateFirstPersonMovement(delta);
    
    // Rotate nebulae slowly
    this.nebulae.forEach(nebula => {
      nebula.rotation.y += 0.001;
      nebula.rotation.z += 0.0005;
    });

    // Make stars twinkle
    const positions = this.starfield.geometry.attributes.position.array;
    for(let i = 0; i < positions.length; i += 3) {
      positions[i + 1] += (Math.random() - 0.5) * 0.1;
    }
    this.starfield.geometry.attributes.position.needsUpdate = true;
    
    // Update controls and render
    this.controls.update();
    TWEEN.update();
    this.renderer.render(this.scene, this.camera);
  }
}

// Start the space bus when the page loads
new SpaceBus();