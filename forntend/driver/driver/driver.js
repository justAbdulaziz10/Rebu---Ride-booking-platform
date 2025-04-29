
var did = 0;
var currentTripId = null;
var statusCheckInterval = null;
var tid=0;
const RiderTids = [];
AvailableRidersCounter = 0;

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
        if (document.getElementById('login-form')) {
            document.getElementById('login-form').style.display = 'flex';
        }
        
        if (document.getElementById('rider-form')) {
            document.getElementById('rider-form').style.display = 'none';
        }
    }
}

checkLoginStatus();

//#endregion


function addRiderCard(name, phone, distance,tid) {
    const card = document.createElement('div');
    card.id = `card-${Date.now()}`;
    card.className = 'rider-card';
    card.style.cssText = `
      border-radius: 10px;
      min-height: 100px;
      background-color: rgb(88, 54, 54);
      position: relative;
      padding-bottom: 4rem;
      margin-bottom: 15px;
    `;
  
    const timeHours = distance / 40;
    const totalSeconds = Math.round(timeHours * 3600);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    let etaText;
    
    if (hours > 0) {
      etaText = `${hours}h ${minutes}m ${seconds}s`;
    } else if (minutes > 0) {
      etaText = `${minutes}m ${seconds}s`;
    } else {
      etaText = `${seconds}s`;
    }
  
    card.innerHTML = `
      <p style="padding-top: 15px; padding-left: 10px; text-align: left;">Rider: <span>${name}</span></p>
      <p style="padding-top: 1px; padding-left: 10px; text-align: left;">Number: <span>${phone}</span></p>
      <p style="padding-top: 1px; padding-left: 10px; text-align: left;">(${distance.toFixed(2)}) KM Away</p>
      <p style="padding-top: 1px; padding-left: 10px; text-align: left;">ETA: <span>${etaText}</span></p>
      <div class="split-button-container">
        <button class="split-button-ac accept-btn">Accept</button>
        <button class="split-button-re reject-btn">Reject</button>
      </div>
    `;
  
    const statusContainer = document.querySelector('.status-container');
    statusContainer.appendChild(card);
    statusContainer.style.overflowY = 'auto';
    
    const acceptBtn = card.querySelector('.accept-btn');
    const rejectBtn = card.querySelector('.reject-btn');
    driverdid = did;
    
    acceptBtn.addEventListener('click', function() {
      document.getElementById('waiting-screen').style.display = 'none';
      document.getElementById('invoice-screen').style.display = 'block';
      clearInterval(statusCheckInterval);

      const tripupdate = {
        tid: tid,
        status: 'in progress',
        did: driverdid
    };

    fetch('http://127.0.0.1:5000/drivers/update-tid', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(tripupdate)
    })

    .then(data => {
        stopPolling();
        console.log('Trip status updated successfully:', data);
        return data;
    })

    });
    
    rejectBtn.addEventListener('click', function() {
      card.remove();
      AvailableRidersCounter -- ;

      if (AvailableRidersCounter > 0) {
        document.getElementById('waiting-message').textContent = 
            `(${AvailableRidersCounter}) Rider${AvailableRidersCounter !== 1 ? 's' : ''} Found!`;
    }else{
        document.getElementById('waiting-message').textContent = 'No Riders Found'
    }

    });
    
    return card;
  }

// login listener
if (document.getElementById('login-btn')) {
    document.getElementById('login-btn').addEventListener('click', function() {
        const email = document.getElementById('login-email') ? document.getElementById('login-email').value : '';
        const password = document.getElementById('login-password') ? document.getElementById('login-password').value : '';
        
        if (!email || !password) {
            alert('Please enter both email and password');
            return;
        }
        
        fetch('http://127.0.0.1:5000/drivers/logindriver', {
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

                did = data.user.did
                document.getElementById('did').textContent = `DID = ${data.user.did}`;
            
            } else {
                alert('Invalid email or password');
            }
        })
        .catch(error => {
            console.error('Error:', error);
            
        });
    });
}


function findNearbyRiders(driverId, pickupLocation) {
    document.getElementById('rider-form').style.display = 'none';
    document.getElementById('waiting-screen').style.display = 'block';
    document.getElementById('cards').style.display = 'none';
    
    const statusContainer = document.querySelector('.status-container');
    if (statusContainer) {
        statusContainer.innerHTML = '';
    }
    
    const driverData = {
        did: driverId,
        pickup: pickupLocation
    };

    fetch('http://127.0.0.1:5000/drivers/postdriver', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(driverData)
    })
    .then(response => {
        if (!response.ok) {
            throw new Error('Failed to fetch riders');
        }
        return response.json();
    })
    .then(data => {        
            data.riders.forEach(rider => {
                flag = true;
                for (let i = 0; i < RiderTids.length; i++) {
                    if(RiderTids[i]==rider.tid){
                        flag = false;
                        break;
                    }
                }

                if(flag){
                    addRiderCard(rider.name, rider.phone, rider.distance_km, rider.tid);
                    AvailableRidersCounter ++ ;
                    console.log(rider.name);
                    RiderTids.push(rider.tid);  
                }
            });

            if (data.riders && AvailableRidersCounter > 0) {
                document.getElementById('waiting-message').textContent = 
                    `(${AvailableRidersCounter}) Rider${AvailableRidersCounter !== 1 ? 's' : ''} Found!`;
            }else{
                document.getElementById('waiting-message').textContent = 'No Riders Found';
            }

            startPolling(driverId, pickupLocation);
    })
    .catch(error => {
        console.error('Error finding riders:', error);
        document.getElementById('waiting-message').textContent = 'Error finding riders';
        
    });
}

