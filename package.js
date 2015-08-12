Package.describe({
  summary: "Live update the changes in browser without full page reload",
  version: "0.3.3",
  name: "nucleuside:live-update",
  git: 'https://github.com/nucleuside/meteor-live-update.git'
});

Package.on_use(function (api, where) {
  api.versionsFrom("METEOR@0.9.1");

  api.use([
    'reload',
    'jquery',
    'ui',
    'spacebars-compiler',
    'autoupdate',
    'underscore',
    'deps',
    'reactive-var',
    'kevohagan:ramda@0.13.0'
  ]);

  api.add_files([
    'js/eval.js',
    'js/live-update.js'
  ], ['client']);

  api.export && api.export(['LiveUpdate'], ['client']);
});
