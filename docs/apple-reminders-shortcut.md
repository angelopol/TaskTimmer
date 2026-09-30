# Recordatorios de Apple → TaskTimmer (Atajo diario)

TaskTimmer muestra tus Recordatorios de iPhone en el calendario semanal (**solo lectura**).
Un Atajo de iOS los envía una vez al día; cada envío reemplaza la copia anterior, así que lo
que borres o completes en Recordatorios se refleja en el siguiente envío.

- No hace falta cuenta de desarrollador ni instalar nada extra: solo la app **Atajos**.
- iOS / iPadOS 16 o superior (para que la automatización se ejecute sin preguntar).
- Basta con **un** dispositivo ejecutando la automatización (recomendado: el iPhone).

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

### 2.1 Rango de fechas
1. **Fecha** *(Date)* → deja **Fecha actual**.
2. **Ajustar fecha** *(Adjust Date)* → **Restar** `7` **días** a *Fecha*.
   Mantén pulsado el resultado → **Renombrar** → `Desde`.
3. **Ajustar fecha** → **Sumar** `35` **días** a *Fecha*. Renómbralo `Hasta`.

### 2.2 Buscar los recordatorios
4. **Buscar recordatorios** *(Find Reminders)*:
   - Toca **Añadir filtro**, elige **Todos los criterios** y añade:
     - **Fecha de vencimiento** · **es posterior a** · `Desde`
     - **Fecha de vencimiento** · **es anterior a** · `Hasta`
   - **Ordenar por**: Fecha de vencimiento · **Límite**: desactivado.
   - No filtres por “completado”: los completados se muestran tachados en TaskTimmer.
   - Opcional: añade **Lista** · **es** · *tu lista* si solo quieres algunas listas.

### 2.3 Convertir cada recordatorio en un diccionario
5. **Repetir con cada** *(Repeat with Each)* → sobre **Recordatorios**.

   Dentro del bloque de repetición:

6. **Formatear fecha** *(Format Date)*:
   - Entrada: toca la variable → **Elemento de repetición** → **Fecha de vencimiento**.
   - **Formato de fecha**: `ISO 8601` · activa **Incluir hora ISO 8601**.
7. **Diccionario** *(Dictionary)* con estas claves (todas de tipo **Texto**), escritas exactamente así:

   | Clave       | Valor (variable)                                          |
   |-------------|-----------------------------------------------------------|
   | `title`     | Elemento de repetición → **Título**                       |
   | `due`       | **Fecha formateada** (resultado del paso 6)               |
   | `list`      | Elemento de repetición → **Lista**                        |
   | `completed` | Elemento de repetición → **Está completado**              |
   | `notes`     | Elemento de repetición → **Notas** *(opcional)*           |
   | `priority`  | Elemento de repetición → **Prioridad** *(opcional)*       |
   | `flagged`   | Elemento de repetición → **Está marcado** *(opcional, iOS 17+)* |

   Cierra el bloque con **Finalizar repetición** (se añade solo).

### 2.4 Enviar a TaskTimmer
8. **Combinar texto** *(Combine Text)* → **Resultados de repetición** con **Nueva línea**.
9. **Obtener contenido de URL** *(Get Contents of URL)*:
   - URL: la **URL** del paso 1.
   - Toca **Mostrar más**:
     - **Método**: `POST`
     - **Encabezados** → Añadir: `Authorization` = `Bearer XXXX-XXXX-XXXX-XXXX` (tu token, con la palabra *Bearer* y un espacio).
     - **Cuerpo de la solicitud**: `JSON` → Añadir campo **Texto**: clave `reminders`, valor **Texto combinado**.
10. *(Opcional, útil para probar)* **Obtener valor del diccionario** → clave `message` del *Contenido de la URL* →
    **Mostrar notificación** con ese valor.

