## My approach for solving this problem:
My approach for solving this problem consists of three separate Node.js projects, one to represent each component of this assignment. I used express.js to implement the endpoints on the client API as well as to simulate the communication between the satellite and the mcs system. Because the end result of this assignment involves fetching and storing images, I decided to focus my implementation on fetching and storing multiple images. Here are some important design decisions that I made:
- The communication between mcs and the satellite to fetch all images has two steps:
    - fetching an image manifest that contains the image metadata. 
    - fetching a series of images from a statically served directory based on information from the image manifest
    - I chose to implement the fetching image communication like this because I wanted to avoid one large response from the satellite. The current implementation has a manifest but fetches each image individually. 
        - Although a series of smaller requests has a bigger overhead, I wanted to avoid a situation where a large file dump from the satellite results in an error due to issues with the radio. There's no "ACK" mechanism like in TCP with my implementation, so I decided a series of smaller requests would mitigate any issues where the received packet is incomplete or corrupt, leading to another request.
        
- The endpoint to fetch images from the client API is a POST request that contains a JSON body which in turn contains a rudimentary SQL-like query for parameters based on the images characteristics. 
    - For now, these characteristics are only timestamp of the request, the requst id, and the target of the image.
    - The response will be a zip file with a series of images.
    - The image title will contain necessary metadata to map the image to a target, request id, or a request timestamp.

- Originally, I wanted to implement a feature to schedule future images, a feature to schedule multiple images, and a a feature to implement a timeout interval between different photos, but due to time constraint, these feature will be implemented in the future. 
    - The POST request to add an image request as well as the database already include these fields.

- One challenge I did run into was getting the docker compose to work properly. Specifically, I had to make sure that the pg container was up and running before starting up any of my applications. I realized "depends_on" does not solve this issue, so I had to put my connection initializations in a while loop to make sure that that they are able to connect to the database.
    - I'm not entirely sure if my solution is able to solve this issue on different machines, but it seems to solve the issue for me. If you have received DB related error messages in docker compose, please try to rebuild and rerun the docker compose file. The goal is to let the unbuilt containers cycle while maintaining the existing containers. 

## Future plans:
- refactor the node.js routes
- implement future scheduling for images
- implement multiple images for a single request
- implement option to sleep after taking a photo for satellite, this would come in handy if we need to take multiple images, because we can set a time out after taking each image have better control of when the image is taken
- implement endpoint for deleting stored photos on satellite
- implement endpoint for clearing requests
- implement a more robust query system for images already in the system
- implement security 