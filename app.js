// ============================================
// Vibe Weather Globe 🌍
// 3D Earth with Live Weather Overlays
// ============================================

// OpenWeatherMap API (free tier)
const API_KEY = '439d4b804bc8187953eb36d2a8c26a02'; // Demo key - replace with yours
const API_BASE = 'https://openweathermap.org/data/2.5';

// City coordinates for markers
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
let earth, atmosphere, markers = [];
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
    // Scene
    scene = new THREE.Scene();
    
    // Camera
    camera = new THREE.PerspectiveCamera(
        45,
        window.innerWidth / window.innerHeight,
        0.1,
        1000
    );
    camera.position.z = 3;
    
    // Renderer
    renderer = new THREE.WebGLRenderer({ 
        antialias: true, 
        alpha: true 
    });
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
    
    // Create Earth
    createEarth();
    
    // Create Atmosphere
    createAtmosphere();
    
    // Add city markers
    addCityMarkers();
    
    // Event Listeners
    window.addEventListener('resize', onWindowResize);
    searchBtn.addEventListener('click', searchCity);
    cityInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') searchCity();
    });
    
    // Quick city buttons
    document.querySelectorAll('.quick-cities button').forEach(btn => {
        btn.addEventListener('click', () => {
            const cityName = btn.dataset.city;
            cityInput.value = cityName;
            searchCity();
        });
    });
    
    // Start animation
    animate();
    
    // Load initial weather for a default city
    fetchWeather('Manila');
}

// ============================================
// Create Earth Sphere
// ============================================
function createEarth() {
    const geometry = new THREE.SphereGeometry(1, 64, 64);
    
    // Create texture with gradient (no external image needed)
    const canvas = document.createElement('canvas');
    canvas.width = 1024;
    canvas.height = 512;
    const ctx = canvas.getContext('2d');
    
    // Ocean gradient
    const oceanGradient = ctx.createLinearGradient(0, 0, 0, 512);
    oceanGradient.addColorStop(0, '#1e3a5f');
    oceanGradient.addColorStop(0.5, '#1a4d6e');
    oceanGradient.addColorStop(1, '#1e3a5f');
    ctx.fillStyle = oceanGradient;
    ctx.fillRect(0, 0, 1024, 512);
    
    // Add some landmass shapes (simplified continents)
    ctx.fillStyle = '#2d5a3d';
    
    // North America
    ctx.beginPath();
    ctx.ellipse(200, 150, 100, 80, 0, 0, Math.PI * 2);
    ctx.fill();
    
    // South America
    ctx.beginPath();
    ctx.ellipse(280, 320, 50, 100, 0.3, 0, Math.PI * 2);
    ctx.fill();
    
    // Europe/Africa
    ctx.beginPath();
    ctx.ellipse(520, 200, 60, 150, 0, 0, Math.PI * 2);
    ctx.fill();
    
    // Asia
    ctx.beginPath();
    ctx.ellipse(700, 150, 150, 100, 0, 0, Math.PI * 2);
    ctx.fill();
    
    // Australia
    ctx.beginPath();
    ctx.ellipse(820, 350, 60, 40, 0, 0, Math.PI * 2);
    ctx.fill();
    
    // Add some texture noise
    for (let i = 0; i < 5000; i++) {
        const x = Math.random() * 1024;
        const y = Math.random() * 512;
        ctx.fillStyle = `rgba(255, 255, 255, ${Math.random() * 0.05})`;
        ctx.fillRect(x, y, 2, 2);
    }
    
    const texture = new THREE.CanvasTexture(canvas);
    
    const material = new THREE.MeshPhongMaterial({
        map: texture,
        bumpScale: 0.05,
        specular: new THREE.Color(0x333333),
        shininess: 5
    });
    
    earth = new THREE.Mesh(geometry, material);
    scene.add(earth);
}

