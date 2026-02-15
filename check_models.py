import os
from google import genai
from dotenv import load_dotenv

load_dotenv()

api_key = os.getenv("GEMINI_API_KEY")
if not api_key:
    # Manual fallback if env not loaded correctly in subprocess
    api_key = "AIzaSyDGusPWOz0aF5FJ0vgrQ3XrhbndFqkiZgk"

client = genai.Client(api_key=api_key)
try:
    print("Listing models...")
    for model in client.models.list():
        print(f"- {model.name}")
except Exception as e:
    print(f"Error: {e}")
