# ── Stage 1: Build from source ──────────────────────────────────────────────
FROM golang:1.21-alpine AS builder
WORKDIR /app

# Install git to clone the repository
RUN apk add --no-cache git

# Clone the upstash-redis-local proxy repository
RUN git clone https://github.com/DarthBenro008/upstash-redis-local.git .

# Build the binary natively for the host architecture (amd64, arm64, etc.)
RUN go build -o upstash-redis-local .

# ── Stage 2: Runtime image ──────────────────────────────────────────────────
FROM alpine:3.19
WORKDIR /app

# Copy the compiled binary from the builder stage
COPY --from=builder /app/upstash-redis-local ./

EXPOSE 8000

# Set entrypoint to run the proxy binary
ENTRYPOINT ["./upstash-redis-local"]
