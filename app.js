// ============================================
// Vibe Weather Globe 3.0 🌍
// Premium 3D Earth with Live Weather
// ============================================

const API_KEY = '439d4b804bc8187953eb36d2a8c26a02';
const API_BASE = 'https://openweathermap.org/data/2.5';

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
let ambientLight, sunLight;
let markers = [];
let raycaster, mouse;
let isAnimating = true;
let tooltip;
let selectedMarker = null;

// DOM Elements
const cityInput = document.getElementById('cityInput');
const searchBtn = document.getElementById('searchBtn');
const loading = document.getElementById('loading');

// ============================================
// Initialize Scene
// ============================================
function init() {
    scene = new THREE.Scene();

    camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 1000);
    camera.position.z = 3.5;

    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    document.getElementById('globe-container').appendChild(renderer.domElement);

    controls = new THREE.OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.rotateSpeed = 0.5;
    controls.minDistance = 1.5;
    controls.maxDistance = 6;
    controls.enablePan = false;

    // Lighting (dynamic for weather mood)
    ambientLight = new THREE.AmbientLight(0x404040, 0.6);
    scene.add(ambientLight);

    sunLight = new THREE.DirectionalLight(0xffffff, 1.4);
    sunLight.position.set(5, 3, 5);
    scene.add(sunLight);

    raycaster = new THREE.Raycaster();
    mouse = new THREE.Vector2();

    // Create tooltip element
    createTooltip();

    // Create 3D objects
    createStars();
    createEarth();
    createClouds();
    createAtmosphere();
    addCityMarkers();

    // Event Listeners
    window.addEventListener('resize', onWindowResize);
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('click', onMouseClick);

    searchBtn.addEventListener('click', searchCity);
    cityInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') searchCity();
    });

    document.querySelectorAll('.quick-cities button').forEach(btn => {
        btn.addEventListener('click', () => {
            cityInput.value = btn.dataset.city;
            searchCity();
        });
    });

    controls.addEventListener('start', () => { isAnimating = false; });
    let interactionTimeout;
    controls.addEventListener('end', () => {
        clearTimeout(interactionTimeout);
        interactionTimeout = setTimeout(() => { isAnimating = true; }, 3000);
    });

    animate();
    fetchWeather('Manila');
}

// ============================================
// Tooltip (City Name on Hover)
// ============================================
function createTooltip() {
    tooltip = document.createElement('div');
    tooltip.id = 'city-tooltip';
    tooltip.style.cssText = `
        position: fixed;
        padding: 6px 12px;
        background: rgba(15, 23, 42, 0.9);
        backdrop-filter: blur(10px);
        border: 1px solid rgba(96, 165, 250, 0.5);
        border-radius: 8px;
        color: #fff;
        font-size: 13px;
        font-weight: 500;
        pointer-events: none;
        opacity: 0;
        transition: opacity 0.2s;
        z-index: 1000;
        box-shadow: 0 4px 20px rgba(0,0,0,0.3);
    `;
    document.body.appendChild(tooltip);
}

// ============================================
// 1. Stars (Brighter, More Depth)
// ============================================
function createStars() {
    const geometry = new THREE.BufferGeometry();
    const count = 4000;
    const posArray = new Float32Array(count * 3);
    const sizeArray = new Float32Array(count);

    for (let i = 0; i < count; i++) {
        posArray[i * 3] = (Math.random() - 0.5) * 60;
        posArray[i * 3 + 1] = (Math.random() - 0.5) * 60;
        posArray[i * 3 + 2] = (Math.random() - 0.5) * 60;
        sizeArray[i] = Math.random() * 0.08 + 0.02;
    }

    geometry.setAttribute('position', new THREE.BufferAttribute(posArray, 3));

    const material = new THREE.PointsMaterial({
        size: 0.05,
        color: 0xffffff,
        transparent: true,
        opacity: 0.9,
        sizeAttenuation: true
    });

    stars = new THREE.Points(geometry, material);
    scene.add(stars);
}

