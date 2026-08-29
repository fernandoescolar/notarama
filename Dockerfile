# syntax=docker/dockerfile:1

# --- Stage 1: build the frontend (Vite outputs straight into internal/web/dist) ---
FROM node:22-alpine AS frontend-build
WORKDIR /app
COPY frontend/package.json frontend/package-lock.json ./frontend/
RUN cd frontend && npm ci
COPY frontend ./frontend
RUN cd frontend && npm run build

# --- Stage 2: build the Go binary, embedding the frontend build output ---
FROM golang:1.25-alpine AS backend-build
WORKDIR /app
COPY go.mod go.sum ./
RUN go mod download
COPY cmd ./cmd
COPY internal ./internal
COPY --from=frontend-build /app/internal/web/dist ./internal/web/dist
RUN CGO_ENABLED=0 go build -trimpath -ldflags="-s -w" -o /out/notarama ./cmd/notarama

# --- Stage 3: minimal runtime image ---
FROM alpine:3.20
RUN apk add --no-cache ca-certificates tzdata && \
    adduser -D -u 10001 notarama
COPY --from=backend-build /out/notarama /usr/local/bin/notarama
RUN mkdir -p /data && chown notarama:notarama /data
USER notarama
VOLUME ["/data"]
ENV DATA_DIR=/data
ENV LISTEN_ADDR=:8080
EXPOSE 8080
ENTRYPOINT ["/usr/local/bin/notarama"]
