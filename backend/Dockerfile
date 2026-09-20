FROM node:20-alpine

WORKDIR /app

# Install dependencies
COPY package*.json ./
RUN npm ci --omit=dev

# Copy application code
COPY src ./src

# Render sets PORT dynamically (default to 3001)
ENV PORT=3001
EXPOSE 3001

CMD ["node", "src/index.js"]
