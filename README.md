meteor-live-update
==================

> Meteor Package for sexy hot code push. I mean come on! Full page refresh in meteor? Seriously? Meteor is a fucking revolution, let's keep it that way.

##What?
**Awesomeness**, what else? 
This package tries to do something meteor Reload/Autoupdate packages should've been doing. While developing an meteor app, it updates the templates, css (I removed this functionality since meteor itself supports it now), and js without doing a full page refresh. It's more or less a proof of concept for now. I mean I just got it to work "by any means". This certainly doesn't mean that doing it the "proper" way is not possible. 

##Is it really Awesome?
I don't know. I am not a pro meteor ninja (yet). I am somewhat good in JavaScript, similar with meteor, but my code is in no way perfect.  
Please feel free to point out the mistakes and tell me the right way to do things. I love to learn and constructive criticism is welcome. It's really simple (and small) code, give it a read. Comments, suggestions, advice (technical and non-technical) are welcome.

##How to install it?
```sh
meteor add channikhabra:live-update
```

##How to use it?
Just start developing your app. It'll come into action when you change something. It's more or less an intended replacement for Reload package, but it's too young. 


##I Want CSS Live update, but no js. It's buggy
Meteor supports this feature now, so I've removed it from this package.

# Known Issues
* If you make changes to the name of your Collections, you need to refresh the page to get them to actually work
  i.e if you change lines like this in your code
  ```javascript
  Iditos = new Mongo.Collection("idiots")
  ```
  then you'll need to refresh the page. Meteor doesn't allow creating same collection twice, because of which evaling this line cause eval on other code to fail as well. Because of this, we simply comment out these lines when updating js live (for now). Better solutions are of course possible.
