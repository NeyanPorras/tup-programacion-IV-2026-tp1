import express from 'express'

const app = express()
const port = 3000

app.use(express.json())

const alumnos = []
let idAlumno = 1
const describir = (alumno) => {
  const promedio = alumno.notas.reduce((a, b) => a + b, 0) / alumno.notas.length
  return {
    ...alumno,
    promedio: Number(promedio.toFixed(2)),
    condicion:
      promedio < 6 ? 'Reprobado' : promedio < 8 ? 'Aprobado' : 'Promocionado'
  }
}
const validarId = (id) => {
  const idValido = Number(id)

  if (!Number.isInteger(idValido) || idValido <= 0) {
    return 'El id debe ser un número entero positivo'
  }
  return null
}
const validarAlumno = (nombre, notas) => {
  if (nombre === undefined || notas === undefined) {
    return 'Faltan datos'
  }

  if (typeof nombre !== 'string' || nombre.trim() === '') {
    return 'El nombre debe ser una cadena no vacia'
  }

  if (!Array.isArray(notas)) {
    return 'Las notas deben ser un arreglo de números'
  }

  if (notas.length !== 3) {
    return 'Las notas deben ser un arreglo de 3 números'
  }

  if (notas.some((nota) => !Number.isFinite(nota))) {
    return 'Las notas deben ser un arreglo de números'
  }

  if (notas.some((nota) => nota < 0 || nota > 10)) {
    return 'Las notas deben estar entre 0 y 10'
  }

  return null
}

app.post('/alumnos', (req, res) => {
  const { nombre, notas } = req.body ?? {}
  const error = validarAlumno(nombre, notas)

  if (error) {
    res.status(400).json({ error })
    return
  }

  const nombreLimpio = nombre.trim()
  const nombreDuplicado = alumnos.find(
    (alumno) => alumno.nombre.toLowerCase() === nombreLimpio.toLowerCase()
  )

  if (nombreDuplicado) {
    res.status(409).json({ error: 'El alumno ya existe' })
    return
  }
  const alumno = {
    id: idAlumno++,
    nombre: nombreLimpio,
    notas
  }

  alumnos.push(alumno)

  res.status(201).json(describir(alumno))
})

app.get('/alumnos', (req, res) => {
  res.json(alumnos.map((alumno) => describir(alumno)))
})

app.get('/alumnos/:id', (req, res) => {
  const { id } = req.params
  const idError = validarId(id)
  if (idError) {
    res.status(400).json({ error: idError })
    return
  }
  const alumno = alumnos.find((alumno) => alumno.id === Number(id))

  if (!alumno) {
    res.status(404).json({ error: 'Alumno no encontrado' })
    return
  }

  res.status(200).json(describir(alumno))
})

app.put('/alumnos/:id', (req, res) => {
  const { nombre, notas } = req.body ?? {}
  const { id } = req.params

  const idError = validarId(id)
  if (idError) {
    res.status(400).json({ error: idError })
    return
  }
  const error = validarAlumno(nombre, notas)

  if (error) {
    res.status(400).json({ error })
    return
  }

  const alumno = alumnos.find((alumno) => alumno.id === Number(id))

  if (!alumno) {
    res.status(404).json({ error: 'Alumno no encontrado' })
    return
  }
  const nombreLimpio = nombre.trim()
  const duplicado = alumnos.find(
    (a) =>
      a.id !== alumno.id &&
      a.nombre.toLowerCase() === nombreLimpio.toLowerCase()
  )

  if (duplicado) {
    res.status(409).json({ error: 'El alumno ya existe' })
    return
  }

  alumno.nombre = nombreLimpio
  alumno.notas = notas

  res.status(200).json(describir(alumno))
})

app.delete('/alumnos/:id', (req, res) => {
  const { id } = req.params
  const idError = validarId(id)
  if (idError) {
    res.status(400).json({ error: idError })
    return
  }
  const alumno = alumnos.find((alumno) => alumno.id === Number(id))

  if (!alumno) {
    res.status(404).json({ error: 'Alumno no encontrado' })
    return
  }

  alumnos.splice(alumnos.indexOf(alumno), 1)
  res.status(200).json({ message: 'Alumno eliminado' })
})

app.listen(port, () =>
  console.log(`Servidor escuchando en http://localhost:${port}`)
)
