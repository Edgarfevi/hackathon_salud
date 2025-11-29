// ========================================
// NephroMind - Sistema de Detección de ERC
// ========================================

let currentStep = 1;
window.lastResult = null;
window.calculatedGFR = null;
window.autoFilledFields = new Set();

// ========================================
// NAVIGATION & FORM STEPS
// ========================================

function showStep(step) {
    document.querySelectorAll('.form-step').forEach(el => el.classList.remove('active'));
    document.getElementById(`step${step}`).classList.add('active');

    document.querySelectorAll('.step').forEach(el => {
        const s = parseInt(el.dataset.step);
        el.classList.remove('active', 'completed');
        if (s === step) el.classList.add('active');
        if (s < step) el.classList.add('completed');
    });

    currentStep = step;
    updateCompleteness();
}

function validateStep(step) {
    const stepEl = document.getElementById(`step${step}`);
    const inputs = stepEl.querySelectorAll('input[required], select[required]');
    let valid = true;

    inputs.forEach(input => {
        if (!input.value || input.value === '') {
            valid = false;
            input.classList.add('error');
        } else {
            input.classList.remove('error');
        }
    });
    return valid;
}

function navigateToStep(targetStep) {
    if (targetStep === currentStep) return;

    if (targetStep < currentStep) {
        showStep(targetStep);
        return;
    }

    if (targetStep > currentStep + 1) {
        showNotification('Por favor complete los pasos en orden.', 'warning');
        return;
    }

    if (validateStep(currentStep)) {
        showStep(targetStep);
    } else {
        showNotification('Por favor complete todos los campos requeridos.', 'error');
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
    window.autoFilledFields.clear();
    showStep(1);
    updateCompleteness();
}

// ========================================
// NOTIFICATIONS
// ========================================

function showNotification(message, type = 'info') {
    const container = document.getElementById('notificationContainer') || document.body;
    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;
    
    const icons = {
        success: 'fa-check-circle',
        error: 'fa-times-circle',
        warning: 'fa-exclamation-triangle',
        info: 'fa-info-circle'
    };
    
    notification.innerHTML = `
        <i class="fa-solid ${icons[type] || icons.info}"></i>
        <span>${message}</span>
    `;
    
    container.appendChild(notification);
    
    setTimeout(() => {
        notification.style.animation = 'slideOut 0.3s ease forwards';
        setTimeout(() => notification.remove(), 300);
    }, 4000);
}

window.showNotification = showNotification;

// ========================================
// DATA COMPLETENESS INDICATOR
// ========================================

const CRITICAL_FIELDS = ['Age', 'Gender', 'BMI', 'SystolicBP', 'DiastolicBP', 'FastingBloodSugar', 'SerumCreatinine', 'GFR', 'ACR', 'ProteinInUrine'];
const ALL_FIELDS = [
    'Age', 'Gender', 'Ethnicity', 'SocioeconomicStatus', 'EducationLevel',
    'BMI', 'Smoking', 'AlcoholConsumption', 'PhysicalActivity',
    'HistoryHTN', 'HistoryDiabetes', 'HistoryCHD', 'HistoryVascular', 'HistoryDLD', 'HistoryObesity',
    'PreviousAcuteKidneyInjury', 'UrinaryTractInfections',
    'FamilyHistoryKidneyDisease', 'FamilyHistoryHypertension', 'FamilyHistoryDiabetes',
    'SystolicBP', 'DiastolicBP', 'FastingBloodSugar', 'HbA1c',
    'SerumCreatinine', 'GFR', 'BUN', 'ProteinInUrine', 'ACR',
    'SerumElectrolytesSodium', 'SerumElectrolytesPotassium', 'SerumElectrolytesCalcium', 'SerumElectrolytesPhosphorus',
    'HemoglobinLevels', 'CholesterolTotal', 'CholesterolLDL', 'CholesterolHDL', 'CholesterolTriglycerides',
    'ACEInhibitors', 'Diuretics', 'HTNmeds', 'Statins', 'AntidiabeticMedications', 'NSAIDsUse',
    'Edema', 'Fatigue', 'NauseaVomiting', 'MuscleCramps', 'Itching',
    'HeavyMetalsExposure', 'OccupationalExposureChemicals',
    'MedicalCheckupsFrequency', 'MedicationAdherence', 'HealthLiteracy'
];

function updateCompleteness() {
    let filledCount = 0;
    let missingCritical = [];
    
    ALL_FIELDS.forEach(field => {
        const input = document.querySelector(`[name="${field}"]`);
        if (input && input.value && input.value !== '') {
            filledCount++;
        }
    });
    
    CRITICAL_FIELDS.forEach(field => {
        const input = document.querySelector(`[name="${field}"]`);
        if (!input || !input.value || input.value === '') {
            missingCritical.push(field);
        }
    });
    
    const percentage = Math.round((filledCount / ALL_FIELDS.length) * 100);
    
    const fillEl = document.getElementById('completenessFill');
    const textEl = document.getElementById('completenessText');
    if (fillEl) {
        fillEl.style.width = `${percentage}%`;
        fillEl.style.backgroundColor = percentage > 70 ? '#10b981' : percentage > 40 ? '#f59e0b' : '#ef4444';
    }
    if (textEl) textEl.textContent = `${percentage}%`;
    
    // Update missing data alerts
    const alertsContainer = document.getElementById('missingDataAlerts');
    const missingList = document.getElementById('missingDataList');
    
    if (alertsContainer && missingList) {
        if (missingCritical.length > 0) {
            alertsContainer.classList.remove('hidden');
            missingList.innerHTML = missingCritical.map(field => 
                `<li><i class="fa-solid fa-circle-exclamation"></i> ${formatFeatureName(field)}</li>`
            ).join('');
        } else {
            alertsContainer.classList.add('hidden');
        }
    }
}

// ========================================
// eGFR CALCULATION (CKD-EPI 2021)
// ========================================

function calculateGFR() {
    const age = parseFloat(document.querySelector('input[name="Age"]')?.value);
    const gender = parseInt(document.querySelector('select[name="Gender"]')?.value);
    const creatinine = parseFloat(document.getElementById('creatinineInput')?.value);

    if (!age || isNaN(gender) || !creatinine) {
        document.getElementById('gfrInput').value = '';
        document.getElementById('gfrStage').textContent = 'ml/min/1.73m²';
        return;
    }

    // CKD-EPI 2021 Formula (race-free)
    const kappa = gender === 1 ? 0.7 : 0.9;
    const alpha = gender === 1 ? -0.241 : -0.302;

    const minRatio = Math.min(creatinine / kappa, 1.0);
    const maxRatio = Math.max(creatinine / kappa, 1.0);

    let egfr = 142 * Math.pow(minRatio, alpha) * Math.pow(maxRatio, -1.200) * Math.pow(0.9938, age);

    if (gender === 1) {
        egfr *= 1.012;
    }

    window.calculatedGFR = egfr;
    
    const gfrInput = document.getElementById('gfrInput');
    if (gfrInput) {
        gfrInput.value = egfr.toFixed(1);
    }
    
    // Update GFR stage display
    const stage = getGFRStage(egfr);
    const stageEl = document.getElementById('gfrStage');
    if (stageEl) {
        stageEl.innerHTML = `<strong style="color: ${stage.color}">${stage.stage}</strong> - ${stage.description}`;
    }
    
    updateCompleteness();
    validateCriticalValues();
}

function getGFRStage(gfr) {
    if (gfr >= 90) return { stage: 'G1', description: 'Normal o alto', color: '#10b981', risk: 'low' };
    if (gfr >= 60) return { stage: 'G2', description: 'Levemente disminuido', color: '#84cc16', risk: 'low' };
    if (gfr >= 45) return { stage: 'G3a', description: 'Leve-moderadamente disminuido', color: '#f59e0b', risk: 'moderate' };
    if (gfr >= 30) return { stage: 'G3b', description: 'Moderada-severamente disminuido', color: '#f97316', risk: 'high' };
    if (gfr >= 15) return { stage: 'G4', description: 'Severamente disminuido', color: '#ef4444', risk: 'very-high' };
    return { stage: 'G5', description: 'Falla renal', color: '#dc2626', risk: 'critical' };
}

// ========================================
// ACR STAGING (Albuminuria Categories)
// ========================================

function updateACRStage() {
    const acr = parseFloat(document.getElementById('acrInput')?.value);
    const stageEl = document.getElementById('acrStage');
    
    if (!acr || !stageEl) return;
    
    const stage = getACRStage(acr);
    stageEl.innerHTML = `<strong style="color: ${stage.color}">${stage.stage}</strong> - ${stage.description}`;
}

function getACRStage(acr) {
    if (acr < 30) return { stage: 'A1', description: 'Normal a leve', color: '#10b981', risk: 'low' };
    if (acr < 300) return { stage: 'A2', description: 'Moderadamente aumentada', color: '#f59e0b', risk: 'moderate' };
    return { stage: 'A3', description: 'Severamente aumentada', color: '#ef4444', risk: 'high' };
}

// ========================================
// KFRE CALCULATOR (Kidney Failure Risk Equation)
// ========================================

function calculateKFRE(age, gender, egfr, acr) {
    // 4-variable KFRE equation
    // Source: Tangri et al. JAMA 2016
    
    if (!egfr || egfr >= 60 || !acr) return null;
    
    // Log transform ACR
    const logACR = Math.log(acr);
    
    // 2-year risk
    const baseline2yr = 1 - 0.9832;
    const lp2yr = -0.2201 * (age/10 - 7.036) + 
                  0.2467 * (gender === 0 ? 1 : 0) - 
                  0.5567 * (egfr/5 - 7.222) + 
                  0.4510 * (logACR - 5.137);
    const risk2yr = 1 - Math.pow(1 - baseline2yr, Math.exp(lp2yr));
    
    // 5-year risk
    const baseline5yr = 1 - 0.9365;
    const lp5yr = -0.2201 * (age/10 - 7.036) + 
                  0.2467 * (gender === 0 ? 1 : 0) - 
                  0.5567 * (egfr/5 - 7.222) + 
                  0.4510 * (logACR - 5.137);
    const risk5yr = 1 - Math.pow(1 - baseline5yr, Math.exp(lp5yr));
    
    return {
        risk2yr: Math.min(Math.max(risk2yr * 100, 0), 100),
        risk5yr: Math.min(Math.max(risk5yr * 100, 0), 100)
    };
}

// ========================================
// CRITICAL VALUE ALERTS
// ========================================

const CRITICAL_RANGES = {
    SerumCreatinine: { min: 0.5, max: 1.5, criticalMax: 4.0, unit: 'mg/dL' },
    GFR: { min: 60, criticalMin: 15, unit: 'ml/min/1.73m²' },
    SystolicBP: { max: 140, criticalMax: 180, unit: 'mmHg' },
    DiastolicBP: { max: 90, criticalMax: 120, unit: 'mmHg' },
    FastingBloodSugar: { min: 70, max: 100, criticalMax: 200, unit: 'mg/dL' },
    HbA1c: { max: 5.7, criticalMax: 9.0, unit: '%' },
    SerumElectrolytesPotassium: { min: 3.5, max: 5.0, criticalMin: 2.5, criticalMax: 6.5, unit: 'mEq/L' },
    ACR: { max: 30, criticalMax: 300, unit: 'mg/g' },
    ProteinInUrine: { max: 0.15, criticalMax: 3.0, unit: 'g/L' },
    HemoglobinLevels: { min: 12, criticalMin: 8, unit: 'g/dL' }
};

function validateCriticalValues() {
    const alerts = [];
    
    for (const [field, ranges] of Object.entries(CRITICAL_RANGES)) {
        const input = document.querySelector(`[name="${field}"]`);
        if (!input || !input.value) continue;
        
        const value = parseFloat(input.value);
        
        if (ranges.criticalMin !== undefined && value < ranges.criticalMin) {
            alerts.push({
                field,
                value,
                unit: ranges.unit,
                type: 'critical',
                message: `${formatFeatureName(field)} críticamente bajo: ${value} ${ranges.unit}`
            });
            input.classList.add('critical-value');
        } else if (ranges.criticalMax !== undefined && value > ranges.criticalMax) {
            alerts.push({
                field,
                value,
                unit: ranges.unit,
                type: 'critical',
                message: `${formatFeatureName(field)} críticamente alto: ${value} ${ranges.unit}`
            });
            input.classList.add('critical-value');
        } else if (ranges.min !== undefined && value < ranges.min) {
            alerts.push({
                field,
                value,
                unit: ranges.unit,
                type: 'warning',
                message: `${formatFeatureName(field)} bajo: ${value} ${ranges.unit}`
            });
            input.classList.add('warning-value');
            input.classList.remove('critical-value');
        } else if (ranges.max !== undefined && value > ranges.max) {
            alerts.push({
                field,
                value,
                unit: ranges.unit,
                type: 'warning',
                message: `${formatFeatureName(field)} elevado: ${value} ${ranges.unit}`
            });
            input.classList.add('warning-value');
            input.classList.remove('critical-value');
        } else {
            input.classList.remove('critical-value', 'warning-value');
        }
    }
    
    return alerts;
}

// ========================================
// SUGGESTED TESTS
// ========================================

function getSuggestedTests(formData) {
    const tests = [];
    
    // If no creatinine
    if (!formData.SerumCreatinine) {
        tests.push({ name: 'Creatinina sérica', priority: 'high', reason: 'Esencial para calcular eGFR' });
    }
    
    // If no ACR/Proteinuria
    if (!formData.ACR && !formData.ProteinInUrine) {
        tests.push({ name: 'Cociente Albúmina/Creatinina en orina', priority: 'high', reason: 'Detecta daño renal temprano' });
    }
    
    // If diabetes suspected but no HbA1c
    if ((formData.HistoryDiabetes === 1 || formData.FastingBloodSugar > 126) && !formData.HbA1c) {
        tests.push({ name: 'HbA1c', priority: 'medium', reason: 'Control glucémico en diabéticos' });
    }
    
    // If GFR < 60, suggest additional tests
    const gfr = parseFloat(formData.GFR);
    if (gfr && gfr < 60) {
        tests.push({ name: 'Ecografía renal', priority: 'high', reason: 'Evaluación estructural del riñón' });
        tests.push({ name: 'Análisis de orina completo', priority: 'medium', reason: 'Detectar sedimento activo' });
        
        if (gfr < 45) {
            tests.push({ name: 'PTH y Vitamina D', priority: 'medium', reason: 'Metabolismo óseo-mineral en ERC' });
        }
    }
    
    // If hypertension
    if (formData.SystolicBP > 140 || formData.DiastolicBP > 90) {
        if (!formData.CholesterolTotal) {
            tests.push({ name: 'Perfil lipídico completo', priority: 'medium', reason: 'Riesgo cardiovascular' });
        }
    }
    
    return tests;
}

// ========================================
// FORM SUBMISSION & PREDICTION
// ========================================

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

    // Ensure GFR is set
    if (!data.GFR && window.calculatedGFR) {
        data.GFR = window.calculatedGFR;
    }

    try {
        const response = await fetch('/api/predict', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data),
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.detail || 'Error en servidor');
        }

        const result = await response.json();
        displayResult(result, data);
    } catch (error) {
        console.error('Error:', error);
        showNotification(`Error: ${error.message}`, 'error');
    } finally {
        submitBtn.innerHTML = originalBtnText;
        submitBtn.disabled = false;
    }
});

