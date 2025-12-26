FROM php:8.2-apache

# Enable mod_rewrite for nice URLs if needed (standard practice)
RUN a2enmod rewrite

# Set working directory
WORKDIR /var/www/html

# Copy application source
COPY . .

# Set permissions for data and uploads
# We permit www-data to write to 'data' and 'assets'
RUN mkdir -p data assets/uploads && \
    chown -R www-data:www-data data assets && \
    chmod -R 775 data assets

# Expose port 80
EXPOSE 80
