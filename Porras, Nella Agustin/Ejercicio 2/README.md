# Ejercicio 2 — API de alumnos y calificaciones

Desarrollar una API con ExpressJS para administrar la información académica de
los alumnos de una materia y sus calificaciones. Cada alumno cuenta con un
nombre y tres notas. No pueden existir alumnos con el mismo nombre al crear o
modificar los registros. Al consultar las notas de un alumno, la API informa su
promedio y su condición académica.

## Decisiones de diseño

### 1. Un único recurso: `/alumnos`

Las notas no se modelan como un recurso independiente. Un alumno siempre tiene
exactamente tres notas, así que no existe una nota sin alumno ni un alumno sin
notas: forman una sola entidad y se administran juntas.

Por la misma razón el promedio y la condición se devuelven dentro del alumno, y
no en un sub-recurso `/alumnos/:id/notas`. El enunciado pide que al consultar
las notas se informe el promedio y la condición, y eso se cumple en el `GET` del
alumno sin multiplicar rutas para un dato que ya viaja completo.

### 2. El modelo almacena únicamente `{ id, nombre, notas }`

El arreglo interno guarda solo esos tres campos. El **promedio** y la
**condición académica** son datos derivados y se calculan en el momento de
responder, tal como indica el enunciado.

El motivo es el mismo que evita cualquier dato duplicado: si el promedio
estuviera almacenado, un `PUT` que cambiara las notas dejaría ese valor
desactualizado, y la API informaría un promedio que no corresponde a las notas
que ella misma devuelve. Al guardar solo la información mínima, el estado
almacenado no puede contradecir lo que se informa.

### 3. Una función `describir` centraliza el cálculo derivado

```js
const describir = (alumno) => {
  const promedio = alumno.notas.reduce((a, b) => a + b, 0) / alumno.notas.length
  return {
    ...alumno,
    promedio: Number(promedio.toFixed(2)),
    condicion:
      promedio < 6 ? 'Reprobado' : promedio < 8 ? 'Aprobado' : 'Promocionado'
  }
}
```

Todos los endpoints que devuelven alumnos construyen su respuesta con esta
función, de modo que la fórmula y los umbrales existen en un solo lugar. No
recibe `req` ni `res`: el cálculo académico es lógica de dominio y no depende
del protocolo HTTP.

El promedio se presenta redondeado a dos decimales, pero **la condición se
decide con el valor sin redondear**. Un promedio de 7,999 se muestra como `8`
por el redondeo, y sin embargo corresponde a *aprobado*, no a *promocionado*.
Decidir sobre el valor ya redondeado promovería a un alumno por un efecto de
presentación.

### 4. Endpoints

| Método   | Ruta            | Descripción                                    | Éxito |
| -------- | --------------- | ---------------------------------------------- | ----- |
| `POST`   | `/alumnos`      | Crea un alumno                                 | `201` |
| `GET`    | `/alumnos`      | Lista todos los alumnos con promedio y condición | `200` |
| `GET`    | `/alumnos/:id`  | Obtiene un alumno con su promedio y condición  | `200` |
| `PUT`    | `/alumnos/:id`  | Reemplaza nombre y notas                       | `200` |
| `DELETE` | `/alumnos/:id`  | Elimina un alumno                              | `200` |

Todas las respuestas, de éxito y de error, se devuelven en JSON. Los errores
tienen la forma `{ "error": "<mensaje>" }`.

### 5. Los umbrales de la condición académica cierran un hueco del enunciado

El enunciado define: reprobado para promedios menores a 6, aprobado para
promedios de 6 o 7, y promocionado para promedios de 8 o más.

Con tres notas el promedio rara vez es entero, por lo que esa definición deja
valores sin clasificar: un promedio de 7,5 no es menor a 6, no es "6 o 7" y no
es "8 o más". La implementación cierra el hueco con rangos continuos:

| Condición      | Rango                  |
| -------------- | ---------------------- |
| Reprobado      | `promedio < 6`         |
| Aprobado       | `6 <= promedio < 8`    |
| Promocionado   | `promedio >= 8`        |

Se interpreta que "6 o 7" describe el tramo que va desde el 6 hasta antes del 8,
y que el criterio del enunciado es el umbral de promoción en 8. Cualquier
promedio posible queda clasificado en exactamente una condición.

### 6. Unicidad del nombre

La regla se aplica al crear y al modificar, como pide el enunciado.

**La comparación se hace normalizada** —sin espacios al inicio o al final y sin
distinguir mayúsculas—, de modo que `"Juan"`, `"juan"` y `" JUAN "` se
consideran el mismo alumno. Si se comparara el texto tal cual llega, bastaría
cambiar una mayúscula para burlar la regla y la unicidad sería decorativa.

**Al modificar, el alumno se excluye de su propia verificación:**

```js
const duplicado = alumnos.find(
  (a) =>
    a.id !== alumno.id &&
    a.nombre.toLowerCase() === nombreLimpio.toLowerCase()
)
```

Un duplicado es **otro** alumno con el mismo nombre. Un alumno nunca es
duplicado de sí mismo: sin la condición `a.id !== alumno.id` sería imposible
corregirle una nota conservando su nombre, porque chocaría contra su propio
registro.

