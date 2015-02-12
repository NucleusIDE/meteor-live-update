/**
 * Created by channi on 10/02/15.
 */

Eval = function () {
  if (!(this instanceof(Eval))) {
    return new Eval();
  }

  this.patches = {};

  this.registerPatch('eventsCode',
      function eventDetector(code, patchName) {
        var regex = /Template\.([a-zA-Z_\$]+)\.events/g;

        var match = regex.exec(code);
        return match ? match[1] : false;
      },
      function eventNeutralizer(code, templateName) {
        Template[templateName].__eventMaps = [];
        return code;
      });

  this.registerPatch('creatingCollection',
      function (code, patchName) {
        var regex = /[\w\s]*=[\s]*new[\s]*(Mongo|Meteor)\.Collection\([\'\"\w\d]*\)\;/mg;
        return code.match(regex);
      },
      function (code, matches) {
        matches.forEach(function (match) {
          code = code.replace(match, ';try { ' + match + '} catch(e) { };')
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

Eval.prototype.applyPatch = function (patchName, code) {
  if (typeof this.patches[patchName] == 'undefined') {
    console.log('No such patch registered: ', patchName);
    return;
  }

  var detector = this._getPatchFunc(patchName, 'detector'),
      neutralizer = this._getPatchFunc(patchName, 'neutralizer');

  var match = detector(code, patchName);
  if (match) {
    return neutralizer(code, match, patchName);
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

Eval.prototype._postEval = function () {
  var self = this;
  Object.keys(this.patches).forEach(function (patch) {
    var func = self._getPatchFunc(patch, 'postEval');
    if (func) {
      func();
    }
  });
};

Eval.prototype.eval = function (code) {
  code = this._neutralizeCode(code);

  //console.log("EVALING CODE", code);
  eval(code);
  this._postEval()
};