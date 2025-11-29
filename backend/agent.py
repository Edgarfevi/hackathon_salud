import os
import json
import re
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
        Uses Gemini 2.5 Flash to process the PDF directly (Multimodal).
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
            You are an expert medical data extractor and CLINICAL DOCTOR. Your goal is to extract structured patient data from the provided clinical history PDF.
            
            ACT AS A DOCTOR: If values are missing, CALCULATE them using available data (e.g., BMI from height/weight, eGFR from creatinine/age/gender).
            
            Return ONLY a valid JSON object matching this structure. Do not include markdown formatting.
            
            {
                "Age": int,
                "Gender": int (0=Male, 1=Female),
                "Ethnicity": int (0=Caucasian, 1=African American, 2=Asian, 3=Hispanic, 4=Other),
                "SocioeconomicStatus": int (0=Low, 1=Middle, 2=High) (Infer from occupation/address if possible, else 1),
                "EducationLevel": int (0=None, 1=HighSchool, 2=Bachelor, 3=Higher) (Infer from occupation if possible, else 1),
                "BMI": float (CALCULATE if Height/Weight available),
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
                "GFR": float (CALCULATE using CKD-EPI if Creatinine/Age/Gender available),
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

            CRITICAL INFERENCE & CALCULATION RULES:

            1. **Demographics:**
               - **Gender:** "Masculino/Hombre" -> 0. "Femenino/Mujer" -> 1.
               - **Ethnicity:** "Hispano/Latino" -> 3. "Blanco" -> 0. Default to 3 if context implies Hispanic.

            2. **CLINICAL CALCULATIONS (DO NOT RETURN 0 IF INPUTS EXIST):**
               - **BMI:** Weight(kg) / Height(m)^2. Example: 80kg, 1.80m -> 80 / 3.24 = 24.7.
               - **eGFR:** Use CKD-EPI formula. If Creatinine is found, YOU MUST CALCULATE eGFR.
               - **BUN:** If only Urea is given: BUN = Urea / 2.14.

            3. **Conditions (History):**
               - **Diabetes:** "Diabetes", "DM2", "Diabético" -> HistoryDiabetes=1.
               - **Hypertension:** "HTA", "Hipertensión" -> HistoryHTN=1.
               - **Dyslipidemia:** "Dislipemia", "Colesterol alto" -> HistoryDLD=1.
               - **Obesity:** "Obesidad" -> HistoryObesity=1. (Also check calculated BMI > 30).

            4. **Medications (Infer usage):**
               - **ACE Inhibitors:** Enalapril, Lisinopril, Ramipril -> ACEInhibitors=1.
               - **Statins:** Atorvastatina, Simvastatina -> Statins=1.
               - **Diuretics:** Furosemida, Hidroclorotiazida -> Diuretics=1.
               - **Antidiabetics:** Metformina, Insulina -> AntidiabeticMedications=1.

            5. **Labs & Vitals (Infer/Estimate):**
               - **BP:** If "Normotenso" -> 120/80. If "Hipertenso mal controlado" -> 150/95.
               - **HbA1c:** If missing but Glucose > 126 -> Estimate 7.5.
               - **Cholesterol:** If missing, estimate based on HistoryDLD (e.g., Total=240 if DLD=1).

            6. **Defaults (Use ONLY if absolutely no clue found):**
               - Age: 50, Gender: 0, Ethnicity: 3
               - BMI: 25.0, BP: 120/80, Glucose: 90
               - Creatinine: 1.0, GFR: 90
               
            EXTRACT EVERYTHING. BE A CLINICAL DETECTIVE.
            """

            response = self.model.generate_content([myfile, prompt])
            content = response.text
            print(f"DEBUG: Gemini Raw Response: {content}")
            
            # Robust JSON extraction using regex
            # Finds the first block starting with { and ending with }
            json_match = re.search(r'\{.*\}', content, re.DOTALL)
            
            if json_match:
                json_str = json_match.group(0)
                try:
                    return json.loads(json_str)
                except json.JSONDecodeError as je:
                    print(f"JSON Decode Error: {je}")
                    # Try to fix common issues (e.g., trailing commas)
                    # For now, just raise with a clear message
                    raise Exception(f"Failed to parse JSON from Gemini response. Raw: {json_str[:100]}...")
            else:
                raise Exception("No JSON structure found in Gemini response.")

        except Exception as e:
            print(f"Error calling Gemini: {e}")
            import traceback
            traceback.print_exc()
            raise Exception(f"Failed to extract data from PDF: {str(e)}")
