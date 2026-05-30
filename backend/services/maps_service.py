import requests
import os
from dotenv import load_dotenv
load_dotenv()

MAPS_KEY = os.getenv("GOOGLE_MAPS_API_KEY")

def get_nearby_hospitals(lat, lng, radius=5000):
    try:
        url = "https://maps.googleapis.com/maps/api/place/nearbysearch/json"
        params = {
            "location": f"{lat},{lng}",
            "radius": radius,
            "type": "hospital",
            "key": MAPS_KEY
        }
        res = requests.get(url, params=params, timeout=8)
        data = res.json()

        hospitals = []
        for place in data.get("results", [])[:8]:
            hospitals.append({
                "name": place.get("name"),
                "address": place.get("vicinity"),
                "rating": place.get("rating", "N/A"),
                "open_now": place.get("opening_hours", {}).get("open_now", None),
                "lat": place["geometry"]["location"]["lat"],
                "lng": place["geometry"]["location"]["lng"],
                "place_id": place.get("place_id")
            })
        return hospitals
    except Exception as e:
        print(f"Maps error: {e}")
        return []

def get_directions_url(dest_lat, dest_lng, hospital_name=""):
    return f"https://www.google.com/maps/dir/?api=1&destination={dest_lat},{dest_lng}&travelmode=driving"

def geocode_address(address):
    try:
        url = "https://maps.googleapis.com/maps/api/geocode/json"
        params = {"address": address, "key": MAPS_KEY}
        res = requests.get(url, params=params, timeout=8)
        data = res.json()
        if data.get("results"):
            loc = data["results"][0]["geometry"]["location"]
            return loc["lat"], loc["lng"]
        return None, None
    except Exception as e:
        print(f"Geocode error: {e}")
        return None, None