export default class Response {
  constructor (context, session) {
    this._context = context;
    this._session = session;
  }

  static createSpeechObject (optionsParam) {
    if (optionsParam && optionsParam.type === 'SSML') {
      return {
        type: optionsParam.type,
        ssml: optionsParam.speech
      };
    } else {
      return {
        type: optionsParam.type || 'PlainText',
        text: optionsParam.speech || optionsParam
      };
    }
  }

  static buildSpeechletResponse (options) {
    var alexaResponse = {
      outputSpeech: Response.createSpeechObject(options.output),
      shouldEndSession: options.shouldEndSession
    };
    if (options.reprompt) {
      alexaResponse.reprompt = {
        outputSpeech: Response.createSpeechObject(options.reprompt)
      };
    }
    if (options.cardTitle && options.cardContent) {
      alexaResponse.card = {
        type: 'Simple',
        title: options.cardTitle,
        content: options.cardContent
      };
    }
    const returnResult = {
      version: '1.0',
      response: alexaResponse
    };
    if (options.session && options.session.attributes) {
      returnResult.sessionAttributes = options.session.attributes;
    }
    return returnResult;
  }

  tell (speechOutput) {
    this._context.succeed(Response.buildSpeechletResponse({
      session: this._session,
      output: speechOutput,
      shouldEndSession: true
    }));
  }

  tellWithCard (speechOutput, cardTitle, cardContent) {
    this._context.succeed(Response.buildSpeechletResponse({
      session: this._session,
      output: speechOutput,
      cardTitle: cardTitle,
      cardContent: cardContent,
      shouldEndSession: true
    }));
  }

  ask (speechOutput, repromptSpeech) {
    this._context.succeed(Response.buildSpeechletResponse({
      session: this._session,
      output: speechOutput,
      reprompt: repromptSpeech,
      shouldEndSession: false
    }));
  }

  askWithCard (speechOutput, repromptSpeech, cardTitle, cardContent) {
    this._context.succeed(Response.buildSpeechletResponse({
      session: this._session,
      output: speechOutput,
      reprompt: repromptSpeech,
      cardTitle: cardTitle,
      cardContent: cardContent,
      shouldEndSession: false
    }));
  }
}
