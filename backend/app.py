import os
from flask import Flask, send_from_directory
from flask_cors import CORS
from dotenv import load_dotenv

load_dotenv()

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
FRONTEND_DIR = os.path.join(BASE_DIR, 'frontend')

app = Flask(__name__)
CORS(app, origins="*")

from routes.auth import auth_bp
from routes.blood import blood_bp
from routes.donor import donor_bp
from routes.ai import ai_bp

app.register_blueprint(auth_bp, url_prefix="/api/auth")
app.register_blueprint(blood_bp, url_prefix="/api/blood")
app.register_blueprint(donor_bp, url_prefix="/api/donor")
app.register_blueprint(ai_bp, url_prefix="/api/ai")

@app.route('/')
def index():
    return send_from_directory(FRONTEND_DIR, 'index.html')

@app.route('/<path:path>')
def serve(path):
    try:
        return send_from_directory(FRONTEND_DIR, path)
    except:
        return send_from_directory(FRONTEND_DIR, 'index.html')

if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5000))
    app.run(debug=False, host="0.0.0.0", port=port)