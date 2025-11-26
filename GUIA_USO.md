# 📖 Guía de Uso - NephroMind

## 🎯 ¿Qué es NephroMind?

NephroMind es una herramienta web completa para **médicos de atención primaria** que permite evaluar el riesgo de enfermedad renal crónica (ERC) en pacientes usando inteligencia artificial.

## 🚀 Inicio Rápido

### Paso 1: Iniciar el Backend

**Opción A: Script Automático (Windows)**
- Doble clic en `iniciar_backend.bat`
- O ejecuta: `.\iniciar_backend.ps1` en PowerShell

**Opción B: Comando Manual**
```bash
cd backend
pip install -r requirements.txt
python -m uvicorn main:app --reload
```

**Verificar que funciona:**
- Abre: http://localhost:8000
- Deberías ver: `{"message": "CKD Risk Prediction API is running"}`
- Documentación API: http://localhost:8000/docs

### Paso 2: Abrir el Frontend

1. Abre el archivo `frontend/index.html` en tu navegador
2. O sirve con un servidor HTTP local:
   ```bash
   # Python
   cd frontend
   python -m http.server 8080
   # Luego abre: http://localhost:8080
   ```

## 🎮 Cómo Usar la Aplicación

### Opción 1: Modo Demo (Recomendado para Pruebas)

1. **Abre la aplicación** en el navegador
2. **Verás un banner amarillo** en la parte superior
3. **Clic en "Cargar Datos Demo"**
4. **Automáticamente se cargarán:**
   - Datos demográficos (María García López, 49 años)
   - Signos vitales (Presión: 145/92 mmHg)
   - Laboratorios (Creatinina: 1.35, GFR: 58, HbA1c: 6.8%)
   - Condiciones médicas (Hipertensión, Diabetes)
   - Medicamentos (Enalapril, Metformina, Atorvastatina)
5. **Se mostrará el panel de resumen** del paciente
6. **El formulario se prellenará** automáticamente
7. **Haz clic en "Analizar Riesgo"** para obtener el resultado

### Opción 2: Formulario Manual

1. **Completa el formulario paso a paso:**
   - **Paso 1**: Datos del Paciente (Edad, Género, Etnia, etc.)
   - **Paso 2**: Estilo de Vida (IMC, Tabaquismo, Alcohol, etc.)
   - **Paso 3**: Antecedentes Médicos (Historia familiar, infecciones, etc.)
   - **Paso 4**: Signos Vitales y Laboratorio (Presión, Creatinina, GFR, etc.)

2. **Navegación:**
   - Usa los botones "Siguiente" y "Atrás"
   - O haz clic en los pasos del sidebar para navegar
   - Los campos requeridos están marcados

3. **Al completar el Paso 4:**
   - Haz clic en "Analizar Riesgo"
   - El sistema procesará los datos con IA
   - Verás el resultado con probabilidad y recomendaciones

## 📊 Qué Verás en la Aplicación

### 1. Panel de Resumen del Paciente

Cuando cargas datos (demo o FHIR), verás un panel con:
- **Datos Demográficos**: Nombre, edad, género
- **Signos Vitales Recientes**: Presión arterial con fecha
- **Laboratorios Clave**: Creatinina, GFR, HbA1c
- **Medicamentos Activos**: Lista de medicamentos actuales
- **Indicador FHIR**: Muestra si los datos vienen del sistema hospitalario

### 2. Formulario Multi-paso

**Sidebar de Navegación:**
- Muestra los 4 pasos del formulario
- Indica el paso actual (azul)
- Muestra pasos completados (verde)
- Clickeable para navegar entre pasos

**Campos del Formulario:**
- Inputs con validación en tiempo real
- Placeholders con ejemplos
- Campos requeridos marcados
- Feedback visual al completar

### 3. Resultado del Análisis

Después de analizar, verás:

