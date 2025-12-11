import os
import io
from flask import Flask, render_template, request, flash
from PIL import Image
import torch
from transformers import AutoFeatureExtractor, AutoModelForImageClassification

app = Flask(__name__)
app.secret_key = "dev"

MODEL_ID = "Organika/sdxl-detector"

device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
feature_extractor = AutoFeatureExtractor.from_pretrained(MODEL_ID)
model = AutoModelForImageClassification.from_pretrained(MODEL_ID)
model.to(device)
model.eval()

def build_id2label(raw):
    if not raw:
        return {}
    out = {}
    for k, v in raw.items():
        try:
            idx = int(k)
        except Exception:
            try:
                idx = int(str(k))
            except Exception:
                idx = k
        out[idx] = v
    return out

raw_id2label = getattr(model.config, "id2label", None)
id2label = build_id2label(raw_id2label)
if not id2label:
    id2label = {0: "ai-generated", 1: "not-ai-generated"}

def predict_local(pil_image):
    inputs = feature_extractor(images=pil_image, return_tensors="pt")
    inputs = {k: v.to(device) for k, v in inputs.items()}
    with torch.no_grad():
        outputs = model(**inputs)
        probs = torch.softmax(outputs.logits, dim=1).cpu().numpy()[0]
    results = []
    for i, p in enumerate(probs):
        lbl = id2label.get(i, id2label.get(str(i), str(i)))
        results.append({"label": lbl, "score": float(p)})
    results.sort(key=lambda x: x["score"], reverse=True)
    return results

@app.route("/", methods=["GET", "POST"])
def index():
    if request.method == "POST":
        if "image" not in request.files:
            flash("No file uploaded")
            return render_template("index.html", uploaded=False)
        file = request.files["image"]
        if file.filename == "":
            flash("No file selected")
            return render_template("index.html", uploaded=False)
        try:
            img = Image.open(io.BytesIO(file.read())).convert("RGB")
        except:
            flash("Invalid image file")
            return render_template("index.html", uploaded=False)
        results = predict_local(img)
        top = results[0]
        return render_template("index.html", uploaded=True, prediction=top, results=results)
    return render_template("index.html", uploaded=False)

if __name__ == "__main__":
    app.run(debug=True)
