require('dotenv').config();

const Fchat = require('lib-fchat/lib/Fchat');
const config = require('./config');

var credentials = {
  account: process.env.ACCOUNT,
  password: process.env.PASSWORD
}

var fchat = new Fchat(config, credentials);
fchat.connect("Superbot");

fchat.onOpen(ticket => {
  console.log(`Fchat connection opened with ticket: ${ticket}`);
});

fchat.on("IDN", () => {
  console.log("Identification Successful!");
});