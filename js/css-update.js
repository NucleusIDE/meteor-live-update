/**
 * Created by channi on 19/02/15.
 */

CssUpdate = function () {
  this.injectionNode = null;

  this.setupInjectionNode();
};

CssUpdate.prototype.setupInjectionNode = function () {
  var injectionNode = document.createElement("style");

  injectionNode.id = "liveupdate-injection-node";

  document.head.appendChild(injectionNode);

  this.injectionNode = injectionNode;
  return this.injectionNode;
};

CssUpdate.prototype.update = function (fielname, filecontent) {
  var self = this;

  Meteor.call("liveUpdateGetAllCSS", function (err, res) {
    self.injectionNode.innerHTML = res;
  });
};