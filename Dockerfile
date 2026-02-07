FROM node:22-slim

WORKDIR /app

# Install Python and dependencies for automation scripts
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 \
    python3-pip \
    libgl1 \
    libglib2.0-0 \
    && rm -rf /var/lib/apt/lists/* \
    && pip3 install --no-cache-dir --break-system-packages \
    opencv-python-headless==4.9.0.80 \
    httpx==0.27.0 \
    pydantic==2.6.1 \
    numpy==1.26.4 \
    requests==2.31.0

# Install Playwright Chromium browser and dependencies
RUN npx playwright install chromium --with-deps

# pnpm install
RUN npm install -g pnpm

# Copy package files and patches first
COPY package.json pnpm-lock.yaml ./
COPY patches/ ./patches/

# Install dependencies
RUN pnpm install

# Copy source code
COPY . .

# Expose port
EXPOSE 3000

# Start command
CMD ["pnpm", "dev"]
