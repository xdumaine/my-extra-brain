import Response from './Response.js';

export default class AlexaSkill {
  constructor (appId) {
    this._appId = appId;
  }

  static get speechOutputType () {
    return {
      PLAIN_TEXT: 'PlainText',
      SSML: 'SSML'
    };
  }

  get requestHandlers () {
    return {
      LaunchRequest (event, context, response) {
        this.eventHandlers.onLaunch.call(this, event.request, event.session, response);
      },

      IntentRequest (event, context, response) {
        this.eventHandlers.onIntent.call(this, event.request, event.session, response);
      },

      SessionEndedRequest (event, context, response) {
        this.eventHandlers.onSessionEnded(event.request, event.session);
        context.succeed();
      }
    };
  }

  get eventHandlers () {
    return {
      /**
      * Called when the session starts.
      * Subclasses could have overriden this function to open any necessary resources.
      */
      onSessionStarted () {},

      /**
      * Called when the user invokes the skill without specifying what they want.
      * The subclass must override this function and provide feedback to the user.
      */
      onLaunch () {
        throw new Error('onLaunch should be overriden by subClass');
      },

      /**
      * Called when the user specifies an intent.
      */
      onIntent (intentRequest, session, response) {
        const intent = intentRequest.intent;
        const intentName = intent.name;
        const intentHandler = this.intentHandlers[intentName];
        if (intentHandler) {
          console.log('dispatch intent = ' + intentName);
          intentHandler.call(this, intentRequest, session, response);
        } else {
          throw new Error(`Unsupported intent: ${intentName}`);
        }
      },
      onSessionEnded (sessionEndedRequest, session) {}
    };
  }

  get intentHandlers () {
    return {};
  }

  execute (event, context) {
    try {
      console.log('session applicationId: ' + event.session.application.applicationId);

      // Validate that this request originated from authorized source.
      if (this._appId && event.session.application.applicationId !== this._appId) {
        console.log('The applicationIds don\'t match : ' + event.session.application.applicationId + ' and ' + this._appId);
        throw new Error('Invalid applicationId');
      }

      if (!event.session.attributes) {
        event.session.attributes = {};
      }

      if (event.session.new) {
        this.eventHandlers.onSessionStarted(event.request, event.session);
      }

      // Route the request to the proper handler which may have been overriden.
      const requestHandler = this.requestHandlers[event.request.type];
      requestHandler.call(this, event, context, new Response(context, event.session));
    } catch (e) {
      console.log('Unexpected exception ' + e);
      context.fail(e);
    }
  }
}
