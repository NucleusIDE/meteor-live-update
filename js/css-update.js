CssUpdate = function () {
  var self = this;

  this.injectionNode = null;
  this.cssStrings = {};
  this.cssLoadList = [];

  this.outputCss = new ReactiveVar();
  this.updatorComputation = null;

  this.setupInjectionNode();
  this.updateCssLoadList(function (err, res) {
    self.initializeCompilers();
  });
  this.updateCssStrings();
  this.setupCssUpdateAutorun();
};

CssUpdate.prototype._createInjectionNode = function(newCss) {
  var injectionNode = document.createElement("style");

  injectionNode.className = "liveupdate-injection-node";
  injectionNode.innerHTML = newCss ? newCss : '';

  document.head.appendChild(injectionNode);
  return injectionNode;
};

CssUpdate.prototype._markContent = function(content, filename) {
  var result = "\n/* " +
        "START FILE: " +
        filename +
        " */ \n";

  result += content;

  result += "/*" +
    "END FILE: " +
    filename +
    " */\n";

  return result;
};

CssUpdate.prototype._resolvePathsToAbsolute = function(cssContent) {
  return cssContent.replace(/url\s*\(\s*(['"]?)([^"'\)]*)\1\s*\)/gi, function(match, location) {
    match = match.replace(/\s/g, '');
    var url = match.slice(4, -1).replace(/"|'/g, '').replace(/\\/g, '/');

    if (/^\/|https:|http:|data:/i.test(url) === false) {
      return 'url('+ Meteor.absoluteUrl()  + url + ')';
    }

    return match;
  });
};

CssUpdate.prototype.setupInjectionNode = function () {
  this.injectionNode = this._createInjectionNode();
};

CssUpdate.prototype.initializeCompilers = function () {
  var compilersUsed = this.getPreprocessorUsed();

  if (_.contains(compilersUsed, 'less')) {
    NucleusTranscompiler.initialize_less();
  }

  if (_.contains(compilersUsed, 'sass')) {
    NucleusTranscompiler.initialize_sass();
  }

  this.Transcompiler = NucleusTranscompiler;
};

CssUpdate.prototype.getPreprocessorUsed = function () {
  return _.uniq(this.cssLoadList.map(function (file) {
    return file.split('.')[file.split('.').length - 1];
  }));
};

CssUpdate.prototype.updateCssStrings = function () {
  var self = this;
  Meteor.call('liveUpdateGetAllCSS', function (err, res) {
    if (err) {
      throw err;
    }

    self.cssStrings = res;
  });
};
CssUpdate.prototype.updateCssLoadList = function (cb) {
  var self = this;
  Meteor.call('liveUpdateGetCSSLoadList', function (err, res) {
    self.cssLoadList = res;
    cb(err, res);
  });
};

CssUpdate.prototype.getFileContent = function (filename) {
  var filetype = filename.split('.')[filename.split('.').length - 1];

  var resRegex = new RegExp('\/\\* START FILE: ' + filename + ' \\*/([\\s\\S]+)\\*END FILE: ' + filename + ' \\*/', 'mg'),
      result = this.cssStrings[filetype].match(resRegex);

  if (result) return result[0];
  else console.log('No content for', filename);
};

CssUpdate.prototype.getUnfoldedPreprocessorCode = function () {
  /**
   * We have imports in the less/sass code. This function replace those imports with actual code and create a single
   * big string which can be compiled to CSS
   */
  var self = this;
  var mainFiles = this.cssLoadList.filter(function (filepath) {
    return /main\.(less|sass)/.test(filepath);
  });
  var finalCss = '';

  var getImports = function (string) {
    /**
     * Take the content of a file and return any imports in present in that content.
     * It returns the path that import is requiring. Paths are relative and should not be used directly.
     * Sanitize the path and find what file the path actually point to.
     */
    var importRegex = /@import ([\w\S]+)/g;

    return string.match(importRegex);
  };
  var getActualPathFromAprox = function (approxPath) {
    /**
     * Returns the path of actual file whose content should be fetched.
     * Paths we get from imports in a file are approximate paths; they are relative etc.
     * We convert them to actual paths here.
     */
    var result = '';

    self.cssLoadList.forEach(function (realPath) {
      if (realPath.indexOf(approxPath) >= 0) {
        result = realPath;
      }
    });

    return result;
  };
  var unfoldFileContent = function (content) {
    var allImportsInFile = getImports(content);

    allImportsInFile.forEach(function (importStr) {
      var approxFileToImport = importStr.replace(/@import |;|\.\.|\'|\"/g, ''),
          fileToImport = getActualPathFromAprox(approxFileToImport),
          importContent = self.getFileContent(fileToImport);

      content = content.replace(importStr, importContent);
    });

    //If the unfolded content has more imports, unfold them recursively
    if (getImports(content) && getImports(content).length) {
      content = unfoldFileContent(content);
    }

    return content;
  };

  mainFiles.forEach(function (filename) {
    finalCss += self.getFileContent(filename);
    finalCss = unfoldFileContent(finalCss);
  });

  return finalCss;
};

CssUpdate.prototype.updateOutputCss = function () {
  var css = this._resolvePathsToAbsolute(this.cssStrings.css) || '';

  var preprocessorUsed = this.getPreprocessorUsed();

  if (_.contains(preprocessorUsed, 'less') || _.contains(preprocessorUsed, 'sass')) {
    var prepCode = this.getUnfoldedPreprocessorCode(),
        self = this;

    if (_.contains(preprocessorUsed, 'less')) {
      this.Transcompiler.less.render(prepCode, function (err, res) {
        if (err) {
          throw err;
        }
        if (res.css === self.outputCss.get()) {
          console.log('new Css is same ');
        }

        css += self._resolvePathsToAbsolute(res.css);
        self.outputCss.set(css);
      });
    }
    else if (_.contains(preprocessorUsed, 'sass')) {
      this.Transcompiler.Sass.compile(prepCode, function (resCss) {
        css += self._resolvePathsToAbsolute(resCss);
        self.outputCss.set(css);
      });
    }
  } else {
    console.log('no preprocessor used');
  }

  return css;
};

CssUpdate.prototype.update = function (filename, filecontent) {
  var oldContent = this.getFileContent(filename);
  var filetype = filename.split('.')[filename.split('.').length - 1];

  this.cssStrings[filetype] = this.cssStrings[filetype].replace(oldContent, this._markContent(filecontent, filename));
  this.updateOutputCss();
};

CssUpdate.prototype.updateCssOnPage = function (newCss) {
  var oldLinks = [];
  _.each(document.getElementsByTagName('link'), function (link) {
    if (link.className === '__meteor-css__') {
      oldLinks.push(link);
    }
  });

  var removeOldLinks = function () {
    _.each(oldLinks, function (oldLink) {
      oldLink.parentNode.removeChild(oldLink);
    });
  };

  var oldNode = this.injectionNode;
  // this.injectionNode = this._createInjectionNode(newCss);
  this.injectionNode.innerHTML = newCss;
  // oldNode.remove();

  removeOldLinks();
};

CssUpdate.prototype.setupCssUpdateAutorun = function () {
  var self = this;
  this.updatorComputation = Tracker.autorun(
    function (comp) {
      var outputCss = self.outputCss.get();
      if (outputCss) {
        self.updateCssOnPage(outputCss);
      } else {
        // console.log("No CSS to Update");
      }
    });
};

CssUpdate.prototype.overrideMeteorCssUpdate = function () {
  Autoupdate._retrySubscription = function () {
    return false;
  };
};
