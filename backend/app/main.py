import io
import os
import base64
from datetime import datetime
from typing import Dict, List, Optional

import torch
import torch.nn as nn
from torchvision import models, transforms
from fastapi import FastAPI, UploadFile, File, Form, HTTPException, Depends
from fastapi.middleware.cors import CORSMiddleware
from PIL import Image
import numpy as np
import cv2
import pydicom
from pydantic import BaseModel
from sqlalchemy import create_engine, Column, Integer, String, Float, DateTime
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker, Session

# --- DATABASE SETUP ---
SQLALCHEMY_DATABASE_URL = "sqlite:///./clinical_audit.db"
engine = create_engine(SQLALCHEMY_DATABASE_URL, connect_args={"check_same_thread": False})
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

class ScanAuditLog(Base):
    __tablename__ = "scan_logs"
    id = Column(Integer, primary_key=True, index=True)
    patient_id = Column(String, index=True)
    primary_finding = Column(String)
    confidence = Column(Float)
    timestamp = Column(DateTime, default=datetime.utcnow)

Base.metadata.create_all(bind=engine)

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

app = FastAPI(title="NeuralCXR.ai Production API", version="2.1")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

CLASSES = [
    "Atelectasis", "Cardiomegaly", "Effusion", "Infiltration", 
    "Mass", "Nodule", "Pneumonia", "Pneumothorax"
]

ml_models = {}

@app.on_event("startup")
def load_model():
    device = torch.device("cpu")
    model = models.densenet121(weights=None)
    model.classifier = nn.Linear(model.classifier.in_features, len(CLASSES))
    model.eval()
    ml_models["densenet"] = model
    ml_models["device"] = device

transform = transforms.Compose([
    transforms.Resize((224, 224)),
    transforms.ToTensor(),
    transforms.Normalize(mean=[0.485, 0.456, 0.406], std=[0.229, 0.224, 0.225])
])

def compute_gradcam(model, input_tensor, original_image, target_class_idx):
    """Computes Grad-CAM heatmap overlay for DenseNet121 features."""
    gradients = []
    activations = []

    def backward_hook(module, grad_input, grad_output):
        gradients.append(grad_output[0])

    def forward_hook(module, input, output):
        activations.append(output)

    # Hook into the last dense block features of DenseNet121
    target_layer = model.features.denseblock4
    handle_fwd = target_layer.register_forward_hook(forward_hook)
    handle_bwd = target_layer.register_full_backward_hook(backward_hook)

    output = model(input_tensor)
    model.zero_grad()
    
    class_score = output[0, target_class_idx]
    class_score.backward()

    handle_fwd.remove()
    handle_bwd.remove()

    if not gradients or not activations:
        return None

    grads = gradients[0].cpu().data.numpy()[0]
    acts = activations[0].cpu().data.numpy()[0]

    weights = np.mean(grads, axis=(1, 2))
    cam = np.zeros(acts.shape[1:], dtype=np.float32)

    for i, w in enumerate(weights):
        cam += w * acts[i]

    cam = np.maximum(cam, 0)
    if cam.max() != 0:
        cam = cam / cam.max()
    else:
        cam = np.zeros_like(cam)

    # Resize cam to match original image size
    cam = cv2.resize(cam, (original_image.width, original_image.height))
    heatmap = cv2.applyColorMap(np.uint8(255 * cam), cv2.COLORMAP_JET)
    
    # Blend heatmap with original image
    original_cv = np.array(original_image.convert("RGB"))
    original_cv = cv2.cvtColor(original_cv, cv2.COLOR_RGB2BGR)
    superimposed = cv2.addWeighted(original_cv, 0.6, heatmap, 0.4, 0)

    _, buffer = cv2.imencode('.jpg', superimposed)
    encoded_image = base64.b64encode(buffer).decode('utf-8')
    return f"data:image/jpeg;base64,{encoded_image}"

@app.post("/api/diagnose")
async def diagnose(
    patient_id: str = Form(...), 
    file: UploadFile = File(...),
    db: Session = Depends(get_db)
):
    try:
        contents = await file.read()
        filename = file.filename.lower()

        if filename.endswith(".dcm"):
            dicom_file = pydicom.dcmread(io.BytesIO(contents))
            image_array = dicom_file.pixel_array
            image_array = ((image_array - image_array.min()) / (image_array.max() - image_array.min()) * 255).astype('uint8')
            image = Image.fromarray(image_array).convert("RGB")
        else:
            image = Image.open(io.BytesIO(contents)).convert("RGB")

        input_tensor = transform(image).unsqueeze(0).to(ml_models["device"])

        model = ml_models["densenet"]
        with torch.set_grad_enabled(True):
            outputs = model(input_tensor)
            probabilities = torch.sigmoid(outputs)[0].cpu().detach().numpy()

        scores = {CLASSES[i]: float(probabilities[i] * 100) for i in range(len(CLASSES))}
        primary_finding = max(scores, key=scores.get)
        primary_idx = CLASSES.index(primary_finding)
        confidence = scores[primary_finding]

        # Generate Grad-CAM Visual Explainability Overlay
        gradcam_base64 = compute_gradcam(model, input_tensor, image, primary_idx)

        # Save audit log entry
        db_log = ScanAuditLog(
            patient_id=patient_id,
            primary_finding=primary_finding,
            confidence=confidence
        )
        db.add(db_log)
        db.commit()

        return {
            "patient_id": patient_id,
            "primary_finding": primary_finding,
            "confidence": confidence,
            "all_scores": scores,
            "heatmap": gradcam_base64
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/history")
def get_history(db: Session = Depends(get_db)):
    logs = db.query(ScanAuditLog).order_by(ScanAuditLog.timestamp.desc()).limit(20).all()
    return [
        {
            "id": log.id,
            "patient_id": log.patient_id,
            "primary_finding": log.primary_finding,
            "confidence": log.confidence,
            "timestamp": log.timestamp.strftime("%Y-%m-%d %H:%M:%S")
        }
        for log in logs
    ]