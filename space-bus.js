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
    
    // Enhanced physics parameters
    this.playerVelocity = new THREE.Vector3();
    this.damping = 0.95; // Slightly stronger air resistance
    this.pullForce = 15.0; // Increased for more noticeable pull
    this.pushForce = 25.0; // Increased for more dramatic push-offs
    this.minGrabDistance = 0.5;
    this.maxGrabDistance = 5.0;
    this.grabObjects = []; // Array to store all grabbable objects

    this.createDetailedBus();
    this.setupGrabSystem();
    
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
    
    // Create individual wall panels that can be grabbed
    this.createWallPanels();
    this.createDetailedSeats();
    this.createGrabbableHandrails();
    this.createWindowPanels();
    this.createFloorPanels();
    this.createCeilingPanels();
    this.createDetailedDashboard();

    this.scene.add(this.bus);
  }

  createWallPanels() {
    const panelSize = new THREE.Vector2(2, 2); // Width and height of each panel
    const panelGeometry = new THREE.BoxGeometry(0.1, panelSize.y, panelSize.x);
    const panelMaterial = new THREE.MeshPhongMaterial({
      color: 0x3366ff,
      side: THREE.DoubleSide
    });

    // Create wall panels for each side
    for (let side of [-1, 1]) { // Left and right
      for (let z = -7; z <= 7; z += panelSize.x) {
        for (let y = -1; y <= 1; y += panelSize.y) {
          const panel = new THREE.Mesh(panelGeometry, panelMaterial.clone());
          panel.position.set(side * 4, y, z);
          panel.userData.isGrabbable = true;
          panel.userData.type = 'wall';
          this.bus.add(panel);
          this.grabObjects.push(panel);
        }
      }
    }
  }

  createDetailedSeats() {
    const seatGeometry = new THREE.BoxGeometry(1, 1.5, 1);
    const seatMaterial = new THREE.MeshPhongMaterial({ color: 0x990000 });
    
    // Create individual grabbable components for each seat
    for (let side of [-1, 1]) {
      for (let z = -6; z <= 6; z += 3) {
        // Seat cushion
        const seatCushion = new THREE.Mesh(
          new THREE.BoxGeometry(1.2, 0.3, 1.2),
          seatMaterial.clone()
        );
        seatCushion.position.set(side * 3, -1.3, z);
        seatCushion.userData.isGrabbable = true;
        seatCushion.userData.type = 'seat';
        this.bus.add(seatCushion);
        this.grabObjects.push(seatCushion);

        // Seat back
        const seatBack = new THREE.Mesh(
          new THREE.BoxGeometry(1.2, 1.5, 0.3),
          seatMaterial.clone()
        );
        seatBack.position.set(side * 3, -0.5, z - 0.6);
        seatBack.userData.isGrabbable = true;
        seatBack.userData.type = 'seatback';
        this.bus.add(seatBack);
        this.grabObjects.push(seatBack);

        // Armrests
        for (let armSide of [-1, 1]) {
          const armrest = new THREE.Mesh(
            new THREE.BoxGeometry(0.2, 0.2, 1),
            seatMaterial.clone()
          );
          armrest.position.set(
            side * 3 + (armSide * 0.5),
            -0.8,
            z
          );
          armrest.userData.isGrabbable = true;
          armrest.userData.type = 'armrest';
          this.bus.add(armrest);
          this.grabObjects.push(armrest);
        }
      }
    }
  }

  createGrabbableHandrails() {
    const railGeometry = new THREE.CylinderGeometry(0.05, 0.05, 1, 8);
    const railMaterial = new THREE.MeshPhongMaterial({ color: 0xcccccc });

    // Ceiling rails
    for (let side of [-1, 1]) {
      for (let z = -7; z <= 7; z += 1) {
        const rail = new THREE.Mesh(railGeometry, railMaterial.clone());
        rail.rotation.x = Math.PI / 2;
        rail.position.set(side * 2, 1.8, z);
        rail.userData.isGrabbable = true;
        rail.userData.type = 'rail';
        this.bus.add(rail);
        this.grabObjects.push(rail);
      }
    }

    // Vertical support poles
    for (let z = -7; z <= 7; z += 3.5) {
      const pole = new THREE.Mesh(
        new THREE.CylinderGeometry(0.05, 0.05, 3.6, 8),
        railMaterial.clone()
      );
      pole.position.set(2, 0, z);
      pole.userData.isGrabbable = true;
      pole.userData.type = 'pole';
      this.bus.add(pole);
      this.grabObjects.push(pole);
    }
  }

  createWindowPanels() {
    const windowMaterial = new THREE.MeshPhongMaterial({
      color: 0x88ccff,
      transparent: true,
      opacity: 0.3
    });
    
    // Window panels for each side
    for (let side of [-1, 1]) {
      for (let z = -6; z <= 6; z += 2) {
        const window = new THREE.Mesh(
          new THREE.BoxGeometry(0.1, 2, 1.5),
          windowMaterial.clone()
        );
        window.position.set(side * 4, 0, z);
        window.userData.isGrabbable = true;
        window.userData.type = 'window';
        this.bus.add(window);
        this.grabObjects.push(window);
      }
    }
  }

  createFloorPanels() {
    const floorGeometry = new THREE.BoxGeometry(7.5, 0.2, 15.5);
    const floorMaterial = new THREE.MeshPhongMaterial({
      color: 0x333333,
      side: THREE.DoubleSide
    });
    const floor = new THREE.Mesh(floorGeometry, floorMaterial);
    floor.position.y = -1.9;
    floor.userData.isGrabbable = true;
    floor.userData.type = 'floor';
    this.bus.add(floor);
    this.grabObjects.push(floor);
  }

  createCeilingPanels() {
    const roofGeometry = new THREE.BoxGeometry(7.8, 0.2, 15.8);
    const roofMaterial = new THREE.MeshPhongMaterial({
      color: 0x88ccff,
      transparent: true,
      opacity: 0.3,
      side: THREE.DoubleSide
    });
    const roof = new THREE.Mesh(roofGeometry, roofMaterial);
    roof.position.y = 1.9;
    roof.userData.isGrabbable = true;
    roof.userData.type = 'ceiling';
    this.bus.add(roof);
    this.grabObjects.push(roof);
  }

  createDetailedDashboard() {
    const controlPanelGeometry = new THREE.BoxGeometry(4, 1, 0.5);
    const controlPanelMaterial = new THREE.MeshPhongMaterial({ color: 0x333333 });
    const controlPanel = new THREE.Mesh(controlPanelGeometry, controlPanelMaterial);
    controlPanel.position.set(0, -0.5, 7);
    controlPanel.userData.isGrabbable = true;
    controlPanel.userData.type = 'dashboard';
    this.bus.add(controlPanel);
    this.grabObjects.push(controlPanel);

    // Add some details to the control panel
    const buttonGeometry = new THREE.CylinderGeometry(0.1, 0.1, 0.1, 16);
    const buttonMaterial = new THREE.MeshPhongMaterial({ color: 0xff0000 });
    for(let x = -1.5; x <= 1.5; x += 0.5) {
      const button = new THREE.Mesh(buttonGeometry, buttonMaterial);
      button.rotation.x = Math.PI / 2;
      button.position.set(x, -0.2, 7.3);
      button.userData.isGrabbable = true;
      button.userData.type = 'button';
      this.bus.add(button);
      this.grabObjects.push(button);
    }

    // Add screen to control panel
    const screenGeometry = new THREE.BoxGeometry(2, 0.8, 0.1);
    const screenMaterial = new THREE.MeshPhongMaterial({ color: 0x00ff00 });
    const screen = new THREE.Mesh(screenGeometry, screenMaterial);
    screen.position.set(0, 0, 7.3);
    screen.userData.isGrabbable = true;
    screen.userData.type = 'screen';
    this.bus.add(screen);
    this.grabObjects.push(screen);
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

  setupGrabSystem() {
    this.raycaster = new THREE.Raycaster();
    this.mouse = new THREE.Vector2();
    this.isGrabbing = false;
    this.grabbedObject = null;
    this.grabPoint = new THREE.Vector3();
    this.dragStartPosition = new THREE.Vector2();
    this.isDragging = false;
    this.dragDirection = new THREE.Vector3();
    this.initialGrabPoint = new THREE.Vector3();

    document.addEventListener('mousemove', (event) => {
      this.handleMouseMove(event);
    });

    document.addEventListener('mousedown', (event) => {
      this.handleMouseDown(event);
    });

    document.addEventListener('mouseup', () => {
      this.handleMouseUp();
    });
  }

  handleMouseMove(event) {
    this.mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
    this.mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;

    if (this.isGrabbing && this.grabbedObject) {
      if (!this.isDragging) {
        const dx = event.clientX - this.dragStartPosition.x;
        const dy = event.clientY - this.dragStartPosition.y;
        const dragDistance = Math.sqrt(dx * dx + dy * dy);
        
        if (dragDistance > 5) { // Reduced threshold for easier dragging
          this.isDragging = true;
          // Store initial grab point in world space
          this.initialGrabPoint = this.grabPoint.clone();
        }
      }

      if (this.isDragging) {
        // Calculate drag vector in screen space
        const currentMousePos = new THREE.Vector2(event.clientX, event.clientY);
        const dragVector = currentMousePos.clone().sub(this.dragStartPosition);
        
        // Convert to world space direction
        this.dragDirection.set(
          dragVector.x / window.innerWidth * this.pushForce,
          -dragVector.y / window.innerHeight * this.pushForce,
          0
        ).applyQuaternion(this.camera.quaternion);
      }
    }

    // Update cursor appearance
    if (this.isFirstPerson) {
      this.raycaster.setFromCamera(this.mouse, this.camera);
      const intersects = this.raycaster.intersectObjects(this.grabObjects);
      
      if (intersects.length > 0 && intersects[0].distance < this.maxGrabDistance) {
        document.body.style.cursor = this.isGrabbing ? 'grabbing' : 'grab';
      } else {
        document.body.style.cursor = 'default';
      }
    }
  }

  handleMouseDown(event) {
    if (!this.isFirstPerson || this.isGrabbing) return;

    this.raycaster.setFromCamera(this.mouse, this.camera);
    const intersects = this.raycaster.intersectObjects(this.grabObjects);

    if (intersects.length > 0 && intersects[0].distance < this.maxGrabDistance) {
      this.isGrabbing = true;
      this.isDragging = false;
      this.grabbedObject = intersects[0].object;
      this.grabPoint.copy(intersects[0].point);
      this.dragStartPosition.set(event.clientX, event.clientY);
      
      // Visual feedback
      const originalColor = this.grabbedObject.material.color.clone();
      this.grabbedObject.material.color.setHex(0xffff00);
      setTimeout(() => {
        if (this.grabbedObject) {
          this.grabbedObject.material.color.copy(originalColor);
        }
      }, 100);
    }
  }

  handleMouseUp() {
    if (!this.isFirstPerson || !this.isGrabbing) return;

    if (this.isDragging && this.dragDirection.lengthSq() > 0.001) {
      // Apply push-off force
      this.playerVelocity.add(this.dragDirection);
    }

    this.isGrabbing = false;
    this.isDragging = false;
    this.grabbedObject = null;
    this.dragDirection.set(0, 0, 0);
  }

  updateFirstPersonMovement(delta) {
    if (!this.isFirstPerson) return;

    if (this.isGrabbing && this.grabbedObject && !this.isDragging) {
      // Enhanced pull towards grab point when holding
      const toGrab = this.grabPoint.clone().sub(this.camera.position);
      const distance = toGrab.length();
      
      if (distance > this.minGrabDistance) {
        const pullStrength = Math.min(1.0, distance / this.maxGrabDistance);
        toGrab.normalize().multiplyScalar(this.pullForce * pullStrength * delta);
        this.playerVelocity.add(toGrab);
      }
    }

    // Apply velocity with damping
    this.playerVelocity.multiplyScalar(this.damping);
    
    // Apply minimum velocity threshold to prevent micro-movements
    if (this.playerVelocity.lengthSq() < 0.0001) {
      this.playerVelocity.set(0, 0, 0);
    }
    
    // Calculate new position
    const newPosition = this.camera.position.clone()
      .add(this.playerVelocity.clone().multiplyScalar(delta));

    // Check bounds with improved collision response
    const busBox = new THREE.Box3().setFromObject(this.bus);
    const margin = 0.3;
    busBox.min.add(new THREE.Vector3(margin, margin, margin));
    busBox.max.sub(new THREE.Vector3(margin, margin, margin));

    if (busBox.containsPoint(newPosition)) {
      this.camera.position.copy(newPosition);
    } else {
      // Enhanced bounce physics
      const normal = this.calculateCollisionNormal(newPosition, busBox);
      this.handleCollision(normal);
    }
  }

  calculateCollisionNormal(position, bounds) {
    const center = bounds.getCenter(new THREE.Vector3());
    const size = bounds.getSize(new THREE.Vector3());
    const dirToCenter = position.clone().sub(center);
    
    // Find the axis of maximum penetration
    const penetrations = [
      Math.abs(dirToCenter.x) / size.x,
      Math.abs(dirToCenter.y) / size.y,
      Math.abs(dirToCenter.z) / size.z
    ];
    
    const maxIndex = penetrations.indexOf(Math.max(...penetrations));
    const normal = new THREE.Vector3();
    normal.setComponent(maxIndex, Math.sign(dirToCenter.getComponent(maxIndex)));
    
    return normal;
  }

  handleCollision(normal) {
    // Reflect velocity about the normal with energy loss
    const dot = this.playerVelocity.dot(normal);
    if (dot < 0) {
      normal.multiplyScalar(2 * dot);
      this.playerVelocity.sub(normal);
      this.playerVelocity.multiplyScalar(0.5); // Energy loss on collision
    }
  }

  toggleView() {
    this.isFirstPerson = !this.isFirstPerson;
    
    if (this.isFirstPerson) {
      this.controls.enabled = false;
      // Position the camera at head height inside the bus
      this.camera.position.set(0, 0.5, 6);
      this.camera.rotation.set(0, Math.PI, 0);
    } else {
      this.controls.enabled = true;
      
      // Return to third-person view
      new window.TWEEN.Tween(this.camera.position)
        .to({
          x: this.thirdPersonPosition.x,
          y: this.thirdPersonPosition.y,
          z: this.thirdPersonPosition.z
        }, 1000)
        .easing(window.TWEEN.Easing.Cubic.InOut)
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

  animate() {
    requestAnimationFrame(() => this.animate());
    
    const delta = 0.016; 
    
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
    window.TWEEN.update();
    this.renderer.render(this.scene, this.camera);
  }
}

// Start the space bus when the page loads
new SpaceBus();