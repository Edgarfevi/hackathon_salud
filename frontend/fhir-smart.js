// Implementación SMART on FHIR usando la librería oficial
// Documentación: http://docs.smarthealthit.org/client-js

// 1. Incluir la librería SMART en index.html
// <script src="https://cdn.jsdelivr.net/npm/fhirclient/build/fhir-client.js"></script>

const FHIR = window.FHIR;

// 2. Iniciar el flujo SMART App Launch
async function initSMARTLaunch() {
    try {
        // Autorizar y obtener cliente FHIR
        const client = await FHIR.oauth2.ready();

        // Obtener ID del paciente actual
        const patientId = client.patient.id;
        console.log('Paciente actual:', patientId);

        // Cargar datos del paciente
        await loadPatientDataFromFHIR(client, patientId);

    } catch (error) {
        console.error('Error en SMART Launch:', error);
        // Fallback: mostrar formulario manual
        showManualForm();
    }
}

// 3. Extraer datos del paciente desde FHIR
async function loadPatientDataFromFHIR(client, patientId) {
    try {
        // Obtener datos demográficos
        const patient = await client.request(`Patient/${patientId}`);

        // Obtener observaciones (últimos 6 meses)
        const observations = await client.request(
            `Observation?patient=${patientId}&date=ge${getSixMonthsAgo()}&_count=100`
        );

        // Obtener condiciones
        const conditions = await client.request(
            `Condition?patient=${patientId}`
        );

        // Obtener medicamentos activos
        const medications = await client.request(
            `MedicationRequest?patient=${patientId}&status=active`
        );

        // Mapear a nuestro modelo
        const modelData = mapFHIRtoNephroAI(patient, observations, conditions, medications);

        // Pre-llenar el formulario
        populateForm(modelData);

        // Mostrar panel de resumen del paciente
        displayPatientSummary(patient, observations, conditions, medications);

        // Mostrar notificación de éxito
        if (window.showNotification) {
            window.showNotification('Datos del paciente cargados desde el sistema hospitalario', 'success');
        }

    } catch (error) {
        console.error('Error cargando datos FHIR:', error);
        if (window.showNotification) {
            window.showNotification('No se pudieron cargar todos los datos. Complete manualmente o use el modo demo.', 'warning');
        }
    }
}

// 4. Mapear datos FHIR a nuestro modelo NephroAI
function mapFHIRtoNephroAI(patient, observations, conditions, medications) {
    const modelData = {
        // Demografía
        Age: calculateAge(patient.birthDate),
        Gender: patient.gender === 'male' ? 0 : 1,

        // Signos Vitales (buscar por código LOINC)
        SystolicBP: findLatestObservation(observations, '8480-6'),
        DiastolicBP: findLatestObservation(observations, '8462-4'),

        // Laboratorio
        FastingBloodSugar: findLatestObservation(observations, '1558-6'),
        HbA1c: findLatestObservation(observations, '4548-4'),
        SerumCreatinine: findLatestObservation(observations, '2160-0'),
        BUN: findLatestObservation(observations, '3094-0'),
        GFR: findLatestObservation(observations, '33914-3'),
        ProteinInUrine: findLatestObservation(observations, '2889-4'),
        ACR: findLatestObservation(observations, '14959-1'),

        // Historia Clínica (buscar condiciones por SNOMED CT o texto)
        FamilyHistoryKidneyDisease: hasConditionCode(conditions, ['90708001', '709044004']),
        FamilyHistoryHypertension: hasConditionCode(conditions, ['38341003']),
        FamilyHistoryDiabetes: hasConditionCode(conditions, ['73211009']),

        // Medicamentos (buscar por clase terapéutica)
        ACEInhibitors: hasMedicationClass(medications, 'ACE'),
        Diuretics: hasMedicationClass(medications, 'diuretic'),
        Statins: hasMedicationClass(medications, 'statin'),
    };

    return modelData;
}

// 5. Funciones auxiliares
function calculateAge(birthDate) {
    const today = new Date();
    const birth = new Date(birthDate);
    let age = today.getFullYear() - birth.getFullYear();
    const monthDiff = today.getMonth() - birth.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
        age--;
    }
    return age;
}

