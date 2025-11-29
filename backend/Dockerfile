FROM python:3.9-slim

WORKDIR /app

# Install system dependencies (if any needed for scikit-learn/numpy)
FROM python:3.9-slim

WORKDIR /app

# Install system dependencies (if any needed for scikit-learn/numpy)
RUN apt-get update && apt-get install -y \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

# Instalar dependencias del sistema para PyMuPDF/OpenCV si fueran necesarias
# RUN apt-get update && apt-get install -y libgl1-mesa-glx

# Copy requirements first to leverage cache
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copiar el código y los datos
COPY . .

# Expose port
EXPOSE 8000

# Run the application
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
