FROM node:20-bookworm-slim

# Install build dependencies for native modules (better-sqlite3)
RUN apt-get update && apt-get install -y python3 make g++ && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install production dependencies
RUN npm install --omit=dev

# Copy application source code
COPY . .

# Ensure upload and database directories exist
RUN mkdir -p data uploads/documents uploads/certificates

# Expose port 3000
EXPOSE 3000

ENV NODE_ENV=production
ENV PORT=3000

# Auto seed if database does not exist, then start server
CMD ["sh", "-c", "if [ ! -f data/metroverify.db ]; then node database/seed.js; fi && node server.js"]
