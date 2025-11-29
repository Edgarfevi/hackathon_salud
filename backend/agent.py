import os
import json
import fitz  # PyMuPDF
import google.generativeai as genai
from typing import Dict, Any

class MedicalRecordExtractor:
    def __init__(self):
        # Initialize Gemini
        api_key = os.getenv("GEMINI_API_KEY")
        if api_key:
            genai.configure(api_key=api_key)
            self.model = genai.GenerativeModel('gemini-2.5-flash')
        else:
            self.model = None

    def extract_patient_data(self, pdf_path: str) -> Dict[str, Any]:
        """
        Uses Gemini 1.5 Flash to process the PDF directly (Multimodal).
        Returns a dictionary matching the PatientData model.
        """
        if not self.model:
            print("Warning: GEMINI_API_KEY not found. Returning mock data.")
            return self._get_mock_data()

        try:
            # Upload the file to Gemini
            print(f"DEBUG: Uploading PDF {pdf_path} to Gemini...")
            myfile = genai.upload_file(pdf_path)
            print(f"DEBUG: File uploaded: {myfile.name}")

            prompt = """
            You are a medical assistant. Extract the following patient data from the PDF document provided.
            Return ONLY a valid JSON object matching this structure (use reasonable defaults or 0 if not found, but try to infer from context).
            Do not include markdown formatting like ```json ... ```. Just the raw JSON.
            
            {
                "Age": int,
                "Gender": int (0=Male, 1=Female),
                "Ethnicity": int (0=Caucasian, 1=African American, 2=Asian, 3=Hispanic, 4=Other),
                "SocioeconomicStatus": int (0=Low, 1=Middle, 2=High),
                "EducationLevel": int (0=None, 1=HighSchool, 2=Bachelor, 3=Higher),
                "BMI": float,
                "Smoking": int (0=No, 1=Yes),
                "AlcoholConsumption": float (0-20),
                "PhysicalActivity": float (0-10),
                "FamilyHistoryKidneyDisease": int (0=No, 1=Yes),
                "FamilyHistoryHypertension": int (0=No, 1=Yes),
                "FamilyHistoryDiabetes": int (0=No, 1=Yes),
                "PreviousAcuteKidneyInjury": int (0=No, 1=Yes),
                "UrinaryTractInfections": int (0=No, 1=Yes),
                "HistoryHTN": int (0=No, 1=Yes) (Personal History of Hypertension),
                "HistoryDiabetes": int (0=No, 1=Yes) (Personal History of Diabetes),
                "HistoryCHD": int (0=No, 1=Yes) (Personal History of Coronary Heart Disease),
                "SystolicBP": int,
                "DiastolicBP": int,
                "FastingBloodSugar": float,
                "HbA1c": float,
                "SerumCreatinine": float,
                "BUN": float,
                "GFR": float,
                "ProteinInUrine": float,
                "ACR": float,
                "SerumElectrolytesSodium": float,
                "SerumElectrolytesPotassium": float,
                "SerumElectrolytesCalcium": float,
                "SerumElectrolytesPhosphorus": float,
                "HemoglobinLevels": float,
                "CholesterolTotal": float,
                "CholesterolLDL": float,
                "CholesterolHDL": float,
                "CholesterolTriglycerides": float,
                "ACEInhibitors": int (0=No, 1=Yes),
                "Diuretics": int (0=No, 1=Yes),
                "NSAIDsUse": float (0-10),
                "Statins": int (0=No, 1=Yes),
                "AntidiabeticMedications": int (0=No, 1=Yes),
                "Edema": int (0=No, 1=Yes),
                "Fatigue": int (0=No, 1=Yes),
                "NauseaVomiting": int (0=No, 1=Yes),
                "MuscleCramps": int (0=No, 1=Yes),
                "Itching": float (0-10),
                "HeavyMetalsExposure": int (0=No, 1=Yes),
                "OccupationalExposureChemicals": int (0=No, 1=Yes),
                "MedicalCheckupsFrequency": float (0-4),
                "MedicationAdherence": float (0-10),
                "HealthLiteracy": float (0-10)
            }

            IMPORTANT INSTRUCTIONS FOR INFERENCE AND CALCULATION:
            You MUST infer missing numerical data from qualitative descriptions using these rules:

            1. **BMI (Body Mass Index):**
               - If text says "Obesidad", "Obesidad troncular", or "Obese", and no weight/height is given, ESTIMATE BMI = 32.0.
               - If "Sobrepeso" (Overweight), ESTIMATE BMI = 27.0.
               - If "Normopeso" (Normal weight), ESTIMATE BMI = 22.0.

            2. **Blood Pressure (BP):**
               - If "Hipertensión" (HTA) or "High Blood Pressure" is mentioned, but no numbers are given:
                 - If "control deficiente" or "mal control", ESTIMATE SystolicBP = 150, DiastolicBP = 95.
                 - If "buen control" or "controlled", ESTIMATE SystolicBP = 130, DiastolicBP = 85.
                 - Default (if unspecified status): ESTIMATE SystolicBP = 145, DiastolicBP = 90.

            3. **Lab Conversions (CALCULATE THESE):**
               - **BUN:** If "Urea" is given (mg/dL) but BUN is missing, CALCULATE: BUN = Urea / 2.14.
               - **HbA1c:** If only "Glucose" (Glucosa) is given, estimate HbA1c: HbA1c = (Glucose + 46.7) / 28.7 (approx).
               - **LDL/HDL:** If only Total Cholesterol is given, estimate LDL = Total * 0.65, HDL = Total * 0.20 (rough estimate if missing).

            4. **History & Lifestyle:**
               - **Diabetes:** If "No Diabetes" -> HistoryDiabetes=0. If "Diabetes" or "Diabetic" -> HistoryDiabetes=1.
               - **Smoking:** If "Ex-fumador" (Ex-smoker) -> Smoking=0 (or 1 if recent). If "Fumador" -> Smoking=1.
               - **Physical Activity:** 
                 - "Vida activa" / "Active life" -> 7.0
                 - "Sedentario" / "Sedentary" -> 1.0
                 - "Moderate" -> 4.0

            5. **Medications & Symptoms (Infer from context):**
               - **NSAIDs (AINEs):** If "AINEs", "Ibuprofeno", "Naproxeno", "Diclofenaco" mentioned -> NSAIDsUse = 1 (or higher if chronic).
               - **Edema:** If "Edema", "Hinchazón", "Fovea" mentioned -> Edema = 1. If "Sin edemas" -> Edema = 0.
               - **Fatigue:** If "Fatiga", "Cansancio", "Debilidad", "Asthenia" -> Fatigue = 1.
               - **Itching:** If "Picor", "Prurito", "Rascado" -> Itching = 1.
               - **Muscle Cramps:** If "Calambres" -> MuscleCramps = 1.
               - **ACE Inhibitors:** If "IECA", "Enalapril", "Lisinopril", "Ramipril" -> ACEInhibitors = 1.

            6. **Specific Lab Mappings:**
               - **ProteinInUrine:** Look for "Proteínas en orina", "Proteinuria", or "Proteínas" in urine section.
               - **ACR:** Look for "Microalbuminuria", "Cociente Albúmina/Creatinina".
               - **Hemoglobin:** Look for "Hb", "Hemoglobina".

            7. **Defaults for Missing Vitals (Only if NO text clue exists):**
               - Temperature: 36.5
               - Heart Rate: 75
               
            EXTRACT AS MUCH AS POSSIBLE. DO NOT RETURN 0 IF YOU CAN INFER A PLAUSIBLE VALUE FROM CONTEXT.
            """

            response = self.model.generate_content([myfile, prompt])
            content = response.text
            print(f"DEBUG: Gemini Raw Response: {content}")
            
            # Clean up potential markdown formatting
            if "```json" in content:
                content = content.split("```json")[1].split("```")[0]
            elif "```" in content:
                content = content.split("```")[1].split("```")[0]
                
            return json.loads(content.strip())
        except Exception as e:
            print(f"Error calling Gemini: {e}")
            import traceback
            traceback.print_exc()
            return self._get_mock_data()

    def _get_mock_data(self) -> Dict[str, Any]:
        """Returns mock data if AI fails or key is missing."""
        return {
            "Age": 65,
            "Gender": 0,
            "Ethnicity": 0,
            "SocioeconomicStatus": 1,
            "EducationLevel": 1,
            "BMI": 28.5,
            "Smoking": 0,
            "AlcoholConsumption": 2.0,
            "PhysicalActivity": 3.0,
            "FamilyHistoryKidneyDisease": 0,
            "FamilyHistoryHypertension": 1,
            "FamilyHistoryDiabetes": 1,
            "PreviousAcuteKidneyInjury": 0,
            "UrinaryTractInfections": 0,
            "SystolicBP": 140,
            "DiastolicBP": 90,
            "FastingBloodSugar": 130,
            "HbA1c": 7.2,
            "SerumCreatinine": 1.4,
            "BUN": 25,
            "GFR": 55,
            "ProteinInUrine": 0.5,
            "ACR": 40,
            "SerumElectrolytesSodium": 138,
            "SerumElectrolytesPotassium": 4.8,
            "SerumElectrolytesCalcium": 9.2,
            "SerumElectrolytesPhosphorus": 3.9,
            "HemoglobinLevels": 12.5,
            "CholesterolTotal": 210,
            "CholesterolLDL": 130,
            "CholesterolHDL": 45,
            "CholesterolTriglycerides": 160,
            "ACEInhibitors": 1,
            "Diuretics": 0,
            "NSAIDsUse": 1.0,
            "Statins": 1,
            "AntidiabeticMedications": 1,
            "Edema": 1,
            "Fatigue": 1,
            "NauseaVomiting": 0,
            "MuscleCramps": 0,
            "Itching": 2.0,
            "HeavyMetalsExposure": 0,
            "OccupationalExposureChemicals": 0,
            "MedicalCheckupsFrequency": 2.0,
            "MedicationAdherence": 8.0,
            "HealthLiteracy": 5.0
        }