// ========================================
// DISPLAY RESULTS
// ========================================

function displayResult(result, formData) {
    const resultCard = document.getElementById('result');
    const riskLabel = document.getElementById('riskLabel');
    const riskIndicator = document.getElementById('riskIndicator');
    const probabilitySpan = document.getElementById('probability');

    resultCard.classList.remove('hidden');

    const probability = (result.probability * 100).toFixed(1);
    probabilitySpan.innerText = `${probability}%`;

    // Update Gauge
    const gaugeFill = document.getElementById('gaugeFill');
    if (gaugeFill) {
        const rotation = (result.probability * 180);
        gaugeFill.style.transform = `rotate(${rotation}deg)`;
        gaugeFill.style.backgroundColor = result.probability > 0.5 ? '#ef4444' : '#10b981';
    }

    // Risk Label
    if (result.risk_class === 1) {
        riskLabel.innerText = 'ALTO RIESGO DE ERC';
        riskIndicator.className = 'risk-badge high';
    } else {
        riskLabel.innerText = 'BAJO RIESGO DE ERC';
        riskIndicator.className = 'risk-badge low';
    }

    // ERC Staging Panel
    displayERCStaging(formData);
    
    // KFRE Risk
    displayKFRE(formData);

    // eGFR Info Panel
    displayEGFRInfo(formData);

    // Critical Alerts
    displayCriticalAlerts(formData);

    // Suggested Tests
    displaySuggestedTests(formData);

    // Clinical Recommendations
    displayClinicalRecommendations(result, formData);

    // XAI Explanation
    displayExplanation(result);

    // Radar Chart
    renderRadarChart(result);

    // Store for export
    window.lastResult = result;
    window.lastFormData = formData;
    
    // Scroll to results
    resultCard.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function displayERCStaging(formData) {
    const gfr = parseFloat(formData.GFR);
    const acr = parseFloat(formData.ACR);
    
    const gfrStageEl = document.getElementById('gfrStageValue');
    const acrStageEl = document.getElementById('acrStageValue');
    const ercGfrEl = document.getElementById('ercGfrStage');
    const ercAcrEl = document.getElementById('ercAcrStage');
    
    if (gfr && gfrStageEl) {
        const stage = getGFRStage(gfr);
        gfrStageEl.textContent = stage.stage;
        gfrStageEl.style.color = stage.color;
        ercGfrEl.className = `erc-gfr-stage risk-${stage.risk}`;
    }
    
    if (acr && acrStageEl) {
        const stage = getACRStage(acr);
        acrStageEl.textContent = stage.stage;
        acrStageEl.style.color = stage.color;
        ercAcrEl.className = `erc-acr-stage risk-${stage.risk}`;
    }
}

function displayKFRE(formData) {
    const kfreSection = document.getElementById('kfreSection');
    const gfr = parseFloat(formData.GFR);
    const acr = parseFloat(formData.ACR);
    const age = parseFloat(formData.Age);
    const gender = parseInt(formData.Gender);
    
    if (gfr && gfr < 60 && acr) {
        const kfre = calculateKFRE(age, gender, gfr, acr);
        if (kfre) {
            kfreSection.classList.remove('hidden');
            document.getElementById('kfre2year').textContent = `${kfre.risk2yr.toFixed(1)}%`;
            document.getElementById('kfre5year').textContent = `${kfre.risk5yr.toFixed(1)}%`;
            
            // Color code based on risk
            const risk2el = document.getElementById('kfre2year');
            const risk5el = document.getElementById('kfre5year');
            risk2el.style.color = kfre.risk2yr > 10 ? '#ef4444' : kfre.risk2yr > 5 ? '#f59e0b' : '#10b981';
            risk5el.style.color = kfre.risk5yr > 20 ? '#ef4444' : kfre.risk5yr > 10 ? '#f59e0b' : '#10b981';
        }
    } else {
        kfreSection.classList.add('hidden');
    }
}

function displayEGFRInfo(formData) {
    const panel = document.getElementById('egfrInfoPanel');
    const gfr = parseFloat(formData.GFR);
    
    if (!gfr || !panel) return;
    
    const stage = getGFRStage(gfr);
    panel.classList.remove('hidden');
    
    let html = `
        <div class="egfr-header">
            <strong>eGFR Calculado (CKD-EPI 2021):</strong> ${gfr.toFixed(1)} ml/min/1.73m²
        </div>
        <div class="egfr-stage" style="color: ${stage.color}">
            <strong>Estadio ERC:</strong> ${stage.stage} - ${stage.description}
        </div>
    `;
    
    if (gfr < 60) {
        html += `<div class="egfr-alert critical">⚠️ eGFR < 60: Enfermedad Renal Crónica confirmada (según KDIGO)</div>`;
    } else if (gfr < 90) {
        html += `<div class="egfr-alert warning">⚠️ eGFR 60-89: Monitorizar función renal periódicamente</div>`;
    } else {
        html += `<div class="egfr-alert success">✓ Función renal dentro de límites normales</div>`;
    }
    
    panel.innerHTML = html;
}

function displayCriticalAlerts(formData) {
    const container = document.getElementById('criticalAlerts');
    const list = document.getElementById('criticalAlertsList');
    const alerts = validateCriticalValues();
    
    if (alerts.length === 0) {
        container.classList.add('hidden');
        return;
    }
    
    container.classList.remove('hidden');
    list.innerHTML = alerts.map(alert => `
        <div class="alert-item ${alert.type}">
            <i class="fa-solid ${alert.type === 'critical' ? 'fa-circle-exclamation' : 'fa-triangle-exclamation'}"></i>
            <span>${alert.message}</span>
        </div>
    `).join('');
}

function displaySuggestedTests(formData) {
    const container = document.getElementById('suggestedTests');
    const list = document.getElementById('suggestedTestsList');
    const tests = getSuggestedTests(formData);
    
    if (tests.length === 0) {
        container.classList.add('hidden');
        return;
    }
    
    container.classList.remove('hidden');
    list.innerHTML = tests.map(test => `
        <div class="test-item priority-${test.priority}">
            <div class="test-name">
                <i class="fa-solid fa-vial"></i>
                <strong>${test.name}</strong>
            </div>
            <div class="test-reason">${test.reason}</div>
        </div>
    `).join('');
}

function displayClinicalRecommendations(result, formData) {
    const container = document.getElementById('clinicalRecommendations');
    const list = document.getElementById('recommendationsList');

    if (!container || !list) return;

    const probability = result.probability;
    const isHighRisk = result.risk_class === 1;
    const gfr = parseFloat(formData.GFR);
    const acr = parseFloat(formData.ACR);

    let recommendations = [];

    // Based on GFR staging
    if (gfr && gfr < 30) {
        recommendations.push({
            text: 'URGENTE: Derivar a nefrología. Estadio G4-G5 requiere seguimiento especializado.',
            priority: 'critical'
        });
        recommendations.push({
            text: 'Evaluar necesidad de preparación para terapia renal sustitutiva.',
            priority: 'critical'
        });
    } else if (gfr && gfr < 60) {
        recommendations.push({
            text: 'Derivar a nefrología para evaluación y plan de manejo conjunto.',
            priority: 'high'
        });

        recommendations.push({
            text: 'Control cada 3-6 meses de función renal y albuminuria.',
            priority: 'high'
        });
    }

    // Based on ACR
    if (acr && acr >= 300) {
        recommendations.push({
            text: 'Albuminuria severamente aumentada (A3). Iniciar/optimizar IECA o ARA-II.',
            priority: 'high'
        });
    } else if (acr && acr >= 30) {
        recommendations.push({
            text: 'Albuminuria moderada (A2). Considerar nefroprotección con IECA/ARA-II.',
            priority: 'medium'
        });
    }

    // Based on risk prediction
    if (isHighRisk || probability > 0.3) {
        recommendations.push({
            text: 'Solicitar estudios complementarios: ecografía renal, perfil lipídico completo.',
            priority: 'high'
        });

        recommendations.push({
            text: 'Optimizar control de factores de riesgo: HTA, diabetes, dislipidemia.',
            priority: 'high'
        });
        recommendations.push({
            text: 'Revisar medicación nefrotóxica (AINEs, contrastes yodados).',
            priority: 'medium'
        });
    }

    // General recommendations
    if (!isHighRisk && probability < 0.3) {
        recommendations.push({
            text: 'Seguimiento anual en atención primaria con control de función renal.',
            priority: 'medium'
        });
        recommendations.push({
            text: 'Mantener estilo de vida saludable: dieta, ejercicio, control de peso.',
            priority: 'medium'
        });
    }

    // Diabetes-specific
    if (formData.HistoryDiabetes === 1 || formData.FastingBloodSugar > 126) {
        recommendations.push({
            text: 'Optimizar control glucémico (objetivo HbA1c < 7% según KDIGO).',
            priority: 'high'
        });
        recommendations.push({
            text: 'Considerar inhibidores SGLT2 por beneficio renal demostrado.',
            priority: 'medium'
        });
    }

    list.innerHTML = recommendations.map(rec => `
        <div class="recommendation-item ${rec.priority === 'critical' ? 'critical-priority' : rec.priority === 'high' ? 'high-priority' : ''}">
            <i class="fa-solid ${rec.priority === 'critical' ? 'fa-skull-crossbones' : rec.priority === 'high' ? 'fa-exclamation-circle' : 'fa-info-circle'}"></i>
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
        'BUNLevels': 'Nitrógeno Ureico (BUN)',
        'GFR': 'Filtrado Glomerular (eGFR)',
        'ProteinInUrine': 'Proteína en Orina',
        'ACR': 'Ratio Albúmina/Creatinina',
        'SerumElectrolytesSodium': 'Sodio Sérico',
        'SerumElectrolytesPotassium': 'Potasio Sérico',
        'SerumElectrolytesCalcium': 'Calcio Sérico',
        'SerumElectrolytesPhosphorus': 'Fósforo Sérico',
        'HemoglobinLevels': 'Niveles de Hemoglobina',
        'CholesterolTotal': 'Colesterol Total',
        'CholesterolLDL': 'Colesterol LDL',
        'CholesterolHDL': 'Colesterol HDL',
        'CholesterolTriglycerides': 'Triglicéridos',
        'ACEInhibitors': 'Uso de IECA/ARA-II',
        'Diuretics': 'Uso de Diuréticos',
        'NSAIDsUse': 'Uso de AINEs',
        'Statins': 'Uso de Estatinas',
        'AntidiabeticMedications': 'Medicamentos Antidiabéticos',
        'Edema': 'Edema',
        'Fatigue': 'Fatiga',
        'FatigueLevels': 'Fatiga',
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

// ========================================
// RADAR CHART
// ========================================

let radarChartInstance = null;

function renderRadarChart(result) {
    const ctx = document.getElementById('riskRadarChart').getContext('2d');

    const contributorsList = result.contributors || [];
    const topContributors = contributorsList.slice(0, 5);
    const labels = topContributors.map(c => formatFeatureName(c.feature));
    const data = topContributors.map(c => {
        let val = Math.abs(c.impact) * 100;
        return Math.min(val, 100);
    });

    if (radarChartInstance) {
        radarChartInstance.destroy();
    }

    radarChartInstance = new Chart(ctx, {
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
                    angleLines: { display: false },
                    suggestedMin: 0,
                    suggestedMax: 100,
                    ticks: { display: false }
                }
            },
            plugins: {
                legend: { position: 'bottom' }
            }
        }
    });
}

// ========================================
// EXPORT FUNCTIONS
// ========================================

function exportResults(format) {
    if (!window.lastResult) {
        showNotification('No hay resultados para exportar', 'warning');
        return;
    }

    const formData = window.lastFormData || {};
    const gfr = parseFloat(formData.GFR);
    const acr = parseFloat(formData.ACR);

    const exportData = {
        fecha: new Date().toISOString(),
        paciente: {
            edad: formData.Age,
            genero: formData.Gender === 0 ? 'Masculino' : 'Femenino'
        },
        clasificacion_erc: {
            estadio_gfr: gfr ? getGFRStage(gfr).stage : 'N/D',
            categoria_acr: acr ? getACRStage(acr).stage : 'N/D',
            egfr_valor: gfr ? gfr.toFixed(1) : 'N/D',
            acr_valor: acr || 'N/D'
        },
        evaluacion_ia: {
            riesgo: window.lastResult.risk_class === 1 ? 'ALTO RIESGO' : 'BAJO RIESGO',
            probabilidad: `${(window.lastResult.probability * 100).toFixed(1)}%`,
            factores_principales: window.lastResult.contributors?.slice(0, 5).map(c => ({
                factor: formatFeatureName(c.feature),
                impacto: c.impact > 0 ? 'Aumenta riesgo' : 'Reduce riesgo'
            })) || []
        },
        datos_clinicos: formData,
        recomendaciones: Array.from(document.querySelectorAll('.recommendation-text')).map(el => el.textContent)
    };

    if (format === 'json') {
        const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `nephromind_evaluacion_${new Date().toISOString().split('T')[0]}.json`;
        a.click();
        URL.revokeObjectURL(url);
        showNotification('Resultados exportados en JSON', 'success');
    } else if (format === 'pdf') {
        const printWindow = window.open('', '_blank');
        const gfrStage = gfr ? getGFRStage(gfr) : null;
        const acrStage = acr ? getACRStage(acr) : null;
        
        printWindow.document.write(`
            <html>
                <head>
                    <title>Evaluación NephroMind - ERC</title>
                    <style>
                        body { font-family: Arial, sans-serif; padding: 2rem; max-width: 800px; margin: 0 auto; }
                        h1 { color: #2563eb; border-bottom: 2px solid #2563eb; padding-bottom: 10px; }
                        h2 { color: #1e40af; margin-top: 2rem; }
                        .section { margin: 1.5rem 0; padding: 1rem; background: #f8fafc; border-radius: 8px; }
                        .risk-high { color: #ef4444; font-weight: bold; font-size: 1.2em; }
                        .risk-low { color: #10b981; font-weight: bold; font-size: 1.2em; }
                        table { width: 100%; border-collapse: collapse; margin: 1rem 0; }
                        th, td { padding: 0.75rem; border: 1px solid #e2e8f0; text-align: left; }
                        th { background: #f1f5f9; }
                        .erc-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; }
                        .erc-box { padding: 1rem; border-radius: 8px; text-align: center; }
                        .erc-gfr { background: ${gfrStage?.color}20; border: 2px solid ${gfrStage?.color}; }
                        .erc-acr { background: ${acrStage?.color}20; border: 2px solid ${acrStage?.color}; }
                        ul { list-style-type: disc; padding-left: 1.5rem; }
                        li { margin: 0.5rem 0; }
                        .footer { margin-top: 2rem; padding-top: 1rem; border-top: 1px solid #e2e8f0; font-size: 0.9rem; color: #64748b; }
                    </style>
                </head>
                <body>
                    <h1>🩺 Evaluación de Riesgo Renal - NephroMind</h1>
                    
                    <div class="section">
                        <h2>Datos del Paciente</h2>
                        <table>
                            <tr><th>Edad</th><td>${exportData.paciente.edad} años</td></tr>
                            <tr><th>Género</th><td>${exportData.paciente.genero}</td></tr>
                            <tr><th>Fecha de Evaluación</th><td>${new Date().toLocaleDateString('es-ES')}</td></tr>
                        </table>
                    </div>
                    
                    <div class="section">
                        <h2>Clasificación ERC (KDIGO)</h2>
                        <div class="erc-grid">
                            <div class="erc-box erc-gfr">
                                <strong>Estadio GFR</strong><br>
                                <span style="font-size: 2em; color: ${gfrStage?.color}">${gfrStage?.stage || 'N/D'}</span><br>
                                <small>eGFR: ${gfr?.toFixed(1) || 'N/D'} ml/min/1.73m²</small>
                            </div>
                            <div class="erc-box erc-acr">
                                <strong>Categoría Albuminuria</strong><br>
                                <span style="font-size: 2em; color: ${acrStage?.color}">${acrStage?.stage || 'N/D'}</span><br>
                                <small>ACR: ${acr || 'N/D'} mg/g</small>
                            </div>
                        </div>
                    </div>
                    
                    <div class="section">
                        <h2>Resultado de la Evaluación IA</h2>
                        <p><strong>Riesgo:</strong> <span class="${exportData.evaluacion_ia.riesgo === 'ALTO RIESGO' ? 'risk-high' : 'risk-low'}">${exportData.evaluacion_ia.riesgo}</span></p>
                        <p><strong>Probabilidad:</strong> ${exportData.evaluacion_ia.probabilidad}</p>
                        
                        <h3>Factores Principales</h3>
                        <ul>
                            ${exportData.evaluacion_ia.factores_principales.map(f => `<li><strong>${f.factor}:</strong> ${f.impacto}</li>`).join('')}
                        </ul>
                    </div>
                    
                    <div class="section">
                        <h2>Recomendaciones Clínicas</h2>
                        <ul>
                            ${exportData.recomendaciones.map(rec => `<li>${rec}</li>`).join('')}
                        </ul>
                    </div>
                    
                    <div class="footer">
                        <p><em>⚠️ Este informe es generado por un sistema de IA y no sustituye el juicio clínico profesional. 
                        Basado en guías KDIGO 2024. Consulte siempre a un especialista en nefrología para casos complejos.</em></p>
                        <p>Generado por NephroMind - Sistema de Detección Temprana de ERC</p>
                    </div>
                </body>
            </html>
        `);
        printWindow.document.close();
        printWindow.print();
        showNotification('Preparando PDF para impresión', 'success');
    }
}

// ========================================
// PDF UPLOAD & PROCESSING
// ========================================

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
            showNotification('Por favor sube un archivo PDF válido.', 'error');
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

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.detail || 'Error en el análisis del PDF');
        }

        const result = await response.json();

        // Populate form with extracted data
        populateForm(result.extracted_data);

        // Show extraction summary
        document.getElementById('extractionSummary').classList.remove('hidden');
        
        showNotification('✅ Datos extraídos del PDF. Por favor revise y complete los campos faltantes.', 'success');

        // Scroll to top to review
        window.scrollTo({ top: 0, behavior: 'smooth' });

    } catch (error) {
        console.error('Error:', error);
        showNotification(`Error al procesar el PDF: ${error.message}`, 'error');
    } finally {
        uploadLoading.classList.add('hidden');
        uploadContent.classList.remove('hidden');
        fileInput.value = '';
    }
}

function populateForm(data) {
    window.autoFilledFields.clear();
    
    for (const [key, value] of Object.entries(data)) {
        if (value === null || value === undefined || value === '') continue;
        
        const input = document.querySelector(`[name="${key}"]`);
        if (input) {
            input.value = value;
            input.classList.add('auto-filled');
            window.autoFilledFields.add(key);
            
            // Trigger change event for listeners
            input.dispatchEvent(new Event('change'));
            
            // Highlight animation
            input.classList.add('highlight-transition');
            setTimeout(() => input.classList.remove('highlight-transition'), 2000);
        }
    }

    // Recalculate GFR if creatinine was filled
    if (data.SerumCreatinine) {
        calculateGFR();
    }
    
    // Update ACR staging
    if (data.ACR) {
        updateACRStage();
    }

    updateCompleteness();
}

// ========================================
// EVENT LISTENERS
// ========================================

// GFR auto-calculation listeners
document.querySelector('input[name="Age"]')?.addEventListener('change', calculateGFR);
document.querySelector('select[name="Gender"]')?.addEventListener('change', calculateGFR);
document.getElementById('creatinineInput')?.addEventListener('input', calculateGFR);

// ACR staging listener
document.getElementById('acrInput')?.addEventListener('input', updateACRStage);

// Completeness update on any input change
document.querySelectorAll('input, select').forEach(input => {
    input.addEventListener('change', updateCompleteness);
});

// Critical value validation on input
Object.keys(CRITICAL_RANGES).forEach(field => {
    const input = document.querySelector(`[name="${field}"]`);
    if (input) {
        input.addEventListener('change', validateCriticalValues);
    }
});

// ========================================
// CASO LAURA - DEMO
// ========================================

/**
 * Carga el caso de Laura: Mujer de 61 años, hipertensa, con fatiga.
 * Este es el caso típico del 80% de pacientes que desarrollan ERC sin diagnóstico.
 */
function loadLauraCase() {
    const lauraData = {
        // Demografía
        Age: 61,
        Gender: 1, // Femenino
        Ethnicity: 3, // Hispano
        SocioeconomicStatus: 1, // Medio
        EducationLevel: 1, // Secundaria
        
        // Estilo de vida
        BMI: 27.5, // Sobrepeso leve
        Smoking: 0,
        AlcoholConsumption: 2,
        PhysicalActivity: 1.5, // Sedentaria
        
        // Historial - El problema: Solo sabe que tiene HTA
        HistoryHTN: 1, // ¡5 años con hipertensión!
        HistoryDiabetes: 0,
        HistoryCHD: 0,
        HistoryVascular: 0,
        HistoryDLD: 0,
        HistoryObesity: 0,
        PreviousAcuteKidneyInjury: 0,
        UrinaryTractInfections: 0,
        
        // Antecedentes familiares
        FamilyHistoryKidneyDisease: 0,
        FamilyHistoryHypertension: 1,
        FamilyHistoryDiabetes: 1,
        
        // Signos vitales - HTA no bien controlada
        SystolicBP: 145,
        DiastolicBP: 88,
        
        // Labs - Aquí está el problema oculto
        FastingBloodSugar: 105, // Prediabetes
        HbA1c: 6.1, // Prediabetes
        SerumCreatinine: 1.4, // ¡ELEVADA! Pero pasa desapercibida
        BUN: 22,
        // GFR se calculará automáticamente -> ~42 ml/min (¡ERC G3b!)
        ProteinInUrine: 0.2,
        ACR: 45, // ¡Albuminuria moderada A2!
        
        // Electrolitos normales
        SerumElectrolytesSodium: 139,
        SerumElectrolytesPotassium: 4.8,
        SerumElectrolytesCalcium: 9.2,
        SerumElectrolytesPhosphorus: 3.8,
        HemoglobinLevels: 11.8, // Anemia leve - común en ERC
        
        // Perfil lipídico
        CholesterolTotal: 215,
        CholesterolLDL: 125,
        CholesterolHDL: 48,
        CholesterolTriglycerides: 165,
        
        // Medicación - Solo toma antihipertensivo
        ACEInhibitors: 0, // ¡No toma! Debería
        Diuretics: 0,
        HTNmeds: 1, // Otro tipo de antihipertensivo
        Statins: 0,
        AntidiabeticMedications: 0,
        NSAIDsUse: 3, // Usa ibuprofeno frecuentemente para dolores
        
        // Síntomas - El cansancio que ella atribuye a la edad
        Edema: 0,
        Fatigue: 1, // ¡SÍNTOMA CLAVE!
        NauseaVomiting: 0,
        MuscleCramps: 1, // Calambres ocasionales
        Itching: 0,
        
        // Otros
        HeavyMetalsExposure: 0,
        OccupationalExposureChemicals: 0,
        MedicalCheckupsFrequency: 1,
        MedicationAdherence: 7,
        HealthLiteracy: 5
    };
    
    // Poblar el formulario
    populateForm(lauraData);
    
    // Ocultar el banner de demo
    document.getElementById('demoBanner').style.display = 'none';
    
    // Mostrar mensaje
    showNotification('✅ Caso Laura cargado. Esta paciente representa el 80% de casos no diagnosticados. Revise los datos y analice el riesgo.', 'info');
    
    // Mostrar contexto clínico
    showClinicalContext({
        name: 'Laura',
        age: 61,
        mainCondition: 'Hipertensión (5 años)',
        chiefComplaint: 'Fatiga que atribuye a la edad',
        riskFactors: ['HTA mal controlada', 'Sedentarismo', 'Uso frecuente de AINEs', 'Prediabetes no diagnosticada']
    });
}

function showClinicalContext(patient) {
    // Crear panel de contexto si no existe
    let contextPanel = document.getElementById('clinicalContextPanel');
    if (!contextPanel) {
        contextPanel = document.createElement('div');
        contextPanel.id = 'clinicalContextPanel';
        contextPanel.className = 'clinical-context';
        
        const header = document.querySelector('header');
        header.after(contextPanel);
    }
    
    contextPanel.innerHTML = `
        <div class="context-header">
            <i class="fa-solid fa-user-doctor"></i>
            <span>Contexto Clínico: ${patient.name}, ${patient.age} años</span>
        </div>
        <p style="font-size: 0.85rem; color: #64748b; margin-bottom: 0.75rem;">
            <strong>Motivo de consulta:</strong> ${patient.chiefComplaint}<br>
            <strong>Antecedente principal:</strong> ${patient.mainCondition}
        </p>
        <div class="context-tags">
            ${patient.riskFactors.map(rf => `
                <span class="context-tag active">
                    <i class="fa-solid fa-exclamation"></i> ${rf}
                </span>
            `).join('')}
        </div>
    `;
}

// ========================================
// CARDIO-RENAL RISK SCORE
// ========================================

function calculateCardioRenalRisk(formData) {
    let score = 0;
    let factors = [];
    
    // Age risk
    const age = parseFloat(formData.Age);
    if (age >= 65) { score += 2; factors.push('Edad ≥65'); }
    else if (age >= 55) { score += 1; factors.push('Edad 55-64'); }
    
    // Hypertension
    if (formData.HistoryHTN === 1 || formData.SystolicBP > 140) {
        score += 2;
        factors.push('Hipertensión');
    }
    
    // Diabetes
    if (formData.HistoryDiabetes === 1 || formData.HbA1c > 6.5) {
        score += 2;
        factors.push('Diabetes/Prediabetes');
    }
    
    // GFR
    const gfr = parseFloat(formData.GFR);
    if (gfr && gfr < 30) { score += 4; factors.push('ERC G4-G5'); }
    else if (gfr && gfr < 45) { score += 3; factors.push('ERC G3b'); }
    else if (gfr && gfr < 60) { score += 2; factors.push('ERC G3a'); }
    
    // Albuminuria
    const acr = parseFloat(formData.ACR);
    if (acr && acr >= 300) { score += 3; factors.push('Albuminuria severa'); }
    else if (acr && acr >= 30) { score += 2; factors.push('Albuminuria moderada'); }
    
    // Cardiovascular history
    if (formData.HistoryCHD === 1) { score += 2; factors.push('Enfermedad coronaria'); }
    if (formData.HistoryVascular === 1) { score += 1; factors.push('Enfermedad vascular'); }
    
    // Lipids
    if (formData.CholesterolLDL > 130) { score += 1; factors.push('LDL elevado'); }
    
    // Smoking
    if (formData.Smoking === 1) { score += 1; factors.push('Tabaquismo'); }
    
    // BMI
    if (formData.BMI > 30) { score += 1; factors.push('Obesidad'); }
    
    // Risk category
    let category, color;
    if (score >= 8) { category = 'MUY ALTO'; color = '#dc2626'; }
    else if (score >= 5) { category = 'ALTO'; color = '#f97316'; }
    else if (score >= 3) { category = 'MODERADO'; color = '#f59e0b'; }
    else { category = 'BAJO'; color = '#10b981'; }
    
    return { score, category, color, factors };
}

function displayCardioRenalRisk(formData) {
    const risk = calculateCardioRenalRisk(formData);
    const gfr = parseFloat(formData.GFR);
    const acr = parseFloat(formData.ACR);
    
    // Crear o actualizar panel
    let panel = document.getElementById('cardioRenalPanel');
    if (!panel) {
        panel = document.createElement('div');
        panel.id = 'cardioRenalPanel';
        panel.className = 'cardio-renal-panel';
        
        const ercStaging = document.getElementById('ercStaging');
        if (ercStaging) ercStaging.after(panel);
    }
    
    const gfrStage = gfr ? getGFRStage(gfr) : null;
    const acrStage = acr ? getACRStage(acr) : null;
    
    panel.innerHTML = `
        <h3><i class="fa-solid fa-heart-pulse"></i> Riesgo Cardio-Renal Integrado</h3>
        <div class="cardio-renal-grid">
            <div class="risk-metric">
                <div class="risk-metric-label">Score Total</div>
                <div class="risk-metric-value" style="color: ${risk.color}">${risk.score}</div>
            </div>
            <div class="risk-metric">
                <div class="risk-metric-label">Categoría</div>
                <div class="risk-metric-value" style="color: ${risk.color}; font-size: 0.9rem;">${risk.category}</div>
            </div>
            <div class="risk-metric">
                <div class="risk-metric-label">Riesgo CV a 10 años</div>
                <div class="risk-metric-value ${risk.score >= 5 ? 'high' : risk.score >= 3 ? 'moderate' : 'low'}">
                    ${risk.score >= 8 ? '>30%' : risk.score >= 5 ? '15-30%' : risk.score >= 3 ? '5-15%' : '<5%'}
                </div>
            </div>
        </div>
        <p style="font-size: 0.75rem; color: #92400e; margin-top: 0.75rem;">
            <strong>Factores de riesgo:</strong> ${risk.factors.join(' • ')}
        </p>
    `;
}

// Actualizar displayResult para incluir cardio-renal
const originalDisplayResult = displayResult;
displayResult = function(result, formData) {
    originalDisplayResult(result, formData);
    displayCardioRenalRisk(formData);
};

// ========================================
// FHIR EXPORT (Interoperabilidad)
// ========================================

function exportToFHIR(formData, result) {
    // Crear recurso Patient FHIR R4
    const fhirBundle = {
        resourceType: "Bundle",
        type: "collection",
        timestamp: new Date().toISOString(),
        entry: [
            {
                resource: {
                    resourceType: "Patient",
                    id: `patient-${Date.now()}`,
                    gender: formData.Gender === 0 ? "male" : "female",
                    birthDate: new Date(new Date().getFullYear() - formData.Age, 0, 1).toISOString().split('T')[0]
                }
            },
            {
                resource: {
                    resourceType: "Observation",
                    id: `egfr-${Date.now()}`,
                    status: "final",
                    code: {
                        coding: [{
                            system: "http://loinc.org",
                            code: "48642-3",
                            display: "Glomerular filtration rate/1.73 sq M.predicted"
                        }]
                    },
                    valueQuantity: {
                        value: parseFloat(formData.GFR) || 0,
                        unit: "mL/min/1.73m2",
                        system: "http://unitsofmeasure.org"
                    }
                }
            },
            {
                resource: {
                    resourceType: "Observation",
                    id: `acr-${Date.now()}`,
                    status: "final",
                    code: {
                        coding: [{
                            system: "http://loinc.org",
                            code: "9318-7",
                            display: "Albumin/Creatinine [Mass Ratio] in Urine"
                        }]
                    },
                    valueQuantity: {
                        value: parseFloat(formData.ACR) || 0,
                        unit: "mg/g",
                        system: "http://unitsofmeasure.org"
                    }
                }
            },
            {
                resource: {
                    resourceType: "RiskAssessment",
                    id: `ckd-risk-${Date.now()}`,
                    status: "final",
                    subject: { reference: `Patient/patient-${Date.now()}` },
                    prediction: [{
                        outcome: {
                            coding: [{
                                system: "http://snomed.info/sct",
                                code: "709044004",
                                display: "Chronic kidney disease"
                            }]
                        },
                        probabilityDecimal: result.probability,
                        qualitativeRisk: {
                            coding: [{
                                system: "http://terminology.hl7.org/CodeSystem/risk-probability",
                                code: result.risk_class === 1 ? "high" : "low"
                            }]
                        }
                    }]
                }
            }
        ]
    };
    
    return fhirBundle;
}

// Añadir botón de exportación FHIR
function addFHIRExportButton() {
    const actionsDiv = document.querySelector('.result-actions');
    if (actionsDiv && !document.getElementById('btnFhirExport')) {
        const fhirBtn = document.createElement('button');
        fhirBtn.id = 'btnFhirExport';
        fhirBtn.className = 'btn-export';
        fhirBtn.innerHTML = '<i class="fa-solid fa-code-branch"></i> Exportar FHIR';
        fhirBtn.onclick = () => {
            if (window.lastResult && window.lastFormData) {
                const fhir = exportToFHIR(window.lastFormData, window.lastResult);
                const blob = new Blob([JSON.stringify(fhir, null, 2)], { type: 'application/json' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `nephromind_fhir_bundle_${new Date().toISOString().split('T')[0]}.json`;
                a.click();
                URL.revokeObjectURL(url);
                showNotification('Exportado en formato HL7 FHIR R4', 'success');
            }
        };
        actionsDiv.appendChild(fhirBtn);
    }
}

// Initialize on page load
document.addEventListener('DOMContentLoaded', () => {
    updateCompleteness();
    showStep(1);
    
    // Add FHIR button when results are shown
    const observer = new MutationObserver((mutations) => {
        mutations.forEach((mutation) => {
            if (mutation.target.id === 'result' && !mutation.target.classList.contains('hidden')) {
                addFHIRExportButton();
            }
        });
    });
    
    const resultCard = document.getElementById('result');
    if (resultCard) {
        observer.observe(resultCard, { attributes: true, attributeFilter: ['class'] });
    }
});

// Export functions globally
window.loadLauraCase = loadLauraCase;
window.exportToFHIR = exportToFHIR;


