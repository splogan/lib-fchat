import fetch from "node-fetch";
import { URLSearchParams } from "url";
import errors from "../config/errors";

export default class ApiManager {
  constructor(config, credentials) {
    this.config = config;
    
    if (credentials) {
      this.account = credentials.account;
      this.password = credentials.password;
    }
  }

  //Sends a POST request to the specified url with a body as url search params
  async sendPOST(url, body) {
    const form = new URLSearchParams();
    Object.keys(body).forEach(key => {
      form.append(key, body[key]);
    });
  
    var json = await fetch(url, {
      method: "POST",
      body: form
    }).then(res => {
      return res.json();
    });

    if (json.error) { //Reject promise if f-list returns an error
      return Promise.reject(`flisterror::${json.error}`);
    }

    return json;
  }

  async getTicket(params = {}, forceRefresh) {
    //If the current ticket has not yet expired and no ticket request is in progress, just return that ticket
    if (!forceRefresh && this.ticket && !this.ticketRequest && 
      this.expirationTime && this.expirationTime > Date.now()) {
      return this.ticket;
    }

    if (this.ticketRequest) { //If the ticket request is in progress, wait until it is complete instead of sending a new request
      await this.ticketRequest; 
    }else {
      this.ticketRequest = this.sendRequest("getApiTicket", { //Request for a new ticket
        ...params,
        account: this.account,
        password: this.password
      });
  
      this.ticket = await this.ticketRequest;
      this.expirationTime = Date.now() + this.config.expirationPeriod * 1000; //Calculate the time at which the ticket will expire
      this.ticketRequest = null; 
    }

    return this.ticket;
  }

  //Sends an API request to the specified endpoint, adds ticket and account parameters if required, gets new ticket if needed
  async sendRequest(endpointName, json = {}) {
    var endpoint = this.config.endpoints[endpointName];
    if (!endpoint) {
      return Promise.reject(`libfchat::${errors.unknownEndpoint}`)
    }

    if (!this.config.noAccountRequired.includes(endpointName)) {
      var ticketResponse = await this.getTicket({
        no_characters: true, 
        no_friends: true, 
        no_bookmarks: true
      });

      //Adding the required account and ticket fields
      json = { 
        ...json, 
        account: this.account,
        ticket: ticketResponse.ticket
      }
    }
    
    var url = (this.config.apiBaseUrl || "") + endpoint;
    return await this.sendPOST(url, json);
  }
}