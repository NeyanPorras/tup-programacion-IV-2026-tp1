import express from 'express'

const app = express()
const port = 3000

app.use(express.json())

const tareas = []
let id = 1

const normalizar = (nombre) => nombre.trim().toLowerCase()

const nombreRepetido = (nombre, idExcluido) =>
  tareas.some(
    (t) => t.id !== idExcluido && normalizar(t.nombre) === normalizar(nombre)
  )

const validarNombre = (nombre) => {
  if (nombre === undefined) {
    return 'Falta el nombre'
  }

  if (typeof nombre !== 'string') {
    return 'El nombre debe ser un texto'
  }

  if (nombre.trim() === '') {
    return 'El nombre no puede estar vacío'
  }

  return null
}

const validarCompletada = (completada) => {
  if (typeof completada !== 'boolean') {
    return 'El estado completada debe ser true o false'
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

app.get('/tareas', (req, res) => {
  const { completada } = req.query
  if (
    typeof completada !== 'undefined' &&
    completada !== 'true' &&
    completada !== 'false'
  ) {
    res.status(400).json({ error: 'El filtro completada debe ser true o false' })
    return
  }

  if (completada === 'true') {
    res.json(tareas.filter((t) => t.completada))
  } else if (completada === 'false') {
    res.json(tareas.filter((t) => !t.completada))
  } else {
    res.json(tareas)
  }
})

app.get('/tareas/:id', (req, res) => {
  const { id } = req.params

  const idError = validarId(id)
  if (idError) {
    res.status(400).json({ error: idError })
    return
  }

  const tarea = tareas.find((t) => t.id === Number(id))

  if (!tarea) {
    res.status(404).json({ error: 'Tarea no encontrada' })
    return
  }

  res.status(200).json(tarea)
})

app.post('/tareas', (req, res) => {
  const { nombre, completada = false } = req.body ?? {}

  const error = validarNombre(nombre) ?? validarCompletada(completada)
  if (error) {
    res.status(400).json({ error })
    return
  }

  if (nombreRepetido(nombre)) {
    res.status(409).json({ error: 'Ya existe una tarea con ese nombre' })
    return
  }

  const tarea = { id: id++, nombre: nombre.trim(), completada }

  tareas.push(tarea)

  res.status(201).json(tarea)
})

app.put('/tareas/:id', (req, res) => {
  const { id } = req.params
  const { nombre, completada } = req.body ?? {}

  const idError = validarId(id)
  if (idError) {
    res.status(400).json({ error: idError })
    return
  }

  const error = validarNombre(nombre) ?? validarCompletada(completada)
  if (error) {
    res.status(400).json({ error })
    return
  }

  const tarea = tareas.find((t) => t.id === Number(id))

  if (!tarea) {
    res.status(404).json({ error: 'Tarea no encontrada' })
    return
  }

  if (nombreRepetido(nombre, tarea.id)) {
    res.status(409).json({ error: 'Ya existe una tarea con ese nombre' })
    return
  }

  tarea.nombre = nombre.trim()
  tarea.completada = completada

  res.status(200).json(tarea)
})

app.patch('/tareas/:id', (req, res) => {
  const { id } = req.params
  const { completada } = req.body ?? {}

  const idError = validarId(id)
  if (idError) {
    res.status(400).json({ error: idError })
    return
  }

  const error = validarCompletada(completada)
  if (error) {
    res.status(400).json({ error })
    return
  }

  const tarea = tareas.find((t) => t.id === Number(id))

  if (!tarea) {
    res.status(404).json({ error: 'Tarea no encontrada' })
    return
  }

  tarea.completada = completada

  res.status(200).json(tarea)
})

app.delete('/tareas/:id', (req, res) => {
  const { id } = req.params

  const idError = validarId(id)
  if (idError) {
    res.status(400).json({ error: idError })
    return
  }

  const index = tareas.findIndex((t) => t.id === Number(id))

  if (index === -1) {
    res.status(404).json({ error: 'Tarea no encontrada' })
    return
  }

  tareas.splice(index, 1)
  res.status(200).json({ message: 'Tarea eliminada' })
})

app.listen(port, () => {
  console.log(`Example app listening on port http://localhost:${port}`)
})
