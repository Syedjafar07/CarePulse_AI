import os
from dotenv import load_dotenv
load_dotenv()

def send_sms_alert(to_phone, message):
    try:
        from twilio.rest import Client
        account_sid = os.getenv("TWILIO_ACCOUNT_SID")
        auth_token = os.getenv("TWILIO_AUTH_TOKEN")
        from_number = os.getenv("TWILIO_PHONE_NUMBER")
        
        print(f"📱 Sending SMS to {to_phone}...")
        print(f"📱 From: {from_number}")
        
        client = Client(account_sid, auth_token)
        msg = client.messages.create(
            body=message,
            from_=from_number,
            to=to_phone
        )
        print(f"✅ SMS sent! SID: {msg.sid}")
        return True
    except Exception as e:
        print(f"❌ SMS FAILED: {e}")
        return False