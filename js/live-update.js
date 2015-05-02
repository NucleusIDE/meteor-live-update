var LiveUpdateFactory = function () {
  var self = this;

  this.config = {interceptReload: true};
  this.base_url = document.location.host;
  this.Eval = new Eval();
  this.CssUpdate = new CssUpdate();
  this._usingAsLib = true;

  this.configure = function (options) {
    _.extend(this.config, options);
  };

  this._reRenderPage = function () {
    /**
     * Here you'll see all the dirty 'hack-of-the-year's
     * What we are doing is like this:
     * * Remove all the existing body's DOM
     * * Delete the `Template.body` because otherwise meteor won't let us render the body again
     * * Since we have deleted the body, we need to reconstruct it. This method has code copied from meteor's templating package
     * * Refresh the body as meteor does on client startup
     */
    var self = this;

    function detachBody() {
      Template.body.view._domrange.detach(); //detach the dom of body template from page
      Template.body.view._domrange.destroy(); //I don't think this is needed, I just like the sound of it
    }

    function resetBody() {
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

    var bodyContent = '';
    this.withNewBodyContent = function(cb) {
      var bodyTemplateUrl = '/templaste.main.js',
          promise = $.get(bodyTemplateUrl);

      promise.then(cb);

      console.warn("LiveUpdate'ing. \nSince you're not using iron:router, LiveUpdate expect you to have a main.html file and put all your non-template code in that file.\nIt won't work without it");

    };
    var updateBodyContent = function (js) {
      /**
       * We need the base body content which renders rest of the templates in body. We keep it in bodyContent variable
       *
       * @args
       * js  - javascript which contains `Template.body.addContent` code
       */
      //we need to reset the body after new templates are evaled. So we keep the "Template.body.addContent" in this.bodyContent and update it with every file
      //and use it in the end
      if (typeof js !== 'string') return;

      var bodyContentRegex = /(Template.body.addContent\([\w\W]*\}\)\)\;)\nMeteor.startup\(/g;

      var newBodyContent = js.match(bodyContentRegex) ? js.match(bodyContentRegex)[0].replace('Meteor.startup(', '') : '';
      bodyContent += newCodyContent;
    };

    function refreshBody(js) {
      eval(bodyContent);
      Template.body.renderToDocument();
      bodyContent = ''; //we need to reset the self.bodyContent to empty on new refresh
    }

    function detachIronLayout() {
      Router._layout.destroy();
    }

    function refreshIronLayout() {
      var layoutView = Router._layout.create(),
          parent = document.body;

      Blaze.render(layoutView, parent);
    }


    if (Template.body.view) {
      /**
       * Update the view when not using iron:router. Template.body is null when using iron-router
       */
      detachBody();
      resetBody();

      refreshBody();
    }

    if (typeof Router !== 'undefined' && Router._layout) {
      detachIronLayout();
      refreshIronLayout();
    }
  };

  this.refreshFile = function (options) {
    var fileContent = options.newContent,
        filetype = options.fileType,
        oldFileContent = options.oldContent,
        filepath = options.filepath;

    if (filetype === 'html') {
      this._refreshTemplate(fileContent);
    } else if (filetype === 'js') {
      this._safeEvalJs(fileContent, oldFileContent);
    } if (_.contains(['css', 'less', 'sass'], filetype)) {
      this.CssUpdate.update(filepath, fileContent);
    }
    else {
      console.log("LiveUpdate doesn't know how to treat a", filetype, "file");
    }
  };

  this._createTemplateFromHtml = function (templateName, rawHtml) {
    /**
     * Create a template from html string
     * ## Arguments
     * * rawHtml        - Html as a string
     * * template_name  - name of the template to be created with rawHtml as content
     */

    var templateRenderFunction = eval(SpacebarsCompiler.compile(
      rawHtml, {
        isTemplate: true,
        sourceName: 'Template "' + templateName + '"'
      }
    ));

    if (Template[templateName]) {
      /**
       * If template already exists, we only update its renderFunction which in turns render its view, so we can keep
       * Template.rendered, Template.created etc hooks
       */
      Template[templateName].renderFunction = templateRenderFunction;
    } else {
      /**
       * If Template doesn't already exist, we create a new Template
       */
      Template[templateName] = Template("Template." + templateName, templateRenderFunction);
    }

    return Template[templateName];
  };

  this._refreshTemplate = this.pushHtml = function (rawHtml) {
    var allTemplates = jQuery.parseHTML(rawHtml);

    jQuery.each(allTemplates, function (i, el) {
      if (el.nodeName.toLowerCase() == 'template') {
        var $el = jQuery(el);
        var name = $el.attr('name');
        var html = $el.html().replace(/\{\{\&gt\;/g, '{{>');   // the template inclusion tags appear as &gt; in obtained html so need to be taken care of

        self._createTemplateFromHtml(name, html);
      }
    });

    this._reRenderPage();
  };

  this._safeEvalJs = this.pushJs = function (newJs, oldJs) {
    if (!newJs) {
      return;
    }
    this.Eval.eval(newJs, oldJs);
    this._reRenderPage();
  };

  var should_reload = false;
  this._interceptReload = function () {
    var self = this;

    Reload._onMigrate("LiveUpdate", function (retry) {
      // triggering self reactive computation inside Reload._onMigrate so it won't get triggered on initial page load or when user refreshes the page.
      // Self let user to see un-touched (by LiveUpdate) version of her app if she refreshes the app manually
      Deps.autorun(function () {
        // Meteor creates and uses a collection for client (and server too) versions. It's kept in a local variable in Autoupdate package
        // but what we desire (notification on any file change) can be obtained by Autoupdate.newClientAvailable(). Autoupdate package itself does a
        // reactive computation to make Reload package do its duty and stops that computation after executing it once. But we want to continue receiving notifications
        // on file changes, so we are running our own reactive computation
        Autoupdate.newClientAvailable();

        if (! self.config.interceptReload) {
          console.log("Not intercepting reload");
          should_reload = true;
          return;
        }
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

LiveUpdate = new LiveUpdateFactory();
LiveUpdate._interceptReload();
