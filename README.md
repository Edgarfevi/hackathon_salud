# NephroMind - Evaluación de Riesgo Renal con IA

## 🎯 Reto 2: Boehringer Ingelheim
**Mejorando la calidad de vida de pacientes con enfermedad renal crónica**

Herramienta digital para médicos de atención primaria que permite identificar pacientes con riesgo de enfermedad renal crónica a partir de su historia clínica completa, con integración SMART on FHIR para sistemas informáticos de centros de salud.

## ✨ Características Principales

### 🤖 Inteligencia Artificial
- Modelo Random Forest entrenado con datos reales
- Predicción de riesgo de ERC (alto/bajo)
- Probabilidad calculada con métricas de confianza
- Preprocesamiento con SMOTE para balanceo de clases

### 🏥 Integración SMART on FHIR
- Carga automática de datos del paciente desde sistemas hospitalarios
- Mapeo de códigos estándar (LOINC, SNOMED CT)
- Prellenado inteligente del formulario
- Compatible con sistemas de información clínica
- **Modo Demo**: Datos simulados para demostración sin acceso FHIR real

### 👨‍⚕️ Interfaz para Médicos
- **Panel de Resumen del Paciente**: Visualización rápida de historia clínica
- **Formulario Multi-paso**: Interfaz intuitiva y guiada
- **Recomendaciones Clínicas**: Sugerencias basadas en el nivel de riesgo
- **Exportación de Resultados**: PDF y JSON para integración con sistemas

### 📊 Visualización
- Medidor visual de riesgo
- Indicadores de datos cargados desde FHIR
- Timeline de observaciones y laboratorios
- Notificaciones en tiempo real

## 🚀 Instalación y Uso

### Backend
```bash
cd backend
pip install -r requirements.txt
uvicorn main:app --reload
```

### Frontend

**Opción 1: Live Server (VS Code - Recomendado)**
- Instala extensión "Live Server" en VS Code
- Click derecho en `frontend/index.html` → "Open with Live Server"

**Opción 2: Servidor HTTP Python**
```bash
cd frontend
python -m http.server 8080
# Abre: http://localhost:8080
```

**Opción 3: Servidor HTTP Node.js**
```bash
npm install -g http-server
cd frontend
http-server -p 8080
```

**Opción 4: Abrir Directamente**
- Doble clic en `frontend/index.html`
- ⚠️ Algunas funcionalidades pueden no funcionar por CORS

### Modo Demo (Para Demostración)
1. Abre la aplicación en el navegador
2. Haz clic en el botón **"Cargar Datos Demo"** en el banner amarillo
3. Se cargarán datos de ejemplo y podrás demostrar toda la funcionalidad
4. **No requiere acceso a servidores FHIR reales**

### Modelo
El modelo se entrena automáticamente al iniciar el backend si no existe. Los archivos `.pkl` se guardan en la raíz del proyecto.

## 📖 Guía de Uso Completa

> 📖 **Ver [GUIA_USO.md](GUIA_USO.md) para instrucciones detalladas de uso**

### Inicio Rápido:
1. **Backend**: Ejecuta `iniciar_backend.bat` o `python -m uvicorn backend.main:app --reload`
2. **Frontend**: Abre `frontend/index.html` en el navegador
3. **Demo**: Clic en "Cargar Datos Demo" para probar sin datos reales
4. **Usar**: Completa el formulario o usa datos demo, luego "Analizar Riesgo"

## 📁 Estructura del Proyecto

```
hackathon_salud/
├── backend/
│   ├── main.py          # API FastAPI
│   ├── model.py         # Modelo de ML
│   └── requirements.txt
├── frontend/
│   ├── index.html       # Interfaz principal
│   ├── style.css        # Estilos
│   ├── app.js           # Lógica de aplicación
│   └── fhir-smart.js    # Integración FHIR
├── archive/
│   └── Chronic_Kidney_Dsease_data.csv
└── *.pkl                # Modelos entrenados
```

## 🔧 Tecnologías

- **Backend**: FastAPI, Python, scikit-learn, pandas
- **Frontend**: HTML5, CSS3, JavaScript (vanilla)
- **IA**: Random Forest, SMOTE, StandardScaler
- **Integración**: SMART on FHIR Client Library
- **Estándares**: LOINC, SNOMED CT

## 📝 Licencia

Proyecto desarrollado para hackathon de salud organizado por Uniovi.
