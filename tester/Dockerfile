FROM node:lts-alpine

WORKDIR /app
COPY ./tester /app/
RUN npm install

CMD ["node", "main.js"]
