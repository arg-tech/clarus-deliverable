# ---- Dockerfile for ner_people_sentiment_api.py ----
FROM python:3.12-slim

# Prevent Python from writing .pyc files and buffer logs
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

WORKDIR /app

# Install runtime dependencies
# (spaCy, FastAPI, Uvicorn, VADER; feel free to add transformers/torch if you use HF sentiment)
RUN pip install --no-cache-dir "spacy>=3.6,<4" fastapi "uvicorn[standard]" vaderSentiment \
 && python -m spacy download en_core_web_sm

# Copy the API script into the image
COPY ner_people_sentiment_api.py /app/

# Expose the app port
EXPOSE 8000

# Start the service
CMD ["python", "-m", "uvicorn", "ner_people_sentiment_api:app", "--host", "0.0.0.0", "--port", "8000"]
