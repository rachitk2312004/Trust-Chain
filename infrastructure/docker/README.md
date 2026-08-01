# Local infrastructure (Docker Compose)

Services defined in the repository-root `docker-compose.yml`:

| Service  | Image              | Ports                         |
|----------|--------------------|-------------------------------|
| postgres | postgres:16-alpine | 5432                          |
| minio    | minio/minio        | 9000 (API), 9001 (console)    |
| mailhog  | mailhog/mailhog    | 1025 (SMTP), 8025 (UI)        |

```bash
# From repository root
docker compose up -d
docker compose ps
docker compose exec postgres pg_isready -U trustchain -d trustchain
```

Application Dockerfiles will be added when services are containerized for deployment.
