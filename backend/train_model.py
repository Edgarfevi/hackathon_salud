"""
NephroMind - Script de Entrenamiento del Modelo
Ejecutar este script para entrenar o re-entrenar el modelo de predicción de ERC.
"""

import os
import sys
import logging

# Configurar logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


def find_dataset():
    """Busca el dataset en las rutas posibles."""
    current_dir = os.path.dirname(os.path.abspath(__file__))
    
    possible_paths = [
        os.path.join(current_dir, "archive/kidney_data.csv"),
        os.path.join(current_dir, "archive/Chronic_Kidney_Dsease_data.csv"),
        "archive/kidney_data.csv",
        "backend/archive/kidney_data.csv",
    ]
    
    for path in possible_paths:
        if os.path.exists(path):
            return path
    
    return None


def main():
    """Función principal de entrenamiento."""
    logger.info("=" * 60)
    logger.info("NEPHROMIND - ENTRENAMIENTO DE MODELO")
    logger.info("=" * 60)
    
    # Importar modelo
    from model import KidneyDiseaseModel
    
    # Buscar dataset
    data_path = find_dataset()
    
    if data_path is None:
        logger.error("❌ Dataset no encontrado.")
        logger.error("   Coloca el archivo CSV en: backend/archive/kidney_data.csv")
        sys.exit(1)
    
    logger.info(f"📁 Dataset encontrado: {data_path}")
    
    # Crear y entrenar modelo
    model = KidneyDiseaseModel()
    
    try:
        model.train(data_path)
        logger.info("=" * 60)
        logger.info("✅ ENTRENAMIENTO COMPLETADO EXITOSAMENTE")
        logger.info(f"   Modelo guardado en: {model.model_path}")
        logger.info(f"   Threshold óptimo: {model.threshold:.2f}")
        logger.info("=" * 60)
        
    except Exception as e:
        logger.error(f"❌ Error durante el entrenamiento: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)


if __name__ == "__main__":
    main()
