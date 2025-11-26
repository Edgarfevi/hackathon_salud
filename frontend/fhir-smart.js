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

        // Mostrar notificación de éxito
        showNotification('Datos del paciente cargados desde el sistema hospitalario', 'success');

    } catch (error) {
        console.error('Error cargando datos FHIR:', error);
        showNotification('No se pudieron cargar todos los datos. Complete manualmente.', 'warning');
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

function showNotification(message, type) {
    // Crear notificación temporal
    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;
    notification.textContent = message;
    document.body.appendChild(notification);

    setTimeout(() => notification.remove(), 5000);
}

function showManualForm() {
    // Mostrar el formulario manual si SMART falla
    document.getElementById('riskForm').style.display = 'block';
}

// 7. Iniciar cuando la página carga
if (window.location.search.includes('code=') || window.location.search.includes('iss=')) {
    // Estamos en un contexto SMART
    initSMARTLaunch();
} else {
    // Modo standalone (desarrollo)
    console.log('Modo standalone - usando formulario manual');
    showManualForm();
}
