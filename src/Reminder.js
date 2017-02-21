import AlexaSkill from './AlexaSkill.js';
const AWS = require('aws-sdk');
const moment = require('moment');

export default class Reminder extends AlexaSkill {
  static get slots () {
    return ['reminder', 'duration', 'day', 'time'];
  }

  get eventHandlers () {
    const parentEventHandlers = super.eventHandlers;
    parentEventHandlers.onSessionStarted = (sessionStartedRequest, session) => {
      console.log(`onSessionStarted requestId: ${sessionStartedRequest.requestId}, sessionId: ${session.sessionId}`);
    };

    parentEventHandlers.onLaunch = (launchRequest, session, response) => {
      console.log(`onLuanch requestId: ${launchRequest.requestId}, sessionId: ${session.sessionId}`);
    };

    parentEventHandlers.onSessionEnded = (sessionEndedRequest, session) => {
      console.log(`onSessionEnded requestId: ${sessionEndedRequest.requestId}, sessionId: ${session.sessionId}`);
    };

    return parentEventHandlers;
  }

  get intentHandlers () {
    return {
      RemindMe (intent, session, response) {
        this.handleNewReminderRequest(intent, session, response);
      },

      'AMAZON.HelpIntent' (intent, session, response) {
        response.ask('You can say "RemindMe at 10pm to wash the car."', 'What can I help you with?');
      },

      'AMAZON.StopIntent' (intent, session, response) {
        response.tell('Your Reminder was canceled');
      },

      'AMAZON.CancelIntent' (intent, session, response) {
        response.tell('Your Reminder was canceled');
      }
    };
  }

  getAction (intent, session, properties) {
    const action = {};
    properties.forEach(function (property) {
      if (intent.slots[property]) {
        action[property] = intent.slots[property].value;
      } else {
        action[property] = session.attributes[property];
      }
    });
    return action;
  }

  handleNewReminderRequest (intent, session, response) {
    const action = this.getAction(intent, session, Reminder.slots);

    console.log('Handling new reminder request to', action.reminder, action.duration, action.time, action.day);

    if (!action.duration && !action.day && !action.time) {
      const speechOutput = {
        speech: '<speak>When would you like to be reminded?</speak>',
        type: AlexaSkill.speechOutputType.SSML
      };

      response.ask(speechOutput, speechOutput);
      return;
    }

    Reminder.slots.forEach(function (property) {
      session.attributes[property] = action[property];
    });

    if (!action.reminder) {
      var reminderPrompt = 'What should I remind you to do?';
      var reminderOutput = {
        speech: reminderPrompt,
        type: AlexaSkill.speechOutputType.PLAIN_TEXT
      };

      response.ask(reminderOutput, reminderOutput);
      return;
    }

    let time = '';
    if (action.time) {
      time = action.time;
      if (action.day) {
        time += ' on ' + action.day;
      }
    } else if (action.day) {
      time = action.day;
    } else if (action.duration) {
      time = `${moment.duration(action.duration).humanize()} from now`
    }
    const done = `Your reminder to ${action.reminder} is set for ${time}.`;

    var params = {
      Message: `RemindMe: "${action.reminder}" for ${moment.duration(action.duration).humanize()} from now`,
      PhoneNumber: '+17408565809'
    };
    var sns = new AWS.SNS();
    sns.publish(params, function (err, data) {
      if (err) {
        console.log(err);
        response.tell('Sorry, sending the reminder failed.');
      } else {
        response.tell(done);
      }
    });
  }
}