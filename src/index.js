import Reminder from './Reminder.js';

/**
* App ID for the skill
*/
var APP_ID = undefined; //eslint-disable-line

// Create the handler that responds to the Alexa Request.
exports.handler = function (event, context) {
  var reminder = new Reminder(APP_ID);
  reminder.execute(event, context);
};

exports.Reminder = Reminder;
