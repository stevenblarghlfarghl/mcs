const express = require('express')
const axios = require('axios')
const fs = require('fs')
const path = require('path')
require('dotenv').config()

const app = express()
const port = process.env.PORT || 3001



app.use(express.json())

// Directory to store images
const imageDir = path.join(__dirname, 'images')
if (!fs.existsSync(imageDir)){
    fs.mkdirSync(imageDir)
}

//This is how the satellite "takes" a photo. It goes randomly to one of these nasa urls and grabs an image.
const IMAGEURL = ["https://www.nasa.gov/wp-content/uploads/static/history/alsj/a11/a11det38937.jpg",
"https://www.nasa.gov/wp-content/uploads/static/history/alsj/a12/ap12-KSC-69PC-672.jpg",
"https://www.nasa.gov/wp-content/uploads/static/history/alsj/a12/ap12-S69-59475.jpg",
"https://www.nasa.gov/wp-content/uploads/static/history/alsj/a12/ap12-S69-58564.jpg",
"https://www.nasa.gov/wp-content/uploads/static/history/alsj/a12/ap12-S69-58884.jpg"]

//This is a manifest that keepds track of which locally saved images have been requested.
let imagestore = []
function getRandomInt(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min
}



// Generate a unique image name to save locally.
//images get saved locally to a /images folder and a fetchall request will ask for a "manifest" of images.
//images folder is hosted statically and the mcs will do individual fetches for each photo
app.post('/imagerequest', async (req, res) => {
try {
    const{requestId, targetId, updatedAt} = req.body
    // Generate a unique image name
    //image name contains requestId, targetId, timestamp of the reqeust.
    const imageName = 'image_'+ requestId+"_"+targetId+"_" +updatedAt + '.jpg'
    const imagePath = path.join(imageDir, imageName)
    console.log(req.body)

    //Takes a photo here
    const randomInt = getRandomInt(0, 4)
    const response = await axios.get(IMAGEURL[randomInt], { responseType: 'stream' })

    //Saving the image locally.
    const writer = fs.createWriteStream(imagePath)
    response.data.pipe(writer)
    await new Promise((resolve, reject) => {
        writer.on('finish', resolve)
        writer.on('error', reject)
    })

    imagestore.push({"requestId":req.body.requestId, "filename":imageName, "updatedAt":updatedAt, "targetId":targetId})
    // imagestore[{req.body.requestId] = {"path": imageName }
    console.log("RESPONSE",response.data)
    res.status(201).send('Taking photo')
} catch (error) {
    res.status(500).send('Error taking photo')
}
})

//static endpoint for all the images, this is where the actual fetching will happen.
app.use('/images', express.static(path.join(__dirname, 'images')))

//get the manifest for all the images
app.get('/getAll', async (req, res) => {
    try {
        res.json(imagestore)
        imagestore = []
    } catch (error) {
        console.error('Error:', error)
        res.status(500).send('Error retrieving data')
    }
})

app.listen(port, () => {
  console.log(`Example app listening at http://localhost:${port}`)
})

