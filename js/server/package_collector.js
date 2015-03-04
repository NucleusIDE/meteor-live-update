var fs = Npm.require('fs'),
    path = Npm.require('path');

PackageCollector = function(rootDir) {
  this.rootDir = rootDir;
  this.cssStrings = {
    css: '',
    less: '',
    sass: ''
  };

  var packages = fs.readFileSync(path.resolve(rootDir, '.meteor/packages'), 'utf-8').split('\n');

  this.packages = _.filter(packages, function(pkg) {
    return pkg.indexOf('#') !== 0 && pkg.indexOf(':') > 0;
  });
  this.localPackages = fs.readdirSync(path.resolve(rootDir, 'packages'));
};

PackageCollector.prototype.collectLocalPackages = function(packages) {
  var self = this,
      rootDir = this.rootDir;

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
      self.cssStrings[fileSplit[fileSplit.length - 1]] = Utils.markCssContent(fs.readFileSync(file, 'utf-8'), file);
    });
  });

  return this.cssStrings;
};

PackageCollector.prototype.collectStandardPackages = function(packages) {
  var self = this,
      rootDir = this.rootDir;

  packages.forEach(function(package) {
    if (typeof package !== 'string') {
      throw new Meteor.Error('Invalid Argument. Require String, got ' + package);
    }

    var name = package.split('@')[0],
        version = package.split('@')[1];

    var packagePath = path.resolve(process.env.HOME, '.meteor/packages/', name.replace(':', '_'), version);
    var packageJson = JSON.parse(fs.readFileSync(path.resolve(packagePath, 'web.browser.json'), 'utf-8'));

    var files = packageJson.resources.filter(function(file) {
      return /css|less|sass/.test(file.type);
    }).map(function(file) {
      return path.resolve(packagePath, file);
    });

    files.forEach(function(file) {
      var fileSplit = file.split('.');
      this.cssStrings[fileSplit[fileSplit.length - 1]] = self.markCssContent(fs.readFileSync(file, 'utf-8'), file);
    });
  });

  return this.cssStrings;
};

PackageCollector.prototype._isLocalPackage = function(package) {
  return _.contains(this.localPackages, package);
};

PackageCollector.prototype.getDependentPackages = function(pkg) {
  var packages = [],
      rootDir = this.rootDir;

  if (this._isLocalPackage(pkg)) {
    console.log("Should read ", path.resolve(rootDir, 'packages', pkg, 'package.js'));
    packages.push(pkg);
  } else {
    var name = pkg.split('@')[0],
        version = pkg.split('@')[1],
        packagePath = path.resolve(process.env.HOME, '.meteor/packages/', name.replace(':', '_'), version);

    console.log("Should read ", path.resolve(packagePath, 'web.browser.json'));
    packages.push(pkg);
  }

  return packages;
};

PackageCollector.prototype.getCollectedCss = function() {
  var rootDir = this.rootDir,
      self = this;

  var allPackages = _.flatten(_.map(this.packages, function(pkg) {
    return self.getDependentPackages(pkg);
  }));

  var localPackages = allPackages.filter(self._isLocalPackage);
  var standardPackages = allPackages.filter(function(pkg) {
    return !self._isLocalPackage(pkg);
  });

  this.collectLocalPackages(localPackages);
  this.collectStandardPackages(standardPackages);

  return this.cssStrings;
};
