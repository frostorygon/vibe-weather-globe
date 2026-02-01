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
let selectedMarker = null;

// DOM Elements
const cityInput = document.getElementById('cityInput');
const loading = document.getElementById('loading');
const tooltip = document.getElementById('city-tooltip');

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

    // Lighting
    ambientLight = new THREE.AmbientLight(0x404040, 0.6);
    scene.add(ambientLight);

    sunLight = new THREE.DirectionalLight(0xffffff, 1.4);
    sunLight.position.set(5, 3, 5);
    scene.add(sunLight);

    raycaster = new THREE.Raycaster();
    mouse = new THREE.Vector2();

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

    // Search
    cityInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') searchCity();
    });

    // Zoom controls
    document.getElementById('zoomIn').addEventListener('click', () => {
        camera.position.z = Math.max(camera.position.z - 0.5, 1.5);
    });
    document.getElementById('zoomOut').addEventListener('click', () => {
        camera.position.z = Math.min(camera.position.z + 0.5, 6);
    });
    document.getElementById('resetView').addEventListener('click', () => {
        if (navigator.geolocation) {
            navigator.geolocation.getCurrentPosition(
                (position) => {
                    const { latitude, longitude } = position.coords;
                    flyToCity(latitude, longitude);
                    // Fetch weather for user's location
                    fetch(`${API_BASE}/weather?lat=${latitude}&lon=${longitude}&units=metric&appid=${API_KEY}`)
                        .then(res => res.json())
                        .then(data => updateWeatherCard(data))
                        .catch(err => console.error(err));
                },
                (error) => {
                    console.error('Geolocation error:', error);
                    alert('Could not get your location. Please enable location access.');
                }
            );
        } else {
            alert('Geolocation is not supported by your browser.');
        }
    });

    // Auto-rotation control
    controls.addEventListener('start', () => { isAnimating = false; });
    let interactionTimeout;
    controls.addEventListener('end', () => {
        clearTimeout(interactionTimeout);
        interactionTimeout = setTimeout(() => { isAnimating = true; }, 3000);
    });

    animate();
    fetchWeather('Tokyo');
}

// ============================================
// 3D Objects
// ============================================
function createStars() {
    const geometry = new THREE.BufferGeometry();
    const count = 4000;
    const posArray = new Float32Array(count * 3);

    for (let i = 0; i < count; i++) {
        posArray[i * 3] = (Math.random() - 0.5) * 60;
        posArray[i * 3 + 1] = (Math.random() - 0.5) * 60;
        posArray[i * 3 + 2] = (Math.random() - 0.5) * 60;
    }

    geometry.setAttribute('position', new THREE.BufferAttribute(posArray, 3));

    const material = new THREE.PointsMaterial({
        size: 0.05,
        color: 0xffffff,
        transparent: true,
        opacity: 0.9
    });

    stars = new THREE.Points(geometry, material);
    scene.add(stars);
}

function createEarth() {
    const geometry = new THREE.SphereGeometry(1, 64, 64);
    const textureLoader = new THREE.TextureLoader();

    // NASA Blue Marble textures
    const earthTexture = textureLoader.load(
        'https://unpkg.com/three-globe/example/img/earth-blue-marble.jpg'
    );
    const bumpTexture = textureLoader.load(
        'https://unpkg.com/three-globe/example/img/earth-topology.png'
    );

    const material = new THREE.MeshPhongMaterial({
        map: earthTexture,
        bumpMap: bumpTexture,
        bumpScale: 0.05,
        specular: new THREE.Color(0x333333),
        shininess: 5
    });

    earth = new THREE.Mesh(geometry, material);
    scene.add(earth);
}

function createClouds() {
    const geometry = new THREE.SphereGeometry(1.02, 64, 64);
    const textureLoader = new THREE.TextureLoader();

    const cloudTexture = textureLoader.load(
        'https://unpkg.com/three-globe/example/img/earth-clouds.png'
    );

    const material = new THREE.MeshPhongMaterial({
        map: cloudTexture,
        transparent: true,
        opacity: 0.35,
        depthWrite: false,
        side: THREE.DoubleSide
    });

    clouds = new THREE.Mesh(geometry, material);
    scene.add(clouds);
}

function createAtmosphere() {
    const geometry = new THREE.SphereGeometry(1.12, 64, 64);
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
                float intensity = pow(0.65 - dot(vNormal, vec3(0.0, 0.0, 1.0)), 2.0);
                gl_FragColor = vec4(0.2, 0.5, 1.0, 1.0) * intensity * 0.7;
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
        earth.add(marker); // Add to earth so markers rotate with it
    });
}

