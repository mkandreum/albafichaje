# Prompt Maestro para Desarrollo de Albafichaje v2.0

Actúa como un Arquitecto de Software Experto y Desarrollador Full Stack Senior.
Tu tarea es recrear y mejorar una aplicación web de Control Horario y Fichaje (PWA) llamada "Albafichaje".
A continuación te detallo EXHAUSTIVAMENTE cómo funciona el sistema actual, su diseño, su lógica de negocio y la generación de informes PDF, para que puedas construir una versión igual o superior.

## 1. Visión General del Producto
Es una Web App (PWA) diseñada para el sector de la construcción ("Albaluz Desarrollos Urbanos").
**Objetivo**: Permitir a los empleados registrar su entrada y salida diaria desde el móvil, firmando digitalmente cada evento. El administrador puede ver estados en tiempo real y generar informes PDF oficiales mensuales.

## 2. Stack Tecnológico (Versión Actual)
- **Frontend**: Vanilla JavaScript (ES6+), HTML5, CSS3 Nativo (Sin frameworks CSS).
- **Backend**: API REST en PHP puro (sin frameworks).
- **Base de Datos**: MySQL/MariaDB.
- **Librerías Clave**:
  - `pdfmake`: Generación de PDFs en cliente.
  - `signature_pad`: Captura de firmas en Canvas.
- **PWA**: `manifest.json` y `sw.js` con estrategia "Network First" (Prioridad Red, fallback a Caché).

## 3. Diseño UI/UX: "Liquid Glass Premium"
El diseño es CRÍTICO. Debe verse moderno, oscuro y premium.
- **Estética**: Glassmorphism (efecto cristal), fondos oscuros (`#101010`), tarjetas translúcidas con bordes sutiles.
- **Colores**:
  - Fondo: Negro profundo.
  - Acentos: Gradientes Neón Azul (`#0A84FF`) a Violeta (`#BF5AF2`).
  - Botones "Glow": Efecto de resplandor interior y sombra al hacer hover.
- **Layout Mobile**:
  - Navegación inferior (Bottom Bar) fija.
  - Cards flotantes para la lista de empleados.
  - Menú "Más" estilo iOS Bottom Sheet (desliza desde abajo, fondo desenfocado sutil).
- **Animaciones**: Entrada en cascada (`staggered fade-in`) para las listas de empleados.

## 4. Funcionalidad Core (Lógica de Negocio)

### A. Autenticación
- Login con Email/Password (o ID).
- Persistencia: `localStorage` guarda usuario y token.
- Roles: `admin` y `empleado`.

### B. Fichaje (Dashboard Empleado)
El empleado ve un botón GRANDE para fichar.
1. **Entrada**: Registra Hora Actual + Geolocalización (opcional) + **Firma Digital** (Dibuja en pantalla).
2. **Salida**: Registra Hora Salida + Firma.
3. **Lógica de Turnos (Shift Logic) IMPRESCINDIBLE**:
   - El sistema soporta **2 turnos por día** (Mañana y Tarde).
   - **Shift 1**: Primer fichaje del día.
   - **Shift 2**: Si ya existe un fichaje CERRADO (con hora de salida) y el empleado ficha de nuevo más tarde (> hora salida anterior), el sistema detecta AUTOMÁTICAMENTE que es el turno de tarde y crea un NUEVO registro (`shift=2`) sin preguntar ni mostrar modales de "Reemplazar".
   - **Solapamientos**: Solo muestra modal de advertencia si intenta fichar en una hora que solapa con un turno abierto.

### C. Panel de Administración
- **Vista En Vivo**: Lista de empleados con indicador de estado (🟢 Trabajando, 🔴 Salido).
- **Tabla/Cards**: En Desktop es una tabla completa; en Mobile se transforma en Tarjetas detalladas.
- **Gestión Usuarios**: Crear, Editar, Eliminar (con doble confirmación), Resetear Password.
- **Generación de PDF**: Botón para descargar el "Parte de Horas" mensual.

## 5. Generación de PDF (Informe Oficial)
Esta es la parte más compleja. El PDF se genera con `pdfmake` en el cliente.

**Estructura del PDF:**
1. **Cabecera**:
   - Logo de la empresa.
   - Tabla de datos fiscales (Empresa: ALBALUZ..., CIF, CCC, Trabajador, NIF, Nº Afiliación, Mes/Año).
2. **Tabla Central (Grid de Fichajes)**:
   - Filas: Días del 1 al 31 del mes.
   - **Columnas**:
     1. **DIA**: Día del mes (1, 2, 3...)
     2. **HORA ENTRADA** (ColSpan 2): Muestra Hora Entrada Turno 1 | Hora Entrada Turno 2.
     3. **HORA SALIDA** (ColSpan 2): Muestra Hora Salida Turno 1 | Hora Salida Turno 2.
     4. **HORAS TOTALES**: Suma de horas del día.
     5. **FIRMAS ENTRADA** (ColSpan 2): Imagen Firma Entrada 1 | Imagen Firma Entrada 2.
     6. **FIRMAS SALIDA** (ColSpan 2): Imagen Firma Salida 1 | Imagen Firma Salida 2.
   - **Estilo Tabla**:
     - Cabecera gris oscuro, texto blanco.
     - Filas alternas blanco/gris muy claro.
     - Bordes finos grises.
     - Letra pequeña (8-9pt) para que quepa todo el mes en una hoja.
     - Imágenes de firma redimensionadas.
3. **Pie**:
   - Firma del trabajador (Principal) y Sello de la empresa.
   - Totales de horas mensuales sumadas.

## 6. Base de Datos (Esquema Inferido)
- **Table `users`**: `id`, `nombre`, `apellidos`, `email`, `password` (hash), `dni`, `afiliacion`, `role`, `main_signature`.
- **Table `fichajes`**:
  - `id`
  - `user_id`
  - `date` (YYYY-MM-DD)
  - `entry_time` (HH:MM:SS)
  - `exit_time` (HH:MM:SS)
  - `entry_signature` (BLOB/Path/Base64)
  - `exit_signature` (BLOB/Path/Base64)
  - `shift` (INT: 1 para mañana, 2 para tarde)
  - `coordinates` (JSON/String, opcional)

## Instrucciones para la Nueva Versión
Al recrear esto, mantén:
1. La estrategia de caché **Network First** en el Service Worker.
2. La lógica de **Shift Automático** (Mañana/Tarde sin preguntas superfluas).
3. El diseño oscuro Premium con Glassmorphism.
4. La funcionalidad 100% Offline-First para fichajes (si es posible con IndexedDB sincronizando luego).

---
*Este prompt contiene toda la lógica de negocio y diseño del proyecto actual "Albafichaje v6/v7"*
