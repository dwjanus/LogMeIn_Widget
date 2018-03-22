import express from 'express'
import path from 'path'
import bodyParser from 'body-parser'
import util from 'util'

const app = express()

app.use(express.static(path.join(__dirname, '/../public')))
app.use(bodyParser.urlencoded({ extended: true }))
app.use(bodyParser.json({ type: 'application/json' }))


app.listen(8080, () => {
  console.log('> App listening on port: 8080')
})