// ============================================
// 2. Earth (Noise-Based Realistic Texture)
// ============================================
function createEarth() {
    const geometry = new THREE.SphereGeometry(1, 64, 64);

    const canvas = document.createElement('canvas');
    canvas.width = 2048;
    canvas.height = 1024;
    const ctx = canvas.getContext('2d');

    // Ocean gradient (deeper blues)
    const oceanGradient = ctx.createLinearGradient(0, 0, 0, 1024);
    oceanGradient.addColorStop(0, '#0c1929');
    oceanGradient.addColorStop(0.3, '#1e3a5f');
    oceanGradient.addColorStop(0.5, '#1e40af');
    oceanGradient.addColorStop(0.7, '#1e3a5f');
    oceanGradient.addColorStop(1, '#0c1929');
    ctx.fillStyle = oceanGradient;
    ctx.fillRect(0, 0, 2048, 1024);

    // Simplex-like noise for land (fractal blobs)
    function drawContinent(baseX, baseY, complexity, baseSize) {
        const gradient = ctx.createRadialGradient(baseX, baseY, 0, baseX, baseY, baseSize);
        gradient.addColorStop(0, '#22c55e');
        gradient.addColorStop(0.5, '#16a34a');
        gradient.addColorStop(0.8, '#15803d');
        gradient.addColorStop(1, '#166534');
        ctx.fillStyle = gradient;

        for (let layer = 0; layer < complexity; layer++) {
            ctx.beginPath();
            const points = 12 + layer * 3;
            for (let i = 0; i <= points; i++) {
                const angle = (i / points) * Math.PI * 2;
                const noiseR = baseSize * (0.6 + Math.random() * 0.4) / (layer * 0.3 + 1);
                const offsetX = (Math.random() - 0.5) * baseSize * 0.3;
                const offsetY = (Math.random() - 0.5) * baseSize * 0.3;
                const px = baseX + offsetX + Math.cos(angle) * noiseR;
                const py = baseY + offsetY + Math.sin(angle) * noiseR;
                if (i === 0) ctx.moveTo(px, py);
                else ctx.lineTo(px, py);
            }
            ctx.closePath();
            ctx.fill();
        }
    }

    // Major landmasses
    drawContinent(400, 280, 4, 180);   // North America
    drawContinent(480, 650, 3, 120);   // South America
    drawContinent(1100, 350, 5, 200);  // Europe/Africa
    drawContinent(1550, 300, 5, 250);  // Asia
    drawContinent(1700, 700, 3, 100);  // Australia
    drawContinent(1000, 900, 2, 60);   // Antarctica bits

    // Small islands
    for (let i = 0; i < 30; i++) {
        const x = Math.random() * 2048;
        const y = Math.random() * 1024;
        ctx.fillStyle = '#16a34a';
        ctx.beginPath();
        ctx.arc(x, y, Math.random() * 15 + 5, 0, Math.PI * 2);
        ctx.fill();
    }

    const texture = new THREE.CanvasTexture(canvas);

    const material = new THREE.MeshPhongMaterial({
        map: texture,
        bumpScale: 0.02,
        specular: new THREE.Color(0x222244),
        shininess: 15
    });

    earth = new THREE.Mesh(geometry, material);
    scene.add(earth);
}

// ============================================
// 3. Clouds (Fixed Blending + Visibility)
// ============================================
function createClouds() {
    const geometry = new THREE.SphereGeometry(1.025, 64, 64);

    const canvas = document.createElement('canvas');
    canvas.width = 2048;
    canvas.height = 1024;
    const ctx = canvas.getContext('2d');

    // Transparent base
    ctx.clearRect(0, 0, 2048, 1024);

    // Wispy cloud bands
    for (let band = 0; band < 8; band++) {
        const y = 100 + band * 120;
        ctx.fillStyle = `rgba(255, 255, 255, ${0.15 + Math.random() * 0.1})`;
        for (let i = 0; i < 40; i++) {
            const x = Math.random() * 2048;
            const w = Math.random() * 200 + 50;
            const h = Math.random() * 40 + 10;
            ctx.beginPath();
            ctx.ellipse(x, y + (Math.random() - 0.5) * 60, w, h, 0, 0, Math.PI * 2);
            ctx.fill();
        }
    }

    const texture = new THREE.CanvasTexture(canvas);

    const material = new THREE.MeshPhongMaterial({
        map: texture,
        transparent: true,
        opacity: 0.6,
        depthWrite: false,
        side: THREE.DoubleSide
    });

    clouds = new THREE.Mesh(geometry, material);
    scene.add(clouds);
}

// ============================================
// 4. Atmosphere (Brighter Glow)
// ============================================
function createAtmosphere() {
    const geometry = new THREE.SphereGeometry(1.15, 64, 64);
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
                float intensity = pow(0.7 - dot(vNormal, vec3(0.0, 0.0, 1.0)), 2.0);
                gl_FragColor = vec4(0.3, 0.6, 1.0, 1.0) * intensity * 0.8;
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
// Markers
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

    const hitGeometry = new THREE.SphereGeometry(0.08, 16, 16);
    const hitMaterial = new THREE.MeshBasicMaterial({ visible: false });
    const hitSphere = new THREE.Mesh(hitGeometry, hitMaterial);
    group.add(hitSphere);

    const pinGeometry = new THREE.SphereGeometry(0.025, 16, 16);
    const pinMaterial = new THREE.MeshBasicMaterial({ color: 0x60a5fa });
    const pin = new THREE.Mesh(pinGeometry, pinMaterial);
    group.add(pin);

    const ringGeometry = new THREE.RingGeometry(0.035, 0.045, 32);
    const ringMaterial = new THREE.MeshBasicMaterial({
        color: 0x60a5fa,
        transparent: true,
        opacity: 0.7,
        side: THREE.DoubleSide
    });
    const ring = new THREE.Mesh(ringGeometry, ringMaterial);
    group.add(ring);

    const pos = latLonToVector3(lat, lon, 1.04);
    group.position.copy(pos);
    group.lookAt(0, 0, 0);
    group.userData = { name, lat, lon, isMarker: true };
    return group;
}

