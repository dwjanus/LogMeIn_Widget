import express from 'express'
import path from 'path'
import bodyParser from 'body-parser'
require('body-parser-xml')(bodyParser)
import util from 'util'
import cors from 'cors'
import monk from 'monk'
import https from 'https'
import querystring from 'querystring'
import url from 'url'

const app = express()
const port = process.env.port ||  process.env.PORT || 8000
const db = monk(process.env.MONGODB_URI)
const teamviewer_db = db.get('teamviewer') // used for storage of teamviewer oauth data
const logmein_db = db.get('logmein')


if (!port) {
  console.log('Error: Port not found')
  process.exit(1)
}

app.set('port', port)
app.set('view engine', 'html')
app.set('layout', 'layout')
app.engine('html', require('hogan-express'))
app.set('views', path.join(__dirname, './../views'))

app.use(express.static(path.join(__dirname, '../public')))
app.use(bodyParser.urlencoded({ extended: true }))
app.use(bodyParser.json({ type: 'application/json' }))
app.use(bodyParser.xml({xmlParseOptions: {
  explicitArray: false
}}))
app.use(cors())
app.options('*', cors())


//                     //
// -----> INDEX <----- //
//                     //
app.get('/', (req, res) => {
  res.render('layout', {
    partials: {
      // logmein: 'logmein_new.html',
      // bomgar: 'bomgar.html',
      // harvest: 'harvest.html',
      teamviewer: 'teamviewer.html'
    }
  })
})


//                           //
// -----> ExternalAPI <----- //
//                           //

// incoming req.body => { request: { options, payload } }
app.post('/callExternalApi', (req, res) => {
  console.log(`\n[POST] /callExternalApi ---> request:\n${util.inspect(req.body)}\n`)
  let url_parsed = url.parse(req.body.url) 
  let options = {
    host: url_parsed.host,
    path: url_parsed.path,
    method: req.body.method
  }

  const request = https.request(options, (response) => {
    let result = ''
  
    response.on('data', (chunk) => {
      result += chunk
    })
  
    response.on('end', () => {
      console.log(`externalAPI >>> end\n${util.inspect(result)}\n`)
      res.send(result)
    })
  
    response.on('error', (e) => {
      console.log('[error in post response]' + e)
      res.send(e)
    })
  })
  
  if (req.body.payload !== null) request.write(req.body.payload)

  request.on('error', (e) => {
    console.log('[Error in new session POST request]\n>> ' + e)
    res.status(500)
  })

  request.end()
})


//                          //
// -----> TeamViewer <----- //
//                          //
app.get('/tv/data/:id', (req, res) => {
  console.log('\n[GET] /tv/data ---> user: ' + req.params.id)

  let id = req.params.id
  let response_json = {
    tv_id: process.env.TEAMVIEWER_ID
  }

  teamviewer_db.findOne({user: id}).then((found) => {
    if (found) {
      console.log('[GET] /tv/data ---> teamveiwer tokens found:\n' + util.inspect(found))
      response_json['tokens'] = found.teamviewer
    }
    res.send(response_json)
  })
})

app.get('/tv/authorized', (req, res, next) => {
  const options = {
    root: path.join(__dirname, '../public/html/')
  }

  res.sendFile('oauthcallback.html', options, (err) => {
    if (err) next(err)
    else (console.log('...sending oauthcallback page'))
  })
})

