'use strict';

const CommunicationError = require('../error/CommunicationError');

/**
 * Checks whether the user uses a browser which does support revalidation.
 */
const REVALIDATION_SUPPORTED = typeof navigator === 'undefined' || (typeof chrome !== 'undefined' && /google/i.test(navigator.vendor)) || (/cros i686/i.test(navigator.platform));

/**
 * @typedef {'json'|'text'|'blob'|'buffer'|'arraybuffer'|'data-url'|'form'} EntityType
 */

const RESPONSE_TYPE = Symbol('ResponseType');

/**
 * @alias connector.Message
 */
class Message {
  /**
   * Creates a new message class with the given message specification
   * @param {Object} specification
   * @return {Class<Message>}
   */
  static create(specification) {
    const parts = specification.path.split('?');
    const path = parts[0].split(/[:*]\w*/);

    const query = [];
    if (parts[1]) {
      parts[1].split('&').forEach((arg) => {
        const part = arg.split('=');
        query.push(part[0]);
      });
    }

    specification.dynamic = specification.path.indexOf('*') !== -1;
    specification.path = path;
    specification.query = query;

    return class extends Message {
      get spec() {
        return specification;
      }
    };
  }

  /**
   * Creates a new message class with the given message specification and a full path
   * @param {Object} specification
   * @param {Object} members additional members applied to the created message
   * @return {Class<Message>}
   */
  static createExternal(specification, members) {
    specification.path = [specification.path];

    /**
     * @ignore
     */
    const cls = class extends Message {
      get spec() {
        return specification;
      }
    };

    Object.assign(cls.prototype, members);

    return cls;
  }

  get isBinary() {
    return this.request.type in Message.BINARY || this[RESPONSE_TYPE] in Message.BINARY;
  }

  /**
   * @param {string} arguments... The path arguments
   */
  constructor() {
    /** @type boolean */
    this.withCredentials = false;

    /** @type util.TokenStorage */
    this.tokenStorage = null;

    /** @type connector.Message~progressCallback */
    this.progressCallback = null;

    const args = arguments;
    let index = 0;
    let path = this.spec.path;
    if (Object(path) instanceof Array) {
      path = this.spec.path[0];
      const len = this.spec.path.length;
      for (let i = 1; i < len; i += 1) {
        if (this.spec.dynamic && len - 1 === i) {
          path += args[index].split('/').map(encodeURIComponent).join('/');
        } else {
          path += encodeURIComponent(args[index]) + this.spec.path[i];
        }
        index += 1;
      }
    }

    let query = '';
    for (let i = 0; i < this.spec.query.length; i += 1) {
      const arg = args[index];
      index += 1;
      if (arg !== undefined && arg !== null) {
        query += (query || path.indexOf('?') !== -1) ? '&' : '?';
        query += this.spec.query[i] + '=' + encodeURIComponent(arg);
      }
    }

    this.request = {
      method: this.spec.method,
      path: path + query,
      entity: null,
      headers: {},
    };

    if (args[index]) {
      this.entity(args[index], 'json');
    }

    this.responseType('json');
  }

  /**
   * Gets the request path
   * @return {string} The path of the message value
   * @name path
   * @memberOf connector.Message.prototype
   * @method
   */

  /**
   * Sets the request path
   * @param {string} path The new path value, any query parameters provided with the path will be merged with the
   * exiting query params
   * @return {this} This message object
   */
  path(path) {
    if (path !== undefined) {
      const queryIndex = this.request.path.indexOf('?') + 1;
      this.request.path = path + (queryIndex > 0 ? (path.indexOf('?') > -1 ? '&' : '?') + this.request.path.substring(queryIndex) : '');
      return this;
    }

    return this.request.path;
  }

  /**
   * Gets the value of a the specified request header
   * @param {string} name The header name
   * @return {string} The header value
   * @name header
   * @memberOf connector.Message.prototype
   * @method
   */

  /**
   * Sets the value of a the specified request header
   * @param {string} name The header name
   * @param {string} value The header value if omitted the value will be returned
   * @return {this} This message object
   */
  header(name, value) {
    if (value !== undefined) {
      this.request.headers[name] = value;
      return this;
    }

    return this.request.headers[name];
  }

  /**
   * Sets the entity type
   * @param {*} data The data to send
   * @param {EntityType} [type="json"] the type of the data one of 'json'|'text'|'blob'|'arraybuffer' defaults to 'json'
   * @return {this} This message object
   */
  entity(data, type) {
    let requestType = type;
    if (!requestType) {
      if (typeof data === 'string') {
        if (/^data:(.+?)(;base64)?,.*$/.test(data)) {
          requestType = 'data-url';
        } else {
          requestType = 'text';
        }
      } else if (typeof Blob !== 'undefined' && data instanceof Blob) {
        requestType = 'blob';
      } else if (typeof Buffer !== 'undefined' && data instanceof Buffer) {
        requestType = 'buffer';
      } else if (typeof ArrayBuffer !== 'undefined' && data instanceof ArrayBuffer) {
        requestType = 'arraybuffer';
      } else if (typeof FormData !== 'undefined' && data instanceof FormData) {
        requestType = 'form';
      } else {
        requestType = 'json';
      }
    }

    this.request.type = requestType;
    this.request.entity = data;
    return this;
  }