### 7. La normalización ocurre al escribir, no al leer

El nombre se recorta con `trim()` una sola vez, antes de guardarlo, y se
almacena ya limpio. No se recorta en cada comparación.

De este modo todo el código que lee el arreglo puede confiar en que el dato está
normalizado. Si en cambio se limpiara en cada lectura, habría que recordarlo en
cada comparación nueva, y el primer olvido reintroduciría el problema.

Se conserva la capitalización que escribió el usuario, porque es información
legítima del nombre; solo se ignora al comparar.

### 8. Validaciones

**Nombre:**

| Regla               | Verificación                          | Respuesta |
| ------------------- | ------------------------------------- | --------- |
| Presente            | `=== undefined`                       | `400`     |
| Cadena no vacía     | `typeof` y `trim() === ''`            | `400`     |
| No repetido         | comparación normalizada               | `409`     |

**Notas:**

| Regla                    | Verificación                         | Respuesta |
| ------------------------ | ------------------------------------ | --------- |
| Presente                 | `=== undefined`                      | `400`     |
| Es un arreglo            | `Array.isArray`                      | `400`     |
| Exactamente tres         | `length !== 3`                       | `400`     |
| Numéricas y finitas      | `some(!Number.isFinite)`             | `400`     |
| Dentro del rango 0 a 10  | `some(n => n < 0 \|\| n > 10)`       | `400`     |

Se usa `Array.isArray` y no `typeof`, porque `typeof []` devuelve `'object'` y
no distingue un arreglo de cualquier otro objeto.

Se usa `Number.isFinite` en lugar de `typeof n === 'number'`, porque este último
acepta `NaN` e `Infinity`, que son de tipo numérico pero no son calificaciones
válidas.

Las notas no se convierten: JSON tiene tipo numérico nativo, así que un `"7"`
entre comillas es un string y se rechaza. La API es estricta con el tipo en
lugar de adivinar la intención del cliente.

Cada regla se verifica sobre **todos** los elementos del arreglo con `some`: que
una nota sea válida no dice nada sobre las otras dos.

**Id (`:id`):**

Se exige un entero positivo, convirtiendo con `Number()` y verificando con
`Number.isInteger`. Se descarta `parseInt` porque no es estricto:
`parseInt("1abc")` devuelve `1`, de modo que una URL malformada terminaría
entregando un recurso existente.

### 9. Orden de las validaciones

En cada endpoint se valida primero la **forma del pedido** —presencia, tipos,
longitud, rangos— y solo después las **reglas de negocio** que dependen del
estado almacenado, como la unicidad del nombre o la existencia del alumno.

No tiene sentido consultar el estado del sistema mientras el pedido todavía no
es interpretable. Además, así el mensaje de error informa el problema más básico
primero: un pedido con nombre repetido y notas inválidas responde por las notas,
que es el error que el cliente debe corregir antes.

### 10. Códigos de estado

| Código | Cuándo se usa                                       |
| ------ | --------------------------------------------------- |
| `200`  | Consulta, modificación o eliminación exitosa        |
| `201`  | Creación exitosa                                    |
| `400`  | Entrada inválida en body o params                   |
| `404`  | El alumno solicitado no existe                      |
| `409`  | El nombre ya pertenece a otro alumno                |

La distinción entre `400` y `409` es deliberada. `400` indica que el pedido está
mal formado y volver a enviarlo igual fallará siempre. `409` indica que el
pedido es correcto pero **entra en conflicto con el estado actual**: crear un
alumno llamado "Juan" es un pedido perfectamente válido, y falla únicamente
porque ya existe otro con ese nombre. Si ese alumno se eliminara, el mismo
pedido tendría éxito.

### 11. Decisiones con alternativas válidas

**`DELETE` responde `200` con un mensaje de confirmación** en lugar de
`204 No Content`. Se eligió una respuesta explícita para que el resultado sea
verificable desde el archivo `.http`, donde un cuerpo vacío resulta ambiguo.

**El `PUT` valida el body antes de buscar al alumno**, por lo que un body
inválido dirigido a un id inexistente responde `400` y no `404`. El criterio es
validar la forma del pedido antes de consultar el estado.

**El `PUT` exige `nombre` y `notas` completas.** `PUT` tiene semántica de
reemplazo total del recurso, así que no se aceptan actualizaciones parciales.
Modificar un solo campo correspondería a `PATCH`, que no se implementó por no
ser requerido por el enunciado.

**Las notas se validan en el rango 0 a 10.** El enunciado no fija una escala;
se adopta la escala numérica habitual y se documenta, porque sin un rango
definido un promedio de 200 sería "promocionado".

**Los datos se almacenan en memoria**, en un arreglo interno, con un contador
incremental para asignar los ids. La información se pierde al reiniciar el
servidor, lo cual es suficiente para el alcance del trabajo práctico.

## Cómo ejecutar

```bash
npm install
npm run dev
```

El servidor queda disponible en `http://localhost:3000`. Las peticiones de
prueba, incluyendo los casos de error, están en `alumnos.http`.
