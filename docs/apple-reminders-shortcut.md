# Recordatorios de Apple → TaskTimmer (Atajo diario)

TaskTimmer muestra tus Recordatorios **pendientes** de iPhone en el calendario semanal. Solo puedes **completarlos**
desde TaskTimmer; lo demás se edita en la app Recordatorios.
Un Atajo de iOS envía una vez al día **todos** los recordatorios no completados, sin filtros de fecha.
TaskTimmer compara la lista con lo que ya tiene:

- **Nuevo** → se registra una sola vez (nunca se duplica, aunque el atajo corra varias veces).
- **Ya registrado** → se actualiza si cambió su fecha, notas o prioridad.
- **Ya no viene en la lista** (lo completaste o borraste) → desaparece de TaskTimmer.
- **Completado en TaskTimmer** → el atajo lo completa en tu iPhone en su siguiente ejecución (ver 2.4).

- No hace falta cuenta de desarrollador ni instalar nada extra: solo la app **Atajos**.
- iOS / iPadOS 16 o superior (para que la automatización se ejecute sin preguntar).
- Basta con **un** dispositivo ejecutando la automatización (recomendado: el iPhone).

> **Guía rápida en la app:** abre TaskTimmer en el iPhone → avatar → **Apple Reminders** → **Open setup guide**
> (ruta `/integrations/reminders`). Tiene los mismos pasos con botones para copiar cada valor y el token ya rellenado.
> Este documento es la versión completa, con solución de problemas y referencia de la API.

---

## 1. Obtener el token en TaskTimmer

1. Abre TaskTimmer e inicia sesión.
2. Toca tu avatar (arriba a la derecha) → **Apple Reminders** → **Connect**.
3. Copia los dos valores que aparecen:
   - **Token**: `XXXX-XXXX-XXXX-XXXX` (16 caracteres; mayúsculas/guiones no importan).
   - **URL**: `https://TU-DOMINIO/api/ingest/reminders`

> El token solo se muestra una vez. Si lo pierdes, toca **New token** (el anterior deja de funcionar)
> y actualízalo en el atajo.

---

## 2. Crear el atajo “TaskTimmer Reminders”

Abre **Atajos** → pestaña **Atajos** → **+**. Nómbralo `TaskTimmer Reminders` y añade estas acciones
en orden (entre paréntesis, el nombre en inglés):

### 2.1 Buscar los recordatorios pendientes
1. **Buscar recordatorios** *(Find Reminders)*:
   - Toca **Añadir filtro** y déjalo como **No está completado** *(Is Not Completed)*.
   - **Sin filtros de fecha** y **Límite** desactivado.
   - Opcional: añade **Lista** · **es** · *tu lista* si solo quieres algunas listas.

### 2.2 Convertir cada recordatorio en un diccionario
2. **Repetir con cada** *(Repeat with Each)* → sobre **Recordatorios**.

   Dentro del bloque de repetición:

3. **Formatear fecha** *(Format Date)*:
   - Entrada: toca la variable → **Elemento de repetición** → **Fecha de vencimiento**.
   - **Formato de fecha**: `ISO 8601` · activa **Incluir hora ISO 8601**.
   - Si un recordatorio no tiene fecha, el resultado queda vacío: no pasa nada.
4. **Diccionario** *(Dictionary)* con estas claves (todas de tipo **Texto**), escritas exactamente así:

   | Clave       | Valor (variable)                                          |
   |-------------|-----------------------------------------------------------|
   | `title`     | Elemento de repetición → **Título**                       |
   | `due`       | **Fecha formateada** (resultado del paso 3)               |
   | `list`      | Elemento de repetición → **Lista**                        |
   | `created`   | Elemento de repetición → **Fecha de creación** *(recomendado)* |
   | `notes`     | Elemento de repetición → **Notas** *(opcional)*           |
   | `priority`  | Elemento de repetición → **Prioridad** *(opcional)*       |
   | `flagged`   | Elemento de repetición → **Está marcado** *(opcional, iOS 17+)* |

   `created` distingue recordatorios con el mismo nombre en la misma lista. Sin ella, dos recordatorios
   iguales (mismo título y lista) cuentan como uno.

   Cierra el bloque con **Finalizar repetición** (se añade solo).

### 2.3 Enviar a TaskTimmer
5. **Combinar texto** *(Combine Text)* → **Resultados de repetición** con **Nueva línea**.
6. **Obtener contenido de URL** *(Get Contents of URL)*:
   - URL: la **URL** del paso 1.
   - Toca **Mostrar más**:
     - **Método**: `POST`
     - **Encabezados** → Añadir: `Authorization` = `Bearer XXXX-XXXX-XXXX-XXXX` (tu token, con la palabra *Bearer* y un espacio).
     - **Cuerpo de la solicitud**: `JSON` → Añadir campo **Texto**: clave `reminders`, valor **Texto combinado**.
