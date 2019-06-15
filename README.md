# Lib-fchat
Lib-fchat is a node js library for creating f-chat clients and making requests to f-list api endpoints. [F-list](https://www.f-list.net/) is an adult-themed creative writing and roleplaying website. To learn more about f-list in general, you can visit their [wiki](https://wiki.f-list.net/Getting_started), or if you'd like to use their APIs to develop third party clients or other applications, be sure to thoroughly read through their [developer resources](https://wiki.f-list.net/Category:Developer_Resources) before implementing this library in your projects. Lib-fchat abstracts away the need to directly manage f-list tickets and authentication, WebSocket connections, and RESTful API requests, allowing developers to concentrate on application-specific code while still providing a high level of customization.

## Installation
Note: Before installing, ensure you have the latest version of [node](https://nodejs.org/en/) installed and that the root of your node project is the current working directory in your cli. 
```sh
$ npm install --save lib-fchat
```
## Example
Using lib-fchat's default configurations and credentials stored in a .env file, this example simply connects to f-chat and logs output to the console.

```js
require('dotenv').config();
const Fchat = require('lib-fchat/fchat');
const fchat = new Fchat();

fchat.connect(process.env.ACCOUNT, process.env.PASSWORD, process.env.CHARACTER)
.then(() => console.log('Websocket connected...'))
.catch(err => console.log(`Woops: ${err}`));
```