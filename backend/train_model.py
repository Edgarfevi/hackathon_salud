from model import KidneyDiseaseModel

if __name__ == "__main__":
    print("Training model with improvements...")
    model = KidneyDiseaseModel()
    import os
    # Try multiple paths
    possible_paths = [
        "backend/archive/normalized_chronic_kidney_disease_data_fin.csv",
        "archive/normalized_chronic_kidney_disease_data_fin.csv",
        "../archive/normalized_chronic_kidney_disease_data_fin.csv"
    ]
    
    data_path = None
    for path in possible_paths:
        if os.path.exists(path):
            data_path = path
            break
            
    if data_path is None:
        print("Error: Dataset not found in expected paths.")
        exit(1)
        
    print(f"Using dataset: {data_path}")
    model.train(data_path)
    print("Training complete.")
