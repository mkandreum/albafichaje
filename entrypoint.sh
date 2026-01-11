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

# Initialize default users.json if missing
if [ ! -f "/var/www/html/data/users.json" ]; then
    echo "Initializing users.json..."
    # Password hash for 'admin123'
    cat > /var/www/html/data/users.json <<EOF
[
  {
    "id": "6761dfa8ed432",
    "email": "admin@fichaje.com",
    "password": "\$2y\$10\$vI8aWBnW3fID.ZQ4/zo1G.q1lRps.9cGLcZEiGDMVr5yUP1KUOYTa",
    "nombre": "Administrador",
    "apellidos": "Sistema",
    "dni": "00000000T",
    "afiliacion": "000000000000",
    "role": "admin",
    "createdAt": "2025-12-17T21:20:00+01:00"
  }
]
EOF
    chown www-data:www-data /var/www/html/data/users.json
    chmod 666 /var/www/html/data/users.json
    echo "users.json created."
fi

# Pass control to the original entrypoint (apache2-foreground)
exec docker-php-entrypoint apache2-foreground
