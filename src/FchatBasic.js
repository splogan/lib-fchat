import ws from "ws";
import fetch from "node-fetch";
import { URLSearchParams } from "url";

export default class FchatBasic {
  constructor(config, credentials) {
    this.config = config;
    this.credentials = credentials;

    this.serverVariables = {};
    this.user = {};
    this.commandCallbackMap = {};
  }

  async connect(character, providedTicket) {
    this.user.character = character;

    try {
      this.disconnect(); //Attempt a disconnect if the socket is not null

      var ticket = providedTicket || await this.requestTicket(); //Use the ticket provided if it exists, otherwise request a new one

      this.socket = new ws(this.config.fchat.url);
      this.socket.on('open', () => this.socketOnOpen(character, ticket));
      this.socket.on('message', message => this.socketOnMessage(message));
      this.socket.on('close', () => this.socketOnClose());
      this.socket.on('error', error => this.handleError(error));
    }catch(err) {
      this.handleError(err);
    }
  }
  
  async requestTicket() {
    const form = new URLSearchParams();
    form.append("account", this.credentials.account);
    form.append("password", this.credentials.password);

    //Build url from base url and endpoint from config
    var apiConfig = this.config.api;
    var ticketUrl = (apiConfig.apiBaseUrl || "") + apiConfig.endpoints.getApiTicket; 

    var json = await fetch(ticketUrl, {
      method: "POST",
      body: form
    }).then(res => {
      return res.json();
    });

    if (json.error) {
      return Promise.reject(json.error);
    }

    //Saves character, friend, bookmark info from the ticket response
    this.user.defaultCharacter = json.default_character;
    this.user.characters = json.characters;
    this.user.friends = json.friends;
    this.user.bookmarks = json.bookmarks.map(bookmark => bookmark.name);

    return json.ticket;
  }

  disconnect() {
    if (this.socket) {
      this.socket.close();
    }
  }

  socketOnOpen(character, ticket) {
    if (this.openCallback) {
      this.openCallback(ticket);
    }

    var client = this.config.fchat.client;

    //Send an IDN command for identifying with the server, all fields here are required
    this.send('IDN', {
      method: 'ticket', 
      account: this.credentials.account, 
      ticket: ticket, 
      cname: client.name, 
      cversion: client.version,
      character
    });
  }

  socketOnMessage(message) {
    if (this.messageCallback) {
      this.messageCallback(message);
    }

    if (message.length > 2) { //Messages of less than two characters are ignored
      var command = message.substring(0, 3);
      var data;

      //If message has a json body (data), retrieve and handle failure case
      if (message.length > 3) { 
        try {
          data = JSON.parse(message.substring(4));
        }catch(err) {
          this.handleError("libfchat::Unable to parse command");
        }
      }

      this.handleCommand(command, data);
    }
  }

  socketOnClose() {
    if (this.closeCallback) {
      this.closeCallback();
    }
  }

  handleError(err) {
    if (this.errorCallback) {
      this.errorCallback(err);
    }
  }


  send(command, body) {
    var message = body ? command + ' ' + JSON.stringify(body) : command; //Build the message to be send to the server
    
    if (this.socket) {
      this.socket.send(message);
    }
  }

  handleCommand(command, data) {
    var options = this.config.fchat.options || {};

    switch(command) {
      case "CIU": //Invite to join channel, only auto join if configuration has this option set
        if (options.joinOnInvite) { 
          this.send("JCH", { channel: data.name });
        }
        break;
      case "PIN": //Ping from server, only auto ping if configuration has this option set
        if (options.autoPing) {
          this.send("PIN");
        }
        break;
      case "VAR":
        this.serverVariables[data.variable] = data.value;
        break;
      case "ERR": //Handle an error from the server
        this.handleError(`servererror::${data.number}::${data.message}`);
    }

    //Call callback for this command if it exists (for example one added using the on method)
    var commandCallback = this.commandCallbackMap[command]; 
    if (commandCallback) {
      commandCallback(data);
    }
  }


  //These methods allow for adding callbacks for websocket / fchat events
  onOpen(callback) {
    this.openCallback = callback;
  }

  onMessage(callback) {
    this.messageCallback = callback;
  }

  onClose(callback) {
    this.closeCallback = callback;
  }

  onError(callback) {
    this.errorCallback = callback;
  }

  on(command, callback) {
    this.commandCallbackMap[command] = callback; 
  }
}