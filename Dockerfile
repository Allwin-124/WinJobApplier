# Stage 1: Build the Rust scraper
FROM rust:1.77 as builder
WORKDIR /usr/src/scraper
COPY scraper /usr/src/scraper
RUN cargo build --release

# Stage 2: Final lightweight runner
FROM python:3.12-slim
WORKDIR /app

# Install runtime system dependencies for SSL/TLS
RUN apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates \
    libssl3 \
    && rm -rf /var/lib/apt/lists/*

# Copy Python dependencies list
COPY requirements.txt /app/

# Install Python dependencies
RUN pip install --no-cache-dir -r requirements.txt

# Copy backend code
COPY backend /app/backend

# Copy the compiled Rust scraper binary from builder stage
COPY --from=builder /usr/src/scraper/target/release/scraper /app/scraper/target/release/scraper

# Expose the API port
EXPOSE 8000

# Start FastAPI server
CMD ["uvicorn", "backend.main:app", "--host", "0.0.0.0", "--port", "8000"]
