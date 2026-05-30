from flask import Flask, send_from_directory
from flask_cors import CORS
from dotenv import load_dotenv
import sys
import os

# Fix import path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

load_dotenv()

app = Flask(__name__, static_folder="../frontend")
CORS(app)
app.config["JWT_SECRET_KEY"] = os.getenv("JWT_SECRET_KEY", "carepulse_secret_2026")


from routes.auth import auth_bp
from routes.blood import blood_bp
from routes.donor import donor_bp
from routes.ai import ai_bp

app.register_blueprint(auth_bp, url_prefix="/api/auth")
app.register_blueprint(blood_bp, url_prefix="/api/blood")
app.register_blueprint(donor_bp, url_prefix="/api/donor")
app.register_blueprint(ai_bp, url_prefix="/api/ai")

@app.route("/")
def index():
    return send_from_directory("../frontend", "index.html")

@app.route("/<path:filename>")
def serve_frontend(filename):
    return send_from_directory("../frontend", filename)

if __name__ == "__main__":
    print("🚀 CarePulse AI Running on http://localhost:5000")
    app.run(debug=False, host='0.0.0.0', port=5000)