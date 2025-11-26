"""
Script para verificar que el backend esté funcionando correctamente
"""
import sys
import os

print("=" * 50)
print("Verificación del Backend NephroMind")
print("=" * 50)
print()

# Verificar Python
print("1. Verificando Python...")
print(f"   Versión: {sys.version}")
print()

# Verificar dependencias
print("2. Verificando dependencias...")
dependencies = [
    'fastapi',
    'uvicorn',
    'pandas',
    'numpy',
    'sklearn',
    'imblearn',
    'pydantic'
]

missing = []
for dep in dependencies:
    try:
        if dep == 'sklearn':
            import sklearn
            print(f"   [OK] {dep} (scikit-learn)")
        elif dep == 'imblearn':
            import imblearn
            print(f"   [OK] {dep}")
        else:
            __import__(dep)
            print(f"   [OK] {dep}")
    except ImportError:
        print(f"   [FALTA] {dep} - FALTANTE")
        missing.append(dep)

if missing:
    print()
    print(f"[ADVERTENCIA] Faltan {len(missing)} dependencias. Ejecuta: pip install -r backend/requirements.txt")
else:
    print()
    print("[OK] Todas las dependencias estan instaladas")

print()

# Verificar archivos del modelo
print("3. Verificando archivos del modelo...")
model_files = [
    'ckd_model.pkl',
    'ckd_scaler.pkl',
    'ckd_columns.pkl'
]

for file in model_files:
    if os.path.exists(file):
        size = os.path.getsize(file) / 1024  # KB
        print(f"   [OK] {file} ({size:.1f} KB)")
    else:
        print(f"   [FALTA] {file} - NO ENCONTRADO")

print()

# Verificar datos de entrenamiento
print("4. Verificando datos de entrenamiento...")
data_paths = [
    'archive/Chronic_Kidney_Dsease_data.csv',
    '../archive/Chronic_Kidney_Dsease_data.csv'
]

data_found = False
for path in data_paths:
    if os.path.exists(path):
        size = os.path.getsize(path) / 1024  # KB
        print(f"   [OK] {path} ({size:.1f} KB)")
        data_found = True
        break

if not data_found:
    print("   [FALTA] Archivo de datos no encontrado")

print()

# Verificar estructura del backend
print("5. Verificando estructura del backend...")
backend_files = [
    'backend/main.py',
    'backend/model.py',
    'backend/requirements.txt'
]

for file in backend_files:
    if os.path.exists(file):
        print(f"   [OK] {file}")
    else:
        print(f"   [FALTA] {file} - NO ENCONTRADO")

print()
print("=" * 50)
print("Verificación completada")
print("=" * 50)
print()
print("Para iniciar el backend:")
print("  Windows: ejecuta 'iniciar_backend.bat' o 'iniciar_backend.ps1'")
print("  Linux/Mac: python -m uvicorn backend.main:app --reload")
print()

