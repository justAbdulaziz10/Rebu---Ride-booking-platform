
var rid = 0;
var currentTripId = null;
var statusCheckInterval = null;

//#region 
function showWaitingScreen() {
    document.getElementById('rider-form').style.display = 'none';
    document.getElementById('login-form').style.display = 'none';
    document.getElementById('waiting-screen').style.display = 'block';
}
function hideWaitingScreen() {
    document.getElementById('rider-input-fields').style.display = 'block';
    document.getElementById('waiting-screen').style.display = 'none';
}

    document.addEventListener('DOMContentLoaded', function() {
        window.addEventListener('beforeunload', function() {
            localStorage.setItem('tabClosed', 'true');
        });
        
        if (localStorage.getItem('tabClosed') === 'true') {
            localStorage.removeItem('userData');
            sessionStorage.removeItem('userData');
            localStorage.removeItem('tabClosed');
        }
        
        var map = L.map('map').setView([24.7229, 46.6198], 16);

        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
            maxZoom: 19
        }).addTo(map);

        // default marker pin
        var marker = L.marker([24.7229, 46.6198], {
            draggable: true
        }).addTo(map);

        // func called whenever the markers needs updating
        function updateCoordinates(latlng) {
            document.getElementById('coordinates').textContent =
                `Latitude: ${latlng.lat.toFixed(4)}, Longitude: ${latlng.lng.toFixed(4)}`;
        }

        // funcs for pick up drop off update values
        function updatePick() {
            const latlng = marker.getLatLng();
            document.getElementById('Pick').value = 
                `${latlng.lat.toFixed(4)},${latlng.lng.toFixed(4)}`;
        }

        function updateDrop() {
            const latlng = marker.getLatLng();
            document.getElementById('Drop').value = 
                `${latlng.lat.toFixed(4)},${latlng.lng.toFixed(4)}`;
        }

        if (document.getElementById('Slecet-pick')) {
            document.getElementById('Slecet-pick').addEventListener('click', updatePick);
        }
        
        if (document.getElementById('Slecet-drop')) {
            document.getElementById('Slecet-drop').addEventListener('click', updateDrop);
        }

        updateCoordinates(marker.getLatLng());

        marker.on('dragend', function(event) {
            updateCoordinates(marker.getLatLng());
        });

        map.on('click', function(event) {
            marker.setLatLng(event.latlng);
            updateCoordinates(event.latlng);
        });

//#endregion

function checkLoginStatus() {
    const userData = localStorage.getItem('userData');
    
    if (userData) {
        if (document.getElementById('login-form')) {
            document.getElementById('login-form').style.display = 'none';
        }
        
        if (document.getElementById('rider-form')) {
            document.getElementById('rider-form').style.display = 'block';
        }
        
        try {
            const user = JSON.parse(userData);
            
            if (document.getElementById('ID') && user.id) {
                document.getElementById('ID').value = user.id;
            }
            
            if (document.getElementById('name') && user.name) {
                document.getElementById('name').value = user.name;
            }
            
            if (document.getElementById('email') && user.email) {
                document.getElementById('email').value = user.email;
            }
            
            if (document.getElementById('rid') && user.id) {
                document.getElementById('rid').textContent = `RID = ${user.id}`;
            }
        } catch (e) {
            console.error('Error parsing user data:', e);
            localStorage.removeItem('userData');
        }
    } else {
        // no user data, ensure login form is shown
        if (document.getElementById('login-form')) {
            document.getElementById('login-form').style.display = 'flex';
        }
        
        if (document.getElementById('rider-form')) {
            document.getElementById('rider-form').style.display = 'none';
        }
    }
}

checkLoginStatus();

// login listener
if (document.getElementById('login-btn')) {
    document.getElementById('login-btn').addEventListener('click', function() {
        const email = document.getElementById('login-email') ? document.getElementById('login-email').value : '';
        const password = document.getElementById('login-password') ? document.getElementById('login-password').value : '';
        
        if (!email || !password) {
            alert('Please enter both email and password');
            return;
        }
        
        fetch('http://127.0.0.1:5000/riders/login', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                email: email,
                password: password
            })
        })
        .then(response => {
            if (!response.ok) {
                document.getElementById('login-alert').style.display = 'block';
                throw new Error('Login failed');
            }
            return response.json();
        })
        .then(data => {
            if (data.success) {
                localStorage.setItem('userData', JSON.stringify(data.user));
                
                if (document.getElementById('login-form')) {
                    document.getElementById('login-form').style.display = 'none';
                }
                
                if (document.getElementById('rider-form')) {
                    document.getElementById('rider-form').style.display = 'block';
                }

                rid = data.user.rid
                document.getElementById('rid').textContent = `RID = ${data.user.rid}`;
            
            } else {
                alert('Invalid email or password');
            }
        })
        .catch(error => {
            console.error('Error:', error);
            
        });
    });
}