function findLatestObservation(observations, loincCode) {
    if (!observations || !observations.entry) return null;

    const matching = observations.entry
        .filter(entry => {
            const coding = entry.resource.code?.coding || [];
            return coding.some(c => c.code === loincCode);
        })
        .sort((a, b) => {
            const dateA = new Date(a.resource.effectiveDateTime || a.resource.issued);
            const dateB = new Date(b.resource.effectiveDateTime || b.resource.issued);
            return dateB - dateA; // Más reciente primero
        });

    if (matching.length > 0) {
        const value = matching[0].resource.valueQuantity?.value;
        return value || null;
    }
    return null;
}

function hasConditionCode(conditions, snomedCodes) {
    if (!conditions || !conditions.entry) return 0;

    const hasCondition = conditions.entry.some(entry => {
        const coding = entry.resource.code?.coding || [];
        return coding.some(c => snomedCodes.includes(c.code));
    });

    return hasCondition ? 1 : 0;
}

function hasMedicationClass(medications, className) {
    if (!medications || !medications.entry) return 0;

    const hasMed = medications.entry.some(entry => {
        const medName = entry.resource.medicationCodeableConcept?.text || '';
        return medName.toLowerCase().includes(className.toLowerCase());
    });

    return hasMed ? 1 : 0;
}

function getSixMonthsAgo() {
    const date = new Date();
    date.setMonth(date.getMonth() - 6);
    return date.toISOString().split('T')[0];
}

// 6. Pre-llenar el formulario con datos FHIR
function populateForm(data) {
    for (const [key, value] of Object.entries(data)) {
        const input = document.querySelector(`[name="${key}"]`);
        if (input && value !== null && value !== undefined) {
            input.value = value;
            input.style.backgroundColor = '#e8f5e9'; // Verde claro para indicar dato automático
        }
    }
}

// 8. Mostrar resumen del paciente
function displayPatientSummary(patient, observations, conditions, medications) {
    const summaryPanel = document.getElementById('patientSummary');
    if (!summaryPanel) return;

    // Datos demográficos
    const patientName = `${patient.name?.[0]?.given?.[0] || ''} ${patient.name?.[0]?.family || 'Paciente'}`.trim();
    const age = calculateAge(patient.birthDate);
    const gender = patient.gender === 'male' ? 'Masculino' : patient.gender === 'female' ? 'Femenino' : 'No especificado';

    document.getElementById('summaryPatientName').textContent = patientName || 'Paciente';
    document.getElementById('summaryAge').textContent = age ? `${age} años` : '--';
    document.getElementById('summaryGender').textContent = gender;

    // Signos vitales
    const systolicBP = findLatestObservation(observations, '8480-6');
    const diastolicBP = findLatestObservation(observations, '8462-4');
    if (systolicBP && diastolicBP) {
        document.getElementById('summaryBP').textContent = `${systolicBP}/${diastolicBP} mmHg`;
    } else {
        document.getElementById('summaryBP').textContent = 'No disponible';
    }

    // Laboratorios
    const creatinine = findLatestObservation(observations, '2160-0');
    const gfr = findLatestObservation(observations, '33914-3');
    const hba1c = findLatestObservation(observations, '4548-4');

    document.getElementById('summaryCreatinine').textContent = creatinine ? `${creatinine} mg/dL` : '--';
    document.getElementById('summaryGFR').textContent = gfr ? `${gfr} mL/min/1.73m²` : '--';
    document.getElementById('summaryHbA1c').textContent = hba1c ? `${hba1c}%` : '--';

    // Medicamentos
    const medsList = document.getElementById('summaryMedications');
    if (medications && medications.entry && medications.entry.length > 0) {
        medsList.innerHTML = medications.entry.slice(0, 5).map(entry => {
            const medName = entry.resource.medicationCodeableConcept?.text || 'Medicamento';
            return `<span class="medication-tag">${medName}</span>`;
        }).join('');
        if (medications.entry.length > 5) {
            medsList.innerHTML += `<span class="medication-tag">+${medications.entry.length - 5} más</span>`;
        }
    } else {
        medsList.textContent = 'No hay medicamentos registrados';
    }

    // Mostrar panel
    summaryPanel.classList.remove('hidden');
    
    // Ocultar banner demo si estaba visible
    const demoBanner = document.getElementById('demoBanner');
    if (demoBanner) {
        demoBanner.classList.add('hidden');
    }
}

function togglePatientSummary() {
    const content = document.getElementById('summaryContent');
    const btn = document.querySelector('.btn-toggle-summary i');
    if (content.classList.contains('collapsed')) {
        content.classList.remove('collapsed');
        btn.classList.remove('fa-chevron-down');
        btn.classList.add('fa-chevron-up');
    } else {
        content.classList.add('collapsed');
        btn.classList.remove('fa-chevron-up');
        btn.classList.add('fa-chevron-down');
    }
}