  /**
   * Get the mimeType
   * @return {string} This message object
   * @name mimeType
   * @memberOf connector.Message.prototype
   * @method
   */

  /**
   * Sets the mimeType
   * @param {string} mimeType the mimeType of the data
   * @return {this} This message object
   */
  mimeType(mimeType) {
    return this.header('content-type', mimeType);
  }

  /**
   * Gets the contentLength
   * @return {number}
   * @name contentLength
   * @memberOf connector.Message.prototype
   * @method
   */

  /**
   * Sets the contentLength
   * @param {number} contentLength the content length of the data
   * @return {this} This message object
   */
  contentLength(contentLength) {
    return this.header('content-length', contentLength);
  }

  /**
   * Gets the request conditional If-Match header
   * @return {string} This message object
   * @name ifMatch
   * @memberOf connector.Message.prototype
   * @method
   */

  /**
   * Sets the request conditional If-Match header
   * @param {string} eTag the If-Match ETag value
   * @return {this} This message object
   */
  ifMatch(eTag) {
    return this.header('If-Match', this.formatETag(eTag));
  }

  /**
   * Gets the request a ETag based conditional header
   * @return {string}
   * @name ifNoneMatch
   * @memberOf connector.Message.prototype
   * @method
   */

  /**
   * Sets the request a ETag based conditional header
   * @param {string} eTag The ETag value
   * @return {this} This message object
   */
  ifNoneMatch(eTag) {
    return this.header('If-None-Match', this.formatETag(eTag));
  }

  /**
   * Gets the request date based conditional header
   * @return {string} This message object
   * @name ifUnmodifiedSince
   * @memberOf connector.Message.prototype
   * @method
   */

  /**
   * Sets the request date based conditional header
   * @param {Date} date The date value
   * @return {this} This message object
   */
  ifUnmodifiedSince(date) {
    // IE 10 returns UTC strings and not an RFC-1123 GMT date string
    return this.header('if-unmodified-since', date && date.toUTCString().replace('UTC', 'GMT'));
  }

  /**
   * Indicates that the request should not be served by a local cache
   * @return {this}
   */
  noCache() {
    if (!REVALIDATION_SUPPORTED) {
      this.ifMatch('') // is needed for firefox or safari (but forbidden for chrome)
        .ifNoneMatch('-'); // is needed for edge and ie (but forbidden for chrome)
    }

    return this.cacheControl('max-age=0, no-cache');
  }

  /**
   * Gets the cache control header
   * @return {string}
   * @name cacheControl
   * @memberOf connector.Message.prototype
   * @method
   */

  /**
   * Sets the cache control header
   * @param {string} value The cache control flags
   * @return {this} This message object
   */
  cacheControl(value) {
    return this.header('cache-control', value);
  }

  /**
   * Gets the ACL of a file into the Baqend-Acl header
   * @return {string} This message object
   * @name acl
   * @memberOf connector.Message.prototype
   * @method
   */

  /**
   * Sets and encodes the ACL of a file into the Baqend-Acl header
   * @param {Acl} acl the file ACLs
   * @return {this} This message object
   */
  acl(acl) {
    return this.header('baqend-acl', acl && JSON.stringify(acl));
  }

  /**
   * Gets and encodes the custom headers of a file into the Baqend-Custom-Headers header
   * @return {string} This message object
   * @name customHeaders
   * @memberOf connector.Message.prototype
   * @method
   */

  /**
   * Sets and encodes the custom headers of a file into the Baqend-Custom-Headers header
   * @param {*} customHeaders the file custom headers
   * @return {this} This message object
   */
  customHeaders(customHeaders) {
    return this.header('baqend-custom-headers', customHeaders && JSON.stringify(customHeaders));
  }

  /**
   * Gets the request accept header
   * @return {string} This message object
   * @name accept
   * @memberOf connector.Message.prototype
   * @method
   */

  /**
   * Sets the request accept header
   * @param {string} accept the accept header value
   * @return {this} This message object
   */
  accept(accept) {
    return this.header('accept', accept);
  }

  /**
   * Gets the response type which should be returned
   * @return {string} This message object
   * @name responseType
   * @memberOf connector.Message.prototype
   * @method
   */

  /**
   * Sets the response type which should be returned
   * @param {string} type The response type one of 'json'|'text'|'blob'|'arraybuffer' defaults to 'json'
   * @return {this} This message object
   */
  responseType(type) {
    if (type !== undefined) {
      this[RESPONSE_TYPE] = type;
      return this;
    }

    return this[RESPONSE_TYPE];
  }

  /**
   * Gets the progress callback
   * @return {connector.Message~progressCallback} The callback set
   * @name progress
   * @memberOf connector.Message.prototype
   * @method
   */

