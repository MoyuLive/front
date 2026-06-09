FROM node:22-alpine AS builder

WORKDIR /build

RUN corepack enable && corepack prepare pnpm@11.5.2 --activate

COPY package.json pnpm-lock.yaml* pnpm-workspace.yaml* ./
RUN pnpm install --frozen-lockfile

COPY . .

ARG VITE_STREAMSERVER=http://localhost:1985
ARG VITE_RTMP_HOST=localhost:1935
ARG VITE_WHEP_BASE=http://localhost:1985
ARG VITE_WHIP_BASE=http://localhost:1985
ARG VITE_SRT_HOST=localhost:10080
ARG VITE_API_BASE=http://localhost:9081
ENV VITE_STREAMSERVER=$VITE_STREAMSERVER
ENV VITE_RTMP_HOST=$VITE_RTMP_HOST
ENV VITE_WHEP_BASE=$VITE_WHEP_BASE
ENV VITE_WHIP_BASE=$VITE_WHIP_BASE
ENV VITE_SRT_HOST=$VITE_SRT_HOST
ENV VITE_API_BASE=$VITE_API_BASE

RUN pnpm build

FROM nginx:1.27-alpine

COPY --from=builder /build/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
