from fastapi import FastAPI, HTTPException, UploadFile, File
from pydantic import BaseModel
import pandas as pd
from fastapi.middleware.cors import CORSMiddleware
import os
import sys
import shutil

# Añadir el directorio padre al path para importar el modelo
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

# Intentar importar desde backend.model o model según desde dónde se ejecute
try:
    from backend.model import KidneyDiseaseModel
    from backend.agent import MedicalRecordExtractor
except ImportError:
    from model import KidneyDiseaseModel
    from agent import MedicalRecordExtractor

app = FastAPI(title="CKD Risk Prediction API")

# Enable CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # For hackathon, allow all. In prod, specify domain.
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

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
    # New fields from merged_kidney_data (1).csv
    HistoryDiabetes: int = 0
    HistoryCHD: int = 0
    HistoryVascular: int = 0
    HistoryHTN: int = 0
    HistoryDLD: int = 0
    HistoryObesity: int = 0
    HTNmeds: int = 0

@app.post("/analyze_pdf")
async def analyze_pdf(file: UploadFile = File(...)):
    temp_file = f"temp_{file.filename}"
    try:
        # Save temp file
        with open(temp_file, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
            
        # Extract data
        extractor = MedicalRecordExtractor()
        patient_data_dict = extractor.extract_patient_data(temp_file)
        
        # Predict
        result = model.predict(patient_data_dict)
        
        if "error" in result:
             raise Exception(result["error"])
        
        risk_level = "High" if result["prediction"] == 1 else "Low"
        
        return {
            "extracted_data": patient_data_dict,
            "risk_class": result["prediction"],
            "risk_level": risk_level,
            "probability": result["probability"],
            "contributors": result.get("contributors", [])
        }
        
    except Exception as e:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        # Ensure temp file is removed
        if os.path.exists(temp_file):
            os.remove(temp_file)

@app.get("/")
def read_root():
    return {"message": "CKD Risk Prediction API is running"}

@app.post("/predict")
def predict_risk(data: PatientData):
    try:
        input_data = data.dict()
        result = model.predict(input_data)
        
        if "error" in result:
             raise Exception(result["error"])
        
        risk_level = "High" if result["prediction"] == 1 else "Low"
        
        return {
            "risk_class": result["prediction"],
            "risk_level": risk_level,
            "probability": result["probability"],
            "contributors": result.get("contributors", [])
        }
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))
