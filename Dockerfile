FROM node:18-alpine

# Create app directory
WORKDIR /app

# Install app dependencies
COPY package*.json ./
RUN npm install

# Bundle app source
COPY . .

# Build the TypeScript code
RUN npm run build

# Set environment variables or use .env file at runtime
ENV NODE_ENV=production

# Run the application
CMD ["node", "dist/index.js"] 