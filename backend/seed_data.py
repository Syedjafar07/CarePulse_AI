from models.db import users_collection
from datetime import datetime
import bcrypt
import sys, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from dotenv import load_dotenv
load_dotenv()

def seed_demo_users():
    users_collection.delete_many({"is_demo": True})
    
    demo_users = [
        {
            "name": "Syed Jafar",
            "email": "syedjafar974@gmail.com",
            "password": bcrypt.hashpw("Zayn@7619".encode(), bcrypt.gensalt()),
            "phone": "+917619222905",
            "blood_group": "O+",
            "gender": "male",
            "available_to_donate": True,
            "cooldown_active": False,
            "health_eligible": True,
            "locations": [
                {"label": "College", "lat": 15.3647, "lng": 75.1240},
                {"label": "Home", "lat": 15.3700, "lng": 75.1300}
            ],
            "profile_photo": "assets/syed.jpeg",
            "donations_count": 3,
            "lives_helped": 6,
            "is_demo": True,
            "created_at": datetime.utcnow()
        },
        {
            "name": "Bhooshan Moger",
            "email": "bhooshandm@gmail.com",
            "password": bcrypt.hashpw("Bhu@123".encode(), bcrypt.gensalt()),
            "phone": "+917483257593",
            "blood_group": "B+",
            "gender": "male",
            "available_to_donate": True,
            "cooldown_active": False,
            "health_eligible": True,
            "locations": [
                {"label": "College", "lat": 15.3650, "lng": 75.1250}
            ],
            "profile_photo": "assets/bhooshan.jpeg",
            "donations_count": 1,
            "lives_helped": 2,
            "is_demo": True,
            "created_at": datetime.utcnow()
        },
        {
            "name": "Priya Nair",
            "email": "demo3@carepulse.ai",
            "password": bcrypt.hashpw("Demo@123".encode(), bcrypt.gensalt()),
            "phone": "+919071169352",
            "blood_group": "A+",
            "gender": "female",
            "available_to_donate": True,
            "cooldown_active": False,
            "health_eligible": True,
            "locations": [
                {"label": "Home", "lat": 15.3680, "lng": 75.1270}
            ],
            "profile_photo": "assets/priya.jpeg",
            "donations_count": 5,
            "lives_helped": 10,
            "is_demo": True,
            "created_at": datetime.utcnow()
        }
    ]
    
    users_collection.insert_many(demo_users)
    print("✅ Demo users seeded!")

if __name__ == "__main__":
    seed_demo_users()