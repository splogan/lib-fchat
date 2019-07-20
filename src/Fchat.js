import FchatBasic from "./FchatBasic";

export default class Fchat extends FchatBasic {
  constructor(account, password, config) {
    super(account, password, config);

    this.characters = {};
    this.channels = {};
    this.chatops = [];
    this.ignoreList = [];
  }

  handleCommand(command, data) {
    var methodName = `on${command}`; //Will call a handler method named onXXX() and pass the received data 
    if (this[methodName]){
      this[methodName](data);
    }

    super.handleCommand(command, data);
  }

  //Sends an array of all the online characters and their gender, status, and status message.
  onLIS({ characters }) {
    characters.forEach(element => {
      this.characters[element[0]] = {
        name: element[0],
        gender: element[1],
        status: element[2],
        statusMsg: element[3]
      }
    });
  }

  //A user connected.
  onNLN({ identity, gender, status }) {
    this.characters[identity] = {
      name: identity,
      gender,
      status,
      statusMsg: ""
    }
  }

  //Sent by the server to inform the client a given character went offline.
  onFLN({ character }) {
    delete this.characters[character];
  }

  //A user changed their status
  onSTA({ status, character, statusmsg }) {
    var char = this.characters[character];
    if (char) {
      char.status = status;
      char.statusMsg = statusmsg;
    }
  }

  //Indicates the given user has joined the given channel. This may also be the client's character.
  onJCH({ character, channel, title }) {
    if (character.identity === this.user.character) { //Client is joining, so add as a new channel
      this.channels[channel.toLowerCase()] = {
        name: channel,
        title,
        users: []
      }
    }else { //A new character is joining, so add this character to the channel's list of users
      var chan = this.channels[channel.toLowerCase()];
      if (chan && !chan.users.includes(character.identity)) {
        chan.users.push(character.identity);
      }
    }

    console.log(this.channels);
  }

  //An indicator that the given character has left the channel. This may also be the client's character.
  onLCH({ channel, character }) {
    var chan = this.channels[channel.toLowerCase()];
    if (chan) {
      if (character === this.user.character) { //Client is leaving, so remove the channel
        delete this.channels[channel.toLowerCase()];
      }else { //A character is leaving, so remove this character from the channel's list of users
        console.log(character);
        console.log(chan.users);
        chan.users = chan.users.filter(user => user !== character);
        console.log(chan.users);

      }
    }

    console.log(this.channels);
  }

  //Initial channel data. Received in response to JCH, along with CDS.
  onICH({ users, channel, mode }) {
    var chan = this.channels[channel.toLowerCase()];
    if (chan) {
      chan.users = users.map(data => data.identity)
      chan.mode = mode;
    }

    console.log(this.channels);
  }

  //Alerts the client that that the channel's description has changed. This is sent whenever a client sends a JCH to the server.
  onCDS({ channel, description }) {
    console.log(channel);
    var chan = this.channels[channel.toLowerCase()];
    console.log(chan);
    if (chan) {
      chan.description = description;
      console.log(chan.description);
    }

    console.log(this.channels);
  }

  //Gives a list of channel ops. Sent in response to JCH.
  onCOL({ channel, oplist }) {
    var chan = this.channels[channel.toLowerCase()];
    if (chan && oplist.length > 0) {
      if (oplist[0].length > 0) {
        chan.owner = oplist[0];
      }else {
        oplist.shift();
      }
  
      chan.chanops = oplist;
    }
  }

  //This command requires channel op or higher. Promotes a user to channel operator.
  onCOA({ character, channel }) {
    var chan = this.channels[channel.toLowerCase()];
    if (chan && !chan.chanops.includes(character)) {
      chan.chanops.push(character);
    }

    console.log(this.channels);
  }
  
  //This command requires channel op or higher. Removes a channel operator.
  onCOR({ character, channel }) {
    var chan = this.channels[channel.toLowerCase()];
    if (chan) {
      chan.chanops = chan.chanops.filter(op => op != character);
    }

    console.log(this.channels);
  }

  //Sets the owner of the current channel to the character provided.
  onCSO({ character, channel }) {
    var chan = this.channels[channel.toLowerCase()];
    if (chan) {
      chan.owner = character;
    }

    console.log(this.channels);
  }

  //Change room mode to accept chat, ads, or both.
  onRMO({ mode, channel }) {
    var chan = this.channels[channel.toLowerCase()];
    if (chan) {
      chan.mode = mode;
    }

    console.log(this.channels);
  }

  //Sends the client the current list of chatops.
  onADL({ ops }) {
    this.chatops = ops;
  }

  //The given character has been promoted to chatop.
  onAOP({ character }) {
    if (!this.chatops.includes(character)) {
      this.chatops.push(character);
    }
  }

  //The given character has been stripped of chatop status.
  onDOP({ character }) {
    this.chatops = this.chatops.filter(op => op != character);
  }

  //Handles the ignore list.
  onIGN({ action, characters, character }) {
    switch(action){
      case 'init': //Init action: Full ignore list is given
        this.ignoreList = characters;
        break;
      case 'add': //Add action: New name is added to the ignore list
        if (!this.ignoreList.includes(character)){
          this.ignoreList.push(character);
        }
        break;
      case 'delete': //Delete action: Name is deleted from the ignore list
          this.ignoreList = this.ignoreList.filter(char => char !== character);
    }
  }
}