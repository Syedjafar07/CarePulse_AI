from pymongo import MongoClient
from dotenv import load_dotenv
import os

load_dotenv()

client = MongoClient(os.getenv("MONGODB_URI"))
db = client["carepulse"]

users_collection = db["users"]
requests_collection = db["blood_requests"]
donations_collection = db["donations"]

def test_connection():
    try:
        client.admin.command('ping')
        print("✅ MongoDB Connected!")
        return True
    except Exception as e:
        print(f"❌ MongoDB Failed: {e}")
        return False