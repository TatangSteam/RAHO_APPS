# Dashboard Access Guide (Production)

## 1) Nginx Proxy Manager Dashboard

NPM admin is bound to `127.0.0.1:81` on the VPS, so it is not internet-facing.

### From your local machine

```bash
ssh -L 8181:127.0.0.1:81 <user>@<vps-ip>
```

Then open:

- `http://localhost:8181`

## 2) MinIO Dashboard (Console)

MinIO console (`:9001`) is internal-only in your Compose setup. Use tunnel to the MinIO container IP.

### On VPS (get MinIO container IP)

```bash
cd /root/RAHO_APPS
docker inspect -f '{{range .NetworkSettings.Networks}}{{.IPAddress}}{{end}}' raho-minio
```

Copy the returned IP (example: `172.20.0.5`).

### From your local machine (use the container IP)

```bash
ssh -L 9001:<minio-container-ip>:9001 <user>@<vps-ip>
```

Then open:

- `http://localhost:9001`

## 3) Prisma Studio

Prisma Studio is not kept running in production by default. Start it as a temporary one-off process bound only to localhost on VPS.

### On VPS (start temporary Prisma Studio)

```bash
cd /root/RAHO_APPS
docker compose -f docker-compose.prod.yml run --rm -p 127.0.0.1:5555:5555 api npx prisma studio --hostname 0.0.0.0 --port 5555
```

Keep this terminal running while you use Studio.

### From your local machine

```bash
ssh -L 5555:127.0.0.1:5555 <user>@<vps-ip>
```

Then open:

- `http://localhost:5555`