if (document.getElementById('submit')) {
    document.getElementById('submit').addEventListener('click', function() {
        const RiderData = {
            rid: rid,
            pickup: document.getElementById('Pick') ? document.getElementById('Pick').value : '',
            dropoff: document.getElementById('Drop') ? document.getElementById('Drop').value : '',
            vehicleType: selectedVehicleType = document.querySelector('input[name="vehicleType"]:checked').value
        };
        
        if (!RiderData.pickup || !RiderData.dropoff) {
            alert('Please select both pickup and dropoff locations');
            return;
        }
    
        console.log('Rider data:', RiderData);
    
        fetch('http://127.0.0.1:5000/riders/post', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(RiderData)
        })
        .then(response => {
            if (!response.ok) {
                throw new Error('Network response was not ok: ' + response.statusText);
            }
            return response.json();
        })
        .then(data => {
            console.log('Success:', data);
            
            currentTripId = data.tripId;
            console.log(currentTripId);


            document.getElementById('trip-price').textContent = data.price.toFixed(2);


            if (document.querySelector('input[name="vehicleType"]:checked').value == 1) {

                document.getElementById('car-type').textContent = "Economy";

            } else if (document.querySelector('input[name="vehicleType"]:checked').value == 2) {

                document.getElementById('car-type').textContent = "Premium";

            } else {

                document.getElementById('car-type').textContent = "Family";

            }
            document.getElementById('car-fee').textContent = data.VehicleCharge.toFixed(2);

            if(data.SurgeCharge > 0){
                document.getElementById('SurgeArea-fee').textContent = data.SurgeCharge.toFixed(2);
                document.getElementById('invoice-row-SurgeArea').style.display = 'flex';
            }

            document.getElementById('total-price').textContent = (parseFloat(data.price) + parseFloat(data.VehicleCharge) + 5 +(data.SurgeCharge > 0 ? parseFloat(data.SurgeCharge) : 0)).toFixed(2);

            
            showWaitingScreen();

            statusCheckInterval = setInterval(checkTripStatus, 1000);

        })
        .catch(error => {
            console.error('Error:', error);
        });
    });
}



function checkTripStatus() {
    if (!currentTripId) return;
    
    fetch(`http://127.0.0.1:5000/trips/status/${currentTripId}`)
    .then(response => response.json())
        .then(data => {
            if (data.success) {
                document.getElementById('trip-status').textContent = data.status;
                
                if (data.status === 'in progress') {
                    clearInterval(statusCheckInterval);
                    document.getElementById('waiting-screen').style.display = 'none';
                    document.getElementById('invoice-screen').style.display = 'block';
                    
                }else{
                    console.log('no drivers available, please stand by !');
                }
            } else {
                console.error('Error fetching trip status:', data.message);
            }
        })
        .catch(error => {
            console.error('Error checking trip status:', error);
        });
}


if (document.getElementById('finish-trip')) {
    document.getElementById('finish-trip').addEventListener('click', function() {

        if (!currentTripId) {
            return;
        }
        
        fetch('http://127.0.0.1:5000/rider/completetrip', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                tid: currentTripId
            })
        })
        .then(response => {
            if (!response.ok) {
            }
            return response.json();
        })
        .then(data => {
            console.log('Trip completed successfully:', data);
            
            currentTripId = null;
            clearInterval(statusCheckInterval);
            
            document.getElementById('invoice-screen').style.display = 'none';
            document.getElementById('rider-form').style.display = 'block';
            
            document.getElementById('Pick').value = '';
            document.getElementById('Drop').value = '';
            
            alert('Trip completed successfully! Thank you for using REBU.');

        })
        .catch(error => {
        });
    });
}



// logout 
if (document.getElementById('logout-btn')) {
    document.getElementById('logout-btn').addEventListener('click', function() {

        localStorage.removeItem('userData');
        sessionStorage.removeItem('userData');
        document.getElementById('Pick').value = '';
        document.getElementById('Drop').value = '';
        document.getElementById('rid').textContent = 'RID = null';
        document.getElementById('login-email').value = '';
        document.getElementById('login-password').value = '';
        document.getElementById('rider-form').style.display = 'none';
        document.getElementById('login-form').style.display = 'flex';

        marker.setLatLng([24.7229, 46.6198]);
        map.setView([24.7229, 46.6198], 16);
        updateCoordinates(marker.getLatLng());    
        console.log('User logged out');  
        return false;
    });
}
});