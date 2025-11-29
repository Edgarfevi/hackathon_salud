"""
NephroMind API - Sistema de Detección Temprana de ERC
FastAPI backend para predicción de riesgo de Enfermedad Renal Crónica.
"""

import os
import shutil
import logging
import traceback
from typing import Optional, Dict, Any

from fastapi import FastAPI, HTTPException, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from model import KidneyDiseaseModel
from agent import MedicalRecordExtractor

# Configuración de logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# ============================================
# CONFIGURACIÓN DE LA APP
# ============================================

app = FastAPI(
    title="NephroMind API",
    description="Sistema de detección temprana de Enfermedad Renal Crónica mediante IA",
    version="2.0.0",
    docs_url="/docs",
    redoc_url="/redoc"
)

# CORS - Permitir todo para el hackathon
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ============================================
# MODELO GLOBAL
# ============================================

model = KidneyDiseaseModel()

# Rutas de datos (Docker y local)
DATA_PATHS = [
    "/app/archive/kidney_data.csv",  # Docker
    "archive/kidney_data.csv",        # Local
    "backend/archive/kidney_data.csv" # Desde raíz
]


# ============================================
# EVENTOS DE STARTUP
# ============================================

@app.on_event("startup")
async def startup_event():
    """Carga o entrena el modelo al iniciar."""
    logger.info("=" * 50)
    logger.info("INICIANDO NEPHROMIND API")
    logger.info("=" * 50)
    
    # Intentar cargar modelo guardado primero
    if model.load_model():
        logger.info("✓ Modelo cargado desde archivo")
        return
    
    # Si no hay modelo, intentar entrenar
    for data_path in DATA_PATHS:
        if os.path.exists(data_path):
            logger.info(f"Entrenando modelo con: {data_path}")
            try:
                model.train(data_path)
                logger.info("✓ Modelo entrenado exitosamente")
                return
            except Exception as e:
                logger.error(f"Error entrenando: {e}")
                continue
    
    logger.warning("⚠ No se encontró dataset ni modelo guardado")


# ============================================
# MODELOS PYDANTIC
# ============================================

class PatientData(BaseModel):
    """
    Datos del paciente para predicción de riesgo de ERC.
    Todos los campos tienen valores por defecto razonables.
    """
    
    # Demografía (Requeridos)
    Age: int = Field(..., ge=0, le=120, description="Edad en años")
    Gender: int = Field(..., ge=0, le=1, description="0=Masculino, 1=Femenino")
    
    # Demografía (Opcionales)
    Ethnicity: int = Field(default=3, ge=0, le=4, description="Etnia (3=Hispano)")
    SocioeconomicStatus: int = Field(default=1, ge=0, le=2)
    EducationLevel: int = Field(default=1, ge=0, le=3)
    
    # Estilo de vida (Requerido: BMI)
    BMI: float = Field(..., ge=10, le=60, description="Índice de Masa Corporal")
    Smoking: int = Field(default=0, ge=0, le=1)
    AlcoholConsumption: float = Field(default=0.0, ge=0)
    PhysicalActivity: float = Field(default=2.0, ge=0)
    
    # Historial Familiar
    FamilyHistoryKidneyDisease: int = Field(default=0, ge=0, le=1)
    FamilyHistoryHypertension: int = Field(default=0, ge=0, le=1)
    FamilyHistoryDiabetes: int = Field(default=0, ge=0, le=1)
    
    # Historial Personal
    HistoryDiabetes: int = Field(default=0, ge=0, le=1)
    HistoryCHD: int = Field(default=0, ge=0, le=1)
    HistoryVascular: int = Field(default=0, ge=0, le=1)
    HistoryHTN: int = Field(default=0, ge=0, le=1)
    HistoryDLD: int = Field(default=0, ge=0, le=1)
    HistoryObesity: int = Field(default=0, ge=0, le=1)
    PreviousAcuteKidneyInjury: int = Field(default=0, ge=0, le=1)
    UrinaryTractInfections: int = Field(default=0, ge=0, le=1)
    
    # Signos Vitales (Requeridos)
    SystolicBP: int = Field(..., ge=60, le=250, description="TA Sistólica mmHg")
    DiastolicBP: int = Field(..., ge=40, le=150, description="TA Diastólica mmHg")
    
    # Glucemia
    FastingBloodSugar: float = Field(default=90.0, ge=40, le=500)
    HbA1c: float = Field(default=5.5, ge=3, le=15)
    
    # Función Renal
    SerumCreatinine: float = Field(default=1.0, ge=0.1, le=20)
    BUN: float = Field(default=15.0, ge=1, le=150, description="También acepta BUNLevels")
    GFR: float = Field(default=90.0, ge=1, le=150, description="eGFR calculado")
    ProteinInUrine: float = Field(default=0.0, ge=0, le=100, description="g/L - Permite valores patológicos extremos")
    ACR: float = Field(default=15.0, ge=0, le=5000)
    
    # Electrolitos
    SerumElectrolytesSodium: float = Field(default=140.0)
    SerumElectrolytesPotassium: float = Field(default=4.5)
    SerumElectrolytesCalcium: float = Field(default=9.5)
    SerumElectrolytesPhosphorus: float = Field(default=3.5)
    
    # Hemograma
    HemoglobinLevels: float = Field(default=14.0)
    
    # Perfil Lipídico
    CholesterolTotal: float = Field(default=200.0)
    CholesterolLDL: float = Field(default=100.0)
    CholesterolHDL: float = Field(default=50.0)
    CholesterolTriglycerides: float = Field(default=150.0)
    
    # Medicación
    ACEInhibitors: int = Field(default=0, ge=0, le=1)
    Diuretics: int = Field(default=0, ge=0, le=1)
    HTNmeds: int = Field(default=0, ge=0, le=1)
    NSAIDsUse: float = Field(default=0.0, ge=0, le=10)
    Statins: int = Field(default=0, ge=0, le=1)
    AntidiabeticMedications: int = Field(default=0, ge=0, le=1)
    
    # Síntomas
    Edema: int = Field(default=0, ge=0, le=1)
    Fatigue: int = Field(default=0, ge=0, le=1, description="También acepta FatigueLevels")
    NauseaVomiting: int = Field(default=0, ge=0, le=1)
    MuscleCramps: int = Field(default=0, ge=0, le=1)
    Itching: float = Field(default=0.0, ge=0, le=10)
    
    # Exposiciones
    HeavyMetalsExposure: int = Field(default=0, ge=0, le=1)
    OccupationalExposureChemicals: int = Field(default=0, ge=0, le=1)
    
    # Adherencia
    MedicalCheckupsFrequency: float = Field(default=1.0, ge=0, le=12)
    MedicationAdherence: float = Field(default=5.0, ge=0, le=10)
    HealthLiteracy: float = Field(default=5.0, ge=0, le=10)
    
    class Config:
        schema_extra = {
            "example": {
                "Age": 61,
                "Gender": 1,
                "BMI": 27.5,
                "SystolicBP": 145,
                "DiastolicBP": 88,
                "HistoryHTN": 1,
                "Fatigue": 1,
                "SerumCreatinine": 1.4,
                "GFR": 42
            }
        }


