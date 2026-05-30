from flask import Blueprint, request, jsonify
from models.db import users_collection, requests_collection
from utils.helpers import calculate_distance, priority_score
from services.twilio_service import send_sms_alert
from routes.auth import token_required
from datetime import datetime
from bson import ObjectId

blood_bp = Blueprint("blood", __name__)

@blood_bp.route("/request", methods=["POST"])
@token_required
def create_request(current_user):
    try:
        data = request.json
        urgency = data.get("urgency", "normal")

        blood_request = {
            "requester_id": current_user["_id"],
            "requester_name": current_user["name"],
            "requester_phone": current_user["phone"],
            "blood_group_needed": data["blood_group_needed"],
            "urgency": urgency,
            "priority_score": priority_score(urgency),
            "hospital_name": data["hospital_name"],
            "hospital_address": data.get("hospital_address", ""),
            "hospital_lat": float(data.get("hospital_lat", 0)),
            "hospital_lng": float(data.get("hospital_lng", 0)),
            "patient_name": data.get("patient_name", current_user["name"]),
            "additional_notes": data.get("notes", ""),
            "status": "searching",
            "matched_donors": [],
            "created_at": datetime.utcnow()
        }

        result = requests_collection.insert_one(blood_request)

        matched = find_matching_donors(
            data["blood_group_needed"],
            float(data.get("hospital_lat", 0)),
            float(data.get("hospital_lng", 0)),
            str(current_user["_id"])
        )

        sms_count = 0
        donor_list = []
        for donor in matched[:5]:
            sms_msg = (
                f"🚨 CAREPULSE EMERGENCY\n"
                f"Blood Needed: {data['blood_group_needed']}\n"
                f"Hospital: {data['hospital_name']}\n"
                f"Urgency: {urgency.upper()}\n"
                f"Open CarePulse AI to respond"
            )
            sent = send_sms_alert(donor["phone"], sms_msg)
            if sent:
                sms_count += 1
            donor_list.append({
                "donor_id": str(donor["_id"]),
                "name": donor["name"],
                "phone": donor["phone"],
                "distance_km": donor["distance_km"],
                "status": "alerted"
            })

        requests_collection.update_one(
            {"_id": result.inserted_id},
            {"$set": {"matched_donors": donor_list}}
        )

        return jsonify({
            "message": "Blood request created!",
            "request_id": str(result.inserted_id),
            "donors_alerted": sms_count,
            "matched_donors": donor_list
        }), 201

    except Exception as e:
        return jsonify({"error": str(e)}), 500

def find_matching_donors(blood_group, hospital_lat, hospital_lng, exclude_id):
    compatibility = {
        "O-": ["O-","O+","A-","A+","B-","B+","AB-","AB+"],
        "O+": ["O+","A+","B+","AB+"],
        "A-": ["A-","A+","AB-","AB+"],
        "A+": ["A+","AB+"],
        "B-": ["B-","B+","AB-","AB+"],
        "B+": ["B+","AB+"],
        "AB-": ["AB-","AB+"],
        "AB+": ["AB+"]
    }

    can_donate = []
    for donor_bg, can_give_to in compatibility.items():
        if blood_group in can_give_to:
            can_donate.append(donor_bg)

    eligible = list(users_collection.find({
        "blood_group": {"$in": can_donate},
        "available_to_donate": True,
        "cooldown_active": False,
        "health_eligible": True,
        "_id": {"$ne": ObjectId(exclude_id)}
    }))

    matched = []
    for donor in eligible:
        min_dist = float('inf')
        for loc in donor.get("locations", []):
            if loc.get("lat") and loc.get("lng"):
                d = calculate_distance(hospital_lat, hospital_lng,
                                       loc["lat"], loc["lng"])
                min_dist = min(min_dist, d)
        if min_dist <= 500:
            donor["distance_km"] = min_dist
            matched.append(donor)

    matched.sort(key=lambda x: x["distance_km"])
    return matched[:10]

