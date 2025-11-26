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
