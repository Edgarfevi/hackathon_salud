"""
Migration script to convert old joblib model to new format.
Extracts metadata from old kidney_model.pkl and saves it separately.
"""

import os
import joblib
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

def migrate_model():
    """Migrate from old joblib format to new XGBoost native JSON + metadata format."""
    backend_dir = os.path.dirname(os.path.abspath(__file__))
    old_model_path = os.path.join(backend_dir, "kidney_model.pkl")
    metadata_path = os.path.join(backend_dir, "kidney_model_metadata.pkl")
    
    if not os.path.exists(old_model_path):
        logger.error(f"Old model not found: {old_model_path}")
        return False
    
    if os.path.exists(metadata_path):
        logger.info(f"Metadata already exists: {metadata_path}")
        return True
    
    try:
        # Load old artifacts
        logger.info(f"Loading old model from: {old_model_path}")
        artifacts = joblib.load(old_model_path)
        
        # Extract metadata (everything except the XGBoost model)
        metadata = {
            'scaler': artifacts['scaler'],
            'columns': artifacts['columns'],
            'all_columns': artifacts.get('all_columns', artifacts['columns']),
            'threshold': artifacts.get('threshold', 0.5)
        }
        
        # Save metadata
        joblib.dump(metadata, metadata_path)
        logger.info(f"✓ Metadata saved to: {metadata_path}")
        logger.info(f"  - Threshold: {metadata['threshold']}")
        logger.info(f"  - Features: {len(metadata['columns'])}")
        
        return True
        
    except Exception as e:
        logger.error(f"Error during migration: {e}")
        import traceback
        traceback.print_exc()
        return False

if __name__ == "__main__":
    success = migrate_model()
    if success:
        logger.info("✓ Migration completed successfully")
    else:
        logger.error("✗ Migration failed")
