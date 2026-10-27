# Evaluación de intereses vocacionales - Miguel Febres Cordero

Plataforma web para 60 estudiantes de Décimo A y B. Cuestionario de 50 afirmaciones, cinco especialidades (10 preguntas por área), respuestas sin retroceso, reinicios auditados, almacenamiento local SQLite o PostgreSQL en Supabase, exportación CSV y descarga directa de informes PDF individuales.

## 1. Ejecutar en un equipo del colegio

Requisitos: **Node.js 22 o superior**. El modo local no requiere servicios en la nube; la instalación de producción utiliza el paquete npm `pg` para la opción PostgreSQL/Supabase.

1. Extrae el ZIP **completo** en una carpeta de tu computadora. No abras `public/index.html` directamente: la plataforma necesita el servidor.
2. En una terminal dentro de la carpeta `plataforma_vocacional_mfc`, ejecuta `npm start`.
3. Abre `http://127.0.0.1:3000` en un navegador del mismo equipo.
4. **Docente:** entra en la pestaña Docente con la contraseña **0504784075**.
5. **Estudiante de demostración:** código `D00`, PIN `123456` (solo aparece en modo local de prueba). No se incluye en los resultados de los 60 estudiantes.

**Importante:** no publiques la contraseña ni el código fuente en una web abierta. Si cambias la contraseña, puedes definir la variable de entorno `ADMIN_PASSWORD`. Se recomienda elegir una contraseña más fuerte antes de habilitar el uso público o compartido.

Para que otros equipos del laboratorio se conecten, se puede iniciar con `HOST=0.0.0.0 npm start` (en Linux/macOS; en Windows configura la variable según la terminal) y abrir `http://IP-LOCAL-DEL-SERVIDOR:3000` desde una red del colegio. Debes limitar el acceso a esa red desde el firewall y evitar exponer el puerto a Internet sin HTTPS, controles y auditoría.

## 2. Almacenamiento local, sin base de datos externa

Al primer arranque, el servidor crea automáticamente:

- `data/vocacional.db`: base de datos **SQLite interna** con estudiantes, respuestas, resultados, reinicios y accesos.
- `data/CLAVES_PRIVADAS_DOCENTE.csv`: códigos y PIN individuales de los 60 estudiantes. Entrega cada PIN de forma privada.
- `data/backups/`: copias SQLite automáticas al arrancar y una vez al día mientras el servidor permanece encendido, con retención de 14 días.

En el panel docente hay un botón **Respaldar SQLite** que permite descargar una copia consistente completa para guardarla en otro lugar seguro (por ejemplo una USB cifrada). **El almacenamiento interno no garantiza que los datos sobrevivan a una avería, robo o pérdida del equipo**, por lo que es imprescindible hacer respaldos y comprobar su restauración periódicamente. Los archivos `.db-wal` y `.db-shm` pueden aparecer mientras el sistema funciona; no deben borrarse manualmente.

La carpeta `data/` **no está incluida en este ZIP** deliberadamente: al instalar en otro equipo se crea una base vacía nueva, evitando distribuir datos y PIN ya generados. Si actualizas una instalación que ya contiene evaluaciones, conserva la carpeta `data/` y no la sustituyas por la de una instalación nueva.

## 3. Credenciales

- Docente: contraseña `0504784075`.
- Alumno de prueba: `D00`, PIN `123456`, solo al acceder desde `127.0.0.1` o `localhost` con modo demostración activado.
- Alumnos reales: `A01` a `A30` y `B01` a `B30`. Se crean con PIN aleatorios de seis dígitos, disponibles desde el panel docente en la exportación privada.
- El acceso directo de demostración **solo corresponde al estudiante**; el docente tiene que escribir su contraseña.

## 4. Evaluación y cálculo

- Se muestran las 50 preguntas originales en su orden, una por pantalla.
- `Me interesa` equivale a 1 punto; `No me interesa`, a 0 puntos en la especialidad asignada.
- El servidor valida que solo se conteste la pregunta pendiente; no permite editar preguntas anteriores ni repetir una respuesta.
- El avance se guarda de forma inmediata en SQLite; el estudiante puede regresar otro día y continuar donde quedó.
- Antes de finalizar puede **reiniciar desde cero**, tras confirmar. El intento anterior se conserva en el historial, pero no cuenta en la calificación del intento activo.
- Si ya respondió las 50 preguntas, solo un docente puede autorizar otro intento.
- Si hay empate entre especialidades, se muestran todas las que alcancen el máximo.

| Especialidad | Preguntas |
| --- | --- |
| Diseño Gráfico | 3, 10, 15, 18, 25, 26, 28, 31, 40, 47 |
| Desarrollo de Software | 5, 22, 24, 30, 34, 35, 37, 39, 48, 50 |
| Turismo | 1, 4, 7, 11, 19, 20, 33, 41, 42, 45 |
| Ciencias | 2, 6, 8, 12, 16, 23, 38, 43, 46, 49 |
| Gestión Administrativa | 9, 13, 14, 17, 21, 27, 29, 32, 36, 44 |

## 5. Informe individual PDF (descarga directa)

El alumno que termine sus 50 respuestas verá el botón **Descargar PDF completo**, además de **Imprimir**. El docente puede abrir la ficha de cada estudiante finalizado y pulsar **Descargar PDF**.

Cada PDF A4 contiene: institución y año, estudiante, paralelo, código, fecha, número de intento, total de `Me interesa` y `No me interesa`, puntuación y porcentaje en las cinco especialidades, área(s) de mayor afinidad y **las 50 preguntas con cada respuesta y área correspondiente**. Se emite a partir de los datos reales de SQLite; no es un PDF ficticio ni necesita un programa de oficina externo.

