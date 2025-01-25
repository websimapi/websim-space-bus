import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { TWEEN } from 'tween';

class SpaceBus {
  constructor() {
    this.room = new WebsimSocket();
    this.setupScene();
    this.setupLighting();
    this.createStarfield();
    this.loadBusModel();
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

    this.camera.position.set(0, 2, 5);
    
    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.05;
    
    window.addEventListener('resize', () => {
      this.camera.aspect = window.innerWidth / window.innerHeight;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(window.innerWidth, window.innerHeight);
    });
  }

  setupLighting() {
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
    this.scene.add(ambientLight);

    const directionalLight = new THREE.DirectionalLight(0xffffff, 1);
    directionalLight.position.set(5, 5, 5);
    this.scene.add(directionalLight);
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

  loadBusModel() {
    // Create a temporary bus using basic geometry
    const busGeometry = new THREE.BoxGeometry(4, 2, 8);
    const busMaterial = new THREE.MeshPhongMaterial({ color: 0x3366ff });
    this.bus = new THREE.Mesh(busGeometry, busMaterial);
    this.scene.add(this.bus);
    
    // Add windows
    const windowGeometry = new THREE.BoxGeometry(2, 0.8, 1);
    const windowMaterial = new THREE.MeshPhongMaterial({ color: 0x88ccff });
    
    // Add windows on both sides
    for(let i = -2; i <= 2; i += 1) {
      const leftWindow = new THREE.Mesh(windowGeometry, windowMaterial);
      leftWindow.position.set(-2, 0.2, i);
      this.bus.add(leftWindow);
      
      const rightWindow = new THREE.Mesh(windowGeometry, windowMaterial);
      rightWindow.position.set(2, 0.2, i);
      this.bus.add(rightWindow);
    }
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
    
    // Rotate the bus slightly
    this.bus.rotation.y += 0.001;
    
    // Move through space
    this.starfield.rotation.z += 0.0005;
    
    // Update controls
    this.controls.update();
    
    // Update tweens
    TWEEN.update();
    
    this.renderer.render(this.scene, this.camera);
  }
}

// Start the space bus when the page loads
new SpaceBus();