function createMarker(lat, lon, name) {
    const group = new THREE.Group();

    const hitGeometry = new THREE.SphereGeometry(0.08, 16, 16);
    const hitMaterial = new THREE.MeshBasicMaterial({ visible: false });
    const hitSphere = new THREE.Mesh(hitGeometry, hitMaterial);
    group.add(hitSphere);

    const pinGeometry = new THREE.SphereGeometry(0.02, 16, 16);
    const pinMaterial = new THREE.MeshBasicMaterial({ color: 0x22d3ee });
    const pin = new THREE.Mesh(pinGeometry, pinMaterial);
    group.add(pin);

    const ringGeometry = new THREE.RingGeometry(0.03, 0.04, 32);
    const ringMaterial = new THREE.MeshBasicMaterial({
        color: 0x22d3ee,
        transparent: true,
        opacity: 0.6,
        side: THREE.DoubleSide
    });
    const ring = new THREE.Mesh(ringGeometry, ringMaterial);
    group.add(ring);

    const pos = latLonToVector3(lat, lon, 1.04);
    group.position.copy(pos);
    group.lookAt(0, 0, 0);
    group.userData = { name, lat, lon };
    return group;
}

// ============================================
// Raycasting
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

        tooltip.textContent = markerGroup.userData.name;
        tooltip.style.left = event.clientX + 15 + 'px';
        tooltip.style.top = event.clientY - 10 + 'px';
        tooltip.style.opacity = '1';

        if (markerGroup !== selectedMarker) {
            markerGroup.children[1].material.color.setHex(0xffffff);
        }
    } else {
        document.body.style.cursor = 'default';
        tooltip.style.opacity = '0';

        if (hoveredMarker && hoveredMarker !== selectedMarker) {
            hoveredMarker.children[1].material.color.setHex(0x22d3ee);
        }
        hoveredMarker = null;
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
// Weather
// ============================================
async function fetchWeather(cityName) {
    showLoading(true);
    try {
        const response = await fetch(
            `${API_BASE}/weather?q=${encodeURIComponent(cityName)}&units=metric&appid=${API_KEY}`
        );
        if (!response.ok) throw new Error('City not found');
        const data = await response.json();

        updateWeatherCard(data);

        // Use API's returned name for accurate matching
        const apiCityName = data.name;
        updateSelectedMarker(apiCityName);

        // Fly to city coordinates from API (always accurate)
        flyToCity(data.coord.lat, data.coord.lon);

    } catch (error) {
        console.error(error);
        document.getElementById('cityName').textContent = 'City not found';
    } finally {
        showLoading(false);
    }
}

function updateWeatherCard(data) {
    document.getElementById('cityName').textContent = `${data.name}, ${data.sys.country}`;
    document.getElementById('weatherTemp').textContent = `${Math.round(data.main.temp)}°`;
    document.getElementById('weatherDesc').textContent = data.weather[0].description;

    // Coordinates
    const lat = data.coord.lat.toFixed(4);
    const lon = data.coord.lon.toFixed(4);
    const latDir = data.coord.lat >= 0 ? 'N' : 'S';
    const lonDir = data.coord.lon >= 0 ? 'E' : 'W';
    document.getElementById('coordsText').textContent =
        `${Math.abs(lat)}° ${latDir}, ${Math.abs(lon)}° ${lonDir}`;

    // Details
    document.getElementById('humidity').textContent = `${data.main.humidity}%`;
    document.getElementById('wind').innerHTML = `${data.wind.speed} <small>m/s</small>`;
    document.getElementById('pressure').innerHTML = `${data.main.pressure} <small>hPa</small>`;

    const visibility = data.visibility ? (data.visibility / 1000).toFixed(1) : '--';
    document.getElementById('visibility').innerHTML = `${visibility} <small>km</small>`;
}

function updateSelectedMarker(cityName) {
    if (selectedMarker) {
        selectedMarker.children[1].material.color.setHex(0x22d3ee);
        selectedMarker.children[2].material.color.setHex(0x22d3ee);
    }

    const found = markers.find(m => m.city.name.toLowerCase() === cityName.toLowerCase());
    if (found) {
        selectedMarker = found.mesh;
        selectedMarker.children[1].material.color.setHex(0x135bec);
        selectedMarker.children[2].material.color.setHex(0x135bec);
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

function flyToCity(lat, lon) {
    // Stop auto-rotation during animation
    isAnimating = false;

    // Calculate target rotation for Earth so the city faces the camera (positive Z axis)
    // We need to rotate the city position to face (0, 0, 1)
    const targetRotationY = -lon * (Math.PI / 180) - Math.PI / 2;
    const targetRotationX = -lat * (Math.PI / 180);

    const startRotationX = earth.rotation.x;
    const startRotationY = earth.rotation.y;
    const startCameraZ = camera.position.z;
    const targetCameraZ = 3.0;

    const duration = 1500;
    const startTime = Date.now();

    function animateFly() {
        const elapsed = Date.now() - startTime;
        const progress = Math.min(elapsed / duration, 1);
        const eased = 1 - Math.pow(1 - progress, 3);

        // Rotate Earth on both axes to center the city
        earth.rotation.x = startRotationX + (targetRotationX - startRotationX) * eased;
        earth.rotation.y = startRotationY + (targetRotationY - startRotationY) * eased;

        // Zoom camera
        camera.position.z = startCameraZ + (targetCameraZ - startCameraZ) * eased;
        camera.lookAt(0, 0, 0);

        if (progress < 1) {
            requestAnimationFrame(animateFly);
        } else {
            setTimeout(() => { isAnimating = true; }, 3000);
        }
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