**Medidor Visual:**
- Gauge circular con porcentaje de riesgo
- Color verde (bajo riesgo) o rojo (alto riesgo)

**Badge de Riesgo:**
- "ALTO RIESGO" o "BAJO RIESGO"
- Color correspondiente al nivel

**Recomendaciones Clínicas:**
- Lista de recomendaciones basadas en el riesgo
- Prioridad alta (rojo) o media (azul)
- Sugerencias específicas para el caso

**Exportación:**
- Botón "Exportar PDF" - Genera PDF para impresión
- Botón "Exportar JSON" - Descarga datos en formato JSON

### 4. Notificaciones

- **Verde**: Operación exitosa (datos cargados, exportación)
- **Amarillo**: Advertencias (datos faltantes)
- **Rojo**: Errores (conexión fallida)

## 🔧 Funcionalidades Avanzadas

### Integración SMART on FHIR

Si tienes acceso a un servidor FHIR:
1. La aplicación detectará automáticamente el contexto SMART
2. Cargará datos reales del paciente
3. Prellenará el formulario automáticamente
4. Funciona igual que el modo demo, pero con datos reales

### Exportación de Resultados

**PDF:**
- Abre ventana de impresión
- Formato profesional con:
  - Datos del paciente
  - Resultado de evaluación
  - Recomendaciones clínicas
  - Fecha de evaluación

**JSON:**
- Descarga archivo JSON con:
  - Todos los datos del paciente
  - Resultado de la evaluación
  - Probabilidades
  - Recomendaciones
  - Fecha y hora

## 📱 Responsive Design

La aplicación se adapta a:
- **Desktop**: Vista completa con sidebar
- **Tablet**: Grids adaptados
- **Móvil**: Sidebar horizontal, formulario vertical

## 🎨 Características de Diseño

- **Diseño moderno** con colores profesionales
- **Espaciados consistentes** para mejor legibilidad
- **Transiciones suaves** en todas las interacciones
- **Iconos Font Awesome** para mejor UX
- **Tipografía Plus Jakarta Sans** para legibilidad

## ⚠️ Notas Importantes

1. **El backend debe estar corriendo** antes de usar el frontend
2. **Los datos demo son simulados** - solo para demostración
3. **Los resultados son estimaciones** - siempre consultar especialista
4. **El modelo requiere todos los campos** para mayor precisión

## 🐛 Solución de Problemas

### El backend no inicia
- Verifica Python: `python --version` (debe ser 3.8+)
- Instala dependencias: `pip install -r backend/requirements.txt`
- Ejecuta: `python verificar_backend.py` para diagnóstico

### El frontend no se conecta
- Verifica que el backend esté en http://localhost:8000
- Abre la consola del navegador (F12) para ver errores
- Verifica CORS en el backend

### Los datos demo no cargan
- Verifica que JavaScript esté habilitado
- Abre la consola del navegador para ver errores
- Recarga la página

## 📚 Archivos Importantes

- `frontend/index.html` - Interfaz principal
- `frontend/app.js` - Lógica de la aplicación
- `frontend/fhir-smart.js` - Integración FHIR
- `backend/main.py` - API REST
- `backend/model.py` - Modelo de IA
- `iniciar_backend.bat` - Script de inicio (Windows)

## 🎯 Flujo Completo de Uso

1. **Iniciar backend** → `iniciar_backend.bat`
2. **Abrir frontend** → `frontend/index.html`
3. **Cargar datos** → Clic en "Cargar Datos Demo" o completar formulario
4. **Revisar datos** → Panel de resumen del paciente
5. **Completar formulario** → Navegar por los 4 pasos
6. **Analizar riesgo** → Clic en "Analizar Riesgo"
7. **Ver resultado** → Medidor, badge, recomendaciones
8. **Exportar** → PDF o JSON según necesidad

---

**¡Listo para usar!** 🚀

Si tienes dudas, revisa el código o los comentarios en los archivos.

