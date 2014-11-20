Package.describe({
  summary: "Live update the changes in browser without full page reload",
  version: "0.1.0",
  name: "channikhabra:live-update",
  git: 'https://github.com/channikhabra/meteor-live-update'
});

Package.on_use(function (api, where) {
  api.versionsFrom("METEOR@0.9.1");

  api.use(['reload',
           'ui',
           'spacebars-compiler',
           'autoupdate',
           'deps',
           'reactive-var']);

  api.add_files([
    'js/live-update.js'
  ], ['client']);

  api.export && api.export(['LiveUpdate', 'ReactiveVar'],['client']);
});
