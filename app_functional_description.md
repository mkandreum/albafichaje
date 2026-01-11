# Descripción Funcional de la App "Albafichaje"

Esta es una descripción detallada de **qué hace la aplicación** y **cómo funciona**, sin entrar en código ni tecnologías. Úsala para explicar el proyecto a diseñadores, jefes de producto o para pedir a una IA que cree una versión similar basándose en la experiencia de usuario.

## 1. ¿Qué es Albafichaje?
Es una aplicación web móvil (que se puede instalar como una App normal en el teléfono) diseñada para que los trabajadores de la construcción registren sus horas de entrada y salida de forma digital y legalmente válida.

## 2. Experiencia del Empleado (Usuario Básico)
El empleado usa la app en su móvil personal. Su experiencia es extremadamente sencilla:

### A. Pantalla Principal (El Fichaje)
- Al abrir la app, ve un **Botón Gigante** central.
- **Para Entrar**: Pulsa el botón. Se abre un recuadro para **Firmar con el dedo**. Al firmar y aceptar, se registra la hora y la firma.
- **Para Salir**: El botón cambia de color (rojo). Al pulsar, vuelve a firmar para confirmar la salida.
- **Doble Turno (Mañana y Tarde)**:
  - La app es inteligente. Si el trabajador ficha por la mañana, sale a comer, y vuelve a entrar por la tarde, la app crea automáticamente un **segundo turno** para ese día sin hacer preguntas complicadas.
  - No hay límites de "fichajes por día", pero el sistema los organiza ordenadamente en Turno 1 y Turno 2 para el informe.

### B. Otras Funciones del Empleado
- **Modo Sin Conexión**: Si no hay internet en la obra, puede fichar igual. La app guarda los datos y los envía cuando recupere la conexión.
- **Historial**: Puede ver una lista de sus fichajes anteriores.
- **Instalación**: Puede instalar la app en su pantalla de inicio (Android/iPhone) para abrirla sin navegador, a pantalla completa y sin barras de dirección.

## 3. Experiencia del Administrador (Encargado/Jefe)
El administrador tiene un panel de control con poderes totales:

### A. Control en Vivo
- Ve una lista de todos los empleados.
- Un indicador (Punto Verde/Rojo) le dice quién está **trabajando ahora mismo** y quién ya ha salido.
- En el móvil, ve tarjetas modernas con la foto del empleado y botones rápidos. En el ordenador, ve una tabla completa.

### B. Gestión de Personal
- Puede dar de alta nuevos trabajadores.
- Puede corregir fichajes si alguien se olvidó de fichar o se equivocó de hora.
- Puede eliminar usuarios y sus datos (con confirmación de seguridad).

### C. El Informe Mensual (La Clave del Sistema)
La función más importante es el **Generador de Informes**.
El administrador puede descargar un **PDF Oficial** de cualquier empleado y mes.

**¿Cómo es este PDF?**
- Está diseñado para cumplir con la ley y presentar ante inspecciones.
- **Cabecera**: Datos de la empresa (Albaluz), Logo y datos del trabajador.
- **Cuerpo Central**: Una cuadrícula perfecta con los días del 1 al 31.
  - **Columnas**: Día | Hora Entrada (Turno 1 y 2) | Hora Salida (Turno 1 y 2) | Total Horas.
  - **Firmas**: Lo más impresionante es que **las firmas manuscritas** que hizo el empleado en el móvil aparecen incrustadas en el PDF, día a día, entrada y salida.
- **Pie**: Firma final y sello de la empresa.

## 4. Diseño Visual y Estilo
La aplicación no parece una web corporativa aburrida. Tiene un estilo **"Premium Dark"**:
- **Fondo Negro Profundo**: Ahorra batería y se ve elegante.
- **Efecto Cristal (Glassmorphism)**: Los menús y tarjetas parecen cristales translúcidos sobre el fondo.
- **Colores Neón**: Botones con brillos azules y violetas que "resplandecen".
- **Animaciones**: Las listas no aparecen de golpe, sino en "cascada" (una tras otra suavemente).

---
**Resumen**: Es una herramienta digital que sustituye a la hoja de papel de firmas, automatizando el control horario, soportando turnos partidos y generando informes legales impecables al instante, todo con un diseño de alta gama.
