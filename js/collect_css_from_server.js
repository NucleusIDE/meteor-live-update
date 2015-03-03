/**
 * Created by channi on 19/02/15.
 */

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
  this._setCssLoadList();

  var cssInterval = Meteor.setInterval(function() {
    if (self.cssLoadList.length) {
      Meteor.clearInterval(cssInterval);

      self._collectCss(self.cssLoadList);
    }
  }, 200);
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

CssCollector.prototype._collectCss = function(fileList) {
  var self = this;

  fileList.forEach(function(file) {
    fs.readFile(file, 'utf-8', function(err, res) {
      var key = file.split('.')[file.split('.').length - 1];
      self.cssStrings[key] += self._markContent(res, file);
    });
  });

  var packageCss = this._collectPackageCss();
  Object.keys(packageCss).forEach(function(key) {
    self.cssStrings[key] += packageCss[key];
  });
};

CssCollector.prototype._collectPackageCss = function() {
  var rootDir = this.rootDir,
      self = this,
      cssStrings = {
        css: '',
        less: '',
        sass: ''
      };

  //we read the 3rd party packages used by the app and then we'll collect their dependencies and css
  var packages = fs.readFileSync(path.resolve(rootDir, '.meteor/packages'), 'utf-8').split('\n');

  var usedPackages = _.filter(packages, function(pkg) {
    return pkg.indexOf('#') !== 0 && pkg.indexOf(':') > 0;
  });

  var localPackages = fs.readdirSync(path.resolve(rootDir, 'packages'));
  var standardPackages = usedPackages.filter(function(pkg) {
    return !_.contains(localPackages, pkg);
  });

  var collectLocalPackages = function(packages) {
    // var cssStrings = {};

    packages.forEach(function(pkg) {
      var packagePath = path.resolve(rootDir, 'packages', pkg);
      var packagejs = fs.readFileSync(path.resolve(packagePath, 'package.js'), 'utf-8');

      //remove all commented out code
      packagejs.replace(/(\/\*([^*]|[\r\n]|(\*+([^*/]|[\r\n])))*\*+\/)|(\/\/.*)/gm, function(match) {
        return '';
      });

      var files = packagejs.split('\n').filter(function(file) {
        return /\.(less|sass|css)/.test(file);
      }).map(function(file) {
        file = file.replace(/[,\s\'\"]+/g, '');
        return path.resolve(packagePath, file);
      });

      files = _.compact(files);

      files.forEach(function(file) {
        var fileSplit = file.split('.');
        cssStrings[fileSplit[fileSplit.length - 1]] = self._markContent(fs.readFileSync(file, 'utf-8'), file);
      });
    });

    return cssStrings;
  };
  var collectStandardPackages = function(packages) {
    // var cssStrings = {};

    packages.forEach(function(package) {
      var name = package.split('@')[0],
          version = package.split('@')[1];

      var packagePath = path.resolve(process.env.HOME, '.meteor/packages/', name.replace(':', '_'), version);
      var packageJson = JSON.parse(fs.readFileSync(path.resolve(packagePath, 'web.browser.json'), 'utf-8'));

      var files = packageJson.resources.filter(function(file) {
        return /css|less|sass/.test(file.type);
      }.map(function(file) {
        return path.resolve(packagePath, file);
      }));

      files.forEach(function(file) {
        var fileSplit = file.split('.');
        cssStrings[fileSplit[fileSplit.length - 1]] = self._markContent(fs.readFileSync(file, 'utf-8'), file);
      });
    });

    return cssStrings;
  };

  collectLocalPackages(localPackages);
  collectLocalPackages(localPackages);

  return cssStrings;
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
