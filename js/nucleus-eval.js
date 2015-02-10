/**
 * Created by channi on 10/02/15.
 */

var eventCodeRegex = /Template\.([a-zA-Z_]+)\.events/g,
    helperCodeRegex = /Template\.([a-zA-Z_]+)\.helpers/g;

Eval = function (code) {
  if (!(this instanceof(Eval))) {
    return new Eval(code);
  }

  this.code = code;
  return this.evalCode();
};

Eval.prototype._isEventCode = function () {
  return eventCodeRegex.test(this.code);
};

Eval.prototype._isHelperCode = function () {
  return helperCodeRegex.test(this.code);
};

Eval.prototype._neutralizeEvents = function () {
  /**
   * Remove all the events from templates that has event code in the code given for eval
   */
  console.log('Neutralising events');
};

Eval.prototype._neutralizeHelpers = function () {
  /**
   * Remove all helpers from templates that has helper code in this.code
   */
  console.log('Neutralising helpers');
};

Eval.prototype._neutralizeCode = function () {
  this.code = '(function(){' + this.code + '})()';
};

Eval.prototype.evalCode = function () {
  /**
   * We check if the js we are going to eval has events or helpers code.
   * We extract the template names out of it, then we will reset the events on the template
   * with new ones in the code.
   * This puts the limitation that all the events and helpers related to the template shall be
   * contained in a single file.
   */
  if (this._isEventCode()) {
    this._neutralizeEvents();
  }
  if (this._isHelperCode()) {
    this._neutralizeHelpers();
  }

  this._neutralizeCode();

  console.log("EVALING CODE");
  //eval(this.code);
};