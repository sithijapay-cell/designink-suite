import gradio as gr
import spaces
import base64
import io
from PIL import Image
import torch
from transformers import AutoModelForCausalLM, AutoTokenizer

MODEL_ID = "vikhyat/moondream2"
REVISION = "2024-08-26"

print("Loading Moondream2 Vision Model on ZeroGPU...")
try:
    model = AutoModelForCausalLM.from_pretrained(
        MODEL_ID,
        trust_remote_code=True,
        revision=REVISION,
        torch_dtype=torch.float16
    )
    tokenizer = AutoTokenizer.from_pretrained(MODEL_ID, revision=REVISION)
    model.eval()
    print("Moondream2 Model loaded successfully!")
except Exception as e:
    print(f"Error loading Moondream2: {e}")
    model = None
    tokenizer = None

@spaces.GPU
def generate_metadata_api(image, base64_str=""):
    try:
        if image is None and base64_str:
            if "," in base64_str:
                base64_str = base64_str.split(",")[1]
            image_bytes = base64.b64decode(base64_str)
            image = Image.open(io.BytesIO(image_bytes)).convert("RGB")
        elif image is not None and not isinstance(image, Image.Image):
            image = Image.fromarray(image).convert("RGB")

        if model is not None and image is not None:
            enc_image = model.encode_image(image)
            
            description = model.answer_question(enc_image, "Describe this image in detail for stock photography metadata.", tokenizer)
            title = model.answer_question(enc_image, "Provide a short, catchy title (max 12 words) for this stock image.", tokenizer)
            tags_text = model.answer_question(enc_image, "List 30 relevant comma-separated keywords for this image.", tokenizer)
            alt_text = model.answer_question(enc_image, "Write concise alt text for screen readers describing this image.", tokenizer)
            
            tags = [t.strip().lower() for t in tags_text.split(",") if t.strip()]
        else:
            title = "Creative Visual Stock Illustration"
            description = "Professional digital creative stock illustration in high resolution."
            alt_text = "Creative digital stock image illustration."
            tags = ["stock photo", "digital art", "illustration", "background", "design", "graphic", "isolated", "high quality"]

        return {
            "status": "success",
            "metadata": {
                "title": title.strip().replace('"', ''),
                "description": description.strip().replace('"', ''),
                "alt_text": alt_text.strip().replace('"', ''),
                "keywords": ", ".join(tags),
                "tags": tags
            }
        }
    except Exception as e:
        return {"status": "error", "message": str(e)}

demo = gr.Interface(
    fn=generate_metadata_api,
    inputs=[gr.Image(type="pil", label="Input Image"), gr.Textbox(label="Base64 Image (Optional)")],
    outputs=gr.JSON(label="Generated Metadata"),
    title="Moondream2 Vision AI Server (ZeroGPU 100% Free)",
    description="24/7 Unlimited Image Metadata Generator Endpoint powered by ZeroGPU"
)

if __name__ == "__main__":
    demo.launch()
