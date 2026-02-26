FROM alpine:3.20

RUN apk add --no-cache \
    ca-certificates \
    postgresql-client \
    rclone \
    tzdata

WORKDIR /app

COPY backup/entrypoint.sh /scripts/entrypoint.sh
COPY backup/backup.sh /scripts/backup.sh

RUN chmod +x /scripts/entrypoint.sh /scripts/backup.sh

ENTRYPOINT ["/scripts/entrypoint.sh"]
