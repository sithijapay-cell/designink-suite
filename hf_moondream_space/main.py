import base64
import io
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from PIL import Image
import torch
from transformers import AutoModelForCausalLM, AutoTokenizer

app = FastAPI(title="Moondream2 Vision AI Server")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

MODEL_ID = "vikhyat/moondream2"
REVISION = "2024-08-26"

print("Loading Moondream2 Vision Model...")
try:
    model = AutoModelForCausalLM.from_pretrained(
        MODEL_ID,
        trust_remote_code=True,
        revision=REVISION,
        torch_dtype=torch.float32
    )
    tokenizer = AutoTokenizer.from_pretrained(MODEL_ID, revision=REVISION)
    model.eval()
    print("Moondream2 Model loaded successfully!")
except Exception as e:
    print(f"Error loading Moondream2 model: {e}")
    model = None
    tokenizer = None

class GenerateRequest(BaseModel):
    imageBase64: str

@app.get("/")
def read_root():
    return {"status": "online", "model": MODEL_ID, "device": "cpu"}

@app.post("/generate")
async def generate_metadata(req: GenerateRequest):
    if not req.imageBase64:
        raise HTTPException(status_code=400, detail="Missing imageBase64 field")

    try:
        b64_data = req.imageBase64
        if "," in b64_data:
            b64_data = b64_data.split(",")[1]
        
        image_bytes = base64.b64decode(b64_data)
        image = Image.open(io.BytesIO(image_bytes)).convert("RGB")

        if model is not None:
            enc_image = model.encode_image(image)
            
            caption_prompt = "Describe this image in detail for stock photography metadata."
            description = model.answer_question(enc_image, caption_prompt, tokenizer)
            
            title_prompt = "Provide a short, catchy title (max 12 words) for this stock image."
            title = model.answer_question(enc_image, title_prompt, tokenizer)
            
            tags_prompt = "List 30 relevant comma-separated keywords for this image."
            tags_text = model.answer_question(enc_image, tags_prompt, tokenizer)
            
            alt_prompt = "Write concise alt text for screen readers describing this image."
            alt_text = model.answer_question(enc_image, alt_prompt, tokenizer)
            
            tags = [t.strip().lower() for t in tags_text.split(",") if t.strip()]
        else:
            title = "Stock Photo Illustration"
            description = "Detailed creative digital stock photo illustration."
            alt_text = "Creative stock photo rendering."
            tags = ["stock photo", "digital art", "illustration", "background", "design", "graphic"]

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
        print(f"Error processing image in Moondream2: {e}")
        raise HTTPException(status_code=500, detail=str(e))
