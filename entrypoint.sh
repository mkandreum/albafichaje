#!/bin/bash
set -e

# Fix permissions for data directory
# We check if the directory exists, if so, we ensure it's writable by www-data
if [ -d "/var/www/html/data" ]; then
    echo "Setting permissions for data directory..."
    chown -R www-data:www-data /var/www/html/data
    chmod -R 777 /var/www/html/data
fi

if [ -d "/var/www/html/assets/uploads" ]; then
    echo "Setting permissions for uploads directory..."
    chown -R www-data:www-data /var/www/html/assets/uploads
    chmod -R 777 /var/www/html/assets/uploads
fi

# Pass control to the original entrypoint (apache2-foreground)
exec docker-php-entrypoint apache2-foreground