// Función global para notificaciones
window.showNotification = function(message, type = 'success') {
    // Crear notificación temporal
    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;
    
    const icon = type === 'success' ? 'fa-circle-check' : type === 'warning' ? 'fa-triangle-exclamation' : 'fa-circle-xmark';
    notification.innerHTML = `<i class="fa-solid ${icon}"></i> <span>${message}</span>`;
    
    document.body.appendChild(notification);

    setTimeout(() => {
        notification.style.animation = 'slideIn 0.3s ease reverse';
        setTimeout(() => notification.remove(), 300);
    }, 5000);
};

function showManualForm() {
    // Mostrar el formulario manual si SMART falla
    document.getElementById('riskForm').style.display = 'block';
}

// 9. Modo Demo - Cargar datos simulados para demostración
function loadDemoData() {
    // Simular datos de un paciente de ejemplo
    const demoPatient = {
        name: [{ given: ['María'], family: 'García López' }],
        birthDate: '1975-03-15',
        gender: 'female'
    };

    const demoObservations = {
        entry: [
            {
                resource: {
                    code: { coding: [{ code: '8480-6' }] },
                    valueQuantity: { value: 145 },
                    effectiveDateTime: new Date().toISOString()
                }
            },
            {
                resource: {
                    code: { coding: [{ code: '8462-4' }] },
                    valueQuantity: { value: 92 },
                    effectiveDateTime: new Date().toISOString()
                }
            },
            {
                resource: {
                    code: { coding: [{ code: '2160-0' }] },
                    valueQuantity: { value: 1.35 },
                    effectiveDateTime: new Date().toISOString()
                }
            },
            {
                resource: {
                    code: { coding: [{ code: '33914-3' }] },
                    valueQuantity: { value: 58 },
                    effectiveDateTime: new Date().toISOString()
                }
            },
            {
                resource: {
                    code: { coding: [{ code: '4548-4' }] },
                    valueQuantity: { value: 6.8 },
                    effectiveDateTime: new Date().toISOString()
                }
            },
            {
                resource: {
                    code: { coding: [{ code: '1558-6' }] },
                    valueQuantity: { value: 112 },
                    effectiveDateTime: new Date().toISOString()
                }
            },
            {
                resource: {
                    code: { coding: [{ code: '3094-0' }] },
                    valueQuantity: { value: 28 },
                    effectiveDateTime: new Date().toISOString()
                }
            }
        ]
    };

    const demoConditions = {
        entry: [
            {
                resource: {
                    code: {
                        coding: [{ code: '38341003' }] // Hipertensión
                    }
                }
            },
            {
                resource: {
                    code: {
                        coding: [{ code: '73211009' }] // Diabetes
                    }
                }
            }
        ]
    };

    const demoMedications = {
        entry: [
            {
                resource: {
                    medicationCodeableConcept: {
                        text: 'Enalapril 10mg'
                    }
                }
            },
            {
                resource: {
                    medicationCodeableConcept: {
                        text: 'Metformina 850mg'
                    }
                }
            },
            {
                resource: {
                    medicationCodeableConcept: {
                        text: 'Atorvastatina 20mg'
                    }
                }
            }
        ]
    };

    // Mapear y prellenar
    const modelData = mapFHIRtoNephroAI(demoPatient, demoObservations, demoConditions, demoMedications);
    populateForm(modelData);
    displayPatientSummary(demoPatient, demoObservations, demoConditions, demoMedications);

    // Ocultar banner demo
    const demoBanner = document.getElementById('demoBanner');
    if (demoBanner) {
        demoBanner.classList.add('hidden');
    }

    // Mostrar notificación
    if (window.showNotification) {
        window.showNotification('Datos de demostración cargados. Estos son datos simulados para mostrar la funcionalidad.', 'success');
    }

    console.log('Datos demo cargados');
}

// 7. Iniciar cuando la página carga
if (window.location.search.includes('code=') || window.location.search.includes('iss=')) {
    // Estamos en un contexto SMART real
    initSMARTLaunch();
} else {
    // Modo standalone (desarrollo/demo)
    console.log('Modo standalone - usando formulario manual');
    showManualForm();
    
    // Mostrar banner de demo si no hay datos FHIR
    const demoBanner = document.getElementById('demoBanner');
    if (demoBanner) {
        demoBanner.classList.remove('hidden');
    }
}
