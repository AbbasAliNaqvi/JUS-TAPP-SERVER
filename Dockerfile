FROM node:18-alpine

WORKDIR /app

# Copy package files
COPY package*.json ./
COPY frontend ./frontend

# Install dependencies and build frontend
RUN npm ci
RUN npm run build

# Copy application
COPY src ./src

# Production runtime
ENV NODE_ENV=production

# Expose port
EXPOSE 5000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:5000/api/health', (r) => {if (r.statusCode !== 200) throw new Error(r.statusCode)})"

# Start application
CMD ["npm", "start"]
