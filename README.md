# AlbaFichaje - Sistema de Gestión de Fichajes

Sistema web moderno para el control de horarios y fichajes, diseñado con una estética "Liquid Glass" y optimizado para dispositivos móviles y pantallas táctiles.

## 📱 Características Principales

- **Diseño Mobile-First**: Interfaz responsive adaptada a móviles con soporte táctil completo.
- **Firma Digital**: Captura de firmas de entrada y salida mediante panel táctil.
- **Gestión de Fichajes**: Registro de hora de entrada y salida con validación.
- **Generación de PDF**: Informes mensuales completos en PDF con firmas incrustadas.
- **Panel de Administración**: Vista para administradores para revisar fichajes de todos los empleados.
- **Estética Premium**: Diseño estilo iOS "Liquid Glass" con efectos de transparencia y desenfoque.

## 🚀 Instalación y Despliegue

Este proyecto utiliza **PHP** como backend simple (basado en archivos JSON, sin base de datos SQL) y **Vanilla JS/CSS** para el frontend.

### Requisitos
- Servidor Web (Apache/Nginx) con soporte PHP 7.4+.
- Permisos de escritura en la carpeta `data/` y `assets/uploads/`.

### Pasos
1. **Clonar/Copiar** los archivos al servidor web.
2. **Permisos**: Asegúrate de que las carpetas de datos sean escribibles:
   ```bash
   chmod -R 777 data
   chmod -R 777 assets/uploads
   ```
3. **Usuarios por Defecto**:
   El sistema se inicializa con un archivo `users.json` si no existe. El primer registro puede hacerse desde la interfaz de "Registrarse".

To reset admins manually, edit `data/users.json`.

## 🛠️ Tecnologías

- **Frontend**: HTML5, CSS3 (Variables, Flexbox/Grid), JavaScript (ES6+).
- **Backend**: PHP (API REST sencilla).
- **Almacenamiento**: Archivos JSON (en carpeta `/data`).
- **PDF**: `pdfmake` (lado del cliente).

## 📱 Uso en Móvil

La aplicación está diseñada para funcionar como una Web App. Puede añadirse a la pantalla de inicio (Add to Home Screen) en iOS/Android para una experiencia de pantalla completa.

---
Desarrollado para Alba Luz Desarrollos Urbanos.