  /**
   * Sets the progress callback
   * @param {connector.Message~progressCallback} callback
   * @return {this} This message object
   */
  progress(callback) {
    if (callback !== undefined) {
      this.progressCallback = callback;
      return this;
    }

    return this.progressCallback;
  }

  /**
   * Adds the given string to the request path
   *
   * If the parameter is an object, it will be serialized as a query string.
   *
   * @param {string|Object<string,string>} query which will added to the request path
   * @return {this}
   */
  addQueryString(query) {
    if (Object(query) instanceof String) {
      this.request.path += query;
      return this;
    }

    if (query) {
      let sep = this.request.path.indexOf('?') >= 0 ? '&' : '?';
      Object.keys(query).forEach((key) => {
        this.request.path += sep + key + '=' + encodeURIComponent(query[key]);
        sep = '&';
      });
    }

    return this;
  }

  formatETag(eTag) {
    let tag = eTag;
    if (tag && tag !== '*') {
      tag = '' + tag;
      if (tag.indexOf('"') === -1) {
        tag = '"' + tag + '"';
      }
    }

    return tag;
  }

  /**
   * Handle the receive
   * @param {Object} response The received response headers and data
   * @return {void}
   */
  doReceive(response) {
    if (this.spec.status.indexOf(response.status) === -1) {
      throw new CommunicationError(this, response);
    }
  }
}

/**
 * The message specification
 * @name spec
 * @memberOf connector.Message.prototype
 * @type {Object}
 */

Object.assign(Message, {
  /**
   * @alias connector.Message.StatusCode
   * @enum {number}
   */
  StatusCode: {
    NOT_MODIFIED: 304,
    BAD_CREDENTIALS: 460,
    BUCKET_NOT_FOUND: 461,
    INVALID_PERMISSION_MODIFICATION: 462,
    INVALID_TYPE_VALUE: 463,
    OBJECT_NOT_FOUND: 404,
    OBJECT_OUT_OF_DATE: 412,
    PERMISSION_DENIED: 466,
    QUERY_DISPOSED: 467,
    QUERY_NOT_SUPPORTED: 468,
    SCHEMA_NOT_COMPATIBLE: 469,
    SCHEMA_STILL_EXISTS: 470,
    SYNTAX_ERROR: 471,
    TRANSACTION_INACTIVE: 472,
    TYPE_ALREADY_EXISTS: 473,
    TYPE_STILL_REFERENCED: 474,
    SCRIPT_ABORTION: 475,
  },

  BINARY: {
    blob: true,
    buffer: true,
    stream: true,
    arraybuffer: true,
    'data-url': true,
    base64: true,
  },

  GoogleOAuth: Message.createExternal({
    method: 'OAUTH',
    path: 'https://accounts.google.com/o/oauth2/auth?response_type=code&access_type=online',
    query: ['client_id', 'scope', 'state'],
    status: [200],
  }, {
    addRedirectOrigin(baseUri) {
      this.addQueryString({
        redirect_uri: baseUri + '/db/User/OAuth/google',
      });
    },
  }),

  FacebookOAuth: Message.createExternal({
    method: 'OAUTH',
    path: 'https://www.facebook.com/v7.0/dialog/oauth?response_type=code',
    query: ['client_id', 'scope', 'state'],
    status: [200],
  }, {
    addRedirectOrigin(baseUri) {
      this.addQueryString({
        redirect_uri: baseUri + '/db/User/OAuth/facebook',
      });
    },
  }),

  GitHubOAuth: Message.createExternal({
    method: 'OAUTH',
    path: 'https://github.com/login/oauth/authorize?response_type=code&access_type=online',
    query: ['client_id', 'scope', 'state'],
    status: [200],
  }, {
    addRedirectOrigin(baseUri) {
      this.addQueryString({
        redirect_uri: baseUri + '/db/User/OAuth/github',
      });
    },
  }),

  LinkedInOAuth: Message.createExternal({
    method: 'OAUTH',
    path: 'https://www.linkedin.com/oauth/v2/authorization?response_type=code',
    query: ['client_id', 'scope', 'state'],
    status: [200],
  }, {
    addRedirectOrigin(baseUri) {
      this.addQueryString({
        redirect_uri: baseUri + '/db/User/OAuth/linkedin',
      });
    },
  }),

  TwitterOAuth: Message.createExternal({
    method: 'OAUTH',
    path: '',
    query: [],
    status: [200],
  }, {
    addRedirectOrigin(baseUri) {
      this.request.path = baseUri + '/db/User/OAuth1/twitter';
    },
  }),

  SalesforceOAuth: Message.createExternal({
    method: 'OAUTH',
    path: '',
    query: ['client_id', 'scope', 'state'],
    status: [200],
  }, {
    addRedirectOrigin(baseUri) {
      this.addQueryString({
        redirect_uri: baseUri + '/db/User/OAuth/salesforce',
      });
    },
  }),
});

module.exports = Message;


/**
 * The progress callback is called, when you send a message to the server and a progress is noticed
 * @callback connector.Message~progressCallback
 * @param {ProgressEvent} event The Progress Event
 * @return {*} unused
 */
