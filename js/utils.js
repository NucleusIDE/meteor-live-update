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
  }
};

LiveUpdate.utils = Utils;
