# ---------------------------------------
# Imports and App Setup
# ---------------------------------------
from flask import Flask, Response, request, render_template, stream_with_context, send_file
from flask_mail import Mail, Message
from datetime import datetime
import requests
import json
import io
from gtts import gTTS
import os

app = Flask(__name__)

# ---------------------------------------
# Flask-Mail Configuration
# ---------------------------------------
from dotenv import load_dotenv
load_dotenv()

app.config.update({
    "MAIL_SERVER": "smtp.gmail.com",
    "MAIL_PORT": 587,
    "MAIL_USE_TLS": True,
    "MAIL_USERNAME": os.environ.get('EMAIL_USER'),
    "MAIL_PASSWORD": os.environ.get('EMAIL_PASS'),
    "MAIL_DEFAULT_SENDER": "codrin.rata33@gmail.com"
})

mail = Mail(app)

# ---------------------------------------
# Route: Homepage
# ---------------------------------------
@app.route("/")
def index():
    return render_template("index.html")


# ---------------------------------------
# Route: /stream (Recipe Generation Streaming Endpoint)
# ---------------------------------------
@app.route("/stream", methods=["POST"])
def stream():
    data = request.get_json()
    message = data.get("message", "")
    course = data.get("course", [])
    diet = data.get("diet", [])

    user_prompt = f"""You are a helpful cooking assistant. Give me a {', '.join(diet) if diet and diet != ['any'] else ''} {', '.join(course) if course and course != ['any'] else ''} recipe using {message}."""
    print(f"User prompt: {user_prompt}")

    def generate():
        try:
            response = requests.post(
                "http://localhost:11434/api/generate",
                json={
                    "model": "hf.co/codrin32/licenta2025-ReciPal-Q8_0-GGUF:Q8_0",
                    "prompt": f"""You are a structured recipe generator. Given user inputs including ingredients, cuisines, diets, or meal types, respond with a complete recipe in the following exact format:\n\nName: [Recipe Name]  \nCuisine: [Cuisine]  \nCourse: [Meal Type]  \nDiet: [Diet Type]  \nIngredients Quantity:  \n[Quantity] [Ingredient name]\n\n... \nPrep Time [minutes]  \nCook Time [minutes]  \nInstructions:  \n[Step-by-step instructions in a single paragraph or numbered format.]\n\nDo not include introductory or concluding comments. Do not say things like \"You can also add...\" or \"Here's how you do it\". Only use the ingredients that make sense for a balanced, plausible recipe \u2014 not all of them unless necessary.\n\nStick closely to the structure. If any field (e.g., Diet) is missing, mark it as \"Any\". Keep it short, specific, and practical.\n\nUser prompt: {user_prompt}""",
                    "stream": True
                },
                stream=True,
                timeout=30
            )

            for line in response.iter_lines():
                if line:
                    try:
                        json_response = json.loads(line.decode('utf-8'))
                        if 'response' in json_response:
                            yield json_response['response']
                        if json_response.get('done', False):
                            break
                    except json.JSONDecodeError:
                        continue
        except requests.exceptions.RequestException as e:
            yield f"Error connecting to Ollama: {str(e)}"
        except Exception as e:
            yield f"An error occurred: {str(e)}"

    return Response(stream_with_context(generate()), content_type="text/plain")


# ---------------------------------------
# Route: /send-recipe-email (Send Recipes to Email)
# ---------------------------------------
@app.route("/send-recipe-email", methods=["POST"])
def send_recipe_email():
    data = request.get_json()
    to_email = data.get("email")
    recipe_content = data.get("recipe")

    if not to_email or not recipe_content:
        return {"error": "Missing recipient or recipe content"}, 400

    recipes = []
    if isinstance(recipe_content, list):
        for entry in recipe_content:
            title_line = next((line for line in entry.splitlines() if line.lower().startswith("name:")), None)
            title = title_line.split(":", 1)[1].strip() if title_line else "Untitled"
            recipes.append({"title": title})
        body = "\n\n---\n\n".join(recipe_content)
    else:
        title_line = next((line for line in recipe_content.splitlines() if line.lower().startswith("name:")), None)
        title = title_line.split(":", 1)[1].strip() if title_line else "Untitled"
        recipes = [{"title": title}]
        body = recipe_content

    try:
        today = datetime.now().strftime("%B %d, %Y")
        msg = Message(
            subject=f"Your Recipes – {today}",
            sender=app.config["MAIL_DEFAULT_SENDER"],
            recipients=[to_email],
            body=body
        )
        mail.send(msg)
        return {"success": True, "message": "Recipe sent successfully!"}
    except Exception as e:
        return {"error": str(e)}, 500


# ---------------------------------------
# Route: /api/speak (Play recipe as audio)
# ---------------------------------------
@app.route('/api/speak', methods=['POST'])
def speak():
    data = request.get_json()
    text = data.get('text', '')

    if not text:
        return "No text provided", 400

    tts = gTTS(text)
    mp3_fp = io.BytesIO()
    tts.write_to_fp(mp3_fp)
    mp3_fp.seek(0)

    return send_file(mp3_fp, mimetype='audio/mpeg')


# ---------------------------------------
# Run the Flask App
# ---------------------------------------
if __name__ == "__main__":
    app.run(debug=True, host='0.0.0.0', port=5000)
