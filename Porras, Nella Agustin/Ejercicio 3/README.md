# Ejercicio 3 — API de tareas

Desarrollar una API con ExpressJS para administrar tareas y su estado de avance.
Cada tarea deberá contar con un nombre y un estado que indique si fue
completada, y esta información se conservará en un arreglo interno.

No podrán existir tareas con el mismo nombre. La API deberá facilitar consultas
que permitan diferenciar las tareas completadas de las pendientes.

## Decisiones de diseño

### 1. Un único recurso: `/tareas`

Las tareas completadas y las pendientes no son recursos distintos: son la misma
entidad en dos momentos de su vida. Por eso no existen rutas como
`/tareas/completadas` o `/tareas/pendientes` ni colecciones separadas.

Separarlas obligaría a *mover* una tarea de una colección a otra cada vez que
cambia su estado, y el id de la tarea (su URL) dejaría de ser estable.

### 2. El modelo: `{ id, nombre, completada }`

| Campo        | Tipo      | Descripción                                   |
| ------------ | --------- | --------------------------------------------- |
| `id`         | entero    | Identificador asignado por el servidor        |
| `nombre`     | string    | Descripción de la tarea, única en la colección |
| `completada` | booleano  | `true` si fue completada, `false` si está pendiente |

El estado se modela como un **booleano** y no como un texto (`"pendiente"`,
`"completada"`), porque el enunciado plantea solo dos estados posibles. Un
booleano no admite valores intermedios ni errores de escritura
(`"Completada"`, `"completo"`), así que no hace falta validar una lista de
textos permitidos.

**El `id` es el identificador, no el nombre.** Aunque el nombre sea único,
puede modificarse, y usarlo en la URL haría que la dirección de una tarea cambie
al renombrarla. Además un nombre puede contener espacios, tildes o barras que
complican su uso como parámetro de ruta. El nombre es único, pero el `id` es
el que identifica.

### 3. Nombres únicos

Antes de crear o modificar una tarea se verifica que no exista otra con el mismo
nombre. La comparación se hace sobre el nombre **normalizado**: sin espacios al
principio ni al final (`trim`) y en minúsculas.

```js
const normalizar = (nombre) => nombre.trim().toLowerCase()
```

Sin normalizar, `"Estudiar"`, `"estudiar"` y `"Estudiar "` serían tres tareas
distintas, aunque para una persona son la misma. La regla "no puede haber tareas
con el mismo nombre" quedaría fácil de burlar.

El nombre se guarda recortado (`trim`) pero respetando las mayúsculas con las
que se escribió: la normalización se usa para comparar, no para modificar lo que
el cliente envió.

Al modificar con `PUT`, la tarea que se está editando se excluye de la
comparación. De lo contrario, reenviar una tarea con su mismo nombre (por
ejemplo, para cambiar solo el estado) chocaría consigo misma y sería rechazada.

Un nombre repetido responde **`409 Conflict`** y no `400`: el pedido está bien
formado, pero entra en conflicto con el estado actual de la colección. El mismo
body podría ser válido más adelante si la otra tarea se elimina.

### 4. Endpoints

| Método   | Ruta                           | Descripción                      | Éxito |
| -------- | ------------------------------ | -------------------------------- | ----- |
| `POST`   | `/tareas`                      | Crea una tarea                   | `201` |
| `GET`    | `/tareas`                      | Lista todas las tareas           | `200` |
| `GET`    | `/tareas?completada=true`      | Lista solo las completadas       | `200` |
| `GET`    | `/tareas?completada=false`     | Lista solo las pendientes        | `200` |
| `GET`    | `/tareas/:id`                  | Obtiene una tarea por id         | `200` |
| `PUT`    | `/tareas/:id`                  | Reemplaza nombre y estado        | `200` |
| `PATCH`  | `/tareas/:id`                  | Cambia solo el estado            | `200` |
| `DELETE` | `/tareas/:id`                  | Elimina una tarea                | `200` |

Todas las respuestas, tanto de éxito como de error, se devuelven en formato
JSON. Los errores tienen la forma `{ "error": "<mensaje>" }`.

### 5. El filtro de estado es un query param, no una ruta

Diferenciar completadas de pendientes se resuelve con
`GET /tareas?completada=true|false`. La ruta indica **qué recurso** se consulta
y el query string **qué subconjunto** se quiere. Las tareas completadas siguen
siendo tareas, así que el recurso no cambia.

El nombre del parámetro coincide con el del campo del modelo (`completada`), de
modo que el cliente filtra usando el mismo vocabulario con el que recibe los
datos.

