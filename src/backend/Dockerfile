FROM node:18-alpine

WORKDIR /app

# Dependencies
COPY package*.json ./
RUN npm install

# Source code
COPY . .

# Expose port
EXPOSE 3000

# Start command
CMD ["npm", "run", "dev"]
