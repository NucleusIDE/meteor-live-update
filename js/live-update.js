LiveUpdateFactory = function() {
  this.config = {};

  this.configure = function(options) {
    _.extend(this.config, options);
  };

  this.updateTemplateWithHTML =  function(name, newHtml) {
    //This method isn't used anywhere. I made it when I was trying to figure out how to compile templates manually, so I've kept it here for future reference
    delete Template[name];
    Template.__define__(name, eval(Spacebars.compile(
      newHtml, {
        isTemplate: true,
        sourceName: 'Template "' + name + '"'
      }
    )));
    this._reRenderPage();
  };

  this._reRenderPage = function() {
    //this is clearly a hack (or so I suppose)
    //this function is breaking with new meteor changes
    var allDr = UI.DomRange.getComponents(document.body);
    // following works in new blaze templates
    //    UI.body.__contentParts[0]._domrange.members[0].remove()
    _.each(allDr, function(dr) {
      dr.removeAll();
    });
    if(UI.body.contentParts.length > 1) UI.body.contentParts.shift();
    UI.DomRange.insert(UI.render(UI.body).dom, document.body);
    console.log("PAGE RE-RENDERED");
  };

  this.reactifyTemplate = function(templateName) {
    //this method was suggested by Devid Greenspan. Doesn't work as he suggested though
    //https://groups.google.com/forum/#!topic/meteor-talk/veN_a1RNpXw
    Template[templateName].renderFuncVar = new ReactiveVar(Template[templateName].renderFunction);
    Template[templateName].renderFunction = function() {
      console.log("TEMPLATE RENDER FUNCTION CALLED", templateName);
      var template = Template[templateName];
      var func = template.renderFuncVar.get();
      return func.call();
    };
  };


  this.templateNames = [];

  this.refreshPage = function(html) {
    console.log("REFERSHING THE PAGEb");
    var url = Meteor.absoluteUrl(),
        self = this,
        codeToCommentOutInEval = [
          //let's not recreate collections (meteor complains if we try to do so). We can comment it out
          // since collection would already be created when user first loads the app
            /\w*\s*=\s*new Mongo.Collection\([\'\"](\w|\.)*/g,
            /\w*\s*=\s*new Meteor.Collection\([\'\"](\w|\.)*/g
        ];


    // let's ignore package files and only re-eval user created js/templates
    var jsToFetch = LiveUpdateParser.getAllScriptSrc(html).filter(function(src){return ! /\/packages\//.test(src);});
    _.each(jsToFetch, function(jsFile, index) {
      var req = $.get(jsFile);
      req.always(function(res) {
        //It's strange, the responseText exists on error response not on the success response for compile Template files.
        // this is why I am using always above instead of success or done
        //Sometime response object has the required js in res.responseText (in case of compiled template files)
        // and on other times, it's returned as expected response. Below statement handles that
        var js = typeof res === 'string' ? res : res.responseText;

        var getNamesFromCompiledTemplate = function(snippet) {
          var templateNameRegex = /Template\[\"([a-zA-Z_\-]*)\"\]/gm,
              names = [];
          var match = templateNameRegex.exec(snippet);
          while(match !== null) {
            names.push(match[1]);
            match = templateNameRegex.exec(snippet);
          }
          return names;
        };

        _.each(codeToCommentOutInEval, function(rejex) {
          js = js.replace(rejex, function(match) {
            console.log("COMMENTING OUT", match);
            return "//"+ match;
          });
        });

        var reval = function(script) {
          var res = eval(script);
          console.log("EVALUATION RESULT", res);
        };


        self.templateNames.push(getNamesFromCompiledTemplate(js));
        self.templateNames = _.flatten(_.uniq(self.templateNames));

        if(index === jsToFetch.length-1) {
          _.each(self.templateNames, function(tn) {
            self.reactifyTemplate(tn);
          });

          // self._reRenderPage();
        }

        reval(js);
      });
    });
  };

  var should_reload = false;
  this.interceptReload = function() {
    // stopping reloads on file changes and calling refreshPage after initial app is loaded,
    // i.e after the user has loaded the app, and has changed the file
    var self = this;

    Reload._onMigrate("LiveUpdate", function(retry) {
      // triggering self reactive computation inside Reload._onMigrate so it won't get triggered on initial page load or when user refreshes the page.
      // Self let user to see un-touched (by LiveUpdate) version of her app if she refreshes the app manually
      Deps.autorun(function() {
        // Meteor creates and uses a collection for client (and server too) versions. It's kept in a local variable in Autoupdate package
        // but what we desire (notification on any file change) can be obtained by Autoupdate.newClientAvailable(). Autoupdate package itself does a
        // reactive computation to make Reload package do its duty and stops that computation after executing it once. But we want to continue receiving notifications
        // on file changes, so we are running our own reactive computation
        Autoupdate.newClientAvailable();

        if (self.config.purelyThirdParty) {
          console.log("IT's PURELY THIRD PARTY");
          should_reload = true;
          return;
        }

        $.get(Meteor.absoluteUrl()).success(function(html) {
          if (self.config.disable) {
            console.log("SHOULD RELOAD");
            should_reload = true;
            retry();
          } else {
            should_reload = false;
            self.refreshPage(html);
          }
        });
      });

      if (should_reload === true) {
        should_reload = false;
        return [true];
      }
      return [false];
    });
  };

  return this;
};


LiveUpdateParser = {
  getAllScriptSrc: function(html) {
    // yes we could've used document.scripts but when used it takes some time for document.scripts to update to latest code,
    // like a warmup on app startup
    var scripts = _.uniq(_.compact(html.match(/<script[\s\w=\"\/\.\?\->]*<\/script>/g)));
    return(_.map(scripts, function(script) {
      var srcRegex = /src=\"([\/\w\.\?\-]*)\"/;
      return script.match(srcRegex)[1];
    }));
  }
};


LiveUpdateCache = {
  //caching won't work until we figure out how to tear-apart and re-render individual templates instead of full page
  cacheTemplate: function(name, script) {
    this.cache = this.cache || {};
    this.cache.templates = this.cache.templates || {};
    this.cache.templates[name] = script;
  },
  cacheScript: function(name, script) {
    this.cache = this.cache || {};
    this.cache[name] = script;
  },
  getCache: function() {
    var cache = _.clone(this.cache) || false;
    return cache;
  },
  invalidTemplate: function(templateName, snippet) {
    return  !_.isEqual(this.getCache().templates ? this.getCache().templates[templateName] : false, snippet);
  },
  invalidScript: function(key, script) {
    return !_.isEqual(this.getCache()[key], script);
  }
};


LiveUpdate = new LiveUpdateFactory();

LiveUpdate.interceptReload();
