Utils = {
  getContainingSubStr: function getContainingSubStr(str, openingPattern, closingPattern, start) {
    /**
     * returns [start, end] representing start and end of the string b/w pattern
     */
    //regular expressions can't really match everything b/w a pair of brackets.
    //let's use this simple function to do that
    if(str.indexOf(openingPattern) < 0 || str.indexOf(closingPattern) < 0) return false;

    var pos = str.indexOf(openingPattern, start) + 1,
        startPos = pos,
        openPatterns = 1;

    while(openPatterns > 0) {
      if (str.charAt(pos) === closingPattern)
        openPatterns -= 1;
      if (str.charAt(pos) === openingPattern)
        openPatterns += 1;
      pos++;
    }

    return [startPos, pos];
  },
  getAllMatching: function(str, openPattern, closeChar) {
    /**
     * Return all the matches i.e strings starting with openPattern
     * and contained b/w last char of open pattern and closeChar
     */
    var start = str.indexOf(openPattern),
        matches = [];

    if (start < 0) {
      return matches;
    }

    while (start >= 0) {
      var matchPos = this.getContainingSubStr(str, openPattern[openPattern.length - 1], closeChar, start);
      matches.push(str.substr(matchPos[0], matchPos[1]-(matchPos[0] + 1)));
      start = str.indexOf(openPattern, start+1);
    }

    return matches;
  },
  getAllScriptSrc: function(html) {
    // yes we could've used document.scripts but when used it takes some time for document.scripts to update to latest code,
    // like a warmup on app startup
    var scripts = _.uniq(_.compact(html.match(/<script[\s\w=\"\/\.\?\->]*<\/script>/g)));
    return(_.map(scripts, function(script) {
      var srcRegex = /src=\"([\/\w\.\?\-]*)\"/;
      return script.match(srcRegex)[1];
    }));
  },
  markCssContent: function(content, filename) {
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
  },
  sortVersions: function(a, b) {
    a = a.split('.'), b= b.split('.');

    var primary = a[0] - b[0],
        secondary = a[1] - b[1],
        tertiary = a[2] - b[2];

    if (primary !== 0) return primary;
    if (secondary !== 0) return secondary;
    return tertiary;
  }
};

if (Meteor.isServer) {
  var path = Npm.require('path'),
      fs = Npm.require('fs');

  Utils = _.extend(Utils, {
    getLatestPackageVersion: function(name) {
      var packageDir = path.resolve(process.env.HOME, '.meteor/packages/', name.replace(':', '_')),
          versions = fs.readdirSync(packageDir),
          validVersions = R.reject(R.test(/[a-zA-Z]/))(versions),
          latest = R.last(R.sort(Utils.sortVersions, validVersions));

      return latest;
    }
  });
}
