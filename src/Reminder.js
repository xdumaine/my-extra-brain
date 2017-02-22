import AlexaSkill from './AlexaSkill.js';
const AWS = require('aws-sdk');
const moment = require('moment');
const dynamodb = new AWS.DynamoDB();

export default class Reminder extends AlexaSkill {
  static get slots () {
    return ['reminder', 'duration', 'day', 'time', 'phoneNumber'];
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
      if (intent.slots[property] && intent.slots[property].value) {
        action[property] = intent.slots[property].value;
      } else {
        action[property] = session.attributes[property];
      }
    });
    return action;
  }

  handleNewReminderRequest (intent, session, response) {
    const action = this.getAction(intent, session, Reminder.slots);

    console.log('Handling new reminder request to: ', action.reminder, action.duration, action.time, action.day, action.phoneNumber);

    Reminder.slots.forEach(function (property) {
      session.attributes[property] = action[property];
    });

    if (action.phoneNumber) {
      return this.writePhoneNumber({ intent, session, response, action });
    }

    this.lookupPhoneNumber({ intent, session, response, action });
  }

  writePhoneNumber ({intent, session, response, action}) {
    const params = {
      Item: {
        userId: {
          S: session.user.userId
        },
        phoneNumber: {
          S: action.phoneNumber
        }
      },
      TableName: 'RemindMeNumbers'
    };

    dynamodb.putItem(params, (err, data) => {
      if (err) {
        console.log(err, err.stack); // an error occurred
        response.tell('Sorry, sending the reminder failed.');
        return;
      }

      this.continueRequest({ intent, session, response, action });
    });
  }

  lookupPhoneNumber ({intent, session, response, action}) {
    const params = {
      Key: {
        'userId': {
          S: session.user.userId
        }
      },
      TableName: 'RemindMeNumbers'
    };

    dynamodb.getItem(params, (err, data) => {
      if (err) {
        console.log(err, err.stack); // an error occurred
        response.tell('Sorry, sending the reminder failed.');
        return;
      }
      console.log('Pulled user from dynamo', data);
      if (!data.Item) {
        return this.respondForPhoneNumber({ intent, session, response, action });
      }
      action.phoneNumber = session.attributes.phoneNumber = data.Item.phoneNumber.S;

      this.continueRequest({ intent, session, response, action });
    });
  }

  respondForPhoneNumber ({intent, session, response, action}) {
    const responseText = `I'll need your phone number to send you reminders. You'll only have to tell me once. What number should I use for sending reminders?`;
    const shortResponse = `What phone number should I use for sending you reminders?`;
    response.ask(responseText, shortResponse);
  }

  continueRequest ({intent, session, response, action}) {
    if (!action.duration && !action.day && !action.time) {
      const speechOutput = {
        speech: '<speak>When would you like to be reminded?</speak>',
        type: AlexaSkill.speechOutputType.SSML
      };

      response.ask(speechOutput, speechOutput);
      return;
    }

    if (!action.reminder) {
      var reminderPrompt = 'What should I remind you to do?';
      var reminderOutput = {
        speech: reminderPrompt,
        type: AlexaSkill.speechOutputType.PLAIN_TEXT
      };

      response.ask(reminderOutput, reminderOutput);
      return;
    }

    this.sendMessage({action, response});
  }

  computeDuration (action) {
    if (action.duration) {
      return moment.duration(action.duration);
    }
    let time;
    if (action.day) {
      if (!action.time) {
        action.time = moment().format('HH:mm');
      }
      time = moment(`${action.day} ${action.time}`);
    } else if (action.time) {
      time = moment(action.time, 'HH:mm');
      if (time < moment()) {
        time.add(1, 'days');
      }
    }
    return moment.duration(moment().diff(time));
  }

  sendMessage ({action, response}) {
    const duration = this.computeDuration(action);
    const durationString = `${duration.humanize()} from now`;

    const done = `Your reminder to ${action.reminder} is set for ${durationString}.`;
    const params = {
      Message: `RemindMe: "${action.reminder}" for ${durationString} from now.`,
      PhoneNumber: '+17408565809'
    };
    const sns = new AWS.SNS();
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
