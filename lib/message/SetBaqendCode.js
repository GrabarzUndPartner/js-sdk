var Message = require('./Message').Message;
var CommunicationError = require('../error').CommunicationError;

/**
 * Sets the code for an specific class script
 * Replace the specified baqend script code
 * 
 * @class jspa.message.SetBaqendCode
 * @extends jspa.message.Message
 */
exports.SetBaqendCode = Message.inherit(/** @lends jspa.message.SetBaqendCode.prototype */ {

  /**
   * @param bucket {String} The bucket name
   * @param type {String} The handler type of the script
   */
  initialize: function(bucket, type, body) {
    this.superCall('PUT', '/db/code/' + bucket + '/' + type + '', body);
  },

  doReceive: function() {
    if (this.response.statusCode != 200) {
      throw new CommunicationError(this);
    }
  }
});