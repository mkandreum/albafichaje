FROM php:8.2-apache

# Enable mod_rewrite for nice URLs if needed (standard practice)
RUN a2enmod rewrite
RUN echo "ServerName localhost" >> /etc/apache2/apache2.conf

# Set working directory
WORKDIR /var/www/html

# Copy application source
COPY . .

# Set permissions for data and uploads
# Ensure www-data owns EVERYTHING in /var/www/html to avoid permission issues
RUN mkdir -p data/signatures assets/uploads && \
    chown -R www-data:www-data /var/www/html && \
    chmod -R 775 /var/www/html

# Expose port 80
EXPOSE 80

# Copy and set entrypoint
COPY entrypoint.sh /usr/local/bin/
RUN chmod +x /usr/local/bin/entrypoint.sh
ENTRYPOINT ["entrypoint.sh"]