// ============================================
// Create Atmospheric Glow
// ============================================
function createAtmosphere() {
    const geometry = new THREE.SphereGeometry(1.02, 64, 64);
    
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
                gl_FragColor = vec4(0.3, 0.6, 1.0, 1.0) * intensity;
            }
        `,
        blending: THREE.AdditiveBlending,
        side: THREE.BackSide,
        transparent: true
    });
    
    atmosphere = new THREE.Mesh(geometry, material);
    atmosphere.scale.set(1.15, 1.15, 1.15);
    scene.add(atmosphere);
}

// ============================================
// Add City Markers
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
    
    // Pin
    const pinGeometry = new THREE.SphereGeometry(0.02, 16, 16);
    const pinMaterial = new THREE.MeshBasicMaterial({ 
        color: 0x60a5fa,
        transparent: true,
        opacity: 0.9
    });
    const pin = new THREE.Mesh(pinGeometry, pinMaterial);
    group.add(pin);
    
    // Glow ring
    const ringGeometry = new THREE.RingGeometry(0.025, 0.04, 32);
    const ringMaterial = new THREE.MeshBasicMaterial({
        color: 0x60a5fa,
        transparent: true,
        opacity: 0.5,
        side: THREE.DoubleSide
    });
    const ring = new THREE.Mesh(ringGeometry, ringMaterial);
    group.add(ring);
    
    // Position on globe
    const position = latLonToVector3(lat, lon, 1.02);
    group.position.copy(position);
    group.lookAt(0, 0, 0);
    
    group.userData = { name, lat, lon };
    
    return group;
}

// ============================================
// Coordinate Conversion
// ============================================
function latLonToVector3(lat, lon, radius) {
    const phi = (90 - lat) * (Math.PI / 180);
    const theta = (lon + 180) * (Math.PI / 180);
    
    const x = -radius * Math.sin(phi) * Math.cos(theta);
    const y = radius * Math.cos(phi);
    const z = radius * Math.sin(phi) * Math.sin(theta);
    
    return new THREE.Vector3(x, y, z);
}

// ============================================
// Weather API
// ============================================
async function fetchWeather(cityName) {
    showLoading(true);
    
    try {
        // Use openweathermap's demo endpoint
        const response = await fetch(
            `${API_BASE}/weather?q=${encodeURIComponent(cityName)}&units=metric&appid=${API_KEY}`
        );
        
        if (!response.ok) {
            throw new Error('City not found');
        }
        
        const data = await response.json();
        updateWeatherCard(data);
        
        // Fly camera to city
        const city = MAJOR_CITIES.find(c => 
            c.name.toLowerCase() === cityName.toLowerCase()
        );
        
        if (city) {
            flyToCity(city.lat, city.lon);
        } else if (data.coord) {
            flyToCity(data.coord.lat, data.coord.lon);
        }
        
    } catch (error) {
        console.error('Weather fetch error:', error);
        document.getElementById('cityName').textContent = 'City not found';
        document.getElementById('weatherDesc').textContent = 'Try another city';
    } finally {
        showLoading(false);
    }
}

function updateWeatherCard(data) {
    document.getElementById('cityName').textContent = data.name;
    document.getElementById('weatherTemp').textContent = `${Math.round(data.main.temp)}°C`;
    document.getElementById('weatherDesc').textContent = data.weather[0].description;
    document.getElementById('humidity').textContent = `${data.main.humidity}%`;
    document.getElementById('wind').textContent = `${data.wind.speed} m/s`;
    document.getElementById('feelsLike').textContent = `${Math.round(data.main.feels_like)}°C`;
    
    // Weather icon
    const weatherIcon = getWeatherEmoji(data.weather[0].main);
    document.getElementById('weatherIcon').textContent = weatherIcon;
    
    // Update temp color based on temperature
    const tempEl = document.getElementById('weatherTemp');
    const temp = data.main.temp;
    if (temp < 10) {
        tempEl.style.background = 'linear-gradient(135deg, #60a5fa, #3b82f6)';
    } else if (temp < 25) {
        tempEl.style.background = 'linear-gradient(135deg, #34d399, #10b981)';
    } else {
        tempEl.style.background = 'linear-gradient(135deg, #fbbf24, #f97316)';
    }
    tempEl.style.webkitBackgroundClip = 'text';
    tempEl.style.backgroundClip = 'text';
}

function getWeatherEmoji(condition) {
    const emojis = {
        'Clear': '☀️',
        'Clouds': '☁️',
        'Rain': '🌧️',
        'Drizzle': '🌦️',
        'Thunderstorm': '⛈️',
        'Snow': '❄️',
        'Mist': '🌫️',
        'Fog': '🌫️',
        'Haze': '🌫️',
        'Smoke': '💨',
        'Dust': '💨',
        'Sand': '💨',
        'Ash': '🌋',
        'Squall': '💨',
        'Tornado': '🌪️'
    };
    return emojis[condition] || '🌐';
}

// ============================================
// Camera Animation
// ============================================
function flyToCity(lat, lon) {
    const targetPosition = latLonToVector3(lat, lon, 3);
    
    // Animate camera
    const startPosition = camera.position.clone();
    const duration = 1500;
    const startTime = Date.now();
    
    function animateFly() {
        const elapsed = Date.now() - startTime;
        const progress = Math.min(elapsed / duration, 1);
        
        // Easing function
        const eased = 1 - Math.pow(1 - progress, 3);
        
        camera.position.lerpVectors(startPosition, targetPosition, eased);
        camera.lookAt(0, 0, 0);
        
        if (progress < 1) {
            requestAnimationFrame(animateFly);
        }
    }
    
    animateFly();
}

// ============================================
// Search Handler
// ============================================
function searchCity() {
    const cityName = cityInput.value.trim();
    if (cityName) {
        fetchWeather(cityName);
    }
}

// ============================================
// UI Helpers
// ============================================
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
    
    // Auto-rotate earth slowly
    if (earth && isAnimating) {
        earth.rotation.y += 0.001;
    }
    
    // Update marker pulse effect
    markers.forEach((m, i) => {
        const ring = m.mesh.children[1];
        const scale = 1 + Math.sin(Date.now() * 0.003 + i) * 0.2;
        ring.scale.set(scale, scale, 1);
    });
    
    controls.update();
    renderer.render(scene, camera);
}

// ============================================
// Start App
// ============================================
init();
