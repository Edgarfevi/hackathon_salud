let currentStep = 1;
window.lastResult = null; // Almacenar último resultado para exportación

function showStep(step) {
    // Hide all steps
    document.querySelectorAll('.form-step').forEach(el => el.classList.remove('active'));
    // Show current step
    document.getElementById(`step${step}`).classList.add('active');

    // Update sidebar
    document.querySelectorAll('.step').forEach(el => {
        const s = parseInt(el.dataset.step);
        el.classList.remove('active', 'completed');
        if (s === step) el.classList.add('active');
        if (s < step) el.classList.add('completed');
    });

    currentStep = step;
}

function validateStep(step) {
    const stepEl = document.getElementById(`step${step}`);
    const inputs = stepEl.querySelectorAll('input[required], select[required]');
    let valid = true;

    inputs.forEach(input => {
        if (!input.value) {
            valid = false;
            input.style.borderColor = '#ef4444';
        } else {
            input.style.borderColor = '#e2e8f0';
        }
    });
    return valid;
}

function navigateToStep(targetStep) {
    if (targetStep === currentStep) return;

    // Allow going back always
    if (targetStep < currentStep) {
        showStep(targetStep);
        return;
    }

    // Going forward - validate current step first
    if (targetStep > currentStep + 1) {
        alert('Por favor complete los pasos en orden.');
        return;
    }

    if (validateStep(currentStep)) {
        showStep(targetStep);
    } else {
        alert('Por favor complete todos los campos requeridos antes de continuar.');
    }
}

function nextStep(targetStep) {
    navigateToStep(targetStep);
}

function prevStep(targetStep) {
    navigateToStep(targetStep);
}

function resetForm() {
    document.getElementById('riskForm').reset();
    document.getElementById('result').classList.add('hidden');
    showStep(1);
}

document.getElementById('riskForm').addEventListener('submit', async function (e) {
    e.preventDefault();

    const submitBtn = document.getElementById('analyzeBtn');
    const originalBtnText = submitBtn.innerHTML;
    submitBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Analizando...';
    submitBtn.disabled = true;

    const formData = new FormData(e.target);
    const data = {};

    for (let [key, value] of formData.entries()) {
        if (!isNaN(value) && value !== '') {
            data[key] = parseFloat(value);
        } else {
            data[key] = value;
        }
    }

    try {
        const response = await fetch('/api/predict', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data),
        });

        if (!response.ok) throw new Error('Error en servidor');

        const result = await response.json();
        displayResult(result);
    } catch (error) {
        console.error('Error:', error);
        if (window.showNotification) {
            window.showNotification('Error al conectar con el servidor. Verifique que el backend esté ejecutándose.', 'error');
        } else {
            alert('Error al conectar con el servidor.');
        }
    } finally {
        submitBtn.innerHTML = originalBtnText;
        submitBtn.disabled = false;
    }
});


// Dynamic GFR Calculation (CKD-EPI)
function calculateGFR() {
    const age = parseFloat(document.querySelector('input[name="Age"]').value);
    const gender = parseInt(document.querySelector('select[name="Gender"]').value); // 0=Male, 1=Female
    const creatinine = parseFloat(document.querySelector('input[name="SerumCreatinine"]').value);

    if (!age || !creatinine) return;

    // CKD-EPI 2021 Formula
    const kappa = gender === 1 ? 0.7 : 0.9;
    const alpha = gender === 1 ? -0.241 : -0.302;

    const minRatio = Math.min(creatinine / kappa, 1.0);
    const maxRatio = Math.max(creatinine / kappa, 1.0);

    let egfr = 142 * Math.pow(minRatio, alpha) * Math.pow(maxRatio, -1.200) * Math.pow(0.9938, age);

    if (gender === 1) {
        egfr *= 1.012;
    }

    const gfrInput = document.querySelector('input[name="GFR"]');
    if (gfrInput) {
        gfrInput.value = egfr.toFixed(1);
    }
}

// Add listeners for GFR calculation
document.querySelector('input[name="Age"]')?.addEventListener('change', calculateGFR);
document.querySelector('select[name="Gender"]')?.addEventListener('change', calculateGFR);
document.querySelector('input[name="SerumCreatinine"]')?.addEventListener('change', calculateGFR);
document.querySelector('input[name="SerumCreatinine"]')?.addEventListener('keyup', calculateGFR); // Real-time update

