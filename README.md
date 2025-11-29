# NephroMind - Hackathon Boehringer Ingelheim 2025

## Descripción
NephroMind es una herramienta digital diseñada para ayudar a los médicos de atención primaria a identificar pacientes con riesgo de desarrollar Enfermedad Renal Crónica (CKD) en etapas tempranas. Utiliza Inteligencia Artificial para analizar datos clínicos y demográficos, y se integra con estándares de interoperabilidad (HL7 FHIR).

## Características
- **Predicción de Riesgo con IA**: Modelo XGBoost entrenado para detectar riesgo de CKD.
- **Reglas Clínicas de Seguridad**: Incorpora cálculo de eGFR (CKD-EPI) y alertas automáticas si eGFR < 60.
- **Interoperabilidad**: Capacidad de conectarse con historias clínicas electrónicas vía SMART on FHIR.
- **Explicabilidad (XAI)**: Muestra qué factores influyeron más en la predicción (SHAP values).
- **Interfaz Intuitiva**: Dashboard diseñado para uso rápido en consulta.

## Requisitos
- Docker y Docker Compose

## Instrucciones de Ejecución

1.  **Clonar/Descargar el repositorio**
2.  **Ejecutar con Docker Compose**:
    ```bash
    docker-compose up --build
    ```
3.  **Acceder a la Aplicación**:
    - Frontend: [http://localhost:8080](http://localhost:8080)
    - Backend API Docs: [http://localhost:8000/docs](http://localhost:8000/docs)

## Uso del Modo Demo
Para propósitos de demostración en el Hackathon:
1.  Abra la aplicación en el navegador.
2.  Haga clic en el botón naranja **"Cargar Datos Demo"** en la parte superior.
3.  Esto simulará la extracción de datos desde una historia clínica (FHIR), llenando automáticamente los campos del paciente "María García López".
4.  Revise los datos precargados en los diferentes pasos.
5.  En el último paso, haga clic en **"Analizar Riesgo"**.
6.  Observe el resultado, el nivel de riesgo, y la explicación de los factores contribuyentes.

## Estructura del Proyecto
- `/backend`: API en Python/FastAPI y modelo de ML.
- `/frontend`: Interfaz web (HTML/CSS/JS).

## 🌟 Caso de Uso: "Laura" (Reto del Hackathon)

**Perfil**: Mujer, 61 años, Hipertensión controlada, Cansancio.
**Datos Clave**: Creatinina 1.1 mg/dL (Aparentemente normal/límite).

**Sin NephroMind**:
El médico ve la creatinina de 1.1 en el rango de referencia del laboratorio y asume que es normal para su edad. El diagnóstico se retrasa.

**Con NephroMind**:
1.  El sistema ingesta los datos (FHIR/Manual).
2.  Calcula automáticamente **eGFR = 57.17 ml/min** (CKD-EPI).
3.  **ALERTA**: Detecta eGFR < 60 y marca **ALTO RIESGO**.
4.  El médico recibe la alerta de que Laura está en **Estadio 3a de ERC** silenciosa.

> "NephroMind hace visible lo invisible, detectando pacientes como Laura antes de que sea tarde."
