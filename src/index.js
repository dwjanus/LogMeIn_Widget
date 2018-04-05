import express from 'express'
import path from 'path'
import bodyParser from 'body-parser'
require('body-parser-xml')(bodyParser)
import util from 'util'
import cors from 'cors'
import monk from 'monk'
import https from 'https'
import querystring from 'querystring'

const app = express()
const port = process.env.port ||  process.env.PORT || 8000
const db = monk(process.env.MONGODB_URI)
const teamviewer_db = db.get('teamviewer') // used for storage of teamviewer oauth data


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
  let tv_auth = 'teamviewer_auth.html'
  teamviewer_db.findOne({account: '42909'}).then((tv_tokens) => {
    if (tv_tokens) {
      console.log('> tv tokens found in storage')
      tv_auth = 'teamviewer.html'
    }

    res.render('layout', {
      partials: { 
        logmein: 'logmein.html',
        bomgar: 'bomgar.html',
        harvest: 'harvest.html',
        teamviewer: tv_auth 
      }
    })
  })
})

app.get('/tv/data', (req, res) => {
  let response_json = {
    tv_id: process.env.TEAMVIEWER_ID
  }

  teamviewer_db.findOne({account: '42090'}).then((tv_tokens) => {
    if (tv_tokens) response_json['tokens'] = tv_tokens
  })

  res.send(response_json)
})

app.get('/tv/authorized', (req, res) => {
  res.sendFile('oauthcallback.html')
})

app.get('/tv/oauth/', (req, res) => {
  console.log('[GET] /tv/oauth/')
  console.log(`>>> code: ${req.query.code}`)

  let code = req.query.code
  let postData = querystring.stringify({
    grant_type: 'authorization_code',
    code: code,
    redirect_uri: 'https://samanage-widgets.herokuapp.com/tv/oauth',
    client_id: process.env.TEAMVIEWER_ID,
    client_secret: process.env.TEAMVIEWER_SECRET
  })
    
  let options = {
    host: 'webapi.teamviewer.com',
    path: '/api/v1/oauth2/token',
    method: 'POST',
    headers: { 
      'Content-Type': 'application/x-www-form-urlencoded',
      'Content-Length': postData.length
    }
  }

  const request = https.request(options, (response) => {
    let result = ''

    response.on('data', (chunk) => {
      result += chunk
    })

    response.on('end', () => {
      console.log(`>>> success!\n${util.inspect(result)}`)
      teamviewer_db.insert({account: "42909", result}) // this would be the Samanage account id
      let query = querystring.stringify({
        access_token: result.access_token,
        token_type: result.token_type,
        expires_in: result.expires_in,
        refresh_token: result.refresh_token
      })

      res.redirect('/tv/authorized?' + query)
    })

    response.on('error', (e) => {
      console.log('[error in post response]' + e)
    })
  })

  request.on('error', (e) => {
    console.log('[error in post request] >> ' + e)
  })

  request.write(postData)
  request.end()
})


// this is going to be the endopint that needs a backend function to handle the data to comment
app.post('/data', (req, res) => {
  console.log(`[POST] at /data ==> request: ${util.inspect(req.body)}`)
  res.send(200)
})



const server = app.listen(app.get('port'), () => {
  console.log(`> App listening on port: ${server.address().port}`)
  console.log('  Press Ctrl+C to quit')
})



