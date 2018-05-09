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
import Promise from 'bluebird'
import _ from 'lodash'

const app = express()
const port = process.env.port ||  process.env.PORT || 8000
const db = monk(process.env.MONGODB_URI)
const teamviewer_db = db.get('teamviewer')
const logmein_db = db.get('logmein')
const harvest_db = db.get('harvest')
const users = db.get('users')
const dbs = [
  {
    name: 'teamviewer',
    collection: teamviewer_db
  },
  {
    name: 'logmein',
    collection: logmein_db
  },
  { 
    name: 'harvest',
    collection: harvest_db
  }
]


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
      ref_console: 'ref_console.html',
      logmein: 'logmein.html',
      // harvest_time: 'harvest_time.html',
      // teamviewer: 'teamviewer.html'
    }
  })
})


//                           //
// -----> ExternalAPI <----- //
//                           //
app.post('/callExternalApi', (req, res) => {
  let payload = JSON.parse(req.body.payload)
  console.log(`\n[POST] /callExternalApi ---> request:\n${util.inspect(req.body)}\n\n${util.inspect(payload)}`)
  let url_parsed = url.parse(req.body.url) 
  let options = {
    host: url_parsed.host,
    path: url_parsed.path,
    method: req.body.method
  }

  if (payload && payload.headers) {
    options['headers'] = payload.headers
    delete payload.headers
  }

  console.log(`callExternalApi options:\n${util.inspect(options)}`)

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
      res.send({error: e})
    })
  })
  
  if ((options.method == 'POST' || options.method == 'PUT') && payload.data) request.write(JSON.stringify(payload.data))
  else console.log('>> no payload to post')

  request.on('error', (e) => {
    console.log('[Error in new session POST request]\n>> ' + e)
    res.send({error: e})
  })

  request.end()
})


//                             //
// -----> Get User data <----- //
//                             //
app.get('/storage/:id', (req, res) => {
  // let storage = {}
  
  // Promise.map(dbs, (db) => {
  //   console.log('/storage/id >>> Promise.map >>> ' + db.name)
  //   let key = db.name

  //   return db.collection.findOne({user: req.params.id}).then((found) => {
  //     if (found) {
  //       console.log('/storage/id >>> found')
  //       storage[key] = found[key]
  //     }
  //   })
  // }).then(() => {
  //   console.log(`/storage/id >>> returning storage:\n${util.inspect(storage)}`)
  //   return res.send(JSON.stringify(storage))
  // })

  console.log('>>> GET at local storage')
  users.findOne({ id: req.params.id }).then((found) => {
    if (found) {
      console.log(`localstorage retrieved user: ${found.id}`)
      return res.send(JSON.stringify(found))
    } else {
      console.log('>>> user not found')
    }
  }).catch(e => res.send(e))
})