### 2.5 Primera ejecución (obligatoria)
Toca ▶︎ para ejecutarlo a mano **una vez**:
- iOS pedirá acceso a **Recordatorios** → **Permitir**.
- iOS preguntará si el atajo puede enviar datos a tu dominio → **Permitir siempre**.
  Si no eliges “siempre”, la automatización diaria se quedará esperando tu confirmación.
- Deberías ver `Synced N reminders.` Abre TaskTimmer → **Schedule** y verás las 🔔 en los días.

---

## 3. Automatizarlo cada día

1. **Atajos** → pestaña **Automatización** → **+** (o **Nueva automatización**).
2. **Hora del día** → elige la hora (ej. `06:00`) → **Diariamente**.
3. Selecciona **Ejecutar inmediatamente** y desactiva **Notificar al ejecutar** si no quieres aviso.
4. **Siguiente** → elige el atajo **TaskTimmer Reminders** → **OK**.

Si quieres datos más frescos, crea otra automatización igual a otra hora (ej. `13:00`).
Enviar más de una vez no duplica nada: cada envío reemplaza al anterior.

**Otros dispositivos:** el atajo se sincroniza por iCloud a iPad y Mac, donde puedes ejecutarlo a mano.
No hace falta automatizarlo en más de un dispositivo.

---

## 4. Qué verás en TaskTimmer

- **Schedule → Day by day**: bajo los bloques de cada día, la lista de recordatorios
  (hora o “All day”, lista, prioridad `!`/`!!`/`!!!`; completados tachados con ✓).
- **Schedule → Time grid**: una 🔔 con el número de recordatorios en la celda de su hora
  (ámbar = pendientes, verde = todos completados) y el total del día en la cabecera.
- Al tocar un bloque, la hoja muestra sus recordatorios en la sección **Reminders · read only**.

Todo es de **solo lectura**: para editar o completar un recordatorio usa la app Recordatorios;
el cambio llega en el siguiente envío. Los recordatorios **sin fecha** no se muestran
(no tienen lugar en el calendario). Los que tienen fecha pero no hora aparecen como **All day**.

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
| No aparece nada en la semana | Revisa el rango (`Desde`/`Hasta`) y que estés viendo la semana correcta en TaskTimmer. |

---

## 7. Referencia de la API (para pruebas)

`POST /api/ingest/reminders` — pública, autenticada con el token (no usa la sesión web).

```
Authorization: Bearer XXXX-XXXX-XXXX-XXXX
Content-Type: application/json
```

Formatos aceptados para el cuerpo:

```jsonc
{ "reminders": [ { "title": "Pagar renta", "due": "2026-10-01T09:30:00-05:00", "list": "Casa", "completed": "No", "priority": "Alta" } ] }
{ "reminders": "{…}\n{…}" }   // texto con diccionarios unidos por saltos de línea (lo que envía el atajo)
[ { … }, { … } ]              // arreglo directo
```

- `due`: ISO 8601 con zona (`2026-10-01T09:30:00-05:00`) o solo fecha (`2026-10-01`, = todo el día).
  Una hora `00:00` también se toma como “todo el día”; envía `"allDay": false` para evitarlo.
- `completed` / `flagged`: `true/false`, `Sí/No` o `Yes/No`.
- `priority`: `Alta/Media/Baja`, `High/Medium/Low` o la escala numérica de Apple.
- Máx. 1000 recordatorios y 1 MB por envío.

Respuesta: `{ "ok": true, "message": "Synced 12 reminders.", "stored": 12, "skipped": 0, "syncedAt": "…" }`

`GET /api/ingest/reminders` con el mismo encabezado comprueba el token sin modificar nada.

```bash
curl -X POST https://TU-DOMINIO/api/ingest/reminders \
  -H "Authorization: Bearer XXXX-XXXX-XXXX-XXXX" -H "Content-Type: application/json" \
  -d '{"reminders":[{"title":"Prueba","due":"2026-10-01T10:00:00-05:00","completed":"No"}]}'
```
