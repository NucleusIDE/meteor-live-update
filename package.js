Package.describe({
  summary: "Live update the changes in browser without full page reload",
  version: "0.1.1",
  name: "nucleuside:live-update",
  git: 'https://github.com/nucleuside/meteor-live-update.git'
});

Package.on_use(function (api, where) {
  api.versionsFrom("METEOR@0.9.1");

  api.use(['reload',
           'jquery',
           'ui',
           'spacebars-compiler',
           'autoupdate',
           'deps']);

  api.add_files([
    'js/live-update.js',
    'js/utils.js'
  ], ['client']);

  api.export && api.export(['LiveUpdate', 'ReactiveVar'],['client']);
});
