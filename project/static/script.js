// ==============================
// GLOBAL VARIABLES & INIT
// ==============================
let savedRecipes = [];

document.addEventListener("DOMContentLoaded", function () {
    initDarkMode();
    initAccessibilityToggle();
    initTTS();
    initCopyListener();
    document.getElementById("message").addEventListener("keydown", handleKey);
});

// ==============================
// DARK MODE TOGGLE
// ==============================
function initDarkMode() {
    const darkMode = localStorage.getItem("darkMode");
    if (darkMode === "enabled") {
        document.body.classList.add("dark-mode");
        document.getElementById("chat-box").classList.add("dark-mode");
        document.getElementById("mode-toggle").innerHTML = "🌞";
    } else {
        document.getElementById("mode-toggle").innerHTML = "🌙";
    }

    document.getElementById("mode-toggle").addEventListener("click", toggleMode);
}

function toggleMode() {
    document.body.classList.toggle("dark-mode");
    document.getElementById("chat-box").classList.toggle("dark-mode");
    const isDarkMode = document.body.classList.contains("dark-mode");
    localStorage.setItem("darkMode", isDarkMode ? "enabled" : "disabled");
    document.getElementById("mode-toggle").innerHTML = isDarkMode ? "🌞" : "🌙";
}

// ==============================
// ACCESSIBILITY TOGGLE
// ==============================
function initAccessibilityToggle() {
    const highContrast = localStorage.getItem("highContrast");
    if (highContrast === "enabled") {
        document.body.classList.add("high-contrast");
    }

    const accessibilityToggle = document.getElementById("accessibility-toggle");
    accessibilityToggle?.addEventListener("click", () => {
        const isHighContrast = document.body.classList.toggle("high-contrast");
        localStorage.setItem("highContrast", isHighContrast ? "enabled" : "disabled");
    });
}

// ==============================
// TTS TOGGLE
// ==============================
function initTTS() {
    const ttsState = localStorage.getItem("ttsEnabled");
    const ttsToggle = document.getElementById("tts-toggle");

    if (ttsState === "enabled") {
        ttsToggle.innerHTML = "🔈";
    } else {
        ttsToggle.innerHTML = "🔇";
    }

    ttsToggle.addEventListener("click", toggleTTS);
}

function toggleTTS() {
    const ttsToggle = document.getElementById("tts-toggle");
    const isEnabled = localStorage.getItem("ttsEnabled") === "enabled";

    if (isEnabled) {
        localStorage.setItem("ttsEnabled", "disabled");
        ttsToggle.innerHTML = "🔇";
    } else {
        localStorage.setItem("ttsEnabled", "enabled");
        ttsToggle.innerHTML = "🔈";
    }
}

// ==============================
// COPY RECIPES
// ==============================
function initCopyListener() {
    document.body.addEventListener("click", function (e) {
        const copyButton = e.target.closest(".copy-recipe-btn");
        if (copyButton) {
            const content = copyButton.dataset.content;
            navigator.clipboard.writeText(content)
                .then(() => showToast("Recipe copied to clipboard!"))
                .catch(() => showToast("Failed to copy recipe.", "bg-danger"));
        }

        const removeBtn = e.target.closest(".remove-recipe");
        if (removeBtn) {
            const index = removeBtn.dataset.index;
            const saved = JSON.parse(localStorage.getItem("savedRecipes") || "[]");
            saved.splice(index, 1);
            localStorage.setItem("savedRecipes", JSON.stringify(saved));
            loadSavedRecipes();
            showToast("Recipe removed!", "bg-info");
        }
    });
}

// ==============================
// CHAT FUNCTIONALITY
// ==============================
async function sendMessage() {
    const input = document.getElementById("message");
    const message = input.value.trim();
    if (!message) return;

    const course = getCheckedValues('.course-option');
    const cuisine = getCheckedValues('.cuisine-option');
    const diet = getCheckedValues('.diet-option');

    appendMessage("user", message);
    input.value = "";
    input.focus();

    const chatBox = document.getElementById("chat-box");
    const botMsg = document.createElement("div");
    botMsg.className = "message bot";

    const dots = document.createElement("div");
    dots.className = "typing-dots";
    dots.innerHTML = "<span></span><span></span><span></span>";
    botMsg.appendChild(dots);
    chatBox.appendChild(botMsg);
    chatBox.scrollTop = chatBox.scrollHeight;

    try {
        const res = await fetch("/stream", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ message, course, cuisine, diet })
        });

        if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);

        const reader = res.body.getReader();
        const decoder = new TextDecoder("utf-8");
        let fullText = "";
        botMsg.removeChild(dots);

        while (true) {
            const { value, done } = await reader.read();
            if (done) break;
            const chunk = decoder.decode(value);
            fullText += chunk;
            botMsg.innerHTML = renderMarkdown(fullText);
            chatBox.scrollTop = chatBox.scrollHeight;
        }

        const history = JSON.parse(localStorage.getItem("chatHistory") || "[]");
        history.push({ sender: "bot", text: fullText });
        localStorage.setItem("chatHistory", JSON.stringify(history));

        if (fullText.toLowerCase().includes('ingredients') || fullText.toLowerCase().includes('recipe')) {
            const copyBtn = document.createElement("button");
            copyBtn.className = "btn btn-sm btn-outline-primary copy-recipe-btn mt-2";
            copyBtn.innerHTML = "📋 Copy to Clipboard";
            copyBtn.dataset.content = fullText;
            botMsg.appendChild(copyBtn);

            const recipeTitle = extractRecipeTitle(fullText);
            saveRecipeToSession({ title: recipeTitle, content: fullText });
            maybeSpeakRecipe(fullText);
        }

    } catch (error) {
        botMsg.innerHTML = `<p class="text-danger">Error: ${error.message}</p>`;
    }
}

