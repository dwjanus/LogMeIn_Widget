import express from 'express'
import path from 'path'
import bodyParser from 'body-parser'
require('body-parser-xml')(bodyParser)
import util from 'util'
import cors from 'cors'

const app = express()
const port = process.env.port ||  process.env.PORT || 8000

if (!port) {
  console.log('Error: Port not found')
  process.exit(1)
}

app.set('port', port)

app.use(express.static(path.join(__dirname, '/../public')))
app.use(bodyParser.urlencoded({ extended: true }))
app.use(bodyParser.json({ type: 'application/json' }))
app.use(bodyParser.xml())
app.options('*', cors())

app.get('/', (req, res) => {
  res.sendFile('index.html')
})

app.post('/data', (req, res) => {
  console.log(`[POST] at /data\,==> request: ${util.inspect(req.body)}`)
  res.redirect('/') // { data: req.body }  ?
})

app.get('/data', (req, res) => {
  console.log(`[GET] at /data`)
})

const server = app.listen(app.get('port'), () => {
  console.log(`> App listening on port: ${server.address().port}`)
  console.log('  Press Ctrl+C to quit')
})