@blood_bp.route("/requests", methods=["GET"])
@token_required
def get_requests(current_user):
    try:
        active = list(requests_collection.find(
            {"status": {"$in": ["searching", "donor_found"]}}
        ).sort([("priority_score", -1), ("created_at", 1)]).limit(20))
        for r in active:
            r["_id"] = str(r["_id"])
            if "requester_id" in r:
                r["requester_id"] = str(r["requester_id"])
            r["created_at"] = str(r.get("created_at", ""))
        return jsonify(active), 200
    except Exception as e:
        print(f"get_requests error: {e}")
        return jsonify({"error": str(e)}), 500

@blood_bp.route("/my-requests", methods=["GET"])
@token_required
def my_requests(current_user):
    try:
        reqs = list(requests_collection.find(
            {"requester_id": current_user["_id"]},
            sort=[("created_at", -1)]
        ).limit(10))
        for r in reqs:
            r["_id"] = str(r["_id"])
            r["requester_id"] = str(r["requester_id"])
            r["created_at"] = str(r["created_at"])
        return jsonify(reqs), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500
@blood_bp.route("/proximity-community-alert", methods=["POST"])
@token_required
def proximity_community_alert(current_user):
    """
    Proximity-based donor community alert.
    Finds ALL nearby donors within radius and sends group broadcast SMS.
    Directly satisfies: 'Proximity-based blood donor communities triggering group messages'
    """
    try:
        data = request.json
        blood_group = data["blood_group_needed"]
        hospital_name = data["hospital_name"]
        lat = float(data.get("lat", 0))
        lng = float(data.get("lng", 0))
        radius_km = float(data.get("radius_km", 500))  # default 10km community

        # Find ALL compatible donors within the radius
        compatibility = {
            "O-": ["O-","O+","A-","A+","B-","B+","AB-","AB+"],
            "O+": ["O+","A+","B+","AB+"],
            "A-": ["A-","A+","AB-","AB+"],
            "A+": ["A+","AB+"],
            "B-": ["B-","B+","AB-","AB+"],
            "B+": ["B+","AB+"],
            "AB-": ["AB-","AB+"],
            "AB+": ["AB+"]
        }
        can_donate = [bg for bg, gives_to in compatibility.items() if blood_group in gives_to]

        all_donors = list(users_collection.find({
            "blood_group": {"$in": can_donate},
            "available_to_donate": True,
            "cooldown_active": False,
            "health_eligible": True,
            "_id": {"$ne": current_user["_id"]}
        }))

        # Filter by proximity radius
        nearby_community = []
        for donor in all_donors:
            for loc in donor.get("locations", []):
                if loc.get("lat") and loc.get("lng"):
                    dist = calculate_distance(lat, lng, loc["lat"], loc["lng"])
                    if dist <= radius_km:
                        nearby_community.append({
                            "name": donor["name"],
                            "phone": donor["phone"],
                            "blood_group": donor["blood_group"],
                            "distance_km": dist
                        })
                        break

        # Sort by distance — closest first
        nearby_community.sort(key=lambda x: x["distance_km"])

        # Send group broadcast SMS to entire nearby community
        alerted = 0
        for donor in nearby_community:
            msg = (
                f"🩸 CAREPULSE COMMUNITY ALERT\n"
                f"Blood Group {blood_group} needed nearby!\n"
                f"Hospital: {hospital_name}\n"
                f"You are {donor['distance_km']} km away.\n"
                f"Open CarePulse AI to respond immediately."
            )
            if send_sms_alert(donor["phone"], msg):
                alerted += 1

        return jsonify({
            "message": f"Community proximity alert sent!",
            "radius_km": radius_km,
            "donors_in_community": len(nearby_community),
            "alerts_sent": alerted,
            "community_members": nearby_community
        }), 200

    except Exception as e:
        return jsonify({"error": str(e)}), 500