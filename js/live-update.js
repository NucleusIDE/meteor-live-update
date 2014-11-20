LiveUpdateFactory = function() {
  this.config = {};
  this.configure = function(options) {
    _.extend(this.config, options);
  };

  this._reRenderPage = function() {
    /**
     * Here you'll see all the dirty 'hack-of-the-year's
     * What we are doing is like this:
     * * Remove all the existing body's DOM
     * * Delete the `Template.body` because otherwise meteor won't let us render the body again
     * * Since we have deleted the body, we need to reconstruct it. This method has code copied from meteor's templating package
     * * Refresh the body as meteor does on client startup
     */
    var self = this;

    function detachBody () {
      Template.body.view._domrange.detach(); //detach the dom of body template from page
      Template.body.view._domrange.destroy(); //I don't think this is needed, I just like the sound of it
    }

    function resetBody () {
      delete Template.body;

      //this is the biggest hack here. There are obviously better ways to do this.
      //I got scared when James said "it might not be possible to do this", so I went the full blown dirty-hacker way
      //Code in this function comes mostly from `meteor/packages/templating/templating.js` file where they set the body for first time
      Template.body = new Template('body', function () {
        var parts = Template.body.contentViews;
        // enable lookup by setting `view.template`
        for (var i = 0; i < parts.length; i++)
          parts[i].template = Template.body;
        return parts;
      });
      Template.body.contentViews = []; // array of Blaze.Views
      Template.body.view = null;

      Template.body.addContent = function (renderFunc) {
        var kind = 'body_content_' + Template.body.contentViews.length;

        Template.body.contentViews.push(Blaze.View(kind, renderFunc));
      };

      // This function does not use `this` and so it may be called
      // as `Meteor.startup(Template.body.renderIntoDocument)`.
      Template.body.renderToDocument = function () {
        // Only do it once.
        if (Template.body.view)
          return;

        var view = Blaze.render(Template.body, document.body);
        Template.body.view = view;
      };
    }

    function refreshBody (js) {
      eval(self.bodyContent);
      Template.body.renderToDocument();
      self.bodyContent = ''; //we need to reset the self.bodyContent to empty on new refresh
    }

    function detachIronLayout() {
      Router._layout.destroy();
    }

    function refreshIronLayout() {
      var layoutView = Router._layout.create(),
          parent = document.body;

      Blaze.render(layoutView, parent);
    }


    if(Template.body.view) {
      //Template.body is null when using iron-router
      detachBody();
      resetBody();
      refreshBody();
    }

    if(typeof Router !== 'undefined' && Router._layout) {
      detachIronLayout();
      refreshIronLayout();
    }
  };

  this.bodyContent = '';

  this.updateBodyContent = function(js) {
    //we need to reset the body after new templates are evaled. So we keep the "Template.body.addContent" in this.bodyContent and update it with every file
    //and use it in the end
    if(typeof js !== 'string') return;

    var bodyContentRegex = /(Template.body.addContent\([\w\W]*\}\)\)\;)\nMeteor.startup\(/g;

    var bodyContent = js.match(bodyContentRegex) ? js.match(bodyContentRegex)[0].replace('Meteor.startup(', '') : '';
    this.bodyContent += bodyContent ;
  };

  this.reactifyTemplate = function reactifyTemplate(templateName) {
    //this method was suggested by Devid Greenspan. Doesn't work as he suggested though
    //https://groups.google.com/forum/#!topic/meteor-talk/veN_a1RNpXw
    Template[templateName].renderFuncVar = new ReactiveVar(Template[templateName].renderFunction());
    var template = Template[templateName];
    var func = template.renderFuncVar.get();

    Template[templateName].renderFunction = function() {
      console.log("TEMPLATE RENDER FUNCTION CALLED", templateName);
      // var args = new Array(arguments.length);
      // var ctx = this;

      // for(var i = 0; i < args.length; ++i) {
      //   args[i] = arguments[i];
      // }

      // return func.apply(ctx, args);

      return func;
    };
  };


  this.refreshPage = function(html) {
    console.log("REFERSHING THE PAGE");
    var url = Meteor.absoluteUrl(),
        self = this,
        codeToCommentOutInEval = [
          /**
           * should contain a rejex matching string to comment out, or a function return string to comment out
           */
          //let's not recreate collections (meteor complains if we try to do so). We can comment it out
          // since collection would already be created when user first loads the app
            /[\w\s]*=[\s]*new (Mongo|Meteor).Collection\([\W\w\.\);]*?\n/gm,
          //when meteor methods are defined client side, meteor complains when we eval these. So let's comment them out too
          function(str) {
            var start = str.indexOf('Meteor.methods({');
            if(start < 0) return false;

            var matchPos = Utils.getContainingSubStr(str,'(', ')', start);

            return str.substring(start, matchPos[1]);
          }
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

        _.each(codeToCommentOutInEval, function(codeToComment) {
          if(typeof codeToComment === 'function') {
            var str = codeToComment(js);
            if(str)
              js = js.replace(str, '/*'+ str + '*/');
          } else
            js = js.replace(codeToComment, function(match) {
              res = "/*"+ match + "*/";
              try {
                //in case of local collections defined in helpers, we need to redefine them when templates are reconstructed
                //so try to eval the match or comment it otherwise
                eval(match);
                res = match;
              } catch(e) {}
              return res;
            });
        });

        var reval = function(script) {
          var _eval = eval;
          try {
            var res = _eval(script);
          } catch(error ) {
            console.log("couldn't eval", script);
            if(script.indexOf('Meteor.methods') > 0)
              window.eess = script;
            console.log(error);
          }
        };

        _.each(getNamesFromCompiledTemplate(js), function(tn) {
          //we need to delete the templates otherwise meteor complains that there are more than one templates of same name
          delete Template[tn];
        });

        reval(js);
        self.updateBodyContent(js);

        if (index === jsToFetch.length-1) {
          //execute if this file was the last one to eval
          self._reRenderPage();
        }
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
