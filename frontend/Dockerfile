# Frontend Dockerfile
FROM node:18-alpine as builder

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy source code
COPY . .

# Build the app
RUN npm run build

# Production stage
FROM nginx:alpine as production

# Copy built app from builder stage
COPY --from=builder /app/build /usr/share/nginx/html

# Copy nginx configuration
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Create directory for large file uploads
RUN mkdir -p /var/cache/nginx/client_temp && \
    chmod 700 /var/cache/nginx/client_temp

# Expose port
EXPOSE 80

# Default: production (nginx)
CMD ["nginx", "-g", "daemon off;"]

# Development stage
FROM node:18-alpine as development

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy source code
COPY . .

# Expose port
EXPOSE 3005

# Development command
CMD ["npm", "start"]

# Final stage selection
ARG DEV_MODE=false
ENV DEV_MODE=${DEV_MODE}

FROM development 