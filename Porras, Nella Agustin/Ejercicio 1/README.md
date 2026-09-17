# Ejercicio 1 — API de rectángulos

Desarrollar una API con ExpressJS para resolver consultas sobre perímetros y
superficies de rectángulos, distinguiendo los casos que también constituyen
cuadrados.

## Decisiones de diseño

### 1. Un único recurso: `/rectangulos`

No existe un recurso `/cuadrados`. Un cuadrado es un rectángulo con lados
iguales: un caso particular, no una entidad aparte.

Separarlos en dos recursos duplicaría la lógica de cálculo y validación, y
rompería la consulta de "todos los rectángulos", porque los cuadrados quedarían
guardados en otra colección y no aparecerían en el listado general.

### 2. El modelo almacena únicamente `{ id, base, altura }`

Un rectángulo queda completamente determinado por su base y su altura. El
perímetro, la superficie y la condición de cuadrado se derivan de esos dos
valores, por lo que **no se almacenan**: se calculan en el momento de responder.

El motivo es evitar datos inconsistentes. Si `esCuadrado` se guardara junto al
rectángulo, un `PUT` que modificara la altura dejaría ese campo desactualizado,
y la API informaría que un rectángulo de 5×9 es un cuadrado. Cada endpoint que
tocara el recurso tendría que acordarse de recalcular los tres campos, y el
primer olvido introduciría datos corruptos de forma silenciosa.

Almacenando solo la información mínima, el estado guardado no puede
contradecirse con lo que la API informa.

### 3. Una función `describir` centraliza el cálculo derivado

Todos los endpoints que devuelven rectángulos construyen su respuesta con la
misma función:

```js
const describir = (rectangulo) => ({
  ...rectangulo,
  perimetro: 2 * (rectangulo.base + rectangulo.altura),
  superficie: rectangulo.base * rectangulo.altura,
  esCuadrado: rectangulo.base === rectangulo.altura
})
```

Las fórmulas viven en un solo lugar. Si mañana cambia la forma de calcular o se
agrega un dato derivado, se modifica una función y todos los endpoints quedan
actualizados.

`describir` no recibe `req` ni `res`: la geometría es lógica de dominio y no
depende del protocolo HTTP. Los handlers se ocupan de leer el pedido, validar,
elegir el código de estado y responder; el cálculo es independiente y podría
reutilizarse fuera de una API.

### 4. Endpoints

| Método   | Ruta                        | Descripción                          | Éxito |
| -------- | --------------------------- | ------------------------------------ | ----- |
| `POST`   | `/rectangulos`              | Crea un rectángulo                   | `201` |
| `GET`    | `/rectangulos`              | Lista todos los rectángulos          | `200` |
| `GET`    | `/rectangulos?cuadrado=true`  | Lista solo los cuadrados           | `200` |
| `GET`    | `/rectangulos?cuadrado=false` | Lista solo los no cuadrados        | `200` |
| `GET`    | `/rectangulos/:id`          | Obtiene un rectángulo por id         | `200` |
| `PUT`    | `/rectangulos/:id`          | Reemplaza base y altura              | `200` |
| `DELETE` | `/rectangulos/:id`          | Elimina un rectángulo                | `200` |

Todas las respuestas, tanto de éxito como de error, se devuelven en formato
JSON. Los errores tienen la forma `{ "error": "<mensaje>" }`, de modo que el
cliente pueda parsear siempre igual sin depender del resultado.

### 5. El filtro de cuadrados es un query param, no una ruta

La distinción entre cuadrados y no cuadrados se expone como
`GET /rectangulos?cuadrado=true`, y no como una ruta `/rectangulos/cuadrados`.

La ruta identifica **qué recurso** se consulta; el query string expresa **qué
subconjunto** de ese recurso se quiere. Ambos casos devuelven rectángulos, así
que el recurso es el mismo y solo cambia el criterio de selección.

Además, el listado se deriva antes de filtrar (`map(describir).filter(...)`),
porque `esCuadrado` no existe en los objetos almacenados: aparece recién cuando
`describir` lo calcula. Filtrar antes de derivar devolvería siempre una lista
vacía.