Cuando un docente autoriza reiniciar una evaluación ya finalizada, **el PDF del intento anterior sigue disponible** en la ficha del alumno bajo `Constancias de intentos finalizados`. Los intentos incompletos no reciben un informe final.

**Nota:** los PDF se producen bajo demanda; su información y el historial persisten en SQLite. Se recomienda descargar o archivar los informes importantes y respaldar la base.

## 6. Panel docente

- Consulta 60 estudiantes por paralelo, estado y avance.
- Visualiza todas las afinidades e histórico de intentos finalizados.
- Descarga informes PDF individuales (incluyendo constancias anteriores).
- Exporta resultados a CSV compatible con Excel.
- Autoriza reinicios de evaluaciones finalizadas y regenera PIN individuales.
- Descarga una copia consistente de la base SQLite interna.

## 7. Pruebas y mantenimiento

Ejecuta `npm test` desde la carpeta del proyecto para comprobar la integridad del cuestionario, puntuaciones y generador PDF. Comprueba periódicamente los respaldos y verifica los nombres de los 60 alumnos contra la nómina oficial antes de entregar credenciales.

La carpeta `data/` contiene datos personales de menores; mantén el equipo actualizado, los permisos restringidos, las contraseñas privadas y protección contra acceso no autorizado. El PDF contiene datos sensibles: entrégalo únicamente al alumno correspondiente o al docente autorizado. La evaluación mide **intereses declarados**, no capacidades ni aptitudes certificadas.

## 8. Vista previa independiente

El archivo `vista_previa_vocacional_actualizada.html` que se entrega por separado **es un simulador visual**. Sus respuestas de demostración se guardan únicamente en el navegador y no alimentan SQLite. Para almacenamiento centralizado real, el control docente efectivo, los respaldos y los PDF directos debe utilizarse el proyecto Node.js del ZIP.

## 9. Despliegue gratuito con Vercel y Supabase

El modo local anterior no cambia: `npm start` continúa usando SQLite y las copias locales. En Vercel, la aplicación usa PostgreSQL administrado por Supabase; no guarda datos de la aplicación en el sistema de archivos de la función. El despliegue no importa automáticamente datos de un archivo SQLite existente: inicia una nómina nueva en la base de datos configurada.

1. Crea un proyecto Supabase y una aplicación Vercel desde este repositorio. En Supabase, copia la URI de **Transaction pooler** (host terminado en `.pooler.supabase.com`, puerto `6543`) desde *Connect*. No uses la contraseña de Postgres en el código ni la URI de conexión directa; configura la URI completa como secreto.
2. En Supabase → **Database Settings → SSL Configuration**, descarga el certificado CA del proyecto. Codifícalo localmente a Base64 (PowerShell):
   ```powershell
   [Convert]::ToBase64String([IO.File]::ReadAllBytes("C:\ruta\al\prod-ca-2021.crt"))
   ```
   En Vercel → **Settings → Environment Variables**, agrega para Production (y Preview solo si corresponde):
   - `DATABASE_URL`: URI del Transaction pooler de Supabase.
   - `ADMIN_PASSWORD`: contraseña docente nueva, aleatoria y de al menos 16 caracteres. No uses la clave de demostración de esta documentación.
   - `CREDENTIALS_ENCRYPTION_KEY`: clave independiente de exactamente 32 bytes codificada en Base64. Genérala localmente con `node -e "console.log(require('node:crypto').randomBytes(32).toString('base64'))"`.
   - `DATABASE_CA_CERT_B64`: certificado CA de Supabase codificado a Base64 con el comando PowerShell anterior. La conexión TLS verifica el certificado y el nombre del servidor; no desactives esa verificación.
3. Vuelve a desplegar. La función crea las tablas y, si están vacías, la nómina de 60 estudiantes, claves individuales aleatorias y una copia cifrada AES-256-GCM de las claves iniciales. **La clave cifradora nunca se guarda en PostgreSQL**; conserva una copia protegida fuera de Vercel. Si se pierde o se cambia, no será posible recuperar la copia cifrada ya creada. Nunca la publiques ni la incluyas en Git.
4. Inicia sesión como docente y descarga inmediatamente **Claves iniciales privadas**. Entrega los PIN de forma privada. El CSV se descifra únicamente para esta respuesta autenticada y se envía con `Cache-Control: no-store`; la base conserva solo el ciphertext. Los PIN regenerados se muestran una vez en la respuesta del panel.
5. Antes de registrar alumnos reales, verifica el inicio docente, el acceso de prueba (no debe estar disponible), guardado de respuestas, reinicios, exportación CSV y PDF. La URI y las contraseñas solo deben configurarse como variables protegidas del proveedor.

El modo Vercel se selecciona automáticamente y rechaza el arranque si faltan las variables requeridas o si la conexión no es el Transaction pooler de Supabase. No usa la contraseña docente predeterminada ni crea el alumno `D00`. Las conexiones PostgreSQL usan TLS con validación de la CA de Supabase. Las sesiones se guardan en PostgreSQL y la cookie se marca `Secure`, `HttpOnly` y `SameSite=Strict`.

El botón **Respaldar SQLite** sigue disponible: en Vercel genera un snapshot consistente en memoria, descargable como SQLite y sin escribir archivos de la función. Incluye los datos personales, hashes de PIN/sesión, auditoría y el ciphertext cifrado de las claves iniciales, pero no la clave de cifrado. Descarga periódicamente la copia y comprueba su restauración con acceso restringido. Configura y comprueba también la política de respaldo de Supabase disponible en tu plan antes de almacenar resultados reales; los planes gratuitos pueden tener límites de retención. Protege los CSV y PDFs descargados, pues contienen información personal de estudiantes menores. La aplicación no debe considerarse un sustituto de la evaluación institucional de privacidad, consentimiento y normativa aplicable.