### 6. `PUT` para reemplazar y `PATCH` para cambiar el estado

La operación más frecuente sobre una tarea es marcarla como completada (o
volverla a pendiente). Con solo `PUT`, el cliente estaría obligado a reenviar
también el nombre, que no quiere cambiar.

- **`PUT /tareas/:id`** tiene semántica de reemplazo total: exige `nombre` y
  `completada`.
- **`PATCH /tareas/:id`** modifica parcialmente: recibe solo `completada`.

Se eligió que el `PATCH` acepte únicamente el estado porque es el caso de uso
concreto que plantea el enunciado ("su estado de avance"). Renombrar una tarea
se hace con `PUT`, que es donde se aplica la validación de nombre único.

### 7. Al crear, `completada` es opcional y vale `false`

Una tarea nueva normalmente está pendiente, así que no se obliga al cliente a
enviar `"completada": false` en cada alta. Si se envía, debe ser un booleano.

En el `PUT` en cambio es obligatorio, justamente porque `PUT` reemplaza el
recurso completo y no debe completar campos por su cuenta.

### 8. Validaciones

**Body (`nombre`)** — función `validarNombre`:

| Regla                   | Verificación              | Respuesta                             |
| ----------------------- | ------------------------- | ------------------------------------- |
| Presente                | `=== undefined`           | `400 Falta el nombre`                 |
| Es texto                | `typeof !== 'string'`     | `400 El nombre debe ser un texto`     |
| No vacío                | `trim() === ''`           | `400 El nombre no puede estar vacío`  |
| No repetido             | `nombreRepetido`          | `409 Ya existe una tarea con ese nombre` |

Un nombre formado solo por espacios se considera vacío: después del `trim` no
queda ninguna descripción.

**Body (`completada`)** — función `validarCompletada`:

Se exige un booleano real con `typeof completada === 'boolean'`. No se aceptan
`"true"`, `1` ni `"si"`: JSON tiene tipo booleano nativo, y la API es estricta
con el tipo en lugar de adivinar la intención del cliente. En particular,
convertir con `Boolean()` sería un error, porque `Boolean("false")` es `true`.

**Params (`:id`)** — función `validarId`:

Se exige un entero positivo, convirtiendo con `Number()` y verificando con
`Number.isInteger`. Se descarta `parseInt` porque `parseInt("1abc")` devuelve
`1` y una URL malformada terminaría devolviendo una tarea existente;
`Number("1abc")` devuelve `NaN` y permite rechazarla.

**Query (`completada`)**:

Solo se aceptan `"true"` y `"false"`; cualquier otro valor responde `400`. Los
query params llegan siempre como string, por eso se compara contra el texto:
`"false"` es un string no vacío, y un chequeo como `if (req.query.completada)`
lo trataría como verdadero.

### 9. Orden de las validaciones

En `POST`, `PUT` y `PATCH` se valida primero la **forma** del pedido (id y body)
y después el **estado** (si la tarea existe, si el nombre está repetido). Si el
pedido está mal construido, el resultado no depende de lo que haya guardado, y
se responde `400` aunque el id tampoco exista.

### 10. Códigos de estado

| Código | Cuándo se usa                                              |
| ------ | ---------------------------------------------------------- |
| `200`  | Consulta, modificación o eliminación exitosa               |
| `201`  | Creación exitosa                                           |
| `400`  | Entrada inválida en body, params o query                   |
| `404`  | La tarea solicitada no existe                              |
| `409`  | Ya existe otra tarea con el mismo nombre                   |

### 11. Decisiones con alternativas válidas

**`DELETE` responde `200` con un mensaje de confirmación** en lugar de
`204 No Content`, para que la respuesta sea visible al probar desde el archivo
`.http`. Se mantiene el mismo criterio que en el Ejercicio 1.

**Al eliminar una tarea su nombre queda libre** y puede volver a usarse. La
unicidad aplica sobre las tareas existentes, no sobre el historial.

**Los ids no se reutilizan.** Se asignan con un contador incremental, así que
después de eliminar la tarea 2 la siguiente será la 4 y no la 2. Reutilizar ids
haría que una URL guardada por un cliente apunte de pronto a otra tarea.

**Los datos se almacenan en memoria**, en un arreglo interno, como pide el
enunciado. La información se pierde al reiniciar el servidor.

## Cómo ejecutar

```bash
npm install
npm run dev
```

El servidor queda disponible en `http://localhost:3000`. Las peticiones de
prueba, incluyendo los casos de error, están en `tareas.http`.
