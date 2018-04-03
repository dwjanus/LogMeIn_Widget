import express from 'express'
import path from 'path'
import bodyParser from 'body-parser'
require('body-parser-xml')(bodyParser)
import util from 'util'
import cors from 'cors'
import monk from 'monk'

const app = express()
const port = process.env.port ||  process.env.PORT || 8000
const db = monk(process.env.MONGODB_URI)
const teamviewer = db.get('teamviewer') // used for storage of teamviewer oauth data


if (!port) {
  console.log('Error: Port not found')
  process.exit(1)
}

app.set('port', port)
app.set('view engine', 'html')
app.set('layout', 'layout')
app.engine('html', require('hogan-express'))
app.set('views', path.join(__dirname, './../views'))

app.use(express.static(path.join(__dirname, './../public')))
app.use(bodyParser.urlencoded({ extended: true }))
app.use(bodyParser.json({ type: 'application/json' }))
app.use(bodyParser.xml({xmlParseOptions: {
  explicitArray: false
}}))
app.use(cors())
app.options('*', cors())


app.get('/', (req, res) => {
  res.locals = {
    harvest_token: process.env.HARVEST_TOKEN,
    harvest_account: process.env.HARVEST_ACCOUNT
  }
  res.render('layout', {
    partials: { 
      logmein: 'logmein.html',
      bomgar: 'bomgar.html',
      harvest: 'harvest.html',
      teamviewer: 'teamviewer.html'
   }
  })
})

app.get('/tv/data', (req, res) => {
  res.send({ tv_id: process.env.TEAMVIEWER_ID })
})

// this is going to be the endopint that needs a backend function to handle the data to comment
app.post('/data', (req, res) => {
  console.log(`[POST] at /data ==> request: ${util.inspect(req.body)}`)
  res.send(200)
})

app.post('/tv/oauth/', (req, res) => {
  console.log('>>> saving oauth token')
  console.log(`>>> data: \n${util.inspect(req.body)}`)
  // teamviewer.insert()
})


const server = app.listen(app.get('port'), () => {
  console.log(`> App listening on port: ${server.address().port}`)
  console.log('  Press Ctrl+C to quit')
})