7. *(Opcional, útil para probar)* **Obtener valor del diccionario** → clave `message` del *Contenido de la URL* →
    **Mostrar notificación** con ese valor.

### 2.4 Completar en el iPhone lo que terminaste en TaskTimmer
TaskTimmer responde al envío con la lista `complete` (título y lista de cada recordatorio que marcaste como
hecho en la app y que sigue pendiente en el iPhone). Añade esto **después** de *Obtener contenido de URL*:

8. **Obtener valor del diccionario** *(Get Dictionary Value)*: clave `complete` del *Contenido de la URL*.
9. **Repetir con cada** *(Repeat with Each)* sobre esa lista. Dentro del bloque:
   - **Obtener valor del diccionario**: clave `title` del *Elemento de repetición* → renómbralo `Title`.
   - **Obtener valor del diccionario**: clave `list` → renómbralo `List`.
   - **Buscar recordatorios** *(Find Reminders)*: **Título es** `Title`, **Lista es** `List`, **No está completado**; **Límite**: 1.
   - **Editar recordatorios** *(Edit Reminders)*: **Está completado** = **Sí**. Si no encuentras la acción, busca “complete” o “completar” en la lista de acciones.

Si el atajo falla en este paso, el recordatorio vuelve a venir en `complete` en cada envío hasta que desaparece
de tu lista pendiente, así que se reintenta solo. Si hay dos recordatorios con el mismo título en la misma lista,
se completa uno (límite 1); el otro queda pendiente.

### 2.5 Primera ejecución (obligatoria)
Toca ▶︎ para ejecutarlo a mano **una vez**:
- iOS pedirá acceso a **Recordatorios** → **Permitir**.
- iOS preguntará si el atajo puede enviar datos a tu dominio → **Permitir siempre**.
  Si no eliges “siempre”, la automatización diaria se quedará esperando tu confirmación.
- Deberías ver `Synced N pending: N new, 0 updated, 0 removed.` Abre TaskTimmer → **Schedule** y verás las 🔔 en los días.

---

## 3. Automatizarlo cada día

1. **Atajos** → pestaña **Automatización** → **+** (o **Nueva automatización**).
2. **Hora del día** → elige la hora (ej. `06:00`) → **Diariamente**.
3. Selecciona **Ejecutar inmediatamente** y desactiva **Notificar al ejecutar** si no quieres aviso.
4. **Siguiente** → elige el atajo **TaskTimmer Reminders** → **OK**.

Si quieres datos más frescos, crea otra automatización igual a otra hora (ej. `13:00`).
Enviar más de una vez no duplica nada: los recordatorios ya registrados se reconocen y no se vuelven a crear.

**Otros dispositivos:** el atajo se sincroniza por iCloud a iPad y Mac, donde puedes ejecutarlo a mano.
No hace falta automatizarlo en más de un dispositivo.

---

## 4. Qué verás en TaskTimmer

- **Schedule → Day by day**: bajo los bloques de cada día, sus recordatorios pendientes
  (hora o “All day”, lista y prioridad `!`/`!!`/`!!!`).
- **Schedule → Time grid**: una 🔔 con el número de recordatorios en la celda de su hora
  y el total del día en la cabecera.
- Al tocar un bloque, la hoja muestra sus recordatorios en la sección **Reminders · read only**.
- **Sin fecha**: arriba del calendario, un apartado plegable “N reminders without a date”.

Todo es de **solo lectura**, salvo **completar**: toca el círculo de un recordatorio (o **Mark as done** en su
hoja de detalle). Queda tachado con “Sends to iPhone on next sync” y llega a la app Recordatorios cuando el atajo se
ejecuta de nuevo. Hasta ese momento puedes **deshacerlo**; después ya solo se reabre en el iPhone.
Cualquier otro cambio (título, fecha, notas…) se hace en la app Recordatorios y llega en el siguiente envío.
Al completarse en el iPhone, deja de enviarse y desaparece de TaskTimmer.

**Frecuencia:** TaskTimmer no puede empujar nada al iPhone, solo responder cuando el atajo le escribe. Si quieres que lo
que completas aquí llegue antes, añade más automatizaciones (por ejemplo cada pocas horas).

### Cómo se evita registrar dos veces el mismo recordatorio
Atajos no expone un identificador del recordatorio, así que TaskTimmer usa
**título + lista + fecha de creación** (sin distinguir mayúsculas). Por eso:

