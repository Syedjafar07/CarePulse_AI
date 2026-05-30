from flask import Blueprint, request, jsonify
from services.gemini_service import get_ai_response
from routes.auth import token_required
import requests as req_lib
import os

ai_bp = Blueprint("ai", __name__)

@ai_bp.route("/chat", methods=["POST"])
@token_required
def chat(current_user):
    try:
        data = request.json
        user_message = data.get("message", "")
        chat_history = data.get("history", [])
        if not user_message:
            return jsonify({"error": "Message required"}), 400
        response = get_ai_response(user_message, chat_history)
        return jsonify({"response": response}), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@ai_bp.route("/hospitals", methods=["GET"])
@token_required
def get_hospitals(current_user):
    try:
        lat = request.args.get("lat")
        lng = request.args.get("lng")
        api_key = os.getenv("GOOGLE_MAPS_API_KEY")
        url = (f"https://maps.googleapis.com/maps/api/place/nearbysearch/json"
               f"?location={lat},{lng}&radius=5000&type=hospital&key={api_key}")
        response = req_lib.get(url)
        data = response.json()
        hospitals = []
        for place in data.get("results", [])[:8]:
            hospitals.append({
                "name": place["name"],
                "address": place.get("vicinity", ""),
                "lat": place["geometry"]["location"]["lat"],
                "lng": place["geometry"]["location"]["lng"],
                "rating": place.get("rating", "N/A"),
                "open_now": place.get("opening_hours", {}).get("open_now"),
                "place_id": place["place_id"]
            })
        return jsonify(hospitals), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500