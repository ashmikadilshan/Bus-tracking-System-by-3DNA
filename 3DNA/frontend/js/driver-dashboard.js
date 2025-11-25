/* ============================================
   3DNA BUS TRACKING - DRIVER DASHBOARD
   ============================================ */

let driverMap;
let driverMarker = null;
let tripActive = false;
let gpsUpdateInterval = null;
let currentBusId = null;
const API_BASE = '../../backend/api';

// Initialize driver dashboard
document.addEventListener('DOMContentLoaded', () => {
    checkAuth();
    initDriverMap();
    loadBusAssignment();
    setupEventListeners();
});

// Check authentication
function checkAuth() {
    const userType = localStorage.getItem('user_type');
    if (userType !== 'driver') {
        window.location.href = 'index.html';
    }
    
    const driverName = localStorage.getItem('user_email');
    document.getElementById('driver-name').textContent = driverName || 'Driver';
}

// Initialize map
function initDriverMap() {
    driverMap = L.map('driver-map').setView([40.7128, -74.0060], 14);
    
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap',
        maxZoom: 19
    }).addTo(driverMap);
}

// Load bus assignment for this driver
async function loadBusAssignment() {
    try {
        const userId = localStorage.getItem('user_id');
        const response = await fetch(`${API_BASE}/drivers.php?action=assigned_bus&user_id=${userId}`, {
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
            }
        });
        
        const data = await response.json();
        if (data.success && data.bus) {
            const bus = data.bus;
            currentBusId = bus.bus_id;
            
            document.getElementById('bus-number').textContent = bus.bus_number;
            document.getElementById('route-name').textContent = `${bus.route_number} - ${bus.route_name}`;
            
            // Initialize route
            if (bus.current_latitude && bus.current_longitude) {
                driverMap.setView([bus.current_latitude, bus.current_longitude], 14);
            }
        }
    } catch (error) {
        console.error('Error loading bus assignment:', error);
    }
}

// Setup event listeners
function setupEventListeners() {
    document.getElementById('auto-gps').addEventListener('change', (e) => {
        if (e.target.checked && tripActive) {
            startAutoGPS();
        } else {
            stopAutoGPS();
        }
    });
    
    document.getElementById('update-interval').addEventListener('change', (e) => {
        if (gpsUpdateInterval) {
            stopAutoGPS();
            startAutoGPS();
        }
    });
}

// Start trip
async function startTrip() {
    try {
        const response = await fetch(`${API_BASE}/trips.php?action=start`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
            },
            body: JSON.stringify({
                bus_id: currentBusId,
                driver_id: localStorage.getItem('user_id')
            })
        });
        
        const data = await response.json();
        if (data.success) {
            tripActive = true;
            updateTripUI();
            
            if (document.getElementById('auto-gps').checked) {
                startAutoGPS();
            }
            
            alert('Trip started!');
        }
    } catch (error) {
        alert('Error starting trip: ' + error.message);
    }
}

// Stop trip
async function stopTrip() {
    if (confirm('End trip? This will stop GPS tracking.')) {
        try {
            stopAutoGPS();
            
            const response = await fetch(`${API_BASE}/trips.php?action=end`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
                },
                body: JSON.stringify({
                    bus_id: currentBusId
                })
            });
            
            const data = await response.json();
            if (data.success) {
                tripActive = false;
                updateTripUI();
                alert('Trip ended!');
            }
        } catch (error) {
            alert('Error ending trip: ' + error.message);
        }
    }
}

// Pause trip
async function pauseTrip() {
    try {
        stopAutoGPS();
        tripActive = false;
        updateTripUI();
        alert('Trip paused!');
    } catch (error) {
        alert('Error pausing trip: ' + error.message);
    }
}

// Update Location
async function updateLocation() {
    if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(async (position) => {
            const lat = position.coords.latitude;
            const lng = position.coords.longitude;
            const speed = position.coords.speed || 0;
            const accuracy = position.coords.accuracy;
            
            try {
                const response = await fetch(`${API_BASE}/locations.php?action=update`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
                    },
                    body: JSON.stringify({
                        bus_id: currentBusId,
                        driver_id: localStorage.getItem('user_id'),
                        latitude: lat,
                        longitude: lng,
                        speed_kmh: speed * 3.6,
                        accuracy_meters: Math.round(accuracy)
                    })
                });
                
                const data = await response.json();
                if (data.success) {
                    updateMapWithLocation(lat, lng);
                    document.getElementById('current-location').textContent = 
                        `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
                    document.getElementById('current-speed').textContent = 
                        (speed * 3.6).toFixed(1);
                    document.getElementById('last-update').textContent = 
                        new Date().toLocaleTimeString();
                }
            } catch (error) {
                console.error('Error updating location:', error);
            }
        }, (error) => {
            alert('GPS Error: ' + error.message);
        });
    } else {
        alert('Geolocation is not supported by your browser');
    }
}

// Start Auto GPS
function startAutoGPS() {
    const interval = parseInt(document.getElementById('update-interval').value) * 1000;
    
    gpsUpdateInterval = setInterval(() => {
        updateLocation();
    }, interval);
}

// Stop Auto GPS
function stopAutoGPS() {
    if (gpsUpdateInterval) {
        clearInterval(gpsUpdateInterval);
        gpsUpdateInterval = null;
    }
}

// Update map with driver location
function updateMapWithLocation(lat, lng) {
    if (driverMarker) {
        driverMarker.setLatLng([lat, lng]);
    } else {
        driverMarker = L.marker([lat, lng], {
            icon: L.divIcon({
                html: `<div style="font-size: 2rem;">🚌</div>`,
                iconSize: [40, 40],
                className: 'driver-marker'
            })
        }).addTo(driverMap);
    }
    
    driverMap.setView([lat, lng], 14);
}

// Update Trip UI
function updateTripUI() {
    const startBtn = document.getElementById('start-trip-btn');
    const stopBtn = document.getElementById('stop-trip-btn');
    const pauseBtn = document.getElementById('pause-trip-btn');
    
    if (tripActive) {
        startBtn.classList.add('hidden');
        stopBtn.classList.remove('hidden');
        pauseBtn.classList.remove('hidden');
        
        document.getElementById('status-dot').className = 'status-dot active';
        document.getElementById('status-text').textContent = 'Active';
    } else {
        startBtn.classList.remove('hidden');
        stopBtn.classList.add('hidden');
        pauseBtn.classList.add('hidden');
        
        document.getElementById('status-dot').className = 'status-dot offline';
        document.getElementById('status-text').textContent = 'Offline';
    }
}

// Update passenger count
document.getElementById('passenger-count-input')?.addEventListener('change', async (e) => {
    try {
        const response = await fetch(`${API_BASE}/buses.php?action=update_passengers`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
            },
            body: JSON.stringify({
                bus_id: currentBusId,
                current_passengers: parseInt(e.target.value)
            })
        });
        
        const data = await response.json();
        if (data.success) {
            document.getElementById('passenger-count').textContent = e.target.value;
        }
    } catch (error) {
        console.error('Error updating passenger count:', error);
    }
});

// Logout
function logout() {
    if (confirm('Logout?')) {
        stopAutoGPS();
        localStorage.clear();
        window.location.href = 'index.html';
    }
}

// Cleanup on page unload
window.addEventListener('beforeunload', () => {
    stopAutoGPS();
});
