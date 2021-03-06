import AlexaSkill from './AlexaSkill.js';
const AWS = require('aws-sdk');
const moment = require('moment');
const dynamodb = new AWS.DynamoDB();

function isValidNumber (phoneNumber) {
  // TODO: replace this with googLibPhoneNumber
  return phoneNumber && phoneNumber.length > 6;
}

function phoneNumberAsWords (phoneNumber) {
  return phoneNumber.split('').join(' ');
}

export default class Reminder extends AlexaSkill {
  static get slots () {
    return ['reminder', 'duration', 'day', 'time', 'phoneNumber'];
  }

  // ***************************
  // Static Properties
  // ***************************

  get eventHandlers () {
    const parentEventHandlers = super.eventHandlers;
    parentEventHandlers.onSessionStarted = (sessionStartedRequest, session) => {
      console.log(`onSessionStarted requestId: ${sessionStartedRequest.requestId}, sessionId: ${session.sessionId}`);
    };

    parentEventHandlers.onLaunch = (launchRequest, session, response) => {
      this.handleLaunchRequest(launchRequest, session, response);
    };

    parentEventHandlers.onSessionEnded = (sessionEndedRequest, session) => {
      console.log(`onSessionEnded requestId: ${sessionEndedRequest.requestId}, sessionId: ${session.sessionId}`);
    };

    return parentEventHandlers;
  }

  get intentHandlers () {
    return {
      RemindMe: this.handleNewReminderRequest.bind(this),

      CheckMy: this.handlePhoneNumberCheckRequest.bind(this),
      WhatIs: this.handlePhoneNumberCheckRequest.bind(this),

      ChangeMy: this.handlePhoneNumberChangeRequest.bind(this),
      UpdateMy: this.handlePhoneNumberChangeRequest.bind(this),

      'AMAZON.HelpIntent' (request, session, response) {
        response.ask('You can say "RemindMe at 10pm to wash the car."', 'What can I help you with?');
      },

      'AMAZON.StopIntent' (request, session, response) {
        response.tell('Your Reminder was canceled');
      },

      'AMAZON.CancelIntent' (request, session, response) {
        response.tell('Your Reminder was canceled');
      }
    };
  }

  // ***************************
  // End Static Properties
  // ***************************

  // ***************************
  // Utilities
  // ***************************

  // parses slot values out of request into an `action` for easier access
  // and saves slot values to session attributes
  getAction (request, session, slots) {
    const action = {};
    slots.forEach(function (slotKey) {
      const slot = request.intent.slots[slotKey];
      if (slot && slot.value && slot.value !== '?') {
        action[slotKey] = slot.value;
      } else {
        action[slotKey] = session.attributes[slotKey];
      }
    });
    session.attributes.timestamp = action.timestamp = request.timestamp;
    action.locale = request.locale;
    action.requestId = request.requestId;
    slots.forEach(function (slotKey) {
      session.attributes[slotKey] = action[slotKey];
    });
    return action;
  }

  // from an `action` compute duration depending on provided slot values
  // returns Moment::Duration
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

  // Reusable function for asking for a phone number
  respondForPhoneNumber (response, short) {
    const responseText = `I'll need your phone number to send you reminders. You'll only have to tell me once. What number should I use for sending reminders?`;
    const shortResponse = `What phone number should I use for sending you reminders?`;
    if (short) {
      return response.ask(shortResponse, shortResponse);
    }
    response.ask(responseText, shortResponse);
  }

  // ***************************
  // End Utilities
  // ***************************

  // Intent Handler (built in): Launch
  handleLaunchRequest (launchRequest, session, response) {
    console.log('Handling launch request');
    this.lookupPhoneNumber(session)
      .then((phoneNumber) => {
        if (phoneNumber) {
          session.attributes.phoneNumber = phoneNumber;
          response.ask('Hello. I already have a reminder number stored for you. I can set a reminder for you, or update your information.');
        } else {
          this.respondForPhoneNumber(response);
        }
      })
      .catch((err) => {
        console.log(err, err.stack); // an error occurred
        response.tell('Sorry, there was an error finding your information.');
      });
  }

  // ***************************
  // Intent Handler: RemindMe
  //     Complex intent - see utterances
  // ***************************
  handleNewReminderRequest (intent, session, response) {
    const action = this.getAction(intent, session, Reminder.slots);
    console.log('Handling new reminder request to: ', action.reminder, action.duration, action.time, action.day, action.phoneNumber);

    this.handleReminderPhoneNumber({ intent, session, response, action })
      .then(() => {
        this.handleReminderEvent({ intent, session, response, action });
      })
      .catch((err) => {
        console.log(err, err.stack); // an error occurred
        response.tell('Sorry, sending the reminder failed.');
      });
  }

