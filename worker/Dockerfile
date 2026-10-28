FROM python:3.12-slim
WORKDIR /app
COPY backend/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY backend/app app
RUN useradd --create-home appuser && chown -R appuser:appuser /app
USER appuser
CMD ["python", "-m", "app.worker"]
