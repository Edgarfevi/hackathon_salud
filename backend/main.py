from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from backend.model import KidneyDiseaseModel
import pandas as pd
from fastapi.middleware.cors import CORSMiddleware
import os

app = FastAPI(title="CKD Risk Prediction API")

# Enable CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # For hackathon, allow all. In prod, specify domain.
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize model
model = KidneyDiseaseModel()

# Load model on startup if exists, otherwise we might need to trigger training
@app.on_event("startup")
async def startup_event():
    if not model.load_model():
        print("Model not found. Attempting to train...")
        # Determine data path
        current_dir = os.path.dirname(os.path.abspath(__file__))
        possible_paths = [
            os.path.join(current_dir, "../archive/Chronic_Kidney_Dsease_data.csv"),
            os.path.join(current_dir, "archive/Chronic_Kidney_Dsease_data.csv"),
            "archive/Chronic_Kidney_Dsease_data.csv"
        ]
        data_path = None
        for path in possible_paths:
            if os.path.exists(path):
                data_path = path
                break
        
        if data_path:
            model.train(data_path)
        else:
            print("WARNING: Data file not found. Model not loaded.")

class PatientData(BaseModel):
    Age: int
    Gender: int
    Ethnicity: int
    SocioeconomicStatus: int
    EducationLevel: int
    BMI: float
    Smoking: int
    AlcoholConsumption: float
    PhysicalActivity: float
    # DietQuality: float  # Removed
    # SleepQuality: float # Removed
    FamilyHistoryKidneyDisease: int
    FamilyHistoryHypertension: int
    FamilyHistoryDiabetes: int
    PreviousAcuteKidneyInjury: int
    UrinaryTractInfections: int
    SystolicBP: int
    DiastolicBP: int
    FastingBloodSugar: float
    HbA1c: float
    SerumCreatinine: float
    BUN: float
    GFR: float
    ProteinInUrine: float
    ACR: float
    SerumElectrolytesSodium: float
    SerumElectrolytesPotassium: float
    SerumElectrolytesCalcium: float
    SerumElectrolytesPhosphorus: float
    HemoglobinLevels: float
    CholesterolTotal: float
    CholesterolLDL: float
    CholesterolHDL: float
    CholesterolTriglycerides: float
    ACEInhibitors: int
    Diuretics: int
    NSAIDsUse: float
    Statins: int
    AntidiabeticMedications: int
    Edema: int
    Fatigue: int
    NauseaVomiting: int
    MuscleCramps: int
    Itching: float
    # QualityOfLifeScore: float # Removed
    HeavyMetalsExposure: int
    OccupationalExposureChemicals: int
    # WaterQuality: int # Removed
    MedicalCheckupsFrequency: float
    MedicationAdherence: float
    HealthLiteracy: float

@app.get("/")
def read_root():
    return {"message": "CKD Risk Prediction API is running"}

@app.post("/predict")
def predict_risk(data: PatientData):
    try:
        input_data = data.dict()
        result = model.predict(input_data)
        
        risk_level = "High" if result["prediction"] == 1 else "Low"
        
        return {
            "risk_class": result["prediction"],
            "risk_level": risk_level,
            "probability": result["probability"]
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