  handleReminderPhoneNumber ({ intent, session, response, action }) {
    if (action.phoneNumber) {
      return this.writePhoneNumber({ intent, session, response, action })
        .catch('InvalidPhoneNumber', (e) => {
          response.tell('Sorry, that phone number is invalid.');
          throw e;
        });
    }

    return this.lookupPhoneNumber(session)
      .then((phoneNumber) => {
        if (!phoneNumber) {
          return this.respondForPhoneNumber(response);
        }
        action.phoneNumber = session.attributes.phoneNumber = phoneNumber;
      });
  }

  handleReminderEvent ({intent, session, response, action}) {
    if (!action.duration && !action.day && !action.time) {
      const speechOutput = {
        speech: '<speak>When would you like to be reminded?</speak>',
        type: AlexaSkill.speechOutputType.SSML
      };

      response.ask(speechOutput, speechOutput);
      return;
    }

    if (!action.reminder) {
      const reminderPrompt = 'What should I remind you to do?';
      const reminderOutput = {
        speech: reminderPrompt,
        type: AlexaSkill.speechOutputType.PLAIN_TEXT
      };

      response.ask(reminderOutput, reminderOutput);
      return;
    }

    this.createReminderRecord(session, action)
      .then(() => {
        const duration = this.computeDuration(action);
        const done = `Your reminder to ${action.reminder} is set for ${duration.humanize()} from now.`;
        response.tell(done);
      })
      .catch((e) => {
        console.log('Error creating reminder record', e);
        response.tell('Sorry, sending the reminder failed.');
      });
  }

  // ***************************
  // End RemindMe Intent Core
  // ***************************

  // Intent handler:  (CheckMy|WhatIsMy) phone number?
  handlePhoneNumberCheckRequest (intent, session, response) {
    console.log('Handling phone number check request');
    this.lookupPhoneNumber(session)
      .then((phoneNumber) => {
        if (phoneNumber) {
          response.tell(`The number I have saved for sending you reminders is ${phoneNumberAsWords(phoneNumber)}.`);
        } else {
          response.tell(`I do not yet have a phone number saved for you. You can set one by saying "Update My phone number" or by setting a reminder.`);
        }
      })
      .catch((err) => {
        console.log(err, err.stack); // an error occurred
        response.tell('Sorry, there was an error finding your information.');
      });
  }

  // Intent handler: (ChangeMy|UpdateMy) [phone ]number[ to {phoneNumber}]
  handlePhoneNumberChangeRequest (request, session, response) {
    const action = this.getAction(request, session, Reminder.slots);
    console.log('Handling new phone number change request to: ', action.phoneNumber);

    if (action.phoneNumber) {
      return this.writePhoneNumber({ session, action })
        .then(() => {
          response.tell(`I've updated your reminder phone number to ${phoneNumberAsWords(action.phoneNumber)}.`);
        })
        .catch((e) => {
          response.tell('Uh oh. something went wrong');
          throw e;
        });
    }

    return this.respondForPhoneNumber(response, true);
  }

  // ***************************
  // Dyamo helpers
  // ***************************

  writePhoneNumber ({session, action}) {
    if (!isValidNumber(action.phoneNumber)) {
      const e = new Error('InvalidPhoneNumber');
      e.details = action.phoneNumber;
      console.log(e);
      return Promise.reject(e);
    }

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

    return new Promise((resolve, reject) => {
      dynamodb.putItem(params, (err, data) => {
        if (err) {
          return reject(err);
        }
        return resolve();
      });
    });
  }

  lookupPhoneNumber (session) {
    if (session.attributes.phoneNumber && isValidNumber(session.attributes.phoneNumber)) {
      return Promise.resolve(session.attributes.phoneNumber);
    }
    const params = {
      Key: {
        'userId': {
          S: session.user.userId
        }
      },
      TableName: 'RemindMeNumbers'
    };

    return new Promise((resolve, reject) => {
      dynamodb.getItem(params, (err, data) => {
        if (err) {
          return reject(err);
        }
        console.log('Pulled user from dynamo', data);
        return resolve(data.Item && data.Item.phoneNumber && data.Item.phoneNumber.S);
      });
    });
  }

  createReminderRecord (session, action) {
    const duration = this.computeDuration(action);
    const init = moment(action.timestamp);
    const ttl = init.add(duration.asSeconds(), 'seconds').toISOString();
    const params = {
      Item: {
        reminderId: {
          S: action.requestId
        },
        userId: {
          S: session.user.userId
        },
        ttl: {
          S: ttl
        },
        reminder: {
          S: action.reminder
        }
      },
      TableName: 'RemindMeReminders'
    };
    console.log('creating reminder record', params);

    return new Promise((resolve, reject) => {
      dynamodb.putItem(params, (err, data) => {
        if (err) {
          return reject(err);
        }
        return resolve();
      });
    });
  }

  // ***************************
  // End Dyamo helpers
  // ***************************

  // TODO: this will actually move into a different lambda, alexa-remindme-process
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
