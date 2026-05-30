from flask import Blueprint, request, jsonify
from models.db import users_collection, requests_collection, donations_collection
from routes.auth import token_required
from datetime import datetime, timedelta
from bson import ObjectId

donor_bp = Blueprint("donor", __name__)

@donor_bp.route("/alerts", methods=["GET"])
@token_required
def get_alerts(current_user):
    try:
        reqs = list(requests_collection.find({
            "matched_donors.donor_id": str(current_user["_id"]),
            "status": "searching"
        }).sort("created_at", -1).limit(10))
        for r in reqs:
            r["_id"] = str(r["_id"])
            r["requester_id"] = str(r["requester_id"])
            r["created_at"] = str(r["created_at"])
        return jsonify(reqs), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@donor_bp.route("/accept/<request_id>", methods=["POST"])
@token_required
def accept_request(current_user, request_id):
    try:
        req = requests_collection.find_one({"_id": ObjectId(request_id)})
        if not req:
            return jsonify({"error": "Request not found"}), 404

        requests_collection.update_one(
            {"_id": ObjectId(request_id),
             "matched_donors.donor_id": str(current_user["_id"])},
            {"$set": {
                "matched_donors.$.status": "accepted",
                "status": "donor_found"
            }}
        )

        return jsonify({
            "message": "Accepted! Navigate to hospital.",
            "hospital_name": req["hospital_name"],
            "hospital_address": req["hospital_address"],
            "hospital_lat": req.get("hospital_lat"),
            "hospital_lng": req.get("hospital_lng"),
            "maps_url": f"https://www.google.com/maps/dir/?api=1&destination={req.get('hospital_lat')},{req.get('hospital_lng')}"
        }), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@donor_bp.route("/decline/<request_id>", methods=["POST"])
@token_required
def decline_request(current_user, request_id):
    try:
        requests_collection.update_one(
            {"_id": ObjectId(request_id),
             "matched_donors.donor_id": str(current_user["_id"])},
            {"$set": {"matched_donors.$.status": "declined"}}
        )
        return jsonify({"message": "Declined"}), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@donor_bp.route("/complete/<request_id>", methods=["POST"])
@token_required
def complete_donation(current_user, request_id):
    try:
        req = requests_collection.find_one({"_id": ObjectId(request_id)})
        now = datetime.utcnow()
        next_eligible = now + timedelta(days=90)

        donations_collection.insert_one({
            "donor_id": current_user["_id"],
            "request_id": ObjectId(request_id),
            "hospital": req["hospital_name"],
            "blood_group": req["blood_group_needed"],
            "date": now
        })

        users_collection.update_one(
            {"_id": current_user["_id"]},
            {"$set": {
                "cooldown_active": True,
                "available_to_donate": False,
                "last_donation_date": now,
                "next_eligible_date": next_eligible,
            },
            "$inc": {"total_donations": 1, "lives_saved": 1}}
        )

        requests_collection.update_one(
            {"_id": ObjectId(request_id)},
            {"$set": {"status": "completed"}}
        )

        return jsonify({
            "message": "Thank you for saving a life! 🙏",
            "next_eligible_date": str(next_eligible.date()),
        }), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500