function displayResult(result) {
    const resultCard = document.getElementById('result');
    const riskLabel = document.getElementById('riskLabel');
    const riskIndicator = document.getElementById('riskIndicator');
    const probabilitySpan = document.getElementById('probability');

    resultCard.classList.remove('hidden');

    const probability = (result.probability * 100).toFixed(1);
    probabilitySpan.innerText = `${probability}%`;

    // Update Gauge Visual
    const gaugeFill = document.getElementById('gaugeFill');
    if (gaugeFill) {
        // 0% = 0deg, 100% = 180deg
        const rotation = (result.probability * 180);
        gaugeFill.style.transform = `rotate(${rotation}deg)`;

        // Color based on risk
        if (result.probability > 0.5) {
            gaugeFill.style.backgroundColor = '#ef4444'; // Red
        } else {
            gaugeFill.style.backgroundColor = '#10b981'; // Green
        }
    }

    // Display eGFR if available
    if (result.egfr) {
        const egfrNote = document.createElement('div');
        egfrNote.className = 'egfr-info';
        egfrNote.style.cssText = 'margin-top: 1rem; padding: 1rem; background: #f0f9ff; border-left: 4px solid #3b82f6; border-radius: 4px;';

        let egfrHTML = `<strong>eGFR Calculado (CKD-EPI):</strong> ${result.egfr} ml/min/1.73m²<br>`;

        if (result.source === 'clinical_rule') {
            egfrHTML += `<span style="color: #dc2626; font-weight: bold;">⚠️ ${result.clinical_note}</span>`;
        } else if (result.clinical_note) {
            egfrHTML += `<span style="color: #059669;">${result.clinical_note}</span>`;
        }

        egfrNote.innerHTML = egfrHTML;
        riskIndicator.after(egfrNote);
    }

    if (result.risk_class === 1) {
        riskLabel.innerText = 'ALTO RIESGO';
        riskIndicator.className = 'risk-badge high';
    } else {
        riskLabel.innerText = 'BAJO RIESGO';
        riskIndicator.className = 'risk-badge low';
    }

    // Mostrar recomendaciones clínicas
    displayClinicalRecommendations(result);

    // Mostrar explicación (XAI)
    displayExplanation(result);

    // Mostrar gráfico de radar
    renderRadarChart(result);

    // Guardar resultado para exportación
    window.lastResult = result;
}

function displayClinicalRecommendations(result) {
    const recommendationsContainer = document.getElementById('clinicalRecommendations');
    const recommendationsList = document.getElementById('recommendationsList');

    if (!recommendationsContainer || !recommendationsList) return;

    const probability = result.probability;
    const isHighRisk = result.risk_class === 1;

    let recommendations = [];

    if (isHighRisk || probability > 0.3) {
        recommendations.push({
            text: 'Derivar a nefrología para evaluación especializada y seguimiento estrecho.',
            priority: 'high'
        });
        recommendations.push({
            text: 'Solicitar estudios complementarios: ecografía renal, análisis de orina completa y perfil lipídico.',
            priority: 'high'
        });
        recommendations.push({
            text: 'Revisar y optimizar control de factores de riesgo cardiovascular (HTA, diabetes, dislipidemia).',
            priority: 'high'
        });
        recommendations.push({
            text: 'Evaluar necesidad de ajuste de medicamentos nefrotóxicos (AINEs, contrastes, etc.).',
            priority: 'medium'
        });
    } else {
        recommendations.push({
            text: 'Seguimiento en atención primaria con control anual de función renal.',
            priority: 'medium'
        });
        recommendations.push({
            text: 'Mantener estilo de vida saludable: dieta equilibrada, ejercicio regular y control de peso.',
            priority: 'medium'
        });
        recommendations.push({
            text: 'Control periódico de presión arterial y glucemia si aplica.',
            priority: 'medium'
        });
    }

    if (probability > 0.15 && !isHighRisk) {
        recommendations.push({
            text: 'Considerar seguimiento más frecuente (cada 6 meses) y educación sobre factores de riesgo.',
            priority: 'medium'
        });
    }

    recommendationsList.innerHTML = recommendations.map(rec => `
        <div class="recommendation-item ${rec.priority === 'high' ? 'high-priority' : ''}">
            <i class="fa-solid ${rec.priority === 'high' ? 'fa-exclamation-circle' : 'fa-info-circle'}"></i>
            <div class="recommendation-text">${rec.text}</div>
        </div>
    `).join('');
}