class PredictionResponse(BaseModel):
    """Respuesta de la predicción."""
    risk_class: int
    risk_level: str
    probability: float
    contributors: list
    gfr_stage: str
    model_threshold: float


class PDFAnalysisResponse(BaseModel):
    """Respuesta del análisis de PDF."""
    status: str
    message: str
    extracted_data: Dict[str, Any]


# ============================================
# ENDPOINTS
# ============================================

@app.get("/", tags=["Info"])
def read_root():
    """Información del API."""
    return {
        "name": "NephroMind API",
        "description": "Sistema de Detección de ERC",
        "version": "2.0.0",
        "status": "running",
        "model_loaded": model.model is not None,
        "endpoints": {
            "POST /predict": "Predecir riesgo de ERC",
            "POST /analyze_pdf": "Analizar historia clínica PDF",
            "GET /health": "Estado del servicio"
        }
    }


@app.get("/health", tags=["Info"])
def health_check():
    """Health check para monitoreo."""
    return {
        "status": "healthy",
        "model_loaded": model.model is not None,
        "model_threshold": model.threshold if model.model else None
    }


@app.post("/predict", response_model=PredictionResponse, tags=["Prediction"])
def predict_risk(data: PatientData):
    """
    Predice el riesgo de Enfermedad Renal Crónica.
    
    Retorna:
    - risk_class: 0 (bajo) o 1 (alto)
    - probability: probabilidad de ERC (0-1)
    - contributors: factores principales (XAI con SHAP)
    - gfr_stage: clasificación KDIGO
    """
    try:
        input_data = data.dict()
        
        logger.info(f"Predicción para paciente: Edad={input_data.get('Age')}, "
                   f"Creatinina={input_data.get('SerumCreatinine')}, "
                   f"GFR={input_data.get('GFR')}")
        
        # Realizar predicción
        result = model.predict(input_data)
        
        if "error" in result:
            raise HTTPException(status_code=500, detail=result["error"])
        
        # Determinar nivel de riesgo
        risk_level = "Alto" if result["prediction"] == 1 else "Bajo"
        
        # Clasificación GFR según KDIGO
        gfr = input_data.get('GFR', 90)
        if gfr >= 90:
            gfr_stage = "G1"
        elif gfr >= 60:
            gfr_stage = "G2"
        elif gfr >= 45:
            gfr_stage = "G3a"
        elif gfr >= 30:
            gfr_stage = "G3b"
        elif gfr >= 15:
            gfr_stage = "G4"
        else:
            gfr_stage = "G5"
        
        return PredictionResponse(
            risk_class=result["prediction"],
            risk_level=risk_level,
            probability=result["probability"],
            contributors=result.get("contributors", []),
            gfr_stage=gfr_stage,
            model_threshold=model.threshold
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error en predicción: {e}")
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/analyze_pdf", response_model=PDFAnalysisResponse, tags=["PDF"])
async def analyze_pdf(file: UploadFile = File(...)):
    """
    Analiza un PDF de historia clínica usando IA (Gemini).
    
    Extrae automáticamente los datos del paciente para el formulario.
    """
    temp_file = f"temp_{file.filename}"
    
    try:
        # Validar tipo de archivo
        if not file.filename.lower().endswith('.pdf'):
            raise HTTPException(
                status_code=400, 
                detail="Solo se aceptan archivos PDF"
            )
        
        # Guardar archivo temporal
        with open(temp_file, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
        
        logger.info(f"Analizando PDF: {file.filename}")
        
        # Extraer datos con IA
        extractor = MedicalRecordExtractor()
        extracted_data = extractor.extract_patient_data(temp_file)
        
        logger.info(f"Datos extraídos exitosamente")
        
        return PDFAnalysisResponse(
            status="success",
            message="Datos extraídos correctamente del PDF",
            extracted_data=extracted_data
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error analizando PDF: {e}")
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))
        
    finally:
        # Limpiar archivo temporal
        if os.path.exists(temp_file):
            os.remove(temp_file)


# ============================================
# MAIN
# ============================================

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