### 6. Validaciones

Se validan las tres fuentes de entrada que puede enviar el cliente.

**Body (`base` y `altura`)** — función `validarBaseAltura`:

| Regla                     | Verificación                       | Respuesta                               |
| ------------------------- | ---------------------------------- | --------------------------------------- |
| Ambos valores presentes   | `=== undefined`                    | `400 Faltan datos`                      |
| Numéricos y finitos       | `Number.isFinite`                  | `400 Los valores deben ser numéricos`   |
| Mayores a cero            | `<= 0`                             | `400 Los valores deben ser mayores a 0` |

Se usa `Number.isFinite` en lugar de `typeof x === 'number'` porque este último
acepta `NaN` e `Infinity`, que son técnicamente de tipo `number` pero no
representan medidas válidas. Un body como `{ "base": 1e999 }` se parsea como
`Infinity` y produciría una superficie infinita.

No se convierten los valores recibidos: JSON tiene tipo numérico nativo, así
que un `"10"` entre comillas es un string y se rechaza. La API es estricta con
el tipo en lugar de adivinar la intención del cliente.

**Params (`:id`)** — función `validarId`:

Se exige un entero positivo, convirtiendo con `Number()` y verificando con
`Number.isInteger`. Se descarta `parseInt` porque no es estricto: lee dígitos
desde el comienzo y abandona al encontrar caracteres inválidos, de modo que
`parseInt("1abc")` devuelve `1` y una URL malformada terminaría entregando un
recurso existente. `Number("1abc")` devuelve `NaN` y permite rechazarla.

**Query (`cuadrado`)**:

Solo se aceptan los valores `"true"` y `"false"`; cualquier otro valor responde
`400`. Los query params llegan siempre como string, por lo que la comparación se
hace contra el texto y no evaluando el valor como booleano: `"false"` es un
string no vacío y por lo tanto *truthy*, así que un chequeo del estilo
`if (req.query.cuadrado)` filtraría incorrectamente.

### 7. Códigos de estado

| Código | Cuándo se usa                                              |
| ------ | ---------------------------------------------------------- |
| `200`  | Consulta, modificación o eliminación exitosa               |
| `201`  | Creación exitosa                                           |
| `400`  | Entrada inválida en body, params o query                   |
| `404`  | El rectángulo solicitado no existe                         |

La distinción entre `400` y `404` es deliberada: `400` indica que el pedido está
mal formado y volver a enviarlo igual fallará siempre; `404` indica que el
pedido es válido pero el recurso no existe en este momento.

### 8. Decisiones con alternativas válidas

Las siguientes decisiones admiten más de una solución razonable. Se documenta la
elegida y su fundamento.

**`DELETE` responde `200` con un mensaje de confirmación.** La alternativa
convencional es `204 No Content`, sin cuerpo. Se optó por `200` para que la
respuesta sea explícita y verificable desde el archivo `.http`, donde un cuerpo
vacío resulta ambiguo al revisar los resultados.

**El `PUT` valida el body antes de buscar el rectángulo.** Por lo tanto, un body
inválido dirigido a un id inexistente responde `400` y no `404`. El criterio es
validar la forma del pedido antes de consultar el estado: si el pedido está mal
construido, el resultado no depende de que el recurso exista.

**El `PUT` exige `base` y `altura` completas.** `PUT` tiene semántica de
reemplazo total del recurso, por lo que no se aceptan actualizaciones parciales.
Modificar un solo campo correspondería a `PATCH`, que no se implementó por no
ser requerido por el enunciado.

**Los datos se almacenan en memoria**, en un arreglo interno, con un contador
incremental para asignar los ids. La información se pierde al reiniciar el
servidor. Es suficiente para el alcance del trabajo práctico, que no requiere
persistencia; incorporar una base de datos agregaría complejidad sin aportar a
lo que el ejercicio evalúa.

## Cómo ejecutar

```bash
npm install
npm run dev
```

El servidor queda disponible en `http://localhost:3000`. Las peticiones de
prueba, incluyendo los casos de error, están en `rectangulos.http`.