function displayExplanation(result) {
    const container = document.getElementById('explanationSection');
    const list = document.getElementById('explanationList');

    if (!result.contributors || result.contributors.length === 0) {
        container.classList.add('hidden');
        return;
    }

    container.classList.remove('hidden');

    list.innerHTML = result.contributors.map(item => {
        const impactClass = item.impact > 0 ? 'impact-negative' : 'impact-positive';
        const impactIcon = item.impact > 0 ? 'fa-arrow-trend-up' : 'fa-arrow-trend-down';
        const impactText = item.impact > 0 ? 'Aumenta riesgo' : 'Reduce riesgo';

        // Formatear nombre de la característica para que sea legible
        const featureName = formatFeatureName(item.feature);

        return `
            <div class="explanation-item ${impactClass}">
                <div class="explanation-header">
                    <span class="feature-name">${featureName}</span>
                    <span class="feature-value">${(item.value !== undefined && item.value !== null) ? Number(item.value).toFixed(2) : '--'}</span>
                </div>
                <div class="explanation-impact">
                    <i class="fa-solid ${impactIcon}"></i> ${impactText}
                </div>
            </div>
        `;
    }).join('');
}

function formatFeatureName(feature) {
    const map = {
        'Age': 'Edad',
        'Gender': 'Género',
        'Ethnicity': 'Etnia',
        'SocioeconomicStatus': 'Nivel Socioeconómico',
        'EducationLevel': 'Nivel Educativo',
        'BMI': 'Índice de Masa Corporal (IMC)',
        'Smoking': 'Tabaquismo',
        'AlcoholConsumption': 'Consumo de Alcohol',
        'PhysicalActivity': 'Actividad Física',
        'FamilyHistoryKidneyDisease': 'Hist. Fam. Enfermedad Renal',
        'FamilyHistoryHypertension': 'Hist. Fam. Hipertensión',
        'FamilyHistoryDiabetes': 'Hist. Fam. Diabetes',
        'PreviousAcuteKidneyInjury': 'Lesión Renal Aguda Previa',
        'UrinaryTractInfections': 'Infecciones Urinarias',
        'SystolicBP': 'Presión Sistólica',
        'DiastolicBP': 'Presión Diastólica',
        'FastingBloodSugar': 'Glucosa en Ayunas',
        'HbA1c': 'Hemoglobina Glicosilada (HbA1c)',
        'SerumCreatinine': 'Creatinina Sérica',
        'BUN': 'Nitrógeno Ureico (BUN)',
        'GFR': 'Filtrado Glomerular (GFR)',
        'ProteinInUrine': 'Proteína en Orina',
        'ACR': 'Relación Albúmina/Creatinina',
        'SerumElectrolytesSodium': 'Sodio Sérico',
        'SerumElectrolytesPotassium': 'Potasio Sérico',
        'SerumElectrolytesCalcium': 'Calcio Sérico',
        'SerumElectrolytesPhosphorus': 'Fósforo Sérico',
        'HemoglobinLevels': 'Niveles de Hemoglobina',
        'CholesterolTotal': 'Colesterol Total',
        'CholesterolLDL': 'Colesterol LDL',
        'CholesterolHDL': 'Colesterol HDL',
        'CholesterolTriglycerides': 'Triglicéridos',
        'ACEInhibitors': 'Uso de Inhibidores ACE',
        'Diuretics': 'Uso de Diuréticos',
        'NSAIDsUse': 'Uso de AINEs',
        'Statins': 'Uso de Estatinas',
        'AntidiabeticMedications': 'Medicamentos Antidiabéticos',
        'Edema': 'Edema',
        'Fatigue': 'Fatiga',
        'NauseaVomiting': 'Náuseas/Vómitos',
        'MuscleCramps': 'Calambres Musculares',
        'Itching': 'Picazón (Prurito)',
        'HeavyMetalsExposure': 'Exposición a Metales Pesados',
        'OccupationalExposureChemicals': 'Exposición a Químicos',
        'MedicalCheckupsFrequency': 'Frecuencia Chequeos Médicos',
        'MedicationAdherence': 'Adherencia a Medicación',
        'HealthLiteracy': 'Alfabetización en Salud',
        'HistoryDiabetes': 'Antecedentes Diabetes',
        'HistoryCHD': 'Antecedentes Cardíacos (CHD)',
        'HistoryVascular': 'Antecedentes Vasculares',
        'HistoryHTN': 'Antecedentes Hipertensión',
        'HistoryDLD': 'Antecedentes Dislipidemia',
        'HistoryObesity': 'Antecedentes Obesidad',
        'HTNmeds': 'Medicación Hipertensión'
    };
    return map[feature] || feature;
}

