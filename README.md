# NephroMind - Detección de Riesgo de Enfermedad Renal Crónica (CKD)

## 🏥 Descripción del Proyecto
NephroMind es una herramienta de **Inteligencia Artificial para el cribado preventivo** de la Enfermedad Renal Crónica. Utiliza un modelo de Machine Learning (XGBoost) optimizado para identificar pacientes en riesgo con alta sensibilidad.

El sistema permite a los profesionales de la salud introducir datos clínicos y obtener una evaluación de riesgo inmediata, junto con una explicación detallada (SHAP) de los factores que influyen en la predicción.

## 🚀 Características Clave
*   **Alta Sensibilidad (97%)**: Prioriza la detección de enfermos para minimizar falsos negativos.
*   **Explicabilidad (XAI)**: Muestra qué variables (ej. Creatinina, Edad, Hipertensión) contribuyeron más al diagnóstico.
*   **Integración FHIR**: Envía los resultados como recursos `RiskAssessment` a un servidor FHIR compatible.
*   **Visualización**: Gráfico de radar para comparar el perfil del paciente con el promedio.

## 📊 Rendimiento del Modelo (Final)
El modelo ha sido entrenado y validado con el dataset `Chronic_Kidney_Dsease_data.csv`.

| Métrica | Valor | Interpretación |
| :--- | :--- | :--- |
| **Exactitud (Accuracy)** | **92.17%** | Acierto global. |
| **Sensibilidad (Enfermos)** | **97%** | Detecta a 97 de cada 100 enfermos. |
| **Especificidad (Sanos)** | **33%** | Tasa de falsas alarmas en sanos (aceptable para cribado). |
| **ROC AUC** | **0.75** | Capacidad de discriminación. |

> **Nota**: Se ha priorizado la sensibilidad sobre la especificidad. Esto significa que el modelo es "cauteloso" y prefiere alertar a un paciente sano antes que dejar pasar a uno enfermo.

## 🛠️ Instalación y Uso

### Requisitos Previos
*   Docker y Docker Compose
*   O bien: Python 3.9+ y Node.js (para ejecución local sin Docker)

### Opción 1: Ejecución con Docker (Recomendado)
1.  Clona el repositorio.
2.  Ejecuta el siguiente comando en la raíz del proyecto:
    ```bash
    docker-compose up --build
    ```
3.  Accede a la aplicación en: `http://localhost:80`

### Opción 2: Ejecución Manual

**Backend (API):**
```bash
cd backend
pip install -r requirements.txt
python train_model.py  # (Opcional) Para re-entrenar el modelo
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

**Frontend (Web):**
Simplemente abre el archivo `frontend/index.html` en tu navegador o sírvelo con una extensión como "Live Server".

## 📂 Estructura del Proyecto
*   `backend/`: Código Python (FastAPI), Modelo (XGBoost) y scripts de entrenamiento.
*   `frontend/`: Interfaz web (HTML/JS/CSS) y lógica FHIR.
*   `archive/`: Datasets utilizados.
*   `docker-compose.yml`: Orquestación de contenedores.

## 🤝 Contribuciones
Desarrollado para el Hackathon de Salud 2025.
