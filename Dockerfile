FROM node:10

#create working directory 

WORKDIR /usr/src/app

COPY package*.json ./

RUN npm install 

COPY ./webapp ./webapp

EXPOSE 3000

CMD ["npm" ,  "start"]
