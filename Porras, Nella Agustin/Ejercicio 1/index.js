import express from 'express'

const app = express()
const port = 3000

app.use(express.json())

const rectangulos = []

app.get('/rectangulos', (req, res) => {
  res.send(rectangulos)
})

app.post('/rectangulos', (req, res) => {
  const { base, altura } = req.body
  rectangulos.push({ base, altura })
  console.log(base, altura)
  res.send(rectangulos)
})

app.listen(port, () => {
  console.log(`Example app listening on port http://localhost:${port}`)
})
