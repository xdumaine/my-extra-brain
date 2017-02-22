/* global describe, it, beforeEach, afterEach */

import { assert } from 'chai';
// import sinon from 'sinon';
import { Reminder } from '../dist/index';
import moment from 'moment';

describe('reminder', function () {
  beforeEach(() => {});
  afterEach(() => {});

  it('will compute a duration string correctly from just a date', function () {
    console.log(Reminder);
    const reminder = new Reminder();
    const oneDayFromNow = moment().add(1, 'days').format('YYYY-MM-DD');
    const result = reminder.computeTimeString({ day: oneDayFromNow });
    assert.equal(result, 'a day');
  });

  it('will compute a duration string correctly from just a time', function () {
    console.log(Reminder);
    const reminder = new Reminder();
    const oneHourFromNow = moment().add(1, 'hours').format('HH:mm');
    const result = reminder.computeTimeString({ time: oneHourFromNow });
    assert.equal(result, 'an hour');
  });

  it('will compute a duration string correctly from a time and a day', function () {
    console.log(Reminder);
    const reminder = new Reminder();
    const threeDaysFromNow = moment().add(3, 'days').format('YYYY-MM-DD');
    const threeHoursFromNow = moment().add(3, 'hours').format('HH:mm');
    const result = reminder.computeTimeString({ day: threeDaysFromNow, time: threeHoursFromNow });
    assert.equal(result, '3 days');
  });
});
