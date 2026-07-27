FROM alpine:3.20

RUN apk add --no-cache \
    ca-certificates \
    postgresql-client \
    rclone \
    tzdata

WORKDIR /app

COPY entrypoint.sh /scripts/entrypoint.sh
COPY backup.sh /scripts/backup.sh

RUN sed -i 's/\r$//' /scripts/entrypoint.sh /scripts/backup.sh && \
    chmod +x /scripts/entrypoint.sh /scripts/backup.sh

ENTRYPOINT ["/scripts/entrypoint.sh"]