let radarChartInstance = null;

function renderRadarChart(result) {
    const ctx = document.getElementById('riskRadarChart').getContext('2d');

    // Extraer valores del input original (necesitamos acceder a los datos enviados)
    // Como 'result' solo tiene la predicción, necesitamos recuperar los datos del formulario
    // O mejor, pasamos los datos del formulario a esta función.
    // Por simplicidad, leeremos del DOM ya que el formulario sigue lleno.

    const getData = (name) => parseFloat(document.querySelector(`[name="${name}"]`).value) || 0;

    // Definir métricas clave y sus rangos "normales" aproximados para normalizar
    // Normalizaremos tal que 50 sea el valor "óptimo/medio", 0 muy bajo, 100 muy alto.
    // Top 5 contributors
    const contributorsList = result.contributors || [];
    const topContributors = contributorsList.slice(0, 5);
    const labels = topContributors.map(c => formatFeatureName(c.feature));
    // Clamp values to 100 max for visual consistency
    const data = topContributors.map(c => {
        let val = Math.abs(c.impact) * 100;
        return Math.min(val, 100);
    });

    if (radarChartInstance) { // Use radarChartInstance here
        radarChartInstance.destroy();
    }

    radarChartInstance = new Chart(ctx, { // Assign to radarChartInstance
        type: 'radar',
        data: {
            labels: labels,
            datasets: [{
                label: 'Impacto en el Riesgo',
                data: data,
                backgroundColor: 'rgba(255, 99, 132, 0.2)',
                borderColor: 'rgba(255, 99, 132, 1)',
                borderWidth: 2,
                pointBackgroundColor: 'rgba(255, 99, 132, 1)'
            }]
        },
        options: {
            scales: {
                r: {
                    angleLines: {
                        display: false
                    },
                    suggestedMin: 0,
                    suggestedMax: 100,
                    ticks: {
                        display: false // Ocultar números del eje para limpieza visual
                    }
                }
            },
            plugins: {
                legend: {
                    position: 'bottom'
                }
            }
        }
    });
}

function exportResults(format) {
    if (!window.lastResult) {
        if (window.showNotification) {
            window.showNotification('No hay resultados para exportar', 'warning');
        } else {
            alert('No hay resultados para exportar');
        }
        return;
    }

    const formData = new FormData(document.getElementById('riskForm'));
    const patientData = {};
    for (let [key, value] of formData.entries()) {
        patientData[key] = value;
    }

    const exportData = {
        fecha: new Date().toISOString(),
        paciente: {
            nombre: document.getElementById('summaryPatientName')?.textContent || 'No disponible',
            edad: document.getElementById('summaryAge')?.textContent || 'No disponible',
            genero: document.getElementById('summaryGender')?.textContent || 'No disponible'
        },
        evaluacion: {
            riesgo: window.lastResult.risk_class === 1 ? 'ALTO RIESGO' : 'BAJO RIESGO',
            probabilidad: `${(window.lastResult.probability * 100).toFixed(1)}%`,
            clase_riesgo: window.lastResult.risk_class
        },
        datos_paciente: patientData,
        recomendaciones: Array.from(document.querySelectorAll('.recommendation-text')).map(el => el.textContent)
    };

    if (format === 'json') {
        const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `evaluacion_renal_${new Date().toISOString().split('T')[0]}.json`;
        a.click();
        URL.revokeObjectURL(url);
        if (window.showNotification) {
            window.showNotification('Resultados exportados en JSON', 'success');
        }
    } else if (format === 'pdf') {
        // Para PDF, usar una librería como jsPDF o simplemente abrir ventana de impresión
        const printWindow = window.open('', '_blank');
        printWindow.document.write(`
            <html>
                <head>
                    <title>Evaluación de Riesgo Renal</title>
                    <style>
                        body { font-family: Arial, sans-serif; padding: 2rem; }
                        h1 { color: #2563eb; }
                        .section { margin: 1.5rem 0; }
                        .risk-high { color: #ef4444; font-weight: bold; }
                        .risk-low { color: #10b981; font-weight: bold; }
                        table { width: 100%; border-collapse: collapse; margin: 1rem 0; }
                        td { padding: 0.5rem; border-bottom: 1px solid #ddd; }
                    </style>
                </head>
                <body>
                    <h1>Evaluación de Riesgo Renal - NephroMind</h1>
                    <div class="section">
                        <h2>Datos del Paciente</h2>
                        <p><strong>Nombre:</strong> ${exportData.paciente.nombre}</p>
                        <p><strong>Edad:</strong> ${exportData.paciente.edad}</p>
                        <p><strong>Género:</strong> ${exportData.paciente.genero}</p>
                        <p><strong>Fecha de Evaluación:</strong> ${new Date(exportData.fecha).toLocaleDateString('es-ES')}</p>
                    </div>
                    <div class="section">
                        <h2>Resultado de la Evaluación</h2>
                        <p><strong>Riesgo:</strong> <span class="${exportData.evaluacion.riesgo === 'ALTO RIESGO' ? 'risk-high' : 'risk-low'}">${exportData.evaluacion.riesgo}</span></p>
                        <p><strong>Probabilidad:</strong> ${exportData.evaluacion.probabilidad}</p>
                    </div>
                    <div class="section">
                        <h2>Recomendaciones Clínicas</h2>
                        <ul>
                            ${exportData.recomendaciones.map(rec => `<li>${rec}</li>`).join('')}
                        </ul>
                    </div>
                    <div class="section">
                        <p style="font-size: 0.9rem; color: #666; margin-top: 2rem;">
                            <em>Este resultado es una estimación basada en IA. Consulte siempre a un especialista.</em>
                        </p>
                    </div>
                </body>
            </html>
        `);
        printWindow.document.close();
        printWindow.print();
        if (window.showNotification) {
            window.showNotification('Preparando PDF para impresión', 'success');
        }
    }
}


