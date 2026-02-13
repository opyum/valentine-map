FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
RUN npm install --production

COPY . .

# Create data and uploads directories
RUN mkdir -p data uploads

EXPOSE 3000

CMD ["node", "server.js"]
