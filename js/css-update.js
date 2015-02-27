/**
 * Created by channi on 19/02/15.
 */

CssUpdate = function () {
  this.injectionNode = null;
  this.cssStrings = {};

  this.setupInjectionNode();
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

CssUpdate.prototype.getFileContent = function (filename, filetype) {
  filename = filename + '.' + filetype;
  var resRegex = new RegExp('\/\\* START FILE: ' + filename + ' \\*/([\\s\\S]+)\\*END FILE: ' + filename + ' \\*/', 'mg'),
      result = this.cssStrings[filetype].match(resRegex);

  return result[0];
};

CssUpdate.prototype.update = function (fielname, filecontent) {

};