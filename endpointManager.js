const fetch = require('node-fetch');
const { URLSearchParams } = require('url');

module.exports = function(account, password, config) {
  this.account = account;
  this.password = password;
  this.config = config;
  this.pendingTicketRefresh = null;
  this.ticket = null;

  //Returns the current ticket, no updates or refreshes. Mostly useful for logging
  this.getCurrentTicket = () => {
    return this.ticket;
  }

  //Sends a POST request to the specified url with a json payload
  this.sendPOST = (url, json) => {
    const form = new URLSearchParams();
    Object.keys(json).forEach(key => {
      form.append(key, json[key]);
    });

    return fetch(url, { 
      method: 'POST', 
      body: form
    }).then(res => res.json());
  }

  //Gets a refreshed ticket, returning the current ticket if it has not expired and retrieving a new one if it has
  this.getRefreshedTicket = () => {
    if (!this.pendingTicketRefresh){
      this.pendingTicketRefresh = new Promise((resolve, reject) => {
        this.pendingTicketRefresh = null;
        
        if (this.ticketTimestamp && this.getUnixTime() < this.ticketTimestamp + this.config.ticketExpirationInterval){
          resolve(this.ticket);
        }else {
          this.requestTicket().then(ticket => {
            resolve(ticket);
          }).catch(err => {
            reject(err);
          });
        }
      });
    }

    return this.pendingTicketRefresh;
  }

  //Requests a ticket and a response which includes characters, friends, and bookmarks
  this.requestFullTicket = () => {
    return this.generalTicketRequest({
      account: this.account,
      password: this.password
    });
  }

  //Requests a ticket with no additional data
  this.requestTicket = () => {
    return this.generalTicketRequest({
      account: this.account,
      password: this.password,
      no_characters: true, 
      no_friends: true, 
      no_bookmarks: true
    }).then(res => res.ticket);
  }

  //Method which actually makes the POSTs for ticket requests
  //Returns a promise which either resolves with the appropriate data or rejects with an error
  this.generalTicketRequest = (json) => {
    const FALLBACK_ERR = 'Unable to parse ticket response';
    const url = this.config.ticketUrl;

    return this.sendPOST(url, json).then(res => {
      if (res.ticket){
        this.ticket = res.ticket;
        this.ticketTimestamp = this.getUnixTime();
        return Promise.resolve(res);
      }
      
      return Promise.reject(res.error ? res.error : FALLBACK_ERR);
    });
  }

  //Request builder for API endpoints
  //Accepts an endpoint name which cooresponds to a url, the json body of the request, and a boolean to indicate whether or not the request should include account and ticket credentials
  this.sendBasicApiRequest = (endpointName, json, ticketRequired) => {
    const url = this.config.apiBaseUrl + this.config.api[endpointName];

    if (ticketRequired){
      return this.getRefreshedTicket()
      .then(ticket => {
        json.account = this.account;
        json.ticket = ticket;
        return this.sendPOST(url, json);
      });
    }

    return this.sendPOST(url, json);
  }

  this.requestBookmarkAdd = (name) => this.sendBasicApiRequest('bookmarkAdd', { name }, true);
  this.requestBookmarkList = (name) => this.sendBasicApiRequest('bookmarkList', {}, true);
  this.requestBookmarkRemove = (name) => this.sendBasicApiRequest('bookmarkRemove', { name }, true);

  this.requestCharacterData = (name) => this.sendBasicApiRequest('characterData', { name }, true);
  this.requestCharacterList = () => this.sendBasicApiRequest('characterList', {}, true);
  this.requestGroupList = () => this.sendBasicApiRequest('groupList', {}, true);
  this.requestIgnoreList = () => this.sendBasicApiRequest('ignoreList', {}, true);
  this.requestKinkList = () => this.sendBasicApiRequest('kinkList', {}, false);
  this.requestMappingList = () => this.sendBasicApiRequest('mappingList', {}, false);

  this.listFriends = () => this.sendBasicApiRequest('friendList', {}, true);
  this.removeFriend = (source_name, dest_name) => this.sendBasicApiRequest('friendRemove', { source_name, dest_name }, true);
  this.acceptFriendRequest = (request_id) => this.sendBasicApiRequest('requestAccept', { request_id }, true);
  this.cancelFriendRequest = (request_id) => this.sendBasicApiRequest('requestCancel', { request_id }, true);
  this.denyFriendRequest = (request_id) => this.sendBasicApiRequest('requestDeny', { request_id }, true);
  this.listFriendRequests = () => this.sendBasicApiRequest('requestList', {}, true);
  this.listPendingFriendRequests = () => this.sendBasicApiRequest('requestPending', {}, true);
  this.sendFriendRequest = (source_name, dest_name) => this.sendBasicApiRequest('requestSend', { source_name, dest_name }, true);

  this.requestChatSearchFields = () => {
    return this.getRefreshedTicket()
    .then(ticket => {
      return this.sendPOST(this.config.chatSearchFieldsUrl, {
        account: this.account,
        ticket
      });
    });
  }

  this.getUnixTime = () => {
    return Math.floor(Date.now() / 1000);
  }
}