// Drag & Drop Logic
const dropZone = document.getElementById('dropZone');
const fileInput = document.getElementById('fileInput');
const uploadLoading = document.getElementById('uploadLoading');
const uploadContent = document.querySelector('.upload-content');

if (dropZone) {
    dropZone.addEventListener('click', () => fileInput.click());

    dropZone.addEventListener('dragover', (e) => {
        e.preventDefault();
        dropZone.classList.add('dragover');
    });

    dropZone.addEventListener('dragleave', () => {
        dropZone.classList.remove('dragover');
    });

    dropZone.addEventListener('drop', (e) => {
        e.preventDefault();
        dropZone.classList.remove('dragover');
        const files = e.dataTransfer.files;
        if (files.length > 0 && files[0].type === 'application/pdf') {
            handleFileUpload(files[0]);
        } else {
            alert('Por favor sube un archivo PDF válido.');
        }
    });

    fileInput.addEventListener('change', (e) => {
        if (e.target.files.length > 0) {
            handleFileUpload(e.target.files[0]);
        }
    });
}

async function handleFileUpload(file) {
    uploadContent.classList.add('hidden');
    uploadLoading.classList.remove('hidden');

    const formData = new FormData();
    formData.append('file', file);

    try {
        const response = await fetch('/api/analyze_pdf', {
            method: 'POST',
            body: formData
        });

        if (!response.ok) throw new Error('Error en el análisis del PDF');

        const result = await response.json();

        // Populate form with extracted data
        populateForm(result.extracted_data);

        if (window.showNotification) {
            window.showNotification('Datos extraídos. Por favor revise el formulario y haga clic en "Analizar Riesgo"', 'info');
        } else {
            alert('Datos extraídos. Por favor revise el formulario y haga clic en "Analizar Riesgo"');
        }

        // Scroll to top to start review
        window.scrollTo({ top: 0, behavior: 'smooth' });

    } catch (error) {
        console.error('Error:', error);
        alert('Error al procesar el PDF. Asegúrate de que el backend esté corriendo.');
    } finally {
        uploadLoading.classList.add('hidden');
        uploadContent.classList.remove('hidden');
        // Reset file input
        fileInput.value = '';
    }
}

function populateForm(data) {
    for (const [key, value] of Object.entries(data)) {
        const input = document.querySelector(`[name="${key}"]`);
        if (input) {
            input.value = value;
            // Trigger change event for any listeners
            input.dispatchEvent(new Event('change'));
        }
    }

    // Update summary if available
    if (document.getElementById('summaryPatientName')) {
        document.getElementById('summaryPatientName').textContent = "Paciente (PDF)";
        if (data.Age) document.getElementById('summaryAge').textContent = `${data.Age} años`;
        if (data.Gender !== undefined) document.getElementById('summaryGender').textContent = data.Gender === 1 ? "Femenino" : "Masculino";
    }
}
