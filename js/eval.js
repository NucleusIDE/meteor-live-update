/**
 * Created by channi on 10/02/15.
 */

Eval = function () {
  if (!(this instanceof(Eval))) {
    return new Eval();
  }

  var self = this;

  this.patches = {};
  this.autoruns = [];

  this._override_autorun();

  this.registerPatch('eventsCode',
      function eventDetector(code) {
        var regex = /Template\.([a-zA-Z_\$]+)\.events/g;

        var match = regex.exec(code);
        return match ? match[1] : false;
      },
      function eventNeutralizer(code, templateName) {
        Template[templateName].__eventMaps = [];
        return code;
      });

  this.registerPatch('creatingCollection',
      function (code) {
        var regex = /[\w\s]*=[\s]*new[\s]*(Mongo|Meteor)\.Collection\([\'\"\w\d]*\)\;/mg;
        return code.match(regex);
      },
      function (code, matches) {
        matches.forEach(function (match) {
          code = code.replace(match, ';try { ' + match + '} catch(e) { };');
        });
        return code;
      });

  this.registerPatch('ironRouterCode', {
    detector: function (code) {
      var regex = /Router\.(configure|route|map)/gm;
      return regex.test(code);
    },
    neutralizer: function (code, match) {
      return code;
    },
    postEval: function () {
      var routeController = Router.current(),
          params = routeController.params,
          routeName = routeController.route.name;
      Router.go(routeName, params);
    }
  })

  this.registerPatch('autoruns',
      function autorunDetector(newCode, oldCode) {
        var getAutorunFunc = function (index, oldCode) {
          index = index || 0;
          var start = oldCode.indexOf('Deps.autorun', index) > -1 ? oldCode.indexOf('Deps.autorun', index) : oldCode.indexOf('Tracker.autorun', index);
          if (start < 0) return false;

          var matchPos = Utils.getContainingSubStr(oldCode, '(', ')', start);
          return {
            autorunFunc: oldCode.substring(start, matchPos[1] - 1).replace('Deps.autorun(', '').replace('Tracker.autorun(', ''),
            index: start
          };
        };

        var matches = [];
        var match = getAutorunFunc(0, oldCode);
        while (match !== false) {
          matches.push(match.autorunFunc);
          match = getAutorunFunc(match.index + 1, oldCode);
        }

        return matches;
      },
      function autorunNeutralizer(code, matches) {
        if (!matches.length)
          return code;


        matches.forEach(function (autorunFunc) {
          self.autoruns.forEach(function (computation, i) {
            var compFunc = computation._func.toString().replace(/[\r\n\s]+/mg, '');
            autorunFunc = autorunFunc.replace(/\s/g, '');

            if (compFunc === autorunFunc) {
              computation.stop();
            }
          });
        });

        return code;
      });
};

Eval.prototype._override_autorun = function () {
  var originalAutorun = Tracker.autorun,
      self = this,
      evalId = 1;
  Tracker.autorun = function (func) {
    var computation = originalAutorun(func);
    self.autoruns.push(computation);

    return computation;
  };

};

Eval.prototype.registerPatch = function (patchName, detector, neutralizer, postEval) {
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

  if (typeof detector !== 'object' && args.length < 3) {
    throw new Meteor.Error("Invalid Arguments for registerPatch: Must passs patchName, detector, neutralizer (and postEval (optional), or an object with these keys");
  }

  if (typeof detector !== 'function' && typeof detector === 'object') {
    this.patches[patchName] = detector;
    return;
  }

  this.patches[patchName] = {
    detector: detector,
    neutralizer: neutralizer,
    postEval: postEval
  }
};

Eval.prototype._getPatchFunc = function (patchName, funcName) {
  var func = this.patches[patchName][funcName];
  if (typeof func == 'string') {
    func = this._getPatchFunc(func);
  }

  return func;
};

Eval.prototype.applyPatch = function (patchName, code, oldCode) {
  if (typeof this.patches[patchName] == 'undefined') {
    console.log('No such patch registered: ', patchName);
    return;
  }

  var detector = this._getPatchFunc(patchName, 'detector'),
      neutralizer = this._getPatchFunc(patchName, 'neutralizer');

  var match = detector(code, oldCode);
  if (match) {
    return neutralizer(code, match);
  }

  return code;
};

Eval.prototype._neutralizeCode = function (code, oldCode) {
  code = '(function(){' + code + '})()';
  var self = this;

  Object.keys(this.patches).forEach(function (patchName) {
    code = self.applyPatch(patchName, code, oldCode);
  });

  return code;
};

Eval.prototype._postEval = function () {
  var self = this;
  Object.keys(this.patches).forEach(function (patch) {
    var func = self._getPatchFunc(patch, 'postEval');
    if (func) {
      func();
    }
  });
};

Eval.prototype.eval = function (code, oldCode) {
  code = this._neutralizeCode(code, oldCode);

  //console.log("EVALING CODE", code);
  try {
    eval(code);
  } catch (e) {
    throw(new Error(e));
  }
  this._postEval();
};
