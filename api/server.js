const express = require('express')
const { Sequelize, DataTypes, where } = require('sequelize')
const { Op } = require('sequelize')
const archiver = require('archiver')
const path = require('path')
const fs = require('fs')
require('dotenv').config()

//import environment variables
const app = express()
const port = process.env.PORT || 3000
const connection = process.env.DBCONNECTION


// Use JSON middleware to parse request bodies
app.use(express.json())

// Initialize Sequelize
const sequelize = new Sequelize(connection, {
  dialect: 'postgres'
})



//Model for a satellite DROID will be asked to track
//Main identifier for a client satellite will be a string that has to be unique
const clientSat = sequelize.define('ClientSat', {
id: {
    type: DataTypes.STRING,
    allowNull: false,
    primaryKey: true
},
client: {
    type: DataTypes.STRING,
    allowNull: false,
}
}, {
})

//Model for pending requests
//requestId is an autoincremented id that serves as the primary key for pending requests as well as a way for the user
//to keep track of image requests.
const pendingRequests = sequelize.define('PendingRequests', {
// Setting requestId as an auto-incrementing primary key
requestId: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
    allowNull: false
},

//sleep interval: FUNCIONALITY NOT IMPLEMENTED
interval: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 0,
},

//scheduled time to take a photo in the future: FUNCTIONALITY NOT IMPLEMENTED
scheduledTime: {
    type: DataTypes.INTEGER,
},

//how many times to take a photo: FUNCTIONALITY NOT IMPLEMENTED
cycles: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 0, // Default cycles to 0
},

//targetId of the target satellite
targetId: {
    type: DataTypes.STRING,
    allowNull: false,
},

//instead of deleting requests, we want to keep tack of all the requests 
seen: {
    type: DataTypes.STRING,
    allowNull: false,
    defaultValue: false
}
}, {
})


//Model for images
//Image data contains a column for targetId, requestId, requestTimestamp, and filename to help fetch the image.
const Image = sequelize.define('Image', {
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
    },
    requestId: DataTypes.INTEGER,
    targetId: DataTypes.STRING,
    requestTimestamp: DataTypes.DATE,
    filename: DataTypes.STRING,
    seen: {
        type:DataTypes.BOOLEAN,
        defaultValue: false,
        allowNull: false
    },
    data: DataTypes.BLOB // Field for storing image data
})


//Retry connection with the database.
//This is needed because docker composer starts everything all at once. I have to make sure the 
//db connection comes through before starting the application
async function syncWithRetry(maxRetries = 5, interval = 3000) {
    let attempt = 0 
    while (attempt < maxRetries) {
        try {
            await sequelize.authenticate()
            console.log('Connection has been established successfully.')
            await sequelize.sync({ force: false, alter: true })
            console.log('Database synchronized successfully.')
            break
        } catch (error) {
            attempt++ 
            console.log(`Attempt ${attempt} failed: ${error.message}`)
            if (attempt < maxRetries) {
                console.log(`Retrying in ${interval / 1000} seconds...`)
                await new Promise(resolve => setTimeout(resolve, interval))
            } else {
                console.log('Maximum retries reached. Exiting...')
                throw error
            }
        }
    }
}

//function that only starts serving the express server when the db has been connected
syncWithRetry().then(() => {
    console.log('Application started successfully.')
    app.listen(port, () => {
        console.log(`Example app listening at http://localhost:${port}`)
      })
}).catch((error) => {
    console.error('Failed to start the application:', error)
}) 

//End point for adding new client satellites.
app.post('/addsat', async (req, res) => {
try {
    console.log(req.body)
    const { id, client } = req.body
    
    // Ensure the required fields are provided
    if (!id || !client) {
    return res.status(400).send('Missing name or client in request body.')
    }
    
    // Create a new ClientSat entry
    const newClientSat = await clientSat.create({
    id: id,
    client: client
    }) 

    // Respond with the created entry
    res.status(201).json({"message":"ClientSat successfully inserted.", "data":newClientSat}) 
} catch (error) {
    if (error.name === 'SequelizeUniqueConstraintError') {
        // This block catches the unique constraint error specifically
        console.error('A unique constraint error occurred:', error)
        res.status(409).send('A satellite with the provided ID already exists.') 
    } else{
        console.error('Error creating new ClientSat entry:', error)
        res.status(500).send('Error creating new ClientSat entry')
    }
   
}
})

