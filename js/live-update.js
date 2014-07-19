LiveUpdate = {
    updateCss: function() {
        $.get(Meteor.absoluteUrl()).success(function(html) {
            var cssSrcRegex = /^(?:[\s]*<link rel=\"stylesheet\")\shref=\"(.*)\"(?:>\s*)$/m;
            var cssSrc = Meteor.absoluteUrl().replace(/\/$/,'') + html.match(cssSrcRegex)[1];
            $("link").attr("href", cssSrc);

            // $.get(cssSrc).success(function(css) {
            //     //below commented code cleans up the css file so it can be loaded dynamically.
            //     //Original plan was to parse the css obtained via ajax and do document.stylesheets[0].addRule(selector, rule) with all rules.
            //     //but I found below method to be more fault tolerant and less prone to errors which I would've brought doing everything manually.
            //     //keeping this code just in case the jquery approach doesn't work and I have finish this method
            //     // var sheet = document.styleSheets[0];
            //     // _.each(sheet.cssRules, function(rule) {
            //     //     document.styleSheets[0].removeRule(rule);
            //     // });
            //     // console.log(LiveUpdateParser.parseCss(css));
            // });
        });

    },
    updateTemplateWithHTML: function(name, newHtml) {
        delete Template[name];
        Template.__define__(name, eval(Spacebars.compile(
            newHtml, {
                isTemplate: true,
                sourceName: 'Template "' + name + '"'
            }
        )));
        this._reRenderPage();
    },
    _reRenderPage: function() {
        var allDr = UI.DomRange.getComponents(document.body);
        _.each(allDr, function(dr) {
            dr.removeAll();
        });
        if(UI.body.contentParts.length > 1) UI.body.contentParts.shift();
        UI.DomRange.insert(UI.render(UI.body).dom, document.body);
    },
    refreshPage: function(retry) {
        var url = window.location.origin,
            html,
            templatesToFetch = [],
            templateJs;

        templatesToFetch = LiveUpdateParser.getAllScriptSrc().filter(function(src){return src.indexOf("template") >= 0;});;
        _.each(templatesToFetch, function(template) {
            var req = $.get(template);
            //it's strange, the responseText exists on error response not on the success response
            req.always(function(res) {
                templateJs = typeof res === 'string' ? res : res.responseText;
                var templateRegex = /^(Template.__define__\()[\w\W]+(\}\)\);)$/gm;
                var templateSnippets = templateJs.match(templateRegex) ? templateJs.match(templateRegex)[0].split("\n\n") : false;
                if (templateSnippets) {
                    _.each(templateSnippets, function(snippet) {
                        var templateName = snippet.match(/^Template.__define__\("(\w+)/)[1];

                        delete Template[templateName];
                        eval(snippet);
                    });
                } else eval(templateJs);
                LiveUpdate._reRenderPage();
            });
        });
        this.updateCss();
    }
};


LiveUpdateParser = {
    getRootPage: function() {
        var url = Meteor.absoluteUrl(),
            req = $.get(url),
            result;
        return req.success();
    },
    getAllScriptSrc: function(html) {
        var scripts = this._getTags("script");
        return _.uniq(_.compact(_.map(scripts, function(script) {
            return script.src;
        })));
    },
    _getTags: function(tag) {
        return tag === 'script' ? document.scripts : [];
    },
    parseCss: function (css) {
        // this method is not used elsewhere. I've kept it here in case we need to parse css and update it that way in future.
        // It's not complete anyway. The parse method should return an object like {selector1: cssText1, selector2: cssText2}
        // which we can iterate over and feed document.stylesheets[0].addRule(selector, cssText). This was is fast actually
        var clean= function (css) {
            return css
                .replace(/\/\*[\W\w]*?\*\//g, "") // remove comments
                .replace(/^\s+|\s+$/g, "") // remove trailing spaces
                .replace(/\s*([:;{}])\s*/g, "$1") // remove trailing separator spaces
                .replace(/\};+/g, "}") // remove unnecessary separators
                .replace(/([^:;{}])}/g, "$1;}"); // add trailing separators
        };

        var parse = function(css) {
            return css;
        };

        return parse(clean(css));
    }
};


// stopping reloads on file changes and calling refreshPage after initial app is loaded,
// i.e after the user has loaded the app, and has changed the file
Reload._onMigrate("LiveUpdate", function() {
    Deps.autorun(function() {
        Autoupdate.newClientAvailable();
        LiveUpdate.refreshPage();
    });
    return [false];
});
