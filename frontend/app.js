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
        const response = await fetch('http://localhost:8000/predict', {
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

function displayResult(result) {
    const resultCard = document.getElementById('result');
    const riskLabel = document.getElementById('riskLabel');
    const riskIndicator = document.getElementById('riskIndicator');
    const probabilitySpan = document.getElementById('probability');

    resultCard.classList.remove('hidden');

    const probability = (result.probability * 100).toFixed(1);
    probabilitySpan.innerText = `${probability}%`;

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

    // Intentar guardar en FHIR (si estamos conectados)
    if (window.sendRiskAssessment) {
        window.sendRiskAssessment(result);
    }
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
                    <span class="feature-value">${item.value.toFixed(2)}</span>
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
        'BMI': 'IMC',
        'SystolicBP': 'Presión Sistólica',
        'DiastolicBP': 'Presión Diastólica',
        'FastingBloodSugar': 'Glucosa en Ayunas',
        'HbA1c': 'HbA1c',
        'SerumCreatinine': 'Creatinina Sérica',
        'BUN': 'Nitrógeno Ureico (BUN)',
        'GFR': 'Filtrado Glomerular (GFR)',
        'ProteinInUrine': 'Proteína en Orina',
        'ACR': 'Albúmina/Creatinina',
        'HemoglobinLevels': 'Hemoglobina',
        'CholesterolTotal': 'Colesterol Total',
        'CholesterolLDL': 'Colesterol LDL',
        'CholesterolHDL': 'Colesterol HDL',
        'CholesterolTriglycerides': 'Triglicéridos'
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
    // Esto es una simplificación para visualización.

    const metrics = [
        { label: 'Presión Sistólica', value: getData('SystolicBP'), max: 180, optimal: 120 },
        { label: 'Glucosa', value: getData('FastingBloodSugar'), max: 200, optimal: 90 },
        { label: 'HbA1c', value: getData('HbA1c'), max: 12, optimal: 5.5 },
        { label: 'Creatinina', value: getData('SerumCreatinine'), max: 5, optimal: 0.9 },
        { label: 'IMC', value: getData('BMI'), max: 40, optimal: 22 },
        // GFR es inverso: mayor es mejor. Lo invertiremos para el gráfico (100 - valor) o lo mostramos directo
        // Para consistencia visual (mayor = más riesgo), usaremos 1/GFR o similar, 
        // PERO para un radar chart médico, mejor mostrar valores normalizados donde el centro es 0 y el borde es max.
        // Vamos a simplificar: mostrar % del valor máximo peligroso.
    ];

    const labels = metrics.map(m => m.label);
    const dataValues = metrics.map(m => {
        // Normalización simple: (valor / max) * 100
        let val = (m.value / m.max) * 100;
        return Math.min(Math.max(val, 0), 100); // Clamp 0-100
    });

    // Destruir gráfico anterior si existe
    if (radarChartInstance) {
        radarChartInstance.destroy();
    }

    radarChartInstance = new Chart(ctx, {
        type: 'radar',
        data: {
            labels: labels,
            datasets: [{
                label: 'Estado del Paciente',
                data: dataValues,
                fill: true,
                backgroundColor: 'rgba(37, 99, 235, 0.2)',
                borderColor: 'rgb(37, 99, 235)',
                pointBackgroundColor: 'rgb(37, 99, 235)',
                pointBorderColor: '#fff',
                pointHoverBackgroundColor: '#fff',
                pointHoverBorderColor: 'rgb(37, 99, 235)'
            }, {
                label: 'Límite de Riesgo',
                data: [70, 70, 60, 40, 75], // Valores arbitrarios de referencia visual
                fill: true,
                backgroundColor: 'rgba(255, 99, 132, 0.0)',
                borderColor: 'rgba(255, 99, 132, 0.5)',
                borderDash: [5, 5],
                pointRadius: 0
            }]
        },
        options: {
            elements: {
                line: {
                    borderWidth: 3
                }
            },
            scales: {
                r: {
                    angleLines: {
                        display: true
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
