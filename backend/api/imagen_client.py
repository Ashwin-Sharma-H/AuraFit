import os
import base64
import logging
import time
import random
from django.conf import settings
from google import genai
from google.genai import types
from google.genai.types import HttpOptions

logger = logging.getLogger(__name__)

def retry_with_exponential_backoff(func, max_retries=5, base_delay=1.0, max_delay=60.0, context_info=None):
    """Retries a function with exponential backoff and jitter."""
    for attempt in range(max_retries):
        try:
            print(f"[Vertex AI Client] Attempt {attempt + 1}/{max_retries} for {context_info or 'task'}")
            result = func()
            if result is not None:
                print(f"[Vertex AI Client] SUCCESS on attempt {attempt + 1} for {context_info or 'task'}")
                return result
            else:
                print(f"[Vertex AI Client] Function returned no result on attempt {attempt + 1} for {context_info or 'task'}")
        except Exception as e:
            error_message = str(e)
            print(f"[Vertex AI Client] Attempt {attempt + 1} failed for {context_info or 'task'}: {error_message}")
            # Identify retryable errors
            retryable_errors = ["500", "503", "429", "502", "504", "Connection error", "Timeout", "Rate limit", "RemoteProtocolError", "peer closed connection"]
            is_404 = "NOT_FOUND" in error_message or "404" in error_message
            is_retryable = any(retryable_error in error_message for retryable_error in retryable_errors)
            if not is_retryable or is_404 or attempt == max_retries - 1:
                print(f"[Vertex AI Client] Final failure for {context_info or 'task'}.")
                return None
            delay = min(base_delay * (2 ** attempt), max_delay) + random.uniform(0, 0.1) * min(base_delay * (2 ** attempt), max_delay)
            print(f"[Vertex AI Client] Waiting {delay:.2f} seconds before retry...")
            time.sleep(delay)
    return None

