import express from 'express'
import path from 'path'
import mongoose from 'mongoose'
import bodyParser from 'body-parser'
import dotenv from 'dotenv'
import Promise from 'bluebird'
import books from './routes/books'

dotenv.config()

const app = express()
app.use(bodyParser.json())

mongoose.Promise = Promise;
mongoose.connect(process.env.MONGODB_URL, {useMongoClient:true});

//Routes
app.use('/api/books', books)

app.get('/*', (req,res)=>{
  res.sendFile(path.join(__dirname, 'index.html'))
})

app.listen(8080,() => console.log("Running on localhost:8080"))