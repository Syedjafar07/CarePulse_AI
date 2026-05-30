from flask import Blueprint, request, jsonify
from models.db import users_collection
from datetime import datetime, timedelta
from bson import ObjectId
import bcrypt, jwt, os

auth_bp = Blueprint("auth", __name__)
SECRET = os.getenv("JWT_SECRET_KEY", "carepulse_secret_2026")

def token_required(f):
    from functools import wraps
    @wraps(f)
    def decorated(*args, **kwargs):
        token = request.headers.get("Authorization", "").replace("Bearer ", "")
        if not token:
            return jsonify({"error": "Token missing"}), 401
        try:
            data = jwt.decode(token, SECRET, algorithms=["HS256"])
            current_user = users_collection.find_one({"_id": ObjectId(data["user_id"])})
            if not current_user:
                return jsonify({"error": "User not found"}), 401
        except:
            return jsonify({"error": "Invalid token"}), 401
        return f(current_user, *args, **kwargs)
    return decorated

@auth_bp.route("/register", methods=["POST"])
def register():
    try:
        data = request.json
        if users_collection.find_one({"email": data["email"]}):
            return jsonify({"error": "Email already registered"}), 400

        decl = data.get("health_declaration", {})
        conditions = ["hiv","hepatitis","diabetes","heart_disease",
                      "cancer","malaria_recent","tattoo_recent","pregnant"]
        is_eligible = not any(decl.get(c) for c in conditions)

        hashed = bcrypt.hashpw(data["password"].encode(), bcrypt.gensalt())

        user = {
            "name": data["name"],
            "email": data["email"],
            "password": hashed,
            "phone": data["phone"],
            "blood_group": data["blood_group"],
            "age": int(data.get("age", 18)),
            "gender": data.get("gender", ""),
            "locations": data.get("locations", []),
            "health_declaration": decl,
            "health_eligible": is_eligible,
            "available_to_donate": is_eligible,
            "cooldown_active": False,
            "last_donation_date": None,
            "next_eligible_date": None,
            "total_donations": 0,
            "lives_saved": 0,
            "profile_photo": data.get("profile_photo", None),
            "verified_donor": False,
            "verification_status": "not_uploaded",
            "created_at": datetime.utcnow()
        }

        result = users_collection.insert_one(user)
        token = jwt.encode({"user_id": str(result.inserted_id)}, SECRET, algorithm="HS256")

        return jsonify({
            "message": "Registration successful!",
            "token": token,
            "user": {
                "id": str(result.inserted_id),
                "name": user["name"],
                "blood_group": user["blood_group"],
                "health_eligible": is_eligible
            }
        }), 201

    except Exception as e:
        return jsonify({"error": str(e)}), 500

@auth_bp.route("/login", methods=["POST"])
def login():
    try:
        data = request.json
        email    = data.get("email", "").strip() if data.get("email") else ""
        phone    = data.get("phone", "").strip() if data.get("phone") else ""
        password = data.get("password", "")

        if not password:
            return jsonify({"error": "Password is required"}), 400

        # Find by email OR phone
        user = None
        if email:
            user = users_collection.find_one({"email": email})
        if not user and phone:
            user = users_collection.find_one({"phone": phone})

        if not user:
            return jsonify({"error": "Account not found. Please register first."}), 404

        if not bcrypt.checkpw(password.encode(), user["password"]):
            return jsonify({"error": "Incorrect password"}), 401

        token = jwt.encode({"user_id": str(user["_id"])}, SECRET, algorithm="HS256")
        return jsonify({
            "message": "Login successful!",
            "token": token,
            "user": {
                "id": str(user["_id"]),
                "name": user["name"],
                "blood_group": user["blood_group"],
                "available_to_donate": user.get("available_to_donate", False),
                "health_eligible": user.get("health_eligible", True),
                "total_donations": user.get("total_donations", 0)
            }
        }), 200

    except Exception as e:
        return jsonify({"error": str(e)}), 500

@auth_bp.route("/profile", methods=["GET"])
@token_required
def get_profile(current_user):
    user = dict(current_user)
    user["_id"] = str(user["_id"])
    user.pop("password", None)
    return jsonify(user), 200

@auth_bp.route("/toggle-donate", methods=["POST"])
@token_required
def toggle_donate(current_user):
    if not current_user.get("health_eligible"):
        return jsonify({"error": "Not eligible to donate"}), 400
    if current_user.get("cooldown_active"):
        return jsonify({"error": "Cooldown active"}), 400
    new_status = not current_user.get("available_to_donate", False)
    users_collection.update_one(
        {"_id": current_user["_id"]},
        {"$set": {"available_to_donate": new_status}}
    )
    return jsonify({"available_to_donate": new_status}), 200
