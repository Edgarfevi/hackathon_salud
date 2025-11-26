from model import KidneyDiseaseModel

if __name__ == "__main__":
    print("Training model with improvements...")
    model = KidneyDiseaseModel()
    # Path relative to backend directory
    data_path = "../archive/Chronic_Kidney_Dsease_data.csv"
    model.train(data_path)
    print("Training complete.")
