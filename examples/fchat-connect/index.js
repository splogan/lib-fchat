require('dotenv').config();
const Fchat = require('lib-fchat/fchat');
const config = require('./config');

const fchat = new Fchat(config);

fchat.connect(process.env.ACCOUNT, process.env.PASSWORD, process.env.CHARACTER)
.then(() => {
  console.log('Websocket connected...');
})
.catch(err => {
  console.log(`Woops: ${err}`);
});