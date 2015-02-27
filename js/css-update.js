/**
 * Created by channi on 19/02/15.
 */

CssUpdate = function () {
  this.injectionNode = null;
  this.cssStrings = {};
  this.cssLoadList = [];

  this.setupInjectionNode();
  this.updateCssLoadList();
  this.updateCssStrings();
};

CssUpdate.prototype.setupInjectionNode = function () {
  var injectionNode = document.createElement("style");

  injectionNode.id = "liveupdate-injection-node";

  document.head.appendChild(injectionNode);

  this.injectionNode = injectionNode;
  return this.injectionNode;
};

CssUpdate.prototype.updateCssStrings = function () {
  var self = this;
  Meteor.call('liveUpdateGetAllCSS', function (err, res) {
    if (err) {
      throw err;
    }

    self.cssStrings = res;
  })
};
CssUpdate.prototype.updateCssLoadList = function () {
  var self = this;
  Meteor.call('liveUpdateGetCSSLoadList', function (err, res) {
    self.cssLoadList = res;
  });
};

CssUpdate.prototype.getFileContent = function (filename) {
  var filetype = filename.split('.')[filename.split('.').length - 1];

  var resRegex = new RegExp('\/\\* START FILE: ' + filename + ' \\*/([\\s\\S]+)\\*END FILE: ' + filename + ' \\*/', 'mg'),
      result = this.cssStrings[filetype].match(resRegex);

  return result[0];
};

CssUpdate.prototype.unfoldPreprocessorCode = function () {
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
    finalCss += self.getFileContent(filename);;
    finalCss = unfoldFileContent(finalCss);
  });

  return finalCss;
};

CssUpdate.prototype.update = function (fielname, filecontent) {

};