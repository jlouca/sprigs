FROM nginx:alpine

RUN apk add --no-cache curl

COPY index.html privacy.html script.js styles.css tailwind.css icons.js supabase-config.js logo.png logo-new.png /usr/share/nginx/html/

EXPOSE 80

HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
  CMD curl -f http://localhost/ || exit 1
