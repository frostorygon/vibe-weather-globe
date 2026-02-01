// ============================================
// Vibe Weather Globe 2.0 🌍
// 3D Earth with Live Weather & Volumetric Atmosphere
// ============================================

const API_KEY = '439d4b804bc8187953eb36d2a8c26a02'; // Demo key
const API_BASE = 'https://openweathermap.org/data/2.5';

// City coordinates
const MAJOR_CITIES = [
    { name: 'Tokyo', lat: 35.6762, lon: 139.6503 },
    { name: 'London', lat: 51.5074, lon: -0.1278 },
    { name: 'New York', lat: 40.7128, lon: -74.0060 },
    { name: 'Manila', lat: 14.5995, lon: 120.9842 },
    { name: 'Sydney', lat: -33.8688, lon: 151.2093 },
    { name: 'Paris', lat: 48.8566, lon: 2.3522 },
    { name: 'Dubai', lat: 25.2048, lon: 55.2708 },
    { name: 'Singapore', lat: 1.3521, lon: 103.8198 },
    { name: 'Los Angeles', lat: 34.0522, lon: -118.2437 },
    { name: 'Moscow', lat: 55.7558, lon: 37.6173 },
];

// Three.js Globals
let scene, camera, renderer, controls;
let earth, atmosphere, clouds, stars;
let markers = [];
let raycaster, mouse;
let isAnimating = true;

// DOM Elements
const cityInput = document.getElementById('cityInput');
const searchBtn = document.getElementById('searchBtn');
const weatherCard = document.getElementById('weatherCard');
const loading = document.getElementById('loading');

// ============================================
// Initialize Scene
// ============================================
function init() {
    scene = new THREE.Scene();

    // Camera
    camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 1000);
    camera.position.z = 3.5;

    // Renderer
    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    document.getElementById('globe-container').appendChild(renderer.domElement);

    // Controls
    controls = new THREE.OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.rotateSpeed = 0.5;
    controls.minDistance = 1.5;
    controls.maxDistance = 6;
    controls.enablePan = false;

    // Lighting
    const ambientLight = new THREE.AmbientLight(0x404040, 0.5);
    scene.add(ambientLight);

    const sunLight = new THREE.DirectionalLight(0xffffff, 1.2);
    sunLight.position.set(5, 3, 5);
    scene.add(sunLight);

    // Raycaster for clicks
    raycaster = new THREE.Raycaster();
    mouse = new THREE.Vector2();

    // 1. Create Core Objects
    createStars();
    createEarth();
    createClouds();
    createAtmosphere();
    addCityMarkers();

    // 2. Event Listeners
    window.addEventListener('resize', onWindowResize);
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('click', onMouseClick);

    // Search listeners
    searchBtn.addEventListener('click', searchCity);
    cityInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') searchCity();
    });

    document.querySelectorAll('.quick-cities button').forEach(btn => {
        btn.addEventListener('click', () => {
            const cityName = btn.dataset.city;
            cityInput.value = cityName;
            searchCity();
        });
    });

    // Stop auto-rotation when user interacts
    controls.addEventListener('start', () => { isAnimating = false; });

    // Resume auto-rotation after inactivity
    let interactionTimeout;
    controls.addEventListener('end', () => {
        clearTimeout(interactionTimeout);
        interactionTimeout = setTimeout(() => { isAnimating = true; }, 3000);
    });

    // Start loop
    animate();

    // Initial fetch
    fetchWeather('Manila');
}

// ============================================
// 1. Stars (Particle System)
// ============================================
function createStars() {
    const geometry = new THREE.BufferGeometry();
    const count = 3000;
    const posArray = new Float32Array(count * 3);

    for (let i = 0; i < count * 3; i++) {
        // Spread stars far out
        posArray[i] = (Math.random() - 0.5) * 50;
    }

    geometry.setAttribute('position', new THREE.BufferAttribute(posArray, 3));

    const material = new THREE.PointsMaterial({
        size: 0.03,
        color: 0xffffff,
        transparent: true,
        opacity: 0.8
    });

    stars = new THREE.Points(geometry, material);
    scene.add(stars);
}