if (document.getElementById('submit')) {

    document.getElementById('submit').addEventListener('click', function() {
        const pickupLocation = document.getElementById('Pick') ? 
            document.getElementById('Pick').value : '';
            
        findNearbyRiders(did, pickupLocation);
    });
}


function startPolling(driverId, pickupLocation) {
    if (statusCheckInterval) {
        clearInterval(statusCheckInterval);
    }
    
    lookForRider(driverId, pickupLocation);
    
    statusCheckInterval = setInterval(function() {
        lookForRider(driverId, pickupLocation);
    }, 1000);
}

function stopPolling() {
    if (statusCheckInterval) {
        clearInterval(statusCheckInterval);
        statusCheckInterval = null;
    }
}

function lookForRider(driverId,pickupLocation){
    const driverData = {
            did: driverId,
            pickup: pickupLocation
        };

        fetch('http://127.0.0.1:5000/drivers/postdriver', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(driverData)
        })
        .then(response => {
            if (!response.ok) {
                throw new Error('Failed to fetch riders');
            }
            return response.json();
        })
        .then(data => {        
                data.riders.forEach(rider => {
                    flag = true;
                    for (let i = 0; i < RiderTids.length; i++) {
                        if(RiderTids[i]==rider.tid){
                            flag = false;
                            break;
                        }
                    }

                    if(flag){
                        addRiderCard(rider.name, rider.phone, rider.distance_km, rider.tid);
                        AvailableRidersCounter ++ ;
                        console.log(rider.name);
                        RiderTids.push(rider.tid);  
                    }
                });

                if (data.riders && AvailableRidersCounter > 0) {
                    document.getElementById('waiting-message').textContent = 
                        `(${AvailableRidersCounter}) Rider${AvailableRidersCounter !== 1 ? 's' : ''} Found!`;
                }else{
                    document.getElementById('waiting-message').textContent = 'No Riders Found';
                }

        })
        .catch(error => {
            console.error('Error finding riders:', error);
            document.getElementById('waiting-message').textContent = 'Error finding riders';
            
        });
    }

    if (document.getElementById('finish-trip')) {
        document.getElementById('finish-trip').addEventListener('click', function() {
            fetch('http://127.0.0.1:5000/driver/completetrip', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    tid: tid,
                    did: did
                })
            })
            .then(response => {
                if (!response.ok) {
                    throw new Error('Network response was not ok: ' + response.statusText);
                }
                return response.json();
            })
            .then(data => {
                console.log('Trip completed successfully:', data);
                
                tid = 0;
                AvailableRidersCounter = 0;
                RiderTids.length = 0;
                
                document.getElementById('invoice-screen').style.display = 'none';
                document.getElementById('rider-form').style.display = 'block';
                
                alert('Trip completed successfully! You are now available for new requests.');
            })
            .catch(error => {
                console.error('Error completing trip:', error);
                alert('There was a problem completing the trip. Please try again.');
                
                document.getElementById('invoice-screen').style.display = 'none';
                document.getElementById('rider-form').style.display = 'block';
            });
        });
    }
    

if (document.getElementById('logout-btn')) {
    document.getElementById('logout-btn').addEventListener('click', function() {

        localStorage.removeItem('userData');
        sessionStorage.removeItem('userData');
        document.getElementById('Pick').value = '';
        document.getElementById('did').textContent = 'DID = null';
        document.getElementById('login-email').value = '';
        document.getElementById('login-password').value = '';

        document.getElementById('rider-form').style.display = 'none';
        document.getElementById('login-form').style.display = 'flex';
        document.getElementById('rider-form').style.display = 'none';
        document.getElementById('cards').style.display = 'none';
        document.getElementById('rider-name').textContent  = '';
        document.getElementById('rider-phone').textContent  = '';
        document.getElementById('rider-kms').textContent  = '';

        marker.setLatLng([24.7229, 46.6198]);
        map.setView([24.7229, 46.6198], 16);
        updateCoordinates(marker.getLatLng());    
        console.log('User logged out');  
        return false;
    });
}

})