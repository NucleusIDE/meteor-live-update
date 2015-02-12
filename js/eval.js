/**
 * Created by channi on 10/02/15.
 */

Eval = function () {
  if (!(this instanceof(Eval))) {
    return new Eval();
  }

  this.patches = {};

  this.registerPatch('eventsCode',
      function eventDetector(code, regex) {
        regex = regex || /Template\.([a-zA-Z_\$]+)\.events/g;
        var match = regex.exec(code)
        return match ? match[1] : false;
      },
      function eventNeutralizer(code, match) {
        return code;
      });

  this.registerPatch('helpersCode',
      function helperDetector(code) {
        var helperCodeRegex = /Template\.([a-zA-Z_\$]+)\.helpers/g;
        return helperCodeRegex.test(code);
      },
      function helperNeutralizer(code, match) {
        return code;
      });

};

Eval.prototype.registerPatch = function (patchName, detector, neutralizer) {
  /**
   *
   * Register a patch. Takes at least 3 arguments
   *
   * * patchName      -       String
   * * detector       -       String or Func
   * * neutralizer    -       String or Func
   *
   * If a detector or a neutraliser is a string, the detector or neutraliser function of the patch matching the string
   * is used.
   */

  var args = Array.prototype.slice.call(arguments, 0);

  if (args.length < 3) {
    throw new Meteor.Error("Invalid Arguments: Must be registerPatch('patchName', detectorFunc, neutraliserFunc");
  }

  if (typeof this.patches[patchName] !== 'undefined') {
    console.log('Patch ' + patchName + ' already exists');
    return;
  }

  this.patches[patchName] = {
    detector: detector,
    neutralizer: neutralizer
  }
};

Eval.prototype._getDetectorFunc = function (patchName) {
  var detector = this.patches[patchName].detector;
  if (typeof detector == 'string') {
    detector = this._getDetectorFunc(detector);
  }

  return detector;
};
Eval.prototype._getNeutralizerFunc = function (patchName) {
  var neutralizer = this.patches[patchName].neutralizer;
  if (typeof neutralizer == 'string') {
    neutralizer = this._getNeutralizerFunc(neutralizer);
  }

  return neutralizer;
};

Eval.prototype.applyPatch = function (patchName, code) {
  if (typeof this.patches[patchName] == 'undefined') {
    console.log('No such patch registered: ', patchName);
    return;
  }

  var detector = this._getDetectorFunc(patchName),
      neutralizer = this._getNeutralizerFunc(patchName);

  var match = detector(code);
  if (match) {
    return neutralizer(code, match);
  }

  return code;
};

Eval.prototype._neutralizeCode = function (code) {
  code = '(function(){' + code + '})()';
  var self = this;

  Object.keys(this.patches).forEach(function (patchName) {
    code = self.applyPatch(patchName, code);
  });

  return code;
};

Eval.prototype.eval = function (code) {
  code = this._neutralizeCode(code);

  console.log("EVALING CODE", code);
  //eval(this.code);
};