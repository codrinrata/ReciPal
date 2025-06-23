# ReciPal
Integration of LLM in conversational cooking recipe generation. Made for bachelor thesis
# How to use

## Requirements
The application consists of a backend, a frontend, and a locally hosted large lan-
guage model served via Ollama. Below are the software and hardware requirements:
- Python 3.10 or higher
- Flask, Flask-Mail, requests, gTTS, and other required Python packages (can
be done via `pip install -r requirements.txt`)
- Ollama for model hosting
- Fine-tuned LLaMA 3.2 GGUF model
- A browser (Chrome, Firefox, etc.)

## Installation and Setup

1. Clone the Repository
`git clone https://gitlab.dev.info.uvt.ro/didactic/2025/licenta/ie/licentacodrinrata`
`cd licentacodrinrata2025/proiect`

2. Create a virtual environment and install dependencies
This can be done either through IDE’s interface or through CLI.
bash:
`python -m venv venv`
`source venv/bin/activate # On Windows: venv\Scripts\activate`
`pip install -r requirements.txt`

3. Configure environment variables
Update the Flask-Mail settings in app.py or create a ‘.env‘ file containing:
`MAIL_USERNAME=your_email@gmail.com`
`MAIL_PASSWORD=your_app_password`
App passwords for Gmail can be generated from here.

4. Start the Ollama Server and Load the Model
`ollama pull hf.co/codrin32/licenta2025-ReciPal-Q8_0-GGUF:Q8_0`
`ollama serve`

5. Run the Flask application
`python app.py`

## Using the Application
Once the app is running:
- Open a browser and go to http://localhost:5000
- Enter ingredients and dietary and cuisine preferences into the chat interface
- Wait for the recipe to be generated and displayed
- Use additional options like sending the recipe via email and listening to the recipe with the text-to-speech feature

## Notes:
- All data is stored locally in the browser via ‘localStorage‘
- No user accounts or cloud services are required
- The system works offline after the model is downloaded and installed
- Firefox might not support microphone input
