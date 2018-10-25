# Lib-fchat
Lib-fchat is a node js library for creating f-chat clients and making requests to f-list api endpoints. [F-list](https://www.f-list.net/) is an adult-themed creative writing and roleplaying website. To learn more about f-list in general, you can visit their [wiki](https://wiki.f-list.net/Getting_started), or if you'd like to develop third party clients or other applications that use their APIs, be sure to thoroughly read through their [developer resources](https://wiki.f-list.net/Category:Developer_Resources), especially the [rules for creating bots](https://wiki.f-list.net/F-Chat_Protocol#Bots). Lib-fchat abstracts away the need to directly manage f-list tickets and authentication, WebSocket connections, and RESTful API requests, allowing developers to concentrate on application-specific code while still providing a high level of customization.

**Note: This library is still in beta. The first full production release will be in version 1.2.0**

## Installation
Note: Before installing, ensure you have the latest version of [node](https://nodejs.org/en/) installed and that the root directory of your node project is the current workign directory in your cli. 
```sh
$ npm install --save lib-fchat
```
## Example
Using a configuration object loaded from a json file and credentials stored in a .env file, this example simply connects to f-chat and logs output to the console.

```js
require('dotenv').config();
const Fchat = require('lib-fchat/fchat');
const config = require('./config');

const fchat = new Fchat(config);

fchat.connect(process.env.ACCOUNT, process.env.PASSWORD, process.env.CHARACTER)
.then(() => console.log('Websocket connected...'))
.catch(err => console.log(`Woops: ${err}`));
```


## Documentation
**Still a work in progress as of 10/24/2018**
Documentation generated from the JSDoc style annotation in the source code can be found [here](http://htmlpreview.github.io/?https://github.com/splogan/lib-fchat/blob/master/docs/index.html) or in the **docs** directory of this repo.