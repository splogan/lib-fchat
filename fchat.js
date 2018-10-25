var ws = require('ws');
var EndpointManager = require('./endpointManager');

/**
 * @constructor
 * @param {object} config An fchat configuration object
 */
const fchat = function(config) {
  var tempProfileData = {};
  var commandFunctionMap = {};

  var endpointManager = null;
  var socket = null;

  var chatops = [];
  var channels = [];
  var characters = [];
  var friends = [];
  var ignoreList = [];
  var serverVariables = {};

  var clientCharacter = '';

  this.getChatops = () => chatops;
  this.getChannels = () => channels;
  this.getCharacters = () => characters;
  this.getFriends = () => friends;
  this.getIgnoreList = () => ignoreList;
  this.getServerVariables = () => serverVariables;
  this.getEndpointManager = () => endpointManager;
  this.getFchatState = () => {
    chatops, channels, characters, friends, ignoreList, serverVariables
  }

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
    endpointManager = new EndpointManager(account, password, config.endpoint);
    clientCharacter = character;

    return endpointManager.requestTicket().then(ticket => {
      const allUrls = config.fchat.urls;
      const url = config.devMode ? allUrls.dev: allUrls.public;
      socket = new ws(url);

      socket.on('open', () => {
        Promise.resolve();

        this.send('IDN', {
          method: 'ticket', 
          account, 
          ticket, 
          character, 
          cname: config.client.name, 
          cversion: config.client.version 
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
    if (config.logging.clientCommands){
      console.log(`>> ${message}`);
    }
    
    socket.send(message);
  }

  var onMessage = (message) => {
    if (config.logging.serverCommands){
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
    characters = characters.filter(char => char!=data.character);
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
      
    if (clientCharacter===characterName){
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
    if (clientCharacter===data.character){
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
    mapCharacterList(data.characters).forEach(char => characters.push(char));
  }

  this.onLRP = (data) => {
    lrpCallback(data.character, data.message, data.channel);
  }

  this.onMSG = (data) => {
    msgCallback(data.character, data.message, data.channel);
  }

  this.onNLN = (data) => {
    if (data.identity===clientCharacter){
      lisCallback(characters);
    }else {
      data.statusmsg = '';
      data.typing = 'clear';
      characters.push(data);
    }

    nlnCallback(data.identity, data.gender, data.status);
  }

  this.onORS = (data) => {
    orsCallback(data.channels);
  }

  this.onPIN = (unused) => {
    if (config.autoPing){
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

  var mapCharacterList = (characters) => {
    return characters.map(data => {
      return {
        status: data[2],
        identity: data[0],
        gender:  data[1],
        statusmsg: data[3],
        typing: 'clear'
      }
    });
  }

  var findCharacter = (character) => {
    return characters.find(char => char.identity===character);
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
   * @description Requests that the specified character be banned from the server, an abstraction of the ACB client command (requires chat op or higher)
   * @param {string} character The name of the desired character 
   * @instance
   */
  this.serverBan = (character) => this.send('ACB', { character });

  /**
   * @function promoteChatop
   * @memberof fchat
   * @description Requests that the specified character be promoted to chat op, an abstraction of the AOP client command (admin only)
   * @param {string} character The name of the desired character
   * @instance
   */
  this.promoteChatop = (character) => this.send('AOP', { character });

  this.requestAlts = (character) => this.send('AWC', { character });
  this.broadcast = (message) => this.send('BRO', { message });
  this.requestChannelBanlist = (channel) => this.send('CBL', { channel });
  this.channelBan = (character, channel) => this.send('CBU', { character, channel });
  this.createPrivateChannel = (channel) => this.send('CCR', { channel });
  this.setChannelDescription = (channel, description) => this.send('CDS', { channel, description });
  this.requestPublicChannels = () => this.send('CHA', null);
  this.sendChannelInvite = (channel, character) => this.send('CIU', { channel, character });
  this.channelKick = (channel, character) => this.send('CKU', { channel, character });
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
  this.setTypingStatus = (status) => this.send('TPN', { character: clientCharacter, status });
  this.serverUnban = (character) => this.send('UNB', { character });
  this.requestStats = () => this.send('UPT', null);






  /**
   * This callback type is called `requestCallback` and is displayed as a global symbol.
   *
   * @callback chatopsCallback
   * @param {array} chatops An array of chatops
   */
  /**
   * @function onChatopsReceived
   * @memberof fchat
   * @description Receives a list of chatops from the server
   * @param {chatopsCallback} callback Callback which returns a list of chatops whenever they are received from the server by the ADL command
   * @instance
   */
  this.onChatopsReceived = (func) => adlCallback = func;
  var adlCallback = (chatops) => {}

  var aopCallback = (chatop) => {}
  this.onChatopPromoted = (func) => aopCallback = func;

  var broCallback = (message) => {}
  this.onBroadcast = (func) => broCallback = func;

  var cdsCallback = (channel, description) => {}
  this.onChannelDescription = (func) => cdsCallback = func;

  /**
   * @callback channelsCallback
   * @param {array} channels An array of channels
   */
  /**
   * @function onPublicChannelsReceived
   * @memberof fchat
   * @description Receives a list of public channels from the server
   * @param {channelsCallback} callback Callback which returns a list of channels whenever they are received from the server by the CHA command
   * @instance
   */
  this.onPublicChannelsReceived = (func) => chaCallback = func;
  var chaCallback = (channels) => {}

  var ciuCallback = (sender, title, name) =>  {}
  this.onChannelInviteReceived = (func) => ciuCallback = func;
  
  var cbuCallback = (operator, channel, character) => {}
  this.onChannelBan = (func) => cbuCallback = func;

  var ckuCallback = (operator, channel, character) => {}
  this.onChannelKick = (func) => ckuCallback = func;

  var coaCallback = (character, channel) => {}
  this.onChanopPromoted = (func) => coaCallback = func;

  var colCallback = (channel, oplist) => {}
  this.onChanopsReceived = (func) => colCallback = func;

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