from flask import Flask, jsonify, request # pip install flask
from sqlalchemy import create_engine, text # pip install sqlalchemy
import json,uuid,time
from flask_cors import CORS, cross_origin # pip install flask-cors

app = Flask(__name__)
CORS(app)

DATABASE_URL = "postgresql://postgres:aa@localhost:5432/rebu"
app.config["SQLALCHEMY_DATABASE_URI"] = DATABASE_URL
app.config["SQLALCHEMY_TRACK_MODIFICATIONS"] = False
engine = create_engine(DATABASE_URL)

def generate_trip_id():
    uuid_int = int(uuid.uuid4().hex, 16) % 10000
    return f"{uuid_int:04d}"

def calculate_price(distance_km, vehicle_type_id, pickup_lat, pickup_lng, connection):
    base_rate = 2.5  # 2.5 per km
    
    vtype_sql = text("""
        SELECT multiplier
        FROM vehicletype
        WHERE id = :vid
    """)
    vtype_result = connection.execute(vtype_sql, {"vid": int(vehicle_type_id)})
    vtype_data = vtype_result.fetchone()
    
    vehicle_multiplier_decimal = float(vtype_data.multiplier)
    
    surge_sql = text("""
        SELECT multiplier
        FROM surgearea
        WHERE zone @> point(:pickup_lat, :pickup_lng)
        LIMIT 1
    """)

    surge_result = connection.execute(surge_sql, {
        "pickup_lat": float(pickup_lat),
        "pickup_lng": float(pickup_lng)
    })
    surge_data = surge_result.fetchone()
    surge_multiplier_decimal = float(surge_data.multiplier) if surge_data else 0
    

    initial = distance_km * base_rate
    vehicle_charge = initial * vehicle_multiplier_decimal
    surge_charge = initial * surge_multiplier_decimal
    total = initial + vehicle_charge + surge_charge
    
    return {
        "base_fare": initial,
        "vehicle_multiplier": vehicle_charge,
        "surge_multiplier": surge_charge,
        "final_price": total
    }


def calculate_distance(pickup_lat, pickup_lng, dropoff_lat, dropoff_lng, connection):
    distance_sql = text("""
        SELECT ST_Distance(
            ST_SetSRID(ST_MakePoint(:pickup_lat, :pickup_lng), 4326)::geography,
            ST_SetSRID(ST_MakePoint(:dropoff_lat, :dropoff_lng), 4326)::geography
        ) / 1000 AS distance_km
    """)
    
    distance_result = connection.execute(distance_sql, {
        "pickup_lat": float(pickup_lat),
        "pickup_lng": float(pickup_lng),
        "dropoff_lat": float(dropoff_lat),
        "dropoff_lng": float(dropoff_lng)
    })
    
    distance_data = distance_result.fetchone()
    return float(distance_data.distance_km)



@app.route('/riders/post', methods={'POST'})  
def post_rider():

    data = request.get_json()
    print(data)
    print(data["vehicleType"])
    
    with engine.connect() as connection:

        pickup_lat, pickup_lng = data["pickup"].split(',')
        dropoff_lat, dropoff_lng = data["dropoff"].split(',')
        
        distance_km = calculate_distance(
            float(pickup_lat), float(pickup_lng), 
            float(dropoff_lat), float(dropoff_lng),
            connection
        )
        

        averagespeed = 40  # km/h
        hours = distance_km / averagespeed
        total_seconds = round(hours * 3600)
        hours_part = total_seconds // 3600
        minutes_part = (total_seconds % 3600) // 60
        seconds_part = total_seconds % 60
        eta_text = f"{hours_part}h {minutes_part}m {seconds_part}s"


        averagespeed = 40  # km/h
        hours = distance_km / averagespeed
        minutes = int(hours * 60)
        total_minutes = minutes

        price_data = calculate_price(
            distance_km, 
            data["vehicleType"], 
            float(pickup_lat), 
            float(pickup_lng),
            connection
        )
        
        tid = generate_trip_id()
        
        sql = text("""
            INSERT INTO trip (
                tid, tripsstatus, distance, price, rid, pickup, dropoff, did, 
                starttime, endtime, routetaken, rideduration, vid
            ) VALUES (
                :tid, 'pending', :distance, :price, :rid, 
                POINT(:pickup_lat, :pickup_lng), POINT(:dropoff_lat, :dropoff_lng), 
                null, now(), now() + interval ':minutes minutes', 'direct', interval ':minutes minutes', :vid
            )
        """)
        
        result = connection.execute(sql, {
            "tid": tid, 
            "rid": data["rid"], 
            "pickup_lat": float(pickup_lat), 
            "pickup_lng": float(pickup_lng),
            "dropoff_lat": float(dropoff_lat), 
            "dropoff_lng": float(dropoff_lng),
            "vid": int(data["vehicleType"]),
            "distance": distance_km,
            "price": price_data["final_price"],
            "minutes": total_minutes
        })
        
        connection.commit()
        
        # Verify the trip record was created
        verify_sql = text("SELECT * FROM trip WHERE tid = :tid")
        verify_result = connection.execute(verify_sql, {"tid": tid})
        trip_record = verify_result.fetchone()

        if trip_record:
            print(f"Successfully inserted trip with ID: {tid}")
            print(f"Trip details: {trip_record}")

    
    return jsonify({
        "message": "Rider data received successfully",
        "tripId": tid,
        "price": price_data["base_fare"],
        "VehicleCharge":price_data["vehicle_multiplier"],
        "SurgeCharge":price_data["surge_multiplier"],
        "Total":price_data["final_price"],
        "estimated_minutes": eta_text,
    }), 200


