import os
from pymongo import MongoClient
from dotenv import load_dotenv

load_dotenv()

def get_db():
    try:
        uri = os.getenv("MONGODB_URI")
        client = MongoClient(
            uri,
            tls=True,
            tlsAllowInvalidCertificates=True,
            serverSelectionTimeoutMS=30000,
            connectTimeoutMS=30000,
            socketTimeoutMS=30000
        )
        db = client["carepulse"]
        client.admin.command('ping')
        print("✅ MongoDB Connected!")
        return db
    except Exception as e:
        print(f"❌ MongoDB Failed: {e}")
        return None

db = get_db()

if db is not None:
    users_collection = db["users"]
    blood_requests_collection = db["blood_requests"]
    donors_collection = db["donors"]
else:
    users_collection = None
    blood_requests_collection = None
    donors_collection = None