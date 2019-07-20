require("dotenv").config();

const ApiManager = require("lib-fchat/lib/ApiManager");
const config = require("./config");

var credentials = {
  account: process.env.ACCOUNT,
  password: process.env.PASSWORD
}

var apiManager = new ApiManager(config.api, credentials);
apiManager.getTicket().then(res => console.log(res));