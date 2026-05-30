import math
from datetime import datetime, timedelta

def calculate_distance(lat1, lon1, lat2, lon2):
    R = 6371
    lat1, lon1, lat2, lon2 = map(math.radians, [lat1, lon1, lat2, lon2])
    dlat = lat2 - lat1
    dlon = lon2 - lon1
    a = math.sin(dlat/2)**2 + math.cos(lat1)*math.cos(lat2)*math.sin(dlon/2)**2
    return round(R * 2 * math.asin(math.sqrt(a)), 1)

def is_eligible_donor(user):
    decl = user.get("health_declaration", {})
    conditions = ["hiv","hepatitis","diabetes","heart_disease",
                  "cancer","malaria_recent","tattoo_recent","pregnant"]
    if any(decl.get(c) for c in conditions):
        return False
    if user.get("cooldown_active"):
        return False
    if not user.get("available_to_donate", False):
        return False
    return True

def priority_score(urgency):
    return {"critical": 100, "urgent": 50, "normal": 10}.get(urgency, 10)