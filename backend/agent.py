"""
NephroMind - Medical Record Extractor Agent
Uses Google Gemini AI to extract structured patient data from clinical PDF documents.
"""

import os
import json
import re
from typing import Dict, Any, Optional
import google.generativeai as genai
from google.generativeai.types import HarmCategory, HarmBlockThreshold

# Configuración de logging
import logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Configuración de seguridad permisiva para contenido médico
# Necesario para procesar historias clínicas sin bloqueos
SAFETY_SETTINGS = {
    HarmCategory.HARM_CATEGORY_HARASSMENT: HarmBlockThreshold.BLOCK_NONE,
    HarmCategory.HARM_CATEGORY_HATE_SPEECH: HarmBlockThreshold.BLOCK_NONE,
    HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT: HarmBlockThreshold.BLOCK_NONE,
    HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT: HarmBlockThreshold.BLOCK_NONE,
}


class MedicalRecordExtractor:
    """
    Extractor de datos médicos de historias clínicas en PDF usando Gemini AI.
    Optimizado para detección de factores de riesgo de Enfermedad Renal Crónica.
    """
    
    # Modelos de Gemini disponibles (en orden de preferencia)
    GEMINI_MODELS = ['gemini-2.5-flash']
    
    def __init__(self):
        """Inicializa el extractor con la API de Gemini."""
        self.model = None
        self.api_key = os.getenv("GEMINI_API_KEY")
        
        if self.api_key:
            genai.configure(api_key=self.api_key)
            self._initialize_model()
        else:
            logger.warning("GEMINI_API_KEY no encontrada. El extractor no funcionará.")
    
    def _initialize_model(self) -> None:
        """Intenta inicializar el modelo de Gemini."""
        for model_name in self.GEMINI_MODELS:
            try:
                self.model = genai.GenerativeModel(model_name)
                logger.info(f"Modelo Gemini inicializado: {model_name}")
                return
            except Exception as e:
                logger.warning(f"No se pudo inicializar {model_name}: {e}")
                continue
        
        logger.error("No se pudo inicializar ningún modelo de Gemini")
    
    def extract_patient_data(self, pdf_path: str) -> Dict[str, Any]:
        """
        Extrae datos estructurados del paciente desde un PDF de historia clínica.
        
        Args:
            pdf_path: Ruta al archivo PDF
            
        Returns:
            Diccionario con los datos del paciente extraídos
            
        Raises:
            Exception: Si no hay API key o falla la extracción
        """
        if not self.model:
            raise Exception("GEMINI_API_KEY no configurada. No se puede extraer datos sin IA.")

        try:
            logger.info(f"Procesando PDF: {pdf_path}")
            
            # Subir archivo a Gemini
            uploaded_file = genai.upload_file(pdf_path)
            logger.info(f"Archivo subido: {uploaded_file.name}")

            # Generar prompt optimizado para extracción médica
            prompt = self._build_extraction_prompt()
            
            # Configuración de generación para respuestas estructuradas
            generation_config = genai.GenerationConfig(
                temperature=0.1,  # Baja temperatura para respuestas más consistentes
                top_p=0.8,
                max_output_tokens=4096
            )
            
            # Llamar a Gemini con safety settings permisivos para contenido médico
            response = self.model.generate_content(
                [uploaded_file, prompt],
                generation_config=generation_config,
                safety_settings=SAFETY_SETTINGS
            )
            
            # Verificar si la respuesta fue bloqueada
            if not response.candidates:
                logger.error("Gemini no devolvió candidatos. Posible bloqueo de seguridad.")
                raise Exception("La respuesta de Gemini fue bloqueada. Intenta con otro PDF.")
            
            candidate = response.candidates[0]
            
            # Verificar finish_reason
            # 1=STOP (normal), 2=SAFETY, 3=RECITATION, 4=MAX_TOKENS
            if hasattr(candidate, 'finish_reason') and candidate.finish_reason == 2:
                logger.error(f"Respuesta bloqueada por filtro de seguridad")
                raise Exception("El contenido del PDF fue bloqueado por filtros de seguridad de Gemini.")
            
            # Obtener texto de manera segura
            if hasattr(response, 'text') and response.text:
                content = response.text
            elif candidate.content and candidate.content.parts:
                content = candidate.content.parts[0].text
            else:
                raise Exception("No se pudo extraer texto de la respuesta de Gemini.")
            logger.debug(f"Respuesta de Gemini: {content[:500]}...")
            
            # Extraer y parsear JSON
            extracted_data = self._parse_json_response(content)
            
            # Rellenar gaps clínicos
            extracted_data = self._fill_clinical_gaps(extracted_data)
            
            # Validar datos críticos
            self._validate_extracted_data(extracted_data)
            
            logger.info(f"Datos extraídos exitosamente para paciente de {extracted_data.get('Age', '?')} años")
            
            return extracted_data

        except Exception as e:
            logger.error(f"Error extrayendo datos del PDF: {e}")
            import traceback
            traceback.print_exc()
            raise Exception(f"Error al procesar el PDF: {str(e)}")
    
    def _build_extraction_prompt(self) -> str:
        """Construye el prompt optimizado para extracción de datos médicos."""
        return """
Eres un experto extractor de datos médicos y médico clínico. Tu objetivo es extraer datos estructurados del paciente del PDF de historia clínica proporcionado.

ACTÚA COMO MÉDICO: Si faltan valores, CALCÚLALOS usando los datos disponibles (ej: IMC desde altura/peso, eGFR desde creatinina/edad/género).

Devuelve ÚNICAMENTE un objeto JSON válido con esta estructura. NO incluyas formato markdown ni texto adicional.

{
    "Age": int,
    "Gender": int (0=Masculino, 1=Femenino),
    "Ethnicity": int (0=Caucásico, 1=Afroamericano, 2=Asiático, 3=Hispano, 4=Otro),
    "SocioeconomicStatus": int (0=Bajo, 1=Medio, 2=Alto),
    "EducationLevel": int (0=Ninguno, 1=Secundaria, 2=Universidad, 3=Posgrado),
    "BMI": float (CALCULAR si hay Peso/Altura. Si "Obesidad"->32. Si "Sobrepeso"->27. Default: 24),
    "Smoking": int (0=No, 1=Sí),
    "AlcoholConsumption": float (unidades/semana, 0-20),
    "PhysicalActivity": float (horas/semana, 0-10),
    "FamilyHistoryKidneyDisease": int (0=No, 1=Sí),
    "FamilyHistoryHypertension": int (0=No, 1=Sí),
    "FamilyHistoryDiabetes": int (0=No, 1=Sí),
    "PreviousAcuteKidneyInjury": int (0=No, 1=Sí),
    "UrinaryTractInfections": int (0=No, 1=Sí),
    "HistoryHTN": int (0=No, 1=Sí) - Hipertensión personal,
    "HistoryDiabetes": int (0=No, 1=Sí) - Diabetes personal,
    "HistoryCHD": int (0=No, 1=Sí) - Enfermedad coronaria,
    "HistoryVascular": int (0=No, 1=Sí) - Enfermedad vascular,
    "HistoryDLD": int (0=No, 1=Sí) - Dislipidemia,
    "HistoryObesity": int (0=No, 1=Sí),
    "SystolicBP": int (mmHg),
    "DiastolicBP": int (mmHg),
    "FastingBloodSugar": float (mg/dL),
    "HbA1c": float (%),
    "SerumCreatinine": float (mg/dL),
    "BUNLevels": float (mg/dL) - IMPORTANTE: usar BUNLevels, no BUN,
    "GFR": float (ml/min/1.73m² - CALCULAR con CKD-EPI si hay creatinina),
    "ProteinInUrine": float (g/L),
    "ACR": float (mg/g - Ratio Albúmina/Creatinina),
    "SerumElectrolytesSodium": float (mEq/L),
    "SerumElectrolytesPotassium": float (mEq/L),
    "SerumElectrolytesCalcium": float (mg/dL),
    "SerumElectrolytesPhosphorus": float (mg/dL),
    "HemoglobinLevels": float (g/dL),
    "CholesterolTotal": float (mg/dL),
    "CholesterolLDL": float (mg/dL),
    "CholesterolHDL": float (mg/dL),
    "CholesterolTriglycerides": float (mg/dL),
    "ACEInhibitors": int (0=No, 1=Sí) - Enalapril, Lisinopril, Ramipril, Losartán,
    "Diuretics": int (0=No, 1=Sí) - Furosemida, HCTZ,
    "NSAIDsUse": float (0-10 frecuencia) - Ibuprofeno, Naproxeno,
    "Statins": int (0=No, 1=Sí) - Atorvastatina, Simvastatina,
    "AntidiabeticMedications": int (0=No, 1=Sí) - Metformina, Insulina,
    "HTNmeds": int (0=No, 1=Sí) - Cualquier antihipertensivo,
    "Edema": int (0=No, 1=Sí),
    "FatigueLevels": int (0=No, 1=Sí) - IMPORTANTE: usar FatigueLevels, no Fatigue,
    "NauseaVomiting": int (0=No, 1=Sí),
    "MuscleCramps": int (0=No, 1=Sí),
    "Itching": float (0-10 intensidad),
    "HeavyMetalsExposure": int (0=No, 1=Sí),
    "OccupationalExposureChemicals": int (0=No, 1=Sí),
    "MedicalCheckupsFrequency": float (visitas/año),
    "MedicationAdherence": float (0-10),
    "HealthLiteracy": float (0-10)
}

REGLAS CRÍTICAS DE INFERENCIA:

1. **Género:** "Masculino/Hombre/Varón" → 0. "Femenino/Mujer" → 1.

2. **CÁLCULOS CLÍNICOS:**
   - **IMC:** Peso(kg) / Altura(m)². Si "Obesidad" → 32. Si "Sobrepeso" → 27. NUNCA devolver 0.
   - **eGFR (CKD-EPI 2021):** OBLIGATORIO calcular si hay creatinina.
   - **BUN:** Si solo hay Urea: BUN = Urea / 2.14

3. **Condiciones:**
   - "Diabetes", "DM2", "Diabético" → HistoryDiabetes=1
   - "HTA", "Hipertensión" → HistoryHTN=1
   - "Dislipemia", "Colesterol alto" → HistoryDLD=1
   - "Cansancio", "Fatiga", "Astenia" → FatigueLevels=1

4. **Medicamentos (inferir uso):**
   - Enalapril, Lisinopril, Ramipril, Losartán → ACEInhibitors=1
   - Atorvastatina, Simvastatina → Statins=1
   - Furosemida, HCTZ → Diuretics=1
   - Metformina, Insulina → AntidiabeticMedications=1

5. **Valores por defecto si no hay datos:**
   - TA: Si "normotenso" → 120/80. Si HTA mal controlada → 145/90
   - Electrolitos: Sodio=140, Potasio=4.5, Calcio=9.5, Fósforo=3.5
   - Hemoglobina: 14 (normal), 11 si hay ERC avanzada

6. **Análisis de narrativa compleja:**
   - Lee TODO el documento. El diagnóstico final puede estar en "Juicio diagnóstico"
   - "Trasplante renal/Diálisis" → PreviousAcuteKidneyInjury=1
   - "Enfermedad de Fabry", errores metabólicos → Sospechar daño renal
   - Múltiples comorbilidades → Marcar TODAS

La historia clínica está en ESPAÑOL. Traduce términos médicos correctamente.

EXTRAE TODO. SÉ UN DETECTIVE CLÍNICO. NO INVENTES DATOS QUE NO EXISTAN.
"""
    
    def _parse_json_response(self, content: str) -> Dict[str, Any]:
        """
        Extrae y parsea el JSON de la respuesta de Gemini.
        
        Args:
            content: Texto de respuesta de Gemini
            
        Returns:
            Diccionario parseado
        """
        # Intentar encontrar JSON en la respuesta
        json_match = re.search(r'\{[\s\S]*\}', content)
        
        if not json_match:
            raise Exception("No se encontró estructura JSON en la respuesta de Gemini")
        
        json_str = json_match.group(0)
        
        # Limpiar posibles problemas comunes
        json_str = re.sub(r',\s*}', '}', json_str)  # Trailing commas
        json_str = re.sub(r',\s*]', ']', json_str)  # Trailing commas en arrays
        
        try:
            return json.loads(json_str)
        except json.JSONDecodeError as e:
            logger.error(f"Error parseando JSON: {e}")
            logger.error(f"JSON problemático: {json_str[:200]}...")
            raise Exception(f"Error parseando JSON de Gemini: {e}")
    
    def _fill_clinical_gaps(self, data: Dict[str, Any]) -> Dict[str, Any]:
        """
        Rellena valores faltantes usando lógica clínica.
        Crítico para PDFs con información incompleta.
        """
        # ============================================
        # IMC - Nunca debe ser 0
        # ============================================
        if not data.get('BMI') or data.get('BMI', 0) == 0:
            if data.get('HistoryObesity') == 1:
                data['BMI'] = 32.0
            elif 'obesidad' in str(data).lower():
                data['BMI'] = 32.0
            elif 'sobrepeso' in str(data).lower():
                data['BMI'] = 27.0
            else:
                data['BMI'] = 24.0
        
        # ============================================
        # Inferir condiciones desde labs/medicamentos
        # ============================================
        
        # Diabetes desde HbA1c o medicamentos
        if data.get('HbA1c', 0) > 6.5 or data.get('AntidiabeticMedications') == 1:
            data['HistoryDiabetes'] = 1
        
        # HTA desde TA o medicamentos
        if (data.get('SystolicBP', 0) > 140 or 
            data.get('DiastolicBP', 0) > 90 or
            data.get('ACEInhibitors') == 1 or 
            data.get('Diuretics') == 1 or 
            data.get('HTNmeds') == 1):
            data['HistoryHTN'] = 1
        
        # Obesidad desde IMC
        if data.get('BMI', 0) > 30:
            data['HistoryObesity'] = 1
        
        # Dislipidemia desde estatinas
        if data.get('Statins') == 1:
            data['HistoryDLD'] = 1
        
        # ============================================
        # Valores por defecto para electrolitos
        # ============================================
        defaults = {
            'SerumElectrolytesSodium': 140.0,
            'SerumElectrolytesPotassium': 4.5,
            'SerumElectrolytesCalcium': 9.5,
            'SerumElectrolytesPhosphorus': 3.5,
            'CholesterolTotal': 200.0,
            'CholesterolLDL': 100.0,
            'CholesterolHDL': 50.0,
            'CholesterolTriglycerides': 150.0,
            'MedicationAdherence': 5.0,
            'HealthLiteracy': 5.0,
            'MedicalCheckupsFrequency': 1.0,
        }
        
        for field, default_value in defaults.items():
            if not data.get(field) or data.get(field, 0) == 0:
                data[field] = default_value
        
        # ============================================
        # Hemoglobina (ajustar si hay ERC)
        # ============================================
        if not data.get('HemoglobinLevels') or data.get('HemoglobinLevels', 0) == 0:
            if data.get('SerumCreatinine', 0) > 2.0 or data.get('GFR', 100) < 45:
                data['HemoglobinLevels'] = 11.0  # Anemia en ERC
            else:
                data['HemoglobinLevels'] = 14.0
        
        # ============================================
        # Tensión arterial por defecto
        # ============================================
        if not data.get('SystolicBP') or data.get('SystolicBP', 0) == 0:
            if data.get('HistoryHTN') == 1:
                data['SystolicBP'] = 140
                data['DiastolicBP'] = 85
            else:
                data['SystolicBP'] = 120
                data['DiastolicBP'] = 80
        
        # ============================================
        # Control glucémico
        # ============================================
        if not data.get('FastingBloodSugar') or data.get('FastingBloodSugar', 0) == 0:
            if data.get('HistoryDiabetes') == 1:
                data['FastingBloodSugar'] = 130.0
                if not data.get('HbA1c') or data.get('HbA1c', 0) == 0:
                    data['HbA1c'] = 7.5
            else:
                data['FastingBloodSugar'] = 90.0
                if not data.get('HbA1c') or data.get('HbA1c', 0) == 0:
                    data['HbA1c'] = 5.5
        
        # ============================================
        # Colesterol ajustado a dislipidemia
        # ============================================
        if data.get('HistoryDLD') == 1:
            if data.get('CholesterolTotal', 0) < 200:
                data['CholesterolTotal'] = 240
            if data.get('CholesterolLDL', 0) < 100:
                data['CholesterolLDL'] = 130
        
        # ============================================
        # Mapeo de nombres alternativos
        # ============================================
        
        # BUN -> BUNLevels (el modelo espera BUNLevels)
        if 'BUN' in data and 'BUNLevels' not in data:
            data['BUNLevels'] = data.pop('BUN')
        elif 'BUNLevels' not in data:
            data['BUNLevels'] = 15.0
        
        # Fatigue -> FatigueLevels (el modelo espera FatigueLevels)
        if 'Fatigue' in data and 'FatigueLevels' not in data:
            data['FatigueLevels'] = data.pop('Fatigue')
        elif 'FatigueLevels' not in data:
            data['FatigueLevels'] = 0
        
        logger.info(f"Gap-fill completado. IMC={data.get('BMI')}, "
                   f"Diabetes={data.get('HistoryDiabetes')}, HTA={data.get('HistoryHTN')}")
        
        return data
    
    def _validate_extracted_data(self, data: Dict[str, Any]) -> None:
        """
        Valida que los datos extraídos tengan valores razonables.
        Registra advertencias para valores fuera de rango.
        """
        validations = {
            'Age': (0, 120, "Edad"),
            'BMI': (10, 60, "IMC"),
            'SystolicBP': (60, 250, "TA Sistólica"),
            'DiastolicBP': (40, 150, "TA Diastólica"),
            'SerumCreatinine': (0.1, 20, "Creatinina"),
            'GFR': (1, 150, "eGFR"),
            'HbA1c': (3, 15, "HbA1c"),
        }
        
        for field, (min_val, max_val, name) in validations.items():
            value = data.get(field)
            if value is not None and value != 0:
                if value < min_val or value > max_val:
                    logger.warning(f"Valor fuera de rango para {name}: {value} "
                                 f"(esperado {min_val}-{max_val})")
    
    def calculate_egfr_ckdepi(self, creatinine: float, age: int, gender: int) -> float:
        """
        Calcula eGFR usando la fórmula CKD-EPI 2021 (sin raza).
        
        Args:
            creatinine: Creatinina sérica en mg/dL
            age: Edad en años
            gender: 0=Masculino, 1=Femenino
            
        Returns:
            eGFR en ml/min/1.73m²
        """
        if not creatinine or creatinine <= 0:
            return 90.0  # Valor normal por defecto
        
        kappa = 0.7 if gender == 1 else 0.9
        alpha = -0.241 if gender == 1 else -0.302
        
        min_ratio = min(creatinine / kappa, 1.0)
        max_ratio = max(creatinine / kappa, 1.0)
        
        egfr = 142 * (min_ratio ** alpha) * (max_ratio ** -1.200) * (0.9938 ** age)
        
        if gender == 1:  # Femenino
            egfr *= 1.012
        
        return round(egfr, 1)


# Para testing directo
if __name__ == "__main__":
    import sys
    
    if len(sys.argv) < 2:
        print("Uso: python agent.py <ruta_pdf>")
        sys.exit(1)
    
    extractor = MedicalRecordExtractor()
    try:
        data = extractor.extract_patient_data(sys.argv[1])
        print(json.dumps(data, indent=2, ensure_ascii=False))
    except Exception as e:
        print(f"Error: {e}")
        sys.exit(1)
