require('dotenv').config();
const Fchat = require('lib-fchat/fchat');
const fchatConfig = require('./fchatConfig');

const fchat = new Fchat(fchatConfig);

fchat.connect(process.env.ACCOUNT, process.env.PASSWORD, process.env.CHARACTER)
.then(() => {
  console.log('Websocket connected...');
})
.catch(err => {
  console.log(`Woops: ${err}`);
});