var fs = Npm.require('fs'),
    path = Npm.require('path');

PackageCollector = function(rootDir) {
  this.rootDir = rootDir;
  this.cssStrings = {
    css: '',
    less: '',
    sass: ''
  };

  var getInstalledPackages = R.pipe(
    R.split('\n'),
    R.map(R.trim),
    R.filter(function(str) {
      return R.strIndexOf('#', str) !== 0 && R.strIndexOf(':', str) > 0;
    }));

  this.packages = getInstalledPackages(fs.readFileSync(path.resolve(rootDir, '.meteor/packages'), 'utf-8'));

  /**
   * The name of the folder with which the local package is saved shall be the same as the name of the package
   * itself
   */
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

    if (R.isEmpty(package)) return;

    var name = package.split('@')[0],
        version = package.split('@')[1];

    if (!version) {
      version = Utils.getLatestPackageVersion(name);
    }

    try {
      var packagePath = path.resolve(process.env.HOME, '.meteor/packages/', name.replace(':', '_'), version);
    } catch (e) {
      console.error("Invalid path for collecting CSS for package", package);
    };

    if (!packagePath) {
      return '';
    }

    var packageJson = JSON.parse(fs.readFileSync(path.resolve(packagePath, 'web.browser.json'), 'utf-8'));

    var files = packageJson.resources.filter(function(file) {
      return /css|less|sass/.test(file.type);
    }).map(function(file) {
      if(_.isObject(file) && file.file)
        file = file.file;

      return path.resolve(packagePath, file);
    });

    files.forEach(function(file) {
      var fileType = R.last(file.split('.'));
      self.cssStrings[fileType] += Utils.markCssContent(fs.readFileSync(file, 'utf-8'), file);
    });
  });

  return this.cssStrings;
};

PackageCollector.prototype._isLocalPackage = function(package) {
  return _.contains(this.localPackages, package.split('@')[0]);
};

PackageCollector.prototype.getDependentPackages = function(pkg) {
  var packages = [],
      rootDir = this.rootDir,
      excludedPackages = ['iron:router'];

  if (_.contains(excludedPackages, pkg)) {
    return packages;
  }

  if (this._isLocalPackage(pkg)) {
    pkg = pkg.split('@')[0];
    var packagePath = path.resolve(rootDir, 'packages', pkg, 'package.js'),
        packageJs = fs.readFileSync(packagePath, 'utf-8');

    var usedPackages = _.flatten(Utils.getAllMatching(packageJs, 'api.use([', ']').map(function(packages) {
      //remove extra chars from package names and split them to individual package names
      return packages.replace(/\'|\"|\n|\s+/g, '').split(',').map(function(pkg) {
        //check for || in package version and include latest package
        if (pkg.indexOf('||') >= 0) {
          var pkgSplit = pkg.split('@'),
              verSplit = pkgSplit[1].split('||');

          var name = pkgSplit[0],
              version = verSplit[verSplit.length-1];

          pkg = [name, '@', version].join('');
        }
        return pkg;
      }).filter(function(pkg) {
        //filter standard meteor packages
        return pkg.indexOf(':') > 0 && !_.contains(excludedPackages, pkg.split('@')[0]);
      });
    }));
    packages.push(usedPackages);
  } else {
    var name = pkg.split('@')[0],
        version = pkg.split('@')[1];

    if (!version)
      version = Utils.getLatestPackageVersion(name);

    try {
      var packagePath = path.resolve(process.env.HOME, '.meteor/packages/', name.replace(':', '_'), version, 'web.browser.json');
    } catch (e) {
      console.error("Invalid path for collecting CSS for package", pkg);
    };
    if (!packagePath)
      return '';

    var packageJson = JSON.parse(fs.readFileSync(packagePath, 'utf-8'));

    if (!packageJson) {
      return packages;
    }

    var usedPackages = packageJson.uses.filter(function(pkg) {
      return pkg.package.indexOf(':') >= 0 && !_.contains(excludedPackages, pkg.package);
    }).map(function(pkg) {
      return pkg.package + ':' + pkg.contstraint;
    });
  }

  return _.uniq(_.flatten(packages));
};

PackageCollector.prototype.getCollectedCss = function() {
  var rootDir = this.rootDir,
      self = this;

  var allPackages = _.flatten(_.map(this.packages, function(pkg) {
    return [pkg, self.getDependentPackages(pkg)];
  }));

  var localPackages = allPackages.filter(function(pkg) {
    return self._isLocalPackage(pkg);
  }).map(function(pkg) {
    return pkg.split('@')[0];
  });

  var standardPackages = allPackages.filter(function(pkg) {
    return !self._isLocalPackage(pkg);
  });

  this.collectLocalPackages(localPackages);
  this.collectStandardPackages(standardPackages);

  return this.cssStrings;
};
