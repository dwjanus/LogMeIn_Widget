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
const users = db.get('users')
const system_db = db.get('system')


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
      harvest_time: 'harvest_time.html',
      teamviewer: 'teamviewer.html'
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
  console.log('>>> GET at local storage')
  users.findOne({ id: req.params.id }).then((found) => {
    if (found) {
      console.log(`localstorage retrieved user: ${found.id}`)
      return res.send(JSON.stringify(found))
    } else {
      console.log('>>> user not found')
      let user = { id: req.params.id }
      _.assignIn(user, req.body)
      users.insert(user).then((user) => {
        console.log(`>> user created:\n${util.inspect(user)}`)
        return res.send(JSON.stringify(user))
      })
    }
  }).catch(e => res.send(e))
})


app.post('/storage/:id', (req, res) => {
  console.log(`/storage/id [POST] req.body:\n${util.inspect(req.body)}`)
  const storage = req.body

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
      let user = { id: req.params.id }
      _.assignIn(user, req.body)
      users.insert(user).then((user) => {
        console.log(`>> user created:\n${util.inspect(user)}`)
        return res.send(JSON.stringify(user))
      })
    }
  })
})


app.get('/:widget/info', (req, res) => {
  console.log(`[GET] /${req.params.widget}/info`)

  system_db.findOne({ name: req.params.widget }).then((found) => {
    if (found) {
      console.log('>> widget data found!\n' + util.inspect(found))
      return res.send(JSON.stringify(found))
    } else {
      console.log('>> that widget does not exist yet!')
      return res.send(null) //JSON.stringify({error: none})
    }
  })
})



//                          //
// -----> TeamViewer <----- //
//                          //
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

      let teamviewer_data = {
        teamviewer: {
          tokens: result
        }
      }

      users.findOne({id: req.query.state}).then((found) => {
        if (found) {
          console.log('>> user found!')
          if (found.teamviewer) console.log('> user already has teamviewer authentication')
          else {
            console.log('>> adding teamviewer info to user')
            let updated = _.assignIn(found, teamviewer_data)
            users.update({ id: found.id }, updated).then((user) => {
              console.log(`>> user updated:\n${util.inspect(user)}`)
              return res.send(JSON.stringify(updated))
            })
          }
        } else {
          console.log('>> user does not exist yet!')
          let user = { id: req.query.state }
          _.assignIn(user, teamviewer_data)
          users.insert(user).then((user) => {
            console.log(`>> user created:\n${util.inspect(user)}`)
            return res.send(JSON.stringify(user))
          })
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


// this is to refresh oauth, will abstractify later
app.get('/tv/:id/oauth/', (req, res) => {
  console.log(`[GET] /tv/:id/oauth >>> id: ${req.params.id}`)

  const id = req.params.id

  users.findOne({user: id}).then((found) => {
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
            let teamviewer_data = {
              teamviewer: {
                tokens: result
              }
            }
      
            users.update({ user: id }, { user: id, teamviewer_data })
            res.send(teamviewer_data.teamviewer)
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

      let harvest_data = {
        harvest: {
          tokens: result
        }
      }

      users.findOne({ id: req.query.state }).then((found) => {
        if (found) {
          console.log('>> user found!')
          if (found.harvest) console.log('> user already has harvest authentication')
          else {
            console.log('>> adding harvest info to user')
            let updated = _.assignIn(found, harvest_data)
            users.update({ id: found.id }, updated).then((user) => {
              console.log(`>> user updated:\n${util.inspect(user)}`)
              return res.send(JSON.stringify(updated))
            })
          }
        } else {
          console.log('>> user does not exist yet!')
          let user = { id: req.query.state }
          _.assignIn(user, harvest_data)
          users.insert(user).then((user) => {
            console.log(`>> user created:\n${util.inspect(user)}`)
            return res.send(JSON.stringify(user))
          })
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



