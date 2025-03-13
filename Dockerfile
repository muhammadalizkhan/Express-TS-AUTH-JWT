FROM node:lts

WORKDIR /app

COPY . .

RUN npm install

EXPOSE 8000

CMD ["npm", "run", "start"]