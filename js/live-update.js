LiveUpdateFactory = function() {
  this.config = {};

  this.configure = function(options) {
    _.extend(this.config, options);
  };

  this.updateCss = function(html) {
    /**
     * We no longer need to live update css since meteor do it for us now
     */
    return true;
  };

  this.updateTemplateWithHTML =  function(name, newHtml) {
    //This method isn't used anywhere either. I made it when I was trying to figure out how to compile templates manually, so I've kept it here for future reference
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
    var allDr = UI.DomRange.getComponents(document.body);
    _.each(allDr, function(dr) {
      dr.removeAll();
    });
    if(UI.body.contentParts.length > 1) UI.body.contentParts.shift();
    UI.DomRange.insert(UI.render(UI.body).dom, document.body);
    console.log("PAGE RE-RENDERED");
  };

  this.refreshPage = function(html) {
    var url = Meteor.absoluteUrl(),
        self = this,
        codeToCommentOutInEval = [
          //let's not recreate collections (meteor complains if we try to do so). We can comment it out
          // since collection would already be created when user first loads the app
            /\w*\s*=\s*new Meteor.Collection\([\'\"](\w|\.)*/g
        ];


    // let's ignore package files and only re-eval user created js/templates
    var jsToFetch = LiveUpdateParser.getAllScriptSrc(html).filter(function(src){return src.indexOf("package") < 0;});
    _.each(jsToFetch, function(jsFile) {
      var req = $.get(jsFile);
      req.always(function(res) {
        //It's strange, the responseText exists on error response not on the success response for compile Template files.
        // this is why I am using always above instead of success or done
        //Sometime response object has the required js in res.responseText (in case of compiled template files)
        // and on other times, it's returned as expected response. Below statement handles that
        var js = typeof res === 'string' ? res : res.responseText;
        var templateRegex = /^(Template.__define__\()[\w\W]+(\}\)\);)$/gm;

        //Let's find out if the js is compiled template file. If it is, we take out individual templates
        // and render them individually neglecting extra code added by meteor in the template, otherwise we eval the whole js.
        // I assume it is safe since it is already wrapped as a module by meteor
        var templateSnippets = js.match(templateRegex) ? js.match(templateRegex)[0].split("\n\n") : false;
        if (templateSnippets) {
          _.each(templateSnippets, function(snippet) {

            var templateName = snippet.match(/^Template.__define__\("(\w+)/)[1];

            //can't use cache with templates. We need to delete the template and re-create when evaling template events file
            //because otherwise it will have multiple events defined for the event. This will be possible once we figure out how to
            //unbind events on meteor templates
            // if (LiveUpdateCache.invalidTemplate(templateName, snippet)) {
            // console.log(templateName, "IS CHANGED");
            //cache template
            // LiveUpdateCache.cacheTemplate(templateName, snippet);


            //we need to first delete the already present Template.templateName object because
            // Template.__define__ won't let us re-create if one is already present
            delete Template[templateName];
            //why this? It used to skip evals sometime when eval was used directly
            var reval = eval;
            // console.log(snippet);
            reval(snippet);
            // }
          });
        } else {
          _.each(codeToCommentOutInEval, function(rejex) {
            js = js.replace(rejex, function(match) {
              return "//"+ match;
            });
          });
          var reval = eval;
          //can't use cache all the time. We need to re-eval the helpers/events on a template whenever it is re-rendered
          // if(LiveUpdateCache.invalidScript(jsFile, js)) {
          // console.log(jsFile, "IS CHANGED");
          // LiveUpdateCache.cacheScript(jsFile, js);
          reval(js);
          // }
        }
        self._reRenderPage();
      });
    });
  };

  var should_reload = false;
  this.interceptReload = function() {
    // stopping reloads on file changes and calling refreshPage after initial app is loaded,
    // i.e after the user has loaded the app, and has changed the file
    var self = this;

    Reload._onMigrate("LiveUpdate", function(retry) {
      console.log("INSIDE ON MIGRATE");

      // triggering self reactive computation inside Reload._onMigrate so it won't get triggered on initial page load or when user refreshes the page.
      // Self let user to see un-touched (by LiveUpdate) version of her app if she refreshes the app manually
      Deps.autorun(function() {
        console.log(self.config);
        if (self.config.purelyThirdParty) {
          console.log("IT's PURELY THIRD PARTY");
          should_reload = true;
          return;
        }

        // Meteor creates and uses a collection for client (and server too) versions. It's kept in a local variable in Autoupdate package
        // but what we desire (notification on any file change) can be obtained by Autoupdate.newClientAvailable(). Autoupdate package itself does a
        // reactive computation to make Reload package do its duty and stops that computation after executing it once. But we want to continue receiving notifications
        // on file changes, so we are running our own reactive computation
        Autoupdate.newClientAvailable();

        $.get(Meteor.absoluteUrl()).success(function(html) {
          console.log("HTML: ", html);
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
  },
  parseCss: function (css) {
    //this method is not used anywhere. I've kept it here in case we need to manually parse css and update it that way in future.
    // It's not complete anyway.
    // This is faster than present $("link").attr("href", "newCSSFile") approach, but I wonder how it'll perform with larger CSS files.
    // Besides addRule is webkit only (?), so maybe we'll need another abstraction for achieving same behavior on other browsers too (at least on Firefox)
    var clean= function (css) {
      return css
        .replace(/\/\*[\W\w]*?\*\//g, "") // remove comments
        .replace(/^\s+|\s+$/g, "") // remove trailing spaces
        .replace(/\s*([:;{}])\s*/g, "$1") // remove trailing separator spaces
        .replace(/\};+/g, "}") // remove unnecessary separators
        .replace(/([^:;{}])}/g, "$1;}"); // add trailing separators
    };

    var parse = function(css) {
      // this method should return an object like {selector1: cssText1, selector2: cssText2}
      // which we can iterate over and feed document.stylesheets[0].addRule(selector, cssText).
      return css;
    };

    var process = function(parsedCss) {
      // this method should recieve parsed css from parse method and update css in the document with addRule or whatever cross-browser abstraction we can come up with
      return;
    };


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
