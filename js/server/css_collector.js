var fs = Npm.require('fs'),
    path = Npm.require('path'),
    rread = Npm.require('recursive-readdir');

var CssCollector = function() {
  var self = this;

  this.rootDir = '';
  this.cssLoadList = [];
  this.validCssTypes = ['.css', '.less', '.sass'];

  this.cssStrings = {
    css: '',
    less: '',
    sass: ''
  };

  this._setRootDir();
  this.PackageCollector = new PackageCollector(this.rootDir);

  this._setCssLoadList();

  var cssInterval = Meteor.setInterval(function() {
    if (self.cssLoadList.length) {
      Meteor.clearInterval(cssInterval);

      self.collectCss(self.cssLoadList);

      var packageCss = self.PackageCollector.getCollectedCss();
      Object.keys(packageCss).forEach(function(key) {
        self.cssStrings[key] += packageCss[key];
      });
    }
  }.bind(this), 200);
};

CssCollector.prototype._setRootDir = function() {
  var presentDir = path.resolve('.');

  while (path.basename(presentDir) !== '.meteor') {
    if (presentDir == '/') {
      throw new Meteor.Error('Something went wrong when finding root dir for collecting CSS.');
    }

    presentDir = path.dirname(presentDir);
  }

  this.rootDir = path.dirname(presentDir);
  return this.rootDir;
};

CssCollector.prototype._setCssLoadList = function() {
  var invalidReads = ['public', 'server', 'resources', '*.html', '*.js', '*.json', '.*'],
      rootDir = this.rootDir,
      self = this;

  var cssFiles = [];

  rread(rootDir, invalidReads, function(err, files) {
    files.forEach(function(file) {
      if (_.contains(self.validCssTypes, path.extname(file))) {
        cssFiles.push(file);
      }
    });

    cssFiles = _.sortBy(cssFiles, function(filepath) {
      var index = -filepath.split('/').length;

      if (filepath.indexOf('/main.') > -1) {
        index += 999;
      }
      return index;
    });

    self.cssLoadList = cssFiles;
  })
};

CssCollector.prototype._markContent = function(content, filename) {
  return Utils.markCssContent(content, filename);
};

CssCollector.prototype.collectCss = function(fileList) {
  var self = this;

  fileList.forEach(function(file) {
    fs.readFile(file, 'utf-8', function(err, res) {
      var key = file.split('.')[file.split('.').length - 1];
      self.cssStrings[key] += self._markContent(res, file);
    });
  });
};

var LiveUpdateCssCollector = new CssCollector();

Meteor.methods({
  liveUpdateGetCSSLoadList: function() {
    return LiveUpdateCssCollector.cssLoadList;
  },
  liveUpdateGetAllCSS: function(options) {
    return LiveUpdateCssCollector.cssStrings;
  },
  test: function() {
    LiveUpdateCssCollector._collectPackageCss();
  }
});
