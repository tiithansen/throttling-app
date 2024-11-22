FROM node:lts-alpine

WORKDIR /app
COPY ./tester .
RUN npm install

CMD ["node", "main.js"]
