const express = require('express')
const app = express()
const bodyParser = require('body-parser')
const si = require('shortid')
const cors = require('cors')
const mongoose = require('mongoose')

require('dotenv').config()

mongoose.connect(process.env.MLAB_URI,{ useNewUrlParser: true,useUnifiedTopology: true})
const connection = mongoose.connection

connection.on('error', console.error.bind(console, 'connection error:'));

connection.once('open', () => {
 console.log("MongoDB database connection established successfully");
})
app.use(cors())

app.use(bodyParser.urlencoded({extended: false}))
app.use(bodyParser.json())

const exerciseSchema =  new mongoose.Schema({
  date: String,
  duration:{type:Number,require:true},
  description: {type: String, required: true}
})

const userSchema = new mongoose.Schema({
  username: {type:String, required:true},
  log : [exerciseSchema]
});

var Users  = mongoose.model('Users', userSchema)
var Exercises = mongoose.model('Exercises', exerciseSchema)


app.use(express.static('public'))
app.get('/', (req, res) => {
  res.sendFile(__dirname + '/views/index.html')
});

app.get('/api/exercise/users', (req, res)=>{
  Users.find({}, (err,data)=>{
    if(!err){
      res.json(data)
    }
  })
})

app.post('/api/exercise/new-user', (req, res)=>{
  let flag = 0
  Users.find({}, (err, data)=>{
      data.forEach((user)=>{
        if(user.username === req.body.username){
          flag = 1;
        }
      })
    if(flag === 1){
      res.send("Username already taken")
    }
    else{
      var newUser = new Users({username: req.body.username})
      newUser.save((err,data)=>{
      if(!err){
        res.json({_id: data._id,username:data.username})
      }
      })
    }
  })
})

app.post('/api/exercise/add', (req, res) =>{
  let newSession = new Exercises({
    description: req.body.description,
    duration: parseInt(req.body.duration),
    date: req.body.date
  })
  
  if(newSession.date === ''){
    newSession.date = new Date().toISOString().substring(0, 10)
  }
  
  Users.findByIdAndUpdate(
    req.body.userId,
    {$push : {log: newSession}},
    {new: true},
    (error, updatedUser)=> {
      if(!error){
        let responseObject = {}
        responseObject['_id'] = updatedUser.id
        responseObject['username'] = updatedUser.username
        responseObject['date'] = new Date(newSession.date).toDateString()
        responseObject['description'] = newSession.description
        responseObject['duration'] = newSession.duration
        res.json(responseObject)
      }
    }
  )
})

app.get('/api/exercise/log', (req,res)=>{
  Users.findById(req.query.userId, (error, result) => {
    if(!error){
      let responseObject = result
      
      if(req.query.from || req.query.to){
        
        let fromDate = new Date(0)
        let toDate = new Date()
        
        if(req.query.from){
          fromDate = new Date(req.query.from)
        }
        
        if(req.query.to){
          toDate = new Date(req.query.to)
        }
        
        fromDate = fromDate.getTime()
        toDate = toDate.getTime()
        
        responseObject.log = responseObject.log.filter((session) => {
          let sessionDate = new Date(session.date).getTime()
          
          return sessionDate >= fromDate && sessionDate <= toDate
          
        })
        
      }
      
      if(req.query.limit){
        responseObject.log = responseObject.log.slice(0, req.query.limit)
      }
      
      responseObject = responseObject.toJSON()
      responseObject['count'] = result.log.length
      res.json(responseObject)
    }
  })
})


// Not found middleware
app.use((req, res, next) => {
  return next({status: 404, message: 'not found'})
})

// Error Handling middleware
app.use((err, req, res, next) => {
  let errCode, errMessage

  if (err.errors) {
    // mongoose validation error
    errCode = 400 // bad request
    const keys = Object.keys(err.errors)
    // report the first validation error
    errMessage = err.errors[keys[0]].message
  } else {
    // generic or custom error
    errCode = err.status || 500
    errMessage = err.message || 'Internal Server Error'
  }
  res.status(errCode).type('txt')
    .send(errMessage)
})




const listener = app.listen(process.env.PORT || 3000, () => {
  console.log('Your app is listening on port ' + listener.address().port)
})