// ============================================
// 2. Earth (Enhanced Texture)
// ============================================
function createEarth() {
    const geometry = new THREE.SphereGeometry(1, 64, 64);

    // Procedural texture generation
    const canvas = document.createElement('canvas');
    canvas.width = 1024;
    canvas.height = 512;
    const ctx = canvas.getContext('2d');

    // Deep ocean base
    const oceanGradient = ctx.createLinearGradient(0, 0, 0, 512);
    oceanGradient.addColorStop(0, '#0f172a');
    oceanGradient.addColorStop(0.5, '#1e3a8a');
    oceanGradient.addColorStop(1, '#0f172a');
    ctx.fillStyle = oceanGradient;
    ctx.fillRect(0, 0, 1024, 512);

    // Organic landmasses (using noise-like ellipses)
    ctx.fillStyle = '#15803d'; // Green

    function drawBlob(x, y, size, distinctness) {
        ctx.beginPath();
        for (let i = 0; i <= 10; i++) {
            const angle = (i / 10) * Math.PI * 2;
            const r = size + (Math.random() - 0.5) * distinctness;
            const px = x + Math.cos(angle) * r;
            const py = y + Math.sin(angle) * r;
            if (i === 0) ctx.moveTo(px, py);
            else ctx.lineTo(px, py);
        }
        ctx.fill();
    }

    // Draw continents with more organic shapes
    drawBlob(200, 150, 80, 40); // NA
    drawBlob(280, 320, 60, 30); // SA
    drawBlob(520, 200, 70, 40); // EU/AF
    drawBlob(750, 150, 100, 50); // AS
    drawBlob(850, 350, 40, 20); // AU

    const texture = new THREE.CanvasTexture(canvas);

    const material = new THREE.MeshPhongMaterial({
        map: texture,
        bumpScale: 0.05,
        specular: new THREE.Color(0x111111),
        shininess: 10
    });

    earth = new THREE.Mesh(geometry, material);
    scene.add(earth);
}

// ============================================
// 3. Volumetric Clouds
// ============================================
function createClouds() {
    const geometry = new THREE.SphereGeometry(1.03, 64, 64);

    // Simple noise texture for clouds
    const canvas = document.createElement('canvas');
    canvas.width = 1024;
    canvas.height = 512;
    const ctx = canvas.getContext('2d');

    ctx.fillStyle = 'transparent';
    ctx.fillRect(0, 0, 1024, 512);

    // Draw white wispy clouds
    ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
    for (let i = 0; i < 300; i++) {
        const x = Math.random() * 1024;
        const y = Math.random() * 512;
        const w = Math.random() * 100;
        const h = Math.random() * 30;
        ctx.beginPath();
        ctx.ellipse(x, y, w, h, 0, 0, Math.PI * 2);
        ctx.fill();
    }

    const texture = new THREE.CanvasTexture(canvas);

    const material = new THREE.MeshPhongMaterial({
        map: texture,
        transparent: true,
        opacity: 0.8,
        blending: THREE.AdditiveBlending,
        side: THREE.DoubleSide
    });

    clouds = new THREE.Mesh(geometry, material);
    scene.add(clouds);
}

function createAtmosphere() {
    const geometry = new THREE.SphereGeometry(1.1, 64, 64);
    const material = new THREE.ShaderMaterial({
        vertexShader: `
            varying vec3 vNormal;
            void main() {
                vNormal = normalize(normalMatrix * normal);
                gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
            }
        `,
        fragmentShader: `
            varying vec3 vNormal;
            void main() {
                float intensity = pow(0.6 - dot(vNormal, vec3(0.0, 0.0, 1.0)), 3.0);
                gl_FragColor = vec4(0.3, 0.6, 1.0, 1.0) * intensity;
            }
        `,
        blending: THREE.AdditiveBlending,
        side: THREE.BackSide,
        transparent: true
    });

    atmosphere = new THREE.Mesh(geometry, material);
    scene.add(atmosphere);
}

// ============================================
// Markers & Interaction
// ============================================
function addCityMarkers() {
    MAJOR_CITIES.forEach(city => {
        const marker = createMarker(city.lat, city.lon, city.name);
        markers.push({ mesh: marker, city });
        scene.add(marker);
    });
}

function createMarker(lat, lon, name) {
    const group = new THREE.Group();

    // Hitbox sphere (invisible, but clickable)
    const hitGeometry = new THREE.SphereGeometry(0.08, 16, 16);
    const hitMaterial = new THREE.MeshBasicMaterial({ visible: false });
    const hitSphere = new THREE.Mesh(hitGeometry, hitMaterial);
    group.add(hitSphere); // Index 0

    // Visual Pin
    const pinGeometry = new THREE.SphereGeometry(0.02, 16, 16);
    const pinMaterial = new THREE.MeshBasicMaterial({ color: 0x60a5fa });
    const pin = new THREE.Mesh(pinGeometry, pinMaterial);
    group.add(pin); // Index 1

    // Pulse Ring
    const ringGeometry = new THREE.RingGeometry(0.03, 0.04, 32);
    const ringMaterial = new THREE.MeshBasicMaterial({
        color: 0x60a5fa,
        transparent: true,
        opacity: 0.6,
        side: THREE.DoubleSide
    });
    const ring = new THREE.Mesh(ringGeometry, ringMaterial);
    ring.lookAt(0, 0, 0);
    group.add(ring); // Index 2

    const pos = latLonToVector3(lat, lon, 1.04);
    group.position.copy(pos);
    group.lookAt(0, 0, 0);

    group.userData = { name, lat, lon, isMarker: true };
    return group;
}

// Raycasting Logic
function onMouseMove(event) {
    mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
    mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;

    raycaster.setFromCamera(mouse, camera);

    // Check intersection with marker hitboxes
    // We check markers array meshes (which are Groups) - need to check children[0] (hitSphere)
    const hitSpheres = markers.map(m => m.mesh.children[0]);
    const intersects = raycaster.intersectObjects(hitSpheres);

    if (intersects.length > 0) {
        document.body.style.cursor = 'pointer';
        // Optional: Highlight marker
    } else {
        document.body.style.cursor = 'default';
    }
}