function handleKey(e) {
    if (e.key === "Enter") sendMessage();
}

// ==============================
// EMAIL RECIPE FUNCTION
// ==============================
async function sendAllRecipes() {
    const email = document.getElementById("emailInput").value;
    const recipes = JSON.parse(sessionStorage.getItem("recipes") || "[]");

    if (!email || recipes.length === 0) {
        alert("Please enter your email and generate at least one recipe.");
        return;
    }

    const allRecipesText = recipes.map(r => r.content).join('\n\n--------------------------\n\n');

    try {
        const response = await fetch("/send-recipe-email", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                email,
                subject: "Your Recently Generated Recipes",
                recipe: allRecipesText
            })
        });

        const result = await response.json();
        alert(result.message || result.error);
    } catch (error) {
        console.error("Email send error:", error);
        alert("An error occurred while sending the recipes.");
    }
}

// ==============================
// SESSION & LOCAL STORAGE
// ==============================
function saveRecipeToSession(newRecipe) {
    let recipes = JSON.parse(sessionStorage.getItem("recipes") || "[]");
    recipes.push(newRecipe);
    sessionStorage.setItem("recipes", JSON.stringify(recipes));
}

// ==============================
// UI UTILITIES
// ==============================
function getCheckedValues(selector) {
    const checkboxes = document.querySelectorAll(selector);
    const values = Array.from(checkboxes).filter(cb => cb.checked).map(cb => cb.value);
    return values.length > 0 ? values : ["any"];
}

function appendMessage(sender, text) {
    const chatBox = document.getElementById("chat-box");
    const msg = document.createElement("div");
    msg.className = `message ${sender}`;
    msg.innerHTML = sender === "bot" ? renderMarkdown(text) : escapeHtml(text);
    chatBox.appendChild(msg);
    chatBox.scrollTop = chatBox.scrollHeight;

    const history = JSON.parse(localStorage.getItem("chatHistory") || "[]");
    history.push({ sender, text });
    localStorage.setItem("chatHistory", JSON.stringify(history.slice(-10)));
}

function escapeHtml(text) {
    return text.replace(/&/g, "&amp;")
               .replace(/</g, "&lt;")
               .replace(/>/g, "&gt;");
}

function showToast(message, bgColor = 'bg-success') {
    const toast = document.getElementById('custom-toast');
    const toastMsg = document.getElementById('custom-toast-message');

    toastMsg.textContent = message;
    toast.className = `position-fixed bottom-0 end-0 m-3 p-3 text-white rounded shadow ${bgColor}`;
    toast.style.display = 'block';

    setTimeout(() => toast.style.display = 'none', 3000);
}

// ==============================
// CHAT HISTORY LOADER
// ==============================
const chatHistory = JSON.parse(localStorage.getItem("chatHistory") || "[]");
const chatBox = document.getElementById("chat-box");
chatHistory.forEach(msg => {
    const messageDiv = document.createElement("div");
    messageDiv.className = `message ${msg.sender}`;
    messageDiv.innerHTML = msg.sender === "bot" ? renderMarkdown(msg.text) : msg.text;
    chatBox.appendChild(messageDiv);
});
chatBox.scrollTop = chatBox.scrollHeight;

