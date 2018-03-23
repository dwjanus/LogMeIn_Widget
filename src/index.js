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
app.set('view engine', 'html')
app.set('layout', 'layout')
app.enable('view cache')
app.engine('html', require('hogan-express'))
app.set('views', path.join(__dirname, './views'))

app.use(express.static(path.join(__dirname, './../public')))
app.use(bodyParser.urlencoded({ extended: true }))
app.use(bodyParser.json({ type: 'application/json' }))
app.use(bodyParser.xml({xmlParseOptions: {
  explicitArray: false
}}))
app.options('*', cors())


app.get('/', (req, res) => {
  res.render('index.html')
})

app.post('/data', (req, res) => {
  console.log(`[POST] at /data\,==> request: ${util.inspect(req.body)}`)
  res.locals = {
    data: req.body
  }

  res.render('index.html')
})


// const homeCtrl = (req, res) => {
//   let data = req.data
//   res.render('index.html', data)
// }

// const handlePost = (req, res, next) => {
//   req.data = req.body
//   return next()
// }

// app.get('/', homeCtrl)
// app.post('/data', handlePost, homeCtrl)




const server = app.listen(app.get('port'), () => {
  console.log(`> App listening on port: ${server.address().port}`)
  console.log('  Press Ctrl+C to quit')
})



