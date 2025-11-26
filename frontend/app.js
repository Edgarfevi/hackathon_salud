let currentStep = 1;

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
        alert('Error al conectar con el servidor.');
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
}
