import google.generativeai as genai
from config import get_settings

_configured = False


def get_model(quality: str = "fast") -> genai.GenerativeModel:
    global _configured
    if not _configured:
        settings = get_settings()
        genai.configure(api_key=settings.gemini_api_key)
        _configured = True

    model_name = "gemini-2.0-flash" if quality == "fast" else "gemini-1.5-pro"
    return genai.GenerativeModel(model_name)


async def generate(prompt: str, system: str = "", quality: str = "fast") -> str:
    model = get_model(quality)
    if system:
        full_prompt = f"{system}\n\n{prompt}"
    else:
        full_prompt = prompt

    response = await model.generate_content_async(full_prompt)
    return response.text