class VertexImagenClient:
    def __init__(self):
        # Load from django settings if configured, otherwise env/os
        self.gcp_project = getattr(settings, "GOOGLE_CLOUD_PROJECT", None) or os.getenv("GOOGLE_CLOUD_PROJECT")
        self.gcp_credentials = getattr(settings, "GOOGLE_APPLICATION_CREDENTIALS", None) or os.getenv("GOOGLE_APPLICATION_CREDENTIALS")
        self.gcp_location = getattr(settings, "GOOGLE_CLOUD_LOCATION", None) or os.getenv("GOOGLE_CLOUD_LOCATION", "us-central1")
        self.api_key = getattr(settings, "GEMINI_API_KEY", None) or os.getenv("GEMINI_API_KEY")
        self.is_configured = False
        self.client = None

        if self.gcp_project:
            try:
                if self.gcp_credentials:
                    os.environ["GOOGLE_APPLICATION_CREDENTIALS"] = self.gcp_credentials
                location = self.gcp_location if self.gcp_location and self.gcp_location.lower() != 'global' else 'us-central1'
                self.client = genai.Client(
                    vertexai=True,
                    project=self.gcp_project,
                    location=location,
                    http_options=HttpOptions(api_version="v1")
                )
                self.is_configured = True
                print(f"[Vertex AI Client] Imagen client initialized using Vertex AI (project: {self.gcp_project}, location: {location}).")
            except Exception as e:
                print(f"[Vertex AI Client] Failed to configure Vertex AI Client for Imagen: {e}")

        if not self.is_configured and self.api_key:
            try:
                self.client = genai.Client(api_key=self.api_key)
                self.is_configured = True
                print("[Vertex AI Client] Imagen client initialized using standard API Key.")
            except Exception as e:
                print(f"[Vertex AI Client] Failed to configure Imagen Client: {e}")

    def generate_dish_image(self, dish_name, ingredients=None):
        """
        Calls Imagen model to generate a high quality image representation of the dish.
        Returns the base64 encoded string of the image.
        """
        if not self.is_configured or not self.client:
            print("[Vertex AI Client] Imagen Client not configured. Returning fallback placeholder image data.")
            return self._get_fallback_base64()

        # Try to use Gemini to refine/enhance the visual prompt first.
        # This translates cultural terms (like 'Bhurji' to scrambled eggs) and prevents hallucination of unlisted ingredients (like rice).
        visual_description = None
        if self.is_configured and self.client:
            try:
                text_model = getattr(settings, "VERTEX_TEXT_MODEL", "gemini-2.5-flash")
                gemini_prompt = (
                    f"Create a highly detailed, concise visual description for an image generator (like Imagen) to depict the dish: '{dish_name}'.\n"
                    f"Ingredients list: {ingredients or 'Not specified'}.\n\n"
                    "Instructions:\n"
                    "1. Describe the final cooked dish's appearance, colors, texture, shape (e.g. if it is scrambled eggs, say it is scrambled egg curds; if it is grilled, describe grill marks).\n"
                    "2. STRICTLY avoid including ingredients, foods, or side dishes that are NOT in the ingredient list. For example, if rice is not listed, do not show rice. If bread/roti is not listed, do not show bread/roti. If noodles are not listed, do not show noodles. Specifically, if rice is not listed, make sure to explicitly state that the dish has NO rice.\n"
                    "3. Make sure the visual description represents the food accurately. (e.g. 'Egg Bhurji' is scrambled eggs, not whole/boiled eggs; 'Paneer Tikka' is dry grilled skewers, not paneer in gravy).\n"
                    "4. Output ONLY the visual description itself as a single paragraph. Do not include introductory text, markdown headers, bolding, quotes, or conversational filler."
                )
                print(f"[Vertex AI Client] Requesting Gemini to refine prompt for dish: '{dish_name}'")
                response = self.client.models.generate_content(
                    model=text_model,
                    contents=gemini_prompt
                )
                if response and response.text:
                    visual_description = response.text.strip()
                    print(f"[Vertex AI Client] Gemini generated visual description: '{visual_description}'")
            except Exception as e:
                print(f"[Vertex AI Client] Gemini prompt enhancement failed: {e}. Falling back to default prompt construction.")

        if visual_description:
            prompt = f"Professional commercial food photography of {visual_description} Clean presentation, gourmet plate styling, shallow depth of field, warm cinematic lighting, studio background, ultra-realistic."
        else:
            prompt = f"Professional commercial food photography of {dish_name}. Clean presentation, gourmet plate styling."
            if ingredients:
                prompt += f" Featuring only these key visible ingredients: {ingredients}. Avoid showing any other foods or ingredients outside this list."
            prompt += " Shallow depth of field, warm cinematic lighting, studio background, ultra-realistic."

        print(f"[Vertex AI Client] Final Imagen prompt: '{prompt}'")

        def run_generation():
            model_name = getattr(settings, "VERTEX_IMAGE_MODEL", "imagen-3.0-generate-002")
            response = self.client.models.generate_images(
                model=model_name,
                prompt=prompt,
                config=types.GenerateImagesConfig(
                    number_of_images=1,
                    output_mime_type="image/jpeg",
                    aspect_ratio="16:9"
                )
            )
            if response.generated_images:
                img = response.generated_images[0]
                base64_data = base64.b64encode(img.image.image_bytes).decode('utf-8')
                return f"data:image/jpeg;base64,{base64_data}"
            return None

        try:
            result = retry_with_exponential_backoff(run_generation, context_info=f"Imagen generation for {dish_name}")
            if result:
                return result
            print("[Vertex AI Client] Image generation failed after retries.")
            return self._get_fallback_base64()
        except Exception as e:
            print(f"[Vertex AI Client] Imagen API invocation failed: {e}. Falling back to placeholder.")
            return self._get_fallback_base64()

    def _get_fallback_base64(self):
        # Return a simple solid placeholder SVG as base64 fallback to prevent UI breaking
        return "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='800' height='400' viewBox='0 0 800 400'><rect width='800' height='400' fill='%231e293b'/><text x='50%25' y='50%25' dominant-baseline='middle' text-anchor='middle' fill='%2364748b' font-family='sans-serif' font-size='20'>🎨 AI Food Art Preview</text></svg>"
