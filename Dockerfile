FROM node:22.14.0-alpine

WORKDIR /app

# Copy package.json and package-lock.json
COPY package*.json ./

# Install dependencies
RUN npm ci

# Copy the rest of the application code
COPY . .

# Build the application
RUN npm run build

# Create a volume mount point for sensitive data
VOLUME /app/data

# Expose the port the app runs on
EXPOSE 3000

# Command to run the application
CMD ["npm", "start"]
