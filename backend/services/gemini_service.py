import google.generativeai as genai
import os
from dotenv import load_dotenv

load_dotenv()

SYSTEM_PROMPT = """
You are CarePulse AI Health Assistant — a compassionate, knowledgeable healthcare support AI.

STRICT RULES:
1. You are NOT a doctor. Always end with:
   Please consult a qualified doctor for proper diagnosis and treatment.

2. For life-threatening emergencies, say clearly:
   CALL EMERGENCY SERVICES IMMEDIATELY — 112 or 108.

3. Provide empathetic, clear, structured responses.

4. Support mental wellness with empathy and understanding.

5. Keep responses under 200 words unless analyzing a medical report.

6. If user writes in Hindi, respond entirely in Hindi.

7. Always state urgency level clearly:
   URGENCY: LOW / MEDIUM / HIGH / EMERGENCY

8. Never diagnose. Always suggest possibilities.

9. For medical reports:
   - Extract key values
   - Explain in simple language
   - Flag abnormal values clearly

RESPONSE FORMAT for symptoms:
- Possible causes
- What to do right now
- When to see a doctor
- URGENCY level

RESPONSE FORMAT for medical reports:
- Summary of findings
- Abnormal values clearly flagged
- What each value may indicate
- Recommended next steps
- Doctor consultation advice
"""

REPORT_PROMPT = """
If the user provides a medical report, lab result, blood test, hospital document, fitness certificate, prescription, or health record, return the response in exactly this format:

PATIENT SUMMARY

RISK LEVEL

DONATION ELIGIBILITY

KEY FINDINGS

RECOMMENDATIONS

Use simple language.
Highlight abnormal values clearly.
Explain whether the person is fit for blood donation.
"""

genai.configure(api_key=os.getenv("GEMINI_API_KEY"))

model = genai.GenerativeModel("gemini-2.5-flash")


def get_ai_response(user_message, chat_history=None):
    try:

        if chat_history is None:
            chat_history = []

        history_text = ""

        for msg in chat_history[-6:]:
            role = "User" if msg.get("role") == "user" else "Assistant"
            history_text += f"{role}: {msg.get('content', '')}\n"

        full_prompt = (
            SYSTEM_PROMPT
            + "\n\n"
            + REPORT_PROMPT
            + "\n\nPrevious conversation:\n"
            + history_text
            + "\nUser: "
            + user_message
        )

        response = model.generate_content(full_prompt)

        return response.text

    except Exception as e:
        print("Gemini Error:", str(e))

        return (
            "I am having trouble connecting right now. "
            "Please consult a doctor directly. "
            "Please consult a qualified doctor for proper diagnosis and treatment."
        )