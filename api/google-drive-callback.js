const googleDriveHandler = require('./google-drive');

module.exports = async function handler(request, response) {
  request.query = { ...(request.query ?? {}), action: 'callback' };
  return googleDriveHandler(request, response);
};