// ==============================
// RECIPE METADATA HELPERS
// ==============================
function extractRecipeTitle(text) {
    let fallbackTitle = null;
    const lines = text.split('\n');
    const ignoredPrefixes = ["here", "i ", "you might", "okay", "sure", "certainly"];

    for (let line of lines) {
        line = line.trim();
        if (line.toLowerCase().startsWith("name:")) {
            return line.substring(5).trim();
        }
        if (fallbackTitle === null && line && !ignoredPrefixes.some(p => line.toLowerCase().startsWith(p))) {
            fallbackTitle = line.replace(/[#*]/g, '').trim();
        }
    }
    return fallbackTitle || "Untitled Recipe";
}

// ==============================
// MARKDOWN TO HTML FORMATTER
// ==============================
function renderMarkdown(text) {
    let cleanText = text.trim()
        .replace(/(Name:|Cuisine:)/g, '\n$1')
        .replace(/^[\s\S]*?(?=^Name:|^Cuisine:)/m, '')
        .replace(/\\n/g, '\n')
        .replace(/^Name:\s*(.*)$/gm, '<h3 class="mt-3 mb-2 text-primary">$1</h3>')
        .replace(/^#### (.*?):/gm, '<h4 class="mt-3 mb-2 text-secondary">$1:</h4>')
        .replace(/^(Ingredients Quantity|Prep Time|Cook Time|Instructions):\s*/gm, '<h5 class="mt-3 mb-2 text-info">$1:</h5>')
        .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
        .replace(/\*(.*?)\*/g, '<em>$1</em>')
        .replace(/`([^`]+)`/g, '<code class="bg-light px-1 rounded">$1</code>')
        .replace(/```([\s\S]*?)```/g, '<pre class="bg-light p-3 rounded"><code>$1</code></pre>')
        .replace(/\n(?![<h])/g, '<br>')
        .replace(/<br>\s*(<h[1-6])/g, '$1')
        .replace(/(<\/h[1-6]>)\s*<br>/g, '$1')
        .replace(/\(in mins\):\s*(\d+(?:\.\d+)?)/g, '<span class="badge bg-secondary ms-2">$1 mins</span>');
    return cleanText;
}
 
// ==============================
// CUSTOM DIET FORM
// ==============================
function addCustomDiet(event) {
    event.stopPropagation();
    event.preventDefault();

    const input = document.getElementById("customDietInput");
    const value = input.value.trim();
    if (!value) return;

    const savedDiets = JSON.parse(localStorage.getItem("customDiets")) || [];

    // Avoid duplicates
    if (savedDiets.includes(value)) return;

    savedDiets.push(value);
    localStorage.setItem("customDiets", JSON.stringify(savedDiets));

    appendDietOption(value);
    input.value = "";
}

function appendDietOption(value) {
    const newId = `diet-${value.toLowerCase().replace(/\s+/g, "-")}`;
    const li = document.createElement("li");

    li.innerHTML = `
        <label class="w-100 d-flex align-items-center py-1 px-2">
            <input type="checkbox" class="form-check-input me-2 diet-option" value="${value}" id="${newId}">
            ${value}
        </label>
    `;

    const dietOptions = document.getElementById("dietOptions");
    dietOptions.insertBefore(li, document.getElementById("customDietContainer"));
}

window.addEventListener("DOMContentLoaded", () => {
    const savedDiets = JSON.parse(localStorage.getItem("customDiets")) || [];
    savedDiets.forEach(diet => appendDietOption(diet));
});

// ==============================
// SPEECH RECOGNITION
// ==============================
function startSpeechRecognition() {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

    if (!SpeechRecognition) {
        alert("Sorry, your browser doesn't support speech recognition.");
        return;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = 'en-US';
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;

    recognition.start();

    recognition.onresult = function(event) {
        const transcript = event.results[0][0].transcript;
        document.getElementById('message').value = transcript;
    };

    recognition.onerror = function(event) {
        console.error('Speech recognition error:', event.error);
        alert("Speech recognition failed. Try again.");
    };
}

// ==============================
// TEXT-TO-SPEECH
// ==============================
function maybeSpeakRecipe(markdownText) {
    if (localStorage.getItem("ttsEnabled") !== "enabled") return;

    fetch('/api/speak', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ text: markdownText })
    })
    .then(response => response.blob())
    .then(blob => {
        const audioUrl = URL.createObjectURL(blob);
        const audio = new Audio(audioUrl);
        audio.play();
    })
    .catch(error => console.error('TTS Error:', error));
}

// ==============================
// HANDS FREE MODE
// ==============================
let handsFreeEnabled = false;
let recognition;

function initSpeechRecognition() {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
        alert("Speech recognition not supported in this browser.");
        return null;
    }

    const recog = new SpeechRecognition();
    recog.lang = "en-US";
    recog.interimResults = false;
    recog.maxAlternatives = 1;
    return recog;
}

document.getElementById("handsfree-toggle").addEventListener("click", () => {
    handsFreeEnabled = !handsFreeEnabled;
    document.getElementById("handsfree-toggle").innerText = handsFreeEnabled ? "Hands-Free ON" : "Hands-Free OFF";
});

document.addEventListener("keydown", (e) => {
    if (!handsFreeEnabled) return;
    if (!/[a-zA-Z]/.test(e.key)) return;

    e.preventDefault();

    recognition = initSpeechRecognition();
    if (!recognition) return;

    recognition.start();

    recognition.onstart = () => {
        console.log("Listening for prompt...");
    };

    recognition.onresult = (event) => {
        const transcript = event.results[0][0].transcript.trim();
        console.log("Heard:", transcript);

        document.getElementById("message").value = transcript;
        sendMessage();
    };

    recognition.onerror = (event) => {
        console.error("Speech recognition error:", event.error);
        handsFreeEnabled = false;
    };
});
