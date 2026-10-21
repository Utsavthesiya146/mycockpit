# Stage 1: Build React Frontend
FROM node:20-alpine AS frontend-builder
WORKDIR /app
COPY frontend/package*.json ./
RUN npm install
COPY frontend/ ./
RUN npm run build

# Stage 2: Production Apache + PHP 8.2 Runtime
FROM php:8.2-apache
RUN docker-php-ext-install pdo pdo_mysql && a2enmod rewrite

WORKDIR /var/www/html

# Copy Frontend production build
COPY --from=frontend-builder /app/dist /var/www/html/

# Copy Backend API code
COPY backend /var/www/html/backend/

# Create unified .htaccess for SPA & API routing
RUN echo "<IfModule mod_rewrite.c>" > /var/www/html/.htaccess && \
    echo "    RewriteEngine On" >> /var/www/html/.htaccess && \
    echo "    RewriteBase /" >> /var/www/html/.htaccess && \
    echo "    RewriteRule ^api/(.*)$ backend/api/index.php/\$1 [QSA,L]" >> /var/www/html/.htaccess && \
    echo "    RewriteCond %{REQUEST_FILENAME} -f [OR]" >> /var/www/html/.htaccess && \
    echo "    RewriteCond %{REQUEST_FILENAME} -d" >> /var/www/html/.htaccess && \
    echo "    RewriteRule ^ - [L]" >> /var/www/html/.htaccess && \
    echo "    RewriteRule ^ index.html [L]" >> /var/www/html/.htaccess && \
    echo "</IfModule>" >> /var/www/html/.htaccess

RUN chown -R www-data:www-data /var/www/html
EXPOSE 80

CMD ["apache2-foreground"]
