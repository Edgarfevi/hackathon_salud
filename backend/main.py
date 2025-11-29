from fastapi import FastAPI, HTTPException, UploadFile, File
from pydantic import BaseModel
from fastapi.middleware.cors import CORSMiddleware
import shutil
import os
import json
import traceback

# Importaciones limpias (Docker WORKDIR es /app, así que esto funciona directo)
from model import KidneyDiseaseModel
from agent import MedicalRecordExtractor

app = FastAPI(title="NephroMind API")

# Configurar CORS (Permitir todo para el hackathon es OK)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Inicializar modelo al arrancar
model = KidneyDiseaseModel()
# Ruta absoluta dentro del contenedor Docker
DATA_PATH = "/app/archive/kidney_data.csv" 

@app.on_event("startup")
async def startup_event():
    if os.path.exists(DATA_PATH):
        print(f"Entrenando modelo con datos en: {DATA_PATH}")
        model.train(DATA_PATH)
    elif os.path.exists("kidney_model.pkl"):
        print("Cargando modelo pre-entrenado...")
        model.load_model()
    else:
        print("ADVERTENCIA: No se encontró dataset ni modelo guardado.")

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
        # Guardar archivo temporal
        with open(temp_file, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
            
        # 1. Extracción con IA (Gemini)
        extractor = MedicalRecordExtractor()
        patient_data_dict = extractor.extract_patient_data(temp_file)
        
        # 1. Extracción con IA (Gemini)
        extractor = MedicalRecordExtractor()
        patient_data_dict = extractor.extract_patient_data(temp_file)
        
        # Return only extracted data for the frontend to populate the form
        return {
            "extracted_data": patient_data_dict
        }
        
    except Exception as e:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        # Limpieza segura
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
        
        risk_level = "Alto" if result["prediction"] == 1 else "Bajo"
        
        return {
            "risk_class": int(result["prediction"]),
            "risk_level": risk_level,
            "probability": float(result["probability"]),
            "contributors": result.get("contributors", [])
        }
    except Exception as e:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))
