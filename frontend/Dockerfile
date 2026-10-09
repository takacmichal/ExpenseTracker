# Angular 22 requires Node ^22.22.3 || ^24.15.0; 24 is the current LTS.
FROM node:24.15-alpine AS build
WORKDIR /build

COPY package.json package-lock.json ./
RUN npm ci

COPY . .

# Injected at build time so the licence key never has to live in the repository.
ARG PRIMENG_LICENSE=""
RUN sed -i "s|__PRIMENG_LICENSE__|${PRIMENG_LICENSE}|" src/environments/environment.production.ts \
    && npm run build -- --configuration production


FROM nginx:1.29-alpine AS runtime

COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /build/dist/frontend/browser /usr/share/nginx/html

EXPOSE 80
