# CB.SC.U4CSE23101

1. vehicle maintenance scheduler
2. notification priority inbox.

### Authentication
before running, paste auth token in .env file as `LOG_AUTH_TOKEN` environment variable, or create `credentials.json` file with registered details (`clientID`, `clientSecret`, `email` , `name`, `rollNo`, `accessCode`). 

`npm install`

### Starting Vehicle Scheduling

`node vehicle_scheduling/index.js`

### Starting Priority Inbox

`node notification_app_be/index.js`

## test screenshots

### vehicle scheduling API
#### GET http://localhost:3000/schedule

![vehicle schedule 1](ScreenShots/Q1_Pic1.png)

#### GET http://localhost:3001/priority-inbox
![vehicle schedule 2](ScreenShots/Q1_Pic2.png)

### priority inbox API
![priority inbox](ScreenShots/Q2_Pic.png)
