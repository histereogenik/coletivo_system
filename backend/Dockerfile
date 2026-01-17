FROM python:3.12-alpine

ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1

WORKDIR /opt/app

COPY pyproject.toml poetry.lock* ./

RUN apk update && \
    apk add --no-cache \
    build-base \
    postgresql-dev \
    libffi-dev \
    openssl-dev \
    cargo && \
    pip install --no-cache-dir poetry && \
    poetry config virtualenvs.create false && \
    poetry install --no-root --no-interaction --no-ansi && \
    apk del build-base cargo

COPY . .

CMD ["sh", "-c", "\
    python manage.py migrate --no-input && \
    python manage.py collectstatic --noinput || true && \
    gunicorn config.wsgi:application \
      --bind 0.0.0.0:8000 \
      --workers ${GUNICORN_WORKERS:-4} \
      --timeout ${GUNICORN_TIMEOUT:-30} \
      --graceful-timeout ${GUNICORN_GRACEFUL_TIMEOUT:-30} \
      --keep-alive 5 \
      --worker-tmp-dir /dev/shm \
      --max-requests 500 \
      --max-requests-jitter 50 \
      --limit-request-line 8190 \
      --limit-request-field_size 8190 \
      --access-logfile - \
      --error-logfile - \
    "]
