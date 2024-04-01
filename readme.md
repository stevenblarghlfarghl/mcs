## API 
- By default, the client API will run on port 3000 of your host machine and the satellite will run on port 3001 of the host machine. You can change the port settings as well as the db connection settings in the respective .env files.

- The following endpoints assumes you are testing on localhost, the endpoint urls will use localhost as a placeholder for the host you are testing on. Replace as needed.
________
- To add a client satellite to the database:
    POST to http://localhost:3000/addsat with the following JSON as the body.
```
{
    "id":"SAT1",
    "client":"NASA"
}
```
- The id is the id of the object you wish to take an image of.
- The client is the client who the image is meant for.
- Upon success, the API will respond with a sucess message:
```
{
    "message": "ClientSat successfully inserted.",
    "data": {
        "id": "SAT2",
        "client": "NASA",
        "updatedAt": "2024-04-01T07:01:42.260Z",
        "createdAt": "2024-04-01T07:01:42.260Z"
    }
}
```
________
- To add a request for an image for an existing target:
    POST to http://localhost:3000/addrequests with the following JSON as the body.
```
{
    "targetId": "SAT1"
}
```
- The targetId is the target of you want to take am image of.
- Upon success, the API will respond with a success message:
```
{
    "interval": 0,
    "cycles": 0,
    "seen": "false",
    "requestId": 22,
    "targetId": "SAT1",
    "scheduledTime": null,
    "updatedAt": "2024-04-01T07:06:03.843Z",
    "createdAt": "2024-04-01T07:06:03.843Z"
}
```
- NOTE: interval, cycles, and scheduled time are stubs for future functionalities and have not been implemented yet.
- The requestId is the autoincremented requestId you can use to keep track of your image reqeust.
________
- To request photos that the satellite has taken:
    POST to http://localhost:3000/fetchimage with the following json as the body.
```
{
    "requestTimestampStart": "2024-03-31 08:25:36.444Z",
    "requestTimestampEnd": "2024-03-31 08:41:36.454",
    "targetId": "SAT1",
    "requestIdStart": 22,
    "requestIdEnd": 50
} 
```
- Here, you can query by request time, targetId, and requestId
- All the fields are optional, but the JSON body needs to include at least one of the above elements to function.
- Upon success, the API will respond with a zip file of all the images that have been requested with the following title to help identify the image: image_(requestId)_(targetId)_(timestamp the request was received by mcs).jpg
- Make sure to do send and download on Postman.

## Satellite API
- The satellite API is meant to mimic the interaction between the ground system and the satellite in space. I do not recommend interacting with the satellite directly without mcs, but if you would like to do manual testing on the "satellite", here are its endpoints:
________
- To get the current image manifest:
    GET request to http://localhost:3001/getAll to get the manifest for all the images taken since the last request.
- If all images have been downloaded since the last download image request, this will return an empty array.

________
- To request a single statically served image:
    GET request to http://localhost:3001/images/(image file name) to get a single image.
- These imagese are not deleted so, all images taken will be kept by the satellite.

________
- To manually put in an image request for the satellite:
    POST request to http://localhost:3001/imagerequest with the following JSON body:
```
{
    "requestId": 11,
    "targetId": "SAT1",
    "updatedAt": "2024-03-28T22:35:20.845Z"
}
```
- requestId used to map the image to a particular request.
- targetId is used to map the image to a particular target
- updatedAt is the timestamp when the request was received by mcs.

## How to build and run.
- If you would like to run all three applications using docker compose, ensure that port 3000, 3001 and 5432 are available.
- If you would like to change the default port settings, go to the .env AND Dockerfile for each project to change the port settings to your desired port.
- run the docker-compose.yml with these commands:
```
docker compose up -d --build
```
or 
```
docker compose up --build
```
________

- If you would like to test these applications outside of Docker, go to the .env file in each application and change the host names for all of the connections to be the host that you want.
- For example, instead if you wanted to test everything locally without Docker, go to the .env file in the mcs application and change
```
DBCONNECTION=postgres://takehome:takehome@pg:5432/takehome
```
to 
```
DBCONNECTION=postgres://takehome:takehome@localhost:5432/takehome
```
and 
```
SATGETALL = http://satellite:3001/getAll
```
to 
```
SATGETALL = http://localhost:3001/getAll
```
________

- All of the applications are built using Node 18.16. If you would like to run and test each application individually, ensure that npm is installed along with Node 18.16
- Install all of the dependencies by running:
```
npm install
```
- I did not set up the npm scripts, so each application will have to be run manually with the node command:
```
node *.js
```
- The database can be set up separately or using the docker-compose file. If setting up the database separately, be sure to change the connection string in the .env files. 
________


## Development
You can start the compose project with the below docker compose command. I have found that using bind mounts help me with local development but is not necessary (you can google this).
```
docker compose up -d --build
```
The initial project comes with a simple MCS starter container. Once the project is spun up, the MCS should be printing "talking to sat..." every five seconds. You can see these print statements by looking at the docker logs: `docker logs --follow <container ID>`.

## Connect to PG Admin
PG Admin runs on port 5001. To access, navigate to `localhost:5001` in a web browser. The username and password are set in `docker-compose.yml` based on the environment variables. The defaults are:
 - user: takehome@takehome.com
 - pass: takehome

## Create a server if it doesn't exist
1. Navigate to PG admin
1. Click on `Add New Server`
1. In the `General` tab
    - Name: starfire (or whatever you want your server name to be)
1. In the `Connection` tab (all these values are defined in the docker compose file):
    - Hostname: pg (the container name used in the docker compose file)
    - Port: 5432
    - Username: takehome 
    - Password: takehome