var fs = Npm.require('fs'),
    path = Npm.require('path');

PackageCollector = function(rootDir) {
  this.rootDir = rootDir;
  this.cssStrings = {
    css: '',
    less: '',
    sass: ''
  };
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
      this.cssStrings[fileSplit[fileSplit.length - 1]] = self.markCssContent(fs.readFileSync(file, 'utf-8'), file);
    });
  });

  return this.cssStrings;
};

PackageCollector.prototype.getCollectedCss = function() {
  var rootDir = this.rootDir,
      self = this;

  //we read the 3rd party packages used by the app and then we'll collect their dependencies and css
  var packages = fs.readFileSync(path.resolve(rootDir, '.meteor/packages'), 'utf-8').split('\n');
  var usedPackages = _.filter(packages, function(pkg) {
    return pkg.indexOf('#') !== 0 && pkg.indexOf(':') > 0;
  });

  var localPackages = fs.readdirSync(path.resolve(rootDir, 'packages'));
  var usedLocalPackages = usedPackages.filter(function(pkg) {
    return _.contains(localPackages, pkg);
  });
  var standardPackages = usedPackages.filter(function(pkg) {
    return !_.contains(localPackages, pkg);
  });

  var _getDependentPackages = function(package) {
    console.log("Finding dependencies of", package);
    return package;
  };

  standardPackages = standardPackages.map(_getDependentPackages);

  this.collectLocalPackages(localPackages);
  this.collectLocalPackages(localPackages);

  return this.cssStrings;
};
