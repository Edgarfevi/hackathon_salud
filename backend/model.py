"""
NephroMind - Kidney Disease Risk Prediction Model
XGBoost classifier optimizado para screening de ERC (alta sensibilidad).
Incluye explicabilidad con SHAP.
"""

import os
import logging
import joblib
import numpy as np
import pandas as pd
from typing import Dict, Any, List, Optional, Tuple

from sklearn.model_selection import train_test_split
from sklearn.preprocessing import StandardScaler
from sklearn.feature_selection import RFE
from sklearn.metrics import (
    accuracy_score, classification_report, 
    confusion_matrix, roc_auc_score
)
from xgboost import XGBClassifier
import shap

# Configuración de logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


class KidneyDiseaseModel:
    """
    Modelo de predicción de riesgo de Enfermedad Renal Crónica.
    
    Características:
    - XGBoost con class weights para datos desbalanceados
    - Threshold optimizado para alta sensibilidad (>98%)
    - Selección de features con RFE
    - Explicabilidad con SHAP
    """
    
    # Columnas a eliminar del dataset (irrelevantes o target leakage)
    COLUMNS_TO_DROP = [
        'PatientID', 'DoctorInCharge',
        'DietQuality', 'SleepQuality',
        'WaterQuality', 'QualityOfLifeScore',
        'GFR',  # El GFR real sería target leakage
        'TimeToEventMonths'  # Target leakage
    ]
    
    # Mapeo de nombres de columnas del frontend al modelo
    COLUMN_RENAME_MAP = {
        'BUN': 'BUNLevels',
        'Fatigue': 'FatigueLevels'
    }
    
    def __init__(self):
        """Inicializa el modelo."""
        self.model: Optional[XGBClassifier] = None
        self.scaler: Optional[StandardScaler] = None
        self.columns: Optional[List[str]] = None  # Columnas seleccionadas por RFE
        self.all_columns: Optional[List[str]] = None  # Todas las columnas del scaler
        self.explainer: Optional[shap.TreeExplainer] = None
        self.threshold: float = 0.5
        
        # Rutas de archivos
        current_dir = os.path.dirname(os.path.abspath(__file__))
        self.model_path_json = os.path.join(current_dir, "kidney_model.json")  # XGBoost nativo
        self.metadata_path = os.path.join(current_dir, "kidney_model_metadata.pkl")  # Solo metadata
    
    def load_data(self, filepath: str) -> pd.DataFrame:
        """
        Carga y preprocesa el dataset.
        
        Args:
            filepath: Ruta al archivo CSV
            
        Returns:
            DataFrame preprocesado
        """
        logger.info(f"Cargando datos desde: {filepath}")
        df = pd.read_csv(filepath)
        
        # Eliminar columnas irrelevantes
        cols_to_drop = [col for col in self.COLUMNS_TO_DROP if col in df.columns]
        df = df.drop(columns=cols_to_drop)
        logger.info(f"Columnas eliminadas: {cols_to_drop}")
        
        return df
    
    def train(self, data_path: str) -> None:
        """
        Entrena el modelo con el dataset especificado.
        
        Args:
            data_path: Ruta al archivo CSV de entrenamiento
        """
        logger.info("=" * 50)
        logger.info("INICIANDO ENTRENAMIENTO DEL MODELO")
        logger.info("=" * 50)
        
        # Cargar datos
        df = self.load_data(data_path)
        
        X = df.drop('Diagnosis', axis=1)
        y = df['Diagnosis']
        
        self.all_columns = X.columns.tolist()
        logger.info(f"Features totales: {len(self.all_columns)}")
        logger.info(f"Distribución target: {y.value_counts().to_dict()}")
        
        # Split estratificado
        X_train, X_test, y_train, y_test = train_test_split(
            X, y, test_size=0.2, random_state=42, stratify=y
        )
        
        # Calcular pesos de clase
        n_pos = y_train.sum()
        n_neg = len(y_train) - n_pos
        scale_pos_weight = n_neg / n_pos
        logger.info(f"Scale pos weight: {scale_pos_weight:.2f}")
        
        # Escalar datos
        logger.info("Escalando datos...")
        self.scaler = StandardScaler()
        X_train_scaled = self.scaler.fit_transform(X_train)
        X_test_scaled = self.scaler.transform(X_test)
        
        # Selección de features con RFE
        logger.info("Seleccionando features con RFE...")
        selector_model = XGBClassifier(
            n_estimators=100,
            max_depth=3,
            random_state=42,
            n_jobs=-1,
            eval_metric='logloss',
            scale_pos_weight=scale_pos_weight
        )
        
        rfe = RFE(estimator=selector_model, n_features_to_select=20, step=1)
        rfe.fit(X_train_scaled, y_train)
        
        # Guardar columnas seleccionadas
        selected_mask = rfe.support_
        self.columns = np.array(self.all_columns)[selected_mask].tolist()
        logger.info(f"Features seleccionadas ({len(self.columns)}): {self.columns}")
        
        # Transformar a features seleccionadas
        X_train_selected = rfe.transform(X_train_scaled)
        X_test_selected = rfe.transform(X_test_scaled)
        
        # Entrenar modelo final
        logger.info("Entrenando XGBoost...")
        self.model = XGBClassifier(
            n_estimators=200,
            learning_rate=0.1,
            scale_pos_weight=scale_pos_weight,
            max_depth=5,
            random_state=42,
            n_jobs=-1,
            eval_metric='logloss'
        )
        self.model.fit(X_train_selected, y_train)
        
        # Optimizar threshold para alta sensibilidad
        self._optimize_threshold(X_test_selected, y_test)
        
        # Inicializar SHAP
        logger.info("Inicializando SHAP Explainer...")
        self.explainer = shap.TreeExplainer(self.model)
        
        # Evaluar modelo
        self._evaluate_model(X_test_selected, y_test)
        
        # Guardar modelo
        self.save_model()
        
        logger.info("=" * 50)
        logger.info("ENTRENAMIENTO COMPLETADO")
        logger.info("=" * 50)
    
    def _optimize_threshold(self, X_test: np.ndarray, y_test: pd.Series) -> None:
        """
        Optimiza el threshold para maximizar sensibilidad (>98%).
        
        Para screening de ERC es CRÍTICO no perder casos positivos.
        """
        logger.info("Optimizando threshold para alta sensibilidad...")
        
        y_proba = self.model.predict_proba(X_test)[:, 1]
        best_threshold = 0.5
        best_specificity = 0
        target_sensitivity = 0.98
        
        # Buscar threshold que logre ≥98% sensibilidad
        for thresh in np.arange(0.05, 0.90, 0.01):
            y_pred = (y_proba >= thresh).astype(int)
            tn, fp, fn, tp = confusion_matrix(y_test, y_pred).ravel()
            
            sensitivity = tp / (tp + fn) if (tp + fn) > 0 else 0
            specificity = tn / (tn + fp) if (tn + fp) > 0 else 0
            
            if sensitivity >= target_sensitivity:
                if specificity > best_specificity:
                    best_specificity = specificity
                    best_threshold = thresh
        
        # Si no se logra 98%, usar el threshold con máxima sensibilidad
        if best_specificity == 0:
            logger.warning("No se logró 98% sensibilidad. Buscando máxima sensibilidad...")
            max_sensitivity = 0
            for thresh in np.arange(0.05, 0.90, 0.01):
                y_pred = (y_proba >= thresh).astype(int)
                tn, fp, fn, tp = confusion_matrix(y_test, y_pred).ravel()
                sensitivity = tp / (tp + fn) if (tp + fn) > 0 else 0
                
                if sensitivity > max_sensitivity:
                    max_sensitivity = sensitivity
                    best_threshold = thresh
        
        self.threshold = best_threshold
        logger.info(f"Threshold óptimo: {self.threshold:.2f}")
    
    def _evaluate_model(self, X_test: np.ndarray, y_test: pd.Series) -> None:
        """Evalúa el modelo y guarda métricas."""
        logger.info("\n--- EVALUACIÓN DEL MODELO ---")
        
        y_proba = self.model.predict_proba(X_test)[:, 1]
        y_pred = (y_proba >= self.threshold).astype(int)
        
        accuracy = accuracy_score(y_test, y_pred)
        roc_auc = roc_auc_score(y_test, y_proba)
        cm = confusion_matrix(y_test, y_pred)
        
        tn, fp, fn, tp = cm.ravel()
        sensitivity = tp / (tp + fn) if (tp + fn) > 0 else 0
        specificity = tn / (tn + fp) if (tn + fp) > 0 else 0
        
        logger.info(f"Accuracy: {accuracy:.4f}")
        logger.info(f"ROC AUC: {roc_auc:.4f}")
        logger.info(f"Sensibilidad: {sensitivity:.4f}")
        logger.info(f"Especificidad: {specificity:.4f}")
        logger.info(f"Threshold: {self.threshold:.2f}")
        logger.info(f"\nMatriz de confusión:\n{cm}")
        logger.info(f"\nReporte de clasificación:\n{classification_report(y_test, y_pred)}")
        
        # Guardar métricas
        metrics_path = os.path.join(os.path.dirname(self.model_path), "latest_metrics.txt")
        with open(metrics_path, "w") as f:
            f.write(f"Accuracy: {accuracy:.4f}\n")
            f.write(f"ROC AUC: {roc_auc:.4f}\n")
            f.write(f"Sensibilidad: {sensitivity:.4f}\n")
            f.write(f"Especificidad: {specificity:.4f}\n")
            f.write(f"Threshold: {self.threshold:.2f}\n")
            f.write(f"\nClassification Report:\n{classification_report(y_test, y_pred)}")
            f.write(f"\nConfusion Matrix:\n{cm}")
    
    def save_model(self) -> None:
        """Guarda el modelo usando XGBoost nativo JSON y metadata con joblib."""
        # Guardar modelo XGBoost en formato JSON nativo
        self.model.save_model(self.model_path_json)
        logger.info(f"Modelo XGBoost guardado en: {self.model_path_json}")
        
        # Guardar metadata (scaler, columns, threshold) con joblib
        metadata = {
            'scaler': self.scaler,
            'columns': self.columns,
            'all_columns': self.all_columns,
            'threshold': self.threshold
        }
        joblib.dump(metadata, self.metadata_path)
        logger.info(f"Metadata guardada en: {self.metadata_path}")
    
    def load_model(self) -> bool:
        """
        Carga el modelo desde disco usando XGBoost nativo JSON.
        
        Returns:
            True si se cargó exitosamente, False si no existe
        """
        if not os.path.exists(self.model_path_json):
            logger.warning(f"No se encontró modelo en: {self.model_path_json}")
            return False
        
        if not os.path.exists(self.metadata_path):
            logger.warning(f"No se encontró metadata en: {self.metadata_path}")
            return False
        
        try:
            # Cargar modelo XGBoost usando método nativo
            self.model = XGBClassifier()
            self.model.load_model(self.model_path_json)
            logger.info(f"Modelo XGBoost cargado desde: {self.model_path_json}")
            
            # Cargar metadata
            metadata = joblib.load(self.metadata_path)
            self.scaler = metadata['scaler']
            self.columns = metadata['columns']
            self.all_columns = metadata.get('all_columns', self.columns)
            self.threshold = metadata.get('threshold', 0.5)
            
            # Inicializar SHAP
            try:
                self.explainer = shap.TreeExplainer(self.model)
            except Exception as e:
                logger.warning(f"No se pudo inicializar SHAP: {e}")
                self.explainer = None
            
            logger.info(f"Modelo cargado. Threshold: {self.threshold}")
            return True
            
        except Exception as e:
            logger.error(f"Error cargando modelo: {e}")
            import traceback
            traceback.print_exc()
            return False
    
    def predict(self, input_data: Dict[str, Any]) -> Dict[str, Any]:
        """
        Realiza una predicción de riesgo de ERC.
        
        Args:
            input_data: Diccionario con los datos del paciente
            
        Returns:
            Diccionario con predicción, probabilidad y factores contribuyentes
        """
        if self.model is None:
            return {"error": "Modelo no entrenado o cargado"}
        
        try:
            # Crear DataFrame
            input_df = pd.DataFrame([input_data])
            
            # Renombrar columnas si es necesario
            input_df = input_df.rename(columns=self.COLUMN_RENAME_MAP)
            
            # Obtener columnas esperadas por el scaler
            if hasattr(self.scaler, 'feature_names_in_'):
                expected_cols = list(self.scaler.feature_names_in_)
            else:
                expected_cols = self.all_columns or self.columns
            
            # Asegurar que tenemos todas las columnas
            for col in expected_cols:
                if col not in input_df.columns:
                    input_df[col] = 0
            
            # Mantener solo las columnas esperadas en el orden correcto
            input_df = input_df[expected_cols]
            
            logger.debug(f"Columnas de entrada: {input_df.columns.tolist()}")
            
            # Escalar
            input_scaled = self.scaler.transform(input_df)
            input_scaled_df = pd.DataFrame(input_scaled, columns=expected_cols)
            
            # Seleccionar features del modelo
            input_selected = input_scaled_df[self.columns]
            
            # Predecir
            probability = float(self.model.predict_proba(input_selected)[0][1])
            prediction = int(probability >= self.threshold)
            
            # Calcular SHAP values
            contributors = self._get_shap_contributors(input_selected, input_df)
            
            return {
                "prediction": prediction,
                "probability": probability,
                "contributors": contributors
            }
            
        except Exception as e:
            logger.error(f"Error en predicción: {e}")
            import traceback
            traceback.print_exc()
            return {"error": str(e)}
    
    def _get_shap_contributors(
        self, 
        input_selected: pd.DataFrame, 
        input_original: pd.DataFrame
    ) -> List[Dict[str, Any]]:
        """
        Calcula los factores que más contribuyen a la predicción usando SHAP.
        
        Returns:
            Lista de los top 5 factores contribuyentes
        """
        if self.explainer is None:
            return []
        
        try:
            shap_values = self.explainer.shap_values(input_selected)
            
            # Obtener valores para clase 1 (ERC)
            if isinstance(shap_values, list):
                class_1_shap = shap_values[1][0]
            elif len(shap_values.shape) == 3:
                class_1_shap = shap_values[0, :, 1]
            else:
                class_1_shap = shap_values[0]
            
            # Crear lista de impactos
            impacts = []
            for i, col in enumerate(self.columns):
                # Obtener valor original
                original_value = 0.0
                if col in input_original.columns:
                    original_value = float(input_original.iloc[0][col])
                
                impacts.append({
                    "feature": col,
                    "impact": float(class_1_shap[i]),
                    "value": original_value
                })
            
            # Ordenar por impacto absoluto
            impacts.sort(key=lambda x: abs(x["impact"]), reverse=True)
            
            return impacts[:5]
            
        except Exception as e:
            logger.warning(f"Error calculando SHAP: {e}")
            return []


# Entry point para entrenamiento directo
if __name__ == "__main__":
    model = KidneyDiseaseModel()
    
    # Buscar dataset
    current_dir = os.path.dirname(os.path.abspath(__file__))
    possible_paths = [
        os.path.join(current_dir, "archive/kidney_data.csv"),
        os.path.join(current_dir, "archive/Chronic_Kidney_Dsease_data.csv"),
        "archive/kidney_data.csv",
    ]
    
    data_path = None
    for path in possible_paths:
        if os.path.exists(path):
            data_path = path
            break
    
    if data_path:
        logger.info(f"Dataset encontrado: {data_path}")
        model.train(data_path)
    else:
        logger.error(f"Dataset no encontrado. Rutas buscadas: {possible_paths}")