#this endpoint will keep getting ping'ed untill it returns the same trip record but with  tripsstatus as 'in progress'

@app.route('/trips/status/<tid>', methods=['GET'])
def get_trip_status(tid):
    try:
        with engine.connect() as connection:
            # query to get the current trip status
            sql = text("SELECT tripsstatus, did FROM trip WHERE tid = :tid")
            result = connection.execute(sql, {"tid": tid})
            trip_data = result.fetchone()
            
            if trip_data:
                return jsonify({
                    "status": trip_data.tripsstatus,
                    "did": trip_data.did,
                    "success": True
                }), 200
            else:
                return jsonify({
                    "message": "Trip not found",
                    "success": False
                }), 404
    
    except Exception as e:
        print(f"Error fetching trip status: {str(e)}")
        return jsonify({
            "message": "Server error while fetching trip status",
            "success": False
        }), 500


@app.route('/riders/login', methods=['POST'])
def login_rider():
    data = request.get_json()
    
    if not data:
        return jsonify({
            "message": "No data provided",
            "success": False
        }), 400


    email = data.get('email')
    password = data.get('password')
    
    
    try:
        with engine.connect() as connection:
            sql = text("SELECT * FROM rider WHERE email = :email AND password = :password")
            result = connection.execute(sql, {"email": email, "password": password})
            user = result.fetchone()
            
            if user:
                print(user)
                print(user.rid)
                user_data = {
                    "rid": user.rid,  
                }
                
                return jsonify({
                    "message": "Login successful",
                    "success": True,
                    "user": user_data
                }), 200
            
            else:
                return jsonify({
                    "message": "Invalid email or password",
                    "success": False
                }), 401
    
    except Exception as e:
        print(f"Login error: {str(e)}")
        return jsonify({
            "message": "Server error during login",
            "success": False
        }), 500




@app.route('/rider/completetrip', methods=['POST'])
def complete_trip():
    data = request.get_json()
    tid = data.get('tid')
    print(data)

    with engine.connect() as connection:
        sql = text("UPDATE trip SET tripsstatus = 'completed' WHERE tid = :tid ")
        result = connection.execute(sql, {"tid": tid})
        
        connection.commit()
    
    return jsonify({
                    "message": "Trip completed successfully",
                    "success": True,
                    "tid": tid
                }), 200


############################################################################## Driver Endpoints ##########################################################################################################################################################################

@app.route('/drivers/logindriver', methods=['POST'])
def login_driver():
    data = request.get_json()
    
    if not data:
        return jsonify({
            "message": "No data provided",
            "success": False
        }), 400


    email = data.get('email')
    password = data.get('password')
    
    
    try:
        with engine.connect() as connection:
            sql = text("SELECT * FROM driver WHERE email = :email AND password = :password")
            result = connection.execute(sql, {"email": email, "password": password})
            user = result.fetchone()
            
            if user:
                print(user)
                print(user.did)
                user_data = {
                    "did": user.did,  
                }
                
                return jsonify({
                    "message": "Login successful",
                    "success": True,
                    "user": user_data
                }), 200
            
            else:
                return jsonify({
                    "message": "Invalid email or password",
                    "success": False
                }), 401
    
    except Exception as e:
        print(f"Login error: {str(e)}")
        return jsonify({
            "message": "Server error during login",
            "success": False
        }), 500
    

@app.route('/drivers/postdriver', methods=['POST'])  
def post_driver():
    data = request.get_json()

    dlocation_lat, dlocation_lng = data["pickup"].split(',')
    
    with engine.connect() as connection:
        sql = text("UPDATE driver SET dlocation = POINT(:dlocation_lat, :dlocation_lng) WHERE did = :did")
        
        connection.execute(sql, {
            "did": data['did'],
            "dlocation_lat": float(dlocation_lat),
            "dlocation_lng": float(dlocation_lng)
        })
        connection.commit()

        #find trips within 5km
        find_trips_sql = text("""
                        SELECT 
                            trip.tid AS tid,
                            trip.rid AS rid,
                            ST_Distance(
                                ST_SetSRID(ST_MakePoint(trip.pickup[0], trip.pickup[1]), 4326)::geography,
                                ST_SetSRID(ST_MakePoint((SELECT dlocation[0] FROM driver WHERE did = :did), 
                                                    (SELECT dlocation[1] FROM driver WHERE did = :did)), 4326)::geography
                            ) / 1000 AS distance_km
                        FROM trip
                        WHERE trip.tripsstatus = 'pending'
                        AND trip.did IS NULL
                        AND ST_Distance(
                            ST_SetSRID(ST_MakePoint(trip.pickup[0], trip.pickup[1]), 4326)::geography,
                            ST_SetSRID(ST_MakePoint((SELECT dlocation[0] FROM driver WHERE did = :did), 
                                                (SELECT dlocation[1] FROM driver WHERE did = :did)), 4326)::geography
                        ) / 1000 <= 5
                        ORDER BY distance_km;
                    """)
        
        result = connection.execute(find_trips_sql, {"did": data['did']})
        trips = result.fetchall()
        
        riders_data = []
        
        for trip in trips:
            rider_result = connection.execute(
                text("SELECT name, phone FROM rider WHERE rid = :rid"), 
                {"rid": trip.rid}
            )
            rider_info = rider_result.fetchone()
            
            if rider_info:
                riders_data.append({
                    "tid": trip.tid,
                    "rid": trip.rid,
                    "name": rider_info.name,
                    "phone": rider_info.phone,
                    "distance_km": float(trip.distance_km)
                })

    return jsonify({
        "message": "Submission Success",
        "success": True,
        "did": data['did'],
        "riders": riders_data,
        "count": len(riders_data)
    }), 200



