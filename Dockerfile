# Stage 1: Build
FROM node:20-alpine AS build

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .

# Recebe a URL da API em tempo de build para o Vite injetar no bundle
ARG VITE_API_BASE_URL
ENV VITE_API_BASE_URL=$VITE_API_BASE_URL

RUN npm run build

# Stage 2: Serve
FROM nginx:stable-alpine

# Copia o build final para o diretório padrão do Nginx
COPY --from=build /app/dist /usr/share/nginx/html

# Adiciona configuração simples do Nginx para SPAs se necessário
RUN rm /etc/nginx/conf.d/default.conf
RUN echo $'server { \n\
    listen 80; \n\
    location / { \n\
        root /usr/share/nginx/html; \n\
        index index.html index.htm; \n\
        try_files $uri $uri/ /index.html; \n\
    } \n\
}' > /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
