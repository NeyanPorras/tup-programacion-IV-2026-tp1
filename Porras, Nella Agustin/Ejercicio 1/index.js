import express from 'express'

const app = express()
const port = 3000

app.use(express.json())

const rectangulos = []
let id = 1

const describir = (rectangulo) => ({
  ...rectangulo,
  perimetro: 2 * (rectangulo.base + rectangulo.altura),
  superficie: rectangulo.base * rectangulo.altura,
  esCuadrado: rectangulo.base === rectangulo.altura
})

const validarBaseAltura = (base, altura) => {
  if (base === undefined || altura === undefined) {
    return 'Faltan datos'
  }

  if (!Number.isFinite(base) || !Number.isFinite(altura)) {
    return 'Los valores deben ser numéricos'
  }

  if (base <= 0 || altura <= 0) {
    return 'Los valores deben ser mayores a 0'
  }

  return null
}

const validarId = (id) => {
  const idValido = Number(id)

  if (!Number.isInteger(idValido) || idValido <= 0) {
    return 'El id debe ser un número entero positivo'
  }
  return null
}

app.get('/rectangulos', (req, res) => {
  const { cuadrado } = req.query
  if (
    typeof cuadrado !== 'undefined' &&
    cuadrado !== 'true' &&
    cuadrado !== 'false'
  ) {
    res.status(400).json({ error: 'El cuadrado debe ser true o false' })
    return
  }

  if (cuadrado === 'true') {
    res.json(rectangulos.map(describir).filter((r) => r.esCuadrado))
    return
  } else if (cuadrado === 'false') {
    res.json(rectangulos.map(describir).filter((r) => !r.esCuadrado))
    return
  } else {
    res.json(rectangulos.map(describir))
  }
})

app.get('/rectangulos/:id', (req, res) => {
  const { id } = req.params

  const idError = validarId(id)
  if (idError) {
    res.status(400).json({ error: idError })
    return
  }
  const rectangulo = rectangulos.find((r) => r.id === parseInt(id))

  if (!rectangulo) {
    res.status(404).json({ error: 'Rectangulo no encontrado' })
    return
  }

  res.status(200).json(describir(rectangulo))
})

app.post('/rectangulos', (req, res) => {
  const { base, altura } = req.body ?? {}

  const error = validarBaseAltura(base, altura)

  if (error) {
    res.status(400).json({ error })
    return
  }

  const rectangulo = { id: id++, base, altura }

  rectangulos.push(rectangulo)

  res.status(201).json(describir(rectangulo))
})

app.put('/rectangulos/:id', (req, res) => {
  const { id } = req.params
  const { base, altura } = req.body

  const idError = validarId(id)
  if (idError) {
    res.status(400).json({ error: idError })
    return
  }

  const error = validarBaseAltura(base, altura)

  if (error) {
    res.status(400).json({ error })
    return
  }

  const rectangulo = rectangulos.find((r) => r.id === parseInt(id))

  if (!rectangulo) {
    res.status(404).json({ error: 'Rectangulo no encontrado' })
    return
  }

  rectangulo.base = base
  rectangulo.altura = altura

  res.status(200).json(describir(rectangulo))
})

app.delete('/rectangulos/:id', (req, res) => {
  const { id } = req.params
  const idError = validarId(id)
  if (idError) {
    res.status(400).json({ error: idError })
    return
  }
  const index = rectangulos.findIndex((r) => r.id === parseInt(id))

  if (index === -1) {
    res.status(404).json({ error: 'Rectangulo no encontrado' })
    return
  }

  rectangulos.splice(index, 1)
  res.status(200).json({ message: 'Rectangulo eliminado' })
})

app.listen(port, () => {
  console.log(`Example app listening on port http://localhost:${port}`)
})
