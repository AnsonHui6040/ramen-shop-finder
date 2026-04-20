FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
RUN node scripts/build-data.mjs

FROM nginx:alpine
COPY --from=builder /app/docs /usr/share/nginx/html
EXPOSE 80