// ============================================
// Raycasting & Tooltip
// ============================================
let hoveredMarker = null;

function onMouseMove(event) {
    mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
    mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;

    raycaster.setFromCamera(mouse, camera);
    const hitSpheres = markers.map(m => m.mesh.children[0]);
    const intersects = raycaster.intersectObjects(hitSpheres);

    if (intersects.length > 0) {
        const markerGroup = intersects[0].object.parent;
        hoveredMarker = markerGroup;
        document.body.style.cursor = 'pointer';

        // Show tooltip
        tooltip.textContent = markerGroup.userData.name;
        tooltip.style.left = event.clientX + 15 + 'px';
        tooltip.style.top = event.clientY - 10 + 'px';
        tooltip.style.opacity = '1';

        // Highlight marker
        markerGroup.children[1].material.color.setHex(0xfbbf24);
    } else {
        document.body.style.cursor = 'default';
        tooltip.style.opacity = '0';

        if (hoveredMarker) {
            hoveredMarker.children[1].material.color.setHex(0x60a5fa);
            hoveredMarker = null;
        }
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
        const { name } = markerGroup.userData;
        cityInput.value = name;
        fetchWeather(name);
        isAnimating = false;
        setTimeout(() => { isAnimating = true; }, 5000);
    }
}

// ============================================
// Weather Mood Lighting
// ============================================
function setWeatherMood(condition) {
    const moods = {
        'Clear': { ambient: 0xfff4e6, sun: 0xfffaf0, intensity: 1.6 },
        'Clouds': { ambient: 0x9ca3af, sun: 0xe5e7eb, intensity: 1.0 },
        'Rain': { ambient: 0x4b5563, sun: 0x93c5fd, intensity: 0.8 },
        'Snow': { ambient: 0xe0f2fe, sun: 0xffffff, intensity: 1.2 },
        'Thunderstorm': { ambient: 0x374151, sun: 0x6366f1, intensity: 0.6 },
        'default': { ambient: 0x404040, sun: 0xffffff, intensity: 1.2 }
    };

    const mood = moods[condition] || moods['default'];
    ambientLight.color.setHex(mood.ambient);
    sunLight.color.setHex(mood.sun);
    sunLight.intensity = mood.intensity;
}

// ============================================
// Selected Marker Highlight
// ============================================
function updateSelectedMarker(cityName) {
    // Reset previous selection
    if (selectedMarker) {
        selectedMarker.children[1].material.color.setHex(0x60a5fa);
        selectedMarker.children[2].material.color.setHex(0x60a5fa);
    }

    // Find and highlight new selection
    const found = markers.find(m => m.city.name.toLowerCase() === cityName.toLowerCase());
    if (found) {
        selectedMarker = found.mesh;
        selectedMarker.children[1].material.color.setHex(0xfbbf24); // Gold pin
        selectedMarker.children[2].material.color.setHex(0xfbbf24); // Gold ring
    }
}

// ============================================
// Utilities
// ============================================
function latLonToVector3(lat, lon, radius) {
    const phi = (90 - lat) * (Math.PI / 180);
    const theta = (lon + 180) * (Math.PI / 180);
    return new THREE.Vector3(
        -radius * Math.sin(phi) * Math.cos(theta),
        radius * Math.cos(phi),
        radius * Math.sin(phi) * Math.sin(theta)
    );
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
        setWeatherMood(data.weather[0].main);

        // Update selected marker
        updateSelectedMarker(cityName);

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
    document.getElementById('weatherIcon').textContent = getWeatherEmoji(data.weather[0].main);
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

    if (isAnimating && earth) {
        earth.rotation.y += 0.0004;
        if (clouds) clouds.rotation.y += 0.0006;
        if (stars) stars.rotation.y -= 0.00005;
    }

    markers.forEach((m, i) => {
        const ring = m.mesh.children[2];
        const scale = 1 + Math.sin(Date.now() * 0.003 + i) * 0.25;
        ring.scale.set(scale, scale, 1);
        ring.lookAt(camera.position);
    });

    controls.update();
    renderer.render(scene, camera);
}

init();