app.post('/storage/:id', (req, res) => {
  console.log(`/storage/id [POST] req.body:\n${util.inspect(req.body)}`)
  let storage = req.body[Object.keys(req.body)[0]]

  users.findOne({ id: req.params.id }).then((found) => {
    if (found) {
      console.log('>> user found!')
      let updated = _.assignIn(found, storage)
      users.update({ id: found.id }, updated).then((user) => {
        console.log(`>> user updated:\n${util.inspect(user)}`)
        return res.send(JSON.stringify(updated))
      })
    } else {
      console.log('>> user does not exist yet!')
      let user = { id: req.params.id, storage }
      users.insert(user).then((user) => {
        console.log(`>> user created:\n${util.inspect(user)}`)
        return res.send(JSON.stringify(user))
      })
    }
  })
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
  console.log('[GET] /tv/authorized -->\n' + util.inspect(req.query))
  const postData = JSON.stringify({
    "name": "Samanage"
  })

  const tv_options = {
    host: 'webapi.teamviewer.com',
    path: '/api/v1/groups',
    method: 'POST',
    headers: { 
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${req.query.access_token}`,
      'Content-Length': postData.length
    }
  }

  const request = https.request(tv_options, (response) => {
    let result = ''

    response.on('data', (chunk) => {
      result += chunk
    })

    response.on('end', () => {
      console.log(`>>> end\n${util.inspect(result)}`)
      
      const options = {
        root: path.join(__dirname, '../public/html/')
      }
    
      res.sendFile('oauthcallback.html', options, (err) => {
        if (err) next(err)
        else (console.log('...sending oauthcallback page'))
      })
    })

    response.on('error', (e) => {
      console.log('[error in post response]' + e)
    })
  })

  request.on('error', (e) => {
    console.log('[Error in new session POST request]\n>> ' + e)
    res.sendStatus(500)
  })

  request.write(postData)
  request.end()
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
        res.send({error: e})
      })

      request.write(postData)
      request.end()
    } else {
      res.sendStatus(500)
    }
  })
})


app.get('/tv/:id/oauth/', (req, res) => {
  console.log(`[GET] /tv/:id/oauth >>> id: ${req.params.id}`)

  const id = req.params.id

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
          result = JSON.parse(result)
          
          if (result.error) {
            console.log(`teamviewer >>> error: ${result.error_code}\n${result.error} -- ${result.error_description}`)
            res.send(result)
          } else {
            let teamviewer = result
      
            teamviewer_db.update({ user: id }, { user: id, teamviewer: teamviewer })
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
      logmein_db.insert({ user: id, logmein })
    } else {
      console.log('   logmein_db >> user already has logmein authentication')
    }
    res.send(logmein)
  })
})


app.post('/logmein/data', (req, res) => {
  console.log(`[POST] at /data ==> request: ${util.inspect(req.body)}`)

  // parse data and post to samanage ticket
  const data = req.body
  const comment_body = `
    ~ LogMeIn Post-Session Data ~
      Session: ${data.sessionid}
      Technician: ${data.techname} - ${data.techid}
      Platform: ${data.platform}
      WorkTime: ${data.worktime}
      Notes: ${data.notes}\n
      ChatLog:\n${data.chatlog}
  `

  const comment_json = {
    comment: {
      body: comment_body,
      is_private: true
    }
  }

  console.log(`logmein (end of session) >>> about to post comment:\n${comment_body}`)

  // callSamanageApi((response) => {
  //   console.log(util.inspect(response)) 
  // }, 'POST', `https://api.samanage.com/incidents/${data.tracking0}/comments.json`, comment_json)
  
  res.sendStatus(200)
})


//                       //
// -----> Harvest <----- //
//                       //
app.get('/harvest/oauth', (req, res) => {
  console.log('[GET] /harvest/oauth')
  console.log(`>>> code: ${req.query.code}`)
  console.log(`>>> state: ${req.query.state}`)

  let code = req.query.code
  let postData = {
    grant_type: 'authorization_code',
    code: code,
    client_id: process.env.HARVEST_ID,
    client_secret: process.env.HARVEST_SECRET
  }

  let options = {
    host: 'id.getharvest.com',
    path: '/api/v2/oauth2/token',
    method: 'POST',
    headers: { 
      'Content-Type': 'application/json',
      'User-Agent': "Samanage + Harvest Time Tracking (devin.janus@samanage.com)"
    }
  }

  const request = https.request(options, (response) => {
    let result = ''

    response.on('data', (chunk) => {
      result += chunk
    })

    response.on('end', () => {
      console.log(`>>> harvest auth success!\n${util.inspect(result)}`)
      result = JSON.parse(result)

      let query = querystring.stringify({
        access_token: result.access_token,
        token_type: result.token_type,
        expires_in: result.expires_in,
        refresh_token: result.refresh_token,
        user_id: req.query.state
      })

      let harvest = result

      harvest_db.findOne({user: req.query.state}).then((found) => {
        if (!found) {
          harvest_db.insert({user: req.query.state, harvest})
        } else {
          console.log('> user already has harvest authentication')
        }

        res.redirect('/harvest/authorized?' + query)
      })
    })

    response.on('error', (e) => {
      console.log('[error in post response]' + e)
    })
  })

  request.on('error', (e) => {
    console.log('[error in post request] >> ' + e)
  })

  request.write(JSON.stringify(postData))
  request.end()
})


app.get('/harvest/authorized', (req, res, next) => {
  console.log('[GET] /harvest/authorized -->\n' + util.inspect(req.query))
      
  const options = {
    root: path.join(__dirname, '../public/html/')
  }

  res.sendFile('oauthcallback.html', options, (err) => {
    if (err) next(err)
    else (console.log('...sending oauthcallback page'))
  })
})


app.get('/harvest/data/:id', (req, res) => {
  console.log('\n[GET] /harvest/data ---> user: ' + req.params.id)

  let id = req.params.id
  let response_json = {
    harvest_id: process.env.HARVEST_ID
  }

  harvest_db.findOne({user: id}).then((found) => {
    if (found) {
      console.log('[GET] /harvest/data ---> harvest tokens found:\n' + util.inspect(found))
      response_json['tokens'] = found.harvest
    }
    res.send(response_json)
  })
})


// Search bar feature
app.post('/samanage/incident', (req, res) => {
  console.log(`\n[POST] /samanage/incident ---> request body:\n${util.inspect(req.body)}\n`)
  const number = parseInt(req.body.payload)
  let url_parsed = url.parse(req.body.url) 
  let options = {
    host: url_parsed.host,
    path: url_parsed.path,
    headers: {
      'Accept': 'application/vnd.samanage.v2.1+json', 
      'Content-Type': 'application/json',
      'X-Samanage-Authorization': `Bearer ${process.env.SAMANAGE_TOKEN}`
    },
    method: 'GET'
  }

  const request = https.request(options, (response) => {
    let result = ''
  
    response.on('data', (chunk) => {
      result += chunk
    })
  
    response.on('end', () => {
      const incidents = JSON.parse(result)
      console.log(`/samanage/incident >>> end\n${incidents.length} results returned`)
      const index = _.findIndex(incidents, (i) => { return i.number == number })
      res.send(JSON.stringify(incidents[index]))
    })
  
    response.on('error', (e) => {
      console.log('[error in post response]' + e)
      res.error(e)
    })
  })

  request.on('error', (e) => {
    console.log('[Error in new session POST request]\n>> ' + e)
    res.error(e)
  })

  request.end()
})




const server = app.listen(app.get('port'), () => {
  console.log(`> App listening on port: ${server.address().port}`)
  console.log('  Press Ctrl+C to quit')
})



