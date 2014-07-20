LiveUpdate = {
    updateCss: function() {
        $.get(Meteor.absoluteUrl()).success(function(html) {
            var cssSrcRegex = /^(?:[\s]*<link rel=\"stylesheet\")\shref=\"(.*)\"(?:>\s*)$/m;
            var cssSrc = html.match(cssSrcRegex)[1];
            /*
             * Problems found with $("link") technique of reloading new css:
             * 1. It changes CSS instantly (almost) when we run complete this.refreshPage(). I was trying to do it so if CSS is the only thing changed,
             *    then we could update only css and wont' require full page rewrite/re-eval. But doing that takes 4-5 seconds for new css to load.
             *    May be we should fall-back to my previous approach of tearing apart document.styleSheets[0] object and recreate it with new rules.
             */
            $("link").attr("href", cssSrc);

            //below commented code cleans up the css file so it can be loaded dynamically.
            //Original plan was to parse the css obtained via ajax and do document.stylesheets[0].addRule(selector, rule) with all rules.
            //but I found below method to be more fault tolerant and less prone to errors which I would've brought doing everything manually.
            //keeping this code just in case the jquery approach doesn't work and I have finish this method
            // $.get(cssSrc).success(function(css) {
            //     var sheet = document.styleSheets[0];
            //     _.each(sheet.cssRules, function(rule) {
            //         document.styleSheets[0].removeRule(rule);
            //     });
            //     console.log(LiveUpdateParser.parseCss(css));
            // });
        });

    },
    updateTemplateWithHTML: function(name, newHtml) {
        //This method isn't used anywhere either. I made it when I was trying to figure out how to compile templates manually, so I've kept it here for future reference
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
        //this is clearly a hack (or so I suppose)
        var allDr = UI.DomRange.getComponents(document.body);
        _.each(allDr, function(dr) {
            dr.removeAll();
        });
        if(UI.body.contentParts.length > 1) UI.body.contentParts.shift();
        UI.DomRange.insert(UI.render(UI.body).dom, document.body);
    },
    refreshPage: function() {
        var url = Meteor.absoluteUrl(),
            codeToCommentOutInEval = [
                //let's not recreate collections (meteor complains if we try to do so). We can comment it out
                // since collection would already be created when user first loads the app
                    /\w*\s*=\s*new Meteor.Collection\(\"\w*\"\)/g
            ];

        // let's ignore package files and only re-eval user created js/templates
        var jsToFetch = LiveUpdateParser.getAllScriptSrc().filter(function(src){return src.indexOf("package") < 0;});
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
                        //we need to first delete the already present Template.templateName object because
                        // Template.__define__ won't let us re-create if one is already present
                        delete Template[templateName];
                        eval(snippet);
                    });
                } else {
                    _.each(codeToCommentOutInEval, function(rejex) {
                        js = js.replace(rejex, function(match) {
                            return "//"+ match;
                        });
                    });
                    eval(js);
                }
                LiveUpdate.updateCss();
                LiveUpdate._reRenderPage();
            });
        });
    }
};


LiveUpdateParser = {
    getAllScriptSrc: function(html) {
        var scripts = document.scripts;
        return _.uniq(_.compact(_.map(scripts, function(script) {
            return script.src;
        })));
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


// stopping reloads on file changes and calling refreshPage after initial app is loaded,
// i.e after the user has loaded the app, and has changed the file
Reload._onMigrate("LiveUpdate", function() {
    // triggering this reactive computation inside Reload._onMigrate so it won't get triggered on initial page load or when user refreshes the page.
    // This let user to see un-touched (by LiveUpdate) version of her app if she refreshes the app manually
    Deps.autorun(function() {
        // Meteor creates and uses a collection for client (and server too) versions. It's kept in a local variable in Autoupdate package
        // but what we desire (notification on any file change) can be obtained by Autoupdate.newClientAvailable(). Autoupdate package itself does a
        // reactive computation to make Reload package do its duty and stops that computation after executing it once. But we want to continue receiving notifications
        // on file changes, so we are running our own reactive computation
        Autoupdate.newClientAvailable();
        LiveUpdate.refreshPage();
    });
    return [false];
});
