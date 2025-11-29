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
            raise Exception("GEMINI_API_KEY not found. Cannot extract data without AI.")

        try:
            # Upload the file to Gemini
            print(f"DEBUG: Uploading PDF {pdf_path} to Gemini...")
            myfile = genai.upload_file(pdf_path)
            print(f"DEBUG: File uploaded: {myfile.name}")

            prompt = """
            You are an expert medical data extractor. Your goal is to extract structured patient data from the provided clinical history PDF (which may be in Spanish or English).
            
            EXTRACT EVERY POSSIBLE FIELD. If a value is not explicitly stated, TRY TO INFER IT from context, medications, diagnoses, or notes.
            
            Return ONLY a valid JSON object matching this structure. Do not include markdown formatting.
            
            {
                "Age": int,
                "Gender": int (0=Male, 1=Female),
                "Ethnicity": int (0=Caucasian, 1=African American, 2=Asian, 3=Hispanic, 4=Other),
                "SocioeconomicStatus": int (0=Low, 1=Middle, 2=High) (Infer from occupation/address if possible, else 1),
                "EducationLevel": int (0=None, 1=HighSchool, 2=Bachelor, 3=Higher) (Infer from occupation if possible, else 1),
                "BMI": float,
                "Smoking": int (0=No, 1=Yes),
                "AlcoholConsumption": float (0-20 units/week),
                "PhysicalActivity": float (0-10 hours/week),
                "FamilyHistoryKidneyDisease": int (0=No, 1=Yes),
                "FamilyHistoryHypertension": int (0=No, 1=Yes),
                "FamilyHistoryDiabetes": int (0=No, 1=Yes),
                "PreviousAcuteKidneyInjury": int (0=No, 1=Yes),
                "UrinaryTractInfections": int (0=No, 1=Yes),
                "HistoryHTN": int (0=No, 1=Yes) (Personal History of Hypertension),
                "HistoryDiabetes": int (0=No, 1=Yes) (Personal History of Diabetes),
                "HistoryCHD": int (0=No, 1=Yes) (Coronary Heart Disease),
                "HistoryVascular": int (0=No, 1=Yes) (Vascular Disease),
                "HistoryDLD": int (0=No, 1=Yes) (Dyslipidemia/High Cholesterol),
                "HistoryObesity": int (0=No, 1=Yes),
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
                "NSAIDsUse": float (0-10 frequency),
                "Statins": int (0=No, 1=Yes),
                "AntidiabeticMedications": int (0=No, 1=Yes),
                "HTNmeds": int (0=No, 1=Yes) (Hypertension Meds),
                "Edema": int (0=No, 1=Yes),
                "Fatigue": int (0=No, 1=Yes),
                "NauseaVomiting": int (0=No, 1=Yes),
                "MuscleCramps": int (0=No, 1=Yes),
                "Itching": float (0-10 intensity),
                "HeavyMetalsExposure": int (0=No, 1=Yes),
                "OccupationalExposureChemicals": int (0=No, 1=Yes),
                "MedicalCheckupsFrequency": float (0-4 visits/year),
                "MedicationAdherence": float (0-10 scale),
                "HealthLiteracy": float (0-10 scale)
            }

            CRITICAL INFERENCE RULES (Apply these aggressively):

            1. **Demographics:**
               - **Gender:** Look for "Masculino", "Hombre", "Varón", "Male" -> 0. "Femenino", "Mujer", "Female" -> 1.
               - **Ethnicity:** If "Hispano", "Latino" -> 3. If "Blanco", "Caucásico" -> 0. Default to 3 if name/location implies Hispanic context.

            2. **BMI & Obesity:**
               - Calculate BMI if Weight (kg) and Height (m) are present: Weight / (Height^2).
               - If "Obesidad" or "Obesity" mentioned -> HistoryObesity=1. Estimate BMI=32.0 if missing.
               - If "Sobrepeso" or "Overweight" -> Estimate BMI=27.0.

            3. **Conditions (History):**
               - **Diabetes:** "Diabetes Mellitus", "DM2", "DM1", "Diabético" -> HistoryDiabetes=1.
               - **Hypertension:** "HTA", "Hipertensión", "High Blood Pressure" -> HistoryHTN=1.
               - **Dyslipidemia:** "Dislipemia", "Colesterol alto", "Hyperlipidemia" -> HistoryDLD=1.
               - **Vascular/Heart:** "Infarto", "Ictus", "ACV", "Angina", "Coronary" -> HistoryCHD=1 or HistoryVascular=1.

            4. **Medications (Infer usage):**
               - **ACE Inhibitors:** Enalapril, Lisinopril, Ramipril, Perindopril -> ACEInhibitors=1.
               - **Statins:** Atorvastatina, Simvastatina, Rosuvastatina -> Statins=1.
               - **Diuretics:** Furosemida, Hidroclorotiazida, Espironolactona -> Diuretics=1.
               - **Antidiabetics:** Metformina, Insulina, Sitagliptina, Empagliflozina -> AntidiabeticMedications=1.
               - **HTN Meds:** Any of the above BP meds or Amlodipino, Losartan, Valsartan -> HTNmeds=1.

            5. **Labs & Vitals (Infer/Estimate):**
               - **BP:** If "Normotenso" -> 120/80. If "Hipertenso mal controlado" -> 150/95.
               - **BUN:** If only Urea is given: BUN = Urea / 2.14.
               - **HbA1c:** If missing but Glucose > 126 (Diabetic) -> Estimate 7.5. If Glucose < 100 -> Estimate 5.0.
               - **Cholesterol:** If missing, estimate based on HistoryDLD (e.g., Total=240 if DLD=1, else 190).

            6. **Symptoms:**
               - Look for "Edemas", "Hinchazón" -> Edema=1.
               - "Cansancio", "Fatiga", "Asthenia" -> Fatigue=1.
               - "Prurito", "Picor" -> Itching=5.0.

            7. **Defaults (Use ONLY if absolutely no clue found):**
               - Age: 50
               - Gender: 0
               - Ethnicity: 3
               - BMI: 25.0
               - BP: 120/80
               - Glucose: 90
               - Creatinine: 1.0
               - GFR: 90
               
            EXTRACT EVERYTHING YOU CAN. BE A DETECTIVE.
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
            # Re-raise the exception to let the user know extraction failed
            raise Exception(f"Failed to extract data from PDF: {str(e)}")
