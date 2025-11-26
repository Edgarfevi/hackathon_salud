import pandas as pd
import numpy as np
from sklearn.metrics import classification_report, confusion_matrix, accuracy_score, roc_auc_score
from sklearn.model_selection import train_test_split
from model import KidneyDiseaseModel
import os

def verify_model():
    print("--- Final Model Verification ---")
    
    # 1. Initialize and Load Model
    model_wrapper = KidneyDiseaseModel()
    if not model_wrapper.load_model():
        print("Error: Could not load model.")
        return

    # 2. Load Data
    # Path inside Docker container
    data_path = "archive/Chronic_Kidney_Dsease_data.csv"
    if not os.path.exists(data_path):
        print(f"Error: Data file not found at {data_path}")
        # Try absolute path just in case
        data_path = "/app/archive/Chronic_Kidney_Dsease_data.csv"
        if not os.path.exists(data_path):
             print(f"Error: Data file not found at {data_path} either.")
             return

    print(f"Loading data from: {data_path}")
    df = pd.read_csv(data_path)

    # 3. Preprocessing (Same as training)
    # Drop columns
    columns_to_drop = ['PatientID', 'DoctorInCharge', 'DietQuality', 'SleepQuality', 'WaterQuality', 'QualityOfLifeScore']
    existing_cols_to_drop = [col for col in columns_to_drop if col in df.columns]
    df = df.drop(columns=existing_cols_to_drop)

    X = df.drop('Diagnosis', axis=1)
    y = df['Diagnosis']

    # Split
    X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42, stratify=y)
    
    print(f"Test Set Size: {len(X_test)}")

    # 4. Evaluation
    print("\nRunning predictions on Test Set...")
    
    # We need to predict row by row or adapt predict method? 
    # The model.predict method expects a dictionary or single row DF usually, 
    # but let's see if we can use the internal model directly for batch evaluation 
    # to be 100% sure we are testing the exact pipeline.
    
    # Actually, model.predict does scaling and SHAP. 
    # Let's use the internal model logic manually to ensure we replicate the exact pipeline 
    # OR loop through X_test (slower but uses exact code).
    # Let's use the internal components for batch processing as it's standard for metrics.
    
    # Filter/Rename columns as done in model.py fix
    rename_map = {
        "BUN": "BUNLevels",
        "Fatigue": "FatigueLevels"
    }
    X_test = X_test.rename(columns=rename_map)
    
    # Ensure columns match scaler
    if hasattr(model_wrapper.scaler, "feature_names_in_"):
        expected_cols = model_wrapper.scaler.feature_names_in_
        for col in expected_cols:
            if col not in X_test.columns:
                X_test[col] = 0
        X_test = X_test[expected_cols]
        
    # Scale
    X_test_scaled = model_wrapper.scaler.transform(X_test)
    X_test_scaled_df = pd.DataFrame(X_test_scaled, columns=X_test.columns)
    
    # Select features
    X_test_selected = X_test_scaled_df[model_wrapper.columns]
    
    # Predict
    y_proba = model_wrapper.model.predict_proba(X_test_selected)[:, 1]
    y_pred = (y_proba >= model_wrapper.threshold).astype(int)
    
    # 5. Metrics
    acc = accuracy_score(y_test, y_pred)
    roc = roc_auc_score(y_test, y_proba)
    cm = confusion_matrix(y_test, y_pred)
    
    print(f"\nAccuracy: {acc:.4f}")
    print(f"ROC AUC: {roc:.4f}")
    print("\nConfusion Matrix:")
    print(cm)
    print("\nClassification Report:")
    print(classification_report(y_test, y_pred))
    
    tn, fp, fn, tp = cm.ravel()
    sensitivity = tp / (tp + fn)
    specificity = tn / (tn + fp)
    
    print(f"Sensitivity (Recall Class 1): {sensitivity:.4f}")
    print(f"Specificity (Recall Class 0): {specificity:.4f}")

if __name__ == "__main__":
    verify_model()