- Cambiar la **fecha, notas o prioridad** actualiza el mismo recordatorio.
- Cambiar el **título o la lista** se ve como uno nuevo (y el anterior se elimina): no hay duplicados.
- Si no envías `created`, dos recordatorios con el mismo título en la misma lista cuentan como uno.

---

## 5. Seguridad

- El token tiene 16 caracteres aleatorios (~80 bits). TaskTimmer guarda solo su hash SHA-256.
- El token **solo sirve para subir recordatorios**: no permite leer ni modificar nada más de tu cuenta.
- Hay límite de peticiones por IP; tras 10 tokens inválidos en una hora, la IP queda bloqueada temporalmente.
- **New token** invalida el anterior al instante. **Disconnect** borra el token y los recordatorios guardados.
- Si compartes el atajo con alguien, **borra antes el token** del encabezado `Authorization`.

---

## 6. Solución de problemas

| Mensaje / síntoma | Causa y solución |
|---|---|
| `Invalid or revoked token.` (401) | Token mal copiado, sin `Bearer `, o regenerado. Copia uno nuevo. |
| `Too many requests` (429) | Demasiados intentos. Espera unos minutos (hasta 1 h si hubo tokens inválidos). |
| `No reminders could be read…` (422) | Las claves del diccionario no coinciden. Deben ser exactamente `title`, `due`, … |
| Las horas salen desplazadas | En **Formatear fecha** falta `ISO 8601` + **Incluir hora ISO 8601**. |
| Todos salen como “All day” | Esos recordatorios no tienen hora, o el formato de fecha no incluye la hora. |
| La automatización no corre sola | Falta **Ejecutar inmediatamente**, o no elegiste **Permitir siempre** en la primera ejecución. |
| No aparece nada en la semana | Confirma el filtro **No está completado** y que estés viendo la semana correcta. Los que no tienen fecha están en “without a date”. |
| Falta un recordatorio con nombre repetido | Añade la clave `created` (Fecha de creación) al diccionario. |

---

## 7. Referencia de la API (para pruebas)

`POST /api/ingest/reminders` — pública, autenticada con el token (no usa la sesión web).

```
Authorization: Bearer XXXX-XXXX-XXXX-XXXX
Content-Type: application/json
```

Formatos aceptados para el cuerpo:

```jsonc
{ "reminders": [ { "title": "Pagar renta", "due": "2026-10-01T09:30:00-05:00", "list": "Casa", "created": "1 sep 2026, 8:00", "priority": "Alta" } ] }
{ "reminders": "{…}\n{…}" }   // texto con diccionarios unidos por saltos de línea (lo que envía el atajo)
[ { … }, { … } ]              // arreglo directo
```

- Cada envío debe contener **todos** los pendientes: lo que ya no viene se elimina de TaskTimmer.
- `title` es obligatorio. `created` (cualquier texto estable) identifica el recordatorio junto con título y lista.
- `due`: ISO 8601 con zona (`2026-10-01T09:30:00-05:00`), solo fecha (`2026-10-01`, = todo el día) o vacío (sin fecha).
  Una hora `00:00` también se toma como “todo el día”; envía `"allDay": false` para evitarlo.
- Los elementos con `completed` = `true/Sí/Yes` se ignoran. `flagged` acepta los mismos valores.
- `priority`: `Alta/Media/Baja`, `High/Medium/Low` o la escala numérica de Apple.
- Máx. 1000 recordatorios y 1 MB por envío.

Respuesta:

```json
{ "ok": true, "message": "Synced 12 pending: 2 new, 1 updated, 3 removed.",
  "pending": 12, "created": 2, "updated": 1, "unchanged": 9, "removed": 3,
  "complete": [ { "title": "Pagar renta", "list": "Casa" } ],
  "duplicates": 0, "ignoredCompleted": 0, "unreadable": 0, "syncedAt": "…" }
```

`complete` lista los recordatorios marcados como hechos en TaskTimmer que siguen pendientes en el iPhone (`list` va
vacío si no tienen lista). El atajo debe buscar cada uno por título y lista y completarlo. Mientras sigan llegando como
pendientes, vuelven a aparecer en `complete` en cada envío.

`GET /api/ingest/reminders` con el mismo encabezado comprueba el token sin modificar nada.

```bash
curl -X POST https://TU-DOMINIO/api/ingest/reminders \
  -H "Authorization: Bearer XXXX-XXXX-XXXX-XXXX" -H "Content-Type: application/json" \
  -d '{"reminders":[{"title":"Prueba","due":"2026-10-01T10:00:00-05:00","list":"Casa"}]}'
```
