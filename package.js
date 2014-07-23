Package.describe({
    summary: "Live update the changes in browser without full page reload"
});

Package.on_use(function (api, where) {
    api.use(['reload', 'ui', 'spacebars-compiler', 'autoupdate', 'deps']);

    api.add_files([
        'js/live-update.js'
    ], ['client']);

    api.export && api.export(['LiveUpdate', 'LiveUpdateParser', 'LiveUpdateCache'],['client']);
});
