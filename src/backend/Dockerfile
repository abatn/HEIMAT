FROM node:18-alpine

WORKDIR /app

# Dependencies
COPY package*.json ./
RUN npm install

# Build TypeScript
RUN npm run build

# Source code
COPY . .

# Expose port
EXPOSE 3000

# Start command (production)
CMD ["node", "dist/index.js"]
