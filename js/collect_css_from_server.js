/**
 * Created by channi on 19/02/15.
 */

var fs = Npm.require('fs'),
    path = Npm.require('path'),
    rread = Npm.require('recursive-readdir');


var CssCollector = function () {
  var self = this;

  this.rootDir = '';
  this.cssLoadList = [];
  this.validCssTypes = ['.css', '.less', '.sass'];
  this.cssString = '';

  this._setRootDir();
  this._setCssLoadList();

  var cssInterval = Meteor.setInterval(function () {
    if (self.cssLoadList.length) {
      Meteor.clearInterval(cssInterval);

      self._collectCss(self.cssLoadList);
    }
  }, 200);
};

CssCollector.prototype._setRootDir = function () {
  var presentDir = path.resolve('.');

  while (path.basename(presentDir) !== '.meteor') {
    if (presentDir == '/') {
      throw new Meteor.Error('Something went wrong when finding root dir for collecting CSS.');
    }

    presentDir = path.dirname(presentDir);
  }

  this.rootDir = path.dirname(presentDir);
};

CssCollector.prototype._setCssLoadList = function () {
  var invalidReads = ['public', 'server', 'resources', '*.html', '*.js', '*.json', '.*'],
      rootDir = this.rootDir,
      self = this;

  var cssFiles = [];

  rread(rootDir, invalidReads, function (err, files) {
    files.forEach(function (file) {
      if (_.contains(self.validCssTypes, path.extname(file))) {
        cssFiles.push(file);
      }
    });

    cssFiles = _.sortBy(cssFiles, function (filepath) {
      var index = -filepath.split('/').length;

      if (filepath.indexOf('/main.') > -1) {
        index += 999;
      }
      return index;
    });

    self.cssLoadList = cssFiles;
  })
};

CssCollector.prototype._collectCss = function (fileList) {
  var self = this;

  fileList.forEach(function (file) {
    fs.readFile(file, 'utf-8', function (err, res) {
      self.cssString += "\n/* " +
      "START FILE: " +
      file +
      " */ \n";
      self.cssString += res;
      self.cssString += "/*" +
      "END FILE: " +
      file +
      " */\n";
    });
  });
};

var LiveUpdateCssCollector = new CssCollector();

Meteor.methods({
  liveUpdateGetCSSLoadList: function () {
    return LiveUpdateCssCollector.cssLoadList;
  },
  liveUpdateGetAllCSS: function (options) {
    return LiveUpdateCssCollector.cssString;
  }
});

