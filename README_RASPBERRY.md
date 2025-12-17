# 🚀 Despliegue en Raspberry Pi (Backend Seguro)

Este proyecto ha sido optimizado y asegurado para funcionar en una Raspberry Pi con PHP y Apache.

## 🛠 Requisitos

*   **Raspberry Pi** (3, 4, o 5) o cualquier servidor Linux.
*   **Apache2**
*   **PHP** (7.4 o superior)

## 📦 Instalación

1.  **Instalar dependencias:**
    ```bash
    sudo apt update
    sudo apt install apache2 php libapache2-mod-php
    ```

2.  **Copiar archivos:**
    Copia todo el contenido de esta carpeta a `/var/www/html/` en tu Raspberry Pi.

3.  **Permisos (IMPORTANTE):**
    Para que el sistema pueda guardar usuarios y firmas, la carpeta `data` debe ser escribible por el servidor web (`www-data`).
    ```bash
    cd /var/www/html
    sudo chown -R www-data:www-data data
    sudo chmod -R 770 data
    ```
    *Nota: El archivo `data/.htaccess` ya protege esta carpeta para que nadie pueda descargar los JSON directamente.*

4.  **Probar:**
    Abre el navegador en cualquier ordenador de la misma red y entra a:
    `http://<IP-DE-TU-RASPBERRY>`

## 🔒 Seguridad Implementada

*   **Backend PHP:** Toda la lógica sensible (login, guardar fichaje) está en `api/`.
*   **Datos Ocultos:** Los archivos `users.json`, `fichajes.json` y las firmas están en `data/` y protegidos contra acceso web directo.
*   **Frontend Ofuscado:** El código JS ha sido limpiado de comentarios y logs para dificultar su lectura directa.
*   **Validación de Sesión:** Se utilizan sesiones PHP seguras en lugar de `localStorage` inseguro.

## 📱 Uso

1.  **Registro:** Crea el primer usuario.
2.  **Admin:** Si necesitas un administrador, edita manualmente `data/users.json` (con `nano`) y cambia el rol del usuario a `"role": "admin"`.
3.  **Fichar:** Los usuarios pueden fichar desde sus móviles.
4.  **PDF:** Genera informes mensuales firmados y válidos legalmente.
