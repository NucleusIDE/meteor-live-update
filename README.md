meteor-live-update
==================

##What?
**Awesomeness**, what else!
While developing an meteor app, it updates the templates, css (I removed this functionality since meteor itself supports it now), and js without doing a full page refresh. Like Brackets editor does it for simple HTML/CSS.

##Is it really Awesome?
I don't know. I am not a pro meteor ninja (yet). I am somewhat good in JavaScript, similar with meteor, but my code is in no way perfect.  
Please feel free to point out the mistakes and tell me the right way to do things. I love to learn and constructive criticism is welcome. It's really simple (and small) code, give it a read. Comments, suggestions, advice (technical and non-technical) are welcome.

### Demo 
Here's a video of editing `todos` example app with this package.
[![IMAGE ALT TEXT HERE](http://img.youtube.com/vi/Q9M2YLiF-Q4/0.jpg)](http://www.youtube.com/watch?v=Q9M2YLiF-Q4)

##How to install it?
```sh
meteor add nucleuside:live-update
```

##How to use it?
Just start developing your app. It'll come into action when you change something. It's more or less an intended replacement for Reload package. But it's too young, so here's an option to comment out/handle the eval breaking code. Most of the time we need to comment it out, so that we can eval rest of the js file properly.

* **LiveUpdate.beforeUpdate()**  
  You can pass a regexp or a function (or an array of those) to this function. The regexp is matched with each js file before eval, and matched code is commented out. If the argument is function, this function is given the code of the js file before eval and it should return a string. String returned by this function will then be commented out before the eval.  
  Example:
  ```js
  LiveUpdate.beforeUpdate([
    //let's not recreate collections (meteor complains if we try to do so). We can comment it out
    // since collection would already be created when user first loads the app
      /[\w\s]*=[\s]*new (Mongo|Meteor).Collection\([\W\w\.\);]*?\n/gm,
    function(str) {
    //when meteor methods are defined client side, meteor complains when we eval these. So let's comment them out too
      var start = str.indexOf('Meteor.methods({');
      if(start < 0) return false;

      var matchPos = Utils.getContainingSubStr(str,'(', ')', start);

      return str.substring(start, matchPos[1]);
    }
  ]);
  ```
  
* **LiveUpdate.configure()**
  ```js
  LiveUpdate.configure({
    disable: false, //disable this package altogether. Defaults to false
    debug: false  //log extra stuff. Helpful for identifying code to put in LiveUpdate.beforeUpdate() to prevent LiveUpdate from breaking in your app
  });
  ```

##How do it work?
This is how series of events happen to get this package working.

* You make a change in the app
* Meteor detects the change, rebuild the app and make a call for refreshing the page
* We catch that call and stop the reload
* At this point meteor has everything ready (HTML compiled to js and all)
* We fetch all scripts required for the page for eval
* Before evaling each js file, we comment out certain code that might cause the eval to fail (for now it's collection creation and Meteor.methods)
* Function/regex given in `LiveUpdate.beforeUpdate(...)` are executed and commented out before eval
* We eval the script
* After all the eval is done, we teardown the view and re-render it with new Templates/js (I know this is not optimal, and we can do it for individual templates with little more work, but this works without any visual difference, so I thought to do re-render-changed-template-only at later stage)
* Page is updated 😃

##I Want CSS Live update, but no js. It's buggy
Meteor supports this feature now, so I've removed it from this package.

# Known Issues
* Packages that use `Reload._onMigrate` might not work, because this package catches the call it receives and never let it go ahead (otherwise page will reload)
    * If you make changes to the name of your Collections, you need to refresh the page to get them to actually work
      i.e if you change lines like this in your code
      ```javascript
      Iditos = new Mongo.Collection("idiots")
      ```
      then you'll need to refresh the page. Meteor doesn't allow creating same collection twice, because of which evaling this line cause eval on other code to fail as well. Because of this, we simply comment out these lines when updating js live (for now). Better solutions are of course possible.
