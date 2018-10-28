const fetch = require('node-fetch');
const ws = require('ws');
const { URLSearchParams } = require('url');
const defaultConfig = require('./config/fchatDefaultConfig');

/**
 * @constructor
 * @param {object} config An fchat configuration object
 */
const fchat = function(config) {
  if (!config){
    config = {};
  }
  
  var tempProfileData = {};
  var commandFunctionMap = {};

  var socket = null;

  var chatops = [];
  var channels = [];
  var characters = [];
  var friends = [];
  var ignoreList = [];
  var serverVariables = {};

  /**
   * @function getChatops
   * @memberof fchat
   * @description Returns all current chatops
   * @return {Array} An array of chatops
   * @instance
   */
  this.getChatops = () => chatops;

  /**
   * @function getJoinedChannels
   * @memberof fchat
   * @description Returns a list of all channels that the client is currently joined into (note that the fchat object does not track the global list of all public and private channels)
   * @return {Array} An array of channel objects
   * @instance
   */
  this.getJoinedChannels = () => channels;

  /**
   * @function getCharacters
   * @memberof fchat
   * @description Returns a list of all characters currently logged into the chat, including their gender, status, status message, and typing status
   * @return {Array} An array of character objects
   * @instance
   */
  this.getCharacters = () => characters;

  /**
   * @function getFriends
   * @memberof fchat
   * @description Returns a list of the client character's friends
   * @return {Array} An array of character names
   * @instance
   */
  this.getFriends = () => friends;

  this.getIgnoreList = () => ignoreList;
  this.getServerVariables = () => serverVariables;
  this.getFchatState = () => {
    chatops, channels, characters, friends, ignoreList, serverVariables
  }

  var client = Object.assign(defaultConfig.client, config.client);
  this.setClientName = (name) => client.name = name;
  this.setClientVersion = (version) => client.version = version;
  this.setClientCharacter = (character) => client.character = character;

  var urls = Object.assign(defaultConfig.urls, config.urls);
  this.setTicketUrl = (url) => urls.ticket = url;
  this.setFchatUrl = (url) => urls.fchatPublic = url;
  this.setFchatDevUrl = (url) => urls.fchatDev = url;

  var options = Object.assign(defaultConfig.options, config.options);
  this.autoPing = (bool) => options.autoPing = bool;
  this.setDevMode = (bool) => options.devMode = bool;
  this.joinOnInvite = (bool) => options.joinOnInvite = bool;
  this.logServerCommands = (bool) => options.logServerCommands = bool;
  this.logClientCommands = (bool) => options.logClientCommands = bool;

  /**
   * @function connect
   * @memberof fchat
   * @description Retrieves a ticket using the provided credentials, opens a WebSocket connection, and identifies the client to the server
   * @param {string} account An account or username for f-list.net
   * @param {string} password The password for the specified account
   * @param {string} character The desired login character
   * @return {Promise} A promise that resolves when/if the socket opens (though before identification), does not return any parameters
   * @instance
   */
  this.connect = (account, password, character) => {
    client.character = character;

    return requestTicket(urls.ticket, account, password).then(ticket => {
      const url = options.devMode ? urls.fchatDev : urls.fchatPublic;
      socket = new ws(url);

      socket.on('open', () => {
        Promise.resolve();

        this.send('IDN', {
          method: 'ticket', 
          account, 
          ticket, 
          character, 
          cname: client.name, 
          cversion: client.version 
        });
      });

      socket.on('message', message => onMessage(message));
      socket.on('error', err => Promise.reject(err));
    });
  }

  /**
   * @function send
   * @memberof fchat
   * @description For lower level control of what is being sent through the WebSocket, sends a command to the server with cooresponding data
   * @param {string} command A client command (ie. ADL, CDS, etc)
   * @param {object} data The data to be sent with this command
   * @instance
   */
  this.send = (command, data) => {
    var message = data ? command + ' ' + JSON.stringify(data) : command;
    if (options.logClientCommands){
      console.log(`>> ${message}`);
    }
    
    socket.send(message);
  }

  /*** 
   * Private ticket request method that accepts a url and credentials and returns a Promise that resolves with an f-chat ticket
   * This method negates the need for using endpointManager
  */
  var requestTicket = (ticketUrl, account, password) => {
    const FALLBACK_ERR = 'Unable to parse ticket response';
    const form = new URLSearchParams();
    form.append('account', account);
    form.append('password', password);
    form.append('no_characters', true);
    form.append('no_friendsd', true);
    form.append('no_bookmarks', true);

    return fetch(ticketUrl, { 
      method: 'POST', 
      body: form
    })
    .then(res => res.json())
    .then(json => {
      if (json.ticket){
        return Promise.resolve(json.ticket);
      }

      Promise.reject(json.error ? json.error : FALLBACK_ERR); 
    });
  }

  var onMessage = (message) => {
    if (options.logServerCommands){
      console.log(`<< ${message}`);
    }

    var command = "";
    var data = {};
  
    if (message.length===3){
      command = message;
    }else if (message.length > 3){
      command = message.substring(0, 3);
      data = JSON.parse(message.substring(4));
    }

    const methodName = `on${command}`;
    if (this[methodName]){
      this[methodName](data);
    }

    const callbackFunc = commandFunctionMap[command];
    if (callbackFunc){
      callbackFunc(data);
    }
  }

  /**
   * @callback commandCallback
   * @description Note: Replaces any previous callback assigned to this particular command using the on function
   * @param {object} data A raw json object from the server
   */
  /**
   * @function on
   * @memberof fchat
   * @example 
   * fchat.on('CHA', data => console.log(JSON.stringify(data)));
   * @description Listens for a specific client command and invokes a callback with its data
   * @param {string} command A client command (ie. ADL, CDS, etc)
   * @param {commandCallback} callback Callback which returns the data received
   * @instance
   */
  this.on = (command, func) => {
    commandFunctionMap[command] = func;
  }

  this.onADL = (data) => {
    chatops = data.ops;
    adlCallback(data.ops);
  }

  this.onAOP = (data) => {
    chatops.push(data.character);
    aopCallback(data.character);
  }

  this.onBRO = (data) => {
    broCallback(data.message);
  }

  this.onCDS = (data) => {
    cdsCallback(data.channel, data.description);
  }

  this.onCHA = (data) => {
    chaCallback(data.channels);
  }

  this.onCIU = (data) => {
    if (options.joinOnInvite){
      this.joinChannel(data.name);
    }

    ciuCallback(data.sender, data.title, data.name);
  }

  this.onCBU = (data) => {
    cbuCallback(data.operator, data.channel, data.character);
  }

  this.onCKU = (data) => {
    ckuCallback(data.operator, data.channel, data.character);
  }

  this.onCOA = (data) => {
    const channel = findChannel(data.channel);
    if (channel && !channel.chanops.includes(data.character)){
      channel.chanops.push(data.character);
    }

    coaCallback(data.character, data.channel);
  }

  this.onCOL = (data) => {
    const channel = findChannel(data.channel);
    if (channel){
      channel.chanops = data.oplist;
      channel.owner = data.oplist[0];
    }

    colCallback(data.channel, data.oplist);
  }

  this.onCON = (data) => {
    conCallback(data.count);
  }

  this.onCOR = (data) => {
    const channel = findChannel(data.channel);
    if (channel){
      channel.chanops = channel.chanops.filter(op => op!==data.character);
    }

    corCallback(data.character, data.channel);
  }

  this.onCSO = (data) => {
    const channel = findChannel(data.channel);
    if (channel){
      channel.owner = data.character;
    }

    csoCallback(data.character, data.channel);
  }

  this.onCTU = (data) => {
    this.ctuCallback(data.operator, data.channel, data.length, data.character);
  }

  this.onDOP = (data) => {
    chatops = chatops.filter(op => op!==data.character);
    dopCallback(data.character);
  }

  this.onERR = (data) => {
    errCallback(data.number, data.message);
  }

  this.onFKS = (data) => {
    fksCallback(data.characters, data.kinks);
  }

  this.onFLN = (data) => {
    characters = characters.filter(char => char.name!==data.character);
    flnCallback(data.character);
  }

  this.onFRL = (data) => {
    friends = data.characters;
    frlCallback(data.characters);
  }

  this.onHLO = (unused) => {
    hloCallback();
    varCallback(serverVariables);
  }

  this.onICH = (data) => {
    channels = channels.filter(channel => channel!==data.channel);
    var users = data.users.map(data => data.identity);

    const channel = findChannel(data.channel);
    if (channel){
      channel.mode = data.mode;
      channel.users = users;
    }

    ichCallback(users, data.channel, data.mode);
  }

  this.onIDN = (unused) => {
    idnCallback();
  }

  this.onIGN = (data) => {
    switch(data.action){
      case 'init':
        ignoreList = data.characters;
        ignCallbackInit(data.characters);
        break;
      case 'add':
        if (!ignoreList.includes(data.character)){
          ignoreList.push(data.character);
        }

        ignCallbackAdd(data.character);
        break;
      case 'delete':
        if (ignoreList.includes(data.character)){
          ignoreList = ignoreList.filter(char => char!==data.character);
        }

        ignCallbackDelete(data.character);
    }

    ignCallbackChange(ignoreList);
  }

  this.onJCH = (data) => {
    const characterName = data.character.identity;
      
    if (characterName===client.character){
      channels.push({
        name: data.channel,
        title: data.title
      });

      jchCallbackClient(data.channel, data.title);
    }else {
      const channel = findChannel(data.channel);
      if (channel && !channel.users.includes(characterName)){
        channel.users.push(characterName);
      }
    }

    jchCallback(data.channel, data.character.identity, data.title);
  }

  this.onKID = (data) => {
    kidCallback(data.type, data.message, data.key, data.value);
  }

  this.onLCH = (data) => {
    if (data.character===client.character){
      removeChannel(data.channel);
    }else {
      const channel = findChannel(data.channel);
      if (channel){
        channel.users = channel.users.filter(user => user!==data.character);
      }
    }

    lchCallback(data.channel, data.character);
  }

  this.onLIS = (data) => {
    data.characters.forEach(data => {
      characters.push({
        name: data[0],
        gender:  data[1],
        status: data[2],
        statusmsg: data[3],
        typing: 'clear'
      });
    });
  }

  this.onLRP = (data) => {
    lrpCallback(data.character, data.message, data.channel);
  }

  this.onMSG = (data) => {
    msgCallback(data.character, data.message, data.channel);
  }

  this.onNLN = (data) => {
    if (data.identity===client.character){
      lisCallback(characters);
    }else {
      characters.push({
        name: data.identity,
        gender: data.gender,
        status: data.status,
        statusmsg: '',
        typing: 'clear'
      });
    }

    nlnCallback(data.identity, data.gender, data.status);
  }

  this.onORS = (data) => {
    orsCallback(data.channels);
  }

  this.onPIN = (unused) => {
    if (options.autoPing){
      this.ping();
    }

    pinCallback();
  }

  this.onPRD = (data) => {
    switch(data.type){
      case 'start':
        tempProfileData[data.character] = {
          startMsg: data.message,
          profile: {}
        };
        break;
      case 'info':
        tempProfileData[data.character].profile[data.key] = data.value;
        break;
      case 'end':
        var profileData = tempProfileData[data.character];
        prdCallback(data.character, profileData.startMsg, data.message, profileData.profile);
        break;
    }
  }

  this.onPRI = (data) => {
    priCallback(data.character, data.message);
  }

  this.onRLL = (data) => {
    if (data.type==='dice'){
      rllCallbackDice(
        data.channel, 
        data.results, 
        data.message, 
        data.rolls, 
        data.character, 
        data.endresult
      );
    }else if (data.type==='bottle'){
      rllCallbackBottle(
        data.target, 
        data.channel, 
        data.message, 
        data.character
      );
    }
  }

  this.onRMO = (data) => {
    const channel = findChannel(data.channel);
    if (channel){
      channel.mode = data.mode;
    }

    rmoCallback(data.mode, data.channel);
  }

  this.onRTB = (data) => {
    rtbCallback(data.type, data.character);
  }

  this.onSTA = (data) => {
    const character = findCharacter(data.character);
    if (character){
      character.status = data.status;
      character.statusmsg = data.statusmsg;
    }
    staCallback(data.status, data.character, data.statusmsg);
  }

  this.onSYS = (data) => {
    const channel= data.channel ? data.channel : '';
    sysCallback(data.message, channel);
  }

  this.onTPN = (data) => {
    const character = findCharacter(data.character);
    if (character){
      character.typing = data.status;
    }

    tpnCallback(data.character, data.status);
  }

  this.onUPT = data => {
    uptCallback(data);
  }

  this.onVAR = (data) => {
    serverVariables[data.variable] = data.value;
  }

  var findCharacter = (character) => {
    return characters.find(char => char.name===character);
  }

  var findChannel = (channel) => {
    return channels.find(chan => chan.name===channel);
  }

  var removeChannel = (channel) => {
    return channels.filter(chan => chan.name!==channel);
  }


  /**
   * @function serverBan
   * @memberof fchat
   * @description Requests that the specified character be banned from the server, sends an ACB client command (requires chat op or higher)
   * @param {string} character The name of the character 
   * @instance
   */
  this.serverBan = (character) => {
    this.send('ACB', { character });
  }

  /**
   * @function promoteChatop
   * @memberof fchat
   * @description Requests that the specified character be promoted to chatop, sends an AOP client command (admin only)
   * @param {string} character The name of the character
   * @instance
   */
  this.promoteChatop = (character) => {
    this.send('AOP', { character });
  }

  /**
   * @function requestAlts
   * @memberof fchat
   * @description Requests a list of the specified character's alts, sends an AWC client command
   * @param {string} character The name of the desired character
   * @instance
   */
  this.requestAlts = (character) => {
    this.send('AWC', { character });
  }

  /**
   * @function broadcast
   * @memberof fchat
   * @description Broadcasts a message to all characters in chat, sends an BRO client command
   * @param {string} message The message to broadcast
   * @instance
   */
  this.broadcast = (message) => {
    this.send('BRO', { message });
  }

  /**
   * @function requestChannelBanList
   * @memberof fchat
   * @description Requests a list of all characters banned from the specified channel, sends a CBL client command
   * @param {string} channel The name of the channel
   * @instance
   */
  this.requestChannelBanList = (channel) => {
    this.send('CBL', { channel });
  }

  /**
   * @function channelBan
   * @memberof fchat
   * @description Bans the specified character from a channel, sends a CBU client command
   * @param {string} character The name of the character
   * @param {string} channel The name of the channel
   * @instance
   */
  this.channelBan = (character, channel) => {
    this.send('CBU', { character, channel });
  }

  /**
   * @function createPrivateChannel
   * @memberof fchat
   * @description Creates a new private channel of the name specified, sends a CCR client command
   * @param {string} channel The name of the channel
   * @instance
   */
  this.createPrivateChannel = (channel) => {
    this.send('CCR', { channel });
  }

  /**
   * @function setChannelDescription
   * @memberof fchat
   * @description Sets a specified channel's description, sends a CDS client command
   * @param {string} channel The name of the channel
   * @param {string} description The desired description for the channel
   * @instance
   */
  this.setChannelDescription = (channel, description) => {
    this.send('CDS', { channel, description });
  }

  /**
   * @function requestPublicChannels
   * @memberof fchat
   * @description Requests a list of all public (official) channels, sends a CHA client command
   * @instance
   */
  this.requestPublicChannels = () => {
    this.send('CHA', null);
  }

  /**
   * @function sendChannelInvite
   * @memberof fchat
   * @description Invites a character to the specified closed channel, sends a CIU client command
   * @param {string} channel The name of the channel
   * @param {string} character The name of the character
   * @instance
   */
  this.sendChannelInvite = (channel, character) => {
    this.send('CIU', { channel, character });
  }

  /**
   * @function channelKick
   * @memberof fchat
   * @description Kicks a character from the specified channel, sends a CKU client command
   * @param {string} channel The name of the channel
   * @param {string} character The name of the character
   * @instance
   */
  this.channelKick = (channel, character) => {
    this.send('CKU', { channel, character });
  }

  this.promoteChanop = (channel, character) => this.send('COA', { channel, character });
  this.requestChanops = (channel) => this.send('COL', { channel });
  this.demoteChanop = (channel, character) => this.send('COR', { channel, character });
  this.createOfficialChannel = (channel) => this.send('CRC', { channel });
  this.setChannelOwner = (channel, character) => this.send('CSO', { character, channel });
  this.channelTimeout = (channel, character, length) => this.send('CTU', { channel, character, length });
  this.channelUnban = (channel, character) => this.send('CUB', { channel, character });
  this.demoteChatop = (character) => this.send('DOP', { character });
  this.characterSearch = (searchOptions) => this.send('FKS', searchOptions);

  this.ignoreCharacter = (character) => this.send('IGN', { action: 'add', character });
  this.unignoreCharacter = (character) => this.send('IGN', { action: 'delete', character });
  this.sendIgnoreNotification = (character) => this.send('IGN', { action: 'notify', character});
  this.requestIgnoreList = () => this.send('IGN', { action: 'list' });

  this.joinChannel = (channel) => this.send('JCH', { channel });
  this.deleteChannel = (channel) => this.send('KIC', { channel });
  this.serverKick = (character) => this.send('KIK', { character });
  this.requestKinks = (character) => this.send('KIN', { character });
  this.leaveChannel = (channel) => this.send('LCH', { channel });
  this.sendAd = (channel, message) => this.send('LRP', { channel, message });
  this.sendChannelMessage = (channel, message) => this.send('MSG', { channel, message });
  this.requestPrivateChannelList = () => this.send('ORS', null);
  this.ping = () => this.send('PIN', null);
  this.sendPrivateMessage = (recipient, message) => this.send('PRI', { recipient, message });
  this.requestProfileTags = (character) => this.send('PRO', { character });

  this.spinBottle = (channel) => this.send('RLL', { channel, dice: 'bottle' });
  this.rollDice = (channel, dice) => this.send('RLL', { channel, dice });

  this.setChannelMode = (channel, mode) => this.send('RMO', { channel, mode });

  this.setChannelPublic = (channel) => this.send('RST', { channel, status: 'public'});
  this.setChannelPrivate = (channel) => this.send('RST', { channel, status: 'private'});

  this.rewardUser = (character) => this.send('RWD', { character });
  this.reportIssue = (report, character) => this.send('SFC', { action: 'report', report, character });
  this.setStatus = (status, statusmsg) => this.send('STA', { status, statusmsg });
  this.serverTimeout = (character, time, reason) => this.send('TMO', { character, time, reason });
  this.setTypingStatus = (status) => this.send('TPN', { character: client.character, status });
  this.serverUnban = (character) => this.send('UNB', { character });
  this.requestStats = () => this.send('UPT', null);




  /**
   * @callback chatopsCallback
   * @param {array} chatops An array of all chatops
   */
  /**
   * @function onChatopsReceived
   * @memberof fchat
   * @description Receives a list of chatops
   * @param {chatopsCallback} callback Callback which returns a list of chatops, received from the server by the ADL command
   * @instance
   */
  this.onChatopsReceived = (func) => adlCallback = func;
  var adlCallback = (chatops) => {}

  /**
   * @callback chatopPromotionCallback
   * @param {string} chatop The name of the chatop promoted (character)
   */
  /**
   * @function onChatopPromoted
   * @memberof fchat
   * @description Receives notification that a character has been promoted to chatop
   * @param {chatopPromotionCallback} callback Callback which returns the name of the promoted character, received from the server by the ADL command
   * @instance
   */
  this.onChatopPromoted = (func) => aopCallback = func;
  var aopCallback = (chatop) => {}


  /**
   * @callback broadcastCallback
   * @param {string} message The broadcast message
   */
  /**
   * @function onBroadcast
   * @memberof fchat
   * @description Receives a broadcast sent from staff
   * @param {broadcastCallback} callback Callback which returns broadcast message, received from the server by the BRO command
   * @instance
   */
  this.onBroadcast = (func) => broCallback = func;
  var broCallback = (message) => {}
  
  /**
   * @callback channelDescriptionCallback
   * @param {string} channel A channel name
   * @param {string} description A description of the channel
   */
  /**
   * @function onChannelDescription
   * @memberof fchat
   * @description Receives the description of a channel (either after the client enters the channel or if the description changes)
   * @param {channelDescriptionCallback} callback Callback which returns a channel and its description, received from the server by the CDS command
   * @instance
   */
  this.onChannelDescription = (func) => cdsCallback = func;
  var cdsCallback = (channel, description) => {}

  /**
   * @callback publicChannelsCallback
   * @param {array} channels An array of public channels
   */
  /**
   * @function onPublicChannelsReceived
   * @memberof fchat
   * @description Receives a list of public channels
   * @param {publicChannelsCallback} callback Callback which returns an array of public channels, received from the server by the CHA command
   * @instance
   */
  this.onPublicChannelsReceived = (func) => chaCallback = func;
  var chaCallback = (channels) => {}

  
  /**
   * @callback channelInviteCallback
   * @param {string} sender The name of the character sending the channel invite
   * @param {string} title The channel title
   * @param {string} name The channel name
   */
  /**
   * @function onChannelInvite
   * @memberof fchat
   * @description Receives an invitation to join a channel
   * @param {channelInviteCallback} callback Callback which returns the name of the sender as well as the name and title of the channel, received from the server by the CIU command
   * @instance
   */
  this.onChannelInvite = (func) => ciuCallback = func;
  var ciuCallback = (sender, title, name) =>  {}

  /**
   * @callback channelBanCallback
   * @param {string} operator The name of the operator issuing the ban
   * @param {string} channel The channel name
   * @param {string} character The banned character
   */
  /**
   * @function onChannelBan
   * @memberof fchat
   * @description Receives notification that a character has been banned from the specified channel
   * @param {channelBanCallback} callback Callback which returns the name of the banned character, the name of the operator who issued the ban, and the channel name, received from the server by the CBU command
   * @instance
   */
  this.onChannelBan = (func) => cbuCallback = func;
  var cbuCallback = (operator, channel, character) => {}

  /**
   * @callback channelKickCallback
   * @param {string} operator The name of the operator issuing the kick
   * @param {string} channel The channel name
   * @param {string} character The kicked character
   */
  /**
   * @function onChannelKick
   * @memberof fchat
   * @description Receives notification that a character has been kicked from the specified channel
   * @param {channelKickCallback} callback Callback which returns the name of the kicked character, the name of the operator who issued the kick, and the associated channel, received from the server by the CKU command
   * @instance
   */
  this.onChannelKick = (func) => ckuCallback = func;
  var ckuCallback = (operator, channel, character) => {}

  /**
   * @callback chanopPromotedCallback
   * @param {string} character The name of the character promoted
   * @param {string} channel The name of the channel in which they were promoted
   */
  /**
   * @function onChanopPromoted
   * @memberof fchat
   * @description Receives notification that a character has been promoted to a chanop in the specified channel
   * @param {chanopPromotedCallback} callback Callback which returns the name of character promoted and the channel name, received from the server by the COA command
   * @instance
   */
  var coaCallback = (character, channel) => {}
  this.onChanopPromoted = (func) => coaCallback = func;

  /**
   * @callback chanopsReceivedCallback
   * @param {string} channel The name of a channel
   * @param {string} oplist An array of the chanops
   */
  /**
   * @function onChanopsReceived
   * @memberof fchat
   * @description Receives a list of all chanops for a specified channel
   * @param {chanopsReceivedCallback} callback Callback which returns the name of the channel and list of all chanops, received from the server by the COL command
   * @instance
   */
  var colCallback = (channel, oplist) => {}
  this.onChanopsReceived = (func) => colCallback = func;

  /**
   * @callback userCountReceivedCallback
   * @param {int} userCount The number of users in chat
   */
  /**
   * @function onUserCountReceived
   * @memberof fchat
   * @description Receives the number of users currently connected to the chat, after the client identifies with the server
   * @param {userCountReceivedCallback} callback Callback which returns the number of users in chat, received from the server by the CON command
   * @instance
   */
  var conCallback = (count) => {}
  this.onUserCountReceived = (func) => conCallback = func;

  var corCallback = (character, channel) => {}
  this.onChanopRemoved = (func) => corCallback = func;

  var csoCallback = (character, channel) => {}
  this.onChannelOwnerChanged = (func) => csoCallback = func;

  var ctuCallback = (operator, channel, length, character) => {}
  this.onChannelTimeout = (func) => ctuCallback = func;

  var dopCallback = (character) => {}
  this.onChatopRemoved = (func) => dopCallback = func;

  var errCallback = (number, message) => {}
  this.onError = (func) => errCallback = func;

  var fksCallback = (characters, kinks) => {}
  this.onSearchResult = (func) => fksCallback = func;

  var flnCallback = (character) => {}
  this.onUserDisconnected = (func) => flnCallback = func;

  var frlCallback = (characters) => {}
  this.onFriendsList = (func) => frlCallback = func;

  var hloCallback = () => {}
  this.onHello = (func) => hloCallback = func;

  var ichCallback = (users, channel, mode) => {}
  this.onInitialChannelData = (func) => ichCallback = func;

  var idnCallback = () => {}
  this.onIdentification = (func) => idnCallback = func;

  var ignCallbackInit = () => {}
  var ignCallbackAdd = () => {}
  var ignCallbackDelete = () => {}
  var ignCallbackChange = () => {}
  this.onIgnoreListReceived = (func) => ignCallbackInit = func;
  this.onCharacterIgnored = (func) => ignCallbackAdd = func;
  this.onCharacterUnignored = (func) => ignCallbackDelete = func;
  this.onIgnoreListChanged = (func) => ignCallbackChange = func;

  var jchCallback = (channel, character, title) => {}
  var jchCallbackClient = (channel, title) => {}
  this.onChannelJoined = (func) => jchCallback = func;
  this.onClientJoinedChannel = (func) => jchCallbackClient = func;

  var kidCallback = (type, message, key, value) => {}
  this.onKinkDataReceived = (func) => kidCallback = func;

  var lchCallback = (channel, character) => {}
  this.onChannelLeft = (func) => lchCallback = func;

  var lisCallback = (characters) => {}
  this.onInitialCharactersReceived = (func) => lisCallback = func;

  var lrpCallback = (character, message, channel) => {};
  this.onAd = (func) => lrpCallback = func;
  
  var msgCallback = (character, message, channel) => {}
  this.onChannelMessage = (func) => msgCallback = func;

  var nlnCallback = (character, gender, status) => {}
  this.onUserConnected = (func) => nlnCallback = func;

  var orsCallback = (channels) => {}
  this.onPrivateChannelsReceived = (func) => orsCallback = func;

  var pinCallback = () => {}
  this.onPing = (func) => pinCallback = func;

  var prdCallback = (character, startMsg, endMsg, profile) => {}
  this.onProfileTagsReceived = (func) => prdCallback = func;

  var priCallback = (character, message) => {}
  this.onPrivateMessage = (func) => priCallback = func;

  var rllCallbackDice = (channel, results, message, rolls, character, endResult) => {}
  var rllCallbackBottle = (target, channel, message, character) => {}
  this.onDiceRoll = (func) => rllCallbackDice = func;
  this.onBottleSpin = (func) => rllCallbackBottle = func;

  var rmoCallback = (mode, channel) => {}
  this.onChannelModeChanged = (func) => rmoCallback = func;
  
  var rtbCallback = (type, character) => {}
  this.onRtbMessage = (func) => rtbCallback = func;

  var sfcCallback = () => {}

  var staCallback = (status, character, statusmsg) => {}
  this.onStatusChange = (func) => staCallback = func;

  var sysCallback = (message, channel) => {}
  this.onSystemMessage = (func) => sysCallback = func;

  var tpnCallback = (character, status) => {}
  this.onTypingStatusChanged = (func) => tpnCallback = func;

  var uptCallback = (stats) => {}
  this.onStatsReceived = (func) => uptCallback = func;

  var varCallback = (variables) => {}
  this.onServerVariablesReceived = (func) => varCallback = func;
}

module.exports = fchat;