app.get('/tv/oauth', (req, res) => {
  console.log('[GET] /tv/oauth')
  console.log(`>>> code: ${req.query.code}`)
  console.log(`>>> state: ${req.query.state}`)

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
      console.log(`>>> teamviewer auth success!\n${util.inspect(result)}`)
      result = JSON.parse(result)

      let query = querystring.stringify({
        access_token: result.access_token,
        token_type: result.token_type,
        expires_in: result.expires_in,
        refresh_token: result.refresh_token,
        user_id: req.query.state
      })

      let teamviewer = result

      teamviewer_db.findOne({user: req.query.state}).then((found) => {
        if (!found) {
          teamviewer_db.insert({user: req.query.state, teamviewer})
        } else {
          console.log('> user already has teamviewer authentication')
        }

        res.redirect('/tv/authorized?' + query)
      })
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


app.post('/tv/sessions/new/:id', (req, res) => {
  console.log('\n[POST] recieved at /tv/sessions/new/' + req.params.id)

  let id = req.params.id
  let postData = JSON.stringify(req.body)

  console.log(`\nrequest body: ${util.inspect(req.body)}`)

  teamviewer_db.findOne({user: id}).then((found) => {
    if (found) {
      console.log('> teamviewer user found in db')
      
      let options = {
        host: 'webapi.teamviewer.com',
        path: '/api/v1/sessions',
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${found.teamviewer.access_token}`
        }
      }

      const request = https.request(options, (response) => {
        let result = ''
    
        response.on('data', (chunk) => {
          result += chunk
        })
    
        response.on('end', () => {
          console.log(`>>> end\n${util.inspect(result)}`)
          result = JSON.parse(result)
          let teamviewer = result
          res.send(teamviewer)
        })
    
        response.on('error', (e) => {
          console.log('[error in post response]' + e)
        })
      })
    
      request.on('error', (e) => {
        console.log('[Error in new session POST request]\n>> ' + e)
        res.endStatus(500)
      })

      request.write(postData)
      request.end()
    } else {
      res.sendStatus(500)
    }
  })
})


app.get('/tv/:id/oauth/', (req, res) => {
  console.log(`[GET] /tv/oauth >>> id: ${req.params.id}`)

  let id = req.params.id

  teamviewer_db.findOne({user: id}).then((found) => {
    if (found) {
      console.log(`>> user found: \n${util.inspect(found)}`)
      let postData = querystring.stringify({
        grant_type: 'refresh_token',
        refresh_token: found.teamviewer.refresh_token,
        client_id: process.env.TEAMVIEWER_ID,
        client_secret: process.env.TEAMVIEWER_SECRET
      })

      let options = {
        host: 'webapi.teamviewer.com',
        path: '/api/v1/oauth2/token',
        method: 'POST',
        headers: { 
          'Content-Type': 'application/x-www-form-urlencoded'
        }
      }

      const request = https.request(options, (response) => {
        let result = ''
    
        response.on('data', (chunk) => {
          result += chunk
        })
    
        response.on('end', () => {
          result = JSON.parse(result)
          
          if (result.error) {
            console.log(`teamviewer >>> error: ${result.error_code}\n${result.error} -- ${result.error_description}`)
            res.end()
          } else {
            let query = querystring.stringify({
              access_token: result.access_token,
              token_type: result.token_type,
              expires_in: result.expires_in,
              refresh_token: result.refresh_token,
              user_id: req.query.state
            })
      
            let teamviewer = result
      
            teamviewer_db.insert({user: req.query.state, teamviewer}) // this would be the Samanage account id
            res.send(teamviewer)
          }
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
    } else {
      console.log('ERROR: User not found')
    }
  })
})



//                       //
// -----> LogMeIn <----- //
//                       //
app.post('/logmein/:id/save', (req, res) => {
  const id = req.params.id
  const logmein = req.body

  console.log(`\n[POST] /logmein/${id}/save\n--> logmein: ${util.inspect(logmein)}`)
  logmein_db.findOne({user: id}).then((found) => {
    if (!found) {
      console.log(`   logmein_db >> user not found, inserting now...`)
      logmein_db.insert({user: id, logmein})
    } else {
      console.log('   logmein_db >> user already has logmein authentication')
    }
    res.send(logmein)
  })
})


app.post('/logmein/data', (req, res) => {
  console.log(`[POST] at /data ==> request: ${util.inspect(req.body)}`)

  // parse data and post to samanage ticket


  res.sendStatus(200)
})




const server = app.listen(app.get('port'), () => {
  console.log(`> App listening on port: ${server.address().port}`)
  console.log('  Press Ctrl+C to quit')
})



