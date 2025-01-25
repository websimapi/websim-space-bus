import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

class SpaceBus {
  constructor() {
    this.room = new WebsimSocket();
    this.setupScene();
    this.setupLighting();
    this.createStarfield();
    this.createDetailedBus();
    this.setupPassengerList();
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

    this.camera.position.set(0, 5, 20);
    
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
      size: 0.1,
    });

    const starVertices = [];
    for(let i = 0; i < 10000; i++) {
      const x = (Math.random() - 0.5) * 2000;
      const y = (Math.random() - 0.5) * 2000;
      const z = (Math.random() - 0.5) * 2000;
      starVertices.push(x, y, z);
    }

    starGeometry.setAttribute('position', new THREE.Float32BufferAttribute(starVertices, 3));
    this.starfield = new THREE.Points(starGeometry, starMaterial);
    this.scene.add(this.starfield);
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

  animate() {
    requestAnimationFrame(() => this.animate());
    
    // Rotate the bus more slowly due to its larger size
    this.bus.rotation.y += 0.0005;
    
    this.starfield.rotation.z += 0.0005;
    this.controls.update();
    TWEEN.update();
    
    this.renderer.render(this.scene, this.camera);
  }
}

// Start the space bus when the page loads
new SpaceBus();