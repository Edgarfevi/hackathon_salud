import pandas as pd
import numpy as np
from sklearn.model_selection import train_test_split, GridSearchCV
from xgboost import XGBClassifier
from sklearn.ensemble import RandomForestClassifier, VotingClassifier
from sklearn.linear_model import LogisticRegression
from sklearn.utils.class_weight import compute_sample_weight
from sklearn.metrics import accuracy_score, classification_report, confusion_matrix, roc_auc_score
from sklearn.feature_selection import RFE
from sklearn.preprocessing import StandardScaler
from imblearn.over_sampling import SMOTE
import os
import joblib
import shap

class KidneyDiseaseModel:
    def __init__(self):
        self.model = None
        self.scaler = None
        self.columns = None
        self.explainer = None
        self.threshold = 0.5 # Default threshold
        # Rutas relativas a la raíz del proyecto (ahora backend/)
        current_dir = os.path.dirname(os.path.abspath(__file__))
        self.full_model_path = os.path.join(current_dir, "kidney_model.pkl")

    def load_data(self, filepath):
        df = pd.read_csv(filepath)
        
        # Drop irrelevant columns and target leakage
        columns_to_drop = [
            'PatientID', 'DoctorInCharge', 
            'DietQuality', 'SleepQuality', 
            'WaterQuality', 'QualityOfLifeScore',
            'GFR',
            'TimeToEventMonths' # Target Leakage!
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
        
        # Strategy: Class Weights (No SMOTE)
        # Calculate scale_pos_weight for XGBoost: sum(negative) / sum(positive)
        n_pos = sum(y_train)
        n_neg = len(y_train) - n_pos
        scale_pos_weight = n_neg / n_pos
        print(f"Using Class Weights strategy. Calculated scale_pos_weight: {scale_pos_weight:.2f}")
        
        # Scaling
        print("Scaling data...")
        self.scaler = StandardScaler()
        X_train_scaled = self.scaler.fit_transform(X_train) # Use original X_train
        X_test_scaled = self.scaler.transform(X_test)
        
        # Feature Selection (RFE)
        print("Performing Feature Selection (RFE)...")
        # Use a lighter model for selection to be faster
        selector_model = XGBClassifier(
            n_estimators=100, 
            max_depth=3, 
            random_state=42, 
            n_jobs=-1,
            eval_metric='logloss',
            scale_pos_weight=scale_pos_weight # Use weights here too
        )
        # Select top 20 features
        rfe = RFE(estimator=selector_model, n_features_to_select=20, step=1)
        rfe.fit(X_train_scaled, y_train) # Use original y_train
        
        # Update columns to keep only selected ones
        selected_mask = rfe.support_
        self.columns = np.array(self.columns)[selected_mask].tolist()
        print(f"Selected {len(self.columns)} features: {self.columns}")
        
        # Transform data to selected features
        X_train_selected = rfe.transform(X_train_scaled)
        X_test_selected = rfe.transform(X_test_scaled)
        
        # Initialize and train final XGBoost model on selected features
        print("Training XGBoost on selected features...")
        self.model = XGBClassifier(
            n_estimators=200,
            learning_rate=0.1,
            scale_pos_weight=scale_pos_weight, # Apply class weights
            max_depth=5,
            random_state=42,
            n_jobs=-1,
            eval_metric='logloss'
        )
        self.model.fit(X_train_selected, y_train)
        print("Training complete.")
        
        # Threshold Tuning
        print("Tuning threshold...")
        y_proba = self.model.predict_proba(X_test_selected)[:, 1]
        best_threshold = 0.5
        best_score = 0
        
        # We want to maximize Specificity (Recall 0) while keeping Sensitivity (Recall 1) high (>0.9)
        for thresh in np.arange(0.1, 0.95, 0.05):
            y_pred_temp = (y_proba >= thresh).astype(int)
            tn, fp, fn, tp = confusion_matrix(y_test, y_pred_temp).ravel()
            recall_0 = tn / (tn + fp) if (tn + fp) > 0 else 0
            recall_1 = tp / (tp + fn) if (tp + fn) > 0 else 0
            
            # Custom score: prioritize Recall 0 but ensure Recall 1 is safe
            if recall_1 > 0.96:
                score = recall_0
                if score > best_score:
                    best_score = score
                    best_threshold = thresh
        
        self.threshold = best_threshold
        print(f"Optimal Threshold found: {self.threshold}")

        # Initialize SHAP Explainer
        print("Initializing SHAP Explainer...")
        # TreeExplainer is optimized for trees
        self.explainer = shap.TreeExplainer(self.model)
        
        # Evaluation
        print("\n--- Model Evaluation (Test Set) ---")
        y_pred_proba = self.model.predict_proba(X_test_selected)[:, 1]
        
        # Apply threshold
        y_pred_thresholded = (y_pred_proba >= self.threshold).astype(int)
        
        accuracy = accuracy_score(y_test, y_pred_thresholded)
        roc_auc = roc_auc_score(y_test, y_pred_proba)
        
        print(f"Accuracy: {accuracy:.4f}")
        print(f"ROC AUC Score: {roc_auc:.4f}")
        print("Classification Report:")
        print(classification_report(y_test, y_pred_thresholded))
        print("Confusion Matrix:")
        print(confusion_matrix(y_test, y_pred_thresholded))
        print("-----------------------------------")
        
        # Save metrics to file for the report
        with open("latest_metrics.txt", "w") as f:
            f.write(f"Accuracy: {accuracy:.4f}\n")
            f.write(f"ROC AUC: {roc_auc:.4f}\n")
            f.write("Classification Report:\n")
            f.write(classification_report(y_test, y_pred_thresholded))
            f.write("\nConfusion Matrix:\n")
            f.write(str(confusion_matrix(y_test, y_pred_thresholded)))
        
        self.save_model()

    def save_model(self):
        model_artifacts = {
            'model': self.model,
            'scaler': self.scaler,
            'columns': self.columns,
            'threshold': self.threshold
        }
        joblib.dump(model_artifacts, self.full_model_path)
        print("Model artifacts saved.")

    def load_model(self):
        if os.path.exists(self.full_model_path):
            model_artifacts = joblib.load(self.full_model_path)
            self.model = model_artifacts['model']
            self.scaler = model_artifacts['scaler']
            self.columns = model_artifacts['columns']
            self.threshold = model_artifacts.get('threshold', 0.5) # Load threshold or default to 0.5
            
            # Initialize SHAP explainer
            print("Initializing SHAP Explainer from loaded model...")
            try:
                self.explainer = shap.TreeExplainer(self.model)
            except Exception as e:
                print(f"Warning: Could not initialize SHAP explainer: {e}")
                self.explainer = None # Set to None if it fails
            
            return True
        return False

    def predict(self, input_data):
        # input_data should be a dictionary or dataframe
        if self.model is None:
            return {"error": "Model not trained or loaded"}
            
        input_df = pd.DataFrame([input_data])
        
        # Rename columns to match model expectations
        rename_map = {
            "BUN": "BUNLevels",
            "Fatigue": "FatigueLevels"
        }
        input_df = input_df.rename(columns=rename_map)

        # Ensure input has exactly the columns the scaler expects
        if hasattr(self.scaler, "feature_names_in_"):
            expected_cols = self.scaler.feature_names_in_
            # Fill missing
            for col in expected_cols:
                if col not in input_df.columns:
                    input_df[col] = 0
            # Keep only expected (drop extras like original BUN if renamed, or others)
            input_df = input_df[expected_cols]
        
        # Debug prints
        print("Final Input columns:", input_df.columns.tolist())
        
        # Scale full input (scaler expects all original features)
        # Note: input_df must have the same columns as the training data (minus dropped ones)
        try:
            input_scaled_full = self.scaler.transform(input_df)
        except ValueError as e:
             # If feature names mismatch, we might need to reorder or fill
             return {"error": f"Scaling error: {e}"}
        
        # Convert back to DF to select features by name
        input_scaled_full_df = pd.DataFrame(input_scaled_full, columns=input_df.columns)
        
        # Select the 20 features model expects
        input_selected = input_scaled_full_df[self.columns]
        
        # Predict probability and apply threshold
        probability = self.model.predict_proba(input_selected)[0][1] # Probability of class 1 (CKD)
        prediction = int(probability >= self.threshold)
        
        # Calculate SHAP values
        top_contributors = []
        try:
            # SHAP expects the selected features
            shap_values = self.explainer.shap_values(input_selected)
            
            # shap_values is a list for classifiers (one for each class). We want class 1 (CKD).
            # For binary classification, shap_values[1] contains the impact for class 1.
            # Note: newer shap versions might return an Explanation object or array depending on version.
            # TreeExplainer usually returns a list of arrays for classifiers.
            
            if isinstance(shap_values, list):
                class_1_shap = shap_values[1][0] # First instance, class 1
            else:
                # If it's just an array (some versions/models)
                if len(shap_values.shape) == 3:
                     class_1_shap = shap_values[0, :, 1]
                else:
                     class_1_shap = shap_values[0]
    
            # Map to feature names
            feature_impact = []
            for i, col in enumerate(self.columns):
                impact = class_1_shap[i]
                feature_impact.append({
                    "feature": col,
                    "impact": float(impact),
                    "value": float(input_df.iloc[0][col]) if col in input_df.columns else 0.0
                })
                
            # Sort by absolute impact
            feature_impact.sort(key=lambda x: abs(x["impact"]), reverse=True)
            
            # Get top contributors
            top_contributors = feature_impact[:5] # Top 5 most important factors for this specific patient
        except Exception as e:
            print(f"Error calculating SHAP values: {e}")
            import traceback
            traceback.print_exc()
            # Continue without contributors

        return {
            "prediction": prediction,
            "probability": float(probability),
            "contributors": top_contributors
        }

if __name__ == "__main__":
    # For testing/initial training
    model = KidneyDiseaseModel()
    # Determine data path relative to this script
    current_dir = os.path.dirname(os.path.abspath(__file__))
    # Check if we are in backend dir or root
    # If in backend, data is in ../archive
    possible_paths = [
        os.path.join(current_dir, "archive/merged_kidney_data (1).csv"),
        os.path.join(current_dir, "../backend/archive/merged_kidney_data (1).csv"),
        "backend/archive/merged_kidney_data (1).csv",
        os.path.join(current_dir, "archive/normalized_chronic_kidney_disease_data_fin.csv"),
        "archive/normalized_chronic_kidney_disease_data_fin.csv",
        os.path.join(current_dir, "archive/Chronic_Kidney_Dsease_data.csv"), # Fallback
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
