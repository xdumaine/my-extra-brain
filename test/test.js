/* global describe, it, beforeEach, afterEach */

import { assert } from 'chai';
// import sinon from 'sinon';
import { Reminder } from '../dist/index';
import moment from 'moment';

describe('reminder', function () {
  beforeEach(() => {});
  afterEach(() => {});

  it('will compute a duration correctly from just a date', function () {
    const reminder = new Reminder();
    const oneDayFromNow = moment().add(1, 'days').format('YYYY-MM-DD');
    const result = reminder.computeDuration({ day: oneDayFromNow });
    assert.equal(result.humanize(), 'a day');
  });

  it('will compute a duration correctly from just a time', function () {
    const reminder = new Reminder();
    const oneHourFromNow = moment().add(1, 'hours').format('HH:mm');
    const result = reminder.computeDuration({ time: oneHourFromNow });
    assert.equal(result.humanize(), 'an hour');
  });

  it('will compute a duration correctly from a time and a day', function () {
    const reminder = new Reminder();
    const day = moment().add(1, 'days').format('YYYY-MM-DD');
    const time = moment().add(1, 'minute').format('HH:mm');
    const result = reminder.computeDuration({ day, time });
    assert.equal(result.humanize(), 'a day');
  });
});