@app.route('/drivers/update-tid', methods=['POST'])
def update_trip_status():
    data = request.get_json()
    tid = data.get('tid')
    did = data.get('did')
    print(data)
    
    with engine.connect() as connection:
        
        # Start transaction with serializable isolation level
        connection.execution_options(isolation_level='SERIALIZABLE')
        trans = connection.begin()
        
        try:
            # lock trip record : SELECT FOR UPDATE
            # stops other transactions from updating and using the rest of the method or endpoint
            lock_trip = text("SELECT * FROM trip WHERE tid = :tid FOR UPDATE")
            trip_check = connection.execute(lock_trip, {"tid": tid}).fetchone()
            
            #check if trip is already picked up
            if trip_check and trip_check.tripsstatus == 'pending' and trip_check.did is None:
                                
                # the rest of method normally
                trip_sql = text("""
                    UPDATE trip 
                    SET tripsstatus = :status, did = :did 
                    WHERE tid = :tid
                """)
                
                connection.execute(trip_sql, {
                    "tid": tid,
                    "did": did,
                    "status": 'in progress'
                })
                
                driver_sql = text("""
                    UPDATE driver
                    SET status = 'busy'
                    WHERE did = :did
                """)
                
                connection.execute(driver_sql, {
                    "did": did
                })
                
                # update driverrespond
                respond_sql = text("""
                    INSERT INTO driverrespond (did, tid, respond)
                    VALUES (:did, :tid, 'accepted')
                    ON CONFLICT (did, tid) DO UPDATE 
                    SET respond = 'accepted'
                """)
                
                connection.execute(respond_sql, {
                    "did": did,
                    "tid": tid
                })


                trip_price = text("""
                    SELECT * FROM trip
                    WHERE tid = :tid
                """)

                result = connection.execute(trip_price, {"tid": tid})
                
                trip_data = result.fetchone()

                pickup_lat, pickup_lng = trip_data.pickup.split(',')
                dropoff_lat, dropoff_lng = trip_data.dropoff.split(',')
                print(pickup_lat.replace("(", "").replace(")", ""))


                distance = calculate_distance(float(pickup_lat.replace("(", "").replace(")", "")), float(pickup_lng.replace("(", "").replace(")", "")), float(dropoff_lat.replace("(", "").replace(")", "")), float(dropoff_lng.replace("(", "").replace(")", "")),connection)

                price = calculate_price(distance, trip_data.vid, float(pickup_lat.replace("(", "").replace(")", "")), float(pickup_lng.replace("(", "").replace(")", "")), connection)
                
                # commit transaction
                trans.commit()
                
                return jsonify({
                    "message": "Trip assigned and status updated to 'in progress'",
                    "success": True,
                    "tid": tid,
                    "vid": trip_data.vid,
                    "did": did,
                    "price" : {
                        "price": price["base_fare"],
                        "VehicleCharge":price["vehicle_multiplier"],
                        "SurgeCharge":price["surge_multiplier"],
                        "Total":price["final_price"],
                    }
                }), 200
            else:
                # roll back if conflict arises
                trans.rollback()
                return jsonify({
                    "message": "Trip is already assigned to a driver or not in pending status",
                    "success": False
                }), 409
                
        except Exception as e:
            # roll back if conflict arises
            trans.rollback()
            return jsonify({
                "message": f"Error processing request: {str(e)}",
                "success": False
            }), 500
                    

    
@app.route('/driver/completetrip', methods=['POST'])
def driver_complete_trip():
    data = request.get_json()
    tid = data.get('tid')
    did = data.get('did')
    
    with engine.connect() as connection:  
        driver_sql = text("UPDATE driver SET status = 'online' WHERE did = :did")
        connection.execute(driver_sql, {"did": did})
        
        connection.commit()
    
    return jsonify({
        "message": "Trip completed successfully",
        "success": True,
        "tid": tid
    }), 200
    




if __name__ == '__main__':
    app.run(debug=True)