@auth_bp.route("/donors", methods=["GET"])
@token_required
def get_donors(current_user):
    try:
        donors = list(users_collection.find({
            "available_to_donate": True,
            "health_eligible": True,
            "cooldown_active": False
        }, {"name":1, "blood_group":1, "locations":1}))
        for d in donors:
            d["_id"] = str(d["_id"])
            d["distance_km"] = "nearby"
        return jsonify(donors), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500
    
import base64
from datetime import datetime

@auth_bp.route("/upload-document", methods=["POST"])
@token_required
def upload_document(current_user):
    try:
        import google.generativeai as genai
        import os, json, re as re2

        data = request.json
        doc_data = data.get("document")
        doc_name = data.get("filename", "doc")
        doc_type = data.get("doc_type", "fitness_certificate")
        mime_type = data.get("mime_type", "image/jpeg")

        if not doc_data:
            return jsonify({"error": "No document provided"}), 400

        users_collection.update_one(
            {"_id": current_user["_id"]},
            {"$set": {
                "verification_document": {
                    "filename": doc_name,
                    "doc_type": doc_type,
                    "uploaded_at": datetime.utcnow(),
                    "status": "pending",
                    "has_seal": False,
                    "verified_by": "gemini-ai"
                },
                "verification_status": "pending"
            }}
        )

        try:
            genai.configure(api_key=os.environ.get("GEMINI_API_KEY"))
            model = genai.GenerativeModel("gemini-2.5-flash")
            if "pdf" in mime_type or doc_name.lower().endswith(".pdf"):
                part = {"inline_data": {"mime_type": "application/pdf", "data": doc_data}}
            else:
                part = {"inline_data": {"mime_type": mime_type, "data": doc_data}}
            prompt =prompt = """You are a strict medical document verification AI for a blood donation platform.
Analyze this document image carefully and respond ONLY with valid JSON, nothing else:
{"is_medical_document": true/false, "has_doctor_signature": true/false, "has_hospital_seal": true/false, "verdict": "verified" or "rejected", "reason": "one sentence explanation"}

STRICT RULES:
- verdict = "verified" ONLY IF: document has a visible hospital/clinic name AND a doctor name or signature AND looks like a fitness/medical certificate
- verdict = "rejected" IF: it is a selfie, screenshot, random photo, ID card, Aadhar, PAN, marksheet, or any non-medical document
- verdict = "rejected" IF: there is no visible hospital seal or letterhead
- Do not verify screenshots of documents or photos of walls/objects
- Be strict. Only genuine hospital fitness certificates should pass."""
            response = model.generate_content([prompt, part])
            result_text = response.text.strip()
            json_match = re2.search(r'\{.*\}', result_text, re2.DOTALL)
            ai_result = json.loads(json_match.group()) if json_match else {"verdict": "verified", "reason": "Document accepted"}
        except Exception as ai_err:
            print(f"AI verification error: {ai_err}")
            ai_result = {"verdict": "rejected", "reason": "AI could not analyze document. Please upload a clear hospital fitness certificate."}

        is_verified = ai_result.get("verdict", "").lower() == "verified"

        if is_verified:
            users_collection.update_one(
                {"_id": current_user["_id"]},
                {"$set": {
                    "verification_document.status": "verified",
                    "verification_document.has_seal": True,
                    "verification_status": "verified",
                    "verified_donor": True
                }}
            )
            return jsonify({
                "message": "Document verified by AI! You are now a Verified Donor.",
                "status": "verified",
                "verified": True,
                "ai_reason": ai_result.get("reason", "")
            }), 200
        else:
            users_collection.update_one(
                {"_id": current_user["_id"]},
                {"$set": {
                    "verification_document.status": "rejected",
                    "verification_status": "not_uploaded"
                }}
            )
            return jsonify({
                "message": f"Document rejected: {ai_result.get('reason', 'Not a valid certificate')}. Please upload a hospital document.",
                "status": "rejected",
                "verified": False
            }), 200

    except Exception as e:
        return jsonify({"error": str(e)}), 500

@auth_bp.route("/verification-status", methods=["GET"])
@token_required
def verification_status(current_user):
    doc = current_user.get("verification_document", {})
    return jsonify({
        "verification_status": current_user.get("verification_status", "not_uploaded"),
        "verified_donor": current_user.get("verified_donor", False),
        "document": {
            "filename": doc.get("filename", ""),
            "status": doc.get("status", "not_uploaded"),
            "has_seal": doc.get("has_seal", False),
            "uploaded_at": str(doc.get("uploaded_at", ""))
        }
    }), 200