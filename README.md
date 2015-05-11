meteor-live-update
==================

##What?
`nucleuside:live-update` is a helper package which allow you to hot-push the code into your meteor app. Yup, that means no refreshes for updating your js/html

## A little too twist
This package is a part of Nucleus(IDE). Nucleus is an in-browser editor for collaboratively developing meteor apps in power mode. It's awesome, but at pre alpha for now. Nucleus has direct access to all the app's code right within the browser, which allow it to just hot-push it (using live-update) into the app. But when using an external editor (e.g Sublime Text), we don't have that luxury of direct access to the app. So I am writing this package as a library for hot-loading js/html code for meteor apps, and am working on a generic adaptor package which would use this package and act as a stnadalone hot-loading solution for meteor. I'll update this readme when I am done with that package. Till then, feel free to use `nucleuside:live-update` for building a plugin for your editor. Here's how you can do it:


##How to use it?
* **LiveUpdate.configure()**
  ```js
  LiveUpdate.configure({
    interceptReload: true  //do not reload the app on changes, because you're doing it. Defaults to true
  });
  ```
That's about all for the configuration for now. It exposes two functions to hot push cod:

* **LiveUpdate.pushHtml(rawHtml)**
  `rawHtml` is the HTML of your template. All the HTML passed to this function should be contained in one or more `<template name="whatever">...</template>` tags. 

* **LiveUpdate.pushJs(newJs, oldJs)**
  This method expect you to pass it the code of a whole file, and it expect old code along with new. Why `newJs` and `oldJs` you ask? Well, **this package do not hot-swap the js code in meteor app**. Don't take your hopes too high. It simply eval the new code. Some code can't be evaled more than once in one session (i.e without refresh), like code which create collections, autoruns etc. For handling such special cases, it need the old code to compare against. Bear with me there, there are better ways of doing this, I am just trying to get the whole house of cards standing first. We'll optimize when needed. Any pull requests or suggestions for improvement are more than welcome.

### But how to send new code to LiveUpdate?
Well, LiveUpdate lives in the meteor app, to send code to LiveUpdate you'll need to send the code to the app itself somehow. From the top of my head right now, you can create a server side route which accepts html/js code and save it in a collection. From that collection, the code is recieved by `LiveUpdate` on the client side of the app, and passed to it's appropriate function. Simple, eh? You can wait on me to implement this (may be coming weekend) or if you are too eager, please go ahead and do it. 


## What about CSS/SASS/LESS?
I think meteor does fairly good job at updating them (call it bragging, but this package had a naive but working implementation of that feature way before meteor added it officially).

### Demo 
Here's a video of editing `todos` example app with this package. This is an old video, new live-update works better than what's shown in there. I'll create a new demo once I am done with the generic adaptor package for hot-loading code in meteor.

[![IMAGE ALT TEXT HERE](http://img.youtube.com/vi/Q9M2YLiF-Q4/0.jpg)](http://www.youtube.com/watch?v=Q9M2YLiF-Q4)

##How to install it?
```sh
meteor add nucleuside:live-update
```

##How do it work?
This is how series of events happen to get this package working.

* You make a change in the app
* You send the new code to appropriate `LiveUpdate` method for hot push
* Done.

**Come on, seriously, how do this shit work?**
Ain't you the polite one? Well, this is roughly how it works:

* For Javascript code
  * **NOTE** The **code is not hot swapped**, it is evaled
  * The code given to `LiveUpdate.pushJs(newJs, oldJs)` is passed through a series of patches which take care of code for creating events (so it won't create events multiple times), creating collections (can't re-create already existing collection), autoruns (same as events) etc etc.
  * The patches return cleansed code which is then `eval`ed.
* For html code
  * The html given to `LiveUpdate.pushHtml(rawHtml)` is parsed for `<template>` tags
  * We create new `Template`s for each `<template>` tag found in given html, over-writing already present templates with same name
  * We re-render entire page. This is bit hackhis, more optimal would be to re-render only the changed templates. May be at some later time.

# Known Issues
* Packages that use `Reload._onMigrate` might not work, because this package catches the call it receives and never let it go ahead (otherwise page will reload)
    * If you make changes to the name of your Collections, you need to refresh the page to get them to actually work
      i.e if you change lines like this in your code
      ```javascript
      Iditos = new Mongo.Collection("idiots")
      ```
      then you'll need to refresh the page. Meteor doesn't allow creating same collection twice, because of which evaling this line cause eval on other code to fail as well. Because of this, we simply comment out these lines when updating js live (for now). Better solutions are of course possible.

# Known areas that need improvements
* We re-render the entire page on a template update, this can certainly be improved
* We eval the js, may be we can hot-swap code somehow? But how?
* Even if hot-swapping is not possible (too much mutability and shit), this package use `regexp`s to detect conflicting code (in patches, read how it works above). I mean like, can you believe that? Regexps for detecting code? I must be nuts or something. This needs to be moved to something more sophisticated, esprima or something.
