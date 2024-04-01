FROM node:18.16.0

WORKDIR /app

RUN apt-get update && apt-get install

COPY package*.json ./

RUN npm install

COPY . .

EXPOSE 3000

CMD ["node", "server.js"]
