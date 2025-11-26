import pandas as pd
import numpy as np
from sklearn.model_selection import train_test_split
from sklearn.ensemble import RandomForestClassifier
from sklearn.preprocessing import StandardScaler
from imblearn.over_sampling import SMOTE
import os
import joblib

class KidneyDiseaseModel:
    def __init__(self):
        self.model = None
        self.scaler = None
        self.columns = None
        # Rutas relativas a la raíz del proyecto
        current_dir = os.path.dirname(os.path.abspath(__file__))
        project_root = os.path.dirname(current_dir)  # Subir un nivel desde backend/
        self.model_path = os.path.join(project_root, "ckd_model.pkl")
        self.scaler_path = os.path.join(project_root, "ckd_scaler.pkl")
        self.columns_path = os.path.join(project_root, "ckd_columns.pkl")

    def load_data(self, filepath):
        df = pd.read_csv(filepath)
        # Drop irrelevant columns as per medical feedback
        columns_to_drop = [
            'PatientID', 'DoctorInCharge', 
            'DietQuality', 'SleepQuality', 
            'WaterQuality', 'QualityOfLifeScore'
        ]
        
        # Drop only those that exist in the dataframe
        existing_cols_to_drop = [col for col in columns_to_drop if col in df.columns]
        df = df.drop(columns=existing_cols_to_drop)
        
        return df

    def train(self, data_path):
        print("Loading data...")
        df = self.load_data(data_path)
        
        X = df.drop('Diagnosis', axis=1)
        y = df['Diagnosis']
        
        self.columns = X.columns.tolist()
        
        # Split data
        X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42, stratify=y)
        
        # Apply SMOTE to Train data only
        print("Applying SMOTE...")
        smote = SMOTE(random_state=42, k_neighbors=5)
        X_train_res, y_train_res = smote.fit_resample(X_train, y_train)
        
        # Scaling
        print("Scaling data...")
        self.scaler = StandardScaler()
        X_train_scaled = self.scaler.fit_transform(X_train_res)
        X_test_scaled = self.scaler.transform(X_test)
        
        # Train Model
        print("Training Random Forest...")
        self.model = RandomForestClassifier(
            n_estimators=200,
            max_depth=None,
            min_samples_split=5,
            random_state=42,
            n_jobs=-1
        )
        self.model.fit(X_train_scaled, y_train_res)
        print("Training complete.")
        
        # Evaluation
        from sklearn.metrics import classification_report, accuracy_score
        print("\n--- Model Evaluation (Test Set) ---")
        y_pred = self.model.predict(X_test_scaled)
        print(f"Accuracy: {accuracy_score(y_test, y_pred):.4f}")
        print("Classification Report:")
        print(classification_report(y_test, y_pred))
        print("-----------------------------------\n")
        
        self.save_model()

    def save_model(self):
        joblib.dump(self.model, self.model_path)
        joblib.dump(self.scaler, self.scaler_path)
        joblib.dump(self.columns, self.columns_path)
        print("Model artifacts saved.")

    def load_model(self):
        if os.path.exists(self.model_path) and os.path.exists(self.scaler_path):
            self.model = joblib.load(self.model_path)
            self.scaler = joblib.load(self.scaler_path)
            self.columns = joblib.load(self.columns_path)
            return True
        return False

    def predict(self, input_data):
        # input_data should be a dictionary or dataframe
        if self.model is None:
            raise Exception("Model not trained or loaded")
            
        input_df = pd.DataFrame([input_data])
        
        # Ensure columns match
        # Fill missing columns with 0 or handle appropriately (for now assume complete input)
        for col in self.columns:
            if col not in input_df.columns:
                input_df[col] = 0 # Or raise error
        
        input_df = input_df[self.columns]
        
        input_scaled = self.scaler.transform(input_df)
        prediction = self.model.predict(input_scaled)
        probability = self.model.predict_proba(input_scaled)
        
        return {
            "prediction": int(prediction[0]),
            "probability": float(probability[0][1]) # Probability of class 1 (CKD)
        }

if __name__ == "__main__":
    # For testing/initial training
    model = KidneyDiseaseModel()
    # Determine data path relative to this script
    current_dir = os.path.dirname(os.path.abspath(__file__))
    # Check if we are in backend dir or root
    # If in backend, data is in ../archive
    # If in root, data is in archive
    
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
        print(f"Found data at: {data_path}")
        model.train(data_path)
    else:
        print(f"Data file not found. Checked: {possible_paths}")
