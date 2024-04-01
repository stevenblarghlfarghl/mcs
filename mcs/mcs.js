
const axios = require('axios')
require('dotenv').config()
const { Sequelize, DataTypes } = require('sequelize')



//import environment variables
const dbconnection = process.env.DBCONNECTION
const satgetall = process.env.SATGETALL
const satstaticimages = process.env.SATSTATICIMAGES
const satsendimages = process.env.SATSENDIMAGES

const sleeptime = process.env.SLEEPTIME
const skip = process.env.SKIP


//Helper sleep function
function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms))
}

//Sequelize connection
const sequelize = new Sequelize(dbconnection, {
  dialect: 'postgres'
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
async function syncWithRetry(maxRetries = 5, interval = 7000) {
    let attempt = 0;
    while (attempt < maxRetries) {
        try {
            await sequelize.authenticate();
            console.log('Connection has been established successfully.')
            await sequelize.sync({ force: false, alter: true })
            console.log('Database synchronized successfully.')
            break
        } catch (error) {
            attempt++;
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

//only start the main loop when the database connection comes through.
syncWithRetry().then(() => {
    console.log('Application started successfully.');
    mainLoop()
}).catch((error) => {
    console.error('Failed to start the application:', error);
});


async function fetchAll() {
    try {
      // Use axios to fetch manifest from satellite
      const response = await axios.get(satgetall)
      
      // response.data contains the data returned from the server
      console.log(response.data)

      //For each item in the manifest, fetch the corresponding image from the static url and put it in the database
      const array = response.data 
      array.forEach((item) => {
        const url = satstaticimages+item.filename 
        axios.get(url, { responseType: 'arraybuffer' })
        .then(response => {
          //Creating database entry for the current image.
          Image.create({
            requestId: item.requestId,
            data: response.data, 
            targetId: item.targetId,
            requestTimestamp: item.updatedAt,
            filename: item.filename
          }).then(() => {
            console.log(`Stored image for ${item.filename}`)
          }).catch(err => {
            console.error(`Error storing image for ${item.filename}:`, err)
          });
        })
        .catch(error => {
          console.error(`Error fetching ${item.filename}:`, error)
        });
      });
  
      //Return the data as well just in case it's needed elsewhere.
      return response.data;
    } catch (error) {
      console.error('Error fetching data:', error)
    }
  }

  //activates the download all when count == 1
  let count = 0

  //main loop
  async function mainLoop() {
    while (true) {
      //Keeping this print to make sure something is happening
        console.log("doing something...")

        //find the requests that we have not seen yet.
        const unseenRequests = await pendingRequests.findAll({
            where: { seen: "false" }
        });
        //update the requests' seen field to true instead of deleting them
        for (const request of unseenRequests) {
            await request.update({ seen: 'true' })
        }
        //send requests here.
        const send_satimage = satsendimages
        for (const request of unseenRequests) {
            try{
              const response = await axios.post(send_satimage, request.toJSON())
              console.log(response.data)
            }
            catch(error){
              console.error('Error sending satellite image request:', error.message)
            }
            
        }
        //Sleep for set amount of time to simulate orbital period.
        await sleep(sleeptime)
        //Implementation for skipping orbital periods before downloading all images.
        if(count >= skip){
          //helper function to fetch all the images
          fetchAll()
          console.log("fetching all")
          count = 0
        }
        count+=1

    }
}





