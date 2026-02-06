FROM node:18-alpine

WORKDIR /app

# 1. Install System Dependencies & Tectonic
# Hum direct script se install kar rahe hain taaki 100% chale
RUN apk add --no-cache python3 make g++ curl libstdc++ \
    && curl --proto '=https' --tlsv1.2 -fsSL https://drop-sh.fullyjustified.net | sh \
    && mv tectonic /usr/bin/ \
    && chmod +x /usr/bin/tectonic

# 2. Setup App
COPY package*.json ./
RUN npm install
COPY . .

# 3. Start Server
ENV NODE_ENV=production
EXPOSE 5000
CMD ["node", "server.js"]