function onMouseClick(event) {
    mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
    mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;

    raycaster.setFromCamera(mouse, camera);
    const hitSpheres = markers.map(m => m.mesh.children[0]);
    const intersects = raycaster.intersectObjects(hitSpheres);

    if (intersects.length > 0) {
        const markerGroup = intersects[0].object.parent;
        const { name, lat, lon } = markerGroup.userData;

        cityInput.value = name;
        fetchWeather(name);

        // Pause rotation on click interaction too
        isAnimating = false;
        setTimeout(() => { isAnimating = true; }, 5000);
    }
}

// ============================================
// Utilities
// ============================================
function latLonToVector3(lat, lon, radius) {
    const phi = (90 - lat) * (Math.PI / 180);
    const theta = (lon + 180) * (Math.PI / 180);
    const x = -radius * Math.sin(phi) * Math.cos(theta);
    const y = radius * Math.cos(phi);
    const z = radius * Math.sin(phi) * Math.sin(theta);
    return new THREE.Vector3(x, y, z);
}

async function fetchWeather(cityName) {
    showLoading(true);
    try {
        const response = await fetch(
            `${API_BASE}/weather?q=${encodeURIComponent(cityName)}&units=metric&appid=${API_KEY}`
        );
        if (!response.ok) throw new Error('City not found');
        const data = await response.json();

        updateWeatherCard(data);

        const city = MAJOR_CITIES.find(c => c.name.toLowerCase() === cityName.toLowerCase());
        if (city) flyToCity(city.lat, city.lon);
        else if (data.coord) flyToCity(data.coord.lat, data.coord.lon);

    } catch (error) {
        console.error(error);
        document.getElementById('cityName').textContent = 'City not found';
    } finally {
        showLoading(false);
    }
}

function updateWeatherCard(data) {
    document.getElementById('cityName').textContent = data.name;
    document.getElementById('weatherTemp').textContent = `${Math.round(data.main.temp)}°C`;
    document.getElementById('weatherDesc').textContent = data.weather[0].description;

    const weatherIcon = getWeatherEmoji(data.weather[0].main);
    document.getElementById('weatherIcon').textContent = weatherIcon;

    document.getElementById('humidity').textContent = `${data.main.humidity}%`;
    document.getElementById('wind').textContent = `${data.wind.speed} m/s`;
    document.getElementById('feelsLike').textContent = `${Math.round(data.main.feels_like)}°C`;

    const tempEl = document.getElementById('weatherTemp');
    const temp = data.main.temp;
    if (temp < 10) tempEl.style.background = 'linear-gradient(135deg, #60a5fa, #3b82f6)';
    else if (temp < 25) tempEl.style.background = 'linear-gradient(135deg, #34d399, #10b981)';
    else tempEl.style.background = 'linear-gradient(135deg, #fbbf24, #f97316)';

    tempEl.style.webkitBackgroundClip = 'text';
    tempEl.style.backgroundClip = 'text';
}

function getWeatherEmoji(condition) {
    const emojis = { 'Clear': '☀️', 'Clouds': '☁️', 'Rain': '🌧️', 'Snow': '❄️', 'Mist': '🌫️', 'Fog': '🌫️', 'Drizzle': '🌦️', 'Thunderstorm': '⛈️' };
    return emojis[condition] || '🌐';
}

function flyToCity(lat, lon) {
    const targetPosition = latLonToVector3(lat, lon, 3.5);
    const startPosition = camera.position.clone();
    const duration = 1500;
    const startTime = Date.now();

    function animateFly() {
        const elapsed = Date.now() - startTime;
        const progress = Math.min(elapsed / duration, 1);
        const eased = 1 - Math.pow(1 - progress, 3);

        camera.position.lerpVectors(startPosition, targetPosition, eased);
        camera.lookAt(0, 0, 0);

        if (progress < 1) requestAnimationFrame(animateFly);
    }
    animateFly();
}

function searchCity() {
    const cityName = cityInput.value.trim();
    if (cityName) fetchWeather(cityName);
}

function showLoading(show) {
    loading.classList.toggle('active', show);
}

function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
}

// ============================================
// Animation Loop
// ============================================
function animate() {
    requestAnimationFrame(animate);

    // Rotations
    if (isAnimating && earth) {
        earth.rotation.y += 0.0005;
        if (clouds) clouds.rotation.y += 0.0007; // Parallax
        if (stars) stars.rotation.y -= 0.0001; // Background drift
    }

    // Pulse markers
    markers.forEach((m, i) => {
        const ring = m.mesh.children[2];
        const scale = 1 + Math.sin(Date.now() * 0.003 + i) * 0.2;
        ring.scale.set(scale, scale, 1);
        ring.lookAt(camera.position); // Always face camera
    });

    controls.update();
    renderer.render(scene, camera);
}

init();