//Helper function for handling formatting, zipping, amd cleaning up images.
async function zipup(images, res){

    try{
        // Ensure temporary directory exists
        const tempDir = path.join(__dirname, 'temp')
        if (!fs.existsSync(tempDir)) {
            fs.mkdirSync(tempDir) 
        }
        //Write images to temporary JPG files
        images.forEach((img, index) => {
            fs.writeFileSync(path.join(tempDir, img.filename), img.data)
        }) 

        const zipPath = path.join(__dirname, 'images.zip')
        const output = fs.createWriteStream(zipPath)
        const archive = archiver('zip', { zlib: { level: 9 } })

        //Zip up the image files.
        archive.pipe(output)
        images.forEach(img => {
            archive.append(fs.createReadStream(path.join(tempDir, img.filename)), { name: img.filename })
        }) 
        archive.finalize() 

        //Close fs
        output.on('close', () => {
            // Cleanup: Remove temporary JPG files
            images.forEach(img => {
                fs.unlinkSync(path.join(tempDir, img.filename))
            }) 
            fs.rmdirSync(tempDir)  // Remove temporary directory

            // Send the ZIP file
            res.download(zipPath, 'images.zip', (err) => {
                if (err) {
                    console.error('Error sending ZIP file:', err)
                    return
                }

                // Delete ZIP file after sending
                fs.unlinkSync(zipPath) 
            }) 
        }) 
    }catch (error) {
        console.error('Error processing request:', error)
        res.status(500).send('An error occurred')
    }
}


//Endpoint for fetching available images
app.post('/fetchimage', async (req, res) => {
    console.log("FETCH IMAGE HIT")
    const requestData = req.body
    // Destructure the JSON object
    const {
        requestTimestampStart,
        requestTimestampEnd,
        targetId,
        requestIdStart,
        requestIdEnd
    } = requestData
    
    // Assign variables based on the presence of the fields
    let timestampStart = requestTimestampStart || null
    let timestampEnd = requestTimestampEnd || null
    let target = targetId || null
    let idStart = (requestIdStart !== undefined) ? requestIdStart : null
    let idEnd = (requestIdEnd !== undefined) ? requestIdEnd : null


    const whereClause = {} 

    // Handling timestamp range
    if (requestTimestampStart || requestTimestampEnd) {
        whereClause.requestTimestamp = {}
        if (requestTimestampStart) whereClause.requestTimestamp[Op.gte] = new Date(requestTimestampStart)
        if (requestTimestampEnd) whereClause.requestTimestamp[Op.lte] = new Date(requestTimestampEnd)
    }

    // Handling ID range
    if (requestIdStart || requestIdEnd) {
        whereClause.id = {}
        if (requestIdStart) whereClause.id[Op.gte] = parseInt(requestIdStart, 10)
        if (requestIdEnd) whereClause.id[Op.lte] = parseInt(requestIdEnd, 10)
    }

    // Handling singular targetId
    if (targetId) {
        whereClause.targetId = targetId
    }

    //console.log(whereClause)
    try {
        const images = await Image.findAll({ where: whereClause })

        if (images.length) {
            await zipup(images, res)
        } else {
            res.status(404).send('No matching images found')
        }
    } catch (error) {
        console.error('Error querying images:', error)
        res.status(500).send('An error occurred while fetching images')
    }
})
    




app.post('/addrequests', async (req, res) => {
    const { targetId, interval, scheduledTime, cycles } = req.body
    
    // Check for the presence of `targetId` 
    if (!targetId) {
        return res.status(400).send('`targetId` is required.')
    }

    // Check to see if client sat has been added in the clientSat db:
    const result = await clientSat.findOne({
    where: {
        id: targetId 
    }
    })
    if (!result) {
    return res.status(500).send('ClientSat does not exist')
    } 

    try {
        // Create a new entry
        const newRequest = await pendingRequests.create({
            targetId,
            interval, // This and below fields are optional. Sequelize handles `undefined` gracefully for optional fields
            scheduledTime,
            cycles
        })

        return res.status(201).json(newRequest)
    } catch (error) {
        console.error('Error inserting new entry:', error)
        return res.status(500).send('An error occurred while inserting the new entry.')
    }
}) 



