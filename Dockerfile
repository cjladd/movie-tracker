FROM node:20-alpine

WORKDIR /app

# Copy backend package files and install dependencies
COPY backend/package*.json ./backend/
RUN cd backend && npm ci --omit=dev

# Copy application code
COPY backend/ ./backend/
COPY frontend/public/ ./frontend/public/
COPY database/ ./database/

EXPOSE ${PORT:-4000}

CMD ["node", "backend/server.js"]
